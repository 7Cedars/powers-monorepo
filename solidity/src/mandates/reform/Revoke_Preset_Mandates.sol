// SPDX-License-Identifier: MIT

// @notice Revoke a set of mandates that were previously adopted by a specific mandate.
// @dev Calculates actionId from `conditions.needFulfilled` (adoptMandatesId) using current call data.
// Uses the return data from the adoption action to find the mandateIds to revoke.
//
// @author 7Cedars

pragma solidity ^0.8.26;

import { Mandate } from "../../Mandate.sol";
import { MandateUtilities } from "../../libraries/MandateUtilities.sol";
import { IPowers } from "../../interfaces/IPowers.sol";
import { PowersTypes } from "../../interfaces/PowersTypes.sol";

contract Revoke_Preset_Mandates is Mandate {
    struct Mem {
        uint16 adoptMandatesId;
        uint256 adoptionActionId;
        PowersTypes.MandateInitData[] initData;
        PowersTypes.Conditions conditions;
        uint256 count; 
        uint16 adoptedMandateId;
        bytes returnData;
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
        inputParams = abi.encode();
        super.initializeMandate(index, nameDescription, inputParams, config);
    }

    /// @notice Build calls to revoke the previously adopted mandates
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
        Mem memory mem;
        
        // 1. Get conditions to find adoptMandatesId (needFulfilled)
        mem.conditions = IPowers(payable(powers)).getConditions(mandateId);
        mem.adoptMandatesId = mem.conditions.needFulfilled;
        require(mem.adoptMandatesId != 0, "AdoptMandatesId is 0");

        // 2. Compute actionId for the adoption action
        // Note: We use the same mandateCalldata and nonce as the current call, 
        // but target the adoptMandatesId.
        mem.adoptionActionId = MandateUtilities.computeActionId(mem.adoptMandatesId, mandateCalldata, nonce);

        // 3. Get the configuration of the adoption mandate to know how many mandates were adopted
        // This tells us how many return values to expect.
        mem.initData = abi.decode(getConfig(powers, mem.adoptMandatesId), (PowersTypes.MandateInitData[])); 
        mem.count = mem.initData.length;

        // 4. Create arrays for revocation calls
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(mem.count);

        for (uint256 i = 0; i < mem.count; i++) {
            // Get return data from the adoption action
            mem.returnData = IPowers(payable(powers)).getActionReturnData(mem.adoptionActionId, i);
            
            // Decode the returned mandateId (uint16)
            // Note: Powers.adoptMandate returns uint16, encoded as 32 bytes in returnData usually?
            // Let's assume standard ABI encoding where uint16 is padded to 32 bytes.
            mem.adoptedMandateId = abi.decode(mem.returnData, (uint16));

            targets[i] = powers;
            calldatas[i] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mem.adoptedMandateId);
        }

        // Return the actionId for *this* revocation mandate
        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        
        return (actionId, targets, values, calldatas);
    }
}
