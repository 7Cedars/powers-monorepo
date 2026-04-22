// SPDX-License-Identifier: MIT

/// @notice Pause and restart mandates by their position in governance flows.
/// @dev Builds calls to `IPowers.revokeMandate` when pausing, and `IPowers.adoptMandate` + `IPowers.editFlowByIndex` when restarting.
///
/// @author 7Cedars

pragma solidity ^0.8.26;

import { Mandate } from "../../Mandate.sol";
import { IMandate } from "../../interfaces/IMandate.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";
import { IPowers } from "../../interfaces/IPowers.sol";
import { PowersTypes } from "../../interfaces/PowersTypes.sol";

contract PauseMandates is Mandate {
    /// @notice Struct to hold mandate location information
    struct MandateLocation {
        uint8 flowIndex;
        uint8 mandateIndex;
        uint16 mandateId;
    }

    /// @notice Temporary storage for valid restart operations
    struct RestartInfo {
        uint8 flowIndex;
        uint8 mandateIndex;
        uint16 oldMandateId;
        address targetMandate;
        PowersTypes.MandateInitData initData;
    }

    constructor() {
        emit Mandate__Deployed("");
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        // Validate that the config arrays have the same length
        (uint8[] memory indexFlow, uint8[] memory indexMandate) = abi.decode(config, (uint8[], uint8[]));
        
        if (indexFlow.length != indexMandate.length) {
            revert("Array length mismatch");
        }

        inputParams = abi.encode("bool paused");
        super.initializeMandate(index, nameDescription, inputParams, config);
    }

    /// @notice Handle pause/restart requests for mandates at specific flow positions
    /// @param mandateCalldata Contains bool paused parameter
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

        // Decode input parameter
        (bool paused) = abi.decode(mandateCalldata, (bool));
        
        // Decode config parameters
        (uint8[] memory indexFlow, uint8[] memory indexMandate) = 
            abi.decode(getConfig(powers, mandateId), (uint8[], uint8[]));

        if (paused) {
            // Pause mandates: revoke them
            return _pauseMandates(powers, indexFlow, indexMandate, actionId);
        } else {
            // Restart mandates: redeploy and update flows
            return _restartMandates(powers, indexFlow, indexMandate, actionId);
        }
    }

    /// @notice Internal function to pause (revoke) mandates at specified positions
    function _pauseMandates(
        address powers,
        uint8[] memory indexFlow,
        uint8[] memory indexMandate,
        uint256 actionId
    )
        internal
        view
        returns (uint256, address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        // Find valid mandates to revoke
        (MandateLocation[] memory locations, uint256 validCount) = _findValidMandates(powers, indexFlow, indexMandate);
        
        // Create arrays for the calls
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(validCount);
        
        // Build revoke calls
        for (uint256 i = 0; i < validCount; i++) {
            targets[i] = powers;
            calldatas[i] = abi.encodeWithSelector(IPowers.revokeMandate.selector, locations[i].mandateId);
        }
        
        return (actionId, targets, values, calldatas);
    }

    /// @notice Internal function to restart (redeploy) mandates at specified positions
    function _restartMandates(
        address powers,
        uint8[] memory indexFlow,
        uint8[] memory indexMandate,
        uint256 actionId
    )
        internal
        view
        returns (uint256, address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        // Get current mandate counter to predict new mandate IDs
        uint16 currentMandateCounter = IPowers(powers).getMandateCounter();
        
        // Find valid mandates
        (MandateLocation[] memory locations, uint256 totalLocations) = _findValidMandates(powers, indexFlow, indexMandate);
        
        RestartInfo[] memory restartInfos = new RestartInfo[](totalLocations);
        uint256 validCount = 0;
        
        // Filter for inactive mandates and gather their data
        for (uint256 i = 0; i < totalLocations; i++) {
            uint16 oldMandateId = locations[i].mandateId;
            
            // Check if mandate is already active
            (address targetMandate, , bool active) = IPowers(powers).getAdoptedMandate(oldMandateId);
            if (active) {
                // Already active, skip silently
                continue;
            }
            
            // Retrieve mandate information
            PowersTypes.Conditions memory conditions = IPowers(powers).getConditions(oldMandateId);
            bytes memory config = IMandate(targetMandate).getConfig(powers, oldMandateId);
            string memory nameDescription = IMandate(targetMandate).getNameDescription(powers, oldMandateId);
            
            // Store restart info
            restartInfos[validCount] = RestartInfo({
                flowIndex: locations[i].flowIndex,
                mandateIndex: locations[i].mandateIndex,
                oldMandateId: oldMandateId,
                targetMandate: targetMandate,
                initData: PowersTypes.MandateInitData({
                    nameDescription: nameDescription,
                    targetMandate: targetMandate,
                    config: config,
                    conditions: conditions
                })
            });
            validCount++;
        }
        
        // Create arrays for the calls (adoptMandate + editFlowByIndex for each valid restart)
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(validCount * 2);
        
        // Build calls: alternating adoptMandate and editFlowByIndex
        for (uint256 i = 0; i < validCount; i++) {
            RestartInfo memory info = restartInfos[i];
            
            // Predict the new mandate ID
            uint16 newMandateId = currentMandateCounter + uint16(i);
            
            // Call 1: adoptMandate
            targets[i * 2] = powers;
            calldatas[i * 2] = abi.encodeWithSelector(IPowers.adoptMandate.selector, info.initData);
            
            // Call 2: editFlowByIndex to update the flow with new mandate ID
            targets[i * 2 + 1] = powers;
            calldatas[i * 2 + 1] = abi.encodeWithSelector(
                IPowers.editFlowByIndex.selector,
                info.flowIndex,
                info.mandateIndex,
                newMandateId
            );
        }
        
        return (actionId, targets, values, calldatas);
    }

      /// @notice Internal function to find valid mandates at specified flow positions
    /// @dev Skips invalid indices, out-of-bounds positions, and zero mandateIds
    function _findValidMandates(
        address powers,
        uint8[] memory indexFlow,
        uint8[] memory indexMandate
    )
        internal
        view
        returns (MandateLocation[] memory locations, uint256 validCount)
    {
        locations = new MandateLocation[](indexFlow.length);
        validCount = 0;
        
        for (uint256 i = 0; i < indexFlow.length; i++) {
            // Get flow at index
            uint16[] memory flow;
            try IPowers(powers).getFlowMandatesAtIndex(indexFlow[i]) returns (uint16[] memory _flow) {
                flow = _flow;
            } catch {
                // Invalid flow index, skip silently
                continue;
            }
            
            // Check if mandate index is valid
            if (indexMandate[i] >= flow.length) {
                // Index out of bounds, skip silently
                continue;
            }
            
            uint16 mandateId = flow[indexMandate[i]];
            
            // Skip if mandate is address(0) (represented as mandateId == 0)
            if (mandateId == 0) {
                continue;
            }
            
            // Store valid mandate location
            locations[validCount] = MandateLocation({
                flowIndex: indexFlow[i],
                mandateIndex: indexMandate[i],
                mandateId: mandateId
            });
            validCount++;
        }
        
        return (locations, validCount);
    }
}