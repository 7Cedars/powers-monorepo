// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {
    DisclosedData,
    ProofVerificationParams,
    BoundData,
    FaceMatchMode,
    OS
} from "@lib/circuits/src/solidity/src/Types.sol";

/// @title ZKPassport Interfaces

/**
 * @notice The public interface for the ZKPassport verifier contract
 */
interface IZKPassportVerifier {
    /**
     * @notice Verifies a proof from ZKPassport
     * @param params The proof verification parameters
     * @return verified True if the proof is valid, false otherwise
     * @return uniqueIdentifier The unique identifier associated to the identity document that generated the proof
     * @return helper The ZKPassportHelper contract that can be used to verify the information or conditions that are checked by the proof
     */
    function verify(ProofVerificationParams calldata params)
        external
        returns (bool verified, bytes32 uniqueIdentifier, IZKPassportHelper helper);
}

/**
 * @notice You can use to helper contract verifying the information or conditions that are checked by the proof
 */
interface IZKPassportHelper {
    /**
     * @notice Verifies that the proof was generated for the given domain and scope
     * @param publicInputs The public inputs of the proof
     * @param domain The domain to check against (must match exactly the domain you specified in the SDK)
     * @param scope The scope to check against (must match exactly the scope you specified in the request using the TypeScript SDK)
     * @return True if the proof was generated for the given domain and scope, false otherwise
     */
    function verifyScopes(bytes32[] calldata publicInputs, string calldata domain, string calldata scope)
        external
        pure
        returns (bool);

    // ===== Helper functions to get the information revealed by the proof =====

    // ===== Retrieve the disclosed data =====

    /**
     * @notice Gets the data disclosed by the proof
     * @param committedInputs The committed inputs
     * @param isIDCard Whether the proof is an ID card
     * @return disclosedData The data disclosed by the proof
     */
    function getDisclosedData(bytes calldata committedInputs, bool isIDCard)
        external
        pure
        returns (DisclosedData memory);

    // ===== Retrieve the bound data =====

    /**
     * @notice Gets the data bound to the proof
     * @param committedInputs The committed inputs
     * @return boundData The data bound to the proof
     */
    function getBoundData(bytes calldata committedInputs) external pure returns (BoundData memory);

    // ===== Age verification =====

