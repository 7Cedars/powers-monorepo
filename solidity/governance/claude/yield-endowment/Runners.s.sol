// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { SlateRegistry } from "@src/helpers/SlateRegistry.sol";
import { YieldEndowmentActions } from "./Actions.s.sol";

/// @title YieldEndowmentRunners
/// @notice Stateless checkpoint runners for the Yield Endowment governance.
///
/// Each run*() function reads current on-chain state, advances as far as
/// conditions allow, then stops at the first phase still blocked by a voting
/// window, timelock, or missing prerequisite — logging what it did and
/// what it is waiting for.
///
/// Pass the SAME (nonce, parameters) on every call for a given flow invocation.
/// Use a fresh nonce to start a completely new, independent invocation.
///
/// ─── Runners ──────────────────────────────────────────────────────────────────
///   runInitialSetup          — execute setup mandate (first call after deploy)
///   runSlateElectionFlow     — create → vote → (veto window) → execute results
///   runSlateSubmissionFlow   — add slate only (stateless helper)
///   runMissionStatementFlow  — propose URI → vote → execute URI change
///   runMembershipFlow        — grant or revoke a single membership
///   runLapseSweepFlow        — propose + vote → execute sweep
///   runGovernanceReformFlow  — propose → ratify (vote) → execute reform
contract YieldEndowmentRunners is YieldEndowmentActions {

    ///////////////////////////////////////////////////////////////////////////
    //                         INITIAL SETUP RUNNER
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Execute the initial setup mandate once after deployment.
    ///         Assigns all role labels, sets the treasury, pre-assigns Founding Members
    ///         and SlateRegistry, then self-revokes.
    function runInitialSetup(address powers, uint256 privateKey, uint256 nonce) public {
        uint16 setupId = findMandateIdInOrg(
            "Initial Setup: Assign role labels, set treasury, assign founding members and SlateRegistry roles, then self-revoke.",
            Powers(payable(powers))
        );
        (,, bool active) = IPowers(powers).getAdoptedMandate(setupId);
        if (!active) {
            console2.log("Runner: initial setup already executed (mandate revoked).");
            return;
        }
        console2.log("Runner [0]: executing initial setup mandate.");
        vm.startBroadcast(privateKey);
        IPowers(powers).request(setupId, abi.encode(), nonce, "Executing initial setup");
        vm.stopBroadcast();
        console2.log("Runner: initial setup complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                       SLATE ELECTION FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Member creates an election.
    //   ⏳ Submission window (20 min test / 2 weeks production)
    //   [1] Members submit slates (handled via runSlateSubmissionFlow).
    //   ⏳ Voting window (30 min test / 2 weeks production)
    //   [2] After voting ends: propose Execute Results (starts timelock).
    //   ⏳ Timelock (10 min test / 4 days production)
    //      Founding Members may veto during this window.
    //   [3] After timelock: execute results (if no veto).

    /// @notice Advance the slate election flow for a given electionTitle and nonce.
    ///         Checks each phase and advances if conditions allow.
    function runSlateElectionFlow(
        address powers,
        address slateRegistry,
        string memory electionTitle,
        uint8 maxSlates,
        uint8 maxVotes,
        uint8 maxWinners,
        uint256 memberKey,
        uint256 nonce
    ) public {
        uint16 createId  = findMandateIdInOrg("Create Election: A member opens a new yield distribution election in the SlateRegistry.", Powers(payable(powers)));
        uint16 executeId = findMandateIdInOrg("Execute Results: After voting has closed and the veto window has expired, execute the winning slates on-chain.", Powers(payable(powers)));

        bytes memory createCalldata  = abi.encode(electionTitle, maxSlates, maxVotes, maxWinners);
        bytes memory executeCalldata = abi.encode(electionTitle);

        // If execute results has already been fulfilled, flow is complete.
        (, , uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, executeCalldata, nonce));
        if (executedAt > 0) {
            console2.log("Runner: slate election flow already complete.");
            return;
        }

        // Phase 0: create the election if it doesn't exist yet.
        uint256 electionId = uint256(keccak256(abi.encodePacked(powers, electionTitle)));
        SlateRegistry.Election memory election = SlateRegistry(slateRegistry).getElectionInfo(electionId);

        if (election.startBlock == 0) {
            console2.log("Runner [0]: creating election.");
            createElection(powers, slateRegistry, electionTitle, maxSlates, maxVotes, maxWinners, memberKey, nonce);
            console2.log("Runner: pausing — submission window now open.");
            return;
        }

        // Phase 2: after voting ends, propose execution (starts the timelock).
        if (block.number > election.endBlock) {
            (, uint48 executeProposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, executeCalldata, nonce));
            if (executeProposedAt == 0) {
                console2.log("Runner [2]: proposing Execute Results (starts veto + timelock window).");
                proposeExecuteResults(powers, electionTitle, memberKey, nonce);
                console2.log("Runner: pausing — veto window open, then timelock.");
                return;
            }

            // Phase 3: request execution after timelock.
            if (!_isTimelockPast(powers, executeId, executeProposedAt)) {
                console2.log("Runner: pausing — execution timelock active.");
                _logTimelockRemaining(powers, executeId, executeProposedAt);
                return;
            }

            console2.log("Runner [3]: executing results.");
            executeResults(powers, electionTitle, memberKey, nonce);
            console2.log("Runner: slate election flow complete.");
            return;
        }

        // Voting window is open.
        if (block.number >= election.startBlock && block.number <= election.endBlock) {
            console2.log("Runner: pausing — voting window open.");
            console2.log("Runner: blocks remaining in voting window:", election.endBlock - block.number);
            return;
        }

        // Submission window is open.
        console2.log("Runner: pausing — submission window open (add slates via runSlateSubmissionFlow).");
        console2.log("Runner: blocks remaining in submission window:", election.startBlock - block.number);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                      SLATE SUBMISSION FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Submit a slate to an open election.
    ///         Stateless — just wraps addSlate for runner-style invocation.
    function runSlateSubmissionFlow(
        address powers,
        string memory electionTitle,
        string memory slateName,
        address[] memory slateTargets,
        uint256[] memory slateValues,
        bytes[] memory slateCalldatas,
        uint256 memberKey,
        uint256 nonce
    ) public {
        console2.log("Runner: submitting slate:", slateName);
        addSlate(powers, electionTitle, slateName, slateTargets, slateValues, slateCalldatas, memberKey, nonce);
        console2.log("Runner: slate submitted.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     MISSION STATEMENT FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Founding Members propose + vote (5-min test / 3-day production window).
    //   ⏳ Voting period
    //   [1] After vote passes: execute URI change (with timelock).
    //   ⏳ Timelock (10 min test / 4 days production)
    //   [2] Execute.

    /// @notice Advance the mission statement update flow.
    function runMissionStatementFlow(
        address powers,
        string memory newUri,
        uint256[] memory founderKeys,
        uint256 nonce
    ) public {
        uint16 proposeId = findMandateIdInOrg("Propose URI Change: Founding members vote to update the organisation mission statement URI.", Powers(payable(powers)));
        uint16 executeId = findMandateIdInOrg("Execute URI Change: Update the Powers contract metadata URI to the approved new value.", Powers(payable(powers)));

        bytes memory calldata_ = abi.encode(newUri);

        (, , uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, calldata_, nonce));
        if (executedAt > 0) {
            console2.log("Runner: URI already updated.");
            return;
        }

        (, uint48 proposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: founding members voting on URI change.");
            proposeUriChange(powers, newUri, founderKeys, nonce);
            console2.log("Runner: pausing — waiting for vote to close.");
            return;
        }

        (, , uint256 voteEnd,,,,) = IPowers(powers).getActionVoteData(calculateActionId(proposeId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — URI vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(powers, executeId, proposedAt)) {
            console2.log("Runner: pausing — URI change timelock active.");
            _logTimelockRemaining(powers, executeId, proposedAt);
            return;
        }

        console2.log("Runner [1]: executing URI change.");
        executeUriChange(powers, newUri, founderKeys[0], nonce);
        console2.log("Runner: mission statement updated.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                        MEMBERSHIP RUNNERS
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Grant membership to a verified past grantee (no waiting).
    function runGrantMembership(address powers, address account, uint256 founderKey, uint256 nonce) public {
        console2.log("Runner: granting membership to:", account);
        grantMembership(powers, account, founderKey, nonce);
    }

    /// @notice Revoke membership from a specified account (no waiting).
    function runRevokeMembership(address powers, address account, uint256 founderKey, uint256 nonce) public {
        console2.log("Runner: revoking membership from:", account);
        revokeMembership(powers, account, founderKey, nonce);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                       LAPSE SWEEP FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Founding Members vote (5-min test / 3-day production).
    //   ⏳ Voting period
    //   [1] Execute sweep.

    /// @notice Advance the annual lapse sweep flow.
    function runLapseSweepFlow(address powers, uint256[] memory founderKeys, uint256 nonce) public {
        uint16 proposeId = findMandateIdInOrg("Propose Lapse Sweep: Founding members vote to authorise sweeping inactive member accounts.", Powers(payable(powers)));
        uint16 executeId = findMandateIdInOrg("Run Lapse Sweep: Revoke the Member role from accounts that have been inactive in recent governance.", Powers(payable(powers)));

        (, , uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, abi.encode(), nonce));
        if (executedAt > 0) {
            console2.log("Runner: lapse sweep already executed.");
            return;
        }

        (, uint48 proposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, abi.encode(), nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: founding members voting to authorise lapse sweep.");
            proposeLapseSweep(powers, founderKeys, nonce);
            console2.log("Runner: pausing — waiting for vote to close.");
            return;
        }

        (, , uint256 voteEnd,,,,) = IPowers(powers).getActionVoteData(calculateActionId(proposeId, abi.encode(), nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — lapse sweep vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        console2.log("Runner [1]: running lapse sweep.");
        runLapseSweep(powers, founderKeys[0], nonce);
        console2.log("Runner: lapse sweep complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                    GOVERNANCE REFORM FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Founding Member proposes (immediate, no vote).
    //   ⏳ Members ratify (10-min test / 1-week production vote).
    //   [1] After vote: execute reform (with timelock).
    //   ⏳ Timelock (15 min test / 8 days production)
    //   [2] Execute.

    /// @notice Advance the governance reform flow.
    function runGovernanceReformFlow(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory founderKeys,
        uint256[] memory memberKeys,
        uint256 nonce
    ) public {
        uint16 proposeId  = findMandateIdInOrg("Propose Governance Reform: A founding member proposes adopting new governance mandates.", Powers(payable(powers)));
        uint16 ratifyId   = findMandateIdInOrg("Ratify Governance Reform: Members vote to approve a proposed governance reform.", Powers(payable(powers)));
        uint16 executeId  = findMandateIdInOrg("Execute Governance Reform: Adopt the approved new governance mandates after member ratification.", Powers(payable(powers)));

        bytes memory calldata_ = abi.encode(newMandates, roleIds);

        (, , uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, calldata_, nonce));
        if (executedAt > 0) {
            console2.log("Runner: governance reform already executed.");
            return;
        }

        (, uint48 proposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: founding member proposing governance reform.");
            proposeReform(powers, newMandates, roleIds, founderKeys[0], nonce);
            console2.log("Runner: proposal submitted. Members can now ratify.");
            return;
        }

        (, uint48 ratifyProposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(ratifyId, calldata_, nonce));
        if (ratifyProposedAt == 0) {
            console2.log("Runner [1]: members voting to ratify governance reform.");
            ratifyReform(powers, newMandates, roleIds, memberKeys, nonce);
            console2.log("Runner: pausing — ratification vote open.");
            return;
        }

        (, , uint256 voteEnd,,,,) = IPowers(powers).getActionVoteData(calculateActionId(ratifyId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — ratification vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(powers, executeId, ratifyProposedAt)) {
            console2.log("Runner: pausing — reform execution timelock active.");
            _logTimelockRemaining(powers, executeId, ratifyProposedAt);
            return;
        }

        console2.log("Runner [2]: executing governance reform.");
        executeReform(powers, newMandates, roleIds, founderKeys[0], nonce);
        console2.log("Runner: governance reform complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                        SHARED STATE PREDICATES
    ///////////////////////////////////////////////////////////////////////////

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
}
