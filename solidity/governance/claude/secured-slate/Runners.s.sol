// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { SlateRegistry } from "@src/core/helpers/SlateRegistry.sol";
import { SecuredSlateActions } from "./Actions.s.sol";

/// @title SecuredSlateRunners
/// @notice Stateless checkpoint runners for Secured Slate Governance.
///
/// Each run*() function checks on-chain state and advances a flow as far as current
/// conditions allow, stopping at the first phase that is still waiting on a time window.
/// Call the same runner repeatedly (with identical arguments) to advance through phases.
///
/// Flows:
///   runSetup              — one-time initialisation
///   runSlateElectionFlow  — create election → add slates → vote → execute results
///   runMemberAdditionFlow — propose → vote → execute member onboarding
///   runBlacklistFlow      — blacklist → (optional) revoke membership
contract SecuredSlateRunners is SecuredSlateActions {

    ///////////////////////////////////////////////////////////////////////////
    //                           SETUP RUNNER
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Run the initial setup mandate if it has not yet been executed.
    function runSetup(address powers, uint256 privateKey, uint256 nonce) public {
        if (_isSetupComplete(powers)) {
            console2.log("Runner: setup already complete.");
            return;
        }
        console2.log("Runner [setup]: executing initial setup mandate.");
        runInitialSetup(powers, privateKey, nonce);
        console2.log("Runner: setup complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                       SLATE ELECTION RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Create election — Members open a new election in the SlateRegistry.
    //   ⏳ Submission window (20 min on test deployment)
    //       During this window: anyone calls addSlate(); Security Council calls removeSlate() to veto.
    //   [1] Cast votes — All provided private keys vote for the specified slates.
    //   ⏳ Voting window (30 min on test deployment)
    //   [2] Execute results — Anyone triggers execution of winning slates.

    /// @notice Advance a slate election flow as far as current on-chain state allows.
    /// @param powers           Deployed Powers instance
    /// @param slateRegistry    Deployed SlateRegistry instance
    /// @param electionTitle    Unique title for this election
    /// @param maxSlates        Maximum slates per election
    /// @param maxVotes         Maximum votes per voter
    /// @param maxWinners       Maximum winning slates
    /// @param slateIndexes     Slate indexes each voter will vote for (same for all voters in this runner)
    /// @param privateKeys      Keys used at each phase (index 0 creates election; all keys vote)
    /// @param nonce            Nonce shared across all actions in this election
    function runSlateElectionFlow(
        address powers,
        address slateRegistry,
        string memory electionTitle,
        uint8 maxSlates,
        uint8 maxVotes,
        uint8 maxWinners,
        uint16[] memory slateIndexes,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        uint256 electionId = uint256(keccak256(abi.encodePacked(powers, electionTitle)));
        SlateRegistry.Election memory election = SlateRegistry(slateRegistry).getElectionInfo(electionId);

        // ── Phase 0: Create election ──────────────────────────────────────────
        if (election.startBlock == 0) {
            console2.log("Runner [0]: creating election:", electionTitle);
            createElection(powers, slateRegistry, electionTitle, maxSlates, maxVotes, maxWinners, privateKeys[0], nonce);
            console2.log("Runner: pausing... submission window open until block", SlateRegistry(slateRegistry).getElectionInfo(electionId).startBlock);
            return;
        }

        // ── Waiting for submission window to close ────────────────────────────
        if (block.number < election.startBlock) {
            console2.log("Runner: submission window still open.");
            console2.log("Runner: blocks remaining:", election.startBlock - block.number);
            return;
        }

        // ── Phase 1: Cast votes ───────────────────────────────────────────────
        if (block.number >= election.startBlock && block.number <= election.endBlock) {
            for (uint256 i = 0; i < privateKeys.length; i++) {
                address voter = vm.addr(privateKeys[i]);
                if (!SlateRegistry(slateRegistry).hasUserVoted(voter, electionId) &&
                    Powers(payable(powers)).hasRoleSince(voter, 1) > 0)
                {
                    console2.log("Runner [1]: casting vote for:", voter);
                    castVote(powers, electionId, slateIndexes, privateKeys[i], nonce + i);
                }
            }
            console2.log("Runner: pausing... voting window open until block", election.endBlock);
            return;
        }

        // ── Phase 2: Execute results ──────────────────────────────────────────
        console2.log("Runner [2]: executing winning slates.");
        executeResults(powers, electionTitle, privateKeys[0], nonce);
        console2.log("Runner: election complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                      MEMBER ADDITION RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Propose + vote — Members propose and vote to add a new account.
    //   ⏳ Voting window (30 min on test deployment)
    //   [1] Add member — Anyone executes the approved addition.

    /// @notice Advance a member addition flow as far as current on-chain state allows.
    /// @param powers       Deployed Powers instance
    /// @param account      Address to add as a member
    /// @param privateKeys  Keys used at each phase (all vote in phase 0; index 0 executes in phase 1)
    /// @param nonce        Nonce shared across propose and execute actions
    function runMemberAdditionFlow(
        address powers,
        address account,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        uint16 proposeId = findMandateIdInOrg(
            "Propose Member Addition: Members vote to onboard a new member.",
            Powers(payable(powers))
        );
        uint16 addId = findMandateIdInOrg(
            "Add Member: Execute an approved member onboarding by assigning the Member role.",
            Powers(payable(powers))
        );

        bytes memory calldata_ = abi.encode(account);
        uint256 proposeActionId = calculateActionId(proposeId, calldata_, nonce);
        uint256 addActionId     = calculateActionId(addId, calldata_, nonce);

        // Already a member?
        if (Powers(payable(powers)).hasRoleSince(account, 1) > 0) {
            console2.log("Runner: account is already a member:", account);
            return;
        }

        // Has the addition already been executed?
        (, , uint48 requestedAt, , , ,) = IPowers(powers).getActionData(addActionId);
        if (requestedAt > 0) {
            console2.log("Runner: member addition already executed for:", account);
            return;
        }

        // Phase 0: propose + vote
        (, uint48 proposedAt, , , , ,) = IPowers(powers).getActionData(proposeActionId);
        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing and voting on member addition for:", account);
            proposeMemberAddition(powers, account, privateKeys, nonce);

            (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(proposeActionId);
            console2.log("Runner: pausing... vote ends at block", voteEnd);
            return;
        }

        // Still in voting window?
        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(proposeActionId);
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing... voting still open. Blocks remaining:", voteEnd - block.number);
            return;
        }

        // Phase 1: execute
        console2.log("Runner [1]: executing member addition for:", account);
        addMember(powers, account, privateKeys[0], nonce);
        console2.log("Runner: member addition complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         BLACKLIST RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phase 0 — Blacklist: Security Council marks the account.
    // Phase 1 — Revoke membership: Security Council removes voting rights (optional).
    //
    // Pass revokeMembership=true to also revoke the Member role in one runner call.

    /// @notice Blacklist an account and optionally revoke its Member role.
    /// @param powers           Deployed Powers instance
    /// @param account          Account to blacklist
    /// @param revokeMembership If true, also revoke the Member role after blacklisting
    /// @param privateKey       Security Council key
    /// @param nonce            Nonce — must be the same for both blacklist and revoke steps
    function runBlacklistFlow(
        address powers,
        address account,
        bool revokeMembership,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 blacklistId = findMandateIdInOrg(
            "Blacklist Account: Security Council marks an account as blacklisted.",
            Powers(payable(powers))
        );

        uint256 blacklistActionId = calculateActionId(blacklistId, abi.encode(account), nonce);
        (, , uint48 requestedAt, , , ,) = IPowers(powers).getActionData(blacklistActionId);

        if (requestedAt == 0) {
            console2.log("Runner [0]: blacklisting account:", account);
            blacklistAccount(powers, account, privateKey, nonce);
        } else {
            console2.log("Runner: account already blacklisted:", account);
        }

        if (revokeMembership && Powers(payable(powers)).hasRoleSince(account, 1) > 0) {
            console2.log("Runner [1]: revoking Member role from blacklisted account:", account);
            revokeBlacklistedMembership(powers, account, privateKey, nonce);
        }

        console2.log("Runner: blacklist flow complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         STATE PREDICATES
    ///////////////////////////////////////////////////////////////////////////

    function _isSetupComplete(address powers) internal view returns (bool) {
        return bytes(Powers(payable(powers)).getRoleLabel(1)).length > 0;
    }
}
