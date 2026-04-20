// SPDX-License-Identifier: MIT

/// @notice A mandate to fund an ERC-4337 Paymaster from the Powers treasury.
/// @author 7Cedars
pragma solidity ^0.8.26;

import { Mandate } from "../../../Mandate.sol";
import { MandateUtilities } from "../../../libraries/MandateUtilities.sol";

contract FundPaymaster is Mandate {
    constructor() {
        emit Mandate__Deployed("");
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        // Expected parameters when proposing/requesting
        inputParams = abi.encode("address paymaster", "uint256 amount");
        super.initializeMandate(index, nameDescription, inputParams, config);
    }

    function handleRequest(
        address, /*caller*/
        address, /*powers*/
        uint16 mandateId,
        bytes calldata mandateCalldata,
        uint256 nonce
    )
        public
        pure
        override
        returns (uint256 actionId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);

        // Decode the parameters
        (address paymaster, uint256 amount) = abi.decode(mandateCalldata, (address, uint256));

        // Format execution arrays to send ETH directly
        targets = new address[](1);
        values = new uint256[](1);
        calldatas = new bytes[](1);

        targets[0] = paymaster;
        values[0] = amount;
        calldatas[0] = "";

        return (actionId, targets, values, calldatas);
    }
}
