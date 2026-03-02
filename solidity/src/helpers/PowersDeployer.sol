// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Powers } from "../Powers.sol";
import { PowersTypes } from "../interfaces/PowersTypes.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Powers Deployer
/// @notice Helper contract to deploy Powers instances.
/// @dev This separates the bytecode of Powers from PowersFactory to avoid contract size limits.
contract PowersDeployer is PowersTypes, Ownable {
    
    constructor() Ownable(msg.sender) {}

    /// @notice Deploys a new Powers contract and constitutes it with the stored mandates.
    /// @dev The newly deployed Powers contract becomes the admin of the deployed Powers contract.
    /// @return The address of the deployed Powers contract.
    function deployAndConstitute(
        string memory name,
        string memory uri,
        uint256 maxCallDataLength,
        uint256 maxReturnDataLength,
        uint256 maxExecutionsLength,
        MandateInitData[] memory configuredMandates,
        address finalAdmin
    ) external returns (address) {
        Powers powers = new Powers(name, uri, maxCallDataLength, maxReturnDataLength, maxExecutionsLength);

        powers.constitute(configuredMandates); // set the Powers address as the initial deployer and set as the admin!
        
        // If finalAdmin is address(0), set the Powers contract itself as the admin.
        address admin = finalAdmin == address(0) ? address(powers) : finalAdmin;
        
        powers.closeConstitute(admin); 

        return address(powers);
    }
}
