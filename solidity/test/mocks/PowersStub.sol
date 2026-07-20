// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { PowersTypes } from "@src/interfaces/PowersTypes.sol";

/// @notice Minimal Powers stub for SlateRegistry unit tests.
/// Implements only the four IPowers methods that SlateRegistry calls on its owner,
/// providing structural isolation without the onlyPowers restriction of the real Powers.
contract PowersStub {
    uint256 private _flowCount;
    uint256 public roleHolderCount = 1;
    uint16 public lastRequestMandateId;
    uint256 public requestCallCount;

    function getAmountRoleHolders(uint256) external view returns (uint256) {
        return roleHolderCount;
    }

    function addFlow(PowersTypes.Flow memory) external {
        _flowCount++;
    }

    function getFlowCount() external view returns (uint256) {
        return _flowCount;
    }

    function request(uint16 mandateId, bytes calldata, uint256, string memory) external returns (uint256) {
        lastRequestMandateId = mandateId;
        requestCallCount++;
        return requestCallCount;
    }

    function setRoleHolderCount(uint256 count) external {
        roleHolderCount = count;
    }
}
