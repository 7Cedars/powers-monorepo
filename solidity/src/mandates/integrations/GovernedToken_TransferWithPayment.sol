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
 * @title GovernedToken_TransferWithPayment
 * @notice Mandate to gate access to a role based on Governed1155 or Governed721 tokens.
 * @dev  
 */
contract GovernedToken_TransferWithPayment is Mandate {
    struct Mem {
        address governedTokenAddress;
        address from;
        address to;
        uint256 tokenId;
        address paymentToken;
        uint256 quantity;
        address treasury;
        uint256 actionId;
        address owner;
        address approvedAddress;
        bool isWhitelisted;
    }

    constructor() {
        bytes memory configParams = abi.encode("address GovernedTokenAddress");
        emit Mandate__Deployed(configParams);
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        inputParams = abi.encode("address From, address To, uint256 TokenId, address PaymentToken, uint256 Quantity");
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
        mem.governedTokenAddress = abi.decode(getConfig(powers, mandateId), (address));

        // 1. Decode inputs
        (mem.from, mem.to, mem.tokenId, mem.paymentToken, mem.quantity) = 
            abi.decode(mandateCalldata, (address, address, uint256, address, uint256));

        // 2. Ownership check.  
        mem.owner = IERC721(mem.governedTokenAddress).ownerOf(mem.tokenId);
        if (mem.from != mem.owner) {
             revert("From address is not token owner");
        }

        // 3: authorisation check: is the powers contract approved to transfer the token on behalf of the owner?
        mem.approvedAddress = IERC721(mem.governedTokenAddress).getApproved(mem.tokenId);
        if (mem.approvedAddress != powers) {
            revert("Powers contract not approved to transfer token");
        }

        // 4: check if token is whitelisted in the Governed721 contract. 
        mem.isWhitelisted = IGoverned721(mem.governedTokenAddress).isWhitelisted(mem.paymentToken); 
        if (!mem.isWhitelisted) {
            revert("Token is not whitelisted");
        }
        
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(2);        
        // Call 1: Payment (if applicable)
        // We do payment first.
        if (mem.quantity > 0) {
            mem.treasury = IPowers(powers).getTreasury();
            if (mem.treasury == address(0)) revert("Treasury not set");
            
            // Transfer payment from `to` (the receiver of NFT, presumably the buyer) to Treasury.
            targets[0] = mem.paymentToken;
            calldatas[0] = abi.encodeWithSelector(
                IERC20.transferFrom.selector,
                mem.to,      // payer
                mem.treasury, // recipient
                mem.quantity
            );
        }
        
        // Call 2: Transfer NFT
        targets[1] = mem.governedTokenAddress;
        // We use transferFrom. Powers calls it. Powers must be approved by `from` (or be approvedForAll).
        calldatas[1] = abi.encodeWithSelector(
            IERC721.transferFrom.selector,
            mem.from,
            mem.to,
            mem.tokenId
        );
        
        return (actionId, targets, values, calldatas);
    }
}
