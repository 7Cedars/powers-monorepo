// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Run individual steps, e.g.:
//   forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
//     --sig "submitFundingProposal(address[],uint256[],bytes[],string,uint256,address)" \
//     "[0xRECIPIENT]" "[1000000000000000000]" "['0x']" "Buy orange futures" 0 $POWERS_ADDRESS \
//     --rpc-url $ARB_SEPOLIA_RPC_URL --account $DEPLOYER_ACCOUNT --broadcast

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { ActionHelpers } from "@governance/examples/actions/ActionHelpers.s.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { Powers } from "@src/Powers.sol";

contract ProjectOrangeActions is ActionHelpers {
    ////////////////////////////////////////////////////////////////////////////
    //                        FLOW 1: FUND A PROJECT                          //
    ////////////////////////////////////////////////////////////////////////////
    // The four steps below correspond to the four mandates in the Fund a Project
    // flow. All four share the same calldata schema (Targets, Values, Calldatas,
    // ProposalDescription) and must be called with identical params + nonce so
    // the on-chain actionId chain links correctly.

    /// @notice Step 1 - Anyone submits a funding request to the organisation.
    ///   Provide the on-chain execution data (who gets what) and a plain-English
    ///   description. The description is recorded permanently on-chain and follows
    ///   the proposal through every subsequent step.
    ///   For a plain ETH transfer: targets=[recipient], values=[amountWei], calldatas=["0x"]
    function submitFundingProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        uint256 nonce,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(targets, values, calldatas, description);
        uint16 mandateId = findMandateIdInOrg(
            "Propose Funding: Anyone can submit a funding request for an orange project. Provide recipient, amount, calldata, and a description.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        uint256 actionId = IPowers(powers).request(mandateId, callData_, nonce, string.concat("Propose: ", description));
        vm.stopBroadcast();

        console2.log("Funding proposal submitted. actionId:", actionId);
        console2.log("  mandateId:", mandateId);
        console2.log("  nonce:", nonce);
    }

    /// @notice Step 2a - A Member opens the vote on a previously submitted proposal.
    ///   Must be called with the same targets/values/calldatas/description/nonce as Step 1.
    ///   Returns the actionId that other Members must pass to castVoteOnFunding().
    function openVoteOnFunding(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        uint256 nonce,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(targets, values, calldatas, description);
        uint16 mandateId = findMandateIdInOrg(
            "Vote to Approve Funding: Members vote unanimously to approve a submitted funding proposal.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        uint256 actionId = IPowers(powers).propose(mandateId, callData_, nonce, string.concat("Vote: ", description));
        vm.stopBroadcast();

        console2.log("Vote opened. actionId:", actionId);
        console2.log("  mandateId:", mandateId);
        console2.log("  Each of the other two Members must now call castVoteOnFunding() with actionId:", actionId);
    }

    /// @notice Step 2b - A Member casts their vote on an open proposal.
    ///   voteOption: 0 = Against, 1 = For, 2 = Abstain
    ///   ALL three Members must vote FOR for the proposal to pass (unanimity).
    function castVoteOnFunding(uint256 actionId, uint8 voteOption, address powers) external {
        vm.startBroadcast();
        IPowers(powers).castVote(actionId, voteOption);
        vm.stopBroadcast();

        string memory voteLabel = voteOption == 1 ? "FOR" : voteOption == 0 ? "AGAINST" : "ABSTAIN";
        console2.log("Vote cast:", voteLabel, "actionId:", actionId);
    }

    /// @notice Step 2c - After the voting period ends, finalize the vote result.
    ///   Must be called with the same calldata and nonce as Steps 1 and 2a.
    ///   If all three Members voted FOR, the proposal passes and Step 4 becomes available.
    function finalizeVoteOnFunding(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        uint256 nonce,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(targets, values, calldatas, description);
        uint16 mandateId = findMandateIdInOrg(
            "Vote to Approve Funding: Members vote unanimously to approve a submitted funding proposal.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        IPowers(powers).request(mandateId, callData_, nonce, string.concat("Finalize vote: ", description));
        vm.stopBroadcast();

        console2.log("Vote finalized for mandateId:", mandateId);
    }

    /// @notice Step 3 (Optional) - Admin issues an emergency veto on an approved proposal.
    ///   Once cast, this permanently blocks execution (Step 4) for this proposal + nonce.
    ///   Must be called by the Admin account before the execution timelock expires.
    function vetoFundingProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        uint256 nonce,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(targets, values, calldatas, description);
        uint16 mandateId = findMandateIdInOrg(
            "Admin Veto Funding: Admin blocks execution of an approved funding proposal.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        uint256 actionId = IPowers(powers).request(mandateId, callData_, nonce, string.concat("Admin veto: ", description));
        vm.stopBroadcast();

        console2.log("Veto cast. actionId:", actionId);
        console2.log("  Execution of this proposal is now permanently blocked.");
    }

    /// @notice Step 4a - Propose the execute action to start the 10-minute timelock.
    ///   For mandates with timelock > 0, propose() is required to start the timelock countdown.
    ///   Reverts immediately if the Admin has cast a veto for this proposal.
    function proposeExecuteFundingProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        uint256 nonce,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(targets, values, calldatas, description);
        uint16 mandateId = findMandateIdInOrg(
            "Execute Funding: Transfer approved funds from the treasury to the nominated recipient.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        IPowers(powers).propose(mandateId, callData_, nonce, string.concat("Start timelock: ", description));
        vm.stopBroadcast();

        console2.log("Execute timelock started for mandateId:", mandateId);
        console2.log("  Call executeFundingProposal() after the 10-minute timelock to transfer funds.");
    }

    /// @notice Step 4b - Execute the funds transfer after the timelock has elapsed.
    ///   Call this after the 10-minute timelock started by proposeExecuteFundingProposal().
    function executeFundingProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        uint256 nonce,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(targets, values, calldatas, description);
        uint16 mandateId = findMandateIdInOrg(
            "Execute Funding: Transfer approved funds from the treasury to the nominated recipient.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        IPowers(powers).request(mandateId, callData_, nonce, string.concat("Execute: ", description));
        vm.stopBroadcast();

        console2.log("Funding transfer executed for mandateId:", mandateId);
    }

    ////////////////////////////////////////////////////////////////////////////
    //                    FLOW 2: GOVERNANCE REFORM                           //
    ////////////////////////////////////////////////////////////////////////////
    // Members can unanimously vote to adopt new mandates, evolving governance
    // capabilities over time without a full redeployment.

    /// @notice Step 1 - Members open a vote to adopt new governance mandates.
    ///   mandates: array of new mandate contract addresses to adopt
    ///   roleIds:  the allowed role for each mandate (must match mandates array length)
    function openVoteOnReform(
        address[] memory mandates,
        uint256[] memory roleIds,
        uint256 nonce,
        string memory description,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(mandates, roleIds);
        uint16 mandateId = findMandateIdInOrg(
            "Propose Governance Reform: Members vote unanimously to adopt new governance mandates.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        uint256 actionId = IPowers(powers).propose(mandateId, callData_, nonce, description);
        vm.stopBroadcast();

        console2.log("Governance reform vote opened. actionId:", actionId);
    }

    /// @notice Step 2 - Execute a governance reform after unanimous approval and timelock.
    ///   Call once to start the timelock; call again after it expires to adopt the new mandates.
    function executeGovernanceReform(
        address[] memory mandates,
        uint256[] memory roleIds,
        uint256 nonce,
        string memory description,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(mandates, roleIds);
        uint16 mandateId = findMandateIdInOrg(
            "Execute Governance Reform: Adopt new mandates after unanimous member approval.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        IPowers(powers).request(mandateId, callData_, nonce, description);
        vm.stopBroadcast();

        console2.log("Governance reform executed for mandateId:", mandateId);
    }

    ////////////////////////////////////////////////////////////////////////////
    //                     FLOW 3: FUND PAYMASTER                             //
    ////////////////////////////////////////////////////////////////////////////
    // Admin tops up the PowersPaymaster so gasless transactions remain available.

    /// @notice Step 1 - Admin signals intent to top up the paymaster.
    function proposeFundPaymaster(uint256 nonce, address powers) external {
        uint16 mandateId = findMandateIdInOrg(
            "Propose to Fund Paymaster: Admin signals intent to top up the gasless paymaster.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        IPowers(powers).request(mandateId, abi.encode(), nonce, "Fund paymaster");
        vm.stopBroadcast();

        console2.log("Fund paymaster proposed for mandateId:", mandateId);
    }

    /// @notice Step 2 - Admin executes the 0.05 ETH paymaster deposit.
    function executeFundPaymaster(uint256 nonce, address powers) external {
        uint16 mandateId = findMandateIdInOrg(
            "Execute Fund Paymaster: Send 0.05 ETH to the paymaster deposit.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        IPowers(powers).request(mandateId, abi.encode(), nonce, "Execute fund paymaster");
        vm.stopBroadcast();

        console2.log("Paymaster funded for mandateId:", mandateId);
    }

    ////////////////////////////////////////////////////////////////////////////
    //                   FLOW 4: WITHDRAW FROM PAYMASTER                      //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Step 1 - Admin signals intent to withdraw ETH from the paymaster.
    function proposeWithdrawPaymaster(
        address withdrawAddress,
        uint256 amount,
        uint256 nonce,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(withdrawAddress, amount);
        uint16 mandateId = findMandateIdInOrg(
            "Propose to Withdraw from Paymaster: Admin signals intent to withdraw ETH from the paymaster.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        IPowers(powers).request(mandateId, callData_, nonce, "Withdraw from paymaster");
        vm.stopBroadcast();

        console2.log("Paymaster withdrawal proposed for mandateId:", mandateId);
    }

    /// @notice Step 2 - Admin executes the paymaster withdrawal.
    function executeWithdrawPaymaster(
        address withdrawAddress,
        uint256 amount,
        uint256 nonce,
        address powers
    ) external {
        bytes memory callData_ = abi.encode(withdrawAddress, amount);
        uint16 mandateId = findMandateIdInOrg(
            "Execute Withdraw from Paymaster: Withdraw ETH from the paymaster to the specified address.",
            Powers(payable(powers))
        );

        vm.startBroadcast();
        IPowers(powers).request(mandateId, callData_, nonce, "Execute withdraw from paymaster");
        vm.stopBroadcast();

        console2.log("Paymaster withdrawal executed for mandateId:", mandateId);
    }
}
