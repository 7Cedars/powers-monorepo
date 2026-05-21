// SPDX-License-Identifier: MIT

/// @notice A mandate to remove a slate from a SlateRegistry election.
///
/// This mandate:
/// - Takes the same input params as SlateRegistry_AddSlate, enabling conditional linking
///   (e.g. needFulfilled = AddSlate actionId ensures only submitted slates can be removed)
/// - Retrieves the slate's adopted mandate ID from AddSlate's return data at index 0
/// - Revokes the mandate in Powers
/// - Resets the slate's flow slot to 0, freeing it for a new submission
/// - Unregisters the slate from SlateRegistry
///
/// @author 7Cedars

pragma solidity ^0.8.26;

import { Mandate } from "../../../Mandate.sol";
import { IPowers } from "../../../interfaces/IPowers.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";
import { SlateRegistry } from "../../../helpers/SlateRegistry.sol";

contract SlateRegistry_RemoveSlate is Mandate {
    struct Mem {
        address slateRegistry;
        uint16 addSlateMandateId;
        uint256 electionId;
        uint8 flowIndex;
        uint16 slatesMandateId;
        uint8 slotIndex;
    }

    /// @notice Constructor for SlateRegistry_RemoveSlate mandate
    constructor() {
        bytes memory configParams = abi.encode("address SlateRegistry", "uint16 AddSlateMandateId");
        emit Mandate__Deployed(configParams);
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        inputParams = abi.encode(
            "string ElectionTitle",
            "string NameDescription",
            "address[] Targets",
            "uint256[] Values",
            "bytes[] Calldatas"
        );
        super.initializeMandate(index, nameDescription, inputParams, config);
    }

    /// @notice Build calls to revoke a slate mandate and remove it from the election flow
    /// @param powers The Powers contract address
    /// @param mandateId The mandate identifier
    /// @param mandateCalldata Encoded input parameters — must be identical to the corresponding AddSlate call
    /// @param nonce Nonce — must be identical to the corresponding AddSlate call
    function handleRequest(
        address /* caller */,
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

        // Decode input parameters (same layout as AddSlate; only electionTitle is used here)
        {
            string memory electionTitle;
            (electionTitle, , , , ) = abi.decode(mandateCalldata, (string, string, address[], uint256[], bytes[]));
            mem.electionId = uint256(keccak256(abi.encodePacked(powers, electionTitle)));
        }

        // Decode config
        (mem.slateRegistry, mem.addSlateMandateId) = abi.decode(getConfig(powers, mandateId), (address, uint16));

        // Retrieve the mandate ID of the slate from AddSlate's return data (index 0 = adoptMandate return value)
        uint256 addSlateActionId = MandateUtilities.computeActionId(mem.addSlateMandateId, mandateCalldata, nonce);
        mem.slatesMandateId = abi.decode(IPowers(powers).getActionReturnData(addSlateActionId, 0), (uint16));

        // Get election flowIndex from SlateRegistry
        (mem.flowIndex, , , , , ) = SlateRegistry(mem.slateRegistry).elections(mem.electionId);

        // Find which slot in the flow holds this slate's mandate
        mem.slotIndex = _findMandateSlot(powers, mem.flowIndex, mem.slatesMandateId);

        // Build calls
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(3);

        // Call 1: Revoke the slate's PresetActions mandate in Powers
        targets[0] = powers;
        calldatas[0] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mem.slatesMandateId);

        // Call 2: Reset the flow slot to 0, freeing it for future submissions
        targets[1] = powers;
        calldatas[1] = abi.encodeWithSelector(
            IPowers.editFlowByIndex.selector,
            mem.flowIndex,
            mem.slotIndex,
            uint16(0)
        );

        // Call 3: Unregister the slate from SlateRegistry
        targets[2] = mem.slateRegistry;
        calldatas[2] = abi.encodeWithSelector(SlateRegistry.removeSlate.selector, mem.electionId, mem.slatesMandateId);

        return (actionId, targets, values, calldatas);
    }

    /// @dev Find the flow slot index that holds the given mandate ID
    function _findMandateSlot(address powers, uint8 flowIndex, uint16 targetMandateId) internal view returns (uint8) {
        uint16[] memory flowMandateIds = IPowers(powers).getFlowMandatesAtIndex(flowIndex);
        for (uint8 i = 0; i < flowMandateIds.length; i++) {
            if (flowMandateIds[i] == targetMandateId) {
                return i;
            }
        }
        revert("Slate not found in flow");
    }
}
