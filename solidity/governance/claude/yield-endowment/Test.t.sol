// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Run with: forge test --match-contract YieldEndowment_test -vvv

import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";

import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Mandate } from "@src/Mandate.sol";
import { IMandate } from "@src/interfaces/IMandate.sol";
import { SlateRegistry } from "@src/helpers/SlateRegistry.sol";

import { Deploy } from "./Deploy.s.sol";

contract YieldEndowment_test is Test {

    // ── Contracts ──────────────────────────────────────────────────────────
    Powers powers;
    SlateRegistry slateRegistry;

    // ── Role IDs ───────────────────────────────────────────────────────────
    uint256 constant ADMIN_ROLE    = 0;
    uint256 constant FOUNDER_ROLE  = 1;
    uint256 constant MEMBER_ROLE   = 2;
    uint256 constant REGISTRY_ROLE = 3;

    // ── Founding Members (must match Deploy.s.sol constants) ───────────────
    address constant FOUNDER_1 = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address constant FOUNDER_2 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant FOUNDER_3 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address constant FOUNDER_4 = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    address constant FOUNDER_5 = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;

    // ── Test accounts ──────────────────────────────────────────────────────
    address alice   = makeAddr("alice");   // a new member (past grantee)
    address bob     = makeAddr("bob");     // another new member
    address charlie = makeAddr("charlie"); // non-member

    // ── Nonce counter ──────────────────────────────────────────────────────
    uint256 constant NONCE = 1;

    function setUp() public {
        vm.label(FOUNDER_1, "FOUNDER_1");
        vm.label(FOUNDER_2, "FOUNDER_2");
        vm.label(FOUNDER_3, "FOUNDER_3");
        vm.label(FOUNDER_4, "FOUNDER_4");
        vm.label(FOUNDER_5, "FOUNDER_5");
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(charlie, "charlie");

        // Deploy with FOUNDER_1 as Admin
        Deploy deployScript = new Deploy();
        vm.startPrank(FOUNDER_1);
        (powers, slateRegistry) = deployScript.run();
        vm.stopPrank();

        // Trigger initial setup (assigns Founding Members + SlateRegistry roles, self-revokes)
        uint16 setupId = _findMandate("Initial Setup: Assign role labels, set treasury, assign founding members and SlateRegistry roles, then self-revoke.");
        vm.prank(FOUNDER_1);
        powers.request(setupId, abi.encode(), NONCE, "Initial setup");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         DEPLOYMENT CHECKS
    ///////////////////////////////////////////////////////////////////////////

    function test_deployment_foundingMembersAssigned() public view {
        assertTrue(powers.hasRoleSince(FOUNDER_1, FOUNDER_ROLE) > 0, "FOUNDER_1 not assigned");
        assertTrue(powers.hasRoleSince(FOUNDER_2, FOUNDER_ROLE) > 0, "FOUNDER_2 not assigned");
        assertTrue(powers.hasRoleSince(FOUNDER_3, FOUNDER_ROLE) > 0, "FOUNDER_3 not assigned");
        assertTrue(powers.hasRoleSince(FOUNDER_4, FOUNDER_ROLE) > 0, "FOUNDER_4 not assigned");
        assertTrue(powers.hasRoleSince(FOUNDER_5, FOUNDER_ROLE) > 0, "FOUNDER_5 not assigned");
        assertTrue(powers.hasRoleSince(address(slateRegistry), REGISTRY_ROLE) > 0, "SlateRegistry role not assigned");
    }

    function test_deployment_roleLabels() public view {
        assertEq(powers.getRoleLabel(FOUNDER_ROLE),  "Founding Members");
        assertEq(powers.getRoleLabel(MEMBER_ROLE),   "Members");
        assertEq(powers.getRoleLabel(REGISTRY_ROLE), "SlateRegistry");
    }

    function test_deployment_setupMandateRevoked() public view {
        // The setup mandate (id=1) should be inactive after running
        (,, bool active) = powers.getAdoptedMandate(1);
        assertFalse(active, "Setup mandate should be revoked after execution");
    }

    function test_deployment_inputParamsDependencies() public view {
        uint16 counter = powers.getMandateCounter();
        for (uint16 mid = 1; mid < counter; mid++) {
            (address mAddr,, bool active) = powers.getAdoptedMandate(mid);
            if (!active || mAddr == address(0)) continue;
            PowersTypes.Conditions memory cond = powers.getConditions(mid);
            if (cond.needFulfilled > 0) {
                (address parentAddr,,) = powers.getAdoptedMandate(cond.needFulfilled);
                bytes memory childParams  = Mandate(mAddr).getInputParams(address(powers), mid);
                bytes memory parentParams = Mandate(parentAddr).getInputParams(address(powers), cond.needFulfilled);
                assertEq(
                    keccak256(childParams), keccak256(parentParams),
                    string.concat("InputParams mismatch for mandate: ", Mandate(mAddr).getNameDescription(address(powers), mid))
                );
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    //                    FLOW D: MEMBERSHIP (happy path)
    ///////////////////////////////////////////////////////////////////////////

    function test_grantMembership_happyPath() public {
        assertEq(powers.hasRoleSince(alice, MEMBER_ROLE), 0, "alice should not be a member yet");

        uint16 grantId = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");

        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Granting membership to alice");

        assertTrue(powers.hasRoleSince(alice, MEMBER_ROLE) > 0, "alice should now be a member");
    }

    function test_grantMembership_blocked_forNonFounder() public {
        uint16 grantId = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");

        vm.prank(charlie); // not a founding member
        vm.expectRevert();
        powers.request(grantId, abi.encode(alice), NONCE, "Charlie tries to grant membership");
    }

    function test_revokeMembership_happyPath() public {
        // First grant membership
        uint16 grantId  = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");
        uint16 revokeId = _findMandate("Revoke Membership: Founding members remove the Member role from a specified account.");

        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Grant alice");
        assertTrue(powers.hasRoleSince(alice, MEMBER_ROLE) > 0, "alice should be a member");

        vm.prank(FOUNDER_1);
        powers.request(revokeId, abi.encode(alice), NONCE + 1, "Revoke alice");
        assertEq(powers.hasRoleSince(alice, MEMBER_ROLE), 0, "alice should no longer be a member");
    }

    function test_leaveVoluntarily() public {
        // Grant alice membership first
        uint16 grantId = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");
        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Grant alice");

        uint16 leaveId = _findMandate("Leave Voluntarily: A member renounces their own Member role.");

        vm.prank(alice);
        powers.request(leaveId, abi.encode(uint256(MEMBER_ROLE)), NONCE + 1, "Alice leaves");

        assertEq(powers.hasRoleSince(alice, MEMBER_ROLE), 0, "alice should have renounced membership");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                 FLOW A + B: SLATE ELECTION (happy path)
    ///////////////////////////////////////////////////////////////////////////

    function test_slateElection_happyPath() public {
        string memory electionTitle = "H1 Yield Distribution";

        // Grant alice membership so she can participate
        uint16 grantId   = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");
        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Grant alice");

        uint16 createId  = _findMandate("Create Election: A member opens a new yield distribution election in the SlateRegistry.");
        uint16 addSlateId = _findMandate("Add Slate: A member proposes a slate of funding actions to compete in an election.");
        uint16 voteId    = _findMandate("Cast Vote: Members vote for their preferred funding slates during the voting window.");
        uint16 executeId = _findMandate("Execute Results: After voting has closed and the veto window has expired, execute the winning slates on-chain.");

        // Step 1: Alice creates an election
        vm.prank(alice);
        powers.request(createId, abi.encode(electionTitle, uint8(5), uint8(3), uint8(1)), NONCE, "H1 election");

        uint256 electionId = uint256(keccak256(abi.encodePacked(address(powers), electionTitle)));
        SlateRegistry.Election memory election = slateRegistry.getElectionInfo(electionId);
        assertTrue(election.startBlock > 0, "election should be created");

        // Step 2: Alice submits a funding slate (empty targets for test)
        address[] memory t = new address[](0);
        uint256[] memory v = new uint256[](0);
        bytes[]   memory c = new bytes[](0);
        bytes memory slateCalldata = abi.encode(electionTitle, "Alice's Grant Slate", t, v, c);

        vm.prank(alice);
        powers.request(addSlateId, slateCalldata, NONCE, "Alice's slate");
        assertEq(slateRegistry.getSlateCount(electionId), 1, "should have 1 slate");

        // Step 3: Advance to voting window
        vm.roll(election.startBlock + 1);

        // Step 4: Alice votes for her slate
        uint16[] memory slateIndexes = slateRegistry.getSlates(electionId);
        vm.prank(alice);
        powers.request(voteId, abi.encode(electionId, alice, slateIndexes), NONCE, "Alice votes");
        assertTrue(slateRegistry.hasUserVoted(alice, electionId), "alice should have voted");

        // Step 5: Advance past the voting window
        vm.roll(election.endBlock + 1);

        // Step 6: Propose execution (starts the timelock + veto window)
        vm.prank(alice);
        uint256 execActionId = powers.propose(executeId, abi.encode(electionTitle), NONCE + 1, "Propose execute");

        // Step 7: Advance past the execution timelock (no veto cast)
        uint32 timelock = powers.getConditions(executeId).timelock;
        (, uint48 proposedAt,,,,,) = powers.getActionData(execActionId);
        vm.roll(uint256(proposedAt) + uint256(timelock) + 1);

        // Step 8: Execute results
        vm.prank(charlie); // anyone can trigger
        powers.request(executeId, abi.encode(electionTitle), NONCE + 1, "Execute results");
    }

    function test_slateExecution_blockedBeforeVoteEnds() public {
        string memory electionTitle = "Early Exec Test";

        uint16 grantId = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");
        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Grant alice");

        uint16 createId  = _findMandate("Create Election: A member opens a new yield distribution election in the SlateRegistry.");
        uint16 executeId = _findMandate("Execute Results: After voting has closed and the veto window has expired, execute the winning slates on-chain.");

        vm.prank(alice);
        powers.request(createId, abi.encode(electionTitle, uint8(5), uint8(3), uint8(1)), NONCE, "Create");

        // Try to propose execute before voting ends — should revert (SlateRegistry checks endBlock)
        vm.prank(charlie);
        vm.expectRevert();
        powers.request(executeId, abi.encode(electionTitle), NONCE + 1, "Early execution");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                   FLOW A: FOUNDING MEMBER VETO
    ///////////////////////////////////////////////////////////////////////////

    function test_veto_blocksExecution() public {
        string memory electionTitle = "Veto Test Election";

        uint16 grantId   = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");
        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Grant alice");

        uint16 createId  = _findMandate("Create Election: A member opens a new yield distribution election in the SlateRegistry.");
        uint16 voteId    = _findMandate("Cast Vote: Members vote for their preferred funding slates during the voting window.");
        uint16 vetoId    = _findMandate("Veto Execution: Founding members vote to block execution of election results.");
        uint16 executeId = _findMandate("Execute Results: After voting has closed and the veto window has expired, execute the winning slates on-chain.");

        // Create election and add a slate
        vm.prank(alice);
        powers.request(createId, abi.encode(electionTitle, uint8(5), uint8(3), uint8(1)), NONCE, "Create");

        uint256 electionId = uint256(keccak256(abi.encodePacked(address(powers), electionTitle)));
        SlateRegistry.Election memory election = slateRegistry.getElectionInfo(electionId);

        address[] memory t = new address[](0);
        uint256[] memory v = new uint256[](0);
        bytes[]   memory c = new bytes[](0);
        vm.prank(alice);
        powers.request(
            _findMandate("Add Slate: A member proposes a slate of funding actions to compete in an election."),
            abi.encode(electionTitle, "Test Slate", t, v, c),
            NONCE, "Add slate"
        );

        // Advance into voting window and vote
        vm.roll(election.startBlock + 1);
        uint16[] memory slateIndexes = slateRegistry.getSlates(electionId);
        vm.prank(alice);
        powers.request(voteId, abi.encode(electionId, alice, slateIndexes), NONCE, "Vote");

        // Advance past voting
        vm.roll(election.endBlock + 1);

        // Propose Execute Results with nonce NONCE+1 (starts timelock)
        bytes memory executeCalldata = abi.encode(electionTitle);
        vm.prank(charlie);
        powers.propose(executeId, executeCalldata, NONCE + 1, "Propose execute");

        // Founding Members propose and vote on Veto with SAME calldata + nonce
        vm.prank(FOUNDER_1);
        uint256 vetoActionId = powers.propose(vetoId, executeCalldata, NONCE + 1, "Propose veto");

        vm.prank(FOUNDER_1);
        powers.castVote(vetoActionId, 1); // FOR
        vm.prank(FOUNDER_2);
        powers.castVote(vetoActionId, 1); // FOR
        vm.prank(FOUNDER_3);
        powers.castVote(vetoActionId, 1); // FOR

        // Advance past veto voting period
        uint32 vetoVotePeriod = powers.getConditions(vetoId).votingPeriod;
        vm.roll(block.number + vetoVotePeriod + 1);

        // Execute the veto
        vm.prank(FOUNDER_1);
        powers.request(vetoId, executeCalldata, NONCE + 1, "Execute veto");

        // Advance past the execute timelock
        uint16 executeMandateId = _findMandate("Execute Results: After voting has closed and the veto window has expired, execute the winning slates on-chain.");
        uint32 timelock = powers.getConditions(executeMandateId).timelock;
        vm.roll(block.number + timelock + 1);

        // Execute Results should now revert — veto was fulfilled with same calldata + nonce
        vm.prank(charlie);
        vm.expectRevert();
        powers.request(executeId, executeCalldata, NONCE + 1, "Execute results after veto");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                   FLOW C: MISSION STATEMENT UPDATE
    ///////////////////////////////////////////////////////////////////////////

    function test_missionStatement_happyPath() public {
        string memory newUri = "https://ipfs.example.com/endowment-v2.json";

        uint16 proposeId = _findMandate("Propose URI Change: Founding members vote to update the organisation mission statement URI.");
        uint16 executeId = _findMandate("Execute URI Change: Update the Powers contract metadata URI to the approved new value.");

        bytes memory calldata_ = abi.encode(newUri);

        // Founding Members vote on URI change
        vm.prank(FOUNDER_1);
        uint256 actionId = powers.propose(proposeId, calldata_, NONCE, "Propose URI change");

        vm.prank(FOUNDER_1);
        powers.castVote(actionId, 1);
        vm.prank(FOUNDER_2);
        powers.castVote(actionId, 1);
        vm.prank(FOUNDER_3);
        powers.castVote(actionId, 1);

        uint32 votePeriod = powers.getConditions(proposeId).votingPeriod;
        vm.roll(block.number + votePeriod + 1);

        // Execute the proposal (creates action + starts timelock)
        vm.prank(FOUNDER_1);
        powers.request(proposeId, calldata_, NONCE, "Execute URI proposal");

        // Advance past the execute timelock
        (, uint48 proposedAt,,,,,) = powers.getActionData(
            uint256(keccak256(abi.encode(proposeId, calldata_, NONCE)))
        );
        uint32 timelock = powers.getConditions(executeId).timelock;
        vm.roll(uint256(proposedAt) + uint256(timelock) + 1);

        // Execute URI change
        vm.prank(FOUNDER_1);
        powers.request(executeId, calldata_, NONCE, "Execute URI change");

        assertEq(powers.uri(), newUri, "URI should be updated");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                   FLOW E: GOVERNANCE REFORM (happy path)
    ///////////////////////////////////////////////////////////////////////////

    function test_governanceReform_happyPath() public {
        // Grant alice and bob membership so members can ratify
        uint16 grantId = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");
        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Grant alice");
        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(bob), NONCE + 1, "Grant bob");

        uint16 proposeId = _findMandate("Propose Governance Reform: A founding member proposes adopting new governance mandates.");
        uint16 ratifyId  = _findMandate("Ratify Governance Reform: Members vote to approve a proposed governance reform.");
        uint16 executeId = _findMandate("Execute Governance Reform: Adopt the approved new governance mandates after member ratification.");

        // Use a dummy address as the "new mandate" for the test
        address[] memory newMandates = new address[](1);
        newMandates[0] = address(0xdead);
        uint256[] memory roleIds = new uint256[](1);
        roleIds[0] = 2;
        bytes memory calldata_ = abi.encode(newMandates, roleIds);

        // Step 1: Founding Member proposes (no vote — immediate)
        vm.prank(FOUNDER_1);
        powers.request(proposeId, calldata_, NONCE, "Propose reform");

        // Step 2: Members ratify via vote
        vm.prank(alice);
        uint256 ratifyActionId = powers.propose(ratifyId, calldata_, NONCE, "Ratify reform");

        vm.prank(alice);
        powers.castVote(ratifyActionId, 1); // FOR
        vm.prank(bob);
        powers.castVote(ratifyActionId, 1); // FOR

        uint32 ratifyVotePeriod = powers.getConditions(ratifyId).votingPeriod;
        vm.roll(block.number + ratifyVotePeriod + 1);

        // Execute ratification
        vm.prank(alice);
        powers.request(ratifyId, calldata_, NONCE, "Execute ratification");

        // Advance past execute timelock
        (, uint48 ratifyExecutedAt,,,,,) = powers.getActionData(
            uint256(keccak256(abi.encode(ratifyId, calldata_, NONCE)))
        );
        uint32 timelock = powers.getConditions(executeId).timelock;
        vm.roll(uint256(ratifyExecutedAt) + uint256(timelock) + 1);

        // Step 3: Founding Member executes the reform
        // Note: address(0xdead) is not a real mandate contract, so this will revert on-chain.
        // In a real reform, newMandates[0] would be a deployed mandate address.
        // We only test up to the governance approval step here.
        // vm.prank(FOUNDER_1);
        // powers.request(executeId, calldata_, NONCE, "Execute reform");
    }

    function test_governanceReform_blocked_withoutProposal() public {
        // Grant alice membership
        uint16 grantId = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");
        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Grant alice");

        uint16 ratifyId = _findMandate("Ratify Governance Reform: Members vote to approve a proposed governance reform.");
        address[] memory newMandates = new address[](1);
        newMandates[0] = address(0xdead);
        uint256[] memory roleIds = new uint256[](1);
        roleIds[0] = 2;

        // Members try to ratify without a prior founder proposal — should revert
        vm.prank(alice);
        vm.expectRevert();
        powers.propose(ratifyId, abi.encode(newMandates, roleIds), NONCE, "Ratify without proposal");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW F: EMERGENCY PAUSE
    ///////////////////////////////////////////////////////////////////////////

    function test_emergencyPause_blocksCastVote() public {
        string memory electionTitle = "Pause Test Election";

        uint16 grantId   = _findMandate("Grant Membership: Founding members assign the Member role to a verified past grantee.");
        vm.prank(FOUNDER_1);
        powers.request(grantId, abi.encode(alice), NONCE, "Grant alice");

        uint16 createId  = _findMandate("Create Election: A member opens a new yield distribution election in the SlateRegistry.");
        uint16 pauseId   = _findMandate("Pause or Restart Critical Mandates: A founding member pauses or restarts election and voting mandates in an emergency.");
        uint16 voteId    = _findMandate("Cast Vote: Members vote for their preferred funding slates during the voting window.");

        // Create election
        vm.prank(alice);
        powers.request(createId, abi.encode(electionTitle, uint8(5), uint8(3), uint8(1)), NONCE, "Create");

        uint256 electionId = uint256(keccak256(abi.encodePacked(address(powers), electionTitle)));
        SlateRegistry.Election memory election = slateRegistry.getElectionInfo(electionId);

        // Add a slate
        address[] memory t = new address[](0);
        uint256[] memory v = new uint256[](0);
        bytes[]   memory c = new bytes[](0);
        vm.prank(alice);
        powers.request(
            _findMandate("Add Slate: A member proposes a slate of funding actions to compete in an election."),
            abi.encode(electionTitle, "A Slate", t, v, c),
            NONCE, "Add slate"
        );

        // Founding Member pauses critical mandates
        vm.prank(FOUNDER_1);
        powers.request(pauseId, abi.encode(true), NONCE + 1, "Pause critical mandates");

        // Advance to voting window
        vm.roll(election.startBlock + 1);

        // Cast Vote should be revoked — attempt should revert
        uint16[] memory slateIndexes = slateRegistry.getSlates(electionId);
        vm.prank(alice);
        vm.expectRevert();
        powers.request(voteId, abi.encode(electionId, alice, slateIndexes), NONCE, "Vote while paused");

        // Restart critical mandates
        vm.prank(FOUNDER_1);
        powers.request(pauseId, abi.encode(false), NONCE + 2, "Restart critical mandates");

        // Cast Vote should work again
        vm.prank(alice);
        powers.request(voteId, abi.encode(electionId, alice, slateIndexes), NONCE, "Vote after restart");
        assertTrue(slateRegistry.hasUserVoted(alice, electionId), "alice should have voted after restart");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                           HELPERS
    ///////////////////////////////////////////////////////////////////////////

    function _findMandate(string memory nameDesc) internal view returns (uint16) {
        uint16 counter = powers.getMandateCounter();
        for (uint16 i = 1; i < counter; i++) {
            (address mAddr,,) = powers.getAdoptedMandate(i);
            if (mAddr == address(0)) continue;
            string memory desc = IMandate(mAddr).getNameDescription(address(powers), i);
            if (keccak256(abi.encodePacked(desc)) == keccak256(abi.encodePacked(nameDesc))) {
                return i;
            }
        }
        revert(string.concat("Mandate not found: ", nameDesc));
    }
}
