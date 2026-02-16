// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ZKPassportRootVerifier } from "@zkpassport/circuits/src/ZKPassportRootVerifier.sol";
import { ZKPassportHelper } from "@zkpassport/circuits/src/ZKPassportHelper.sol";
import { DisclosedData, ProofVerificationParams, BoundData } from "@zkpassport/circuits/src/Types.sol";
import { IZKPassportVerifier, IZKPassportHelper } from "@src/interfaces/IZKPassport.sol";

/// @title ZKPassport Powers Registry
/// @notice Helper contract to verify and register ZKPassport identities for the Powers protocol.
/// @author 7Cedars
contract ZKPassport_PowersRegistry {

    struct Mem {
        bool verified;
        bytes32 uniqueIdentifier;
        uint256 proofTimestamp;
        BoundData boundData;
        bytes32 identifier; 

        bool success;
        bytes returnData;

        ZKPassportRootVerifier verifier;
        ZKPassportHelper helper;
    }

    //////////////////////////////////////////////////////////////
    //                        STORAGE                           //
    //////////////////////////////////////////////////////////////
    
    // ZKPassport Verifier contract
    ZKPassportRootVerifier public immutable zkPassportVerifier; // £contrib? check immutable set in repo.  
    ZKPassportHelper public immutable zkPassportHelper;

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
        zkPassportVerifier = ZKPassportRootVerifier(_zkPassportVerifier);
        zkPassportHelper = ZKPassportHelper(_zkPassportHelper);
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
    function register(
        ProofVerificationParams calldata params,
        bool isIDCard
    ) external returns (bytes32 identifier) {
        Mem memory mem;

        // 1. Verify the proof using ZKPassport Root Verifier
        (mem.verified, mem.uniqueIdentifier, mem.helper) = zkPassportVerifier.verify(params);
        require(mem.verified, "Proof is invalid");

        // 2. Verify domain and scope
        require(
          mem.helper.verifyScopes(params.proofVerificationData.publicInputs, validDomain, validScope),
          "Invalid scope"
        );

        // 3. Verify uniqueness 
        require (
            identifierAccounts[mem.uniqueIdentifier] == address(0) || identifierAccounts[mem.uniqueIdentifier] == msg.sender, 
            "Passport already registered to another account"
        );

        // 4. Verify Freshness proof. 
        mem.proofTimestamp = mem.helper.getProofTimestamp(params.proofVerificationData.publicInputs);
        require(block.timestamp - mem.proofTimestamp < 1 hours, "Proof is too old"); // e.g., 1 hour window

        // Use the getBoundData function to get the data bound to the proof
        mem.boundData = mem.helper.getBoundData(params.committedInputs);
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

    function deleteRegistration() external {
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

        // Note that the verifier will return an error if no relevant (age, country, etc) proof has been provided. 
        // We use staticcall here because verifyProof is view and we don't want state changes
        (mem.success, mem.returnData) = address(zkPassportHelper).staticcall(
            abi.encodeWithSelector(functionSelector, 
            abi.encode(input, params.committedInputs))
            );
        require (mem.success, "Proof verification call failed");

        mem.verified = abi.decode(mem.returnData, (bool));
        return mem.verified;
    }
}
