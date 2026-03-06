// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Mandate } from "../../Mandate.sol";
import { MandateUtilities } from "../../libraries/MandateUtilities.sol";
import { ZKPassport_PowersRegistry } from "../../helpers/ZKPassport_PowersRegistry.sol";

/// @title ZKPassport Check Mandate
/// @notice Checks if a caller has a valid ZKPassport proof registered with specific data.
/// @author 7Cedars

/// NB: a list of available checks and their functionSelectors is appended below. 
/// NB 2: You can only run one check at a time on the registry. If you want to run multiple checks, you need to create multiple mandates with different configs in a single chain.
contract ZKPassport_Check is Mandate {
    //////////////////////////////////////////////////////////////
    //                       STRUCTS                            //
    //////////////////////////////////////////////////////////////
    struct Mem {
        bool verified;
        string[] inputParams;
        address registry;
        uint256 staleAfterSeconds;
        bytes4 functionSelector;
        bytes input;
        address accountToCheck;
    }
         
    //////////////////////////////////////////////////////////////
    //                   MANDATE EXECUTION                      //
    //////////////////////////////////////////////////////////////
    constructor() {
        bytes memory configParams =
            abi.encode(
                "string[] inputParams", // NB: these input params are not used in the actual contract. By changing the inputParams, the mandate can be places in a broader governance flow. See StatementOfIntent.sol for a similar approach.  
                "address registry", 
                "uint256 staleAfterSeconds", 
                "bytes4 functionSelector", 
                "bytes input"
                );
        emit Mandate__Deployed(configParams);
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        (string[] memory params_ , , , , ) = abi.decode(config, (string[], address, uint256, bytes4, bytes));
        
        // bytes memory newParams_ = abi.encode(params_, "address AccountToCheck"); 
        string[] memory newParams_ = new string[](params_.length + 1);
        for (uint256 i; i < params_.length; i++) {
            newParams_[i] = params_[i];
        }
        newParams_[params_.length] = "address AccountToCheck"; 
        super.initializeMandate(index, nameDescription, abi.encode(newParams_), config);
    }
    
    /// @inheritdoc Mandate
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
        // Decode config
        Mem memory mem;
        ( , mem.registry, mem.staleAfterSeconds, mem.functionSelector, mem.input) = abi.decode(getConfig(powers, mandateId), (string[], address, uint256, bytes4, bytes));
        mem.accountToCheck = abi.decode(mandateCalldata, (address)); 
        if (mem.registry == address(0)) revert ("ZKPassport: Invalid registry address");
        if (mem.accountToCheck == address(0)) revert ("ZKPassport: Invalid zero address for account to check");
        if (mem.accountToCheck != caller) revert ("ZKPassport: Caller is not the account to check");

        ZKPassport_PowersRegistry registry = ZKPassport_PowersRegistry(mem.registry);
        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);  

        // Verify proof using the registry
        mem.verified = registry.verifyProof(
            caller,
            mem.staleAfterSeconds,
            mem.functionSelector,
            mem.input
        );

        if (!mem.verified) {
            revert("ZKPassport: Proof verification failed");
        }
        
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(1);       
        return (actionId, targets, values, calldatas);
    }
}

/** 
    /////////////////////////////////////////////////////////////////////////////// 
    //  AVAILABLE CHECKS (function selectors for the ZKPassport_PowersRegistry)  //
    /////////////////////////////////////////////////////////////////////////////// 

    Note that the input parameters for the checks are encoded as bytes and need to be decoded in the frontend. 
    The input parameters for each check are as follows: 

    | Check                                       | Function Selector |

    |--------------------------------------------+------------|
    | isAgeAbove(uint8,bytes)                    | ac9367d3   |
    |--------------------------------------------+------------|
    | isAgeAboveOrEqual(uint8,bytes)             | 9b2b63f0   |
    |--------------------------------------------+------------|
    | isAgeBelow(uint8,bytes)                    | 48b6e1f0   |
    |--------------------------------------------+------------|
    | isAgeBelowOrEqual(uint8,bytes)             | b3828b11   |
    |--------------------------------------------+------------|
    | isAgeBetween(uint8,uint8,bytes)            | f4c7dce2   |
    |--------------------------------------------+------------|
    | isAgeEqual(uint8,bytes)                    | e9cada33   |
    |--------------------------------------------+------------|
    | isBirthdateAfter(uint256,bytes)            | f90663a4   |
    |--------------------------------------------+------------|
    | isBirthdateAfterOrEqual(uint256,bytes)     | fa4e1d57   |
    |--------------------------------------------+------------|
    | isBirthdateBefore(uint256,bytes)           | b232cbf6   |
    |--------------------------------------------+------------|
    | isBirthdateBeforeOrEqual(uint256,bytes)    | 99513f70   |
    |--------------------------------------------+------------|
    | isBirthdateBetween(uint256,uint256,bytes)  | 796cd106   |
    |--------------------------------------------+------------|
    | isBirthdateEqual(uint256,bytes)            | 6ec786a4   |
    |--------------------------------------------+------------|
    | isExpiryDateAfter(uint256,bytes)           | d101ad87   |
    |--------------------------------------------+------------|
    | isExpiryDateAfterOrEqual(uint256,bytes)    | ebb9f9c4   |
    |--------------------------------------------+------------|
    | isExpiryDateBefore(uint256,bytes)          | 1361b7ed   |
    |--------------------------------------------+------------|
    | isExpiryDateBeforeOrEqual(uint256,bytes)   | 69b8fdae   |
    |--------------------------------------------+------------|
    | isExpiryDateBetween(uint256,uint256,bytes) | 658bab8f   |
    |--------------------------------------------+------------|
    | isExpiryDateEqual(uint256,bytes)           | 3618ce34   |
    |--------------------------------------------+------------|
    | isFaceMatchVerified(uint8,uint8,bytes)     | 8e96bc89   |
    |--------------------------------------------+------------|
    | isIssuingCountryIn(string[],bytes)         | 87d49c7e   |
    |--------------------------------------------+------------|
    | isIssuingCountryOut(string[],bytes)        | 2caeb390   |
    |--------------------------------------------+------------|
    | isNationalityIn(string[],bytes)            | 103bd3fd   |
    |--------------------------------------------+------------|
    | isNationalityOut(string[],bytes)           | d3fb610f   |
    |--------------------------------------------+------------|
 */
