// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Mandate } from "../../Mandate.sol";
import { MandateUtilities } from "../../libraries/MandateUtilities.sol";
import { ZKPassport_PowersRegistry } from "../../helpers/ZKPassport_PowersRegistry.sol";

/// @title ZKPassport Check Mandate
/// @notice Checks if a caller has a valid ZKPassport proof registered with specific data.
/// @author 7Cedars
/// £todo See how here config and inputParams are managed. Way better than having hard coded strings. 
/// It is also possible in the front end to retrieve the input parameters dynamically.
/// This would also make checking of config and input parameters easier.
/// But it seems like quite a bit of work to implement this.  
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
    }
         

    //////////////////////////////////////////////////////////////
    //                   MANDATE EXECUTION                      //
    //////////////////////////////////////////////////////////////
    
    /// @inheritdoc Mandate
    function handleRequest(
        address caller,
        address powers,
        uint16 mandateId,
        bytes calldata /*mandateCalldata*/,
        uint256 /*nonce*/
    )
        public
        view
        override
        returns (uint256 actionId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        // Decode config
        Mem memory mem;
        mem.config = abi.decode(getConfig(powers, mandateId), (ConfigParams));
        if (mem.config.registry == address(0)) revert ("ZKPassport: Invalid registry address");

        ZKPassport_PowersRegistry registry = ZKPassport_PowersRegistry(mem.config.registry);

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
        
        // Return empty call if verification succeeds
        return (0, new address[](0), new uint256[](0), new bytes[](0));
    }

    /// @notice Returns the input parameters for the mandate.
    /// @dev This function is used by the frontend to display the input parameters.
    function getInputParams(address powers, uint16 mandateId) public view override returns (bytes memory inputParams) {
        Mem memory mem;
        mem.config = abi.decode(getConfig(powers, mandateId), (ConfigParams));
        return abi.encode(mem.config.inputParams);
    }
}
