// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import { Powers } from "@src/Powers.sol";
import { PowersPaymaster } from "@src/mandates/integrations/AccountAbstraction/PowersPaymaster.sol";
import { FundPaymaster } from "@src/mandates/integrations/AccountAbstraction/FundPaymaster.sol";
import { WithdrawFromPaymaster } from "@src/mandates/integrations/AccountAbstraction/WithdrawFromPaymaster.sol";
import { IEntryPoint } from "@lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import { PackedUserOperation } from "@lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import { ISenderCreator } from "@lib/account-abstraction/contracts/interfaces/ISenderCreator.sol";

contract MockEntryPoint is IEntryPoint {
    function depositTo(
        address /*account*/
    )
        external
        payable { }
    function withdrawTo(
        address payable,
        /*withdrawAddress*/
        uint256 /*withdrawAmount*/
    )
        external { }
    // Stub other functions
    function handleOps(PackedUserOperation[] calldata, address payable) external { }
    function handleAggregatedOps(UserOpsPerAggregator[] calldata, address payable) external { }
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

    function senderCreator() external view returns (ISenderCreator) {
        return ISenderCreator(address(0));
    }

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        return interfaceId == type(IEntryPoint).interfaceId || interfaceId == 0x01ffc9a7; // ERC165
    }
}

contract AccountAbstractionTest is Test {
    PowersPaymaster public paymaster;
    FundPaymaster public fundPaymaster;
    WithdrawFromPaymaster public withdrawPaymaster;

    address public powersAddress = address(0x1234);
    MockEntryPoint public entryPoint;
    address public owner = address(this);

    function setUp() public {
        entryPoint = new MockEntryPoint();
        paymaster = new PowersPaymaster(entryPoint, powersAddress, owner);
        fundPaymaster = new FundPaymaster();
        withdrawPaymaster = new WithdrawFromPaymaster();
    }

    // Helper to simulate calling _validatePaymasterUserOp since it's internal and we can only call external validatePaymasterUserOp as entryPoint
    function callValidatePaymasterUserOp(PackedUserOperation memory userOp)
        public
        returns (bytes memory context, uint256 validationData)
    {
        vm.prank(address(entryPoint));
        return paymaster.validatePaymasterUserOp(userOp, bytes32(0), 1000);
    }

    function test_Paymaster_AcceptsPowersTarget() public {
        // Construct standard execute(address,uint256,bytes) callData targeting powersAddress
        bytes memory callData = abi.encodeWithSelector(
            0xb61d27f6, // EXECUTE_SELECTOR
            powersAddress,
            0,
            ""
        );

        PackedUserOperation memory userOp = PackedUserOperation({
            sender: address(0),
            nonce: 0,
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });

        (bytes memory context, uint256 validationData) = callValidatePaymasterUserOp(userOp);
        assertEq(validationData, 0, "Validation should pass with 0");
    }

    function test_Paymaster_RevertsNonPowersTarget() public {
        address maliciousTarget = address(0x9999);
        bytes memory callData = abi.encodeWithSelector(
            0xb61d27f6, // EXECUTE_SELECTOR
            maliciousTarget,
            0,
            ""
        );

        PackedUserOperation memory userOp = PackedUserOperation({
            sender: address(0),
            nonce: 0,
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });

        vm.expectRevert();
        callValidatePaymasterUserOp(userOp);
    }

    function test_Paymaster_AcceptsPowersTargetBatch() public {
        address[] memory targets = new address[](2);
        targets[0] = powersAddress;
        targets[1] = powersAddress;

        uint256[] memory values = new uint256[](2);
        bytes[] memory callDatas = new bytes[](2);

        bytes memory callData = abi.encodeWithSelector(
            0x47e1da2a, // EXECUTE_BATCH_SELECTOR
            targets,
            values,
            callDatas
        );

        PackedUserOperation memory userOp = PackedUserOperation({
            sender: address(0),
            nonce: 0,
            initCode: "",
            callData: callData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });

        (bytes memory context, uint256 validationData) = callValidatePaymasterUserOp(userOp);
        assertEq(validationData, 0);
    }

    function test_FundPaymaster_HandleRequest() public {
        bytes memory mandateCalldata = abi.encode(address(paymaster), 1 ether);

        (, address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
            fundPaymaster.handleRequest(address(0), address(0), 1, mandateCalldata, 0);

        assertEq(targets.length, 1);
        assertEq(targets[0], address(paymaster));
        assertEq(values[0], 1 ether);
        assertEq(calldatas[0], "");
    }

    function test_WithdrawFromPaymaster_HandleRequest() public {
        bytes memory mandateCalldata = abi.encode(address(paymaster), address(this), 1 ether);

        (, address[] memory targets, uint256[] memory values, bytes[] memory calldatas) =
            withdrawPaymaster.handleRequest(address(0), address(0), 1, mandateCalldata, 0);

        assertEq(targets.length, 1);
        assertEq(targets[0], address(paymaster));
        assertEq(values[0], 0);
        assertEq(calldatas[0], abi.encodeWithSignature("withdrawTo(address,uint256)", address(this), 1 ether));
    }
}
