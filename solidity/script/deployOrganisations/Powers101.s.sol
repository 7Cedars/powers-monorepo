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
import { Nominees } from "@src/helpers/Nominees.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

// powers contracts
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

// helper contracts
import { Nominees } from "@src/helpers/Nominees.sol";
import { SimpleErc20Votes } from "@mocks/SimpleErc20Votes.sol";
import { Erc20DelegateElection } from "@mocks/Erc20DelegateElection.sol";

/// @title Powers101 Deployment Script
contract Powers101 is DeploySetup {
    using Strings for address;

    Configurations helperConfig;
    Configurations.NetworkConfig config;
    PowersTypes.MandateInitData[] constitution;
    InitialisePowers initialisePowers;
    PowersTypes.Conditions conditions;
    Powers powers;

    Nominees nominees;
    SimpleErc20Votes simpleErc20Votes;
    Erc20DelegateElection erc20DelegateElection;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string[] dynamicParams;

    function run() external returns (Powers) {
        // step 0, setup.
        initialisePowers = new InitialisePowers();
        initialisePowers.run();
        helperConfig = new Configurations();
        config = helperConfig.getConfig();

        // step 1: deploy Vanilla Powers
        vm.startBroadcast();
        simpleErc20Votes = new SimpleErc20Votes();
        erc20DelegateElection = new Erc20DelegateElection(address(simpleErc20Votes));
        nominees = new Nominees();
        powers = new Powers(
            "Powers 101", // name
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreicbh6txnypkoy6ivngl3l2k6m646hruupqspyo7naf2jpiumn2jqe", // uri
            config.maxCallDataLength, // max call data length
            config.maxReturnDataLength, // max return data length
            config.maxExecutionsLength // max executions length
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
        powers.closeConstitute();
        vm.stopBroadcast();
        console2.log("Powers successfully constituted.");
    }

    function createConstitution() internal returns (uint256 constitutionLength) {
        // here add a setup mandate: set its own address as treasury + mint additional batch of tokens to the treasury. This is to show that you can have a setup mandate that prepares the organisation for use. In this case, it also shows how you can use the _externalCall function to call an external contract from a mandate. 
        // need to add the address of the treasury to the description of the minting mandate, so that the user knows what to add as token address in treasury frontend UI. 
        uint16 mandateCount = 0;
        //////////////////////////////////////////////////////////////////////
        //                              SETUP                               //
        //////////////////////////////////////////////////////////////////////
        targets = new address[](4);
        values = new uint256[](4);
        calldatas = new bytes[](4);
        for (uint256 i = 0; i < targets.length; i++) {
            targets[i] = address(powers);
        }
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Member");
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Delegate");
        calldatas[2] = abi.encodeWithSelector(IPowers.setTreasury.selector, address(powers));
        calldatas[3] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1); // revoke mandate after use.

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // = public role. .
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "A Single Action: to assign labels to roles and set the treasury. It self-destructs after execution.",
                targetMandate: initialisePowers.getInitialisedAddress("PresetActions_Single"), // presetSingleAction
                config: abi.encode(targets, values, calldatas),
                conditions: conditions
            })
        );
        delete conditions;


        //////////////////////////////////////////////////////////////////////
        //                      EXECUTIVE MANDATES                          //
        //////////////////////////////////////////////////////////////////////
        
        // MINT NEW TOKENS FLOW // 
        // Members: propose minting tokens to an address.  
        string[] memory inputParams = new string[](2);
        inputParams[0] = "address To";
        inputParams[1] = "uint256 Quantity";

        mandateCount++;
        conditions.allowedRole = 1; // = role that can call this mandate.
        conditions.quorum = 20; // = 30% quorum needed
        conditions.succeedAt = 66; // = 51% simple majority needed for assigning and revoking members.
        conditions.votingPeriod = minutesToBlocks(5, config.BLOCKS_PER_HOUR); // = number of blocks
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: string(abi.encodePacked("Intent to Mint: Propose to mint tokens at ", address(simpleErc20Votes).toHexString(), ".")),
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
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
                targetMandate: initialisePowers.getInitialisedAddress("StatementOfIntent"),
                config: abi.encode(inputParams),
                conditions: conditions
            })
        );
        delete conditions;

        mandateCount++;
        conditions.allowedRole = 2; // = role that can call this mandate.
        conditions.votingPeriod = minutesToBlocks(5, config.BLOCKS_PER_HOUR); // = number of blocks
        conditions.succeedAt = 66; // = 51% simple majority needed for executing an action.
        conditions.quorum = 20; // = 30% quorum needed
        conditions.needFulfilled = mandateCount - 2; // = mandate that must be completed before this one.
        conditions.needNotFulfilled = mandateCount - 1; // = mandate that must not be completed before this one.
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: string(abi.encodePacked("Execute a mint: Execute a mint at ", address(simpleErc20Votes).toHexString(), ". it has to be proposed first by the community and should not have been vetoed by an admin.")),
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
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
        // Members: nominate themselves for a delegate 
        string[] memory dynamicParamsSimple = new string[](1);
        dynamicParamsSimple[0] = "bool NominateMe";

        mandateCount++;
        conditions.allowedRole = 1; // = role that can call this mandate = members
        constitution.push(
            PowersTypes.MandateInitData({
                nameDescription: "Nominate Me: Nominate yourself for a delegate election. (Set nominateMe to false to revoke nomination)",
                targetMandate: initialisePowers.getInitialisedAddress("BespokeAction_Simple"),
                config: abi.encode(
                    address(erc20DelegateElection), 
                    Nominees.nominate.selector, 
                    dynamicParamsSimple
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
                nameDescription: "Delegate Nominees: Call a delegate election. This can be done at any time. Nominations are elected on the amount of delegated tokens they have received. For",
                targetMandate: initialisePowers.getInitialisedAddress("DelegateTokenSelect"),
                config: abi.encode(
                    address(erc20DelegateElection),
                    address(nominees),
                    2, // role to be elected.
                    3 // max number role holders
                ),
                conditions: conditions
            })
        );
        delete conditions;

        return constitution.length;
    }
}
