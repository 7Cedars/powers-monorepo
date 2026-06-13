// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Stateless checkpoint runners - advance a governance flow as far as current
// on-chain state allows. Designed for automated or bot-driven execution.
//
// Usage example:
//   forge script governance/claude/project-orange/Runners.s.sol:ProjectOrangeRunners \
//     --sig "runFundingFlow(address,address[],uint256[],bytes[],string,uint256)" \
//     $POWERS_ADDRESS "[0xRECIPIENT]" "[1000000000000000000]" "['0x']" "Buy orange futures" 0 \
//     --rpc-url $ARB_SEPOLIA_RPC_URL --account $DEPLOYER_ACCOUNT --broadcast

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { ActionHelpers } from "@governance/examples/actions/ActionHelpers.s.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { Powers } from "@src/Powers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { ProjectOrangeActions } from "./Actions.s.sol";

contract ProjectOrangeRunners is ActionHelpers {
    ////////////////////////////////////////////////////////////////////////////
    //                        FLOW 1: FUND A PROJECT                          //
    ////////////////////////////////////////////////////////////////////////////
    /// @notice Stateless runner for the Fund a Project flow (Steps 1-4).
    ///   Each call inspects on-chain state and advances the flow to the next
    ///   available checkpoint. Call repeatedly to advance through all steps.
    ///
    ///   Note: vote casting (Step 2b) is intentionally not automated - each Member
    ///   must cast their vote individually using castVoteOnFunding() in Actions.s.sol.
    function runFundingFlow(
        address powers,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        uint256 nonce
    ) external {
        bytes memory callData_ = abi.encode(targets, values, calldatas, description);

        uint16 proposeId = findMandateIdInOrg(
            "Propose Funding: Anyone can submit a funding request for an orange project. Provide recipient, amount, calldata, and a description.",
            Powers(payable(powers))
        );
        uint16 voteId = findMandateIdInOrg(
            "Vote to Approve Funding: Members vote unanimously to approve a submitted funding proposal.",
            Powers(payable(powers))
        );
        uint16 vetoId = findMandateIdInOrg(
            "Admin Veto Funding: Admin blocks execution of an approved funding proposal.",
            Powers(payable(powers))
        );
        uint16 executeId = findMandateIdInOrg(
            "Execute Funding: Transfer approved funds from the treasury to the nominated recipient.",
            Powers(payable(powers))
        );

        uint256 proposeActionId = calculateActionId(proposeId, callData_, nonce);
        uint256 voteActionId    = calculateActionId(voteId,    callData_, nonce);
        uint256 vetoActionId    = calculateActionId(vetoId,    callData_, nonce);
        uint256 executeActionId = calculateActionId(executeId, callData_, nonce);

        PowersTypes.ActionState proposeState = Powers(payable(powers)).getActionState(proposeActionId);
        PowersTypes.ActionState voteState    = Powers(payable(powers)).getActionState(voteActionId);
        PowersTypes.ActionState vetoState    = Powers(payable(powers)).getActionState(vetoActionId);
        PowersTypes.ActionState executeState = Powers(payable(powers)).getActionState(executeActionId);

        // Step 1 - submit the proposal if it has not been submitted yet.
        if (proposeState == PowersTypes.ActionState.NonExistent) {
            console2.log("[Runner] Step 1: Submitting funding proposal...");
            vm.startBroadcast();
            IPowers(powers).request(proposeId, callData_, nonce, string.concat("Propose: ", description));
            vm.stopBroadcast();
            console2.log("[Runner] Proposal submitted. Wait for a Member to open the vote.");
            return;
        }

        if (proposeState == PowersTypes.ActionState.Fulfilled) {
            console2.log("[Runner] Proposal already submitted.");
        }

        // Step 2a - open the vote if the proposal is submitted and the vote has not started.
        if (voteState == PowersTypes.ActionState.NonExistent) {
            console2.log("[Runner] Step 2a: Opening Member vote...");
            vm.startBroadcast();
            IPowers(powers).propose(voteId, callData_, nonce, string.concat("Vote: ", description));
            vm.stopBroadcast();
            PowersTypes.Conditions memory cond = Powers(payable(powers)).getConditions(voteId);
            console2.log("[Runner] Vote opened. Voting period blocks:", cond.votingPeriod);
            console2.log("[Runner] All three Members must cast their vote before the period ends.");
            return;
        }

        // During voting window - wait for all members to vote.
        if (voteState == PowersTypes.ActionState.Active) {
            console2.log("[Runner] Vote is open. Waiting for all Members to vote.");
            console2.log("[Runner] After voting closes, call this runner again to finalize.");
            return;
        }

        // Vote failed to reach unanimity.
        if (voteState == PowersTypes.ActionState.Defeated) {
            console2.log("[Runner] Vote did not reach unanimity (quorum or succeedAt not met). Flow ends here.");
            return;
        }

        // Vote period ended with success - finalize it.
        if (voteState == PowersTypes.ActionState.Succeeded) {
            console2.log("[Runner] Step 2c: Finalizing vote...");
            vm.startBroadcast();
            IPowers(powers).request(voteId, callData_, nonce, string.concat("Finalize vote: ", description));
            vm.stopBroadcast();
            console2.log("[Runner] Vote finalized. Step 4 is now available (check for admin veto first).");
            return;
        }

        if (voteState == PowersTypes.ActionState.Fulfilled) {
            console2.log("[Runner] Vote passed and finalized.");
        }

        // Check if a veto has been cast.
        if (vetoState == PowersTypes.ActionState.Fulfilled) {
            console2.log("[Runner] Admin has cast a veto. Execution is permanently blocked. Flow ends here.");
            return;
        }

        // Step 4 - start the timelock (first call) or execute (second call after timelock).
        if (executeState == PowersTypes.ActionState.NonExistent) {
            console2.log("[Runner] Step 4 (start timelock): Proposing execute to start the timelock...");
            vm.startBroadcast();
            IPowers(powers).propose(executeId, callData_, nonce, string.concat("Start timelock: ", description));
            vm.stopBroadcast();
            console2.log("[Runner] Timelock started. Call this runner again after the timelock expires to transfer funds.");
            return;
        }

        if (executeState == PowersTypes.ActionState.Requested) {
            console2.log("[Runner] Step 4 (execute): Timelock is active - attempting to execute...");
            vm.startBroadcast();
            try IPowers(powers).request(executeId, callData_, nonce, string.concat("Execute: ", description)) {
                console2.log("[Runner] Funds transferred. Flow 1 complete.");
            } catch {
                console2.log("[Runner] Execute not yet ready - timelock has not elapsed. Try again later.");
            }
            vm.stopBroadcast();
            return;
        }

        if (executeState == PowersTypes.ActionState.Fulfilled) {
            console2.log("[Runner] Flow 1 complete - funds have been transferred.");
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    //                     FLOW 3: FUND PAYMASTER                             //
    ////////////////////////////////////////////////////////////////////////////
    /// @notice Stateless runner for the Fund Paymaster flow (Steps 1-2).
    function runFundPaymaster(address powers, uint256 nonce) external {
        uint16 proposeId = findMandateIdInOrg(
            "Propose to Fund Paymaster: Admin signals intent to top up the gasless paymaster.",
            Powers(payable(powers))
        );
        uint16 executeId = findMandateIdInOrg(
            "Execute Fund Paymaster: Send 0.05 ETH to the paymaster deposit.",
            Powers(payable(powers))
        );

        uint256 proposeActionId = calculateActionId(proposeId, abi.encode(), nonce);
        uint256 executeActionId = calculateActionId(executeId, abi.encode(), nonce);

        PowersTypes.ActionState proposeState = Powers(payable(powers)).getActionState(proposeActionId);
        PowersTypes.ActionState executeState = Powers(payable(powers)).getActionState(executeActionId);

        if (proposeState == PowersTypes.ActionState.NonExistent) {
            console2.log("[Runner] Proposing paymaster top-up...");
            vm.startBroadcast();
            IPowers(powers).request(proposeId, abi.encode(), nonce, "Fund paymaster");
            vm.stopBroadcast();
            console2.log("[Runner] Proposal submitted.");
            return;
        }

        if (executeState != PowersTypes.ActionState.Fulfilled) {
            console2.log("[Runner] Executing paymaster deposit...");
            vm.startBroadcast();
            IPowers(powers).request(executeId, abi.encode(), nonce, "Execute fund paymaster");
            vm.stopBroadcast();
            console2.log("[Runner] Paymaster funded.");
            return;
        }

        console2.log("[Runner] Fund Paymaster flow already complete for this nonce.");
    }
}
