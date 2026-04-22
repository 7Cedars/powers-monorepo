// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "@lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import { ERC165Checker } from "@lib/openzeppelin-contracts/contracts/utils/introspection/ERC165Checker.sol";
import { IMandate } from "../interfaces/IMandate.sol";

/// @title MandateRegistry - Whitelist Registry for Powers Protocol Mandates
/// @notice Maintains a version-controlled registry of approved mandate implementations
/// @dev All functions are restricted to the contract owner
/// @author 7Cedars
contract MandateRegistry is Ownable {
    //////////////////////////////////////////////////////////////
    //                        STORAGE                           //
    //////////////////////////////////////////////////////////////
    
    /// @notice Structure containing mandate registration details
    struct MandateEntry {
        address mandateAddress;
        uint48 registeredAt;  // Block number when registered
        bool isActive;  // Optional field for future use (e.g., security audits)
    }

    /// @notice Mapping from version string to mandate nameHash to entry
    mapping(string version => mapping(bytes32 nameHash => MandateEntry)) public registry;

    //////////////////////////////////////////////////////////////
    //                        EVENTS                            //
    //////////////////////////////////////////////////////////////
    
    /// @notice Emitted when a new mandate is registered
    event MandateRegistered(
        string indexed version,
        address indexed mandateAddress,
        string mandateName,
        uint256 registeredAt
    );
    
    /// @notice Emitted when a mandate is updated
    event MandateUpdated(
        string indexed version,
        address indexed oldAddress,
        address indexed newAddress,
        string mandateName
    );
    
    /// @notice Emitted when a mandate is deactivated
    event MandateDeactivated(string indexed version, string mandateName, uint256 deactivatedAt);
    
    /// @notice Emitted when a mandate is reactivated
    event MandateReactivated(string indexed version, string mandateName, uint256 reactivatedAt);

    //////////////////////////////////////////////////////////////
    //                        ERRORS                            //
    //////////////////////////////////////////////////////////////
    
    error MandateAlreadyRegistered(string version, string mandateName);
    error MandateNotFound(string version, string mandateName);
    error MandateInactive(string version, string mandateName);
    error InvalidMandateAddress();
    error InvalidMandateInterface(address mandateAddress);
    error InvalidNameLength();
    error InvalidVersionString();

    //////////////////////////////////////////////////////////////
    //                      CONSTRUCTOR                         //
    //////////////////////////////////////////////////////////////
    
    /// @notice Initializes the registry with the deployer as owner
    constructor() Ownable(msg.sender) {}

    //////////////////////////////////////////////////////////////
    //                   REGISTRATION LOGIC                     //
    //////////////////////////////////////////////////////////////
    
    /// @notice Registers a new mandate under a specific version
    /// @dev Validates address, interface implementation, and uniqueness
    /// @param version The version string (e.g., "v1.0")
    /// @param mandateName Human-readable name for the mandate
    /// @param mandateAddress Address of the mandate contract
    function registerMandate(
        string calldata version,
        string calldata mandateName,
        address mandateAddress
    ) external onlyOwner {
        // Validate inputs
        if (bytes(version).length == 0) revert InvalidVersionString();
        if (bytes(mandateName).length == 0 || bytes(mandateName).length > 255) {
            revert InvalidNameLength();
        }
        if (mandateAddress == address(0)) revert InvalidMandateAddress();
        
        bytes32 nameHash = keccak256(bytes(mandateName));

        // Check if mandate already exists in this version
        if (registry[version][nameHash].registeredAt != 0) {
            if (registry[version][nameHash].isActive) {
                revert MandateAlreadyRegistered(version, mandateName);
            } else {
                revert MandateInactive(version, mandateName);
            }
        }
        
        // Validate that address implements IMandate interface
        if (!ERC165Checker.supportsInterface(mandateAddress, type(IMandate).interfaceId)) {
            revert InvalidMandateInterface(mandateAddress);
        }

        // Register the mandate
        registry[version][nameHash] = MandateEntry({
            mandateAddress: mandateAddress,
            registeredAt: uint48(block.number),
            isActive: true
        });
        
        emit MandateRegistered(version, mandateAddress, mandateName, block.number);
    }

    /// @notice Deactivates a mandate (soft delete)
    /// @param version The version string
    /// @param mandateName The mandate name
    function deactivateMandate(string calldata version, string calldata mandateName) external onlyOwner {
        bytes32 nameHash = keccak256(bytes(mandateName));
        
        if (registry[version][nameHash].registeredAt == 0) revert MandateNotFound(version, mandateName);
        
        MandateEntry storage entry = registry[version][nameHash];
        if (!entry.isActive) revert MandateInactive(version, mandateName);
        
        entry.isActive = false;
        
        emit MandateDeactivated(version, mandateName, block.number);
    }
    
    /// @notice Reactivates a previously deactivated mandate
    /// @param version The version string
    /// @param mandateName The mandate name
    function reactivateMandate(string calldata version, string calldata mandateName) external onlyOwner {
        bytes32 nameHash = keccak256(bytes(mandateName));

        if (registry[version][nameHash].registeredAt == 0) revert MandateNotFound(version, mandateName);
        
        MandateEntry storage entry = registry[version][nameHash];
        if (entry.isActive) revert MandateAlreadyRegistered(version, mandateName);
        
        entry.isActive = true;
        
        emit MandateReactivated(version, mandateName, block.number);
    }
    
    /// @notice Batch registers multiple mandates in a single transaction under a specific version
    /// @param version The version string
    /// @param mandateNames Array of mandate names
    /// @param mandateAddresses Array of mandate addresses
    function batchRegisterMandates(
        string calldata version,
        string[] calldata mandateNames,
        address[] calldata mandateAddresses
    ) external onlyOwner {
        if (mandateNames.length != mandateAddresses.length) {
            revert("Array lengths must match");
        }

        for (uint256 i = 0; i < mandateNames.length; i++) {
            this.registerMandate(version, mandateNames[i], mandateAddresses[i]);
        }
    }

    //////////////////////////////////////////////////////////////
    //                   VIEW FUNCTIONS                         //
    //////////////////////////////////////////////////////////////
    
    /// @notice Gets the complete mandate entry
    function getMandateEntry(string calldata version, string calldata mandateName) external view returns (MandateEntry memory) {
        bytes32 nameHash = keccak256(bytes(mandateName));
        if (registry[version][nameHash].registeredAt == 0) revert MandateNotFound(version, mandateName);
        return registry[version][nameHash];
    }
    
    /// @notice Gets the mandate address
    function getMandateAddress(string calldata version, string calldata mandateName) external view returns (address) {
        bytes32 nameHash = keccak256(bytes(mandateName));
        if (registry[version][nameHash].registeredAt == 0) revert MandateNotFound(version, mandateName);
        return registry[version][nameHash].mandateAddress;
    }
    
    /// @notice Checks if a mandate is registered
    function isMandateRegistered(string calldata version, string calldata mandateName) external view returns (bool) {
        bytes32 nameHash = keccak256(bytes(mandateName));
        return registry[version][nameHash].registeredAt != 0;
    }
    
    /// @notice Checks if a mandate is active
    function isVersionActive(string calldata version, string calldata mandateName) external view returns (bool) {
        bytes32 nameHash = keccak256(bytes(mandateName));
        if (registry[version][nameHash].registeredAt == 0) return false;
        return registry[version][nameHash].isActive;
    }
    
    /// @notice Gets mandate details for multiple names in a single version
    function getBatchMandateEntries(string calldata version, string[] calldata mandateNames) 
        external 
        view 
        returns (MandateEntry[] memory entries) 
    {
        entries = new MandateEntry[](mandateNames.length);
        for (uint256 i = 0; i < mandateNames.length; i++) {
            bytes32 nameHash = keccak256(bytes(mandateNames[i]));
            if (registry[version][nameHash].registeredAt != 0) {
                entries[i] = registry[version][nameHash];
            }
        }
        return entries;
    }
}
