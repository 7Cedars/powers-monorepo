// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test } from "forge-std/Test.sol";
import { TestSetupHelpers } from "../../TestSetup.t.sol";
import {
    ZKPassport_PowersRegistry,
    IZKPassport_PowersRegistry
} from "@src/addons/helpers/ZKPassport_PowersRegistry.sol";
import { DisclosedData } from "@lib/zkpassport-packages/packages/registry-contracts/src/lib/Types.sol";

/// @notice Unit tests for ZKPassport_PowersRegistry
/// @dev Uses the contract's mockAddDisclosedData() function to bypass real ZKPassport
///      oracle infrastructure that is unavailable in local Foundry tests.
contract ZKPassport_PowersRegistryTest is TestSetupHelpers {
    ZKPassport_PowersRegistry public zkReg;

    // Valid non-zero address used as verifier/helper stubs (immutables, never called in mock functions)
    // alice is assigned in BaseSetup.setUpVariables() before this override runs
    function setUp() public override {
        super.setUp();
        // alice is a non-zero EOA — satisfies the zero-address guard in the constructor
        zkReg = new ZKPassport_PowersRegistry(alice, alice, "powers.xyz", "powers");
    }

    // ─── BASIC BEHAVIOUR ───

    /// @notice Constructor stores validDomain
    function testConstructorStoresDomain() public view {
        assertEq(zkReg.validDomain(), "powers.xyz");
    }

    /// @notice Constructor stores validScope
    function testConstructorStoresScope() public view {
        assertEq(zkReg.validScope(), "powers");
    }

    /// @notice Constructor stores the verifier address (accessible via public immutable)
    function testConstructorStoresVerifier() public view {
        assertEq(address(zkReg.zkPassportVerifier()), alice);
    }

    /// @notice mockAddDisclosedData creates a passport entry for an account
    function testMockAddDisclosedDataCreatesEntry() public {
        zkReg.mockAddDisclosedData(alice);
        // getDisclosed should not revert and should return the mock values
        DisclosedData memory data = zkReg.getDisclosed(alice);
        assertEq(data.name, "Mock Entry");
        assertEq(data.issuingCountry, "GBR");
        assertEq(data.nationality, "GBR");
        assertEq(data.gender, "Male");
        assertEq(data.documentNumber, "123456789");
    }

    /// @notice getProofTimestamp returns a non-zero timestamp after mock registration
    function testGetProofTimestampAfterMockRegistration() public {
        zkReg.mockAddDisclosedData(alice);
        uint256 ts = zkReg.getProofTimestamp(alice);
        // mockAddDisclosedData stores block.timestamp; non-zero in a Foundry test
        assertGt(ts, 0);
    }

    /// @notice getIsFacematched returns true for a mock-registered account
    function testGetIsFacematchedTrueForMockEntry() public {
        zkReg.mockAddDisclosedData(alice);
        assertTrue(zkReg.getIsFacematched(alice));
    }

    // ─── EDGE CASES ───

    /// @notice deleteProof removes the mock entry so subsequent getters revert
    function testDeleteProofRemovesEntry() public {
        zkReg.mockAddDisclosedData(alice);
        // Confirm it is there first
        zkReg.getDisclosed(alice); // should not revert

        vm.prank(alice);
        zkReg.deleteProof();

        // After deletion all getters should revert with "No registration found"
        vm.expectRevert("No registration found");
        zkReg.getDisclosed(alice);
    }

    /// @notice getProofTimestamp reverts after the entry is deleted
    function testGetProofTimestampRevertsAfterDelete() public {
        zkReg.mockAddDisclosedData(alice);

        vm.prank(alice);
        zkReg.deleteProof();

        vm.expectRevert("No registration found");
        zkReg.getProofTimestamp(alice);
    }

    /// @notice getIsFacematched reverts after the entry is deleted
    function testGetIsFacematchedRevertsAfterDelete() public {
        zkReg.mockAddDisclosedData(alice);

        vm.prank(alice);
        zkReg.deleteProof();

        vm.expectRevert("No registration found");
        zkReg.getIsFacematched(alice);
    }

    /// @notice Multiple accounts can be independently registered
    function testMultipleAccountsCanBeRegistered() public {
        zkReg.mockAddDisclosedData(alice);
        zkReg.mockAddDisclosedData(bob);

        DisclosedData memory aliceData = zkReg.getDisclosed(alice);
        DisclosedData memory bobData = zkReg.getDisclosed(bob);

        // Both should have the mock entry name
        assertEq(aliceData.name, "Mock Entry");
        assertEq(bobData.name, "Mock Entry");
    }

    /// @notice Deleting one account does not affect another's registration
    function testDeleteOneAccountDoesNotAffectOther() public {
        zkReg.mockAddDisclosedData(alice);
        zkReg.mockAddDisclosedData(bob);

        vm.prank(alice);
        zkReg.deleteProof();

        // Bob's entry should still be accessible
        DisclosedData memory bobData = zkReg.getDisclosed(bob);
        assertEq(bobData.name, "Mock Entry");

        // Alice's entry should be gone
        vm.expectRevert("No registration found");
        zkReg.getDisclosed(alice);
    }

    // ─── ACCESS CONTROL ───

    /// @notice Constructor reverts when the verifier address is address(0)
    function testConstructorRevertsZeroVerifier() public {
        vm.expectRevert("ZKPassport: Invalid zero address");
        new ZKPassport_PowersRegistry(address(0), alice, "powers.xyz", "powers");
    }

    /// @notice getDisclosed reverts when the account has never been registered
    function testGetDisclosedRevertsNoRegistration() public {
        vm.expectRevert("No registration found");
        zkReg.getDisclosed(alice);
    }

    /// @notice getProofTimestamp reverts when the account has never been registered
    function testGetProofTimestampRevertsNoRegistration() public {
        vm.expectRevert("No registration found");
        zkReg.getProofTimestamp(alice);
    }

    /// @notice getIsFacematched reverts when the account has never been registered
    function testGetIsFacematchedRevertsNoRegistration() public {
        vm.expectRevert("No registration found");
        zkReg.getIsFacematched(alice);
    }

    /// @notice deleteProof reverts when the caller has no registration
    function testDeleteProofRevertsNoRegistration() public {
        vm.prank(alice);
        vm.expectRevert("No registration found");
        zkReg.deleteProof();
    }

    /// @notice deleteProof reverts when called by a different account than the one registered
    function testDeleteProofRevertsWrongCaller() public {
        zkReg.mockAddDisclosedData(alice);

        // bob tries to delete alice's proof — alice's identifier was registered to alice
        // bob has no identifier at all, so "No registration found" triggers first
        vm.prank(bob);
        vm.expectRevert("No registration found");
        zkReg.deleteProof();
    }

    // ─── ADDITIONAL EDGE CASES ───

    /// @notice mockAddDisclosedData called twice on the same account overwrites the entry
    /// with a fresh identifier (different block.timestamp). The newer proof timestamp is returned.
    function testMockAddDisclosedDataOverwritesPreviousEntry() public {
        zkReg.mockAddDisclosedData(alice);
        uint256 ts1 = zkReg.getProofTimestamp(alice);

        vm.warp(block.timestamp + 100);
        zkReg.mockAddDisclosedData(alice);
        uint256 ts2 = zkReg.getProofTimestamp(alice);

        assertGt(ts2, ts1);
        // After overwrite getDisclosed still resolves correctly
        DisclosedData memory data = zkReg.getDisclosed(alice);
        assertEq(data.name, "Mock Entry");
    }

    /// @notice Constructor does not validate zkPassportHelper for address(0), unlike
    /// zkPassportVerifier. This asymmetry is documented here. A zero helper would only
    /// fail at runtime inside registerProof when zkPassportHelper is called.
    function testConstructorAcceptsZeroHelper() public {
        // Should not revert — only verifier is validated
        new ZKPassport_PowersRegistry(alice, address(0), "powers.xyz", "powers");
    }

    // FAILING: registerProof requires a live ZKPassport verifier that cannot be supplied
    // in a local Foundry environment — zkPassportVerifier.verify() has no available stub.
    // All other surface area of the contract is exercised by the mock-based tests above.
    // To test registerProof: use a forked test against a network where the ZKPassport
    // verifier is deployed, or introduce a IZKPassportVerifier stub in test/mocks/.
}
