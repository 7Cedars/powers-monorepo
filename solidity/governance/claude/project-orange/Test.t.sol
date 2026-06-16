// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Run with: forge test --match-contract ProjectOrange_test -vvv
// Requires: ARB_SEPOLIA_RPC_URL set in .env or environment

import { Test } from "forge-std/Test.sol";

import { Powers } from "@src/Powers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Mandate } from "@src/Mandate.sol";
import { IMandate } from "@src/interfaces/IMandate.sol";
import { Deploy } from "./Deploy.s.sol";

contract ProjectOrange_test is Test {
    // ── Contracts ──────────────────────────────────────────────────────────
    Powers powers;

    // ── Roles ──────────────────────────────────────────────────────────────
    uint256 constant ADMIN_ROLE  = 0;
    uint256 constant MEMBER_ROLE = 1;

    // ── Pre-assigned Member addresses ──────────────────────────────────────
    address constant MEMBER_1 = 0x3F46F636F78929a4336de0a435E3930092900f06;
    address constant MEMBER_2 = 0xa221eB405d87B624be08fAbf949F05D19C765f68;
    address constant MEMBER_3 = 0x3cc18745C907979BdF19e6F2B5f243416eeaBba1;

    // ── Test accounts ──────────────────────────────────────────────────────
    // Note: this test contract (address(this)) is the Admin because it calls deploy.run()
    address publicUser = makeAddr("publicUser");
    address recipient  = makeAddr("recipient");

    uint256 constant NONCE = 1;

    uint256 fork;

    function setUp() public {
        fork = vm.createFork(vm.envString("ARB_SEPOLIA_RPC_URL"));
        vm.selectFork(fork);

        vm.label(MEMBER_1, "MEMBER_1");
        vm.label(MEMBER_2, "MEMBER_2");
        vm.label(MEMBER_3, "MEMBER_3");
        vm.label(publicUser, "publicUser");
        vm.label(recipient, "recipient");
        vm.label(address(this), "testAdmin");

        // This contract is the broadcaster inside deploy.run() (no prank - test contract is msg.sender)
        // It must hold ETH for the 0.05 ETH paymaster seed
        vm.deal(address(this), 1 ether);

        Deploy deployer = new Deploy();
        powers = deployer.run();
        // The test contract is now the Admin (role 0)

        // Run the initial setup mandate (allowedRole = anyone)
        // Assigns role labels, pre-assigns the three Members, configures treasury and paymaster,
        // then revokes mandate 1 so it cannot be reused.
        powers.request(1, abi.encode(), 0, "Initial Setup");

        // Fund the Powers treasury so ETH transfers can be tested
        vm.deal(address(powers), 2 ether);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         DEPLOYMENT CHECKS
    ///////////////////////////////////////////////////////////////////////////

    function test_deployment_membersAssigned() public view {
        assertTrue(powers.hasRoleSince(MEMBER_1, MEMBER_ROLE) > 0, "MEMBER_1 not assigned");
        assertTrue(powers.hasRoleSince(MEMBER_2, MEMBER_ROLE) > 0, "MEMBER_2 not assigned");
        assertTrue(powers.hasRoleSince(MEMBER_3, MEMBER_ROLE) > 0, "MEMBER_3 not assigned");
        assertTrue(powers.hasRoleSince(address(this), ADMIN_ROLE) > 0, "test contract not Admin");
    }

    function test_deployment_roleLabels() public view {
        assertEq(powers.getRoleLabel(ADMIN_ROLE),              "Admin");
        assertEq(powers.getRoleLabel(MEMBER_ROLE),             "Member");
        assertEq(powers.getRoleLabel(type(uint256).max),       "Public");
    }

    /// @notice Verify that mandate pairs that use StatementOfIntent on both sides share identical inputParams.
    ///   The Execute Funding mandate (OpenAction) is intentionally excluded: it hardcodes 3 ABI params
    ///   rather than the 4 human-readable labels used in the proposal/vote/veto steps. The actionId chain
    ///   still works at runtime because ABI decoding of a 4-field calldata as 3 fields is backward-compatible.
    function test_deployment_inputParamsDependencies() public view {
        uint16 counter = powers.getMandateCounter();
        for (uint16 mid = 1; mid < counter; mid++) {
            (address mAddr,, bool active) = powers.getAdoptedMandate(mid);
            if (!active) continue;
            string memory childDesc = IMandate(mAddr).getNameDescription(address(powers), mid);
            // Skip OpenAction mandate - it hardcodes 3 ABI params and intentionally differs from parent
            if (keccak256(abi.encodePacked(childDesc)) == keccak256(abi.encodePacked("Execute Funding: Transfer approved funds from the treasury to the nominated recipient."))) continue;
            PowersTypes.Conditions memory cond = powers.getConditions(mid);
            if (cond.needFulfilled > 0) {
                (address parentAddr,,) = powers.getAdoptedMandate(cond.needFulfilled);
                bytes memory childParams  = Mandate(mAddr).getInputParams(address(powers), mid);
                bytes memory parentParams = Mandate(parentAddr).getInputParams(address(powers), cond.needFulfilled);
                assertEq(
                    keccak256(childParams), keccak256(parentParams),
                    string.concat("InputParams mismatch: ", childDesc)
                );
            }
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    //              FLOW 1: FUND A PROJECT - happy path
    ///////////////////////////////////////////////////////////////////////////
    // Submits a proposal, all three Members vote FOR, no veto is cast, and
    // the funds are transferred to the recipient after the execution timelock.

    function test_fundingFlow_happyPath() public {
        address[] memory targets   = new address[](1);
        targets[0] = recipient;
        uint256[] memory values    = new uint256[](1);
        values[0] = 0.1 ether;
        bytes[]   memory calldatas = new bytes[](1);
        calldatas[0] = "";
        string memory description  = "Buy orange futures on behalf of the treasury";

        bytes memory callData_ = abi.encode(targets, values, calldatas, description);

        uint16 proposeId = _findMandate("Propose Funding: Anyone can submit a funding request for an orange project. Provide recipient, amount, calldata, and a description.");
        uint16 voteId    = _findMandate("Vote to Approve Funding: Members vote unanimously to approve a submitted funding proposal.");
        uint16 executeId = _findMandate("Execute Funding: Transfer approved funds from the treasury to the nominated recipient.");

        // Step 1 - public user submits the funding request
        vm.prank(publicUser);
        powers.request(proposeId, callData_, NONCE, string.concat("Propose: ", description));

        // Step 2a - MEMBER_1 opens the member vote
        vm.prank(MEMBER_1);
        uint256 voteActionId = powers.propose(voteId, callData_, NONCE, string.concat("Vote: ", description));

        // Step 2b - all three Members vote FOR (unanimity required)
        vm.prank(MEMBER_1);
        powers.castVote(voteActionId, 1);
        vm.prank(MEMBER_2);
        powers.castVote(voteActionId, 1);
        vm.prank(MEMBER_3);
        powers.castVote(voteActionId, 1);

        // Roll past the 5-minute voting window
        uint32 votingPeriod = powers.getConditions(voteId).votingPeriod;
        vm.roll(block.number + votingPeriod + 1);

        // Step 2c - finalize the vote
        vm.prank(MEMBER_1);
        powers.request(voteId, callData_, NONCE, string.concat("Finalize vote: ", description));

        // Step 4a - propose the execute action to start the timelock (propose() is required
        // for mandates with timelock > 0, even when there is no voting period)
        vm.prank(MEMBER_1);
        powers.propose(executeId, callData_, NONCE, string.concat("Start timelock: ", description));

        // Roll past the 10-minute execution timelock
        uint32 timelockPeriod = powers.getConditions(executeId).timelock;
        vm.roll(block.number + timelockPeriod + 1);

        // Step 4b - execute the funds transfer after the timelock expires
        uint256 balanceBefore = recipient.balance;
        vm.prank(MEMBER_1);
        powers.request(executeId, callData_, NONCE, string.concat("Execute: ", description));

        assertGt(recipient.balance, balanceBefore, "Recipient should have received ETH");
        assertEq(recipient.balance - balanceBefore, 0.1 ether, "Recipient should have received exactly 0.1 ETH");
    }

    ///////////////////////////////////////////////////////////////////////////
    //              FLOW 1: FUND A PROJECT - admin veto blocks execution
    ///////////////////////////////////////////////////////////////////////////
    // Identical to happy path up to vote finalization, but the Admin (this contract)
    // casts a veto. The execute mandate must revert because needNotFulfilled is violated.

    function test_fundingFlow_adminVetoBlocksExecution() public {
        address[] memory targets   = new address[](1);
        targets[0] = recipient;
        uint256[] memory values    = new uint256[](1);
        values[0] = 0.5 ether;
        bytes[]   memory calldatas = new bytes[](1);
        calldatas[0] = "";
        string memory description  = "Suspicious orange scheme - should be vetoed";

        bytes memory callData_ = abi.encode(targets, values, calldatas, description);

        uint16 proposeId = _findMandate("Propose Funding: Anyone can submit a funding request for an orange project. Provide recipient, amount, calldata, and a description.");
        uint16 voteId    = _findMandate("Vote to Approve Funding: Members vote unanimously to approve a submitted funding proposal.");
        uint16 vetoId    = _findMandate("Admin Veto Funding: Admin blocks execution of an approved funding proposal.");
        uint16 executeId = _findMandate("Execute Funding: Transfer approved funds from the treasury to the nominated recipient.");

        // Steps 1-2: submit and vote
        vm.prank(publicUser);
        powers.request(proposeId, callData_, NONCE, string.concat("Propose: ", description));

        vm.prank(MEMBER_1);
        uint256 voteActionId = powers.propose(voteId, callData_, NONCE, string.concat("Vote: ", description));

        vm.prank(MEMBER_1);
        powers.castVote(voteActionId, 1);
        vm.prank(MEMBER_2);
        powers.castVote(voteActionId, 1);
        vm.prank(MEMBER_3);
        powers.castVote(voteActionId, 1);

        uint32 votingPeriod = powers.getConditions(voteId).votingPeriod;
        vm.roll(block.number + votingPeriod + 1);

        vm.prank(MEMBER_1);
        powers.request(voteId, callData_, NONCE, string.concat("Finalize vote: ", description));

        // Admin (this contract) casts veto - no prank needed, this contract is the Admin
        powers.request(vetoId, callData_, NONCE, string.concat("Admin veto: ", description));

        // Propose execute must revert (needNotFulfilled check fails because veto was cast)
        vm.prank(MEMBER_1);
        vm.expectRevert();
        powers.propose(executeId, callData_, NONCE, string.concat("Start timelock: ", description));

        assertEq(recipient.balance, 0, "Recipient should not have received any ETH");
    }

    ///////////////////////////////////////////////////////////////////////////
    //              FLOW 1: FUND A PROJECT - one AGAINST vote kills proposal
    ///////////////////////////////////////////////////////////////////////////
    // If even one Member votes AGAINST, the succeedAt=100 threshold is not met
    // and the vote finalization must revert.

    function test_fundingFlow_oneAgainstVoteKillsProposal() public {
        address[] memory targets   = new address[](1);
        targets[0] = recipient;
        uint256[] memory values    = new uint256[](1);
        values[0] = 0.1 ether;
        bytes[]   memory calldatas = new bytes[](1);
        calldatas[0] = "";
        string memory description  = "Controversial orange idea";

        bytes memory callData_ = abi.encode(targets, values, calldatas, description);

        uint16 proposeId = _findMandate("Propose Funding: Anyone can submit a funding request for an orange project. Provide recipient, amount, calldata, and a description.");
        uint16 voteId    = _findMandate("Vote to Approve Funding: Members vote unanimously to approve a submitted funding proposal.");

        vm.prank(publicUser);
        powers.request(proposeId, callData_, NONCE, string.concat("Propose: ", description));

        vm.prank(MEMBER_1);
        uint256 voteActionId = powers.propose(voteId, callData_, NONCE, string.concat("Vote: ", description));

        // MEMBER_1 and MEMBER_2 vote FOR, but MEMBER_3 votes AGAINST
        vm.prank(MEMBER_1);
        powers.castVote(voteActionId, 1);
        vm.prank(MEMBER_2);
        powers.castVote(voteActionId, 1);
        vm.prank(MEMBER_3);
        powers.castVote(voteActionId, 0); // Against

        uint32 votingPeriod = powers.getConditions(voteId).votingPeriod;
        vm.roll(block.number + votingPeriod + 1);

        // Attempting to finalize a defeated vote must revert
        vm.prank(MEMBER_1);
        vm.expectRevert();
        powers.request(voteId, callData_, NONCE, string.concat("Finalize vote: ", description));
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
