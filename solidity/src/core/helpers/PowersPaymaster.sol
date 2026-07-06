// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BasePaymaster } from "@lib/account-abstraction/contracts/core/BasePaymaster.sol";
import { PackedUserOperation } from "@lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import { IEntryPoint } from "@lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";

/// @title PowersPaymaster
/// @notice An ERC-4337 Paymaster that only sponsors calls where the target is a specific Powers protocol contract.
/// @dev Inherits from BasePaymaster.
contract PowersPaymaster is BasePaymaster {
    address[] public sponsoredTargets; // List of contract addresses that this Paymaster will sponsor calls to.

    /// @notice executeUserOpWithErrorString(address,uint256,bytes,uint8) — Privy LightAccount
    bytes4 public constant EXECUTE_SELECTOR = 0x541d63c8;
    /// @notice execute(address,uint256,bytes) — standard single execute
    bytes4 public constant EXECUTE_SELECTOR_SIMPLE = 0xb61d27f6;
    /// @notice execute(bytes32,bytes) — ZeroDev Kernel v3 / ERC-7579
    bytes4 public constant EXECUTE_SELECTOR_KERNEL = 0xe9ae5c53;

    error PowersPaymaster__TargetNotAuthorized();
    error PowersPaymaster__InvalidCallData();
    error PowersPaymaster__UnsupportedSelector();

    event sponsoredTargetAdded(address target);
    event sponsoredTargetRemoved(address target);

    constructor(IEntryPoint _entryPoint, address _powers) BasePaymaster(_entryPoint) {
        sponsoredTargets.push(_powers);
        transferOwnership(_powers);
    }

    function addSponsoredTarget(address target) external onlyOwner {
        if (target == address(0)) {
            revert PowersPaymaster__InvalidCallData();
        }
        sponsoredTargets.push(target);

        emit sponsoredTargetAdded(target);
    }

    function removeSponsoredTarget(address target) external onlyOwner {
        if (target == address(0)) {
            revert PowersPaymaster__InvalidCallData();
        }

        uint256 length = sponsoredTargets.length;
        bool found = false;
        for (uint256 i = 0; i < length; i++) {
            if (sponsoredTargets[i] == target) {
                sponsoredTargets[i] = sponsoredTargets[length - 1];
                sponsoredTargets.pop();
                found = true;
                break;
            }
        }
        if (!found) {
            revert PowersPaymaster__TargetNotAuthorized();
        }

        emit sponsoredTargetRemoved(target);
    }

    /// @notice Validates that the UserOperation targets one of the sponsored targets.
    /// Supports three account types:
    /// - LightAccount (Privy default): executeUserOpWithErrorString(address,uint256,bytes,uint8) — target at callData[4:36]
    /// - Standard single execute: execute(address,uint256,bytes) — target at callData[4:36]
    /// - Kernel v3 / ERC-7579: execute(bytes32,bytes) — target packed at callData[100:]
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
        if (userOp.callData.length < 68) {
            revert PowersPaymaster__InvalidCallData();
        }

        bytes4 selector = bytes4(userOp.callData[0:4]);

        if (selector == EXECUTE_SELECTOR || selector == EXECUTE_SELECTOR_SIMPLE) {
            // LightAccount / standard: target is ABI-encoded as first param at [4:36]
            address target = abi.decode(userOp.callData[4:36], (address));
            _requireSponsoredTarget(target);
        } else if (selector == EXECUTE_SELECTOR_KERNEL) {
            // Kernel v3: execute(bytes32 mode, bytes executionCalldata)
            // Layout: [4:36] mode | [36:68] offset=64 | [68:100] length | [100:...] abi.encodePacked(to, value, data)
            if (userOp.callData.length < 120) revert PowersPaymaster__InvalidCallData();
            bytes calldata execCalldata = userOp.callData[100:];
            address target;
            assembly {
                // execCalldata.offset is the absolute calldata position of the packed 'to' address.
                // shr(96, calldataload(...)) extracts the top 20 bytes as an address.
                target := shr(96, calldataload(execCalldata.offset))
            }
            _requireSponsoredTarget(target);
        } else {
            revert PowersPaymaster__UnsupportedSelector();
        }

        return ("", 0);
    }

    function _requireSponsoredTarget(address target) internal view {
        for (uint256 i = 0; i < sponsoredTargets.length; i++) {
            if (sponsoredTargets[i] == target) return;
        }
        revert PowersPaymaster__TargetNotAuthorized();
    }
}
