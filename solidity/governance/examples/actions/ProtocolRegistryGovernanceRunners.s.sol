// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { ProtocolRegistryGovernanceActions } from "./ProtocolRegistryGovernanceActions.s.sol";

/// @title ProtocolRegistryGovernanceRunners
/// @notice Stateless checkpoint runners for the Protocol Registry Governance organisation.
///
/// Each run*() function reads current on-chain state, advances the flow as far as
/// conditions allow, and stops at the first phase that requires a waiting period.
/// Pass the same (nonce, parameters) on every call for a given flow invocation.
///
/// ─── Flows ───────────────────────────────────────────────────────────────────────
///   runRegistrationFlow          — propose → council approve → (admin veto window) → execute
///   runEmergencyDeactivateFlow   — immediate deactivation (single step, no runner needed)
///   runReactivationFlow          — community propose/vote → execute reactivation
///   runCriteriaFlow              — developer propose → community veto window
///   runReformFlow                — developer propose → execute after timelock
///   runSunsetFlow                — developer propose → execute after timelock
///
contract ProtocolRegistryGovernanceRunners is ProtocolRegistryGovernanceActions {

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW 1: Register Mandate
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Propose: Developers vote (7-day window).
    //   ⏳ voting period
    //   [1] Council Approve: Security Council signs off — call approveRegistration() manually.
    //   [2] Execute: Developer executes registerMandate() after 14-day timelock.
    //
    // The Security Council approval (phase 1) is not a timed checkpoint — it is a
    // manual action. This runner advances phases 0 and 2 automatically; phase 1
    // must be triggered by a Security Council member calling approveRegistration().
    // The Admin may call vetoRegistration() at any point before phase 2.

    /// @notice Advance the mandate registration flow as far as current on-chain state allows.
    /// @param powers       Address of the deployed organisation.
    /// @param mandateName  Name of the mandate being registered.
    /// @param mandateAddr  Address of the mandate contract.
    /// @param codeHash     keccak256 of the mandate's creation bytecode.
    /// @param privateKeys  Developer private keys (all will vote in phase 0).
    /// @param nonce        Nonce used to derive deterministic action IDs.
    function runRegistrationFlow(
        address powers,
        string memory mandateName,
        address mandateAddr,
        bytes32 codeHash,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        MandateIds memory m = _resolveMandateIds(powers);
        bytes memory calldata_ = abi.encode(mandateName, mandateAddr, codeHash);

        uint256 executeActionId = calculateActionId(m.executeRegistration, calldata_, nonce);
        (, , uint48 executedAt, , , ,) = IPowers(powers).getActionData(executeActionId);
        if (executedAt > 0) {
            console2.log("Runner: registration flow already complete for:", mandateName);
            return;
        }

        uint256 proposeActionId = calculateActionId(m.proposeRegistration, calldata_, nonce);
        (, uint48 proposedAt, , , , ,) = IPowers(powers).getActionData(proposeActionId);

        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing mandate registration for:", mandateName);
            proposeMandateRegistration(powers, mandateName, mandateAddr, codeHash, privateKeys, nonce);
            console2.log("Runner: pausing — 7-day voting period must close before council can approve.");
            _logVoteDeadline(powers, proposeActionId);
            return;
        }

        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(proposeActionId);
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — voting period still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        uint256 approveActionId = calculateActionId(m.approveRegistration, calldata_, nonce);
        (, uint48 approvedAt, , , , ,) = IPowers(powers).getActionData(approveActionId);
        if (approvedAt == 0) {
            console2.log("Runner: pausing — waiting for Security Council approval.");
            console2.log("Runner: a Security Council member must call approveRegistration().");
            return;
        }

        if (!_isTimelockPast(powers, m.executeRegistration, proposedAt)) {
            console2.log("Runner: pausing — 14-day timelock still active. Admin may still veto.");
            _logTimelockRemaining(powers, m.executeRegistration, proposedAt);
            return;
        }

        console2.log("Runner [2]: executing mandate registration for:", mandateName);
        executeRegistration(powers, mandateName, mandateAddr, codeHash, privateKeys[0], nonce);
        console2.log("Runner: registration flow complete for:", mandateName);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                  FLOW 2: Emergency Deactivation
    ///////////////////////////////////////////////////////////////////////////
    //
    // This is a single-step, no-vote action. Call emergencyDeactivate() directly.
    // No runner is needed — Security Council acts immediately with no waiting period.

    ///////////////////////////////////////////////////////////////////////////
    //                  FLOW 2b: Community Reactivation
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Propose + vote: Community votes to reverse a deactivation (7 days).
    //   ⏳ voting period
    //   [1] Execute: Developer executes reactivateMandate() after 2-day timelock.

    /// @notice Advance the mandate reactivation flow.
    function runReactivationFlow(
        address powers,
        uint16 major,
        uint16 minor,
        uint16 patch,
        string memory mandateName,
        uint256[] memory communityKeys,
        uint256 developerKey,
        uint256 nonce
    ) public {
        MandateIds memory m = _resolveMandateIds(powers);
        bytes memory calldata_ = abi.encode(major, minor, patch, mandateName);

        uint256 executeActionId = calculateActionId(m.executeReactivation, calldata_, nonce);
        (, , uint48 executedAt, , , ,) = IPowers(powers).getActionData(executeActionId);
        if (executedAt > 0) {
            console2.log("Runner: reactivation flow already complete for:", mandateName);
            return;
        }

        uint256 proposeActionId = calculateActionId(m.proposeReactivation, calldata_, nonce);
        (, uint48 proposedAt, , , , ,) = IPowers(powers).getActionData(proposeActionId);

        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing reactivation of:", mandateName);
            proposeReactivation(powers, major, minor, patch, mandateName, communityKeys, nonce);
            console2.log("Runner: pausing — 7-day voting period must close before execution.");
            _logVoteDeadline(powers, proposeActionId);
            return;
        }

        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(proposeActionId);
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — voting period still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(powers, m.executeReactivation, proposedAt)) {
            console2.log("Runner: pausing — 2-day timelock still active.");
            _logTimelockRemaining(powers, m.executeReactivation, proposedAt);
            return;
        }

        console2.log("Runner [1]: executing reactivation of:", mandateName);
        executeReactivation(powers, major, minor, patch, mandateName, developerKey, nonce);
        console2.log("Runner: reactivation flow complete for:", mandateName);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                   FLOW 3: Submission Criteria
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Developer propose + vote (30 days).
    //   ⏳ voting period
    //   Community may call vetoCriteria() within the 14-day veto window.
    //   The criteria record is the on-chain governance signal — no execution step.

    /// @notice Advance the criteria proposal to the voting phase.
    /// @dev After the vote passes, monitor for community veto actions separately.
    function runCriteriaFlow(
        address powers,
        string memory title,
        string memory description,
        uint256[] memory developerKeys,
        uint256 nonce
    ) public {
        MandateIds memory m = _resolveMandateIds(powers);
        bytes memory calldata_ = abi.encode(title, description);

        uint256 proposeActionId = calculateActionId(m.proposeCriteria, calldata_, nonce);
        (, uint48 proposedAt, , , , ,) = IPowers(powers).getActionData(proposeActionId);

        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing submission criteria:", title);
            proposeCriteria(powers, title, description, developerKeys, nonce);
            console2.log("Runner: pausing — 30-day voting period must close.");
            _logVoteDeadline(powers, proposeActionId);
            return;
        }

        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(proposeActionId);
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — voting period still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        console2.log("Runner: criteria proposal passed. Community veto window is now open for 14 days.");
        console2.log("Runner: if no community veto is cast, the criteria record stands.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                   FLOW 4: Governance Reform
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Developer propose + supermajority vote (14 days).
    //   ⏳ voting period
    //   [1] Execute: adopt new mandates after 15-day timelock.

    /// @notice Advance the governance reform flow.
    function runReformFlow(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory developerKeys,
        uint256 nonce
    ) public {
        MandateIds memory m = _resolveMandateIds(powers);
        bytes memory calldata_ = abi.encode(newMandates, roleIds);

        uint256 executeActionId = calculateActionId(m.executeReform, calldata_, nonce);
        (, , uint48 executedAt, , , ,) = IPowers(powers).getActionData(executeActionId);
        if (executedAt > 0) {
            console2.log("Runner: reform flow already complete.");
            return;
        }

        uint256 proposeActionId = calculateActionId(m.proposeReform, calldata_, nonce);
        (, uint48 proposedAt, , , , ,) = IPowers(powers).getActionData(proposeActionId);

        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing governance reform.");
            proposeReform(powers, newMandates, roleIds, developerKeys, nonce);
            console2.log("Runner: pausing — 14-day voting period must close.");
            _logVoteDeadline(powers, proposeActionId);
            return;
        }

        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(proposeActionId);
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — voting period still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(powers, m.executeReform, proposedAt)) {
            console2.log("Runner: pausing — 15-day timelock still active.");
            _logTimelockRemaining(powers, m.executeReform, proposedAt);
            return;
        }

        console2.log("Runner [1]: executing governance reform.");
        executeReform(powers, newMandates, roleIds, developerKeys[0], nonce);
        console2.log("Runner: governance reform complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                   FLOW 6: Sunset Admin Authority
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Developer propose + supermajority vote (7 days).
    //   ⏳ voting period
    //   [1] Execute: revoke Admin Veto mandate after 8-day timelock.

    /// @notice Advance the Admin authority sunset flow.
    function runSunsetFlow(
        address powers,
        string memory rationale,
        uint256[] memory developerKeys,
        uint256 nonce
    ) public {
        MandateIds memory m = _resolveMandateIds(powers);
        bytes memory calldata_ = abi.encode(rationale);

        uint256 executeActionId = calculateActionId(m.executeSunset, calldata_, nonce);
        (, , uint48 executedAt, , , ,) = IPowers(powers).getActionData(executeActionId);
        if (executedAt > 0) {
            console2.log("Runner: sunset flow already complete. Admin Veto mandate has been revoked.");
            return;
        }

        uint256 proposeActionId = calculateActionId(m.proposeSunset, calldata_, nonce);
        (, uint48 proposedAt, , , , ,) = IPowers(powers).getActionData(proposeActionId);

        if (proposedAt == 0) {
            console2.log("Runner [0]: proposing Admin veto sunset.");
            proposeSunset(powers, rationale, developerKeys, nonce);
            console2.log("Runner: pausing — 7-day voting period must close.");
            _logVoteDeadline(powers, proposeActionId);
            return;
        }

        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(proposeActionId);
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — voting period still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(powers, m.executeSunset, proposedAt)) {
            console2.log("Runner: pausing — 8-day timelock still active.");
            _logTimelockRemaining(powers, m.executeSunset, proposedAt);
            return;
        }

        console2.log("Runner [1]: executing Admin veto sunset.");
        executeSunset(powers, rationale, developerKeys[0], nonce);
        console2.log("Runner: founding period transition complete. Admin Veto mandate revoked.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                      MANDATE ID RESOLUTION
    ///////////////////////////////////////////////////////////////////////////

    struct MandateIds {
        uint16 initialSetup;
        uint16 proposeRegistration;
        uint16 approveRegistration;
        uint16 adminVetoRegistration;
        uint16 executeRegistration;
        uint16 emergencyDeactivate;
        uint16 proposeReactivation;
        uint16 executeReactivation;
        uint16 proposeCriteria;
        uint16 vetoCriteria;
        uint16 proposeReform;
        uint16 executeReform;
        uint16 joinCommunity;
        uint16 proposeSunset;
        uint16 executeSunset;
    }

    function _resolveMandateIds(address powers) internal view returns (MandateIds memory m) {
        Powers org = Powers(payable(powers));
        m.initialSetup           = findMandateIdInOrg("Initial Setup: Assign role labels and revokes itself after execution", org);
        m.proposeRegistration    = findMandateIdInOrg("Propose Mandate Registration: Developers vote to register a new mandate implementation.", org);
        m.approveRegistration    = findMandateIdInOrg("Security Council Approve Registration: Security Council approves a proposed mandate registration.", org);
        m.adminVetoRegistration  = findMandateIdInOrg("Admin Veto Registration: Admin vetoes a proposed mandate registration during the founding period.", org);
        m.executeRegistration    = findMandateIdInOrg("Execute Mandate Registration: Developer executes registerMandate() after approval and timelock.", org);
        m.emergencyDeactivate    = findMandateIdInOrg("Emergency Deactivate Mandate: Security Council immediately deactivates a mandate with a security vulnerability.", org);
        m.proposeReactivation    = findMandateIdInOrg("Propose Mandate Reactivation: Community votes to reverse a Security Council emergency deactivation.", org);
        m.executeReactivation    = findMandateIdInOrg("Execute Mandate Reactivation: Developer executes reactivateMandate() after community vote.", org);
        m.proposeCriteria        = findMandateIdInOrg("Propose Submission Criteria: Developers vote to set or update mandate submission criteria.", org);
        m.vetoCriteria           = findMandateIdInOrg("Community Veto Submission Criteria: Community blocks a Developer criteria proposal.", org);
        m.proposeReform          = findMandateIdInOrg("Propose Governance Reform: Developer supermajority votes to adopt new governance mandates.", org);
        m.executeReform          = findMandateIdInOrg("Adopt Governance Reform: Execute an approved governance reform after the timelock.", org);
        m.joinCommunity          = findMandateIdInOrg("Join as Community Member: Any account can self-select as a Community member.", org);
        m.proposeSunset          = findMandateIdInOrg("Propose Sunset Admin Veto: Developer supermajority votes to revoke the Admin Veto mandate.", org);
        m.executeSunset          = findMandateIdInOrg("Execute Sunset Admin Veto: Revoke the Admin Veto mandate to complete the founding period transition.", org);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         STATE PREDICATES
    ///////////////////////////////////////////////////////////////////////////

    function _isTimelockPast(address powers, uint16 mandateId, uint48 proposedAt) internal view returns (bool) {
        PowersTypes.Conditions memory cond = IPowers(powers).getConditions(mandateId);
        return block.number >= uint256(proposedAt) + uint256(cond.timelock);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         LOGGING HELPERS
    ///////////////////////////////////////////////////////////////////////////

    function _logVoteDeadline(address powers, uint256 actionId) internal view {
        (, , uint256 voteEnd, , ,) = IPowers(powers).getActionVoteData(actionId);
        if (block.number < voteEnd) {
            console2.log("Runner: blocks remaining until vote ends:", voteEnd - block.number);
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
}
