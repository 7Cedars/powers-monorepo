// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Mandate } from "../../Mandate.sol";
import { MandateUtilities } from "../../libraries/MandateUtilities.sol";
import { ZKPassport_PowersRegistry } from "../../helpers/ZKPassport_PowersRegistry.sol";

/// @title ZKPassport Check Mandate
/// @notice Checks if a caller has a valid ZKPassport proof registered with specific data.
/// @author 7Cedars
contract ZKPassport_Check is Mandate {
    //////////////////////////////////////////////////////////////
    //                        ERRORS                            //
    //////////////////////////////////////////////////////////////
    error ZKPassport_Check__RegistryCheckFailed(string field);
    error ZKPassport_Check__ProofExpired(string field, uint256 timestamp);
    error ZKPassport_Check__ValueMismatch(string field, string expected, string actual);
    error ZKPassport_Check__AgeRequirementNotMet(uint8 minAge, uint256 birthDateInt);
    error ZKPassport_Check__InvalidRegistry();
    error ZKPassport_Check__DateFormatError();

    //////////////////////////////////////////////////////////////
    //                       CONSTANTS                          //
    //////////////////////////////////////////////////////////////
    bytes4 constant CHECK_EQUAL = bytes4(keccak256("EQUAL(string,string)"));
    bytes4 constant CHECK_AGE = bytes4(keccak256("AGE(uint8)"));

    //////////////////////////////////////////////////////////////
    //                       STRUCTS                            //
    //////////////////////////////////////////////////////////////
    struct ConfigParams {
        string[] inputParams;
        address registry;
        string name;
        bytes[] checks;
        uint256 invalidAfterSeconds;
    }

    //////////////////////////////////////////////////////////////
    //                   MANDATE EXECUTION                      //
    //////////////////////////////////////////////////////////////
    
    /// @inheritdoc Mandate
    function handleRequest(
        address caller,
        address powers,
        uint16 mandateId,
        bytes calldata mandateCalldata,
        uint256 nonce
    )
        public
        view
        override
        returns (uint256 actionId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        // Decode config
        bytes memory configBytes = getConfig(powers, mandateId);
        ConfigParams memory config = abi.decode(configBytes, (ConfigParams));
        
        if (config.registry == address(0)) revert ZKPassport_Check__InvalidRegistry();

        ZKPassport_PowersRegistry registry = ZKPassport_PowersRegistry(config.registry);

        // Iterate through all checks
        for (uint256 i = 0; i < config.checks.length; i++) {
            bytes memory checkData = config.checks[i];
            // Decode selector and params: abi.encode(bytes4 selector, bytes params)
            // But usually config.checks is just the bytes.
            // Let's assume the bytes themselves are encoded as (bytes4 selector, bytes args)
            // Wait, we need to be able to decode it.
            // Let's try to decode the first 32 bytes as selector? No selector is 4 bytes.
            
            // We can just slice or use abi.decode if it was encoded as a tuple.
            // Let's assume `checkData` IS the `abi.encodeWithSelector(...)` result.
            bytes4 selector = bytes4(checkData);
            
            if (selector == CHECK_EQUAL) {
                // Decode params: (string field, string expectedValue)
                (string memory field, string memory expectedValue) = abi.decode(getArgs(checkData), (string, string));
                _checkEqual(registry, caller, field, expectedValue, config.invalidAfterSeconds);
            } else if (selector == CHECK_AGE) {
                // Decode params: (uint8 minAge)
                (uint8 minAge) = abi.decode(getArgs(checkData), (uint8));
                _checkAge(registry, caller, minAge, config.invalidAfterSeconds);
            }
            // Add more check types here as needed
        }
        
        // Name check if configured
        if (bytes(config.name).length > 0) {
            _checkEqual(registry, caller, "name", config.name, config.invalidAfterSeconds);
        }
        
        return (0, new address[](0), new uint256[](0), new bytes[](0));
    }

    //////////////////////////////////////////////////////////////
    //                     INTERNAL CHECKS                      //
    //////////////////////////////////////////////////////////////

    function _checkEqual(
        ZKPassport_PowersRegistry registry,
        address caller,
        string memory field,
        string memory expectedValue,
        uint256 invalidAfterSeconds
    ) internal view {
        (string memory actualValue, uint256 timestamp) = registry.getDisclosedData(caller, field);
        
        if (timestamp == 0) revert ZKPassport_Check__RegistryCheckFailed(field);
        if (block.timestamp > timestamp + invalidAfterSeconds) revert ZKPassport_Check__ProofExpired(field, timestamp);
        
        if (keccak256(bytes(actualValue)) != keccak256(bytes(expectedValue))) {
            revert ZKPassport_Check__ValueMismatch(field, expectedValue, actualValue);
        }
    }

    function _checkAge(
        ZKPassport_PowersRegistry registry,
        address caller,
        uint8 minAge,
        uint256 invalidAfterSeconds
    ) internal view {
        (string memory birthDateStr, uint256 timestamp) = registry.getDisclosedData(caller, "birthDate");
        
        if (timestamp == 0) revert ZKPassport_Check__RegistryCheckFailed("birthDate");
        if (block.timestamp > timestamp + invalidAfterSeconds) revert ZKPassport_Check__ProofExpired("birthDate", timestamp);

        // Parse birthDateStr (Assume YYYYMMDD or YYYY-MM-DD)
        // We only care about YYYYMMDD.
        // We need to calculate age. 
        // Simple approximation: (CurrentTime - BirthTime) / 365.25 days >= minAge
        
        uint256 birthTimestamp = _parseDateToTimestamp(birthDateStr);
        uint256 ageSeconds = block.timestamp - birthTimestamp;
        uint256 minAgeSeconds = uint256(minAge) * 365 days; // Approximation, simpler than full leap year logic
        // 365.25 days is better: 31557600 seconds/year
        minAgeSeconds = uint256(minAge) * 31557600;

        if (ageSeconds < minAgeSeconds) {
            revert ZKPassport_Check__AgeRequirementNotMet(minAge, birthTimestamp);
        }
    }

    // Helper to parse date string to timestamp
    // Supports YYYYMMDD or YYYY-MM-DD
    function _parseDateToTimestamp(string memory dateStr) internal pure returns (uint256) {
        bytes memory d = bytes(dateStr);
        uint year;
        uint month;
        uint day;

        if (d.length == 8) {
            // YYYYMMDD
            year = _parseInt(d, 0, 4);
            month = _parseInt(d, 4, 2);
            day = _parseInt(d, 6, 2);
        } else if (d.length == 10) {
            // YYYY-MM-DD
            year = _parseInt(d, 0, 4);
            month = _parseInt(d, 5, 2);
            day = _parseInt(d, 8, 2);
        } else {
            revert ZKPassport_Check__DateFormatError();
        }

        return _toTimestamp(year, month, day);
    }

    function _parseInt(bytes memory data, uint offset, uint length) internal pure returns (uint) {
        uint result = 0;
        for (uint i = 0; i < length; i++) {
            uint8 c = uint8(data[offset + i]);
            if (c < 48 || c > 57) revert ZKPassport_Check__DateFormatError();
            result = result * 10 + (c - 48);
        }
        return result;
    }

    // Simplified timestamp calculation (BokkyPooBah's logic simplified)
    function _toTimestamp(uint year, uint month, uint day) internal pure returns (uint timestamp) {
        uint256 c_years = year - 1970;
        uint256 i_leap_years = (year - 1969) / 4; // Simplified leap year count since 1970
        
        // Days in months (non-leap)
        uint256[12] memory daysInMonth = [uint256(31), 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        
        uint256 days_from_months = 0;
        for (uint i = 0; i < month - 1; i++) {
            days_from_months += daysInMonth[i];
        }
        
        // Adjust for leap year if month > 2
        if (month > 2 && (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0))) {
            days_from_months += 1;
        }

        uint256 total_days = (c_years * 365) + i_leap_years + days_from_months + (day - 1);
        timestamp = total_days * 1 days;
    }

    // Helper to slice bytes to get args (skip selector)
    function getArgs(bytes memory data) internal pure returns (bytes memory) {
        if (data.length < 4) return "";
        bytes memory args = new bytes(data.length - 4);
        for (uint i = 0; i < data.length - 4; i++) {
            args[i] = data[i + 4];
        }
        return args;
    }
}
