// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { PowersTypes } from "../interfaces/PowersTypes.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IPowersDeployer } from "./PowersDeployer.sol";

/// @title Powers Factory
/// @notice Factory contract to deploy configured Powers instances.
/// @dev This factory manages a list of mandate initialization data used to constitute new Powers deployments.
/// @author 7Cedars
interface IPowersFactory is PowersTypes { 
    function addMandates(MandateInitData[] memory _mandateInitData) external;
    function replaceMandate(uint256 index, MandateInitData memory _mandateInitData) external;
    function getMandate(uint256 index) external view returns (MandateInitData memory);
    function createPowers() external returns (address);
    function getLatestDeployment() external view returns (address);
}

contract PowersFactory is IPowersFactory, Ownable {
    using Strings for uint256;

    struct Mem { 
        uint256 length;
        uint256 i;
        uint256 j;
        uint256 k; 
        PowersTypes.MandateInitData[] mandateInitDatas;
        address dependency;
        address placeholder;
        bytes32 placeholderWord;
        bytes32 dependencyWord;
        bytes config;
        bytes32 word;
    }

    string public name;
    string public uri;
    MandateInitData[] public mandateInitData;
    uint256 public immutable maxCallDataLength;
    uint256 public immutable maxReturnDataLength;
    uint256 public immutable maxExecutionsLength;
    address public latestDeployment; 
    address[] public dependencies; 
    IPowersDeployer public immutable deployer;
    
    /// @notice Initializes the factory with maximum limits for Powers contracts.
    /// @param _name The name of the DAO.
    /// @param _uri The URI of the DAO.
    /// @param _maxCallDataLength The maximum length of call data allowed in the Powers contract.
    /// @param _maxReturnDataLength The maximum length of return data allowed in the Powers contract.
    /// @param _maxExecutionsLength The maximum number of executions allowed in a single proposal.
    /// @param _deployer The address of the PowersDeployer contract.
    constructor(
        string memory _name,
        string memory _uri, 
        uint256 _maxCallDataLength,
        uint256 _maxReturnDataLength,
        uint256 _maxExecutionsLength,
        address _deployer
    ) Ownable(msg.sender) {
        // set immutable variables. note for now data not validated. 
        name = _name;
        uri = _uri;

        maxCallDataLength = _maxCallDataLength;
        maxReturnDataLength = _maxReturnDataLength;
        maxExecutionsLength = _maxExecutionsLength;
        deployer = IPowersDeployer(_deployer);
    }

    /// @notice Adds a list of mandates to the factory's storage.
    /// @dev Can only be called by the owner.
    /// @param _mandateInitData An array of MandateInitData structs to be added.
    function addMandates(MandateInitData[] memory _mandateInitData) external onlyOwner {
        for (uint256 i = 0; i < _mandateInitData.length; i++) {
            mandateInitData.push(_mandateInitData[i]);
        }
    }

    /// @notice Replaces a mandate at a specific index.
    /// @dev Can only be called by the owner.
    /// @param index The index of the mandate to replace.
    /// @param _mandateInitData The new MandateInitData struct.
    function replaceMandate(uint256 index, MandateInitData memory _mandateInitData) external onlyOwner {
        mandateInitData[index] = _mandateInitData;
    }

    /// @notice Retrieves a mandate at a specific index.
    /// @param index The index of the mandate to retrieve.
    /// @return The MandateInitData struct at the specified index.
    function getMandate(uint256 index) external view returns (MandateInitData memory) {
        return mandateInitData[index];
    } 

    /// @notice Adds a list of dependencies (other contracts) that the deployed Powers instances will rely on.
    /// @dev Can only be called by the owner. This is useful for keeping track of external contracts that the Powers instances will interact with, such as token contracts, oracles, etc.
    /// @param _dependency An array of addresses representing the dependencies.
    /// @dev Note: The Factory works with a simple search-and-replace mechanism on bytes config. It searches for address(uint160(uint256(keccak256("Dependency0")))), address(uint160(uint256(keccak256("Dependency1")))), etc. in the config and replaces them with the addresses provided here. So the order of dependencies matters and needs to be consistent with how they are referenced in the mandate configurations.
    function addDependency(address _dependency) external onlyOwner {
        dependencies.push(_dependency);
    }
    
    /// @notice Replaces a dependency at a specific index.
    /// @dev Can only be called by the owner. This allows for updating the address of a dependency if needed (e.g., if an external contract is upgraded).
    /// @param index The index of the dependency to replace.
    /// @param _dependency The new address of the dependency.
    function replaceDependency(uint256 index, address _dependency) external onlyOwner {
        dependencies[index] = _dependency;
    }

    /// @notice Retrieves a dependency at a specific index.
    /// @param index The index of the dependency to retrieve.
    /// @return The address of the dependency at the specified index.
    function getDependency(uint256 index) external view returns (address) {
        return dependencies[index];
    }

    /// @notice Deploys a new Powers contract and constitutes it with the stored mandates.
    /// @dev The newly deployed Powers contract becomes the admin of the deployed Powers contract.
    /// @return The address of the deployed Powers contract.
    function createPowers() external onlyOwner returns (address) {
        MandateInitData[] memory configuredMandates = _configureMandates();
        
        address powers = deployer.deployAndConstitute(
            name,
            uri,
            maxCallDataLength,
            maxReturnDataLength,
            maxExecutionsLength,
            configuredMandates,
            address(0) // Logic in deployer: address(0) -> admin = address(powers)
        );

        latestDeployment = powers;
        return powers;
    }

    /// @notice Deploys a new Powers contract and constitutes it with the stored mandates.
    /// @dev The newly deployed Powers contract becomes the admin of the deployed Powers contract.
    /// @return The address of the deployed Powers contract.
    function createPowers(address admin) external onlyOwner returns (address) {
        MandateInitData[] memory configuredMandates = _configureMandates();

        address powers = deployer.deployAndConstitute(
            name,
            uri,
            maxCallDataLength,
            maxReturnDataLength,
            maxExecutionsLength,
            configuredMandates,
            admin
        );

        latestDeployment = powers;
        return powers;
    }

    /// @notice Configures the mandates by replacing placeholders with actual dependency addresses.
    /// @return An array of configured MandateInitData.
    function _configureMandates() internal view returns (MandateInitData[] memory) {
        Mem memory mem;

        mem.length = mandateInitData.length;
        MandateInitData[] memory configuredMandates = new MandateInitData[](mem.length);

        // Copy from storage to memory
        for (mem.i = 0; mem.i < mem.length; mem.i++) {
            configuredMandates[mem.i] = mandateInitData[mem.i];
        }

        // Iterate through dependencies and replace placeholders
        for (mem.j = 0; mem.j < dependencies.length; mem.j++) {
            mem.dependency = dependencies[mem.j];
            // Compute placeholder: address(uint160(uint256(keccak256("Dependency" + j))))
            mem.placeholder = address(uint160(uint256(keccak256(abi.encodePacked("Dependency", mem.j.toString())))));
            
            // Convert to 32-byte words for comparison
            mem.placeholderWord = bytes32(uint256(uint160(mem.placeholder)));
            mem.dependencyWord = bytes32(uint256(uint160(mem.dependency)));

            // Iterate through each mandate's config
            for (mem.i = 0; mem.i < mem.length; mem.i++) {
                mem.config = configuredMandates[mem.i].config;
                if (mem.config.length == 0) continue;

                // Create local variables for assembly usage to avoid "Stack Too Deep" and struct member access errors in Yul
                bytes memory config = mem.config;
                bytes32 dependencyWord = mem.dependencyWord;

                // Scan config in 32-byte chunks
                // Note: We skip the first 32 bytes which store the length of the bytes array
                for (uint256 k = 0; k < config.length; k += 32) {
                    // Ensure we don't read past the end (though config.length should be multiple of 32 for abi.encoded data usually)
                    if (k + 32 > config.length) break;

                    bytes32 word;
                    assembly {
                        word := mload(add(add(config, 32), k))
                    }

                    if (word == mem.placeholderWord) {
                        assembly {
                            mstore(add(add(config, 32), k), dependencyWord)
                        }
                    }
                }
            }
        }

        return configuredMandates;
    }
    
    /// @notice Returns the address of the latest deployed Powers contract.
    /// @return The address of the latest deployment.
    function getLatestDeployment() external view returns (address) {
        return latestDeployment;
    }
}
