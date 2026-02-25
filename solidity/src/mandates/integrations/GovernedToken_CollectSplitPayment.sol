// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Mandate } from "../../Mandate.sol";
import { IPowers } from "../../interfaces/IPowers.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { MandateUtilities } from "../../libraries/MandateUtilities.sol";
import { Safe } from "lib/safe-smart-account/contracts/Safe.sol";
import { Enum } from "lib/safe-smart-account/contracts/common/Enum.sol";
import { IGoverned721Wrapper, IGoverned721 } from "@src/helpers/Governed721.sol";

// import { console2 } from "forge-std/console2.sol"; // remove before deploying.

/**
 * @title GovernedToken_CollectSplitPayment
 * @notice Mandate to gate split a payment when a token is sold. 
 * This is meant to be used in conjunction with the Governed721Wrapper contract, which allows for encoding payment information into the token transfer data.
 */
contract GovernedToken_CollectSplitPayment is Mandate {
    enum Role { Artist, Intermediary, OldOwner }
    
    struct Mem {
        uint8 roleId; // Role: 0=Artist, 1=Intermediary, 2=OldOwner 
        address governed721WrapperAddress;
        address governed721Address; // Needed for getSplitPayment
        address treasury;
        address from;
        address to;
        uint256 tokenId;
        address paymentToken;
        uint256 quantity;
        uint256 transferNonce; // Block number of the transfer
        uint16 transferMandateId;
        uint256 transferActionId;
        IGoverned721Wrapper.TransferData transferData;
        uint16 percentage;
        uint256 amount;
        bytes transferCallData;
        bytes powersSignature;
    }

    constructor() {
        bytes memory configParams = abi.encode("uint8 RoleId (0=Artist, 1=Intermediary, 2=OldOwner)", "address Governed721WrapperAddress", "address Governed721Address", "uint16 TransferMandateId");
        emit Mandate__Deployed(configParams);
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        inputParams = abi.encode("address From, address To, uint256 TokenId, address PaymentToken, uint256 Quantity, uint256 Nonce");
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
        (mem.roleId, mem.governed721WrapperAddress, mem.governed721Address, mem.transferMandateId) = 
            abi.decode(getConfig(powers, mandateId), (uint8, address, address, uint16));
        
        mem.treasury = IPowers(powers).getTreasury();
        if (mem.treasury == address(0)) revert("Treasury not set");

        // 2. Calculate actionId. 
        mem.transferActionId = uint256(keccak256(abi.encode(mem.transferMandateId, mandateCalldata, nonce))); 

        // 3. Retrieve Transfer Data
        mem.transferData = IGoverned721Wrapper(mem.governed721WrapperAddress).getTransfer(mem.transferActionId);

        // Verify transfer data matches input (sanity check, mainly checks if transfer exists)
        if (mem.transferData.oldOwner == address(0) || mem.transferData.newOwner == address(0) || mem.transferData.tokenId == 0) {
            revert("Transfer data mismatch or not found");
        }

        // 5. Check Caller Role Authorization
        if (mem.roleId == uint8(Role.Artist)) {
            if (caller != mem.transferData.artist) revert("Caller is not the Artist");
            mem.percentage = IGoverned721(mem.governed721Address).artistSplit();
        } else if (mem.roleId == uint8(Role.Intermediary)) {
            if (caller != mem.transferData.intermediary) revert("Caller is not the Intermediary");
            mem.percentage = IGoverned721(mem.governed721Address).intermediarySplit();
        } else if (mem.roleId == uint8(Role.OldOwner)) {
            if (caller != mem.transferData.oldOwner) revert("Caller is not the Old Owner");
            mem.percentage = IGoverned721(mem.governed721Address).oldOwnerSplit();
        } else {
            revert("Invalid Role ID in config");
        }

        // 6. calculate amount = quantity * percentage / 100
        mem.amount = (mem.transferData.quantity * mem.percentage) / 100;
        if (mem.amount == 0) revert("Calculated amount is zero");

        // 7. Create Call to Transfer from Treasury to Caller
        // Powers is owner of Safe Treasury. We use execTransaction with v=1 signature.
        mem.powersSignature = abi.encodePacked(uint256(uint160(powers)), uint256(0), uint8(1));

        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(1);
        targets[0] = mem.treasury;
        
        // Construct inner call to transfer tokens
        mem.transferCallData = abi.encodeWithSelector(
            IERC20.transfer.selector,
            caller, // recipient
            mem.amount
        );

        calldatas[0] = abi.encodeWithSelector(
            Safe.execTransaction.selector,
            mem.paymentToken, // to: Token Contract
            0, // value
            mem.transferCallData, // data
            Enum.Operation.Call, // operation
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            address(0), // gasToken
            payable(0), // refundReceiver
            mem.powersSignature // signature
        );

        return (actionId, targets, values, calldatas);
    }
}
