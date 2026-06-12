// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "@governance/examples/actions/ActionHelpers.s.sol";
import { ElectionRegistry } from "@src/helpers/ElectionRegistry.sol";

/// @title GlobalEnvMovementActions
/// @notice One propose/execute function pair per governance flow.
///         Use findMandateIdInOrg() with exact nameDescription strings from Deploy.s.sol.
///
/// ─── Parent Flows ─────────────────────────────────────────────────────────────
///   joinMovement              — ZK check then SelfSelect as Member
///   leaveMovement             — RenounceRole for Member
///   proposeFunding            — member proposes a sub-org allowance
///   vetoFunding               — member casts a veto vote on a funding proposal
///   executeFunding            — coordinator executes approved Safe allowance
///   proposeSpawnSubMovement   — member proposes spawning a new sub-movement
///   vetoSpawn                 — member casts a veto vote on a spawn proposal
///   approveSpawn              — coordinators vote to approve a spawn
///   executeSpawn              — coordinator creates + registers the sub-org
///   openLeaderElection        — open annual election (throttled once/year)
///   nominateForLeader         — self-nominate for leader election
///   tallyLeaderElection       — tally and assign leader roles
///   proposeNoConfidence       — members vote to remove a leader
///   executeNoConfidence       — revoke the named leader after vote + timelock
///   nominateForCoordinator    — self-nominate for coordinator role
///   assignCoordinator         — leader assigns coordinator role to nominee
///   leadersProposReform       — leaders vote to propose governance reform
///   executeReform             — leaders execute reform after sub-org ratification
///
/// ─── Sub-org Flows (called on a child Powers address) ─────────────────────────
///   subOrgJoin                — ZK check then SelfSelect as Sub-org Member
///   subOrgProposeSpending     — member proposes local spending
///   subOrgApproveSpending     — coordinators approve spending
///   subOrgExecuteSpending     — coordinators execute Safe allowance transfer
///   subOrgProposeRatification — coordinators propose ratifying a parent reform
///   subOrgSendRatification    — coordinators send ratification to parent
contract GlobalEnvMovementActions is ActionHelpers {

    string constant LEADER_ELECTION_TITLE = "Annual Leader Election";

    ///////////////////////////////////////////////////////////////
    //                  FLOW 1: MEMBER ONBOARDING               //
    ///////////////////////////////////////////////////////////////

    /// @notice Complete the ZK uniqueness check — first step of joining.
    function joinMovementStep1ZKCheck(address powers, address account, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Verify Unique Identity: ZK-passport proof of uniqueness required to join the movement.", Powers(payable(powers))));

        vm.startBroadcast();
        IPowers(powers).request(mandateSlots[0], abi.encode(account), nonce, "ZK uniqueness check for movement membership");
        vm.stopBroadcast();
        console2.log("ZK check submitted for account:", account);
    }

    /// @notice Self-select as Member after passing the ZK check (same nonce required).
    function joinMovementStep2SelfSelect(address powers, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Join as Member: Self-select as a movement member after passing the ZK-passport uniqueness check.", Powers(payable(powers))));

        vm.startBroadcast();
        IPowers(powers).request(mandateSlots[0], abi.encode(), nonce, "Self-select as movement Member");
        vm.stopBroadcast();
        console2.log("SelfSelect as Member complete.");
    }

    /// @notice Voluntarily leave the movement (renounce Member role).
    function leaveMovement(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Leave Movement: A Member voluntarily renounces their membership.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(), nonce, "Renounce membership");
        vm.stopBroadcast();
    }

    ///////////////////////////////////////////////////////////////
    //                FLOW 2: FUND SUB-ORGANISATION             //
    ///////////////////////////////////////////////////////////////

    /// @notice Member proposes a Safe allowance for a sub-org.
    function proposeFunding(
        address powers,
        address subOrg,
        address token,
        uint96 allowanceAmount,
        uint16 resetTimeMin,
        uint32 resetBaseMin,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Propose Funding: Members propose a treasury allowance for a sub-organisation.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(subOrg, token, allowanceAmount, resetTimeMin, resetBaseMin);
        vm.startBroadcast(privateKeys[0]);
        actionId = IPowers(powers).propose(mandateSlots[0], calldata_, nonce, string.concat("Fund sub-org: ", vm.toString(subOrg)));
        vm.stopBroadcast();
        console2.log("Funding proposal submitted. ActionId:", actionId);
    }

    /// @notice Member votes to veto a funding proposal (must be within 2-day window).
    function vetoFunding(
        address powers,
        address subOrg,
        address token,
        uint96 allowanceAmount,
        uint16 resetTimeMin,
        uint32 resetBaseMin,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Veto Funding: Members vote to block a proposed sub-org funding allocation.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(subOrg, token, allowanceAmount, resetTimeMin, resetBaseMin);
        uint256 actionId = calculateActionId(mandateSlots[0], calldata_, nonce);

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).propose(mandateSlots[0], calldata_, nonce, "Veto funding proposal");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("Veto votes for:", forVote, "against:", againstVote);
    }

    /// @notice Coordinators vote to approve a funding proposal.
    function approveFunding(
        address powers,
        address subOrg,
        address token,
        uint96 allowanceAmount,
        uint16 resetTimeMin,
        uint32 resetBaseMin,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Approve Funding: Coordinators vote to approve a proposed sub-org funding allocation.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(subOrg, token, allowanceAmount, resetTimeMin, resetBaseMin);
        actionId = calculateActionId(mandateSlots[0], calldata_, nonce);

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).propose(mandateSlots[0], calldata_, nonce, "Coordinator funding approval");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("Approval votes for:", forVote, "against:", againstVote);
    }

    /// @notice Coordinator executes the Safe allowance after approval + timelock.
    function executeFunding(
        address powers,
        address subOrg,
        address token,
        uint96 allowanceAmount,
        uint16 resetTimeMin,
        uint32 resetBaseMin,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Execute Funding: Set a Safe treasury allowance for an approved sub-organisation.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(subOrg, token, allowanceAmount, resetTimeMin, resetBaseMin);
        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], calldata_, nonce, string.concat("Execute funding for sub-org: ", vm.toString(subOrg)));
        vm.stopBroadcast();
        console2.log("Funding executed — Safe allowance set for:", subOrg);
    }

    ///////////////////////////////////////////////////////////////
    //               FLOW 3: SPAWN SUB-MOVEMENT                 //
    ///////////////////////////////////////////////////////////////

    /// @notice Member proposes spawning a new sub-movement.
    function proposeSpawnSubMovement(address powers, string memory subOrgName, uint256[] memory privateKeys, uint256 nonce) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Propose Sub-movement: Members propose spawning a new autonomous sub-organisation.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(subOrgName);
        vm.startBroadcast(privateKeys[0]);
        actionId = IPowers(powers).propose(mandateSlots[0], calldata_, nonce, string.concat("Propose sub-movement: ", subOrgName));
        vm.stopBroadcast();
        console2.log("Sub-movement proposal submitted:", subOrgName);
    }

    /// @notice Coordinators vote to approve a spawn proposal.
    function approveSpawn(address powers, string memory subOrgName, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Approve Sub-movement: Coordinators vote to approve a new sub-movement proposal.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(subOrgName);
        uint256 actionId = calculateActionId(mandateSlots[0], calldata_, nonce);

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).propose(mandateSlots[0], calldata_, nonce, "Coordinator spawn approval");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("Spawn approval votes for:", forVote, "against:", againstVote);
    }

    /// @notice Coordinator calls factory.createPowers() to deploy the sub-org.
    function executeSpawnStep1Create(address powers, string memory subOrgName, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Create Sub-org: Deploy a fully-constituted sub-movement via the factory contract.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(subOrgName);
        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], calldata_, nonce, string.concat("Create sub-org: ", subOrgName));
        vm.stopBroadcast();
        console2.log("Sub-org created:", subOrgName);
    }

    /// @notice Coordinator registers the newly deployed sub-org at the parent (same nonce).
    function executeSpawnStep2Register(address powers, string memory subOrgName, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Register Sub-org: Assign the Recognised Sub-org role to the newly spawned sub-movement.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(subOrgName);
        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], calldata_, nonce, string.concat("Register sub-org: ", subOrgName));
        vm.stopBroadcast();
        console2.log("Sub-org registered at parent (Recognised Sub-org role 4 assigned).");
    }

    ///////////////////////////////////////////////////////////////
    //                FLOW 4: ANNUAL LEADER ELECTION            //
    ///////////////////////////////////////////////////////////////

    /// @notice Open the annual leader election (throttled to once per year).
    function openLeaderElection(address powers, uint256[] memory privateKeys, uint256 nonce) public returns (uint256 electionId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Open Leader Election: Open the annual leader election. Can only be called once per year.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(LEADER_ELECTION_TITLE);
        electionId = uint256(keccak256(abi.encodePacked(powers, LEADER_ELECTION_TITLE)));

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], calldata_, nonce, "Opening annual leader election");
        vm.stopBroadcast();
        console2.log("Annual leader election opened. ElectionId:", electionId);
    }

    /// @notice Self-nominate as a leader candidate.
    function nominateForLeader(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Nominate for Leader: A member nominates themselves as a candidate in the current leader election.", Powers(payable(powers))));

        for (uint256 i = 0; i < privateKeys.length; i++) {
            bytes memory calldata_ = abi.encode(LEADER_ELECTION_TITLE);
            vm.startBroadcast(privateKeys[i]);
            IPowers(powers).request(mandateSlots[0], calldata_, nonce + i, "Self-nominating for leader election");
            vm.stopBroadcast();
            console2.log("Nominated:", vm.addr(privateKeys[i]));
        }
    }

    /// @notice Open the leader election voting phase.
    function openLeaderVote(address powers, uint256[] memory privateKeys, uint256 nonce) public returns (uint16 voteMandateId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Open Leader Vote: Open the voting phase of the annual leader election.", Powers(payable(powers))));
        uint256 electionId = uint256(keccak256(abi.encodePacked(powers, LEADER_ELECTION_TITLE)));

        voteMandateId = Powers(payable(powers)).mandateCounter();

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(LEADER_ELECTION_TITLE), nonce, "Opening leader election voting");
        vm.stopBroadcast();
        console2.log("Leader vote opened. Vote mandate ID:", voteMandateId);
    }

    /// @notice Tally the leader election and assign the Leader role to top 7 winners.
    function tallyLeaderElection(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Tally Leader Election: Assign the Leader role to the top 7 election winners.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Cleanup Leader Election: Remove the ephemeral vote mandate after the election completes.", Powers(payable(powers))));

        tallyElection(powers, mandateSlots[0], mandateSlots[1], privateKeys, LEADER_ELECTION_TITLE, nonce);
        console2.log("Leader election tallied. Leaders assigned.");
    }

    ///////////////////////////////////////////////////////////////
    //              FLOW 5: VOTE OF NO CONFIDENCE               //
    ///////////////////////////////////////////////////////////////

    /// @notice Members propose and vote on removing a specific leader.
    function proposeNoConfidence(address powers, address leader, uint256[] memory privateKeys, uint256 nonce) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Propose No-Confidence: Members vote to remove a specific leader from office.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(leader);
        actionId = calculateActionId(mandateSlots[0], calldata_, nonce);

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).propose(mandateSlots[0], calldata_, nonce, string.concat("No-confidence vote against: ", vm.toString(leader)));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("No-confidence votes for removal:", forVote, "against:", againstVote);
        return actionId;
    }

    /// @notice Execute removal of a leader after successful vote + 8-day timelock.
    function executeNoConfidence(address powers, address leader, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Execute No-Confidence: Revoke the Leader role from the named address after a successful vote.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(leader), nonce, string.concat("Executing no-confidence removal of: ", vm.toString(leader)));
        vm.stopBroadcast();
        console2.log("Leader removed:", leader);
    }

    ///////////////////////////////////////////////////////////////
    //             FLOW 6: ASSIGN PARENT COORDINATOR            //
    ///////////////////////////////////////////////////////////////

    /// @notice Publicly nominate yourself for the Parent Coordinator role.
    function nominateForCoordinator(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Nominate for Coordinator: Publicly register as a candidate for the Parent Coordinator role.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(true), nonce, "Self-nominating for Coordinator role");
        vm.stopBroadcast();
        console2.log("Coordinator candidacy registered for:", vm.addr(privateKeys[0]));
    }

    /// @notice Leader assigns the Parent Coordinator role to a nominated candidate.
    function assignCoordinator(address powers, address nominee, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Assign Coordinator: Leaders assign the Parent Coordinator role to a nominated candidate.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(nominee), nonce, string.concat("Assigning Coordinator role to: ", vm.toString(nominee)));
        vm.stopBroadcast();
        console2.log("Coordinator assigned:", nominee);
    }

    ///////////////////////////////////////////////////////////////
    //             FLOW 7: PARENT GOVERNANCE REFORM             //
    ///////////////////////////////////////////////////////////////

    /// @notice Leaders propose and vote on a governance reform (supermajority required).
    function leadersProposReform(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Leaders Propose Reform: Leaders vote to propose a governance reform to the parent organisation.", Powers(payable(powers))));

        bytes memory calldata_ = abi.encode(newMandates, roleIds);
        actionId = calculateActionId(mandateSlots[0], calldata_, nonce);

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).propose(mandateSlots[0], calldata_, nonce, "Leaders propose governance reform");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("Reform proposal votes for:", forVote, "against:", againstVote);
    }

    /// @notice Leaders execute the reform after sub-org ratification and 8-week timelock.
    function executeReform(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Execute Governance Reform: Adopt new mandates after successful leader proposal and sub-org ratification.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(newMandates, roleIds), nonce, "Executing governance reform");
        vm.stopBroadcast();
        console2.log("Governance reform executed.");
    }

    ///////////////////////////////////////////////////////////////
    //              SUB-ORG FLOWS (child Powers)                //
    ///////////////////////////////////////////////////////////////

    /// @notice Sub-org member: complete ZK check to join.
    function subOrgJoinStep1ZKCheck(address subOrgPowers, address account, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Sub-org: Verify Unique Identity — ZK-passport proof of uniqueness required to join.", Powers(payable(subOrgPowers))));

        vm.startBroadcast();
        IPowers(subOrgPowers).request(mandateSlots[0], abi.encode(account), nonce, "Sub-org ZK uniqueness check");
        vm.stopBroadcast();
    }

    /// @notice Sub-org member: self-select after ZK check.
    function subOrgJoinStep2SelfSelect(address subOrgPowers, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Sub-org: Join as Member — self-select after passing ZK-passport uniqueness check.", Powers(payable(subOrgPowers))));

        vm.startBroadcast();
        IPowers(subOrgPowers).request(mandateSlots[0], abi.encode(), nonce, "Sub-org self-select as Member");
        vm.stopBroadcast();
    }

    /// @notice Sub-org member proposes a local spending action.
    function subOrgProposeSpending(
        address subOrgPowers,
        address token,
        uint256 amount,
        address payableTo,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Sub-org: Propose Spending — members propose spending from the sub-org treasury allowance.", Powers(payable(subOrgPowers))));

        bytes memory calldata_ = abi.encode(token, amount, payableTo);
        vm.startBroadcast(privateKeys[0]);
        actionId = IPowers(subOrgPowers).propose(mandateSlots[0], calldata_, nonce, string.concat("Propose spending to: ", vm.toString(payableTo)));
        vm.stopBroadcast();
    }

    /// @notice Sub-org coordinators vote to approve spending.
    function subOrgApproveSpending(
        address subOrgPowers,
        address token,
        uint256 amount,
        address payableTo,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Sub-org: Approve Spending — coordinators vote to approve a local spending proposal.", Powers(payable(subOrgPowers))));

        bytes memory calldata_ = abi.encode(token, amount, payableTo);
        uint256 actionId = calculateActionId(mandateSlots[0], calldata_, nonce);

        vm.startBroadcast(privateKeys[0]);
        IPowers(subOrgPowers).propose(mandateSlots[0], calldata_, nonce, "Coordinator spending approval");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(subOrgPowers, mandateSlots[0], actionId, privateKeys, nonce, 100);
    }

    /// @notice Sub-org coordinators execute the approved spending.
    function subOrgExecuteSpending(
        address subOrgPowers,
        address token,
        uint256 amount,
        address payableTo,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Sub-org: Execute Spending — transfer tokens from Safe allowance to approved recipient.", Powers(payable(subOrgPowers))));

        bytes memory calldata_ = abi.encode(token, amount, payableTo);
        vm.startBroadcast(privateKeys[0]);
        IPowers(subOrgPowers).request(mandateSlots[0], calldata_, nonce, string.concat("Execute spending to: ", vm.toString(payableTo)));
        vm.stopBroadcast();
        console2.log("Sub-org spending executed. Recipient:", payableTo);
    }

    /// @notice Sub-org coordinators vote to authorise a parent reform ratification.
    function subOrgProposeRatification(
        address subOrgPowers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Sub-org: Propose Parent Ratification — coordinators vote to authorise ratifying a parent reform.", Powers(payable(subOrgPowers))));

        bytes memory calldata_ = abi.encode(newMandates, roleIds);
        actionId = calculateActionId(mandateSlots[0], calldata_, nonce);

        vm.startBroadcast(privateKeys[0]);
        IPowers(subOrgPowers).propose(mandateSlots[0], calldata_, nonce, "Propose ratification of parent reform");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(subOrgPowers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("Sub-org ratification votes for:", forVote);
    }

    /// @notice Sub-org coordinators send the ratification signal to the parent.
    function subOrgSendRatification(
        address subOrgPowers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Sub-org: Send Parent Ratification — sub-org sends ratification vote to parent governance reform.", Powers(payable(subOrgPowers))));

        bytes memory calldata_ = abi.encode(newMandates, roleIds);
        vm.startBroadcast(privateKeys[0]);
        IPowers(subOrgPowers).request(mandateSlots[0], calldata_, nonce, "Sub-org sends parent reform ratification");
        vm.stopBroadcast();
        console2.log("Ratification signal sent to parent from sub-org:", subOrgPowers);
    }
}
