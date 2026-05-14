// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test, console, console2 } from "forge-std/Test.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersFactory } from "@src/helpers/PowersFactory.sol";
import { Mandate } from "@src/Mandate.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Deploy } from "@governance/examples/Governed721.s.sol";
import { Safe } from "@lib/safe-smart-account/contracts/Safe.sol";
import { Configurations } from "@script/Configurations.s.sol";
import { DeployHelpers } from "@governance/DeployHelpers.s.sol";
import { Strings } from "@lib/openzeppelin-contracts/contracts/utils/Strings.sol"; 
import { PresetActions } from "@src/mandates/executive/PresetActions.sol";
import { IGoverned721 } from "@src/helpers/Governed721.sol";

import { Initialise } from "@governance/examples/actions/Initialise.s.sol"; 
import { Governed721_Management } from "@governance/examples/actions/Governed721_Management.s.sol";
import { Governed721_Roles } from "@governance/examples/actions/Governed721_Roles.s.sol";
import { TestHelperFunctions } from "../TestSetup.t.sol"; 

interface IAllowanceModule {
    function delegates(address safe, uint48 index) external view returns (address delegate, uint48 prev, uint48 next);
    function getTokenAllowance(address safe, address delegate, address token) external view returns (uint256[5] memory);
}

contract Governed721_test is TestHelperFunctions {
    struct Mem {
        uint256 nonce;
    }
    Mem mem;

    // Deploy & config 
    Deploy deploy; 
    address governed721Org;
    address governed721;
    address electionRegistry;
    
    // actions 
    Initialise initialise;
    Governed721_Management management;
    Governed721_Roles roles; 

    address treasury;
    address safeAllowanceModule; 
    address testAccount1 = vm.addr(vm.envUint("TEST_ACCOUNT_KEY_1")); 
    address testAccount2 = vm.addr(vm.envUint("TEST_ACCOUNT_KEY_2"));
    address testAccount3 = vm.addr(vm.envUint("TEST_ACCOUNT_KEY_3"));

    uint256 fork; 
    string[] IDEAS_NAMES = ["Seeing", "Making", "Listening", "Telling", "Remembering", "Imagining", "Tending"];
    uint256[] privateKeys = [
        vm.envUint("TEST_ACCOUNT_KEY_1"), 
        vm.envUint("TEST_ACCOUNT_KEY_2"), 
        vm.envUint("TEST_ACCOUNT_KEY_3")
    ];
    uint256 transferId;

    function setUp() public  { 
        // the test always needs to run on a forked chain that has the Safe protocol deployed. 
        fork = vm.createFork(vm.envString("SEPOLIA_RPC_URL"));
        vm.selectFork(fork);

        deploy = new Deploy();
        (governed721Org, governed721, electionRegistry) = deploy.run();

        initialise = new Initialise();
        management = new Governed721_Management();
        roles = new Governed721_Roles();
        initialise.runSetupMandate(governed721Org, block.timestamp);
        helperConfig = new Configurations();
    }

    function test_initialise() public view {
        // check dependencies 
        check_inputParamsDependencies(governed721Org); 

        // check label role 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(1))) == keccak256(abi.encodePacked("Artist")), "Role 1 should be 'Artist'"); 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(2))) == keccak256(abi.encodePacked("Owner")), "Role 2 should be 'Owner'"); 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(3))) == keccak256(abi.encodePacked("Operator")), "Role 3 should be 'Operator'"); 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(4))) == keccak256(abi.encodePacked("Voter")), "Role 4 should be 'Voter'"); 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(5))) == keccak256(abi.encodePacked("Executive")), "Role 5 should be 'Executive'"); 
        
        // check that test Account 1 is executive 
        vm.assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount1, 5) > 0, "Test Account 1 should have Executive role");

        // check treasury 
        vm.assertTrue(Powers(payable(governed721Org)).getTreasury() == governed721Org, "Treasury should be set as organisation itself.");
    }


    function test_sellTokenAndClaimRoles() public {
        // setup: give the new owner 2 ETH to buy the token.
        vm.deal(testAccount1, 2 ether);

        console2.log("Block per hour:", helperConfig.getBlocksPerHour(block.chainid));

        // step 1: whitelist token (native ETH in this case)
        management.whitelistPaymentTokensPropose(governed721Org, address(0), privateKeys, block.timestamp);

        vm.roll(block.number + minutesToBlocks(10,  helperConfig.getBlocksPerHour(block.chainid)));
        management.whitelistPaymentTokensExecute(governed721Org, address(0), privateKeys, block.timestamp);

        // step 2: mintTokens. Operator = testAccount1, Owner = Governed721Org, Artist = testAccount2.
        management.mintNftAtGoverned721(governed721, testAccount1, governed721Org, testAccount2, 1);

        transferId = uint256(keccak256(abi.encode(governed721Org, testAccount3, 1, address(0), 1 ether, block.timestamp)));

        // step 3: buyNftAtGoverned721: create transaction (Governed721Org -> testAccount3)
        management.buyNftAtGoverned721(governed721, 1, 1 ether, governed721Org, testAccount3, block.timestamp);
 
        // step 4: claim roles. 
        roles.getOwnerArtistOperatorRole(governed721Org, 1, block.timestamp);

        assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount1, 3) > 0, "Test Account 1 should have Operator role");
        assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount2, 1) > 0, "Test Account 2 should have Artist role");
        assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount3, 2) > 0, "Test Account 3 should have Owner role"); 

        // step 5: claim vote role. 
        roles.claimVoterRole(governed721Org, privateKeys, block.timestamp);
        for (uint256 i = 0; i < privateKeys.length; i++) {
            address claimant = vm.addr(privateKeys[i]);
            assertTrue(Powers(payable(governed721Org)).hasRoleSince(claimant, 4) > 0, string.concat("Test Account ", Strings.toString(i + 1), " should have Voter role"));
        }

        // step 6: elect executives. 
        roles.createExecutiveElection(governed721Org, privateKeys, block.timestamp);

        // set votes: everyone votes for 1st nominee.
        bool[] memory voteSelection = new bool[](3);
        voteSelection[0] = true; // for
        bool[][] memory voteSelections = new bool[][](3); 
        for (uint256 i = 0; i < 3; i++) {
            voteSelections[i] = voteSelection;
        }

        vm.roll(block.number + minutesToBlocks(6,  helperConfig.getBlocksPerHour(block.chainid)));
        roles.voteInExecutiveElection(governed721Org, electionRegistry, voteSelections, 0, privateKeys, block.timestamp);

        vm.roll(block.number + minutesToBlocks(6,  helperConfig.getBlocksPerHour(block.chainid)));
        roles.tallyExecutiveElection(governed721Org, block.timestamp);

        assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount1, 5) > 0, "Test Account 1 should have Executive role");
    }

    function test_setSplitPayment() public { 
        // step 0: set roles. Test Account 1 should be executive. 
        test_sellTokenAndClaimRoles();

        // Note: roleId 1 = Artist, roleId 2 = Owner, roleId 3 = Operator.  
        management.initiateSplitPayment(governed721Org, 1, 10, privateKeys, block.timestamp);

        vm.roll(block.number + minutesToBlocks(10,  helperConfig.getBlocksPerHour(block.chainid)));
        management.executeSplitPayment(governed721Org, 1, 10, privateKeys, block.timestamp);

        assertTrue(IGoverned721(governed721Org).getSplit(IGoverned721.Role.Artist) == 10, "Artist should have 10% split");
    }

    function test_vetoSplitPayment() public { 
        // TBI 
    }

    function test_CollectSplitPayment() public {
        // the token first has to be sold.. 
        test_sellTokenAndClaimRoles();

        management.collectPayment(governed721Org, transferId, privateKeys, block.timestamp);
    }
}
