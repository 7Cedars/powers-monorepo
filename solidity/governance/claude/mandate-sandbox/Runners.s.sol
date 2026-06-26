// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { MandateSandboxActions } from "./Actions.s.sol";

/// @title MandateSandboxRunners
/// @notice Stateless checkpoint runners for Mandate Sandbox.
///
/// Each run*() function reads current on-chain state, advances as far as
/// conditions allow, then stops at the first phase still blocked by a voting
/// window, timelock, or cooldown — logging what it did and what it is
/// waiting for.
///
/// Pass the SAME (nonce, parameters) on every call for a given flow invocation.
/// Use a fresh nonce to start a completely new, independent invocation.
///
/// ─── Runners ──────────────────────────────────────────────────────────────────
///   runInitialSetup            — execute setup mandate (first call after deploy)
///   runOptimisticExecutionFlow — propose -> veto window -> timelock -> execute
///   runCallThrottled           — attempt the throttled call; logs if cooldown active
///   runFundPaymasterFlow       — propose -> vote window -> execute paymaster top-up
///   runWithdrawPaymasterFlow   — propose -> vote window -> execute paymaster withdrawal
contract MandateSandboxRunners is MandateSandboxActions {
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
        uint16 setupId =
            findMandateIdInOrg("Initial Setup: Assign role labels and revokes itself after execution", Powers(payable(powers)));
        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(setupId, abi.encode(), nonce, "Executing initial setup");
        vm.stopBroadcast();
        console2.log("Runner: initial setup complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                    OPTIMISTIC EXECUTION FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Member proposes an action.
    //   ⏳ 10-minute voting window (votingPeriod)
    //   ⏳ Admin may veto at any point before the executor's timelock expires.
    //   ⏳ 20-minute timelock from proposal (> votingPeriod, per the veto-timing rule)
    //   [1] Council executes, unless an Admin veto was registered.

    /// @notice Advance the optimistic execution flow as far as current state allows.
    function runOptimisticExecutionFlow(
        address powers,
        address[] memory targetsLocal,
        uint256[] memory valuesLocal,
        bytes[] memory calldatasLocal,
        uint256[] memory memberKeys,
        uint256[] memory councilKeys,
        uint256 nonce
    ) public {
        uint16 proposeId = findMandateIdInOrg(
            "Propose Action: A Member proposes an action for the optimistic execution flow.", Powers(payable(powers))
        );
        uint16 vetoId = findMandateIdInOrg(
            "Veto Action: Admin vetoes a proposed action before the timelock expires.", Powers(payable(powers))
        );
        uint16 executeId = findMandateIdInOrg(
            "Execute Action: Council executes an action that was proposed and not vetoed.", Powers(payable(powers))
        );

        bytes memory calldata_ = abi.encode(targetsLocal, valuesLocal, calldatasLocal);

        (,, uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, calldata_, nonce));
        if (executedAt > 0) {
            console2.log("Runner: optimistic execution flow already complete.");
            return;
        }

        (, uint48 proposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: submitting action proposal.");
            proposeAction(powers, targetsLocal, valuesLocal, calldatasLocal, memberKeys, nonce);
            console2.log("Runner: pausing — 10-minute voting window now open.");
            return;
        }

        (,, uint48 vetoExecutedAt,,,,) = IPowers(powers).getActionData(calculateActionId(vetoId, calldata_, nonce));
        if (vetoExecutedAt > 0) {
            console2.log("Runner: blocked — action was vetoed by Admin.");
            return;
        }

        (,, uint256 voteEnd,,,,) = IPowers(powers).getActionVoteData(calculateActionId(proposeId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — proposal vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        if (!_isTimelockPast(powers, executeId, proposedAt)) {
            console2.log("Runner: pausing — waiting for execution timelock.");
            _logTimelockRemaining(powers, executeId, proposedAt);
            return;
        }

        console2.log("Runner [1]: executing action via Council.");
        executeAction(powers, targetsLocal, valuesLocal, calldatasLocal, councilKeys, nonce);
        console2.log("Runner: optimistic execution flow complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                       THROTTLED ACTION RUNNER
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Attempt the throttled call. Logs whether it succeeded or the cooldown is still active.
    function runCallThrottled(address powers, uint256 valueArg, uint256[] memory privateKeys, uint256 nonce) public {
        uint16 throttledId = findMandateIdInOrg(
            "Throttled Call: Anyone can call this, but only once per 10-minute cooldown window.", Powers(payable(powers))
        );

        if (!IPowers(powers).canCallMandate(vm.addr(privateKeys[0]), throttledId)) {
            console2.log("Runner: pausing — throttle cooldown still active.");
            return;
        }

        console2.log("Runner: calling throttled mandate.");
        callThrottled(powers, valueArg, privateKeys, nonce);
        console2.log("Runner: throttled call complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                      FUND PAYMASTER FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Admin proposes a paymaster top-up (5-minute vote).
    //   [1] Admin executes once the vote has closed.

    /// @notice Advance the fund-paymaster flow as far as current state allows.
    function runFundPaymasterFlow(address powers, uint256[] memory adminKeys, uint256 nonce) public {
        uint16 proposeId = findMandateIdInOrg(
            "Propose to Fund Paymaster: Admin proposes an ETH top-up of the PowersPaymaster.", Powers(payable(powers))
        );
        uint16 executeId =
            findMandateIdInOrg("Execute Fund Paymaster: Send 0.05 ETH to the paymaster.", Powers(payable(powers)));

        bytes memory calldata_ = abi.encode();

        (,, uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, calldata_, nonce));
        if (executedAt > 0) {
            console2.log("Runner: fund paymaster flow already complete.");
            return;
        }

        (, uint48 proposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: submitting fund-paymaster proposal.");
            proposeFundPaymaster(powers, adminKeys, nonce);
            console2.log("Runner: pausing — 5-minute voting window now open.");
            return;
        }

        (,, uint256 voteEnd,,,,) = IPowers(powers).getActionVoteData(calculateActionId(proposeId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        console2.log("Runner [1]: executing paymaster funding.");
        executeFundPaymaster(powers, adminKeys, nonce);
        console2.log("Runner: fund paymaster flow complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                   WITHDRAW PAYMASTER FLOW RUNNER
    ///////////////////////////////////////////////////////////////////////////
    //
    // Phases:
    //   [0] Admin proposes a withdrawal (5-minute vote).
    //   [1] Admin executes once the vote has closed.

    /// @notice Advance the withdraw-from-paymaster flow as far as current state allows.
    function runWithdrawPaymasterFlow(
        address powers,
        address withdrawAddress,
        uint256 amount,
        uint256[] memory adminKeys,
        uint256 nonce
    ) public {
        uint16 proposeId = findMandateIdInOrg(
            "Propose to Withdraw from Paymaster: Admin proposes withdrawing ETH from the paymaster.",
            Powers(payable(powers))
        );
        uint16 executeId = findMandateIdInOrg(
            "Execute Withdraw from Paymaster: Withdraw approved ETH amount from the paymaster.", Powers(payable(powers))
        );

        bytes memory calldata_ = abi.encode(withdrawAddress, amount);

        (,, uint48 executedAt,,,,) = IPowers(powers).getActionData(calculateActionId(executeId, calldata_, nonce));
        if (executedAt > 0) {
            console2.log("Runner: withdraw paymaster flow already complete.");
            return;
        }

        (, uint48 proposedAt,,,,,) = IPowers(powers).getActionData(calculateActionId(proposeId, calldata_, nonce));
        if (proposedAt == 0) {
            console2.log("Runner [0]: submitting withdraw-paymaster proposal.");
            proposeWithdrawPaymaster(powers, withdrawAddress, amount, adminKeys, nonce);
            console2.log("Runner: pausing — 5-minute voting window now open.");
            return;
        }

        (,, uint256 voteEnd,,,,) = IPowers(powers).getActionVoteData(calculateActionId(proposeId, calldata_, nonce));
        if (block.number <= voteEnd) {
            console2.log("Runner: pausing — vote still open.");
            console2.log("Runner: blocks remaining:", voteEnd - block.number);
            return;
        }

        console2.log("Runner [1]: executing paymaster withdrawal.");
        executeWithdrawPaymaster(powers, withdrawAddress, amount, adminKeys, nonce);
        console2.log("Runner: withdraw paymaster flow complete.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                        SHARED STATE PREDICATES
    ///////////////////////////////////////////////////////////////////////////

    function _isSetupComplete(address powers) internal view returns (bool) {
        return bytes(Powers(payable(powers)).getRoleLabel(2)).length > 0;
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
}
