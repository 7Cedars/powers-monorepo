// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "@governance/examples/actions/ActionHelpers.s.sol";

/// @title MandateSandboxActions
/// @notice One propose/execute function pair per governance flow in Mandate Sandbox.
///         Uses findMandateIdInOrg() with the exact nameDescription strings from Deploy.s.sol.
///
/// ─── Flows ──────────────────────────────────────────────────────────────────
///   joinAsMember              — Flow 1: self-select as a Member
///   proposeAction             — Flow 2: Member proposes an action (votingPeriod/quorum/succeedAt)
///   vetoAction                — Flow 2: Admin vetoes a proposed action (needFulfilled)
///   executeAction             — Flow 2: Council executes (needFulfilled/needNotFulfilled/timelock)
///   callThrottled              — Flow 3: public call, gated only by throttleExecution
///   proposeFundPaymaster      — Flow 4: Admin proposes a paymaster top-up
///   executeFundPaymaster      — Flow 4: Admin executes the top-up
///   proposeWithdrawPaymaster  — Flow 4: Admin proposes a paymaster withdrawal
///   executeWithdrawPaymaster  — Flow 4: Admin executes the withdrawal
contract MandateSandboxActions is ActionHelpers {
    ///////////////////////////////////////////////////////////////
    //                    FLOW 1: MEMBERSHIP                     //
    ///////////////////////////////////////////////////////////////

    /// @notice Self-select as a Member. Public, no vote, no dependency.
    function joinAsMember(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg("Join as Member: Self-select as a Member of Mandate Sandbox.", Powers(payable(powers)))
        );

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(), nonce, "Self-select as Member");
        vm.stopBroadcast();
        console2.log("Joined as Member:", vm.addr(privateKeys[0]));
    }

    ///////////////////////////////////////////////////////////////
    //               FLOW 2: OPTIMISTIC EXECUTION                //
    ///////////////////////////////////////////////////////////////

    /// @notice A Member proposes an action and the proposer's key casts a FOR vote.
    function proposeAction(
        address powers,
        address[] memory targetsLocal,
        uint256[] memory valuesLocal,
        bytes[] memory calldatasLocal,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg(
                "Propose Action: A Member proposes an action for the optimistic execution flow.", Powers(payable(powers))
            )
        );

        bytes memory calldata_ = abi.encode(targetsLocal, valuesLocal, calldatasLocal);
        vm.startBroadcast(privateKeys[0]);
        actionId = IPowers(powers).propose(mandateSlots[0], calldata_, nonce, "Propose action");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("Action proposed. Votes for:", forVote, "against:", againstVote);
    }

    /// @notice Admin vetoes a proposed action (instant — no vote required, just needFulfilled).
    function vetoAction(
        address powers,
        address[] memory targetsLocal,
        uint256[] memory valuesLocal,
        bytes[] memory calldatasLocal,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg(
                "Veto Action: Admin vetoes a proposed action before the timelock expires.", Powers(payable(powers))
            )
        );

        bytes memory calldata_ = abi.encode(targetsLocal, valuesLocal, calldatasLocal);
        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], calldata_, nonce, "Veto proposed action");
        vm.stopBroadcast();
        console2.log("Action vetoed by Admin.");
    }

    /// @notice Council executes a proposed action once the timelock has passed and no veto exists.
    function executeAction(
        address powers,
        address[] memory targetsLocal,
        uint256[] memory valuesLocal,
        bytes[] memory calldatasLocal,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg(
                "Execute Action: Council executes an action that was proposed and not vetoed.", Powers(payable(powers))
            )
        );

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(targetsLocal, valuesLocal, calldatasLocal), nonce, "Execute action");
        vm.stopBroadcast();
        console2.log("Action executed by Council.");
    }

    ///////////////////////////////////////////////////////////////
    //                FLOW 3: THROTTLED ACTION                   //
    ///////////////////////////////////////////////////////////////

    /// @notice Call the throttled mandate. Public, no vote, only `throttleExecution` gates repeat calls.
    function callThrottled(address powers, uint256 valueArg, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg(
                "Throttled Call: Anyone can call this, but only once per 10-minute cooldown window.", Powers(payable(powers))
            )
        );

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(valueArg), nonce, "Throttled call");
        vm.stopBroadcast();
        console2.log("Throttled call submitted with value:", valueArg);
    }

    ///////////////////////////////////////////////////////////////
    //               FLOW 4: ACCOUNT ABSTRACTION                 //
    ///////////////////////////////////////////////////////////////

    /// @notice Admin proposes a 0.05 ETH top-up of the paymaster.
    function proposeFundPaymaster(address powers, uint256[] memory privateKeys, uint256 nonce) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg(
                "Propose to Fund Paymaster: Admin proposes an ETH top-up of the PowersPaymaster.", Powers(payable(powers))
            )
        );

        vm.startBroadcast(privateKeys[0]);
        actionId = IPowers(powers).propose(mandateSlots[0], abi.encode(), nonce, "Propose paymaster funding");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("Fund paymaster proposed. Votes for:", forVote);
    }

    /// @notice Admin executes the approved paymaster top-up.
    function executeFundPaymaster(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg("Execute Fund Paymaster: Send 0.05 ETH to the paymaster.", Powers(payable(powers)))
        );

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(), nonce, "Execute paymaster funding");
        vm.stopBroadcast();
        console2.log("Paymaster funded with 0.05 ETH.");
    }

    /// @notice Admin proposes withdrawing ETH from the paymaster.
    function proposeWithdrawPaymaster(
        address powers,
        address withdrawAddress,
        uint256 amount,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg(
                "Propose to Withdraw from Paymaster: Admin proposes withdrawing ETH from the paymaster.",
                Powers(payable(powers))
            )
        );

        bytes memory calldata_ = abi.encode(withdrawAddress, amount);
        vm.startBroadcast(privateKeys[0]);
        actionId = IPowers(powers).propose(mandateSlots[0], calldata_, nonce, "Propose paymaster withdrawal");
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, mandateSlots[0], actionId, privateKeys, nonce, 100);
        console2.log("Withdraw paymaster proposed. Votes for:", forVote);
    }

    /// @notice Admin executes the approved paymaster withdrawal.
    function executeWithdrawPaymaster(
        address powers,
        address withdrawAddress,
        uint256 amount,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        mandateSlots.push(
            findMandateIdInOrg(
                "Execute Withdraw from Paymaster: Withdraw approved ETH amount from the paymaster.", Powers(payable(powers))
            )
        );

        vm.startBroadcast(privateKeys[0]);
        IPowers(powers).request(mandateSlots[0], abi.encode(withdrawAddress, amount), nonce, "Execute paymaster withdrawal");
        vm.stopBroadcast();
        console2.log("Paymaster withdrawal executed to:", withdrawAddress);
    }
}
