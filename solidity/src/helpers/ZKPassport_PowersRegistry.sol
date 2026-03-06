// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { DisclosedData, ProofVerificationParams, BoundData } from "@zkpassport/circuits/src/Types.sol";
import { IZKPassportVerifier, IZKPassportHelper, FaceMatchMode, OS } from "@src/interfaces/IZKPassport.sol";

/// @title ZKPassport Powers Registry
/// @notice Helper contract to verify and register ZKPassport identities for the Powers protocol.
/// @author 7Cedars
interface IZKPassport_PowersRegistry {
    function registerProof(ProofVerificationParams calldata params) external returns (bytes32 identifier);
    function deleteProof() external;
    function verifyProof(address account, uint256 staleAfterSeconds, bytes4 functionSelector, bytes calldata input) external view returns (bool);
}

contract ZKPassport_PowersRegistry is IZKPassport_PowersRegistry {

    struct Mem {
        bool verified;
        bytes32 uniqueIdentifier;
        uint256 proofTimestamp;
        BoundData boundData;
        bytes32 identifier; 

        bool success; 
    }

    //////////////////////////////////////////////////////////////
    //                        STORAGE                           //
    //////////////////////////////////////////////////////////////
    
    // ZKPassport Verifier contract -- why save this to state? Why not just call the contract directly?
    IZKPassportVerifier public immutable zkPassportVerifier; // £contrib? check immutable set in repo.  
    IZKPassportHelper public immutable zkPassportHelper;

    // Mapping from account address to unique passport identifier (e.g. hash of nullifier)
    mapping(address => bytes32) internal accountIdentifiers;
    
    // Mapping from unique passport identifier to account address
    // Used to prevent sybil attacks (one passport per account)
    mapping(bytes32 => address) internal identifierAccounts;

    // Mapping from unique identifier to proof verification parameters
    mapping(bytes32 => ProofVerificationParams) internal accountProofs;

    // Domain and Scope for ZKPassport verification
    string public validDomain;
    string public validScope;

    //////////////////////////////////////////////////////////////
    //                        EVENTS                            //
    //////////////////////////////////////////////////////////////
    event IdentityRegistered(address indexed account, bytes32 indexed identifier);
    event IdentityMoved(bytes32 indexed identifier, address indexed oldAccount, address indexed newAccount);
    event IdentityDeleted(bytes32 indexed identifier, address indexed oldAccount);

    //////////////////////////////////////////////////////////////
    //                     CONSTRUCTOR                          //
    //////////////////////////////////////////////////////////////
    constructor(
        address _zkPassportVerifier, 
        address _zkPassportHelper,
        string memory _domain, 
        string memory _scope
    ) {
        if (_zkPassportVerifier == address(0)) revert ("ZKPassport: Invalid zero address");
        zkPassportVerifier = IZKPassportVerifier(_zkPassportVerifier);  
        zkPassportHelper = IZKPassportHelper(_zkPassportHelper);  
        validDomain = _domain; 
        validScope = _scope;
    }

    //////////////////////////////////////////////////////////////
    //                  VERIFICATION LOGIC                      //
    //////////////////////////////////////////////////////////////

    /// @notice Verify a ZKPassport proof and register the identity and disclosed data.
    /// @param params The proof verification parameters from ZKPassport SDK. 
    /// @return identifier The unique identifier of the passport.
    function registerProof(
        ProofVerificationParams calldata params
    ) external returns (bytes32 identifier) {
        Mem memory mem;

        // 1. Verify the proof using ZKPassport Root Verifier
        (mem.verified, mem.uniqueIdentifier, ) = zkPassportVerifier.verify(params);
        require(mem.verified, "Proof is invalid");

        // 2. Verify domain and scope
        require(
          zkPassportHelper.verifyScopes(params.proofVerificationData.publicInputs, validDomain, validScope),
          "Invalid scope"
        );

        // 3. Verify uniqueness 
        require (
            identifierAccounts[mem.uniqueIdentifier] == address(0) || identifierAccounts[mem.uniqueIdentifier] == msg.sender, 
            "ID already registered to another account"
        );

        // 4. Verify Freshness proof. 
        mem.proofTimestamp = zkPassportHelper.getProofTimestamp(params.proofVerificationData.publicInputs);
        require(block.timestamp - mem.proofTimestamp < 1 hours, "Proof is too old"); // e.g., 1 hour window

        // Use the getBoundData function to get the data bound to the proof
        mem.boundData = zkPassportHelper.getBoundData(params.committedInputs);
        // Make sure the user's address is the one that is calling the contract
        require(mem.boundData.senderAddress == msg.sender, "Not the expected sender");
        // Make sure the chain id is the same as the one you specified in the query builder
        require(mem.boundData.chainId == block.chainid, "Invalid chain id"); 
        // Making sure the string is empty
        require(bytes(mem.boundData.customData).length == 0, "Custom data should be empty");

        // if all checks pass, save proof and identifiers to state. 
        // £NOTE this is a key difference from standard implmentation. 
        // But proofs are shared on chain in standard implementation, so it should not be a problem to store them here.
        // In this case, storing them allows for splitting the registration and checking steps, which is necessary for Powers integration.

        // Store the unique identifier
        accountIdentifiers[msg.sender] = mem.uniqueIdentifier;
        identifierAccounts[mem.uniqueIdentifier] = msg.sender;
        accountProofs[mem.uniqueIdentifier] = params;

        emit IdentityRegistered(msg.sender, mem.uniqueIdentifier);
        return mem.uniqueIdentifier;
    }

    function deleteProof() external {
        bytes32 identifier = accountIdentifiers[msg.sender];
        require(identifier != bytes32(0), "No registration found");

        require (
            identifierAccounts[identifier] == msg.sender, 
            "Identifier not registered to caller"
        );

        delete accountIdentifiers[msg.sender];
        delete identifierAccounts[identifier];
        delete accountProofs[identifier];

        emit IdentityDeleted(identifier, msg.sender);
    }

    //////////////////////////////////////////////////////////////
    //                   CHECK PROOFS                           //
    //////////////////////////////////////////////////////////////

    /// @notice Verify a specific proof (e.g. age over 18) for a caller's registered passport.
    /// @param account The address of the account to check.
    /// @param staleAfterSeconds The time in seconds after which the proof is considered stale/expired.
    /// @param functionSelector The function selector of the specific check to perform (e.g. CHECK_AGE or CHECK_EQUAL).
    /// @param input The encoded input parameters for the check (e.g. age threshold or field name and expected value).
    /// @return verified Whether the proof verification succeeded.
    function verifyProof(address account, uint256 staleAfterSeconds, bytes4 functionSelector, bytes calldata input) external view returns (bool) {
        Mem memory mem;

        mem.identifier = accountIdentifiers[account];
        
        // 1. check that the caller has a registered passport
        require(mem.identifier != bytes32(0), "No registration found");

        ProofVerificationParams memory params = accountProofs[mem.identifier];

        // 2. check that the proof is not stale  
        mem.proofTimestamp = zkPassportHelper.getProofTimestamp(params.proofVerificationData.publicInputs);
        require(block.timestamp - mem.proofTimestamp < staleAfterSeconds, "Proof is stale");

        // 3. call internal function according to functionSelector that will then call the ZKPassportHelper contract to verify the specific check.
        /// @dev it is not the most elegant solution, but it is clear and robust. 
        if (functionSelector == bytes4(keccak256("isAgeAbove(uint8,bytes)"))) {
            mem.success = _verifyAgeAbove(input, params);
        } else if (functionSelector == bytes4(keccak256("isAgeAboveOrEqual(uint8,bytes)"))) {
            mem.success = _verifyAgeAboveOrEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isAgeBelow(uint8,bytes)"))) {
            mem.success = _verifyAgeBelow(input, params);
        } else if (functionSelector == bytes4(keccak256("isAgeBelowOrEqual(uint8,bytes)"))) {
            mem.success = _verifyAgeBelowOrEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isAgeBetween(uint8,uint8,bytes)"))) {
            mem.success = _verifyAgeBetween(input, params);
        } else if (functionSelector == bytes4(keccak256("isAgeEqual(uint8,bytes)"))) {
            mem.success = _verifyAgeEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isBirthdateAfter(uint256,bytes)"))) {
            mem.success = _verifyBirthdateAfter(input, params);
        } else if (functionSelector == bytes4(keccak256("isBirthdateAfterOrEqual(uint256,bytes)"))) {
            mem.success = _verifyBirthdateAfterOrEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isBirthdateBefore(uint256,bytes)"))) {
            mem.success = _verifyBirthdateBefore(input, params);
        } else if (functionSelector == bytes4(keccak256("isBirthdateBeforeOrEqual(uint256,bytes)"))) {
           mem.success = _verifyBirthdateBeforeOrEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isBirthdateBetween(uint256,uint256,bytes)"))) {
            mem.success = _verifyBirthdateBetween(input, params);
        } else if (functionSelector == bytes4(keccak256("isBirthdateEqual(uint256,bytes)"))) { 
            mem.success = _verifyBirthdateEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isExpiryDateAfter(uint256,bytes)"))) {
            mem.success = _verifyExpiryDateAfter(input, params);
        } else if (functionSelector == bytes4(keccak256("isExpiryDateAfterOrEqual(uint256,bytes)"))) {
            mem.success = _verifyExpiryDateAfterOrEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isExpiryDateBefore(uint256,bytes)"))) {
            mem.success = _verifyExpiryDateBefore(input, params);
        } else if (functionSelector == bytes4(keccak256("isExpiryDateBeforeOrEqual(uint256,bytes)"))) {
            mem.success = _verifyExpiryDateBeforeOrEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isExpiryDateBetween(uint256,uint256,bytes)"))) {
            mem.success = _verifyExpiryDateBetween(input, params);
        } else if (functionSelector == bytes4(keccak256("isExpiryDateEqual(uint256,bytes)"))) {
            mem.success = _verifyExpiryDateEqual(input, params);
        } else if (functionSelector == bytes4(keccak256("isFaceMatchVerified(uint8,uint8,bytes)"))) {
            mem.success = _verifyFaceMatchVerified(input, params);
        } else if (functionSelector == bytes4(keccak256("isIssuingCountryIn(string[],bytes)"))) {
            mem.success = _verifyIssuingCountryIn(input, params);
        } else if (functionSelector == bytes4(keccak256("isIssuingCountryOut(string[],bytes)"))) {
            mem.success = _verifyIssuingCountryOut(input, params);
        } else if (functionSelector == bytes4(keccak256("isNationalityIn(string[],bytes)"))) {
            mem.success = _verifyNationalityIn(input, params);
        } else if (functionSelector == bytes4(keccak256("isNationalityOut(string[],bytes)"))) {
            mem.success = _verifyNationalityOut(input, params);
        } else {
            revert("Unsupported function selector");
        }

        return mem.success;
    }

    function _verifyAgeAbove(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint8 age = abi.decode(input, (uint8));
        return zkPassportHelper.isAgeAbove(age, params.committedInputs);
    }

    function _verifyAgeAboveOrEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint8 age = abi.decode(input, (uint8));
        return zkPassportHelper.isAgeAboveOrEqual(age, params.committedInputs);
    }

    function _verifyAgeBelow(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint8 age = abi.decode(input, (uint8));
        return zkPassportHelper.isAgeBelow(age, params.committedInputs);
    }

    function _verifyAgeBelowOrEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint8 age = abi.decode(input, (uint8));
        return zkPassportHelper.isAgeBelowOrEqual(age, params.committedInputs);
    }

    function _verifyAgeBetween(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        (uint8 ageLower, uint8 ageUpper) = abi.decode(input, (uint8, uint8));
        return zkPassportHelper.isAgeBetween(ageLower, ageUpper, params.committedInputs);
    }

    function _verifyAgeEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint8 age = abi.decode(input, (uint8));
        return zkPassportHelper.isAgeEqual(age, params.committedInputs);
     }

    function _verifyBirthdateAfter(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isBirthdateAfter(timestamp, params.committedInputs);
    }

    function _verifyBirthdateAfterOrEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isBirthdateAfterOrEqual(timestamp, params.committedInputs);
    }

    function _verifyBirthdateBefore(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isBirthdateBefore(timestamp, params.committedInputs);
    }

    function _verifyBirthdateBeforeOrEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isBirthdateBeforeOrEqual(timestamp, params.committedInputs);
    }

    function _verifyBirthdateBetween(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        (uint256 timestampLower, uint256 timestampUpper) = abi.decode(input, (uint256, uint256)); 
        return zkPassportHelper.isBirthdateBetween(timestampLower, timestampUpper, params.committedInputs);
    }

    function _verifyBirthdateEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isBirthdateEqual(timestamp, params.committedInputs);
    }

    function _verifyExpiryDateAfter(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isExpiryDateAfter(timestamp, params.committedInputs);
    }

    function _verifyExpiryDateAfterOrEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isExpiryDateAfterOrEqual(timestamp, params.committedInputs);
    }

    function _verifyExpiryDateBefore(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isExpiryDateBefore(timestamp, params.committedInputs);
    }

    function _verifyExpiryDateBeforeOrEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isExpiryDateBeforeOrEqual(timestamp, params.committedInputs);
    }

    function _verifyExpiryDateBetween(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        (uint256 timestampLower, uint256 timestampUpper) = abi.decode(input, (uint256, uint256)); 
        return zkPassportHelper.isExpiryDateBetween(timestampLower, timestampUpper, params.committedInputs);
    }

    function _verifyExpiryDateEqual(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        uint256 timestamp = abi.decode(input, (uint256)); 
        return zkPassportHelper.isExpiryDateEqual(timestamp, params.committedInputs);
    }

    function _verifyFaceMatchVerified(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        (FaceMatchMode mode, OS os) = abi.decode(input, (FaceMatchMode, OS)); 
        return zkPassportHelper.isFaceMatchVerified(mode, os, params.committedInputs);
    }

    function _verifyIssuingCountryIn(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        string[] memory countries = abi.decode(input, (string[])); 
        return zkPassportHelper.isIssuingCountryIn(countries, params.committedInputs);
    }

    function _verifyIssuingCountryOut(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        string[] memory countries = abi.decode(input, (string[])); 
        return zkPassportHelper.isIssuingCountryOut(countries, params.committedInputs);
    }

    function _verifyNationalityIn(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        string[] memory nationalities = abi.decode(input, (string[])); 
        return zkPassportHelper.isNationalityIn(nationalities, params.committedInputs);
    }

    function _verifyNationalityOut(bytes calldata input, ProofVerificationParams memory params) internal view returns (bool) {
        string[] memory nationalities = abi.decode(input, (string[])); 
        return zkPassportHelper.isNationalityOut(nationalities, params.committedInputs);
    }
}