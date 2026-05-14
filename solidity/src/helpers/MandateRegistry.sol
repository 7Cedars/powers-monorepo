// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "@lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import { ERC165Checker } from "@lib/openzeppelin-contracts/contracts/utils/introspection/ERC165Checker.sol";
import { IMandate } from "../interfaces/IMandate.sol"; 

/// @title MandateRegistry - Whitelist Registry for Powers Protocol Mandates
/// @notice Maintains a version-controlled registry of approved mandate implementations
/// @dev All functions are restricted to the contract owner
/// @author 7Cedars

interface IMandateRegistry {
    struct MandateEntry {
        address mandateAddress;
        uint48 registeredAt;
        bool isActive;
    }

    function registerMandate(string calldata mandateName, address mandateAddress, bytes32 creationCodeHash) external;
    function deactivateMandate(uint16 major, uint16 minor, uint16 patch, string calldata mandateName) external;
    function reactivateMandate(uint16 major, uint16 minor, uint16 patch, string calldata mandateName) external;
    function batchRegisterMandates(string[] calldata mandateNames, address[] calldata mandateAddresses, bytes32[] calldata creationCodeHashes) external;
    function getMandateEntry(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (MandateEntry memory);
    function getMandateAddress(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (address);
    function isMandateRegistered(bytes32 creationCodeHash) external view returns (bool);
    function isVersionActive(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (bool);
    function getLatestVersion(string calldata mandateName) external view returns (uint16 major, uint16 minor, uint16 patch);
    function owner() external view returns (address);
}

contract MandateRegistry is Ownable {
    //////////////////////////////////////////////////////////////
    //                        STORAGE                           //
    //////////////////////////////////////////////////////////////

    /// @notice Structure containing mandate registration details
    struct MandateEntry {
        address mandateAddress;
        uint48 registeredAt; // Block number when registered
        bool isActive; // Optional field for future use (e.g., security audits)
    }

    /// @notice Mapping from mandate nameHash to packed version to entry
    mapping(bytes32 nameHash => mapping(uint48 packedVersion => MandateEntry)) public registry;

    /// @notice Ordered list of versions registered for each mandate name
    mapping(bytes32 nameHash => uint48[]) public mandateVersions;

    /// @notice Mapping of mandate creation code hashes to registration status
    mapping(bytes32 creationCodeHash => bool) public registeredCreationCodes;

    //////////////////////////////////////////////////////////////
    //                        EVENTS                            //
    //////////////////////////////////////////////////////////////

    /// @notice Emitted when a new mandate is registered
    event MandateRegistered(
        uint16 major,
        uint16 minor,
        uint16 patch,
        address indexed mandateAddress,
        string mandateName,
        uint256 registeredAt
    );

    /// @notice Emitted when a mandate is updated
    event MandateUpdated(
        uint16 major,
        uint16 minor,
        uint16 patch,
        address indexed oldAddress,
        address indexed newAddress,
        string mandateName
    );

    /// @notice Emitted when a mandate is deactivated
    event MandateDeactivated(uint16 major, uint16 minor, uint16 patch, string mandateName, uint256 deactivatedAt);

    /// @notice Emitted when a mandate is reactivated
    event MandateReactivated(uint16 major, uint16 minor, uint16 patch, string mandateName, uint256 reactivatedAt);

    //////////////////////////////////////////////////////////////
    //                        ERRORS                            //
    //////////////////////////////////////////////////////////////

    error MandateAlreadyRegistered(uint16 major, uint16 minor, uint16 patch, string mandateName);
    error MandateNotFound(uint16 major, uint16 minor, uint16 patch, string mandateName);
    error MandateInactive(uint16 major, uint16 minor, uint16 patch, string mandateName);
    error InvalidMandateAddress();
    error InvalidMandateInterface(address mandateAddress);
    error InvalidNameLength();
    error InvalidVersionSequence(uint16 major, uint16 minor, uint16 patch, string mandateName);

    //////////////////////////////////////////////////////////////
    //                      CONSTRUCTOR                         //
    //////////////////////////////////////////////////////////////

    /// @notice Initializes the registry with the deployer as owner
    constructor(address initialOwner) Ownable(initialOwner) { }

    //////////////////////////////////////////////////////////////
    //                   REGISTRATION LOGIC                     //
    //////////////////////////////////////////////////////////////

    /// @notice Registers a new mandate under its contract's specific version
    /// @dev Validates address, interface implementation, and uniqueness
    /// @param mandateName Human-readable name for the mandate
    /// @param mandateAddress Address of the mandate contract
    /// @param creationCodeHash Hash of the mandate's creation code
    function registerMandate(string calldata mandateName, address mandateAddress, bytes32 creationCodeHash) public onlyOwner {
        // Validate inputs
        if (bytes(mandateName).length == 0 || bytes(mandateName).length > 255) {
            revert InvalidNameLength();
        }
        if (mandateAddress == address(0)) revert InvalidMandateAddress();

        // Validate that address implements IMandate interface
        if (!ERC165Checker.supportsInterface(mandateAddress, type(IMandate).interfaceId)) {
            revert InvalidMandateInterface(mandateAddress);
        }

        (uint16 major, uint16 minor, uint16 patch) = IMandate(mandateAddress).version();
        uint48 packedVersion = packVersion(major, minor, patch);
        bytes32 nameHash = keccak256(bytes(mandateName));

        // Check if mandate already exists in this version
        if (registry[nameHash][packedVersion].registeredAt != 0) {
            if (registry[nameHash][packedVersion].isActive) {
                revert MandateAlreadyRegistered(major, minor, patch, mandateName);
            } else {
                revert MandateInactive(major, minor, patch, mandateName);
            }
        }

        // Register the mandate
        registry[nameHash][packedVersion] =
            MandateEntry({ mandateAddress: mandateAddress, registeredAt: uint48(block.number), isActive: true });
        registeredCreationCodes[creationCodeHash] = true;

        _addVersion(nameHash, packedVersion, major, minor, patch, mandateName);

        emit MandateRegistered(major, minor, patch, mandateAddress, mandateName, block.number);
    }

    /// @notice Deactivates a mandate (soft delete)
    function deactivateMandate(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        onlyOwner
    {
        bytes32 nameHash = keccak256(bytes(mandateName));
        uint48 packedVersion = packVersion(major, minor, patch);

        if (registry[nameHash][packedVersion].registeredAt == 0) {
            revert MandateNotFound(major, minor, patch, mandateName);
        }

        MandateEntry storage entry = registry[nameHash][packedVersion];
        if (!entry.isActive) revert MandateInactive(major, minor, patch, mandateName);

        entry.isActive = false;

        emit MandateDeactivated(major, minor, patch, mandateName, block.number);
    }

    /// @notice Reactivates a previously deactivated mandate
    function reactivateMandate(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        onlyOwner
    {
        bytes32 nameHash = keccak256(bytes(mandateName));
        uint48 packedVersion = packVersion(major, minor, patch);

        if (registry[nameHash][packedVersion].registeredAt == 0) {
            revert MandateNotFound(major, minor, patch, mandateName);
        }

        MandateEntry storage entry = registry[nameHash][packedVersion];
        if (entry.isActive) revert MandateAlreadyRegistered(major, minor, patch, mandateName);

        entry.isActive = true;

        emit MandateReactivated(major, minor, patch, mandateName, block.number);
    }

    /// @notice Batch registers multiple mandates in a single transaction
    /// @param mandateNames Array of mandate names
    /// @param mandateAddresses Array of mandate addresses
    function batchRegisterMandates(string[] calldata mandateNames, address[] calldata mandateAddresses, bytes32[] calldata creationCodeHashes)
        external
        onlyOwner
    {
        if (mandateNames.length != mandateAddresses.length) {
            revert("Array lengths must match");
        }

        for (uint256 i = 0; i < mandateNames.length; i++) {
            registerMandate(mandateNames[i], mandateAddresses[i], creationCodeHashes[i]);
        }
    }

    //////////////////////////////////////////////////////////////
    //                   HELPERS                                //
    //////////////////////////////////////////////////////////////

    function packVersion(uint16 major, uint16 minor, uint16 patch) public pure returns (uint48) {
        return (uint48(major) << 32) | (uint48(minor) << 16) | uint48(patch);
    }

    function _addVersion(
        bytes32 nameHash,
        uint48 packedVersion,
        uint16 major,
        uint16 minor,
        uint16 patch,
        string calldata mandateName
    ) internal {
        uint48[] storage versions = mandateVersions[nameHash];
        uint256 len = versions.length;

        if (len > 0 && packedVersion <= versions[len - 1]) {
            revert InvalidVersionSequence(major, minor, patch, mandateName);
        }

        versions.push(packedVersion);
    }

    function _getMandateEntryInternal(
        uint16 major,
        uint16 minor,
        uint16 patch,
        string calldata mandateName
    ) internal view returns (MandateEntry memory) {
        bytes32 nameHash = keccak256(bytes(mandateName));
        uint48 targetVersion = packVersion(major, minor, patch);

        MandateEntry memory entry = registry[nameHash][targetVersion];
        if (entry.registeredAt == 0) revert MandateNotFound(major, minor, patch, mandateName);
        return entry; 
    }

    //////////////////////////////////////////////////////////////
    //                   VIEW FUNCTIONS                         //
    //////////////////////////////////////////////////////////////
    /// @notice Gets the complete mandate entry
    function getMandateEntry(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (MandateEntry memory)
    {
        return _getMandateEntryInternal(major, minor, patch, mandateName);
    }

    /// @notice Gets the mandate address
    function getMandateAddress(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (address)
    {
        return _getMandateEntryInternal(major, minor, patch, mandateName).mandateAddress;
    }

    /// @notice Checks if a mandate is registered
    function isMandateRegistered(bytes32 creationCodeHash)
        external
        view
        returns (bool)
    {
        return registeredCreationCodes[creationCodeHash];
    } 

    /// @notice Checks if a mandate is active
    function isVersionActive(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (bool)
    {
        bytes32 nameHash = keccak256(bytes(mandateName));
        uint48 targetVersion = packVersion(major, minor, patch);
        if (registry[nameHash][targetVersion].registeredAt == 0) return false;
        return registry[nameHash][targetVersion].isActive;
    }

    function getLatestVersion(string calldata mandateName) external view returns (uint16 major, uint16 minor, uint16 patch) {
        bytes32 nameHash = keccak256(bytes(mandateName));
        uint48[] storage versions = mandateVersions[nameHash];
        if (versions.length == 0) revert("No versions registered for this mandate");

        uint48 latestPacked = versions[versions.length - 1];
        major = uint16(latestPacked >> 32);
        minor = uint16((latestPacked >> 16) & 0xFFFF);
        patch = uint16(latestPacked & 0xFFFF);
    }
}
