// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test } from "forge-std/Test.sol";
import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { PowersPaymaster } from "@src/helpers/PowersPaymaster.sol";
import { IEntryPoint } from "@lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import { PackedUserOperation } from "@lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import { IStakeManager } from "@lib/account-abstraction/contracts/interfaces/IStakeManager.sol";

// Mock entry point — needed to construct the paymaster
contract MockEntryPoint is IEntryPoint {
    function depositTo(address) external payable { }
    function withdrawTo(address payable, uint256) external { }
    function handleOps(PackedUserOperation[] calldata, address payable) external { }
    function handleAggregatedOps(IEntryPoint.UserOpsPerAggregator[] calldata, address payable) external { }
    function getSenderAddress(bytes memory) external { }
    function simulateValidation(PackedUserOperation calldata) external { }
    function simulateHandleOp(PackedUserOperation calldata, address, bytes calldata) external { }

    function balanceOf(address) external view returns (uint256) {
        return 0;
    }

    function deposit() external view returns (uint256) {
        return 0;
    }

    function getDepositInfo(address) external view returns (DepositInfo memory) {
        return DepositInfo({ deposit: 100, staked: true, stake: 100, unstakeDelaySec: 100, withdrawTime: 0 });
    }

    function getNonce(address, uint192) external view returns (uint256) {
        return 0;
    }
    function incrementNonce(uint192) external { }
    function addStake(uint32) external payable { }
    function unlockStake() external { }
    function withdrawStake(address payable) external { }
    function delegateAndRevert(address, bytes calldata) external { }

    function getCurrentUserOpHash() external view returns (bytes32) {
        return bytes32(0);
    }

    function getUserOpHash(PackedUserOperation calldata) external view returns (bytes32) {
        return bytes32(0);
    }

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        return interfaceId == type(IEntryPoint).interfaceId || interfaceId == 0x01ffc9a7;
    }
}

