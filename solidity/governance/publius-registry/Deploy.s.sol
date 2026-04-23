// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// scripts
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol";
import { DeployMandates } from "@script/DeployMandates.s.sol";
import { DeployHelpers } from "../DeployHelpers.s.sol";
import { IMandateRegistry } from "@src/helpers/MandateRegistry.sol";

// powers contracts
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

// helpers
import { MandateRegistry } from "@src/helpers/MandateRegistry.sol";

/// @title Publius Registry Deployment Script
contract Deploy is DeployHelpers {
    Configurations helperConfig;
    PowersTypes.MandateInitData[] constitution;
    DeployMandates deployMandates;
    PowersTypes.Conditions conditions;
    PowersTypes.Flow[] flows;
    Powers powers;
    MandateRegistry newRegistry;
    IMandateRegistry oldRegistry;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string[] dynamicParams;

    // Select version mandates to be used.
    uint16 constant MAJOR = 0;
    uint16 constant MINOR = 6;
    uint16 constant PATCH = 1;

    function run() external returns (Powers, MandateRegistry) {
        // step 0, setup.
        deployMandates = new DeployMandates();
        deployMandates.run();
        helperConfig = new Configurations();
        oldRegistry = IMandateRegistry(helperConfig.getMandateRegistry(block.chainid));

        // step 1: deploy Registry and Powers
        vm.startBroadcast();
        newRegistry = new MandateRegistry();
        powers = new Powers(
            "Publius Registry", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreiay7gwqdcyhxnrg7glyjpjak7uc2mvw5pgfbrtgc7xzdz6ndjsp24", // uri
            helperConfig.getMaxCallDataLength(block.chainid), // max call data length
            helperConfig.getMaxReturnDataLength(block.chainid), // max return data length
            helperConfig.getMaxExecutionsLength(block.chainid) // max executions length
        );
        vm.stopBroadcast();
        console2.log("Powers deployed at:", address(powers));
        console2.log("MandateRegistry deployed at:", address(newRegistry));

        // step 2: create constitution
        uint256 constitutionLength = createConstitution();
        console2.log("Constitution created with length:");
        console2.logUint(constitutionLength);

        // step 3: run constitute and transfer newRegistry ownership
        vm.startBroadcast();
        powers.constitute(constitution);
        powers.closeConstitute(msg.sender, flows);
        
        // Transfer ownership of newRegistry to powers
        newRegistry.transferOwnership(address(powers));
        
        vm.stopBroadcast();
        console2.log("Powers successfully constituted and newRegistry ownership transferred.");

        return (powers, newRegistry);
    }

    function createConstitution() internal returns (uint256 constitutionLength) {
        uint16 mandateCount = 0;
        
        // SETUP
        targets = new address[](4);
        values = new uint256[](4);
        calldatas = new bytes[](4);
        for (uint256 i = 0; i < targets.length; i++) {
            targets[i] = address(powers);
        }
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", ""); 
        calldatas[2] = abi.encodeWithSelector(IPowers.setTreasury.selector, address(powers));
        calldatas[3] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1);

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels and setup treasury",
                targetMandate: oldRegistry.getMandateAddress(MAJOR, MINOR, PATCH, false, "PresetActions"),
                config: abi.encode(targets, values, calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        // MandateRegistry Functions Flow
        uint16[] memory mandateIds = new uint16[](5);
        mandateIds[0] = mandateCount + 1;
        mandateIds[1] = mandateCount + 2;
        mandateIds[2] = mandateCount + 3;
        mandateIds[3] = mandateCount + 4;
        mandateIds[4] = mandateCount + 5;

        flows.push(PowersTypes.Flow({
            mandateIds: mandateIds,
            nameDescription: "Registry Admin: Admin has the ability to manage the Mandate Registry and adopt new mandates."
        }));

        // 1. registerMandate
        dynamicParams = new string[](2);
        dynamicParams[0] = "string mandateName";
        dynamicParams[1] = "address mandateAddress";

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Register Mandate: Admin can register new mandates in the newRegistry.",
                targetMandate: oldRegistry.getMandateAddress(MAJOR, MINOR, PATCH, false, "BespokeAction_Simple"), 
                config: abi.encode(address(newRegistry), MandateRegistry.registerMandate.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        // 2. deactivateMandate
        dynamicParams = new string[](4);
        dynamicParams[0] = "uint16 major";
        dynamicParams[1] = "uint16 minor";
        dynamicParams[2] = "uint16 patch";
        dynamicParams[3] = "string mandateName";

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Deactivate Mandate: Admin can deactivate mandates in the newRegistry.",
                targetMandate: oldRegistry.getMandateAddress(MAJOR, MINOR, PATCH, false, "BespokeAction_Simple"),
                config: abi.encode(address(newRegistry), MandateRegistry.deactivateMandate.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        // 3. reactivateMandate
        mandateCount++;
        conditions.allowedRole = 0; // Admin
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Reactivate Mandate: Admin can reactivate mandates in the newRegistry.",
                targetMandate: oldRegistry.getMandateAddress(MAJOR, MINOR, PATCH, false, "BespokeAction_Simple"),
                config: abi.encode(address(newRegistry), MandateRegistry.reactivateMandate.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        // 4. batchRegisterMandates
        dynamicParams = new string[](2);
        dynamicParams[0] = "string[] mandateNames";
        dynamicParams[1] = "address[] mandateAddresses";

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Batch Register Mandates: Admin can batch register mandates in the newRegistry.",
                targetMandate: oldRegistry.getMandateAddress(MAJOR, MINOR, PATCH, false, "BespokeAction_Simple"),
                config: abi.encode(address(newRegistry), MandateRegistry.batchRegisterMandates.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;
        
        // 5. adoptMandate
        mandateCount++;
        conditions.allowedRole = 0; // Admin
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Adopt Mandate: Admin can adopt new mandates to the powers organization.",
                targetMandate: oldRegistry.getMandateAddress(MAJOR, MINOR, PATCH, false, "Adopt_Mandates"),
                config: abi.encode(),
                conditions: conditions
            })
        );
        delete conditions;

        return constitution.length;
    }
}
