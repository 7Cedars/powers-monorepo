// SPDX-License-Identifier: MIT

/// @notice Adopt a set of mandates configured at initialization.
/// RoleIds are dynamic. 
/// @dev Builds calls to `IPowers.adoptMandate` for each configured mandate. No self-destruction occurs.
///
/// @author 7Cedars

pragma solidity ^0.8.26;

import { Mandate } from "@src/Mandate.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";

contract Adopt_Preset_Mandates is Mandate {
    constructor() {
        bytes memory configParams = abi.encode("MandateInitData[] MandatesToAdopt");
        emit Mandate__Deployed("");
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        inputParams = abi.encode();
        super.initializeMandate(index, nameDescription, inputParams, config);
    }

    /// @notice Build calls to adopt the configured mandates
    /// @param mandateCalldata Unused for this mandate
    function handleRequest(
        address,
        /*caller*/
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
        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        PowersTypes.MandateInitData[] memory initData = abi.decode(getConfig(powers, mandateId), (PowersTypes.MandateInitData[])); 
 
        // Create arrays for the calls to adoptMandate
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(initData.length);

        for (uint256 i; i < initData.length; i++) {
            targets[i] = powers;
            calldatas[i] = abi.encodeWithSelector(IPowers.adoptMandate.selector, initData[i]);
        }
        return (actionId, targets, values, calldatas);
    }
}