/// @notice Unit tests for PowersPaymaster
contract PowersPaymasterTest is TestSetupHelpers {
    PowersPaymaster public paymaster;
    MockEntryPoint public entryPoint;

    function setUp() public override {
        super.setUp();
        entryPoint = new MockEntryPoint();
        // Constructor pushes _powers into sponsoredTargets and calls transferOwnership(_powers)
        paymaster = new PowersPaymaster(entryPoint, address(daoMock));
    }

    // Helper: call validatePaymasterUserOp via the entry point prank
    function callValidate(PackedUserOperation memory userOp)
        internal
        returns (bytes memory context, uint256 validationData)
    {
        vm.prank(address(entryPoint));
        return paymaster.validatePaymasterUserOp(userOp, bytes32(0), 1000);
    }

    // Helper: build a minimal PackedUserOperation with specified calldata
    function buildUserOp(bytes memory cd) internal pure returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: address(0),
            nonce: 0,
            initCode: "",
            callData: cd,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
    }

    // ─── BASIC BEHAVIOUR ───

    /// @notice Constructor pushes _powers into sponsoredTargets[0]
    function testConstructorSetsInitialTarget() public view {
        assertEq(paymaster.sponsoredTargets(0), address(daoMock));
    }

    /// @notice Constructor transfers ownership to the _powers address
    function testConstructorOwnerIsDaoMock() public view {
        assertEq(paymaster.owner(), address(daoMock));
    }

    /// @notice addSponsoredTarget appends a new address and it is retrievable at index 1
    function testAddSponsoredTarget() public {
        vm.prank(address(daoMock));
        paymaster.addSponsoredTarget(alice);
        assertEq(paymaster.sponsoredTargets(1), alice);
    }

    /// @notice removeSponsoredTarget removes an existing address via swap-and-pop
    function testRemoveSponsoredTarget() public {
        vm.prank(address(daoMock));
        paymaster.addSponsoredTarget(alice);
        assertEq(paymaster.sponsoredTargets(1), alice);

        vm.prank(address(daoMock));
        paymaster.removeSponsoredTarget(alice);

        // Only daoMock remains; accessing index 1 should revert
        assertEq(paymaster.sponsoredTargets(0), address(daoMock));
        vm.expectRevert();
        paymaster.sponsoredTargets(1);
    }

    // ─── EDGE CASES ───

    /// @notice EXECUTE_SELECTOR_SIMPLE targeting a sponsored address passes validation
    function testValidateAcceptsSimpleExecuteSelector() public {
        bytes memory cd = abi.encodePacked(
            bytes4(0xb61d27f6), // EXECUTE_SELECTOR_SIMPLE: execute(address,uint256,bytes)
            abi.encode(address(daoMock), uint256(0), bytes(""))
        );
        (, uint256 validationData) = callValidate(buildUserOp(cd));
        assertEq(validationData, 0);
    }

    /// @notice EXECUTE_SELECTOR (LightAccount) targeting a sponsored address passes validation
    function testValidateAcceptsLightAccountSelector() public {
        bytes memory cd = abi.encodePacked(
            bytes4(0x541d63c8), // EXECUTE_SELECTOR: executeUserOpWithErrorString(address,uint256,bytes,uint8)
            abi.encode(address(daoMock), uint256(0), bytes(""), uint8(0))
        );
        (, uint256 validationData) = callValidate(buildUserOp(cd));
        assertEq(validationData, 0);
    }

    /// @notice EXECUTE_SELECTOR_KERNEL targeting a sponsored address passes validation
    function testValidateAcceptsKernelSelector() public {
        // Kernel v3 layout: selector(4) | mode(32) | offset(32) | length(32) | to(20)+value(32)+data(...)
        bytes memory execCalldata = abi.encodePacked(
            address(daoMock), // to — 20 bytes
            uint256(0), // value — 32 bytes
            bytes("") // data — 0 bytes
        );
        bytes memory cd = abi.encodePacked(
            bytes4(0xe9ae5c53), // EXECUTE_SELECTOR_KERNEL
            bytes32(0), // mode (32 bytes)
            uint256(64), // offset to executionCalldata
            uint256(execCalldata.length), // length of executionCalldata
            execCalldata // packed to+value+data
        );
        (, uint256 validationData) = callValidate(buildUserOp(cd));
        assertEq(validationData, 0);
    }

    /// @notice Validation reverts when the target is not in sponsoredTargets
    function testValidateRevertsWrongTarget() public {
        bytes memory cd = abi.encodePacked(
            bytes4(0xb61d27f6), // EXECUTE_SELECTOR_SIMPLE
            abi.encode(bob, uint256(0), bytes(""))
        );
        vm.expectRevert(PowersPaymaster.PowersPaymaster__TargetNotAuthorized.selector);
        callValidate(buildUserOp(cd));
    }

    /// @notice Validation reverts when calldata is shorter than 68 bytes
    function testValidateRevertsShortCalldata() public {
        // 4-byte selector + 5 bytes = 9 bytes total — below the 68-byte minimum
        bytes memory cd = abi.encodePacked(bytes4(0xb61d27f6), bytes("short"));
        vm.expectRevert(PowersPaymaster.PowersPaymaster__InvalidCallData.selector);
        callValidate(buildUserOp(cd));
    }

    /// @notice Validation reverts for an unsupported 4-byte selector
    function testValidateRevertsUnsupportedSelector() public {
        bytes memory cd = abi.encodePacked(
            bytes4(0xdeadbeef),
            new bytes(64) // pad to >= 68 bytes so the length check passes first
        );
        vm.expectRevert(PowersPaymaster.PowersPaymaster__UnsupportedSelector.selector);
        callValidate(buildUserOp(cd));
    }

    /// @notice EXECUTE_SELECTOR_KERNEL reverts when calldata length is >= 68 but < 120
    function testValidateRevertsKernelShortCalldata() public {
        // selector(4) + mode(32) + offset(32) = 68 bytes — passes the first length check
        // but the kernel branch requires >= 120; triggers the inner InvalidCallData revert
        bytes memory cd = abi.encodePacked(
            bytes4(0xe9ae5c53), // EXECUTE_SELECTOR_KERNEL
            new bytes(64) // exactly 68 total
        );
        vm.expectRevert(PowersPaymaster.PowersPaymaster__InvalidCallData.selector);
        callValidate(buildUserOp(cd));
    }

    // ─── ACCESS CONTROL ───

    /// @notice addSponsoredTarget reverts for the zero address
    function testAddSponsoredTargetRevertsZeroAddress() public {
        vm.prank(address(daoMock));
        vm.expectRevert(PowersPaymaster.PowersPaymaster__InvalidCallData.selector);
        paymaster.addSponsoredTarget(address(0));
    }

    /// @notice removeSponsoredTarget reverts for the zero address
    function testRemoveSponsoredTargetRevertsZeroAddress() public {
        vm.prank(address(daoMock));
        vm.expectRevert(PowersPaymaster.PowersPaymaster__InvalidCallData.selector);
        paymaster.removeSponsoredTarget(address(0));
    }

    /// @notice removeSponsoredTarget reverts when the target has never been added
    function testRemoveSponsoredTargetRevertsNotFound() public {
        vm.prank(address(daoMock));
        vm.expectRevert(PowersPaymaster.PowersPaymaster__TargetNotAuthorized.selector);
        paymaster.removeSponsoredTarget(alice);
    }

    /// @notice addSponsoredTarget reverts when called by a non-owner
    function testAddSponsoredTargetRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        paymaster.addSponsoredTarget(bob);
    }

    /// @notice removeSponsoredTarget reverts when called by a non-owner
    function testRemoveSponsoredTargetRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        paymaster.removeSponsoredTarget(address(daoMock));
    }
}
