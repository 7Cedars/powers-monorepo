// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// scripts
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol";
import { InitialisePowers } from "@script/InitialisePowers.s.sol";
import { DeployHelpers } from "../DeployHelpers.s.sol";

// external protocols
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { SafeProxyFactory } from "lib/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import { Safe } from "lib/safe-smart-account/contracts/Safe.sol";
import { ModuleManager } from "lib/safe-smart-account/contracts/base/ModuleManager.sol";

// powers contracts
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

// helpers
import { PowersFactory } from "@src/helpers/PowersFactory.sol";

/// @title Nested Governance Deployment Script
contract Deploy is DeployHelpers {
    InitialisePowers initialisePowers;
    Configurations helperConfig; 

    PowersTypes.Conditions conditions;
    PowersTypes.MandateInitData[] parentConstitution;
    PowersTypes.MandateInitData[] childConstitution;
    Powers powersParent;
    PowersFactory powersChildFactory;
    
    address treasury;
    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string[] inputParams;
    string[] dynamicParams;

    uint16 requestAllowanceMandateId; 

    function run() external {
        // step 0, setup.
        initialisePowers = new InitialisePowers();
        initialisePowers.run();
        helperConfig = new Configurations(); 

        // step 1: deploy Parent Powers
        vm.startBroadcast();
        powersParent = new Powers(
            "Nested Governance Parent", 
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreian4g4wbuollclyml5xyao3hvnbxxduuoyjdiucdmau3t62rj46am",
            helperConfig.getMaxCallDataLength(block.chainid),
            helperConfig.getMaxReturnDataLength(block.chainid),
            helperConfig.getMaxExecutionsLength(block.chainid) 
        );
        vm.stopBroadcast();
        console2.log("Powers Parent deployed at:", address(powersParent));
        

        // step 2: deploy Child PowersFactory
        vm.startBroadcast();
        powersChildFactory = new PowersFactory(
            "Nested Governance Child",
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreig4aaje57wiv3rfboadft5pp2kgwzfurwgbjwleugc3ddbnjlc6um", 
            helperConfig.getMaxCallDataLength(block.chainid),
            helperConfig.getMaxReturnDataLength(block.chainid),
            helperConfig.getMaxExecutionsLength(block.chainid),
            address(0)  
        );
        vm.stopBroadcast();
        console2.log("Powers Child Factory deployed at:", address(powersChildFactory));

        // step 3: setup Safe treasury for Parent
        address[] memory owners = new address[](1);
        owners[0] = address(powersParent);

        vm.startBroadcast();
        treasury = address(
            SafeProxyFactory(helperConfig.getSafeProxyFactory(block.chainid))
                .createProxyWithNonce(
                    helperConfig.getSafeL2Canonical(block.chainid),
                    abi.encodeWithSelector(
                        Safe.setup.selector,
                        owners,
                        1, // threshold
                        address(0), // to
                        "", // data
                        address(0), // fallbackHandler
                        address(0), // paymentToken
                        0, // payment
                        address(0) // paymentReceiver
                    ),
                    block.timestamp // nonce using timestamp to ensure uniqueness
                )
        );
        vm.stopBroadcast();
        console2.log("Safe treasury deployed at:", treasury);

        // step 4: create constitutions
        createParentConstitution();
        console2.log("Number of Mandates:", parentConstitution.length);
        createChildConstitution();
        console2.log("Number of Mandates in Child Factory:", childConstitution.length);

        // step 5: add mandates to factory
        vm.startBroadcast();
        powersChildFactory.addMandates(childConstitution);
        vm.stopBroadcast();

        // step 6: constitute Parent
        vm.startBroadcast();
        powersParent.constitute(parentConstitution);
        powersParent.closeConstitute();
        vm.stopBroadcast();
        console2.log("Parent Powers constituted.");

        // step 7: transfer ownership of factory to parent
        vm.startBroadcast();
        powersChildFactory.transferOwnership(address(powersParent));
        vm.stopBroadcast();
        console2.log("Child Factory ownership transferred to Parent.");
    }

    function createParentConstitution() internal {
        uint16 mandateCount = 0;
        
        // signature for Safe module enabling call
        bytes memory signature = abi.encodePacked(
            uint256(uint160(address(powersParent))), // r = address of the signer (powers contract)
            uint256(0), // s = 0
            uint8(1) // v = 1 This is a type 1 call. See Safe.sol for details.
        );

        // Mandate 1: Setup
        targets = new address[](7);
        values = new uint256[](7);
        calldatas = new bytes[](7); 
        for (uint256 i = 0; i < targets.length; i++) {
            targets[i] = address(powersParent);
        }
        targets[5] = treasury; 

        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Executive", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Child", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreibgdw6nknrwg25sdbslhqn3ismroaoxhl5pdcrvintz7jncja6f4a");
        calldatas[4] = abi.encodeWithSelector(IPowers.setTreasury.selector, treasury);
        calldatas[5] = abi.encodeWithSelector( 
            Safe.execTransaction.selector,
            treasury, 
            0, 
            abi.encodeWithSelector( 
                ModuleManager.enableModule.selector,
                helperConfig.getSafeAllowanceModule(block.chainid) 
            ),
            0, // operation = Call
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            address(0), // gasToken
            address(0), // refundReceiver
            signature // the signature constructed above
        );
        calldatas[6] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1);

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels, set treasury and enable allowance module.",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_Single"),
                config: abi.encode(targets, values, calldatas),
                conditions: conditions
            })
        );
        delete conditions;


        // Mandate: Child can request allowance
        inputParams = new string[](5);
        inputParams[0] = "address Sub-DAO";
        inputParams[1] = "address Token";
        inputParams[2] = "uint96 allowanceAmount";
        inputParams[3] = "uint16 resetTimeMin";
        inputParams[4] = "uint32 resetBaseMin";

        mandateCount++;
        conditions.allowedRole = 2; // Child
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request Allowance: Child DAO can request allowance.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        requestAllowanceMandateId = mandateCount;

        // Mandate: Executive can set allowance (fulfilling request)
        mandateCount++;
        conditions.allowedRole = 1; // Executive
        conditions.needFulfilled = mandateCount - 1; // Need request
        conditions.quorum = 20; // 50% quorum for voting on Parent to set allowance
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51; // >50% to pass
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Set Allowance: Executive can set allowance for Child DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("SafeAllowance_Action"),
                config: abi.encode(
                    inputParams,
                    bytes4(0xbeaeb388), // == AllowanceModule.setAllowance.selector 
                    helperConfig.getSafeAllowanceModule(block.chainid)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate: Initiate Child DAO Creation
        inputParams = new string[](1);
        inputParams[0] = "address Admin";

        // Mandate: Create Child DAO
        mandateCount++;
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create Child DAO: Executive can execute creation of Child DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(powersChildFactory), 
                    bytes4(keccak256("createPowers(address)")), 
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate: Assign Child Role to new DAO
        mandateCount++;
        conditions.allowedRole = 1; // Executive
        conditions.needFulfilled = mandateCount - 1; // Need creation
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Assign Child Role: Assign Child role (2) to the new DAO.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnReturnValue"),
                config: abi.encode(
                    address(powersParent), 
                    IPowers.assignRole.selector, 
                    abi.encode(2), // roleId 2 (Child)
                    inputParams, 
                    mandateCount - 1, // parent mandate id (create child)
                    abi.encode() 
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate: Add Delegate to Allowance Module
        mandateCount++;
        conditions.allowedRole = 1; // Executive
        conditions.needFulfilled = mandateCount - 2; // Need creation (to get address)
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Add Delegate: Add new Child DAO as delegate to Allowance Module.",
                targetMandate: initialisePowers.getInitialisedAddress("Safe_ExecTransaction_OnReturnValue"),
                config: abi.encode(
                    helperConfig.getSafeAllowanceModule(block.chainid), 
                    bytes4(0xe71bdf41), // == AllowanceModule.addDelegate.selector
                    abi.encode(), 
                    inputParams, 
                    mandateCount - 2, // parent mandate id (create child)
                    abi.encode() 
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate: Veto Transfer at Child DAO level  
        inputParams = new string[](3);
        inputParams[0] = "address Token";
        inputParams[1] = "uint96 Amount";
        inputParams[2] = "address PayableTo"; 

        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.quorum = 20; // 50% quorum for voting on Parent to set allowance
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51; // >50% to pass
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Transfer at Child: A parent organisation can veto a transfer at a child.",
                targetMandate: initialisePowers.getInitialisedAddress("PowersAction_Flexible"),
                config: abi.encode(inputParams),
                conditions: conditions
            })  
        );
        delete conditions;

        // ELECTORAL MANDATES // 

        // Mandate: Admin can assign any role
        dynamicParams = new string[](2);
        dynamicParams[0] = "uint256 roleId";
        dynamicParams[1] = "address account";

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Admin can assign any role: The admin can assign any role to an account.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(address(powersParent), IPowers.assignRole.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate: Executive can revoke role
        mandateCount++;
        conditions.allowedRole = 1; // Executive
        conditions.needFulfilled = mandateCount - 1; // Need admin assignment
        parentConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Executive can revoke role: Executive can revoke a role.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers"),
                config: abi.encode(IPowers.revokeRole.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

    }

    function createChildConstitution() internal {
        uint16 mandateCount = 0;

        // Mandate 1: Setup
        calldatas = new bytes[](6);
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Members", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Parent DAO", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreifwvrlo3jsu2i4trkgfu4vy6v5tk2y5iiu5hf3d6fez34d43y5yn4");
        calldatas[4] = abi.encodeWithSelector(IPowers.assignRole.selector, 2, address(powersParent)); // No treasury for child, but could be set to own Safe if desired
        calldatas[5] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1);

        mandateCount++;
        conditions.allowedRole = 0; // Admin (Factory sets this)
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels and revoke self.",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_OnOwnPowers"),
                config: abi.encode(calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 4: Public Request Transfer
        inputParams = new string[](3);
        inputParams[0] = "address Token";
        inputParams[1] = "uint256 Amount";
        inputParams[2] = "address PayableTo";

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Public
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request Transfer: Public can request transfer of funds from Parent Treasury.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 5: Parent DAO Veto Transfer
        mandateCount++;
        conditions.allowedRole = 2; // Parent DAO
        conditions.needFulfilled = mandateCount - 1; // Need request
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Veto Transfer: Parent DAO can veto transfer.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 6: Members Execute Transfer
        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.quorum = 20; // 50% quorum for voting on Parent to set allowance
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51; // >50% to pass
        conditions.needFulfilled = mandateCount - 2; // Need request (4)
        conditions.needNotFulfilled = mandateCount - 1; // Need NO veto (5)
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid));
        conditions.succeedAt = 51;
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Execute Transfer: Members vote to execute transfer from Parent Treasury.",
                targetMandate: initialisePowers.getInitialisedAddress("SafeAllowance_Transfer"),
                config: abi.encode(helperConfig.getSafeAllowanceModule(block.chainid), treasury), // Treasury is Parent's treasury
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 7: Request Additional Allowance from Parent
        inputParams = new string[](5);
        inputParams[0] = "address Sub-DAO";
        inputParams[1] = "address Token";
        inputParams[2] = "uint96 allowanceAmount";
        inputParams[3] = "uint16 resetTimeMin";
        inputParams[4] = "uint32 resetBaseMin";

        mandateCount++;
        conditions.allowedRole = 1; // Members
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Request Additional Allowance: Members can request additional allowance from Parent.",
                targetMandate: initialisePowers.getInitialisedAddress("PowersAction_Simple"),
                config: abi.encode(
                    address(powersParent),
                    requestAllowanceMandateId, // ID from Parent Constitution
                    "Requesting allowance from Parent",
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;
        

        // ELECTORAL MANDATES //
        // Mandate 2: Admin can assign any role
        dynamicParams = new string[](2);
        dynamicParams[0] = "uint256 roleId";
        dynamicParams[1] = "address account";

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Admin can assign any role: The admin can assign any role to an account.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers"),
                config: abi.encode(IPowers.assignRole.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 3: Members can revoke role
        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.needFulfilled = mandateCount - 1; // Need admin assignment
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Members can revoke role: Members can revoke a role.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_OnOwnPowers"),
                config: abi.encode(IPowers.revokeRole.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

    }
}
