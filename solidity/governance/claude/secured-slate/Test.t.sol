// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Run with: forge test --match-contract SecuredSlate_test -vvv

import { Test } from "forge-std/Test.sol";

import { Powers } from "@src/Powers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Mandate } from "@src/Mandate.sol";
import { IMandate } from "@src/interfaces/IMandate.sol";
import { SlateRegistry } from "@src/core/helpers/SlateRegistry.sol";
import { Deploy } from "./Deploy.s.sol";

contract SecuredSlate_test is Test {
    // ── Contracts ──────────────────────────────────────────────────────────
    Powers powers;
    SlateRegistry slateRegistry;

    // ── Roles ──────────────────────────────────────────────────────────────
    uint256 constant ADMIN_ROLE      = 0;
    uint256 constant MEMBER_ROLE     = 1;
    uint256 constant COUNCIL_ROLE    = 2;
    uint256 constant REGISTRY_ROLE   = 3;
    uint256 constant BLACKLIST_ROLE  = 4;

    // ── Pre-assigned Security Council addresses ────────────────────────────
    address constant COUNCIL_1 = 0x3F46F636F78929a4336de0a435E3930092900f06;
    address constant COUNCIL_2 = 0xa221eB405d87B624be08fAbf949F05D19C765f68;
    address constant COUNCIL_3 = 0x7507F9F06103D7D462DaE11C0A6f4A415c69DcF9;

    // ── Test accounts ──────────────────────────────────────────────────────
    address alice   = makeAddr("alice");   // deployer / first member
    address bob     = makeAddr("bob");     // second member (added via Flow C)
    address charlie = makeAddr("charlie"); // non-member proposer
    address dave    = makeAddr("dave");    // bad actor to blacklist

    // ── Constants ──────────────────────────────────────────────────────────
    uint256 constant NONCE = 1;

    function setUp() public {
        vm.label(COUNCIL_1, "COUNCIL_1");
        vm.label(COUNCIL_2, "COUNCIL_2");
        vm.label(COUNCIL_3, "COUNCIL_3");
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(charlie, "charlie");
        vm.label(dave, "dave");

        // Deploy and constitute with alice as deployer (she becomes the bootstrap member)
        Deploy deployer = new Deploy();
        vm.startPrank(alice);
        (powers, slateRegistry) = deployer.run();
        vm.stopPrank();
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         DEPLOYMENT CHECKS
    ///////////////////////////////////////////////////////////////////////////

    function test_deployment_rolesAssigned() public view {
        assertTrue(powers.hasRoleSince(COUNCIL_1, COUNCIL_ROLE) > 0, "COUNCIL_1 not assigned");
        assertTrue(powers.hasRoleSince(COUNCIL_2, COUNCIL_ROLE) > 0, "COUNCIL_2 not assigned");
        assertTrue(powers.hasRoleSince(COUNCIL_3, COUNCIL_ROLE) > 0, "COUNCIL_3 not assigned");
        assertTrue(powers.hasRoleSince(address(slateRegistry), REGISTRY_ROLE) > 0, "SlateRegistry role not assigned");
        assertTrue(powers.hasRoleSince(alice, MEMBER_ROLE) > 0, "alice (deployer) not a member");
    }

    function test_deployment_roleLabels() public view {
        assertEq(powers.getRoleLabel(MEMBER_ROLE),    "Members");
        assertEq(powers.getRoleLabel(COUNCIL_ROLE),   "Security Council");
        assertEq(powers.getRoleLabel(REGISTRY_ROLE),  "SlateRegistry");
        assertEq(powers.getRoleLabel(BLACKLIST_ROLE), "Blacklisted");
    }

    function test_deployment_inputParamsDependencies() public view {
        uint16 counter = powers.getMandateCounter();
        for (uint16 mid = 1; mid < counter; mid++) {
            (address mAddr,, bool active) = powers.getAdoptedMandate(mid);
            if (!active) continue;
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
    //                    FLOW C: MEMBER MANAGEMENT (happy path)
    ///////////////////////////////////////////////////////////////////////////

    function test_memberAddition_happyPath() public {
        assertEq(powers.hasRoleSince(bob, MEMBER_ROLE), 0, "bob should not be a member yet");

        uint16 proposeId = _findMandate("Propose Member Addition: Members vote to onboard a new member.");
        bytes memory calldata_ = abi.encode(bob);

        // Alice proposes adding bob
        vm.prank(alice);
        uint256 actionId = powers.propose(proposeId, calldata_, NONCE, "Adding bob as member");

        // Alice votes FOR
        vm.prank(alice);
        powers.castVote(actionId, 1);

        // Advance past the 30-min voting window
        uint32 votePeriod = powers.getConditions(proposeId).votingPeriod;
        vm.roll(block.number + votePeriod + 1);

        // Execute the StatementOfIntent proposal
        vm.prank(alice);
        powers.request(proposeId, calldata_, NONCE, "Adding bob as member");

        // Execute Add Member (needFulfilled is satisfied)
        uint16 addId = _findMandate("Add Member: Execute an approved member onboarding by assigning the Member role.");
        vm.prank(alice);
        powers.request(addId, calldata_, NONCE, "Adding bob as member");

        assertTrue(powers.hasRoleSince(bob, MEMBER_ROLE) > 0, "bob should now be a member");
    }

    function test_memberAddition_blocked_withoutVote() public {
        uint16 addId = _findMandate("Add Member: Execute an approved member onboarding by assigning the Member role.");

        // Try to execute Add Member without the proposal step
        vm.prank(alice);
        vm.expectRevert();
        powers.request(addId, abi.encode(bob), NONCE, "Trying to add bob without proposal");
    }

    function test_renounce_membership() public {
        assertTrue(powers.hasRoleSince(alice, MEMBER_ROLE) > 0, "alice should be a member");

        uint16 renounceId = _findMandate("Renounce Membership: A member voluntarily gives up their Member role.");
        vm.prank(alice);
        powers.request(renounceId, abi.encode(uint256(MEMBER_ROLE)), NONCE, "Renouncing membership");

        assertEq(powers.hasRoleSince(alice, MEMBER_ROLE), 0, "alice should no longer be a member");
    }

    ///////////////////////////////////////////////////////////////////////////
    //               FLOW D: BLACKLIST MANAGEMENT (happy path)
    ///////////////////////////////////////////////////////////////////////////

    function test_blacklist_happyPath() public {
        // Assign dave as a member directly (impersonate Powers to bypass governance flow in setup)
        vm.prank(address(powers));
        powers.assignRole(MEMBER_ROLE, dave);
        assertTrue(powers.hasRoleSince(dave, MEMBER_ROLE) > 0, "dave should be a member");

        uint16 blacklistId   = _findMandate("Blacklist Account: Security Council marks an account as blacklisted.");
        uint16 revokeId      = _findMandate("Revoke Membership of Blacklisted Account: Security Council removes the Member role from a blacklisted account.");
        uint16 deBlacklistId = _findMandate("De-Blacklist Account: Security Council removes the Blacklisted mark from an account.");

        bytes memory calldata_ = abi.encode(dave);

        // Step 1: Blacklist dave
        vm.prank(COUNCIL_1);
        powers.request(blacklistId, calldata_, NONCE, "Blacklisting dave");
        assertTrue(powers.hasRoleSince(dave, BLACKLIST_ROLE) > 0, "dave should be blacklisted");
        assertTrue(powers.hasRoleSince(dave, MEMBER_ROLE) > 0, "dave's member role should be intact after step 1");

        // Step 2: Revoke dave's member role (requires same calldata+nonce as step 1)
        vm.prank(COUNCIL_1);
        powers.request(revokeId, calldata_, NONCE, "Revoking dave's member role");
        assertEq(powers.hasRoleSince(dave, MEMBER_ROLE), 0, "dave's Member role should be revoked");

        // Step 3: De-blacklist dave (new nonce — separate action)
        vm.prank(COUNCIL_1);
        powers.request(deBlacklistId, calldata_, NONCE + 1, "De-blacklisting dave");
        assertEq(powers.hasRoleSince(dave, BLACKLIST_ROLE), 0, "dave should no longer be blacklisted");

        // Membership is NOT restored by de-blacklisting
        assertEq(powers.hasRoleSince(dave, MEMBER_ROLE), 0, "dave's member role should remain revoked");
    }

    function test_blacklist_revokeBlocked_withoutBlacklist() public {
        vm.prank(address(powers));
        powers.assignRole(MEMBER_ROLE, dave);

        uint16 revokeId = _findMandate("Revoke Membership of Blacklisted Account: Security Council removes the Member role from a blacklisted account.");

        // Attempt to revoke without the prior blacklist step — needFulfilled not met
        vm.prank(COUNCIL_1);
        vm.expectRevert();
        powers.request(revokeId, abi.encode(dave), NONCE, "Revoking without blacklist");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                    FLOW A+B: SLATE ELECTION (happy path)
    ///////////////////////////////////////////////////////////////////////////

    function test_slateElection_happyPath() public {
        string memory electionTitle = "Q1 Funding Round";

        uint16 createId   = _findMandate("Create Election: A member opens a new slate election in the SlateRegistry.");
        uint16 addSlateId = _findMandate("Add Slate: Any account can propose a slate of actions to compete in an election.");
        uint16 voteId     = _findMandate("Cast Vote: Members vote for their preferred slates during the voting window.");
        uint16 executeId  = _findMandate("Execute Results: After voting has closed, execute the winning slates on-chain.");

        // Step 1: Alice creates an election
        vm.prank(alice);
        powers.request(createId, abi.encode(electionTitle, uint8(5), uint8(3), uint8(1)), NONCE, "Creating Q1 election");

        uint256 electionId = uint256(keccak256(abi.encodePacked(address(powers), electionTitle)));
        SlateRegistry.Election memory election = slateRegistry.getElectionInfo(electionId);
        assertTrue(election.startBlock > 0, "election should be created");

        // Step 2: Charlie (non-member) submits a slate during submission window
        address[] memory targets   = new address[](0);
        uint256[] memory values    = new uint256[](0);
        bytes[]   memory calldatas = new bytes[](0);
        bytes memory slateCalldata = abi.encode(electionTitle, "Charlie's Slate", targets, values, calldatas);

        vm.prank(charlie);
        powers.request(addSlateId, slateCalldata, NONCE, "Adding charlie's slate");
        assertEq(slateRegistry.getSlateCount(electionId), 1, "should have 1 slate");

        // Step 3: Advance to voting window
        vm.roll(election.startBlock + 1);

        // Step 4: Alice votes
        uint16[] memory slateIndexes = slateRegistry.getSlates(electionId);

        vm.prank(alice);
        powers.request(voteId, abi.encode(electionId, alice, slateIndexes), NONCE, "Alice votes");
        assertTrue(slateRegistry.hasUserVoted(alice, electionId), "alice should have voted");

        // Step 5: Advance past voting window
        vm.roll(election.endBlock + 1);

        // Step 6: Anyone triggers execution of winning slates
        vm.prank(charlie);
        powers.request(executeId, abi.encode(electionTitle), NONCE + 1, "Executing results");
    }

    function test_slateExecution_blockedBeforeVoteEnds() public {
        string memory electionTitle = "Early Execution Test";

        uint16 createId  = _findMandate("Create Election: A member opens a new slate election in the SlateRegistry.");
        uint16 executeId = _findMandate("Execute Results: After voting has closed, execute the winning slates on-chain.");

        vm.prank(alice);
        powers.request(createId, abi.encode(electionTitle, uint8(5), uint8(3), uint8(1)), NONCE, "Creating election");

        // Try to execute before voting window closes
        vm.prank(charlie);
        vm.expectRevert();
        powers.request(executeId, abi.encode(electionTitle), NONCE + 1, "Early execution attempt");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW B: SECURITY COUNCIL VETO
    ///////////////////////////////////////////////////////////////////////////

    function test_councilVeto_removesSlate() public {
        string memory electionTitle = "Veto Test Election";

        uint16 createId   = _findMandate("Create Election: A member opens a new slate election in the SlateRegistry.");
        uint16 addSlateId = _findMandate("Add Slate: Any account can propose a slate of actions to compete in an election.");
        uint16 removeId   = _findMandate("Remove Slate: Security Council vetoes and removes a submitted slate before voting opens.");

        vm.prank(alice);
        powers.request(createId, abi.encode(electionTitle, uint8(5), uint8(3), uint8(1)), NONCE, "Creating election");

        uint256 electionId = uint256(keccak256(abi.encodePacked(address(powers), electionTitle)));

        // Charlie submits a slate
        address[] memory t = new address[](0);
        uint256[] memory v = new uint256[](0);
        bytes[]   memory c = new bytes[](0);
        bytes memory slateCalldata = abi.encode(electionTitle, "Suspicious Slate", t, v, c);

        vm.prank(charlie);
        powers.request(addSlateId, slateCalldata, NONCE, "Adding suspicious slate");
        assertEq(slateRegistry.getSlateCount(electionId), 1, "should have 1 slate before veto");

        // Security Council vetoes with SAME calldata + nonce
        vm.prank(COUNCIL_1);
        powers.request(removeId, slateCalldata, NONCE, "Vetoing suspicious slate");
        assertEq(slateRegistry.getSlateCount(electionId), 0, "slate should be removed after veto");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                    FLOW E: EMERGENCY PAUSE
    ///////////////////////////////////////////////////////////////////////////

    function test_emergencyPause_blocksCastVote() public {
        string memory electionTitle = "Pause Test Election";

        uint16 createId   = _findMandate("Create Election: A member opens a new slate election in the SlateRegistry.");
        uint16 addSlateId = _findMandate("Add Slate: Any account can propose a slate of actions to compete in an election.");
        uint16 pauseId    = _findMandate("Pause or Restart Critical Mandates: Security Council pauses or restarts voting and execution mandates in an emergency.");
        uint16 voteId     = _findMandate("Cast Vote: Members vote for their preferred slates during the voting window.");

        vm.prank(alice);
        powers.request(createId, abi.encode(electionTitle, uint8(5), uint8(3), uint8(1)), NONCE, "Creating election");

        uint256 electionId = uint256(keccak256(abi.encodePacked(address(powers), electionTitle)));
        SlateRegistry.Election memory election = slateRegistry.getElectionInfo(electionId);

        // Add a slate during submission window
        address[] memory t = new address[](0);
        uint256[] memory v = new uint256[](0);
        bytes[]   memory c = new bytes[](0);
        vm.prank(charlie);
        powers.request(addSlateId, abi.encode(electionTitle, "A Slate", t, v, c), NONCE, "Adding slate");

        // Security Council pauses critical mandates
        vm.prank(COUNCIL_1);
        powers.request(pauseId, abi.encode(true), NONCE, "Pausing critical mandates");

        // Advance to voting window
        vm.roll(election.startBlock + 1);

        // Cast Vote should be revoked — attempt should revert
        uint16[] memory slateIndexes = new uint16[](0);
        vm.prank(alice);
        vm.expectRevert();
        powers.request(voteId, abi.encode(electionId, alice, slateIndexes), NONCE, "Voting while paused");

        // Security Council restarts critical mandates
        vm.prank(COUNCIL_1);
        powers.request(pauseId, abi.encode(false), NONCE + 1, "Restarting critical mandates");

        // Cast Vote should work again
        uint16[] memory slates = slateRegistry.getSlates(electionId);
        vm.prank(alice);
        powers.request(voteId, abi.encode(electionId, alice, slates), NONCE, "Voting after restart");
        assertTrue(slateRegistry.hasUserVoted(alice, electionId), "alice should have voted after restart");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         HELPERS
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
