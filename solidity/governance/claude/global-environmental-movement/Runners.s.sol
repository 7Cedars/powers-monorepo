// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { ElectionRegistry } from "@src/core/helpers/ElectionRegistry.sol";
import { GlobalEnvMovementActions } from "./Actions.s.sol";

/// @title GlobalEnvMovementRunners
/// @notice Stateless checkpoint runners for the Global Environmental Movement.
///
/// Each run*() function reads current on-chain state, advances as far as
/// conditions allow, then stops at the first phase still blocked by a voting
/// window, timelock, or missing prerequisite — logging what it did and what
/// it is waiting for.
///
/// Pass the SAME (nonce, parameters) on every call for a given flow invocation.
/// Use a fresh nonce to start a completely new, independent invocation.
///
/// ─── Runners ──────────────────────────────────────────────────────────────────
///   runInitialSetup          — execute setup mandate (first call after deploy)
///   runFundingFlow           — propose → veto window → coordinator approval → execute
///   runSpawnFlow             — propose → veto window → coordinator approval → create → register
///   runLeaderElectionFlow    — open → nominate → vote → tally → cleanup
///   runNoConfidenceFlow      — propose+vote → execute removal
///   runSubOrgSpendingFlow    — propose → coordinator approval → execute transfer
///   runSubOrgRatifyFlow      — coordinators vote → send ratification to parent
contract GlobalEnvMovementRunners is GlobalEnvMovementActions {

    ///////////////////////////////////////////////////////////////////////////
    //                         INITIAL SETUP RUNNER
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Execute the initial setup mandate (labels roles, revokes itself).
    ///         Call once immediately after deployment.
    function runInitialSetup(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        if (_isSetupComplete(powers)) {
            console2.log("Runner: initial setup already complete.");
            return;
        }
        console2.log("Runner [0]: executing initial setup mandate.");
        uint16 setupId = findMandateIdInOrg("Initial Setup: Assign role labels and revokes itself after execution", Powers(payable(powers)));
        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(setupId, abi.encode(), nonce, "Executing initial setup");
        vm.stopBroadcast();
        console2.log("Runner: initial setup complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                           FUNDING FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Member submits funding proposal.
    //   ⏳ 2-day member veto window (days 0–2)
    //   [1] Coordinators propose+vote to approve (days 3–7, 4-day vote).
    //   ⏳ 8-day timelock from proposal
    //   [2] Coordinator executes Safe allowance.

    /// @notice Advance the funding flow as far as current state allows.
    function runFundingFlow(
        address powers,
        address subOrg,
        address token,
        uint96 allowanceAmount,
        uint16 resetTimeMin,
        uint32 resetBaseMin,
        uint256[] memory memberKeys,
        uint256[] memory coordinatorKeys,
        uint256 nonce
    ) public {
        uint16 proposeId   = findMandateIdInOrg("Propose Funding: Members propose a treasury allowance for a sub-organisation.", Powers(payable(powers)));
        uint16 approveId   = findMandateIdInOrg("Approve Funding: Coordinators vote to approve a proposed sub-org funding allocation.", Powers(payable(powers)));
        uint16 executeId   = findMandateIdInOrg("Execute Funding: Set a Safe treasury allowance for an approved sub-organisation.", Powers(payable(powers)));

        bytes memory calldata_ = abi.encode(subOrg, token, allowanceAmount, resetTimeMin, resetBaseMin);

        (, uint48 proposedAt, uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, calldata_, nonce));
        if (executedAt > 0) { console2.log("Runner: funding flow already complete."); return; }

        (, uint48 proposeFundingAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposeFundingAt == 0) {
            console2.log("Runner [0]: submitting funding proposal.");
            proposeFunding(powers, subOrg, token, allowanceAmount, resetTimeMin, resetBaseMin, memberKeys, nonce);
            console2.log("Runner: pausing — 2-day member veto window now open.");
            return;
        }

        (, uint48 approveProposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(approveId, calldata_, nonce));
        if (approveProposedAt == 0) {
            if (!_isTimelockPast(powers, approveId, proposeFundingAt)) {
                console2.log("Runner: pausing — waiting for 3-day timelock before coordinator vote opens.");
                _logTimelockRemaining(powers, approveId, proposeFundingAt);
                return;
            }
            console2.log("Runner [1]: coordinators voting on funding approval.");
            approveFunding(powers, subOrg, token, allowanceAmount, resetTimeMin, resetBaseMin, coordinatorKeys, nonce);
            console2.log("Runner: pausing — waiting for coordinator vote to close.");
            return;
        }

        (, , uint256 voteEnd,,, ,) = IPowers(powers).getActionVoteData(calculateActionId(approveId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — coordinator vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(powers, executeId, proposeFundingAt)) {
            console2.log("Runner: pausing — waiting for 8-day execution timelock.");
            _logTimelockRemaining(powers, executeId, proposeFundingAt);
            return;
        }

        console2.log("Runner [2]: executing Safe allowance for sub-org.");
        executeFunding(powers, subOrg, token, allowanceAmount, resetTimeMin, resetBaseMin, coordinatorKeys, nonce);
        console2.log("Runner: funding flow complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                            SPAWN FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Member submits spawn proposal.
    //   ⏳ 5-day member veto window
    //   [1] Coordinators vote to approve (opens day 6, 2-week vote).
    //   ⏳ 3-week creation timelock
    //   [2] Coordinator calls factory.createPowers().
    //   [3] Coordinator registers sub-org at parent (same nonce).

    /// @notice Advance the sub-movement spawn flow.
    function runSpawnFlow(
        address powers,
        string memory subOrgName,
        uint256[] memory memberKeys,
        uint256[] memory coordinatorKeys,
        uint256 nonce
    ) public {
        uint16 proposeId  = findMandateIdInOrg("Propose Sub-movement: Members propose spawning a new autonomous sub-organisation.", Powers(payable(powers)));
        uint16 approveId  = findMandateIdInOrg("Approve Sub-movement: Coordinators vote to approve a new sub-movement proposal.", Powers(payable(powers)));
        uint16 createId   = findMandateIdInOrg("Create Sub-org: Deploy a fully-constituted sub-movement via the factory contract.", Powers(payable(powers)));
        uint16 registerId = findMandateIdInOrg("Register Sub-org: Assign the Recognised Sub-org role to the newly spawned sub-movement.", Powers(payable(powers)));

        bytes memory calldata_ = abi.encode(subOrgName);

        (, , uint48 registerExecutedAt,,,,) = IPowers(powers).getActionData(calculateActionId(registerId, calldata_, nonce));
        if (registerExecutedAt > 0) { console2.log("Runner: spawn flow already complete."); return; }

        (, uint48 proposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: submitting sub-movement proposal.");
            proposeSpawnSubMovement(powers, subOrgName, memberKeys, nonce);
            console2.log("Runner: pausing — 5-day member veto window now open.");
            return;
        }

        (, uint48 approveProposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(approveId, calldata_, nonce));
        if (approveProposedAt == 0) {
            if (!_isTimelockPast(powers, approveId, proposedAt)) {
                console2.log("Runner: pausing — waiting for 6-day timelock before coordinator vote opens.");
                _logTimelockRemaining(powers, approveId, proposedAt);
                return;
            }
            console2.log("Runner [1]: coordinators voting on spawn approval.");
            approveSpawn(powers, subOrgName, coordinatorKeys, nonce);
            console2.log("Runner: pausing — waiting for 2-week coordinator vote to close.");
            return;
        }

        (, , uint256 voteEnd,,,,) = IPowers(powers).getActionVoteData(calculateActionId(approveId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — coordinator vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        (, , uint48 createExecutedAt,,,,) = IPowers(powers).getActionData(calculateActionId(createId, calldata_, nonce));
        if (createExecutedAt == 0) {
            if (!_isTimelockPast(powers, createId, proposedAt)) {
                console2.log("Runner: pausing — waiting for 3-week creation timelock.");
                _logTimelockRemaining(powers, createId, proposedAt);
                return;
            }
            console2.log("Runner [2]: creating sub-org via factory.");
            executeSpawnStep1Create(powers, subOrgName, coordinatorKeys, nonce);
        }

        console2.log("Runner [3]: registering sub-org at parent.");
        executeSpawnStep2Register(powers, subOrgName, coordinatorKeys, nonce);
        console2.log("Runner: spawn flow complete — sub-org registered as Recognised Sub-org.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                       LEADER ELECTION FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Open election (throttled to once/year).
    //   ⏳ 1-week nomination window
    //   [1] Nominees self-nominate.
    //   ⏳ nomination period closes (electionRegistry.startBlock)
    //   [2] Open voting phase.
    //   ⏳ 2-week voting window
    //   [3] Tally + cleanup.

    /// @notice Advance the annual leader election flow.
    function runLeaderElectionFlow(
        address powers,
        address leaderElectionRegistry,
        uint256[] memory memberKeys,
        uint256[] memory nomineeKeys,
        uint256 nonce
    ) public {
        uint16 openId  = findMandateIdInOrg("Open Leader Election: Open the annual leader election. Can only be called once per year.", Powers(payable(powers)));
        uint16 voteId  = findMandateIdInOrg("Open Leader Vote: Open the voting phase of the annual leader election.", Powers(payable(powers)));
        uint16 tallyId = findMandateIdInOrg("Tally Leader Election: Assign the Leader role to the top 7 election winners.", Powers(payable(powers)));

        uint256 electionId = uint256(keccak256(abi.encodePacked(powers, LEADER_ELECTION_TITLE)));

        if (_haveActionsBeenSubmitted(powers, tallyId, 1)) {
            console2.log("Runner: leader election already tallied.");
            return;
        }

        if (!_haveActionsBeenSubmitted(powers, openId, 1)) {
            console2.log("Runner [0]: opening annual leader election.");
            openLeaderElection(powers, memberKeys, nonce);
            console2.log("Runner: pausing — nomination window now open (1 week).");
            return;
        }

        if (!_haveActionsBeenSubmitted(powers, voteId, 1)) {
            if (!_isNominationPeriodOver(leaderElectionRegistry, electionId)) {
                console2.log("Runner: pausing — nomination period still open.");
                _logBlocksUntilVoting(leaderElectionRegistry, electionId);
                return;
            }
            console2.log("Runner [1]: nominees self-nominating.");
            nominateForLeader(powers, nomineeKeys, nonce);
            console2.log("Runner [2]: opening voting phase.");
            openLeaderVote(powers, memberKeys, nonce);
            console2.log("Runner: pausing — voting window now open (2 weeks).");
            return;
        }

        if (!_isVotingPeriodOver(leaderElectionRegistry, electionId)) {
            console2.log("Runner: pausing — voting period still open.");
            _logBlocksUntilTally(leaderElectionRegistry, electionId);
            return;
        }

        console2.log("Runner [3]: tallying leader election.");
        tallyLeaderElection(powers, memberKeys, nonce);
        console2.log("Runner: leader election complete — Leaders assigned.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                       NO-CONFIDENCE FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Members propose + vote (1-week, 50% quorum, 66% threshold).
    //   ⏳ 8-day timelock
    //   [1] Execute removal of named leader.

    /// @notice Advance the no-confidence removal flow.
    function runNoConfidenceFlow(
        address powers,
        address leader,
        uint256[] memory memberKeys,
        uint256 nonce
    ) public {
        uint16 proposeId = findMandateIdInOrg("Propose No-Confidence: Members vote to remove a specific leader from office.", Powers(payable(powers)));
        uint16 executeId = findMandateIdInOrg("Execute No-Confidence: Revoke the Leader role from the named address after a successful vote.", Powers(payable(powers)));

        bytes memory calldata_ = abi.encode(leader);

        (, , uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, calldata_, nonce));
        if (executedAt > 0) { console2.log("Runner: no-confidence already executed."); return; }

        (, uint48 proposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: submitting no-confidence proposal.");
            proposeNoConfidence(powers, leader, memberKeys, nonce);
            console2.log("Runner: pausing — 1-week voting window open.");
            return;
        }

        (, , uint256 voteEnd,,,,) = IPowers(powers).getActionVoteData(calculateActionId(proposeId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — voting still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(powers, executeId, proposedAt)) {
            console2.log("Runner: pausing — 8-day execution timelock active.");
            _logTimelockRemaining(powers, executeId, proposedAt);
            return;
        }

        console2.log("Runner [1]: executing no-confidence removal.");
        executeNoConfidence(powers, leader, memberKeys, nonce);
        console2.log("Runner: leader removed.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     SUB-ORG SPENDING FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Member submits spending proposal.
    //   ⏳ 1-week coordinator vote
    //   [1] Coordinator executes Safe allowance transfer.

    /// @notice Advance the sub-org local spending flow.
    function runSubOrgSpendingFlow(
        address subOrgPowers,
        address token,
        uint256 amount,
        address payableTo,
        uint256[] memory memberKeys,
        uint256[] memory coordinatorKeys,
        uint256 nonce
    ) public {
        uint16 proposeId = findMandateIdInOrg("Sub-org: Propose Spending — members propose spending from the sub-org treasury allowance.", Powers(payable(subOrgPowers)));
        uint16 approveId = findMandateIdInOrg("Sub-org: Approve Spending — coordinators vote to approve a local spending proposal.", Powers(payable(subOrgPowers)));
        uint16 executeId = findMandateIdInOrg("Sub-org: Execute Spending — transfer tokens from Safe allowance to approved recipient.", Powers(payable(subOrgPowers)));

        bytes memory calldata_ = abi.encode(token, amount, payableTo);

        (, , uint48 executedAt,,,,) = IPowers(subOrgPowers).getActionData(calculateActionId(executeId, calldata_, nonce));
        if (executedAt > 0) { console2.log("Runner: sub-org spending already executed."); return; }

        (, uint48 proposedAt,,,,,) = IPowers(subOrgPowers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: member proposing sub-org spending.");
            subOrgProposeSpending(subOrgPowers, token, amount, payableTo, memberKeys, nonce);
            console2.log("Runner: pausing — 1-week coordinator vote now open.");
            return;
        }

        (, uint48 approveProposedAt,,,,,) = IPowers(subOrgPowers).getActionData(calculateActionId(approveId, calldata_, nonce));
        if (approveProposedAt == 0) {
            console2.log("Runner [1]: coordinators voting on spending approval.");
            subOrgApproveSpending(subOrgPowers, token, amount, payableTo, coordinatorKeys, nonce);
            console2.log("Runner: pausing — vote open, then 2-day timelock.");
            return;
        }

        (, , uint256 voteEnd,,,,) = IPowers(subOrgPowers).getActionVoteData(calculateActionId(approveId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — coordinator vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(subOrgPowers, executeId, proposedAt)) {
            console2.log("Runner: pausing — 2-day execution timelock.");
            _logTimelockRemaining(subOrgPowers, executeId, proposedAt);
            return;
        }

        console2.log("Runner [2]: executing sub-org spending.");
        subOrgExecuteSpending(subOrgPowers, token, amount, payableTo, coordinatorKeys, nonce);
        console2.log("Runner: sub-org spending complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                      SUB-ORG RATIFY FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Coordinators vote to authorise ratification (1-week vote).
    //   ⏳ 1-day timelock
    //   [1] Send ratification signal to parent.

    /// @notice Advance the sub-org parent-reform ratification flow.
    function runSubOrgRatifyFlow(
        address subOrgPowers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory coordinatorKeys,
        uint256 nonce
    ) public {
        uint16 proposeId = findMandateIdInOrg("Sub-org: Propose Parent Ratification — coordinators vote to authorise ratifying a parent reform.", Powers(payable(subOrgPowers)));
        uint16 sendId    = findMandateIdInOrg("Sub-org: Send Parent Ratification — sub-org sends ratification vote to parent governance reform.", Powers(payable(subOrgPowers)));

        bytes memory calldata_ = abi.encode(newMandates, roleIds);

        (, , uint48 sentAt,,,,) = IPowers(subOrgPowers).getActionData(calculateActionId(sendId, calldata_, nonce));
        if (sentAt > 0) { console2.log("Runner: ratification already sent."); return; }

        (, uint48 proposedAt,,,,,) = IPowers(subOrgPowers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: coordinators voting to authorise parent reform ratification.");
            subOrgProposeRatification(subOrgPowers, newMandates, roleIds, coordinatorKeys, nonce);
            console2.log("Runner: pausing — 1-week coordinator vote open.");
            return;
        }

        (, , uint256 voteEnd,,,,) = IPowers(subOrgPowers).getActionVoteData(calculateActionId(proposeId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(subOrgPowers, sendId, proposedAt)) {
            console2.log("Runner: pausing — 1-day timelock before sending ratification.");
            _logTimelockRemaining(subOrgPowers, sendId, proposedAt);
            return;
        }

        console2.log("Runner [1]: sending ratification signal to parent.");
        subOrgSendRatification(subOrgPowers, newMandates, roleIds, coordinatorKeys, nonce);
        console2.log("Runner: ratification sent.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                        SHARED STATE PREDICATES
    ///////////////////////////////////////////////////////////////////////////

    function _isSetupComplete(address powers) internal view returns (bool) {
        return bytes(Powers(payable(powers)).getRoleLabel(3)).length > 0;
    }

    function _haveActionsBeenSubmitted(address powers, uint16 mandateId, uint256 count) internal view returns (bool) {
        return IPowers(powers).getQuantityMandateActions(mandateId) >= count;
    }

    function _isNominationPeriodOver(address electionRegistry, uint256 electionId) internal view returns (bool) {
        return block.number > ElectionRegistry(electionRegistry).getElectionInfo(electionId).startBlock;
    }

    function _isVotingPeriodOver(address electionRegistry, uint256 electionId) internal view returns (bool) {
        return block.number > ElectionRegistry(electionRegistry).getElectionInfo(electionId).endBlock;
    }

    function _isTimelockPast(address powers, uint16 mandateId, uint48 proposedAt) internal view returns (bool) {
        if (proposedAt == 0) return false;
        PowersTypes.Conditions memory cond = IPowers(powers).getConditions(mandateId);
        return block.number >= uint256(proposedAt) + uint256(cond.timelock);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                           LOGGING HELPERS
    ///////////////////////////////////////////////////////////////////////////

    function _logTimelockRemaining(address powers, uint16 mandateId, uint48 proposedAt) internal view {
        if (proposedAt == 0) return;
        PowersTypes.Conditions memory cond = IPowers(powers).getConditions(mandateId);
        uint256 deadline = uint256(proposedAt) + uint256(cond.timelock);
        if (block.number < deadline) {
            console2.log("Runner: blocks remaining until timelock expires:", deadline - block.number);
        }
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
}
