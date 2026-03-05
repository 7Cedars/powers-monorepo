// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Mandate } from "../../Mandate.sol";
import { IPowers } from "../../interfaces/IPowers.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { MandateUtilities } from "../../libraries/MandateUtilities.sol";
import { IGoverned721 } from "@src/helpers/Governed721.sol";

// import { console2 } from "forge-std/console2.sol"; // remove before deploying.

/**
 * @title GovernedToken_CollectSplitPayment
 * @notice Mandate to gate split a payment when a token is sold. 
 * This is meant to be used in conjunction with the Governed721 contract.
 */
contract GovernedToken_CollectSplitPayment is Mandate {
    
    struct Mem {
        address governed721Address; 
        address treasury;
        IGoverned721.Role role;
        address oldOwner;
        address newOwner;
        uint256 tokenId;
        bytes data;
        address paymentToken;
        uint256 quantity;
        uint256 nonce; 
        uint256 transferId;
        IGoverned721.TransferData transferData;
        uint16 percentage;
        uint256 amount;
        bytes transferCallData;
        bytes powersSignature;
    }

    constructor() {
        bytes memory configParams = abi.encode("address Governed721Address");
        emit Mandate__Deployed(configParams);
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        inputParams = abi.encode("uint256 TransferId");
        super.initializeMandate(index, nameDescription, inputParams, config);
    }

    function handleRequest(
        address caller,
        address powers,
        uint16 mandateId,
        bytes calldata mandateCalldata,
        uint256 nonce
    )
        public
        view
        override
        returns (uint256 actionId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        Mem memory mem;
        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        
        // 1. Get config
        (mem.governed721Address) = abi.decode(getConfig(powers, mandateId), (address));
        
        // mem.treasury = IPowers(payable(powers)).getTreasury();
        // if (mem.treasury == address(0)) revert("Treasury not set");

        // 2. Decode Input Data
        (mem.transferId) = abi.decode(mandateCalldata, (uint256));
        if (mem.transferId == 0) revert("Transfer ID cannot be 0");

        // 3. retrieve the transfer Data from the Governed721 contract using the transferId.
        mem.transferData = IGoverned721(mem.governed721Address).getTransferData(mem.transferId);

        // 4. Verify transfer data matches input (sanity check, mainly checks if transfer exists)
        if (
            mem.transferData.oldOwner == address(0) || 
            mem.transferData.newOwner == address(0) || 
            mem.transferData.tokenId == 0 ||
            mem.transferData.quantity == 0 || 
            mem.transferData.paymentToken == address(0) ||
            mem.transferData.nonce == 0 
            ) {
            revert("Transfer data mismatch or not found");
        }

        // 5. Check Caller Role Authorization
        if (mem.role == IGoverned721.Role.Artist) {
            if (caller != mem.transferData.artist) revert("Caller is not the Artist");
        } else if (mem.role == IGoverned721.Role.Intermediary) {
            if (caller != mem.transferData.intermediary) revert("Caller is not the Intermediary");
        } else if (mem.role == IGoverned721.Role.OldOwner) {
            if (caller != mem.transferData.oldOwner) revert("Caller is not the Old Owner");
        } else {
            revert("Invalid Role ID requested");
        }

        // 6. Get Split Percentage
        mem.percentage = IGoverned721(mem.governed721Address).getSplit(mem.role);

        // 7. Calculate amount = quantity * percentage / 100
        mem.amount = (mem.transferData.quantity * mem.percentage) / 100;
        if (mem.amount == 0) revert("Calculated amount is zero");

        // 8. Create Call to Transfer from Treasury to Caller
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(1);
        
        // Since Powers instance is set as its own treasury, it holds the funds.
        // The instruction for Powers is to call transfer on the ERC20 token contract or transfer native currency.
        // if (mem.transferData.paymentToken != address(0)) {
        targets[0] = mem.transferData.paymentToken;
        calldatas[0] = abi.encodeWithSelector(
            IERC20.transfer.selector,
            caller, // recipient
            mem.amount
        );
        // } else {
        //     targets[0] = mem.transferData.paymentToken;
        //     values[0] = mem.amount;
        //     calldatas[0] = "";
        // }

        return (actionId, targets, values, calldatas);
    }
}
