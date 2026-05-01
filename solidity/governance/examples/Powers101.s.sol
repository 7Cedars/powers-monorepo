// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// scripts
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol"; 
import { DeployHelpers } from "../DeployHelpers.s.sol";
import { IMandateRegistry } from "@src/helpers/MandateRegistry.sol";

// external protocols
import { Create2 } from "@lib/openzeppelin-contracts/contracts/utils/Create2.sol";
import { Nominees } from "@src/helpers/Nominees.sol";
import { Strings } from "@lib/openzeppelin-contracts/contracts/utils/Strings.sol";

// powers contracts
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

// helper contracts
import { Nominees } from "@src/helpers/Nominees.sol";
import { SimpleErc20Votes } from "../../test/mocks/SimpleErc20Votes.sol";
import { Erc20DelegateElection } from "../../test/mocks/Erc20DelegateElection.sol";

/// @title Powers101 Deployment Script
contract Deploy is DeployHelpers {
    using Strings for address;

    Configurations helperConfig; 
    PowersTypes.MandateInitData[] constitution; 
    PowersTypes.Conditions conditions;
    PowersTypes.Flow[] flows;
    Powers powers;
    IMandateRegistry registry;

    Nominees nominees;
    SimpleErc20Votes simpleErc20Votes;
    Erc20DelegateElection erc20DelegateElection;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string[] dynamicParams;
    
    // Select version mandates to be used.
    uint16 constant MAJOR = 0;
    uint16 constant MINOR = 6;
    uint16 constant PATCH = 2;

    function run() external returns (Powers) {
        // step 0, setup. 
        helperConfig = new Configurations(); 
        registry = IMandateRegistry(helperConfig.getMandateRegistry(block.chainid));

        // step 1: deploy Vanilla Powers
        vm.startBroadcast();
        simpleErc20Votes = new SimpleErc20Votes();
        erc20DelegateElection = new Erc20DelegateElection(address(simpleErc20Votes));
        nominees = new Nominees();
        powers = new Powers(
            "Powers 101", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeicqhl4mo4b5dep3fzheijqnkdrviiqlf23wlasfqznrpqhd3z3qfy/powers101.json", // uri
            helperConfig.getMaxCallDataLength(block.chainid), // max call data length
            helperConfig.getMaxReturnDataLength(block.chainid), // max return data length
            helperConfig.getMaxExecutionsLength(block.chainid) // max executions length
        );
        vm.stopBroadcast();
        console2.log("Powers deployed at:", address(powers));

        // step 2: create constitution
        uint256 constitutionLength = createConstitution();
        console2.log("Constitution created with length:");
        console2.logUint(constitutionLength);

        // step 3: transfer ownership and run constitute.
        vm.startBroadcast();
        powers.constitute(constitution);
        powers.closeConstitute(msg.sender, flows);

        nominees.transferOwnership(address(powers));
        erc20DelegateElection.transferOwnership(address(powers));
        vm.stopBroadcast();
        console2.log("Powers successfully constituted.");

        return powers;
    }

    function createConstitution() internal returns (uint256 constitutionLength) {
        // here add a setup mandate: set its own address as treasury + mint additional batch of tokens to the treasury. This is to show that you can have a setup mandate that prepares the organisation for use. In this case, it also shows how you can use the _externalCall function to call an external contract from a mandate. 
        // need to add the address of the treasury to the description of the minting mandate, so that the user knows what to add as token address in treasury frontend UI. 
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
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "");  
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", ""); 
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Delegate", ""); 
        calldatas[3] = abi.encodeWithSelector(IPowers.setTreasury.selector, address(powers));
        calldatas[4] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1); // revoke mandate after use.

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public role. .
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Setup:  assigns labels to roles and set the treasury. It self-destructs after execution.",
                targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "PresetActions"), // presetSingleAction
                config: abi.encode(targets, values, calldatas),
                conditions: conditions
            })
        );
        delete conditions;


        //////////////////////////////////////////////////////////////////////
        //                      EXECUTIVE MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        
        // MINT NEW TOKENS FLOW // 
        uint16[] memory mandateIds = new uint16[](3); 
        mandateIds[0] = mandateCount + 1;
        mandateIds[1] = mandateCount + 2;
        mandateIds[2] = mandateCount + 3;

        flows.push(PowersTypes.Flow({
            mandateIds: mandateIds,
            nameDescription: "Minting Flow: Propose a mint, veto a mint, execute a mint."
        }));

        // Members: propose minting tokens to an address.  
        string[] memory inputParams = new string[](2);
        inputParams[0] = "address To";
        inputParams[1] = "uint256 Quantity";

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = anyone can call this mandate.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: string(abi.encodePacked("Propose to Mint: Propose to mint tokens at ", address(simpleErc20Votes).toHexString(), ".")),
                targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        mandateCount++;
        conditions.allowedRole = 0; // = admin.
        conditions.needFulfilled = mandateCount - 1; // = mandate that must be completed before this one.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: string(abi.encodePacked("Veto a mint: Veto a proposed token mint at", address(simpleErc20Votes).toHexString(), ".")),
                targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        mandateCount++;
        conditions.allowedRole = 1; // = role that can call this mandate.
        conditions.votingPeriod = minutesToBlocks(5, helperConfig.getBlocksPerHour(block.chainid)); // = number of blocks
        conditions.succeedAt = 66; // = 51% simple majority needed for executing an action.
        conditions.quorum = 20; // = 30% quorum needed
        conditions.needFulfilled = mandateCount - 2; // = mandate that must be completed before this one.
        conditions.needNotFulfilled = mandateCount - 1; // = mandate that must not be completed before this one.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: string(abi.encodePacked("Execute a mint: Execute a mint at ", address(simpleErc20Votes).toHexString(), ". it has to be proposed first by the community and should not have been vetoed by an admin.")),
                targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "BespokeAction_Simple"),
                config: abi.encode(
                    address(simpleErc20Votes), // target contract
                    bytes4(keccak256("mint(address,uint256)")), 
                    inputParams
                ), // empty config.
                conditions: conditions
            })
        );
        delete conditions;


        //////////////////////////////////////////////////////////////////////
        //                      ELECTORAL MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        
        // ELECT DELEGATES FLOW // 
        mandateIds = new uint16[](2); 
        mandateIds[0] = mandateCount + 1;
        mandateIds[1] = mandateCount + 2; 
        
        flows.push(PowersTypes.Flow({
            mandateIds: mandateIds,
            nameDescription: "Elect your delegates: Nominate yourself and call an election."
        }));

        // Members: nominate themselves for a delegate 
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = anyone can nominate themselves as delegate.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Nominate Me: Nominate yourself for a delegate election. (Set nominateMe to false to revoke nomination)",
                targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "Nominate"),
                config: abi.encode(
                    address(nominees)
                    ),
                conditions: conditions
            })
        );
        delete conditions;

        // Anyone: call delegate select.  
        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = role that can call this mandate.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Call a delegate election: This can be done at any time. Nominations are elected on the amount of delegated tokens they have received. For",
                targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "DelegateTokenSelect"),
                config: abi.encode(
                    address(erc20DelegateElection),
                    address(nominees),
                    1, // role to be elected.
                    3 // max number role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        return constitution.length;
    }
}
