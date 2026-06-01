// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { console2 } from "forge-std/Test.sol";
import { Powers } from "@src/Powers.sol";
import { Deploy } from "@governance/examples/Governed721.s.sol";
import { Configurations } from "@script/Configurations.s.sol";
import { Strings } from "@lib/openzeppelin-contracts/contracts/utils/Strings.sol";
import { IGoverned721 } from "@src/helpers/Governed721.sol";

import { Governed721Actions } from "@governance/examples/actions/Governed721Actions.s.sol";
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
    Governed721Actions actions;

    address treasury;
    address safeAllowanceModule; 
    address testAccount1 = vm.addr(vm.envUint("TEST_ACCOUNT_KEY_1")); 
    address testAccount2 = vm.addr(vm.envUint("TEST_ACCOUNT_KEY_2"));
    address testAccount3 = vm.addr(vm.envUint("TEST_ACCOUNT_KEY_3")); 
    address testAccount4 = vm.addr(vm.envUint("TEST_ACCOUNT_KEY_4"));

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

        actions = new Governed721Actions();
        actions.runSetupMandate(governed721Org, block.timestamp, privateKeys);
        helperConfig = new Configurations();
    }

    function test_initialise() public view {
        // check dependencies 
        check_inputParamsDependencies(governed721Org); 

        // check label role 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(1))) == keccak256(abi.encodePacked("Artist")), "Role 1 should be 'Artist'"); 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(2))) == keccak256(abi.encodePacked("Owner")), "Role 2 should be 'Owner'"); 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(3))) == keccak256(abi.encodePacked("Intermediary")), "Role 3 should be 'Intermediary'"); 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(4))) == keccak256(abi.encodePacked("Voter")), "Role 4 should be 'Voter'"); 
        vm.assertTrue(keccak256(abi.encodePacked(Powers(payable(governed721Org)).getRoleLabel(5))) == keccak256(abi.encodePacked("Executive")), "Role 5 should be 'Executive'"); 
        
        // check that test Account 1 is executive 
        vm.assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount1, 5) > 0, "Test Account 1 should have Executive role");

        // check treasury 
        vm.assertTrue(Powers(payable(governed721Org)).getTreasury() == governed721Org, "Treasury should be set as organisation itself.");
    }

    function test_mintTokenAndClaimRoles() public {
        // setup: give the new owner 2 ETH to buy the token.
        vm.deal(testAccount1, 2 ether);

        console2.log("Block per hour:", helperConfig.getBlocksPerHour(block.chainid));

        // step 1: whitelist token (native ETH in this case)
        actions.whitelistPaymentTokensPropose(governed721Org, address(0), privateKeys, block.timestamp);

        vm.roll(block.number + minutesToBlocks(10,  helperConfig.getBlocksPerHour(block.chainid)));
        actions.whitelistPaymentTokensExecute(governed721Org, address(0), privateKeys, block.timestamp);

        // step 2: mintTokens. Intermediary = cedars, Owner = testAccount1, Artist = testAccount2.
        actions.mintNftAtGoverned721(governed721, testAccount1, privateKeys[2], testAccount2, 1);
        
        // step 3: claim actions.
        actions.getOwnerArtistIntermediaryRole(governed721Org, 1, block.timestamp);
        
        assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount1, 3) > 0, "Test Account 1 should have Intermediary role");
        assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount2, 1) > 0, "Test Account 2 should have Artist role");
        assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount3, 2) > 0, "Test Account 3 should have Owner role"); 

        // step 5: claim vote role. 
        actions.claimVoterRole(governed721Org, privateKeys, block.timestamp);
        for (uint256 i = 0; i < privateKeys.length; i++) {
            address claimant = vm.addr(privateKeys[i]);
            assertTrue(Powers(payable(governed721Org)).hasRoleSince(claimant, 4) > 0, string.concat("Test Account ", Strings.toString(i + 1), " should have Voter role"));
        }

        // step 6: elect executives. 
        uint256 electionId = actions.createExecutiveElection(governed721Org, privateKeys, block.timestamp);

        // set votes: everyone votes for 1st nominee.
        bool[] memory voteSelection = new bool[](3);
        voteSelection[0] = true; // for
        bool[][] memory voteSelections = new bool[][](3); 
        for (uint256 i = 0; i < 3; i++) {
            voteSelections[i] = voteSelection;
        }

        vm.roll(block.number + minutesToBlocks(6,  helperConfig.getBlocksPerHour(block.chainid)));
        actions.voteInExecutiveElection(governed721Org, electionRegistry, voteSelections, electionId, privateKeys, block.timestamp);

        vm.roll(block.number + minutesToBlocks(6,  helperConfig.getBlocksPerHour(block.chainid)));
        actions.tallyExecutiveElection(governed721Org, privateKeys, block.timestamp);

        assertTrue(Powers(payable(governed721Org)).hasRoleSince(testAccount1, 5) > 0, "Test Account 1 should have Executive role");
    }

    function test_setSplitPayment() public { 
        // note roleId 1 = Artist, roleId 2 = Owner, roleId 3 = Intermediary. The old owner gets the remainder after Artist and Intermediary split.
        actions.initiateSplitPayment(governed721Org, 1, 15, privateKeys, block.timestamp);
        actions.initiateSplitPayment(governed721Org, 3, 10, privateKeys, block.timestamp); 

        vm.roll(block.number + minutesToBlocks(11,  helperConfig.getBlocksPerHour(block.chainid))); 
        actions.executeSplitPayment(governed721Org, 1, 15, privateKeys, block.timestamp);
        actions.executeSplitPayment(governed721Org, 3, 10, privateKeys, block.timestamp);

        assertTrue(IGoverned721(governed721).getSplit(IGoverned721.Role.Artist) == 15, "Artist should have 15% split");
        assertTrue(IGoverned721(governed721).getSplit(IGoverned721.Role.Intermediary) == 10, "Intermediary should have 10% split");
    }

    function test_vetoSplitPayment() public { 
        // TBI 
    }

    function test_CollectSplitPayment() public {
        // the token first has to be sold.. 
        test_mintTokenAndClaimRoles();

        actions.buyNftAtGoverned721(governed721, 1, 1 ether, testAccount3, testAccount4, privateKeys[0], 123);
        // the calculation of transferId is not correct 
        // transferId is only emited, not stored. So we here work with fixed nonce and hard coded transferId for the test.  
        transferId = 75563888685347931465250278609645497862873052394463244380052361800918482156059; // should match the transferId emitted in the event during buy.

        actions.collectPayment(governed721Org, transferId, privateKeys, block.timestamp);
    }
}
