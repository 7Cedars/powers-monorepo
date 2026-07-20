// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { MandateRegistry } from "@src/core/helpers/MandateRegistry.sol";
import { Ownable } from "@lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/// @notice Unit tests for MandateRegistry
/// @dev Covers registerMandate error paths, deactivateMandate, reactivateMandate,
///      getMandateEntry, getLatestVersion, isVersionActive false branch, and packVersion.
contract MandateRegistryTest is TestSetupHelpers {
    MandateRegistry freshRegistry;
    address openActionAddr;

    function setUp() public override {
        super.setUp();

        // Deploy a registry owned by the test contract so we can call owner-only functions directly.
        freshRegistry = new MandateRegistry(address(this));

        // Grab a real mandate address that already implements IMandate.
        openActionAddr = registry.getMandateAddress(MAJOR, MINOR, PATCH, "OpenAction");
    }

    // ─── BASIC BEHAVIOUR ───

    function testRegisterMandateSucceeds() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));

        (uint16 maj, uint16 min, uint16 pat) = freshRegistry.getLatestVersion("OpenAction");
        assertEq(maj, MAJOR);
        assertEq(min, MINOR);
        assertEq(pat, PATCH);
    }

    function testRegisterMandateStoresEntry() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));

        MandateRegistry.MandateEntry memory entry = freshRegistry.getMandateEntry(MAJOR, MINOR, PATCH, "OpenAction");

        assertEq(entry.mandateAddress, openActionAddr);
        assertTrue(entry.isActive);
        assertGt(entry.registeredAt, 0);
    }

    function testRegisterMandateMarksCreationCodeHash() public {
        bytes32 codeHash = bytes32(uint256(42));
        freshRegistry.registerMandate("OpenAction", openActionAddr, codeHash);

        assertTrue(freshRegistry.isMandateRegistered(codeHash));
    }

    function testPackVersionProducesExpectedValue() public view {
        uint48 packed = freshRegistry.packVersion(1, 2, 3);
        uint48 expected = (uint48(1) << 32) | (uint48(2) << 16) | uint48(3);
        assertEq(packed, expected);
    }

    function testPackVersionZeroes() public view {
        assertEq(freshRegistry.packVersion(0, 0, 0), 0);
    }

    function testIsVersionActiveReturnsTrueWhenRegistered() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));

        assertTrue(freshRegistry.isVersionActive(MAJOR, MINOR, PATCH, "OpenAction"));
    }

    function testGetMandateEntryReturnsCorrectAddress() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));

        MandateRegistry.MandateEntry memory entry = freshRegistry.getMandateEntry(MAJOR, MINOR, PATCH, "OpenAction");

        assertEq(entry.mandateAddress, openActionAddr);
    }

    function testGetLatestVersionAfterRegistration() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));

        (uint16 maj, uint16 min, uint16 pat) = freshRegistry.getLatestVersion("OpenAction");
        assertEq(maj, MAJOR);
        assertEq(min, MINOR);
        assertEq(pat, PATCH);
    }

    function testDeactivateMandateSucceeds() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");

        MandateRegistry.MandateEntry memory entry = freshRegistry.getMandateEntry(MAJOR, MINOR, PATCH, "OpenAction");
        assertFalse(entry.isActive);
    }

    function testReactivateMandateSucceeds() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");
        freshRegistry.reactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");

        MandateRegistry.MandateEntry memory entry = freshRegistry.getMandateEntry(MAJOR, MINOR, PATCH, "OpenAction");
        assertTrue(entry.isActive);
    }

    function testBatchRegisterMatchingArraysSucceeds() public {
        string[] memory names = new string[](1);
        address[] memory addrs = new address[](1);
        bytes32[] memory hashes = new bytes32[](1);
        names[0] = "OpenAction";
        addrs[0] = openActionAddr;
        hashes[0] = bytes32(uint256(99));

        freshRegistry.batchRegisterMandates(names, addrs, hashes);

        assertTrue(freshRegistry.isVersionActive(MAJOR, MINOR, PATCH, "OpenAction"));
    }

    // ─── EDGE CASES ───

    function testIsVersionActiveReturnsFalseWhenNotRegistered() public view {
        // Nothing registered — must return false without reverting.
        assertFalse(freshRegistry.isVersionActive(MAJOR, MINOR, PATCH, "NonExistent"));
    }

    function testIsVersionActiveReturnsFalseAfterDeactivation() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");

        assertFalse(freshRegistry.isVersionActive(MAJOR, MINOR, PATCH, "OpenAction"));
    }

    function testGetLatestVersionRevertsWhenNoneRegistered() public {
        vm.expectRevert("No versions registered for this mandate");
        freshRegistry.getLatestVersion("NoSuchMandate");
    }

    function testRegisterMandateRevertsEmptyName() public {
        vm.expectRevert(MandateRegistry.InvalidNameLength.selector);
        freshRegistry.registerMandate("", openActionAddr, bytes32(uint256(1)));
    }

    function testRegisterMandateRevertsNameTooLong() public {
        // Build a 256-character name (exceeds the 255 byte limit).
        bytes memory nameBytes = new bytes(256);
        for (uint256 idx = 0; idx < 256; idx++) {
            nameBytes[idx] = 0x41; // 'A'
        }
        vm.expectRevert(MandateRegistry.InvalidNameLength.selector);
        freshRegistry.registerMandate(string(nameBytes), openActionAddr, bytes32(uint256(1)));
    }

    function testRegisterMandateRevertsZeroAddress() public {
        vm.expectRevert(MandateRegistry.InvalidMandateAddress.selector);
        freshRegistry.registerMandate("OpenAction", address(0), bytes32(uint256(1)));
    }

    function testRegisterMandateRevertsInvalidInterface() public {
        // alice is an EOA — does not implement IMandate.
        vm.expectRevert(abi.encodeWithSelector(MandateRegistry.InvalidMandateInterface.selector, alice));
        freshRegistry.registerMandate("OpenAction", alice, bytes32(uint256(1)));
    }

    function testRegisterMandateRevertsAlreadyRegistered() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));

        vm.expectRevert(
            abi.encodeWithSelector(MandateRegistry.MandateAlreadyRegistered.selector, MAJOR, MINOR, PATCH, "OpenAction")
        );
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(2)));
    }

    function testRegisterMandateRevertsInactiveVersion() public {
        // Register then deactivate — re-registering the same (name, version) must revert with MandateInactive.
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");

        vm.expectRevert(
            abi.encodeWithSelector(MandateRegistry.MandateInactive.selector, MAJOR, MINOR, PATCH, "OpenAction")
        );
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(2)));
    }

    function testGetMandateEntryRevertsWhenNotFound() public {
        vm.expectRevert(
            abi.encodeWithSelector(MandateRegistry.MandateNotFound.selector, MAJOR, MINOR, PATCH, "Missing")
        );
        freshRegistry.getMandateEntry(MAJOR, MINOR, PATCH, "Missing");
    }

    function testDeactivateMandateRevertsWhenNotFound() public {
        vm.expectRevert(
            abi.encodeWithSelector(MandateRegistry.MandateNotFound.selector, MAJOR, MINOR, PATCH, "OpenAction")
        );
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");
    }

    function testDeactivateMandateRevertsWhenAlreadyInactive() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");

        vm.expectRevert(
            abi.encodeWithSelector(MandateRegistry.MandateInactive.selector, MAJOR, MINOR, PATCH, "OpenAction")
        );
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");
    }

    function testReactivateMandateRevertsWhenNotFound() public {
        vm.expectRevert(
            abi.encodeWithSelector(MandateRegistry.MandateNotFound.selector, MAJOR, MINOR, PATCH, "OpenAction")
        );
        freshRegistry.reactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");
    }

    function testReactivateMandateRevertsWhenAlreadyActive() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));

        vm.expectRevert(
            abi.encodeWithSelector(MandateRegistry.MandateAlreadyRegistered.selector, MAJOR, MINOR, PATCH, "OpenAction")
        );
        freshRegistry.reactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");
    }

    function testBatchRegisterRevertsOnLengthMismatch() public {
        string[] memory names = new string[](2);
        address[] memory addrs = new address[](1);
        bytes32[] memory hashes = new bytes32[](1);
        names[0] = "OpenAction";
        names[1] = "Other";
        addrs[0] = openActionAddr;
        hashes[0] = bytes32(uint256(1));

        vm.expectRevert("Array lengths must match");
        freshRegistry.batchRegisterMandates(names, addrs, hashes);
    }

    // ─── ACCESS CONTROL ───

    function testRegisterMandateRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));
    }

    function testDeactivateMandateRevertsNonOwner() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");
    }

    function testReactivateMandateRevertsNonOwner() public {
        freshRegistry.registerMandate("OpenAction", openActionAddr, bytes32(uint256(1)));
        freshRegistry.deactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        freshRegistry.reactivateMandate(MAJOR, MINOR, PATCH, "OpenAction");
    }

    function testBatchRegisterRevertsNonOwner() public {
        string[] memory names = new string[](1);
        address[] memory addrs = new address[](1);
        bytes32[] memory hashes = new bytes32[](1);
        names[0] = "OpenAction";
        addrs[0] = openActionAddr;
        hashes[0] = bytes32(uint256(1));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        freshRegistry.batchRegisterMandates(names, addrs, hashes);
    }
}
