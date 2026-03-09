// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { DisclosedData, ProofVerificationParams, BoundData } from "@zkpassport/circuits/src/Types.sol";
import { IZKPassportVerifier, IZKPassportHelper, FaceMatchMode, OS } from "@src/interfaces/IZKPassport.sol";

import { console } from "forge-std/console.sol"; // only for testing purposes.

/// @title ZKPassport Powers Registry
/// @notice Helper contract to verify and register ZKPassport identities for the Powers protocol.
/// @author 7Cedars
interface IZKPassport_PowersRegistry {
    function registerProof(ProofVerificationParams calldata params, bool isIdCard) external returns (bytes32 identifier);
    function deleteProof() external;
    function getDisclosed(address account) external view returns (DisclosedData memory);
    function getProofTimestamp(address account) external view returns (uint256);
    function getIsFacematched(address account) external view returns (bool);
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

    struct Disclosed {
        DisclosedData disclosedData;
        bool isFacematched;
        uint256 timestamp;
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
    mapping(bytes32 => address) internal identifierAccounts;

    // Mapping from unique identifier to proof verification parameters
    mapping(bytes32 => Disclosed) internal identifierToDisclosedData;
 
    // Domain and Scope for ZKPassport verification
    string public validDomain;
    string public validScope;

    //////////////////////////////////////////////////////////////
    //                        EVENTS                            //
    //////////////////////////////////////////////////////////////
    event IdentityRegistered(address indexed account, bytes32 indexed identifier); 
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
    //            VERIFICATION AND REGISTRATION                 //
    //////////////////////////////////////////////////////////////

    /// @notice Verify a ZKPassport proof and register the identity and disclosed data.
    /// @param params The proof verification parameters from ZKPassport SDK. 
    /// @param isIDCard A boolean indicating if the proof is for an ID card.
    /// @return identifier The unique identifier of the passport.
    function registerProof(
        ProofVerificationParams calldata params, bool isIDCard
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
        // Make sure the chain id is the same as the one you specified in the query builder
        require(mem.boundData.chainId == block.chainid, "Invalid chain id"); 
        // Making sure the string is empty
        require(bytes(mem.boundData.customData).length == 0, "Custom data should be empty");

        // if all checks pass, retrieve disclosed data 
        DisclosedData memory disclosedData = zkPassportHelper.getDisclosedData(
          params.committedInputs,
          isIDCard
        ); 
        // console.log here the disclosed data for testing purposes? 
        console.log("Disclosed Data:");
        console.log(disclosedData.name);
        console.log(disclosedData.issuingCountry); 
        console.log(disclosedData.nationality);
        console.log(disclosedData.birthDate);

        bool hasFacematch; 
        try zkPassportHelper.isFaceMatchVerified(FaceMatchMode.REGULAR, OS.ANY, params.committedInputs) returns (bool facematchResult) {
            hasFacematch = facematchResult;
        } catch {
            hasFacematch = false; // If the call fails, we assume facematch is not verified
        }

        // Store the unique identifier
        accountIdentifiers[msg.sender] = mem.uniqueIdentifier;
        identifierAccounts[mem.uniqueIdentifier] = msg.sender;
        identifierToDisclosedData[mem.uniqueIdentifier] = Disclosed({
            disclosedData: disclosedData,
            isFacematched: hasFacematch,
            timestamp: mem.proofTimestamp
        }); 

        emit IdentityRegistered(msg.sender, mem.uniqueIdentifier);
        return mem.uniqueIdentifier;
    }

    //////////////////////////////////////////////////////////////
    //                      DELETE PROOF                        //
    //////////////////////////////////////////////////////////////

    function deleteProof() external {
        bytes32 identifier = accountIdentifiers[msg.sender];
        require(identifier != bytes32(0), "No registration found");

        require (
            identifierAccounts[identifier] == msg.sender, 
            "Identifier not registered to caller"
        );

        delete accountIdentifiers[msg.sender];
        delete identifierAccounts[identifier];
        delete identifierToDisclosedData[identifier];
        emit IdentityDeleted(identifier, msg.sender);
    }

    //////////////////////////////////////////////////////////////
    //                      GETTER FUNCTIONS                    //
    //////////////////////////////////////////////////////////////

    function getDisclosed(address account) external view returns (DisclosedData memory) {
        bytes32 identifier = accountIdentifiers[account];
        require(identifier != bytes32(0), "No registration found");
        return identifierToDisclosedData[identifier].disclosedData;
    }

    function getProofTimestamp(address account) external view returns (uint256) {
        bytes32 identifier = accountIdentifiers[account];
        require(identifier != bytes32(0), "No registration found");
        return identifierToDisclosedData[identifier].timestamp;
    }

    function getIsFacematched(address account) external view returns (bool) {
        bytes32 identifier = accountIdentifiers[account];
        require(identifier != bytes32(0), "No registration found");
        return identifierToDisclosedData[identifier].isFacematched;
    }
}