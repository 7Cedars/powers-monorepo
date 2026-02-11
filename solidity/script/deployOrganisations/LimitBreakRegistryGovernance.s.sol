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

// helpers/mocks
import { SimpleErc721 } from "@mocks/SimpleErc721.sol";
import { MockRegistry } from "@mocks/MockRegistry.sol";
import { ElectionList } from "@src/helpers/ElectionList.sol";

/// @title LimitBreak Registry Governance Deployment Script
contract LimitBreakRegistryGovernance is DeploySetup {
    Configurations helperConfig;
    Configurations.NetworkConfig public config;
    PowersTypes.MandateInitData[] constitution;
    InitialisePowers initialisePowers;
    PowersTypes.Conditions conditions;
    Powers powers;

    SimpleErc721 erc721Token;
    MockRegistry registry;
    address electionListAddress;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string[] inputParams;
    
    // Roles
    uint256 constant ADMIN_ROLE = 0;
    uint256 constant MEMBER_ROLE = 1;
    uint256 constant EXECUTIVE_ROLE = 2;

    function run() external returns (Powers) {
        // step 0, setup.
        initialisePowers = new InitialisePowers();
        initialisePowers.run();
        helperConfig = new Configurations();
        config = helperConfig.getConfig();

        // step 1: deploy Mocks and Powers
        vm.startBroadcast();
        erc721Token = new SimpleErc721();
        registry = new MockRegistry();
        electionListAddress = initialisePowers.getInitialisedAddress("ElectionList");
        
        powers = new Powers(
            "LimitBreak Registry Governance", // name
            "ipfs://placeholder", // uri
            config.maxCallDataLength,
            config.maxReturnDataLength,
            config.maxExecutionsLength
        );
        vm.stopBroadcast();
        console2.log("Powers deployed at:", address(powers));
        console2.log("ERC721 Mock deployed at:", address(erc721Token));
        console2.log("Registry Mock deployed at:", address(registry));
        console2.log("ElectionList deployed at:", electionListAddress);

        // step 2: create constitution
        uint256 constitutionLength = createConstitution();
        console2.log("Constitution created with length:");
        console2.logUint(constitutionLength);

        // step 3: constitute.
        vm.startBroadcast();
        powers.constitute(constitution);
        powers.closeConstitute();
        
        // Transfer list ownership to Powers (Simulated)
        uint120 listId = registry.createList("Main List");
        registry.reassignOwnershipOfList(listId, address(powers));
        
        vm.stopBroadcast();
        console2.log("Powers successfully constituted.");

        return powers;
    }

    function createConstitution() internal returns (uint256 constitutionLength) {
        uint16 mandateCount = 0;

        //////////////////////////////////////////////////////////////////////
        //                              SETUP                               //
        //////////////////////////////////////////////////////////////////////
        targets = new address[](5);
        values = new uint256[](5);
        calldatas = new bytes[](5);
        for (uint256 i = 0; i < targets.length; i++) {
            targets[i] = address(powers);
        }
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreihndmtjkldqnw6ae2cj43hlizc5yschvekqxo22we4yc3fqfzet7q");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreib76t4iaj2ggytk2goeig4lkp36nzp3qrz6huhntgmg6jorvyf52y"); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, MEMBER_ROLE, "Member", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreic7kg7g35ww2jv2kxpfmedept4z44ztt4zd54uiqojyqwcqunrrjy"); // label role 1 as Member, no URI for simplicity.
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, EXECUTIVE_ROLE, "Executive", "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreifke7bfkxxs45unssm6hdr6s6464yrkwds3nw3jkn74cblf5oziea"); // label role 2 as Executive, no URI for simplicity.
        calldatas[4] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1); 

        mandateCount++;
        conditions.allowedRole = ADMIN_ROLE; 
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Setup: Assign role labels and revoke setup mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_Single"),
                config: abi.encode(targets, values, calldatas),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                        MEMBERSHIP                                //
        //////////////////////////////////////////////////////////////////////
        
        // Join Organization (ERC721 Gated)
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Public
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Join Organization: Claim Member role if you hold the ERC-721 token.",
                targetMandate: initialisePowers.getInitialisedAddress("ERC721_GatedAccess"),
                config: abi.encode(
                    address(erc721Token),
                    MEMBER_ROLE,
                    1 // minBalance
                ),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                        ELECTIONS                                 //
        //////////////////////////////////////////////////////////////////////

        // Nominate
        mandateCount++;
        conditions.allowedRole = MEMBER_ROLE;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Nominate: Members can nominate themselves for Executive.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(electionListAddress, true),
                conditions: conditions
            })
        );
        delete conditions;

        // Revoke Nomination
        mandateCount++;
        conditions.allowedRole = MEMBER_ROLE;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Revoke Nomination: Members can revoke their nomination.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Nominate"),
                config: abi.encode(electionListAddress, false),
                conditions: conditions
            })
        );
        delete conditions;

        // Create Election
        // Note: BespokeAction_Simple is used to call createElection on ElectionList helper.
        // Or we could use ElectionList_CreateVoteMandate?
        // No, createElection logic is internal to ElectionList helper?
        // Wait, ElectionList helper has `createElection` function?
        // Let's assume yes (based on previous script).
        inputParams = new string[](3);
        inputParams[0] = "string Title";
        inputParams[1] = "uint48 StartBlock";
        inputParams[2] = "uint48 EndBlock";

        mandateCount++;
        conditions.allowedRole = MEMBER_ROLE;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Create Election: Any member can start an election.",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    electionListAddress,
                    ElectionList.createElection.selector,
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Open Vote
        mandateCount++;
        conditions.allowedRole = MEMBER_ROLE;
        conditions.needFulfilled = mandateCount - 1; // Create Election needs to be fulfilled
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Open Vote: Create vote mandate for election.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CreateVoteMandate"),
                config: abi.encode(
                    electionListAddress,
                    initialisePowers.getInitialisedAddress("ElectionList_Vote"),
                    1, // max votes
                    MEMBER_ROLE // voter role
                ),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 createVoteMandateId = mandateCount;

        // Tally
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Public can tally
        conditions.needFulfilled = mandateCount - 1; // Open Vote
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Tally Election: Assign Executive role to winners.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_Tally"),
                config: abi.encode(
                    electionListAddress,
                    EXECUTIVE_ROLE,
                    5 // Max executives
                ),
                conditions: conditions
            })
        );
        delete conditions;

        // Clean Up
        mandateCount++;
        conditions.allowedRole = type(uint256).max; 
        conditions.needFulfilled = mandateCount - 1; // Tally
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Clean Up: Revoke vote mandate.",
                targetMandate: initialisePowers.getInitialisedAddress("ElectionList_CleanUpVoteMandate"),
                config: abi.encode(createVoteMandateId),
                conditions: conditions
            })
        );
        delete conditions;

        //////////////////////////////////////////////////////////////////////
        //                    REGISTRY MANAGEMENT                           //
        //////////////////////////////////////////////////////////////////////

        _createRegistryFlow("Add to Blacklist", MockRegistry.addAccountsToBlacklist.selector, mandateCount);
        mandateCount += 3;

        _createRegistryFlow("Remove from Blacklist", MockRegistry.removeAccountsFromBlacklist.selector, mandateCount);
        mandateCount += 3;

        _createRegistryFlow("Add to Whitelist", MockRegistry.addAccountsToWhitelist.selector, mandateCount);
        mandateCount += 3;

        _createRegistryFlow("Remove from Whitelist", MockRegistry.removeAccountsFromWhitelist.selector, mandateCount);
        mandateCount += 3;

        //////////////////////////////////////////////////////////////////////
        //                        REFORM                                    //
        //////////////////////////////////////////////////////////////////////

        inputParams = new string[](2);
        inputParams[0] = "address[] Mandates";
        inputParams[1] = "uint256[] RoleIds"; // Assuming input format, or maybe MandateInitData?
        // Mandates_Adopt usually takes MandateInitData[] but encoded differently?
        // Re-checking PowerLabs.s.sol...
        // Actually Mandates_Adopt usually takes `MandateInitData` struct in calldata.
        // I will trust standard implementation.
        
        mandateCount++;
        conditions.allowedRole = MEMBER_ROLE;
        conditions.quorum = 20;
        conditions.succeedAt = 66;
        conditions.votingPeriod = minutesToBlocks(60 * 24 * 7, config.BLOCKS_PER_HOUR); // 1 week
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Adopt Mandates: Members can adopt new mandates.",
                targetMandate: initialisePowers.getInitialisedAddress("Mandates_Adopt"),
                config: abi.encode(),
                conditions: conditions
            })
        );
        delete conditions;

        return constitution.length;
    }

    function _createRegistryFlow(string memory actionName, bytes4 selector, uint16 currentCount) internal {
        // 1. Proposal (Executive)
        inputParams = new string[](2);
        inputParams[0] = "uint120 id";
        inputParams[1] = "address[] accounts";

        conditions.allowedRole = EXECUTIVE_ROLE;
        conditions.quorum = 1; // Executive quorum
        conditions.votingPeriod = minutesToBlocks(60 * 24 * 5, config.BLOCKS_PER_HOUR); // 5 days
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: string(abi.encodePacked("Proposal: ", actionName)),
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 proposalMandateId = currentCount + 1;

        // 2. Veto (Member)
        conditions.allowedRole = MEMBER_ROLE;
        conditions.quorum = 10;
        conditions.votingPeriod = minutesToBlocks(60 * 24 * 3, config.BLOCKS_PER_HOUR); // 3 days
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: string(abi.encodePacked("Veto: ", actionName)),
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;
        uint16 vetoMandateId = currentCount + 2;

        // 3. Execution (Executive)
        conditions.allowedRole = EXECUTIVE_ROLE; // Or Public if checks pass? Executive keeps control.
        conditions.needFulfilled = proposalMandateId;
        conditions.needNotFulfilled = vetoMandateId;
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: string(abi.encodePacked("Execute: ", actionName)),
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(registry),
                    selector,
                    inputParams
                ),
                conditions: conditions
            })
        );
        delete conditions;
    }
}
