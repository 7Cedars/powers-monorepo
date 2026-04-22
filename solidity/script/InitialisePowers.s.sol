// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// --- Forge/OpenZeppelin Imports ---
import { Script } from "forge-std/Script.sol";
import { Create2 } from "@lib/openzeppelin-contracts/contracts/utils/Create2.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "./Configurations.s.sol";
import { MandatesAndHelpers } from "./MandatesAndHelpers.s.sol";

// --- Library Imports ---
import { Checks } from "@src/libraries/Checks.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol"; 

/// @title InitialisePowers
/// @notice Deploys all library and mandate contracts deterministically using CREATE2
/// and saves their names and addresses to a obj1 file.
contract InitialisePowers is Script, MandatesAndHelpers {
    string outputFile; 
    address[] addresses;
   
    function run() external override { 
        string memory obj1 = "some key"; 
        helperConfig = new Configurations(); 
        recordMandatesAndHelpers();

        address checksAddr = deploy(type(Checks).creationCode, abi.encode("Checks"));
        vm.serializeAddress(obj1, "Checks", checksAddr);
 
        address mandateUtilsAddr = deploy(type(MandateUtilities).creationCode, abi.encode("MandateUtilities"));
        vm.serializeAddress(obj1, "MandateUtilities", mandateUtilsAddr);

        string memory powersBytecode = generatePowersBytecode(checksAddr);
        vm.serializeString(obj1, "powers", powersBytecode);

        string memory outputJson = deployAndRecordMandates();
        string memory finalJson = vm.serializeString(obj1, "mandates", outputJson);

        outputFile = string.concat("../frontend/public/powered/", vm.toString(block.chainid), ".json");
        vm.writeJson(finalJson, outputFile);
        console2.log("Success! All deployment data saved to:", outputFile);
    }

    /// @notice Uses vm.ffi() and the 'serialize' function to add bytecode to the obj1 string.
    function generatePowersBytecode(address _checks) internal returns (string memory) {
        // Must return the modified string
        string[] memory inputs = new string[](5);
        inputs[0] = "forge";
        inputs[1] = "build";
        inputs[2] = "--libraries";
        inputs[3] = string.concat("src/libraries/Checks.sol:Checks:", vm.toString(_checks));
        inputs[4] = "--force";

        vm.ffi(inputs);

        string memory artifactJson = vm.readFile("out/Powers.sol/Powers.json");
        string memory deploymentBytecode = vm.parseJsonString(artifactJson, ".bytecode.object");

        return deploymentBytecode; // Return the new obj1 string
    }

    /// @notice Deploys all mandate contracts and uses 'serialize' to record their addresses.
    function deployAndRecordMandates()
        internal
        returns (string memory outputJson)
    {
        //////////////////////////////////////////////////////////////////////////
        //                          DEPLOY SEQUENCE                             //
        //////////////////////////////////////////////////////////////////////////
        string memory obj2 = "second key";
        address mandateAddr;
        for (uint256 i = 0; i < names.length; i++) {
            console2.log("Deploying:", names[i]);
            
            mandateAddr = deploy(creationCodes[i], constructorArgs[i]);
            console2.log("Deployed at:", mandateAddr);

            addresses.push(mandateAddr);

            // £todo: here record the version and address of mandates and helpers on-chain as well. 
            
             
            vm.serializeAddress(obj2, names[i], mandateAddr);
        }
        outputJson = vm.serializeUint(obj2, "chainId", uint256(block.chainid));
    }

    /// @dev Deploys a mandate using CREATE2. Salt is derived from constructor arguments.
    function deploy(bytes memory creationCode, bytes memory constructorArg) internal returns (address) {
        bytes32 salt = bytes32(abi.encodePacked(constructorArg));
        bytes memory deploymentData = abi.encodePacked(creationCode, constructorArg);
        address computedAddress = Create2.computeAddress(salt, keccak256(deploymentData), CREATE2_FACTORY);

        if (computedAddress.code.length == 0) {
            vm.startBroadcast();
            address deployedAddress = Create2.deploy(0, salt, deploymentData);
            vm.stopBroadcast();
            require(deployedAddress == computedAddress, "Error: Deployed address mismatch.");
            return deployedAddress;
        }
        return computedAddress;
    }

    // @dev wrapper function to expose deployAndRecordMandates externally and only return addresses and names of mandates.
    function getDeployed() external returns (string[] memory mandateNames, address[] memory mandateAddresses) {
        helperConfig = new Configurations();
        deployAndRecordMandates();
        return (names, addresses);
    }
}
