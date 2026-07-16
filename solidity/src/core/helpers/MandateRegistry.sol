// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "@lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import { ERC165Checker } from "@lib/openzeppelin-contracts/contracts/utils/introspection/ERC165Checker.sol";
import { IMandate } from "@src/interfaces/IMandate.sol";

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
    function batchRegisterMandates(
        string[] calldata mandateNames,
        address[] calldata mandateAddresses,
        bytes32[] calldata creationCodeHashes
    ) external;
    function getMandateEntry(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (MandateEntry memory);
    function getMandateAddress(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (address);
    function isMandateRegistered(bytes32 creationCodeHash) external view returns (bool);
    function isMandateAddressActive(address mandateAddress) external view returns (bool);
    function isVersionActive(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        external
        view
        returns (bool);
    function getLatestVersion(string calldata mandateName)
        external
        view
        returns (uint16 major, uint16 minor, uint16 patch);
    function owner() external view returns (address);

    // --- Paid tier: pricing, credits, earnings ---
    function onAdopt(address org) external;
    function buyCredits(address org) external payable;
    function withdrawEarnings() external;
    function setMandatePricing(address mandate, address[] calldata devs, uint256 price) external;
    function setFeeBps(uint16 newFeeBps) external;
    function mandatePrice(address mandate) external view returns (uint256);
    function mandateDevs(address mandate, uint256 index) external view returns (address);
    function getMandateDevs(address mandate) external view returns (address[] memory);
    function credits(address org) external view returns (uint256);
    function earnings(address dev) external view returns (uint256);
    function feeBps() external view returns (uint16);
}

contract MandateRegistry is Ownable, ReentrancyGuard {
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

    /// @notice Structure locating a mandate address's most recent registration entry
    struct AddressKey {
        bytes32 nameHash;
        uint48 packedVersion;
    }

    /// @notice Mapping from a deployed mandate's address to the registry entry it was last registered under
    /// @dev Used by isMandateAddressActive() so callers (e.g. Powers.sol) can check registration status by
    /// address alone, without needing to know the mandate's name/version in advance.
    /// Caveat: nothing prevents the same address from being registered under two different names — only
    /// (name, version) pairs are checked for uniqueness. If that ever happens, this mapping reflects only the
    /// most recent registration, so isMandateAddressActive() would not see an earlier name's deactivation.
    mapping(address mandateAddress => AddressKey) public addressKey;

    //////////////////////////////////////////////////////////////
    //                   PAID TIER STORAGE                      //
    //////////////////////////////////////////////////////////////

    /// @notice Adoption price per mandate address, in wei. 0 = free.
    mapping(address mandate => uint256 price) public mandatePrice;

    /// @notice Developer payees per mandate address. The paid portion is split equally, with any
    /// remainder wei going to the first dev.
    mapping(address mandate => address[] devs) public mandateDevs;

    /// @notice Prepaid credit balance per org (adopting Powers instance), in wei.
    mapping(address org => uint256 credits) public credits;

    /// @notice Withdrawable earnings per payee (devs and the owning org for the protocol fee), in wei.
    mapping(address payee => uint256 earnings) public earnings;

    /// @notice Protocol fee in basis points, taken from each charge. Owner-settable, capped at MAX_FEE_BPS.
    uint16 public feeBps;

    /// @notice Maximum allowed protocol fee (30%).
    uint16 public constant MAX_FEE_BPS = 3000;

    /// @notice Default protocol fee applied at deployment (10%).
    uint16 internal constant DEFAULT_FEE_BPS = 1000;

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

    /// @notice Emitted when a mandate's pricing/devs are set
    event MandatePricingSet(address indexed mandate, uint256 price, address[] devs);

    /// @notice Emitted when the protocol fee is updated
    event FeeBpsSet(uint16 feeBps);

    /// @notice Emitted when credits are purchased for an org
    event CreditsPurchased(address indexed org, address indexed payer, uint256 amount);

    /// @notice Emitted when a mandate adoption is charged
    event MandateCharged(address indexed mandate, address indexed org, uint256 price, uint256 fee);

    /// @notice Emitted when a payee withdraws earnings
    event EarningsWithdrawn(address indexed payee, uint256 amount);

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
    error NotRegistered(address mandate);
    error InsufficientCredits(address org, uint256 required, uint256 available);
    error NoDevs(address mandate);
    error FeeTooHigh(uint16 feeBps, uint16 maxFeeBps);
    error NothingToWithdraw();
    error EthTransferFailed();

    //////////////////////////////////////////////////////////////
    //                      CONSTRUCTOR                         //
    //////////////////////////////////////////////////////////////

    /// @notice Initializes the registry with the deployer as owner
    constructor(address initialOwner) Ownable(initialOwner) {
        feeBps = DEFAULT_FEE_BPS;
    }

    //////////////////////////////////////////////////////////////
    //                   REGISTRATION LOGIC                     //
    //////////////////////////////////////////////////////////////

    /// @notice Registers a new mandate under its contract's specific version
    /// @dev Validates address, interface implementation, and uniqueness
    /// @param mandateName Human-readable name for the mandate
    /// @param mandateAddress Address of the mandate contract
    /// @param creationCodeHash Hash of the mandate's creation code
    function registerMandate(string calldata mandateName, address mandateAddress, bytes32 creationCodeHash)
        public
        onlyOwner
    {
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
        addressKey[mandateAddress] = AddressKey({ nameHash: nameHash, packedVersion: packedVersion });

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
    function batchRegisterMandates(
        string[] calldata mandateNames,
        address[] calldata mandateAddresses,
        bytes32[] calldata creationCodeHashes
    ) external onlyOwner {
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

    function _getMandateEntryInternal(uint16 major, uint16 minor, uint16 patch, string calldata mandateName)
        internal
        view
        returns (MandateEntry memory)
    {
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
    function isMandateRegistered(bytes32 creationCodeHash) external view returns (bool) {
        return registeredCreationCodes[creationCodeHash];
    }

    /// @notice Checks if a mandate address is currently registered and active
    /// @dev Looks up the (name, version) the address was last registered under via addressKey, then
    /// checks the corresponding entry's isActive flag. Returns false for addresses never registered.
    function isMandateAddressActive(address mandateAddress) external view returns (bool) {
        return _isMandateAddressActive(mandateAddress);
    }

    /// @dev Internal variant of isMandateAddressActive, callable from within the contract (e.g. onAdopt).
    function _isMandateAddressActive(address mandateAddress) internal view returns (bool) {
        AddressKey memory key = addressKey[mandateAddress];
        MandateEntry storage entry = registry[key.nameHash][key.packedVersion];
        return entry.registeredAt != 0 && entry.isActive;
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

    function getLatestVersion(string calldata mandateName)
        external
        view
        returns (uint16 major, uint16 minor, uint16 patch)
    {
        bytes32 nameHash = keccak256(bytes(mandateName));
        uint48[] storage versions = mandateVersions[nameHash];
        if (versions.length == 0) revert("No versions registered for this mandate");

        uint48 latestPacked = versions[versions.length - 1];
        major = uint16(latestPacked >> 32);
        minor = uint16((latestPacked >> 16) & 0xFFFF);
        patch = uint16(latestPacked & 0xFFFF);
    }

    //////////////////////////////////////////////////////////////
    //                   PAID TIER LOGIC                        //
    //////////////////////////////////////////////////////////////

    /// @notice Sets the adoption price and developer payees for a registered mandate.
    /// @dev Owner-only. A priced mandate must have at least one dev payee.
    /// @param mandate The mandate address (must be registered and active).
    /// @param devs The developer payees; the paid portion (after fee) is split equally, remainder to devs[0].
    /// @param price The adoption price in wei (0 = free).
    function setMandatePricing(address mandate, address[] calldata devs, uint256 price) external onlyOwner {
        if (!_isMandateAddressActive(mandate)) revert NotRegistered(mandate);
        if (price > 0 && devs.length == 0) revert NoDevs(mandate);

        mandatePrice[mandate] = price;
        mandateDevs[mandate] = devs;

        emit MandatePricingSet(mandate, price, devs);
    }

    /// @notice Sets the protocol fee in basis points (capped at MAX_FEE_BPS).
    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
        feeBps = newFeeBps;
        emit FeeBpsSet(newFeeBps);
    }

    /// @notice Tops up an org's prepaid credit balance. Anyone can fund any org.
    /// @dev The single "pay one address, once" entry point. ETH stays in the registry to pay devs.
    /// @param org The org (Powers instance) whose balance is topped up.
    function buyCredits(address org) external payable {
        credits[org] += msg.value;
        emit CreditsPurchased(org, msg.sender, msg.value);
    }

    /// @notice Called by a mandate during its initializeMandate to enforce the whitelist and charge the org.
    /// @dev msg.sender is the mandate itself (trustless identity). Mutates only ledger state; never calls back
    /// into the mandate or Powers. Reverts for unregistered mandates (the mandatory whitelist gate).
    /// @param org The adopting Powers org (passed by the mandate as its own caller).
    function onAdopt(address org) external {
        address mandate = msg.sender;
        if (!_isMandateAddressActive(mandate)) revert NotRegistered(mandate);

        uint256 price = mandatePrice[mandate];
        if (price == 0) return; // free; no charge

        uint256 available = credits[org];
        if (available < price) revert InsufficientCredits(org, price, available);
        credits[org] = available - price;

        uint256 fee = (price * feeBps) / 10_000;
        earnings[owner()] += fee;

        address[] memory devs = mandateDevs[mandate];
        uint256 devPortion = price - fee;
        uint256 share = devPortion / devs.length;
        uint256 remainder = devPortion - (share * devs.length);
        for (uint256 i = 0; i < devs.length; i++) {
            earnings[devs[i]] += share;
        }
        // Any indivisible remainder wei goes to the first dev.
        if (remainder > 0) earnings[devs[0]] += remainder;

        emit MandateCharged(mandate, org, price, fee);
    }

    /// @notice Withdraws the caller's accumulated earnings in ETH (pull pattern).
    function withdrawEarnings() external nonReentrant {
        uint256 amount = earnings[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        earnings[msg.sender] = 0;

        (bool success,) = payable(msg.sender).call{ value: amount }("");
        if (!success) revert EthTransferFailed();

        emit EarningsWithdrawn(msg.sender, amount);
    }

    /// @notice Returns the full developer payee list for a mandate.
    function getMandateDevs(address mandate) external view returns (address[] memory) {
        return mandateDevs[mandate];
    }
}
