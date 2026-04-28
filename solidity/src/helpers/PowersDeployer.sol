// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Powers } from "../Powers.sol";
import { PowersTypes } from "../interfaces/PowersTypes.sol";

/// @title Powers Deployer
/// @notice Deployer contract to offload the heavy creation code of Powers from the Factory.
/// @dev Separating this from PowersFactory prevents the factory from hitting the EIP-170 max size limit.
contract PowersDeployer is PowersTypes {
    function deploy(
        string memory name,
        string memory uri,
        uint256 maxCallDataLength,
        uint256 maxReturnDataLength,
        uint256 maxExecutionsLength,
        MandateInitData[] memory mandateInitData,
        Flow[] memory flows,
        address finalAdmin
    ) external returns (address) {
        Powers powers = new Powers(name, uri, maxCallDataLength, maxReturnDataLength, maxExecutionsLength);

        powers.constitute(mandateInitData);
        powers.closeConstitute(finalAdmin, flows);

        return address(powers);
    }
}
