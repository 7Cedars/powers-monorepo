// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ZKPassportRootVerifier } from "@zkpassport/circuits/src/ZKPassportRootVerifier.sol";
import { ZKPassportHelper } from "@zkpassport/circuits/src/ZKPassportHelper.sol";
import { DisclosedData, ProofVerificationParams } from "@zkpassport/circuits/src/Types.sol";

/// @title ZKPassport Powers Registry
/// @notice Helper contract to verify and register ZKPassport identities for the Powers protocol.
/// @author 7Cedars
contract ZKPassport_PowersRegistry {
    //////////////////////////////////////////////////////////////
    //                        STORAGE                           //
    //////////////////////////////////////////////////////////////
    
    // ZKPassport Verifier contract
    ZKPassportRootVerifier public immutable zkPassportVerifier;

    // Mapping from account address to unique passport identifier (e.g. hash of nullifier)
    mapping(address => bytes32) public accountIdentifiers;
    
    // Mapping from unique passport identifier to account address
    // Used to prevent sybil attacks (one passport per account)
    mapping(bytes32 => address) public identifierAccounts;

    // Mapping from unique identifier to data field hash to stored string value
    // key1: identifier, key2: keccak256(field_name)
    mapping(bytes32 => mapping(bytes32 => string)) public accountData;

    // Mapping from unique identifier to data field hash to timestamp of verification
    mapping(bytes32 => mapping(bytes32 => uint256)) public accountDataTimestamp;

    // Domain and Scope for ZKPassport verification
    string public validDomain;
    string public validScope;

    //////////////////////////////////////////////////////////////
    //                        EVENTS                            //
    //////////////////////////////////////////////////////////////
    event IdentityRegistered(address indexed account, bytes32 indexed identifier);
    event IdentityMoved(bytes32 indexed identifier, address indexed oldAccount, address indexed newAccount);
    event DataStored(address indexed account, bytes32 indexed fieldHash, uint256 timestamp);

    //////////////////////////////////////////////////////////////
    //                        ERRORS                            //
    //////////////////////////////////////////////////////////////
    error ZKPassport__VerifierZeroAddress();
    error ZKPassport__InvalidProof();
    error ZKPassport__InvalidDomainOrScope();

    //////////////////////////////////////////////////////////////
    //                     CONSTRUCTOR                          //
    //////////////////////////////////////////////////////////////
    constructor(address _zkPassportVerifier, string memory _domain, string memory _scope) {
        if (_zkPassportVerifier == address(0)) revert ZKPassport__VerifierZeroAddress();
        zkPassportVerifier = ZKPassportRootVerifier(_zkPassportVerifier);
        validDomain = _domain;
        validScope = _scope;
    }

    //////////////////////////////////////////////////////////////
    //                  VERIFICATION LOGIC                      //
    //////////////////////////////////////////////////////////////

    /// @notice Verify a ZKPassport proof and register the identity and disclosed data.
    /// @param params The proof verification parameters from ZKPassport SDK.
    /// @param isIDCard Whether the document is an ID card (affects disclosed data format).
    /// @return identifier The unique identifier of the passport.
    function verifyAndRegister(
        ProofVerificationParams calldata params,
        bool isIDCard
    ) external returns (bytes32 identifier) {
        // 1. Verify the proof using ZKPassport Root Verifier
        (bool verified, bytes32 uniqueIdentifier, ZKPassportHelper helper) = zkPassportVerifier.verify(params);
        
        if (!verified) revert ZKPassport__InvalidProof();

        // 2. Verify domain and scope
        if (!helper.verifyScopes(params.proofVerificationData.publicInputs, validDomain, validScope)) {
            revert ZKPassport__InvalidDomainOrScope();
        }

        // 3. Handle Identity Registration / Movement
        address oldAccount = identifierAccounts[uniqueIdentifier];
        
        if (oldAccount != address(0) && oldAccount != msg.sender) {
            delete accountIdentifiers[oldAccount];
            emit IdentityMoved(uniqueIdentifier, oldAccount, msg.sender);
        }

        identifierAccounts[uniqueIdentifier] = msg.sender;
        accountIdentifiers[msg.sender] = uniqueIdentifier;

        // 4. Extract and Store Disclosed Data
        DisclosedData memory data = helper.getDisclosedData(params.committedInputs, isIDCard);
        
        // Helper to store if not empty
        _storeField(uniqueIdentifier, "issuingCountry", data.issuingCountry);
        _storeField(uniqueIdentifier, "name", data.name); 
        _storeField(uniqueIdentifier, "nationality", data.nationality);
        _storeField(uniqueIdentifier, "gender", data.gender);
        _storeField(uniqueIdentifier, "birthDate", data.birthDate);
        _storeField(uniqueIdentifier, "expiryDate", data.expiryDate);
        // documentNumber is excluded per requirements

        emit IdentityRegistered(msg.sender, uniqueIdentifier);
        return uniqueIdentifier;
    }

    function _storeField(bytes32 identifier, string memory fieldName, string memory value) internal {
        if (bytes(value).length > 0) {
            bytes32 fieldHash = keccak256(bytes(fieldName));
            accountData[identifier][fieldHash] = value;
            accountDataTimestamp[identifier][fieldHash] = block.timestamp;
            emit DataStored(msg.sender, fieldHash, block.timestamp);
        }
    }

    //////////////////////////////////////////////////////////////
    //                      GETTERS                             //
    //////////////////////////////////////////////////////////////

    /// @notice Get the stored data for a specific field.
    /// @param account The account to query.
    /// @param fieldName The name of the field (e.g. "nationality").
    /// @return value The stored string value.
    /// @return timestamp The timestamp when the data was last verified.
    function getDisclosedData(address account, string memory fieldName) external view returns (string memory value, uint256 timestamp) {
        bytes32 uniqueIdentifier = accountIdentifiers[account];
        if (uniqueIdentifier == bytes32(0)) return ("", 0);
        
        bytes32 fieldHash = keccak256(bytes(fieldName));
        return (accountData[uniqueIdentifier][fieldHash], accountDataTimestamp[uniqueIdentifier][fieldHash]);
    }
}
