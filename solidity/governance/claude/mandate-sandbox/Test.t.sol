// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

// Run with: forge test --match-contract MandateSandbox_test -vvv

import { Test, console2 } from "forge-std/Test.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { Configurations } from "@script/Configurations.s.sol";

import { Deploy } from "./Deploy.s.sol";
import { MandateSandboxRunners } from "./Runners.s.sol";

/// @title MandateSandbox_test
/// @notice Fork-based tests for Mandate Sandbox, covering all eight `Conditions` fields.
///
/// Prerequisites:
///   export SEPOLIA_RPC_URL=<your-url>
contract MandateSandbox_test is Test {
    Configurations helperConfig;
    Deploy deploy;
    address powers;
    MandateSandboxRunners runners;

    uint256 constant ADMIN_KEY  = 1;
    uint256 constant MEMBER_KEY = 2;

    address testAdmin; // also holds Council, for simplicity
    address testMember;
    uint256[] adminKeys;
    uint256[] councilKeys;
    uint256[] memberKeys;

    function setUp() public {
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));
        helperConfig = new Configurations();

        testAdmin  = vm.addr(ADMIN_KEY);
        testMember = vm.addr(MEMBER_KEY);
        adminKeys  = [ADMIN_KEY];
        councilKeys = [ADMIN_KEY];
        memberKeys = [MEMBER_KEY];

        vm.deal(testAdmin,  10 ether);
        vm.deal(testMember, 10 ether);
        vm.deal(address(this), 1 ether);

        deploy = new Deploy();
        powers = address(deploy.run());

        runners = new MandateSandboxRunners();

        // Run initial setup (public — anyone can call it; the deploy script
        // assigns Admin/Council to the deployer, i.e. this test contract).
        runners.runInitialSetup(powers, memberKeys, block.timestamp);

        // Force-assign Admin and Council to synthetic EOAs so the Runners
        // (which use vm.startBroadcast(privateKey)) can exercise those roles.
        // Bypasses governance — test setup only.
        vm.startPrank(powers);
        IPowers(powers).assignRole(0, testAdmin);
        IPowers(powers).assignRole(2, testAdmin);
        vm.stopPrank();
    }

    ///////////////////////////////////////////////////////////////////////////
    //                         TEST: INITIAL STATE
    ///////////////////////////////////////////////////////////////////////////

    function test_initialState() public view {
        assertEq(Powers(payable(powers)).getRoleLabel(1), "Member", "Role 1 should be Member");
        assertEq(Powers(payable(powers)).getRoleLabel(2), "Council", "Role 2 should be Council");
        assertTrue(Powers(payable(powers)).hasRoleSince(testAdmin, 0) > 0, "testAdmin should hold Admin");
        assertTrue(Powers(payable(powers)).hasRoleSince(testAdmin, 2) > 0, "testAdmin should hold Council");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                  TEST: FLOW 1 — MEMBERSHIP (allowedRole only)
    ///////////////////////////////////////////////////////////////////////////

    function test_joinAsMember() public {
        runners.joinAsMember(powers, memberKeys, block.timestamp + 1);
        assertTrue(Powers(payable(powers)).hasRoleSince(testMember, 1) > 0, "testMember should hold Member");
    }

    ///////////////////////////////////////////////////////////////////////////
    //          TEST: FLOW 2 — OPTIMISTIC EXECUTION (happy path)
    ///////////////////////////////////////////////////////////////////////////
    // votingPeriod + quorum + succeedAt (propose) -> needFulfilled (veto, absent)
    // -> needFulfilled + needNotFulfilled + timelock (execute)

    function test_optimisticExecution_HappyPath() public {
        uint256 nonce = block.timestamp + 10;

        runners.joinAsMember(powers, memberKeys, nonce);

        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = _harmlessAction();

        runners.runOptimisticExecutionFlow(powers, targets, values, calldatas, memberKeys, councilKeys, nonce);

        // Voting period (10 min) not yet over — should still be pending.
        uint16 executeId = runners.findMandateIdInOrg(
            "Execute Action: Council executes an action that was proposed and not vetoed.", Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(targets, values, calldatas);
        (,, uint48 executedAtBefore,,,,) = IPowers(powers).getActionData(runners.calculateActionId(executeId, calldata_, nonce));
        assertEq(executedAtBefore, 0, "Should not execute before voting period and timelock have passed");

        // Advance past the 20-minute timelock (which exceeds the 10-minute voting period).
        vm.roll(block.number + minutesToBlocks(21, helperConfig.getBlocksPerHour(block.chainid)));

        runners.runOptimisticExecutionFlow(powers, targets, values, calldatas, memberKeys, councilKeys, nonce);

        (,, uint48 executedAtAfter,,,,) = IPowers(powers).getActionData(runners.calculateActionId(executeId, calldata_, nonce));
        assertTrue(executedAtAfter > 0, "Action should have executed after timelock passed with no veto");
    }

    ///////////////////////////////////////////////////////////////////////////
    //          TEST: FLOW 2 — OPTIMISTIC EXECUTION blocked by veto
    ///////////////////////////////////////////////////////////////////////////
    // needNotFulfilled: execution must revert once the veto mandate has fired.

    function test_optimisticExecution_BlockedByVeto() public {
        uint256 nonce = block.timestamp + 20;

        runners.joinAsMember(powers, memberKeys, nonce);
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = _harmlessAction();

        runners.proposeAction(powers, targets, values, calldatas, memberKeys, nonce);
        runners.vetoAction(powers, targets, values, calldatas, adminKeys, nonce);

        // Advance past the 20-minute timelock.
        vm.roll(block.number + minutesToBlocks(21, helperConfig.getBlocksPerHour(block.chainid)));

        vm.expectRevert();
        runners.executeAction(powers, targets, values, calldatas, councilKeys, nonce);
    }

    ///////////////////////////////////////////////////////////////////////////
    //              TEST: FLOW 3 — THROTTLED ACTION (throttleExecution)
    ///////////////////////////////////////////////////////////////////////////

    function test_throttledAction_CooldownEnforced() public {
        uint256 nonce = block.timestamp + 30;

        // First call succeeds.
        runners.callThrottled(powers, 42, memberKeys, nonce);

        // Second call, immediately after, must fail — cooldown still active.
        vm.expectRevert();
        runners.callThrottled(powers, 43, memberKeys, nonce + 1);

        // Advance past the 10-minute cooldown — third call succeeds.
        vm.roll(block.number + minutesToBlocks(11, helperConfig.getBlocksPerHour(block.chainid)));
        runners.callThrottled(powers, 44, memberKeys, nonce + 2);
    }

    ///////////////////////////////////////////////////////////////////////////
    //          TEST: FLOW 4 — ACCOUNT ABSTRACTION (fund + withdraw)
    ///////////////////////////////////////////////////////////////////////////

    function test_accountAbstraction_FundAndWithdraw() public {
        uint256 fundNonce = block.timestamp + 40;
        uint256 withdrawNonce = block.timestamp + 41;

        runners.runFundPaymasterFlow(powers, adminKeys, fundNonce);

        uint16 fundExecuteId =
            runners.findMandateIdInOrg("Execute Fund Paymaster: Send 0.05 ETH to the paymaster.", Powers(payable(powers)));
        (,, uint48 fundExecutedAtBefore,,,,) =
            IPowers(powers).getActionData(runners.calculateActionId(fundExecuteId, abi.encode(), fundNonce));
        assertEq(fundExecutedAtBefore, 0, "Fund should not execute before vote closes");

        // Advance past the 5-minute voting window.
        vm.roll(block.number + minutesToBlocks(6, helperConfig.getBlocksPerHour(block.chainid)));
        runners.runFundPaymasterFlow(powers, adminKeys, fundNonce);

        (,, uint48 fundExecutedAtAfter,,,,) =
            IPowers(powers).getActionData(runners.calculateActionId(fundExecuteId, abi.encode(), fundNonce));
        assertTrue(fundExecutedAtAfter > 0, "Fund paymaster should have executed");

        // Now withdraw 0.05 ETH back out to testMember.
        runners.runWithdrawPaymasterFlow(powers, testMember, 0.05 ether, adminKeys, withdrawNonce);
        vm.roll(block.number + minutesToBlocks(6, helperConfig.getBlocksPerHour(block.chainid)));
        runners.runWithdrawPaymasterFlow(powers, testMember, 0.05 ether, adminKeys, withdrawNonce);

        uint16 withdrawExecuteId = runners.findMandateIdInOrg(
            "Execute Withdraw from Paymaster: Withdraw approved ETH amount from the paymaster.", Powers(payable(powers))
        );
        (,, uint48 withdrawExecutedAt,,,,) = IPowers(powers).getActionData(
            runners.calculateActionId(withdrawExecuteId, abi.encode(testMember, uint256(0.05 ether)), withdrawNonce)
        );
        assertTrue(withdrawExecutedAt > 0, "Withdraw from paymaster should have executed");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                           TEST HELPERS
    ///////////////////////////////////////////////////////////////////////////

    /// @notice A harmless, idempotent action used to exercise Flow 2 without side effects:
    ///         re-labels role 1 with the same label it already has.
    function _harmlessAction()
        internal
        view
        returns (address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        targets = new address[](1);
        values = new uint256[](1);
        calldatas = new bytes[](1);
        targets[0] = powers;
        values[0] = 0;
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Member", "");
    }

    function minutesToBlocks(uint256 minutes_, uint256 blocksPerHour) internal pure returns (uint32) {
        return uint32((minutes_ * blocksPerHour) / 60);
    }
}
