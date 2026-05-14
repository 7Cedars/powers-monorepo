// // SPDX-License-Identifier: MIT

// /// @notice A base contract that executes a bespoke action on its own powers contract.
// /// @author 7Cedars,

pragma solidity ^0.8.26;

// import { Mandate } from "../../Mandate.sol";
// import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";

// contract BespokeAction_OnOwnPowers_Advanced is Mandate {
//     struct Mem {
//         address targetContract;
//         bytes4 functionSelector;
//         bytes staticParamsBefore;
//         string[] dynamicParams;
//         bytes staticParamsAfter;
//         uint256 staticLen;
//         bytes packedParams;
//     }

//     /// @notice Constructor of the BespokeAction_OnOwnPowers mandate
//     constructor() {
//         bytes memory configParams = abi.encode(
//             "address TargetContract",
//             "bytes4 FunctionSelector",
//             "bytes staticParamsBefore",
//             "string[] dynamicParams",
//             "bytes staticParamsAfter"
//         );
//         emit Mandate__Deployed(configParams);
//     }

//     function initializeMandate(
//         uint16 index,
//         string memory nameDescription,
//         bytes memory inputParams,
//         bytes memory config
//     ) public override {
//         (, , , string[] memory params_, ) = abi.decode(config, (address, bytes4, bytes, string[], bytes));
//         super.initializeMandate(index, nameDescription, abi.encode(params_), config);
//     }

//     /// @notice Execute the mandate by calling the configured target function
//     /// @param mandateCalldata the calldata _without function signature_ to send to the function
//     function handleRequest(
//         address,
//         /*caller*/
//         address powers,
//         uint16 mandateId,
//         bytes calldata mandateCalldata,
//         uint256 nonce
//     )
//         public
//         view
//         virtual
//         override
//         returns (uint256 actionId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
//     {
//         Mem memory mem;
//         (mem.targetContract, mem.functionSelector, mem.staticParamsBefore, mem.dynamicParams, mem.staticParamsAfter) = abi.decode(getConfig(powers, mandateId), (address, bytes4, bytes, string[], bytes));
//         actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);

//         // Send the calldata to the target function
//         (targets, values, calldatas) = MandateUtilities.createEmptyArrays(1);
//         // if no target contract specified, call the function on the Powers contract
//         targets[0] = mem.targetContract == address(0) ? address(powers) : mem.targetContract;
//         calldatas[0] = abi.encodePacked(mem.functionSelector, mem.staticParamsBefore, mandateCalldata, mem.staticParamsAfter);

//         return (actionId, targets, values, calldatas);
//     }
// }
