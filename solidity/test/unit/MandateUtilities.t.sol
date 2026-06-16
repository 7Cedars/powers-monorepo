// SPDX-License-Identifier: MIT

/// @title MandateUtilitiesTest - Unit tests for MandateUtilities library
/// @notice Tests the MandateUtilities library functions
/// @dev Provides comprehensive coverage of all MandateUtilities functions
/// @author 7Cedars

pragma solidity ^0.8.26;

import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";
import { TestSetupMandate } from "../TestSetup.t.sol";

// Harness exposes internal library functions as external calls so vm.expectRevert can intercept reverts.
contract MandateUtilitiesHarness {
    function arrayifyBools(uint256 numBools) external pure returns (bool[] memory) {
        return MandateUtilities.arrayifyBools(numBools);
    }

    function hexStringToBytes(string calldata hexString) external pure returns (bytes memory) {
        return MandateUtilities.hexStringToBytes(hexString);
    }
}

contract MandateUtilitiesTest is TestSetupMandate {
    MandateUtilitiesHarness internal harness;

    function setUp() public override {
        super.setUp();
        harness = new MandateUtilitiesHarness();
    }

    //////////////////////////////////////////////////////////////
    //                  HELPER FUNCTIONS                        //
    //////////////////////////////////////////////////////////////
    function testHashActionId() public {
        mandateId = 1;
        mandateCalldata = abi.encode(true);
        nonce = 123;

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(actionId, uint256(keccak256(abi.encode(mandateId, mandateCalldata, nonce))));
    }

    function testHashMandate() public {
        mandateId = 1;
        mandateHash = MandateUtilities.hashMandate(address(daoMock), mandateId);
        assertEq(mandateHash, keccak256(abi.encode(address(daoMock), mandateId)));
    }

    function testCreateEmptyArrays() public {
        uint256 length = 3;
        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(length);

        assertEq(targets.length, length);
        assertEq(values.length, length);
        assertEq(calldatas.length, length);
    }

    //////////////////////////////////////////////////////////////
    //                  ARRAY UTILITIES                         //
    //////////////////////////////////////////////////////////////

    function testArrayifyBoolsEmptyArrayPasses(uint256 numBools) public pure {
        numBools = bound(numBools, 0, 1000);
        bool[] memory result = MandateUtilities.arrayifyBools(numBools);

        assertEq(result.length, numBools);
    }

    function testArrayifyBoolsRevertsWhenTooLarge(uint256 numBools) public {
        numBools = bound(numBools, 1001, type(uint256).max);

        vm.expectRevert("Num bools too large");
        harness.arrayifyBools(numBools);
    }

    function testArrayifyBoolsAssemblyBehavior() public {
        for (i = 0; i <= 5; i++) {
            bool[] memory result = MandateUtilities.arrayifyBools(i);
            assertEq(result.length, i);
        }
    }

    //////////////////////////////////////////////////////////////
    //                  HEX CONVERSION                          //
    //////////////////////////////////////////////////////////////

    function testHexStringToBytesWithLowercaseInput() public pure {
        // covers hexToByte branches for 0-9 and a-f
        bytes memory result = MandateUtilities.hexStringToBytes("0x1a2b3c");
        assertEq(result.length, 3);
        assertEq(uint8(result[0]), 0x1a);
        assertEq(uint8(result[1]), 0x2b);
        assertEq(uint8(result[2]), 0x3c);
    }

    function testHexStringToBytesWithUppercaseInput() public pure {
        // covers hexToByte branch for A-F
        bytes memory result = MandateUtilities.hexStringToBytes("0xABCDEF");
        assertEq(result.length, 3);
        assertEq(uint8(result[0]), 0xAB);
        assertEq(uint8(result[1]), 0xCD);
        assertEq(uint8(result[2]), 0xEF);
    }

    function testHexStringToBytesWithNumericDigits() public pure {
        bytes memory result = MandateUtilities.hexStringToBytes("0x0123456789");
        assertEq(result.length, 5);
        assertEq(uint8(result[0]), 0x01);
        assertEq(uint8(result[1]), 0x23);
        assertEq(uint8(result[2]), 0x45);
        assertEq(uint8(result[3]), 0x67);
        assertEq(uint8(result[4]), 0x89);
    }

    function testHexStringToBytesRevertsOnInvalidCharacter() public {
        vm.expectRevert("Invalid hex character");
        harness.hexStringToBytes("0xgg");
    }
}
