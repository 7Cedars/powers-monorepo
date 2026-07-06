// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "@governance/examples/actions/ActionHelpers.s.sol";
import { SlateRegistry } from "@src/core/helpers/SlateRegistry.sol";

/// @title YieldEndowmentActions
/// @notice Manual action functions for the Yield Endowment governance.
///         One propose/execute function pair per governance flow.
///
/// ─── Flows ────────────────────────────────────────────────────────────────────
///   Flow A — Slate Election  : createElection, castVote, vetoExecution,
///                              executeVeto, executeResults
///   Flow B — Slate Submission: addSlate, removeSlate
///   Flow C — Mission Statement: proposeUriChange, executeUriChange
///   Flow D — Membership     : grantMembership, revokeMembership,
///                              proposeLapseSweep, runLapseSweep, leaveVoluntarily
///   Flow E — Reform          : proposeReform, ratifyReform, executeReform
///   Flow F — Emergency       : pauseOrRestart
///   Setup   — runInitialSetup
contract YieldEndowmentActions is ActionHelpers {

    ///////////////////////////////////////////////////////////////////////////
    //                         SETUP (one-time)
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Run the initial setup mandate once after deployment.
    ///         Assigns all role labels, sets the treasury, pre-assigns Founding Members
    ///         and SlateRegistry, then revokes itself.
    function runInitialSetup(address powers, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Initial Setup: Assign role labels, set treasury, assign founding members and SlateRegistry roles, then self-revoke.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(), nonce, "Running initial setup");
        vm.stopBroadcast();
        console2.log("Setup mandate executed.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW A: SLATE ELECTION
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Step 1 — A Member opens a new yield distribution election.
    ///         Throttled: cannot be called again for ~6 months after the last election.
    function createElection(
        address powers,
        address slateRegistry,
        string memory electionTitle,
        uint8 maxSlates,
        uint8 maxVotes,
        uint8 maxWinners,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Create Election: A member opens a new yield distribution election in the SlateRegistry.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(electionTitle, maxSlates, maxVotes, maxWinners);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, string.concat("Creating election: ", electionTitle));
        vm.stopBroadcast();

        uint256 electionId = uint256(keccak256(abi.encodePacked(powers, electionTitle)));
        SlateRegistry.Election memory e = SlateRegistry(slateRegistry).getElectionInfo(electionId);
        console2.log("Election created. ID:", electionId);
        console2.log("Submission window closes at block:", e.startBlock);
        console2.log("Voting window closes at block:    ", e.endBlock);
    }

    /// @notice Step 2 — A Member casts a vote for one or more slates.
    ///         Voter passes their own address to prevent double-voting.
    function castVote(
        address powers,
        uint256 electionId,
        uint16[] memory slateIndexes,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Cast Vote: Members vote for their preferred funding slates during the voting window.",
            Powers(payable(powers))
        );
        address voter = vm.addr(privateKey);
        bytes memory calldata_ = abi.encode(electionId, voter, slateIndexes);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, string.concat("Casting vote in election ", vm.toString(electionId)));
        vm.stopBroadcast();
        console2.log("Vote cast by:", voter);
    }

    /// @notice Step 3a — Founding Members propose a veto of election results.
    ///         Must use the same ElectionTitle and nonce as the intended Execute Results call.
    ///         Starts a 3-day (test: 5-min) vote; 3 of 5 founders must vote FOR.
    function proposeVetoExecution(
        address powers,
        string memory electionTitle,
        uint256[] memory founderKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        uint16 id = findMandateIdInOrg(
            "Veto Execution: Founding members vote to block execution of election results.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(electionTitle);
        actionId = calculateActionId(id, calldata_, nonce);

        vm.startBroadcast(founderKeys[0]);
        IPowers(powers).propose(id, calldata_, nonce, string.concat("Veto results of: ", electionTitle));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, id, actionId, founderKeys, nonce, 100);
        console2.log("Veto votes for:", forVote, "against:", againstVote);
    }

    /// @notice Step 3b — Execute the veto after the vote passes (same nonce as propose).
    function executeVeto(address powers, string memory electionTitle, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Veto Execution: Founding members vote to block execution of election results.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(electionTitle), nonce, string.concat("Executing veto of: ", electionTitle));
        vm.stopBroadcast();
        console2.log("Veto executed. Election results blocked for:", electionTitle);
    }

    /// @notice Step 4 — Anyone triggers execution of winning slates after the timelock.
    ///         Will revert if: (a) the voting period has not ended, or
    ///         (b) a veto was fulfilled with the same ElectionTitle + nonce.
    function executeResults(address powers, string memory electionTitle, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Execute Results: After voting has closed and the veto window has expired, execute the winning slates on-chain.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(electionTitle), nonce, string.concat("Executing results of: ", electionTitle));
        vm.stopBroadcast();
        console2.log("Election results executed:", electionTitle);
    }

    /// @notice Propose the Execute Results action (creates the action and starts the timelock).
    ///         Must be proposed before requesting so the timelock clock starts.
    function proposeExecuteResults(address powers, string memory electionTitle, uint256 privateKey, uint256 nonce) public returns (uint256 actionId) {
        uint16 id = findMandateIdInOrg(
            "Execute Results: After voting has closed and the veto window has expired, execute the winning slates on-chain.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(electionTitle);
        vm.startBroadcast(privateKey);
        actionId = IPowers(powers).propose(id, calldata_, nonce, string.concat("Proposing execution of: ", electionTitle));
        vm.stopBroadcast();
        console2.log("Execute Results proposed. Timelock started. ActionId:", actionId);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW B: SLATE SUBMISSION
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Submit a slate of funding actions to an open election.
    ///         Slates are bundles of on-chain calls (e.g. ETH/token transfers).
    function addSlate(
        address powers,
        string memory electionTitle,
        string memory slateName,
        address[] memory slateTargets,
        uint256[] memory slateValues,
        bytes[] memory slateCalldatas,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Add Slate: A member proposes a slate of funding actions to compete in an election.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(electionTitle, slateName, slateTargets, slateValues, slateCalldatas);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, string.concat("Adding slate: ", slateName));
        vm.stopBroadcast();
        console2.log("Slate submitted:", slateName);
    }

    /// @notice Withdraw a previously submitted slate (same calldata + nonce as addSlate).
    ///         Only the original submitter can reproduce the exact calldata to withdraw.
    function removeSlate(
        address powers,
        string memory electionTitle,
        string memory slateName,
        address[] memory slateTargets,
        uint256[] memory slateValues,
        bytes[] memory slateCalldatas,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Remove Slate: A member withdraws their own submitted slate before the voting window opens.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(electionTitle, slateName, slateTargets, slateValues, slateCalldatas);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, string.concat("Removing slate: ", slateName));
        vm.stopBroadcast();
        console2.log("Slate withdrawn:", slateName);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                    FLOW C: MISSION STATEMENT
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Step 1 — Founding Members vote on a new mission statement URI.
    ///         Requires 3 of 5 founders (60% quorum, 51% threshold).
    function proposeUriChange(
        address powers,
        string memory newUri,
        uint256[] memory founderKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        uint16 id = findMandateIdInOrg(
            "Propose URI Change: Founding members vote to update the organisation mission statement URI.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(newUri);
        actionId = calculateActionId(id, calldata_, nonce);

        vm.startBroadcast(founderKeys[0]);
        IPowers(powers).propose(id, calldata_, nonce, string.concat("Propose URI: ", newUri));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, id, actionId, founderKeys, nonce, 100);
        console2.log("URI change votes for:", forVote, "against:", againstVote);
    }

    /// @notice Step 2 — Execute the URI change after vote passes and timelock expires.
    function executeUriChange(address powers, string memory newUri, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Execute URI Change: Update the Powers contract metadata URI to the approved new value.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(newUri), nonce, string.concat("Setting URI: ", newUri));
        vm.stopBroadcast();
        console2.log("URI updated to:", newUri);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                       FLOW D: MEMBERSHIP
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Founding Members grant the Member role to a verified past grantee.
    function grantMembership(address powers, address account, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Grant Membership: Founding members assign the Member role to a verified past grantee.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(account), nonce, string.concat("Granting membership to: ", vm.toString(account)));
        vm.stopBroadcast();
        console2.log("Membership granted to:", account);
    }

    /// @notice Founding Members remove the Member role from a specified account.
    function revokeMembership(address powers, address account, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Revoke Membership: Founding members remove the Member role from a specified account.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(account), nonce, string.concat("Revoking membership from: ", vm.toString(account)));
        vm.stopBroadcast();
        console2.log("Membership revoked from:", account);
    }

    /// @notice Step 1 of lapse sweep — Founding Members vote to authorise the sweep.
    function proposeLapseSweep(address powers, uint256[] memory founderKeys, uint256 nonce) public returns (uint256 actionId) {
        uint16 id = findMandateIdInOrg(
            "Propose Lapse Sweep: Founding members vote to authorise sweeping inactive member accounts.",
            Powers(payable(powers))
        );
        actionId = calculateActionId(id, abi.encode(), nonce);

        vm.startBroadcast(founderKeys[0]);
        IPowers(powers).propose(id, abi.encode(), nonce, "Propose lapse sweep");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, id, actionId, founderKeys, nonce, 100);
        console2.log("Lapse sweep votes for:", forVote, "against:", againstVote);
    }

    /// @notice Step 2 of lapse sweep — Execute the sweep after the vote passes.
    ///         Revokes Members who participated in fewer than 1 of the last 500 governance actions.
    function runLapseSweep(address powers, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Run Lapse Sweep: Revoke the Member role from accounts that have been inactive in recent governance.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(), nonce, "Running lapse sweep");
        vm.stopBroadcast();
        console2.log("Lapse sweep executed.");
    }

    /// @notice A Member voluntarily renounces their own Member role.
    function leaveVoluntarily(address powers, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Leave Voluntarily: A member renounces their own Member role.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(uint256(2)), nonce, "Voluntarily leaving the organisation");
        vm.stopBroadcast();
        console2.log("Member left the organisation:", vm.addr(privateKey));
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW E: GOVERNANCE REFORM
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Step 1 — A single Founding Member proposes a governance reform.
    ///         No vote required at this stage; the reform is submitted with the exact
    ///         list of new mandate addresses and role IDs to be ratified by Members.
    function proposeReform(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Propose Governance Reform: A founding member proposes adopting new governance mandates.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(newMandates, roleIds);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, "Founding member proposes governance reform");
        vm.stopBroadcast();
        console2.log("Reform proposed. Members can now ratify.");
    }

    /// @notice Step 2 — Members vote to ratify a proposed governance reform.
    ///         Must use the same mandate list + nonce as the proposal.
    function ratifyReform(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory memberKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        uint16 id = findMandateIdInOrg(
            "Ratify Governance Reform: Members vote to approve a proposed governance reform.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(newMandates, roleIds);
        actionId = calculateActionId(id, calldata_, nonce);

        vm.startBroadcast(memberKeys[0]);
        IPowers(powers).propose(id, calldata_, nonce, "Members ratify governance reform");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, id, actionId, memberKeys, nonce, 100);
        console2.log("Ratification votes for:", forVote, "against:", againstVote);
    }

    /// @notice Step 3 — Founding Members execute the reform after ratification and timelock.
    function executeReform(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Execute Governance Reform: Adopt the approved new governance mandates after member ratification.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(newMandates, roleIds), nonce, "Executing governance reform");
        vm.stopBroadcast();
        console2.log("Governance reform executed. New mandates adopted.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                      FLOW F: EMERGENCY
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Any Founding Member pauses or restarts critical mandates.
    ///         paused = true  → freezes Cast Vote, Execute Results, Add Slate
    ///         paused = false → restarts them from their original configuration
    function pauseOrRestart(address powers, bool paused, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Pause or Restart Critical Mandates: A founding member pauses or restarts election and voting mandates in an emergency.",
            Powers(payable(powers))
        );
        string memory action = paused ? "Pausing" : "Restarting";
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(paused), nonce, string.concat(action, " critical mandates"));
        vm.stopBroadcast();
        console2.log(paused ? "Critical mandates paused." : "Critical mandates restarted.");
    }
}
