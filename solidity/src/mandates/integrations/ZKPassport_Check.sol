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
    struct ConfigParams {
        string[] inputParams;
        address registry;
        uint256 staleAfterSeconds;
        bytes4 functionSelector;
        bytes input;
          
    }

    struct Mem {
        bool verified;
        ConfigParams config;
        address accountToCheck;
    }
         
    //////////////////////////////////////////////////////////////
    //                   MANDATE EXECUTION                      //
    //////////////////////////////////////////////////////////////

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        (string[] memory params_ , , , , ) = abi.decode(config, (string[], address, uint256, bytes4, bytes));
        
        bytes memory newParams_ = abi.encode(params_, "address AccountToCheck"); 
        super.initializeMandate(index, nameDescription, newParams_, config);
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
        (mem.config, mem.accountToCheck) = abi.decode(getConfig(powers, mandateId), (ConfigParams, address)); 
        if (mem.config.registry == address(0)) revert ("ZKPassport: Invalid registry address");
        if (mem.accountToCheck == address(0)) revert ("ZKPassport: Invalid zero address for account to check");
        if (mem.accountToCheck != caller) revert ("ZKPassport: Caller is not the account to check");

        ZKPassport_PowersRegistry registry = ZKPassport_PowersRegistry(mem.config.registry);
        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);  

        // Verify proof using the registry
        mem.verified = registry.verifyProof(
            caller,
            mem.config.staleAfterSeconds,
            mem.config.functionSelector,
            mem.config.input
        );

        if (!mem.verified) {
            revert("ZKPassport: Proof verification failed");
        }
        
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(1);       
        return (actionId, targets, values, calldatas);
    }

    /// @notice Returns the input parameters for the mandate.
    /// @dev This function is used by the frontend to display the input parameters.
    function getInputParams(address powers, uint16 mandateId) public view override returns (bytes memory inputParams) {
        Mem memory mem;
        mem.config = abi.decode(getConfig(powers, mandateId), (ConfigParams));
        return abi.encode(mem.config.inputParams);
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
