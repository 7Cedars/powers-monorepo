// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BasePaymaster } from "@lib/account-abstraction/contracts/core/BasePaymaster.sol";
import { PackedUserOperation } from "@lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import { IEntryPoint } from "@lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";

/// @title PowersPaymaster
/// @notice An ERC-4337 Paymaster that only sponsors calls where the target is a specific Powers protocol contract.
/// @dev Inherits from BasePaymaster.
contract PowersPaymaster is BasePaymaster {
    address public immutable POWERS_CONTRACT;

    /// @notice Standard execute(address,uint256,bytes) selector used by most AA wallets
    bytes4 public constant EXECUTE_SELECTOR = 0xb61d27f6;
    /// @notice Standard executeBatch(address[],uint256[],bytes[]) selector
    bytes4 public constant EXECUTE_BATCH_SELECTOR = 0x47e1da2a;

    error PowersPaymaster__TargetNotAuthorized();
    error PowersPaymaster__InvalidCallData();
    error PowersPaymaster__UnsupportedSelector();

    constructor(IEntryPoint _entryPoint, address _powersContract, address _owner) BasePaymaster(_entryPoint) {
        POWERS_CONTRACT = _powersContract;
        transferOwnership(_owner);
    }

    /// @notice Validates that the UserOperation targets the POWERS_CONTRACT
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32,
        /*userOpHash*/
        uint256 /*maxCost*/
    )
        internal
        view
        override
        returns (bytes memory context, uint256 validationData)
    {
        if (userOp.callData.length < 4) {
            revert PowersPaymaster__InvalidCallData();
        }

        bytes4 selector = bytes4(userOp.callData[0:4]);

        if (selector == EXECUTE_SELECTOR) {
            // execute(address,uint256,bytes)
            if (userOp.callData.length < 68) {
                revert PowersPaymaster__InvalidCallData();
            }
            address target = abi.decode(userOp.callData[4:36], (address));

            if (target != POWERS_CONTRACT) {
                revert PowersPaymaster__TargetNotAuthorized();
            }
        } else if (selector == EXECUTE_BATCH_SELECTOR) {
            // executeBatch(address[],uint256[],bytes[])
            // For batches, we ensure ALL targets are the POWERS_CONTRACT
            (address[] memory targets,,) = abi.decode(userOp.callData[4:], (address[], uint256[], bytes[]));

            for (uint256 i = 0; i < targets.length; i++) {
                if (targets[i] != POWERS_CONTRACT) {
                    revert PowersPaymaster__TargetNotAuthorized();
                }
            }
        } else {
            // If we don't recognize the selector, we reject sponsorship to be safe
            revert PowersPaymaster__UnsupportedSelector();
        }

        // Return 0 validationData to indicate success (valid indefinitely, no signature validation failure)
        return ("", 0);
    }
}
