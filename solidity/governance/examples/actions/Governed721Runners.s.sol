// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { ElectionRegistry } from "@src/core/helpers/ElectionRegistry.sol";
import { Governed721Actions } from "./Governed721Actions.s.sol";

/// @title Governed721Runners
/// @notice Stateful checkpoint runners for the Governed721 DAO — both the one-time
///         initialisation flow and the ongoing management flows.
///
/// Each run*() function advances one flow as far as current on-chain state allows,
/// stops at the first phase still waiting on a voting window or timelock, and logs
/// what it executed and what it is waiting for.
///
/// ─── Initialisation ───────────────────────────────────────────────────────────
///   run()                  — one-time init: setup → voter roles → executive election
///
/// ─── Management ───────────────────────────────────────────────────────────────
///   runSplitPaymentFlow    — propose new split → veto/timelock window → execute
///   runAddAllowedTokenFlow — propose whitelist → voting period → execute
///   runAddToBlacklistFlow  — propose blacklist → voting period → execute
///
/// ─── Atomic wrappers (no checkpoints) ────────────────────────────────────────
///   runMintNft / runBuyNft / runCollectPayment
///
/// Pass the SAME (nonce, parameters) on every call for a given flow invocation.
/// The action ID is derived deterministically; both propose and execute phases must
/// share the same ID. Use a fresh nonce to start a new, independent invocation.
contract Governed721Runners is Governed721Actions {

    uint256 private _startTime;
    string constant ELECTION_TITLE = "Executive Election 1";

    ///////////////////////////////////////////////////////////////////////////
    //                          MANDATE ID STRUCTS
    ///////////////////////////////////////////////////////////////////////////

    struct InitMandateIds {
        uint16 initialSetup;
        uint16 claimVoterRole;
        uint16 createElection;
        uint16 openVote;
        uint16 tallyElection;
        uint16 cleanupElection;
    }

    struct ManagementMandateIds {
        uint16 proposeSplit;
        uint16 vetoMinter;
        uint16 vetoOwner;
        uint16 vetoIntermediary;
        uint16 splitCheckpoint1;
        uint16 splitCheckpoint2;
        uint16 executeSplit;
        uint16 addToken;
        uint16 addToBlacklist;
        uint16 collectPayment;
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     INITIALISATION RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Initial setup mandate — assigns role labels, no voting required.
    //   [1] Claim voter roles — any key holder with an NFT role claims Voter role (4).
    //   [2] Create executive election + nominate — starts nomination timer.
    //   ⏳ nomination period
    //   [3] Open voting + cast votes — all provided keys vote for all nominees.
    //   ⏳ voting period
    //   [4] Tally and cleanup election — assigns Executive role to winners.
    //
    // Prerequisites: NFT minting and owner/artist/intermediary role assignment must
    // be done before run() is called so key holders qualify for voter role in phase 1.

    /// @notice Advance the Governed721 initialisation flow as far as current on-chain state allows.
    /// @param powers           Address of the deployed Governed721 Powers instance.
    /// @param electionRegistry Address of the ElectionRegistry used by this DAO.
    /// @param nonce            Nonce used to derive deterministic action IDs.
    /// @param privateKeys      Keys with permission to execute each governance step.
    function run(
        address powers,
        address electionRegistry,
        uint256 nonce,
        uint256[] memory privateKeys
    ) public {
        if (_startTime == 0) _startTime = block.timestamp;

        InitMandateIds memory m = _resolveInitMandateIds(powers);

        // ── Phase 0: Initial setup (no voting, execute immediately) ─────────
        if (!_isSetupComplete(powers)) {
            console2.log("Runner [0]: running initial setup mandate.");
            vm.startBroadcast(privateKeys[0]);
            IPowers(powers).request(m.initialSetup, abi.encode(), nonce, "Executing initial setup mandate");
            vm.stopBroadcast();
            _logElapsed();
        }

        // ── Phase 1: Claim voter roles ────────────────────────────────────────
        if (!_haveVotersBeenAssigned(powers)) {
            console2.log("Runner [1]: claiming voter roles.");
            _claimVoterRolesWithKeys(powers, m.claimVoterRole, privateKeys, nonce);
            _logElapsed();
        }

        // ── Phase 2: Create election + nominate ───────────────────────────────
        if (!_haveActionsBeenSubmitted(powers, m.createElection, 1)) {
            console2.log("Runner [2]: creating executive election and nominating.");
            createExecutiveElection(powers, privateKeys, nonce);
            console2.log("Runner: pausing... nomination period must close before phase 3.");
            _logElapsed();
            return;
        }

        // ── Phase 3: Open voting + cast votes ─────────────────────────────────
        uint256 electionId = _getElectionId(powers, ELECTION_TITLE);
        if (!_haveActionsBeenSubmitted(powers, m.openVote, 1)) {
            if (!_isNominationPeriodOver(electionRegistry, electionId)) {
                console2.log("Runner: pausing... nomination period still open.");
                _logBlocksUntilVoting(electionRegistry, electionId);
                return;
            }
            uint256 nomineeCount = ElectionRegistry(electionRegistry).getNomineeCount(electionId);
            bool[][] memory voteSelections = _buildVoteSelectionsForAll(privateKeys.length, nomineeCount);
            console2.log("Runner [3]: opening voting and casting votes.");
            voteInExecutiveElection(powers, electionRegistry, voteSelections, electionId, privateKeys, nonce);
            console2.log("Runner: pausing... voting period must close before phase 4.");
            _logElapsed();
            return;
        }

        // ── Phase 4: Tally + cleanup ──────────────────────────────────────────
        if (!_haveActionsBeenSubmitted(powers, m.tallyElection, 1)) {
            if (!_isVotingPeriodOver(electionRegistry, electionId)) {
                console2.log("Runner: pausing... voting period still open.");
                _logBlocksUntilTally(electionRegistry, electionId);
                return;
            }
            console2.log("Runner [4]: tallying executive election.");
            tallyExecutiveElection(powers, privateKeys, nonce);
            _logElapsed();
        }

        console2.log("Runner: initialisation complete!");
        _logElapsed();
    }

    ///////////////////////////////////////////////////////////////////////////
    //                   SPLIT PAYMENT FLOW (2-phase)
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phase 0 — Propose: Executive proposes a new split and starts the veto window.
    //                    Minters, owners, or intermediaries can cast a veto during
    //                    this window. A timelock protects against rushed execution.
    // ⏳ veto window + timelock (10 min on Sepolia)
    // Phase 1 — Execute: If no vetoes were cast, checkpoints 1 & 2 pass and the
    //                    new split is applied.
    //
    // Veto helpers: call vetoSplitMinter / vetoSplitOwner / vetoSplitIntermediary
    // at any point before phase 1 to block the split change for that role.

    /// @notice Advance the split payment change flow.
    function runSplitPaymentFlow(
        address powers,
        uint8 role,
        uint8 percentage,
        uint256 nonce,
        uint256[] memory privateKeys
    ) public {
        ManagementMandateIds memory m = _resolveMgmtMandateIds(powers);

        bytes memory calldata_ = abi.encode(role, percentage);
        uint256 checkpoint1ActionId = calculateActionId(m.splitCheckpoint1, calldata_, nonce);
        uint256 executeSplitActionId = calculateActionId(m.executeSplit, calldata_, nonce);

        (, , uint48 executedAt, , , ,) = IPowers(powers).getActionData(executeSplitActionId);
        if (executedAt > 0) {
            console2.log("Runner: split payment flow already complete.");
            return;
        }

        (, uint48 proposedAt, , , , ,) = IPowers(powers).getActionData(checkpoint1ActionId);
        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing split payment and initiating veto window.");
            initiateSplitPayment(powers, role, percentage, privateKeys, nonce);
            console2.log("Runner: pausing... veto window and timelock must close before phase 1.");
            _logTimelockRemaining(powers, m.splitCheckpoint1, proposedAt);
            return;
        }

        if (!_isTimelockPast(powers, m.splitCheckpoint1, uint256(proposedAt))) {
            console2.log("Runner: pausing... timelock still active.");
            _logTimelockRemaining(powers, m.splitCheckpoint1, proposedAt);
            return;
        }

        console2.log("Runner [1]: executing split payment.");
        executeSplitPayment(powers, role, percentage, privateKeys, nonce);
        console2.log("Runner: split payment flow complete.");
    }

    /// @notice Cast a Minter veto against the pending split change.
    function vetoSplitMinter(address powers, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public {
        vetoSplitPayment(powers, 0, role, percentage, privateKeys, nonce);
    }

    /// @notice Cast an Owner veto against the pending split change.
    function vetoSplitOwner(address powers, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public {
        vetoSplitPayment(powers, 1, role, percentage, privateKeys, nonce);
    }

    /// @notice Cast an Intermediary veto against the pending split change.
    function vetoSplitIntermediary(address powers, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public {
        vetoSplitPayment(powers, 2, role, percentage, privateKeys, nonce);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                  ADD ALLOWED TOKEN FLOW (2-phase)
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phase 0 — Propose + vote: Executives propose and vote to whitelist a token.
    // ⏳ voting period (5 min on Sepolia)
    // Phase 1 — Execute: If the vote passed, the token is whitelisted.

    /// @notice Advance the token whitelisting flow.
    function runAddAllowedTokenFlow(
        address powers,
        address token,
        uint256 nonce,
        uint256[] memory privateKeys
    ) public {
        ManagementMandateIds memory m = _resolveMgmtMandateIds(powers);

        uint256 actionId = calculateActionId(m.addToken, abi.encode(token), nonce);
        (, uint48 proposedAt, uint48 requestedAt, , , ,) = IPowers(powers).getActionData(actionId);

        if (requestedAt > 0) {
            console2.log("Runner: add allowed token flow already complete.");
            return;
        }

        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing to whitelist token.");
            whitelistPaymentTokensPropose(powers, token, privateKeys, nonce);
            console2.log("Runner: pausing... voting period must close before phase 1.");
            _logVoteDeadline(powers, actionId);
            return;
        }

        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(actionId);
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing... voting period still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        console2.log("Runner [1]: executing token whitelist.");
        whitelistPaymentTokensExecute(powers, token, privateKeys, nonce);
        console2.log("Runner: add allowed token flow complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                  ADD TO BLACKLIST FLOW (2-phase)
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phase 0 — Propose + vote: Executives propose and vote to blacklist an account.
    // ⏳ voting period (5 min on Sepolia)
    // Phase 1 — Execute: If the vote passed, the account is blacklisted.

    /// @notice Advance the account blacklisting flow.
    function runAddToBlacklistFlow(
        address powers,
        address account,
        uint256 nonce,
        uint256[] memory privateKeys
    ) public {
        ManagementMandateIds memory m = _resolveMgmtMandateIds(powers);

        uint256 actionId = calculateActionId(m.addToBlacklist, abi.encode(account), nonce);
        (, uint48 proposedAt, uint48 requestedAt, , , ,) = IPowers(powers).getActionData(actionId);

        if (requestedAt > 0) {
            console2.log("Runner: add to blacklist flow already complete.");
            return;
        }

        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing to blacklist account.");
            blacklistAccountPropose(powers, account, privateKeys, nonce);
            console2.log("Runner: pausing... voting period must close before phase 1.");
            _logVoteDeadline(powers, actionId);
            return;
        }

        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(actionId);
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing... voting period still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        console2.log("Runner [1]: executing blacklist.");
        blacklistAccountExecute(powers, account, privateKeys, nonce);
        console2.log("Runner: add to blacklist flow complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                      ATOMIC ACTION WRAPPERS
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Mint NFTs and set approvals. No governance vote required.
    function runMintNft(address governed721, address intermediary, uint256 privateKeyOwner, address artist, uint256 quantity) public {
        console2.log("Runner: minting", quantity, "NFT(s).");
        mintNftAtGoverned721(governed721, intermediary, privateKeyOwner, artist, quantity);
        console2.log("Runner: mint complete.");
    }

    /// @notice Transfer an NFT with ETH payment. No governance vote required.
    function runBuyNft(address governed721, uint256 tokenId, uint256 price, address oldOwner, address newOwner, uint256 privateKeyIntermediary, uint256 nonce) public {
        console2.log("Runner: executing NFT sale for tokenId", tokenId);
        buyNftAtGoverned721(governed721, tokenId, price, oldOwner, newOwner, privateKeyIntermediary, nonce);
        console2.log("Runner: sale complete.");
    }

    /// @notice Collect split payment for each provided key holder. No governance vote required.
    function runCollectPayment(address powers, uint256 transferId, uint256[] memory privateKeys, uint256 nonce) public {
        console2.log("Runner: collecting split payment for transferId", transferId);
        collectPayment(powers, transferId, privateKeys, nonce);
        console2.log("Runner: payment collection complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                      MANDATE ID RESOLUTION
    ///////////////////////////////////////////////////////////////////////////

    function _resolveInitMandateIds(address powers) internal view returns (InitMandateIds memory ids) {
        Powers org = Powers(payable(powers));
        ids.initialSetup    = findMandateIdInOrg("Initial Setup: Assign role labels and revokes itself after execution", org);
        ids.claimVoterRole  = findMandateIdInOrg("Claim Voter Role: Artists, Owners, and Intermediarys can claim voter role.", org);
        ids.createElection  = findMandateIdInOrg("Create Executive Election: Voters can create election.", org);
        ids.openVote        = findMandateIdInOrg("Open Executive Vote: Open voting.", org);
        ids.tallyElection   = findMandateIdInOrg("Tally Executive Election: Tally votes.", org);
        ids.cleanupElection = findMandateIdInOrg("Cleanup Election: Cleanup mandates.", org);
    }

    function _resolveMgmtMandateIds(address powers) internal view returns (ManagementMandateIds memory ids) {
        Powers org = Powers(payable(powers));
        ids.proposeSplit     = findMandateIdInOrg("Propose Split Payment: Executive proposes new split. Role 1 = Artist, Role 2 = Intermediary. The old owner gets the remainder after Artist and Intermediary split.", org);
        ids.vetoMinter       = findMandateIdInOrg("Veto Split (Minter): Minter can veto split change.", org);
        ids.vetoOwner        = findMandateIdInOrg("Veto Split (Owner): Owner can veto split change.", org);
        ids.vetoIntermediary = findMandateIdInOrg("Veto Split (Intermediary): Intermediary can veto split change.", org);
        ids.splitCheckpoint1 = findMandateIdInOrg("Split Checkpoint 1: Confirm no Minter veto.", org);
        ids.splitCheckpoint2 = findMandateIdInOrg("Split Checkpoint 2: Confirm no Owner veto.", org);
        ids.executeSplit      = findMandateIdInOrg("Execute Split Payment: Set new split payment.", org);
        ids.addToken         = findMandateIdInOrg("Add Allowed Token: Whitelist a token.", org);
        ids.addToBlacklist   = findMandateIdInOrg("Add account to blacklist: Blacklist an account. They will not be able to transfer or mint NFTs.", org);
        ids.collectPayment   = findMandateIdInOrg("Collect Split Payment: Role holders can collect their split of payment.", org);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                          STATE PREDICATES
    ///////////////////////////////////////////////////////////////////////////

    function _isSetupComplete(address powers) internal view returns (bool) {
        return bytes(Powers(payable(powers)).getRoleLabel(1)).length > 0;
    }

    function _haveVotersBeenAssigned(address powers) internal view returns (bool) {
        return IPowers(powers).getAmountRoleHolders(4) > 0;
    }

    function _haveActionsBeenSubmitted(address powers, uint16 mandateId, uint256 count) internal view returns (bool) {
        return IPowers(powers).getQuantityMandateActions(mandateId) >= count;
    }

    function _getElectionId(address powers, string memory title) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(powers, title)));
    }

    function _isNominationPeriodOver(address electionRegistry, uint256 electionId) internal view returns (bool) {
        return block.number > ElectionRegistry(electionRegistry).getElectionInfo(electionId).startBlock;
    }

    function _isVotingPeriodOver(address electionRegistry, uint256 electionId) internal view returns (bool) {
        return block.number > ElectionRegistry(electionRegistry).getElectionInfo(electionId).endBlock;
    }

    function _isTimelockPast(address powers, uint16 mandateId, uint256 proposedAt) internal view returns (bool) {
        PowersTypes.Conditions memory cond = IPowers(powers).getConditions(mandateId);
        return block.number >= proposedAt + uint256(cond.timelock);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                           PHASE HELPERS
    ///////////////////////////////////////////////////////////////////////////

    function _claimVoterRolesWithKeys(address powers, uint16 claimVoterRoleId, uint256[] memory privateKeys, uint256 nonce) internal {
        for (uint256 i = 0; i < privateKeys.length; i++) {
            address claimant = vm.addr(privateKeys[i]);
            if (
                Powers(payable(powers)).hasRoleSince(claimant, 1) > 0 ||
                Powers(payable(powers)).hasRoleSince(claimant, 2) > 0 ||
                Powers(payable(powers)).hasRoleSince(claimant, 3) > 0
            ) {
                vm.startBroadcast(privateKeys[i]);
                IPowers(powers).request(
                    claimVoterRoleId,
                    abi.encode(claimant),
                    nonce + i,
                    string.concat("Claiming voter role for: ", vm.toString(claimant))
                );
                vm.stopBroadcast();
            }
        }
    }

    function _buildVoteSelectionsForAll(uint256 voterCount, uint256 nomineeCount) internal pure returns (bool[][] memory selections) {
        selections = new bool[][](voterCount);
        for (uint256 i = 0; i < voterCount; i++) {
            selections[i] = new bool[](nomineeCount);
            for (uint256 j = 0; j < nomineeCount; j++) {
                selections[i][j] = true;
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    //                           LOGGING HELPERS
    ///////////////////////////////////////////////////////////////////////////

    function _logElapsed() internal view {
        uint256 elapsed = _startTime == 0 ? 0 : block.timestamp - _startTime;
        uint256 h = elapsed / 3600;
        uint256 m = (elapsed % 3600) / 60;
        uint256 s = elapsed % 60;
        console2.log("Runner: elapsed time: %sh %sm %ss", h, m, s);
    }

    function _logBlocksUntilVoting(address electionRegistry, uint256 electionId) internal view {
        uint256 startBlock = ElectionRegistry(electionRegistry).getElectionInfo(electionId).startBlock;
        if (block.number < startBlock) {
            console2.log("Runner: blocks remaining until voting opens:", startBlock - block.number);
        }
    }

    function _logBlocksUntilTally(address electionRegistry, uint256 electionId) internal view {
        uint256 endBlock = ElectionRegistry(electionRegistry).getElectionInfo(electionId).endBlock;
        if (block.number < endBlock) {
            console2.log("Runner: blocks remaining until tally:", endBlock - block.number);
        }
    }

    function _logTimelockRemaining(address powers, uint16 mandateId, uint48 proposedAt) internal view {
        if (proposedAt == 0) return;
        PowersTypes.Conditions memory cond = IPowers(powers).getConditions(mandateId);
        uint256 deadline = uint256(proposedAt) + uint256(cond.timelock);
        if (block.number < deadline) {
            console2.log("Runner: blocks remaining until timelock expires:", deadline - block.number);
        }
    }

    function _logVoteDeadline(address powers, uint256 actionId) internal view {
        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(actionId);
        if (block.number < voteEnd) {
            console2.log("Runner: blocks remaining until vote ends:", voteEnd - block.number);
        }
    }
}
