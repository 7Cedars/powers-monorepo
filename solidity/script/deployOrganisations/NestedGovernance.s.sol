// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// scripts
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol";
import { InitialisePowers } from "@script/InitialisePowers.s.sol";
import { DeploySetup } from "./DeploySetup.s.sol";

// external protocols
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

// powers contracts
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

// helpers
import { SimpleErc20Votes } from "@mocks/SimpleErc20Votes.sol";

/// @title Nested Governance Deployment Script
contract NestedGovernance is DeploySetup {
    InitialisePowers initialisePowers;
    Configurations helperConfig;
    Configurations.NetworkConfig public config;

    PowersTypes.Conditions conditions;
    PowersTypes.MandateInitData[] primaryConstitution;
    PowersTypes.MandateInitData[] childConstitution;
    Powers powersParent;
    Powers powersChild;
    SimpleErc20Votes votesToken;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string[] inputParams;
    string[] dynamicParams;

    function run() external {
        // step 0, setup.
        initialisePowers = new InitialisePowers();
        initialisePowers.run();
        helperConfig = new Configurations();
        config = helperConfig.getConfig();

        // step 1: deploy Bicameralism Powers
        vm.startBroadcast();
        votesToken = new SimpleErc20Votes(); // SimpleErc20Votes
        powersParent = new Powers(
            "Nested Governance", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreian4g4wbuollclyml5xyao3hvnbxxduuoyjdiucdmau3t62rj46am", // uri
            config.maxCallDataLength, // max call data length
            config.maxReturnDataLength, // max return data length
            config.maxExecutionsLength // max executions length
        );

        powersChild = new Powers(
            "Nested Governance Child", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreig4aaje57wiv3rfboadft5pp2kgwzfurwgbjwleugc3ddbnjlc6um", // uri
            config.maxCallDataLength, // max call data length
            config.maxReturnDataLength, // max return data length
            config.maxExecutionsLength // max executions length
        );
        vm.stopBroadcast();
        console2.log("Powers Parent deployed at:", address(powersParent));
        console2.log("Powers Child deployed at:", address(powersChild));

        // step 2: create constitution
        uint256 primaryConstitutionLength = createParentConstitution();
        console2.log("Parent Constitution created with length:");
        console2.logUint(primaryConstitutionLength);

        // Mandate 3 in Parent is "Allow Child to mint vote tokens"
        uint256 childConstitutionLength = createChildConstitution(address(powersParent), 3);
        console2.log("Child Constitution created with length:");
        console2.logUint(childConstitutionLength);

        // step 3: run constitute.
        vm.startBroadcast();
        powersParent.constitute(primaryConstitution);
        powersParent.closeConstitute();
        powersChild.constitute(childConstitution);
        powersChild.closeConstitute();
        vm.stopBroadcast();
        console2.log("Parent and Child Powers successfully constituted.");
    }

    function createParentConstitution() internal returns (uint256 constitutionLength) {
        uint16 mandateCount = 0;
        // Mandate 1: Initial Setup
        targets = new address[](5);
        values = new uint256[](5);
        calldatas = new bytes[](5); 
        for (uint256 i = 0; i < targets.length; i++) {
            targets[i] = address(powersParent);
        }

        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Members", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[3] = abi.encodeWithSelector(IPowers.setTreasury.selector, address(powersParent));
        calldatas[4] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1);

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels (Members), set treasury address and revokes itself after execution",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_Single"),
                config: abi.encode(targets, values, calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 2: Update URI
        dynamicParams = new string[](1);
        dynamicParams[0] = "string Uri";

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Update URI: The admin can update the organization's URI.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(address(powersParent), IPowers.setUri.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 3: Allow Child to mint vote tokens (StatementOfIntent)
        inputParams = new string[](1);
        inputParams[0] = "uint256 Quantity";

        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.votingPeriod = minutesToBlocks(5, config.BLOCKS_PER_HOUR); // ~5 mins
        conditions.succeedAt = 51;
        conditions.quorum = 33;
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Allow Child to mint vote tokens: The parent organisation allows the child organisation to mint vote tokens.",
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 4: Admin can assign any role
        dynamicParams = new string[](2);
        dynamicParams[0] = "uint256 roleId";
        dynamicParams[1] = "address account";

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Admin can assign any role: For this demo, the admin can assign any role to an account.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(address(powersParent), IPowers.assignRole.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 5: A delegate can revoke a role
        mandateCount++;
        conditions.allowedRole = 2; // Role 2 (Delegates presumed)
        conditions.needFulfilled = mandateCount - 1; // Mandate 4
        primaryConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "A delegate can revoke a role: For this demo, any delegate can revoke previously assigned roles.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(address(powersParent), IPowers.revokeRole.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        return primaryConstitution.length;
    }

    function createChildConstitution(address parent, uint16 mintMandateId)
        internal
        returns (uint256 constitutionLength)
    {
        uint16 mandateCount = 0;
        // Mandate 1: Initial Setup
        targets = new address[](3);
        values = new uint256[](3);
        calldatas = new bytes[](3);
        for (uint256 i = 0; i < targets.length; i++) {
            targets[i] = address(powersChild);
        }

        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Members", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy");
        calldatas[1] = abi.encodeWithSelector(IPowers.setTreasury.selector, address(powersChild));
        calldatas[2] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1);

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Initial Setup: Assign role labels (Members), set treasury address and revokes itself after execution",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_Single"),
                config: abi.encode(targets, values, calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 2: Update URI
        dynamicParams = new string[](1);
        dynamicParams[0] = "string Uri";

        mandateCount++;
        conditions.allowedRole = 0; // Admin
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Update URI: The admin can update the organization's URI.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(address(powersChild), IPowers.setUri.selector, dynamicParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 3: Check Parent
        inputParams = new string[](1);
        inputParams[0] = "uint256 Quantity";

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Public
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Check Parent: Check if parent has passed action to mint tokens.",
                targetMandate: initialisePowers.getInitialisedAddress("CheckExternalActionState"),
                config: abi.encode(parent, mintMandateId, inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 4: Mint Tokens
        mandateCount++;
        conditions.allowedRole = 1; // Members
        conditions.needFulfilled = mandateCount - 1; // Check Parent
        conditions.votingPeriod = minutesToBlocks(5, config.BLOCKS_PER_HOUR); // ~5 mins
        conditions.succeedAt = 51;
        conditions.quorum = 33;
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Mint Tokens: Call the mint function at token.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(address(votesToken), bytes4(keccak256("mint(uint256)")), inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        // Mandate 5: Sync Member status (Adopt Role)
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Public
        childConstitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Sync Member status: An account that has role Member at the parent organization can be assigned the same role here - and visa versa.",
                targetMandate: initialisePowers.getInitialisedAddress("AssignExternalRole"),
                config: abi.encode(
                    parent,
                    1 // roleId (Members)
                ),
                conditions: conditions
            })
        );
        delete conditions;

        return childConstitution.length;
    }
}
