// SPDX-License-Identifier: MIT

/// @notice A base contract that executes a preset action, then self-revokes.
///
/// The logic:
/// - the mandateCalldata includes a single bool. If the bool is set to true, it will send the preset calldatas to the execute function of the Powers protocol.
/// - after the preset calls, it appends a final call to `IPowers.revokeMandate(mandateId)` so this
///   mandate revokes itself. It is therefore single-use: once executed it becomes inactive and
///   cannot be requested again.
///
/// @author 7Cedars,

pragma solidity ^0.8.26;

import { Mandate } from "@src/Mandate.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

contract PresetActions is Mandate {
    /// @notice Constructor of the PresetActions mandate
    constructor(address registry_) Mandate(registry_) {
        bytes memory configParams = abi.encode("address[] targets", "uint256[] values", "bytes[] calldatas");
        emit Mandate__Deployed(configParams);
    }

    /// @notice Execute the mandate by returning the preset action data
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

        (address[] memory presetTargets, uint256[] memory presetValues, bytes[] memory presetCalldatas) =
            abi.decode(getConfig(powers, mandateId), (address[], uint256[], bytes[]));

        // Rebuild the return arrays one element longer to append the self-revoke call as the final entry.
        uint256 presetLength = presetTargets.length;
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(presetLength + 1);
        for (uint256 i; i < presetLength; i++) {
            targets[i] = presetTargets[i];
            values[i] = presetValues[i];
            calldatas[i] = presetCalldatas[i];
        }

        // Final call: this mandate revokes itself, making it single-use.
        targets[presetLength] = powers;
        values[presetLength] = 0;
        calldatas[presetLength] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateId);

        return (actionId, targets, values, calldatas);
    }
}