    /**
     * @notice Checks if the age is above or equal to the given age
     * @param minAge The age must be above or equal to this age
     * @param committedInputs The committed inputs
     * @return True if the age is above or equal to the given age, false otherwise
     */
    function isAgeAboveOrEqual(uint8 minAge, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the age is above the given age
     * @param minAge The age must be above this age
     * @param committedInputs The committed inputs
     * @return True if the age is above the given age, false otherwise
     */
    function isAgeAbove(uint8 minAge, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the age is in the given range
     * @param minAge The age must be greater than or equal to this age
     * @param maxAge The age must be less than or equal to this age
     * @param committedInputs The committed inputs
     * @return True if the age is in the given range, false otherwise
     */
    function isAgeBetween(uint8 minAge, uint8 maxAge, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the age is below or equal to the given age
     * @param maxAge The age must be below or equal to this age
     * @param committedInputs The committed inputs
     * @return True if the age is below or equal to the given age, false otherwise
     */
    function isAgeBelowOrEqual(uint8 maxAge, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the age is below the given age
     * @param maxAge The age must be below this age
     * @param committedInputs The committed inputs
     * @return True if the age is below the given age, false otherwise
     */
    function isAgeBelow(uint8 maxAge, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the age is equal to the given age
     * @param age The age must be equal to this age
     * @param committedInputs The committed inputs
     * @return True if the age is equal to the given age, false otherwise
     */
    function isAgeEqual(uint8 age, bytes calldata committedInputs) external pure returns (bool);

    // ===== Birthdate comparison =====

    /**
     * @notice Checks if the birthdate is after or equal to the given date
     * @param minDate The birthdate must be after or equal to this date
     * @param committedInputs The committed inputs
     * @return True if the birthdate is after or equal to the given date, false otherwise
     */
    function isBirthdateAfterOrEqual(uint256 minDate, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the birthdate is after the given date
     * @param minDate The birthdate must be after this date
     * @param committedInputs The committed inputs
     * @return True if the birthdate is after the given date, false otherwise
     */
    function isBirthdateAfter(uint256 minDate, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the birthdate is between the given dates
     * @param minDate The birthdate must be after or equal to this date
     * @param maxDate The birthdate must be before or equal to this date
     * @param committedInputs The committed inputs
     * @return True if the birthdate is between the given dates, false otherwise
     */
    function isBirthdateBetween(uint256 minDate, uint256 maxDate, bytes calldata committedInputs)
        external
        pure
        returns (bool);

    /**
     * @notice Checks if the birthdate is before or equal to the given date
     * @param maxDate The birthdate must be before or equal to this date
     * @param committedInputs The committed inputs
     * @return True if the birthdate is before or equal to the given date, false otherwise
     */
    function isBirthdateBeforeOrEqual(uint256 maxDate, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the birthdate is before the given date
     * @param maxDate The birthdate must be before this date
     * @param committedInputs The committed inputs
     * @return True if the birthdate is before the given date, false otherwise
     */
    function isBirthdateBefore(uint256 maxDate, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the birthdate is equal to the given date
     * @param date The birthdate must be equal to this date
     * @param committedInputs The committed inputs
     * @return True if the birthdate is equal to the given date, false otherwise
     */
    function isBirthdateEqual(uint256 date, bytes calldata committedInputs) external pure returns (bool);

    // ===== Expiry date comparison =====

    /**
     * @notice Checks if the expiry date is after or equal to the given date
     * @param minDate The expiry date must be after or equal to this date
     * @param committedInputs The committed inputs
     * @return True if the expiry date is after or equal to the given date, false otherwise
     */
    function isExpiryDateAfterOrEqual(uint256 minDate, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the expiry date is after the given date
     * @param minDate The expiry date must be after this date
     * @param committedInputs The committed inputs
     * @return True if the expiry date is after the given date, false otherwise
     */
    function isExpiryDateAfter(uint256 minDate, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the expiry date is between the given dates
     * @param minDate The expiry date must be after or equal to this date
     * @param maxDate The expiry date must be before or equal to this date
     * @param committedInputs The committed inputs
     * @return True if the expiry date is between the given dates, false otherwise
     */
    function isExpiryDateBetween(uint256 minDate, uint256 maxDate, bytes calldata committedInputs)
        external
        pure
        returns (bool);

    /**
     * @notice Checks if the expiry date is before or equal to the given date
     * @param maxDate The expiry date must be before or equal to this date
     * @param committedInputs The committed inputs
     * @return True if the expiry date is before or equal to the given date, false otherwise
     */
    function isExpiryDateBeforeOrEqual(uint256 maxDate, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the expiry date is before the given date
     * @param maxDate The expiry date must be before this date
     * @param committedInputs The committed inputs
     * @return True if the expiry date is before the given date, false otherwise
     */
    function isExpiryDateBefore(uint256 maxDate, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the expiry date is equal to the given date
     * @param date The expiry date must be equal to this date
     * @param committedInputs The committed inputs
     * @return True if the expiry date is equal to the given date, false otherwise
     */
    function isExpiryDateEqual(uint256 date, bytes calldata committedInputs) external pure returns (bool);

    // ===== Country inclusion =====

    /**
     * @notice Checks if the nationality is in the list of countries
     * @param countryList The list of countries (needs to match exactly the list of countries in the proof)
     * @param committedInputs The committed inputs
     * @return True if the nationality is in the list of countries, false otherwise
     */
    function isNationalityIn(string[] memory countryList, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the issuing country is in the list of countries
     * @param countryList The list of countries (needs to match exactly the list of countries in the proof)
     * @param committedInputs The committed inputs
     * @return True if the issuing country is in the list of countries, false otherwise
     */
    function isIssuingCountryIn(string[] memory countryList, bytes calldata committedInputs)
        external
        pure
        returns (bool);

    // ===== Country exclusion =====

    /**
     * @notice Checks if the nationality is not in the list of countries
     * @param countryList The list of countries (needs to match exactly the list of countries in the proof)
     * Note: The list of countries must be sorted in alphabetical order
     * @param committedInputs The committed inputs
     * @return True if the nationality is not in the list of countries, false otherwise
     */
    function isNationalityOut(string[] memory countryList, bytes calldata committedInputs) external pure returns (bool);

    /**
     * @notice Checks if the issuing country is not in the list of countries
     * @param countryList The list of countries (needs to match exactly the list of countries in the proof)
     * Note: The list of countries must be sorted in alphabetical order
     * @param committedInputs The committed inputs
     * @return True if the issuing country is not in the list of countries, false otherwise
     */
    function isIssuingCountryOut(string[] memory countryList, bytes calldata committedInputs)
        external
        pure
        returns (bool);

    // ===== Sanction checks =====

    /**
     * @notice Checks if the sanctions root is valid against the expected sanction list(s)
     * Does not revert if the sanctions check fails but returns false instead.
     * @param currentTimestamp The current timestamp (preferably from the proof rather than the block timestamp).
     * This is used to check the validity of the sanctions root at that specific time.
     * @param isStrict Whether the sanctions check was strict or not
     * @param committedInputs The committed inputs
     * @return True if the sanctions root is valid against the expected sanction list(s), false otherwise
     */
    function isSanctionsRootValid(uint256 currentTimestamp, bool isStrict, bytes calldata committedInputs)
        external
        pure
        returns (bool);

    /**
     * @notice Enforces that the proof checks against the expected sanction list(s)
     * Reverts if the sanctions check fails
     * @param currentTimestamp The current timestamp (preferably from the proof rather than the block timestamp).
     * This is used to check the validity of the sanctions root at that specific time.
     * @param isStrict Whether the sanctions check was strict or not
     * @param committedInputs The committed inputs
     */
    function enforceSanctionsRoot(uint256 currentTimestamp, bool isStrict, bytes calldata committedInputs) external view;

    /**
     * @notice Checks if the proof is tied to a FaceMatch verification
     * @param faceMatchMode The FaceMatch mode expected to be used in the verification
     * @param os The operating system on which the proof should have been generated (Any (0), iOS (1), Android (2))
     * @param committedInputs The committed inputs
     * @return True if the proof is tied to a valid FaceMatch verification, false otherwise
     */
    function isFaceMatchVerified(FaceMatchMode faceMatchMode, OS os, bytes calldata committedInputs)
        external
        pure
        returns (bool);

    /**
     * @notice Gets the timestamp the proof was generated at
     * @param publicInputs The public inputs of the proof
     * @return The timestamp the proof was generated at
     */
    function getProofTimestamp(bytes32[] calldata publicInputs) external pure returns (uint256);
}
