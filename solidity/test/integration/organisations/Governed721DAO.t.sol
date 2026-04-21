// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test, console } from "forge-std/Test.sol";
import { Powers } from "../../../src/Powers.sol";
import { Governed721, IGoverned721 } from "../../../src/helpers/Governed721.sol";
import { Deploy } from "../../../governance/examples/Governed721.s.sol";
import { Mandate } from "../../../src/Mandate.sol";

contract Governed721DAO_IntegrationTest is Test {
    struct Mem {
        uint16 proposeSplitId;
        uint16 vetoMinterId;
        uint16 vetoOwnerId;
        uint16 vetoIntermediaryId;
        uint16 splitCheckpoint1;
        uint16 splitCheckpoint2;
        uint16 splitCheckpoint3;
        address executive;
        address minter;
        bytes splitArtistParams;
        bytes splitIntermediaryParams;
        uint256 nonce;
        uint256 actionIdArtist;
        uint256 vetoActionId;
        uint32 timelock;
        uint32 vetoVotingPeriod;
    }
    Mem mem;

    Deploy deployScript;
    Powers powers;
    Governed721 governed721;

    function setUp() public {
        // Deploy the script
        deployScript = new Deploy(); 
        deployScript.run();

        // Get the deployed contracts
        powers = deployScript.powers();
        governed721 = deployScript.governed721();

        // run the first setup mandate to set roles
        powers.request(1, abi.encode(""), 123, "Setup: Assign roles and labels");
    }

    function test_Deployment() public {
        // Verify Powers deployment
        assertTrue(address(powers) != address(0), "Powers contract should be deployed");
        
        // Verify Governed721 deployment
        assertTrue(address(governed721) != address(0), "Governed721 contract should be deployed");

        // Verify Ownership
        assertEq(governed721.owner(), address(powers), "Powers should be the owner of Governed721");

        // Verify Payment Mandate ID is set (not 0)
        assertTrue(governed721.paymentMandateId() != 0, "Payment Mandate ID should be set");

        // verify roles have been set after running setup mandate 
        powers.getAmountRoleHolders(1); // Role 1 = Artist
        powers.getAmountRoleHolders(5); // Role 5 = Executive
        assertTrue(powers.getAmountRoleHolders(1) == 1, "Should have one Artist");
        assertTrue(powers.getAmountRoleHolders(5) == 1, "Should have one Executive");

        console.log("Powers deployed at: %s", address(powers));
        console.log("Governed721 deployed at: %s", address(governed721));
    }

    function findMandateIdInOrg(string memory description, Powers org) public view returns (uint16) {
        uint16 counter = org.mandateCounter();
        for (uint16 i = 1; i < counter; i++) {
            (address mandateAddress, , ) = org.getAdoptedMandate(i);
            string memory mandateDesc = Mandate(mandateAddress).getNameDescription(address(org), i);
            // using keccak256 for string comparison
            if (keccak256(abi.encodePacked(mandateDesc)) == keccak256(abi.encodePacked(description))) {
                return i;
            }
        }
        revert(string.concat("Mandate not found: ", description));
    }

    function test_SplitGovernanceFlow() public {
        // step 0: loading relevant mandate Ids to memory. 
        mem.proposeSplitId = findMandateIdInOrg("Propose Split Payment: Executive proposes new split. Role 1 = Artist, Role 2 = Intermediary. The old owner gets the remainder after Artist and Intermediary split.", powers);
        mem.vetoMinterId = findMandateIdInOrg("Veto Split (Minter): Minter can veto split change.", powers);
        mem.vetoOwnerId = findMandateIdInOrg("Veto Split (Owner): Owner can veto split change.", powers);
        mem.vetoIntermediaryId = findMandateIdInOrg("Veto Split (Intermediary): Intermediary can veto split change.", powers);
        mem.splitCheckpoint1 = findMandateIdInOrg("Split Checkpoint 1: Confirm no Minter veto.", powers);
        mem.splitCheckpoint2 = findMandateIdInOrg("Split Checkpoint 2: Confirm no Owner veto.", powers);
        mem.splitCheckpoint3 = findMandateIdInOrg("Execute Split Payment: Set new split payment.", powers);

        // step 1: fetching address executive. 
        mem.executive = powers.getRoleHolderAtIndex(5, 0);
        assertTrue(mem.executive != address(0), "Should have an executive");

        vm.startPrank(mem.executive);

        // Propose new split: 10% to Artist (Role 1), 5% to Intermediary (Role 3) -> the contract enum uses Role.Artist = 1, Role.Intermediary = 3
        // inputParams are percentage and role. The calldata encode expects `uint8 Percentage`, `uint8 Role`
        mem.splitArtistParams = abi.encode(uint8(1), uint8(1));
        mem.nonce = 1;

        // Propose new split for Artist
        mem.actionIdArtist = powers.propose(mem.proposeSplitId, mem.splitArtistParams, mem.nonce, "Propose 10% for Artist");
        
        // Execute the Statement of Intent
        powers.request(mem.proposeSplitId, mem.splitArtistParams, mem.nonce, "Propose 10% for Artist");
        vm.stopPrank();

        // Executive confirms checkpoints
        vm.prank(mem.executive);
        powers.propose(mem.splitCheckpoint1, mem.splitArtistParams, mem.nonce, "Checkpoint 1: propose action");

        // Now we wait for the veto period to pass (10 mins for checkpoint 1)
        // Checkpoint 1: Wait for vetos. 10 minutes timelock.
        mem.timelock = powers.getConditions(mem.splitCheckpoint1).timelock;
        vm.roll(block.number + mem.timelock + 1);

        vm.startPrank(mem.executive);
        powers.request(mem.splitCheckpoint1, mem.splitArtistParams, mem.nonce, "Checkpoint 1");
        powers.request(mem.splitCheckpoint2, mem.splitArtistParams, mem.nonce, "Checkpoint 2");
        powers.request(mem.splitCheckpoint3, mem.splitArtistParams, mem.nonce, "Execute Split for Artist");
        vm.stopPrank();

        // Check if the split was applied
        assertEq(governed721.getSplit(IGoverned721.Role.Artist), 1, "Artist split should be 1%");

        // Now propose for Intermediary
        vm.startPrank(mem.executive);
        mem.nonce++;
        mem.splitIntermediaryParams = abi.encode(uint8(3), uint8(5));
        
        powers.request(mem.proposeSplitId, mem.splitIntermediaryParams, mem.nonce, "Propose 5% for Intermediary");
        vm.stopPrank();

        // Minter vetos the intermediary split!
        mem.minter = powers.getRoleHolderAtIndex(1, 0);
        assertTrue(mem.minter != address(0), "Should have a minter");

        vm.startPrank(mem.minter);
        mem.vetoActionId = powers.propose(mem.vetoMinterId, mem.splitIntermediaryParams, mem.nonce, "Veto Intermediary Split");
        powers.castVote(mem.vetoActionId, 1); // 1 = For
        vm.stopPrank();

        mem.vetoVotingPeriod = powers.getConditions(mem.vetoMinterId).votingPeriod;
        vm.roll(block.number + mem.vetoVotingPeriod + 1);

        vm.startPrank(mem.minter);
        powers.request(mem.vetoMinterId, mem.splitIntermediaryParams, mem.nonce, "Execute Veto");
        vm.stopPrank();

        // Now the executive tries to pass checkpoints, but it should fail at checkpoint 1 because vetoMinterId is fulfilled
        vm.prank(mem.executive);
        powers.propose(mem.splitCheckpoint1, mem.splitIntermediaryParams, mem.nonce, "Checkpoint 1 after veto");
        
        vm.roll(block.number + mem.timelock + 1);

        vm.startPrank(mem.executive);
        vm.expectRevert(); // Should revert due to condition needNotFulfilled
        powers.request(mem.splitCheckpoint1, mem.splitIntermediaryParams, mem.nonce, "Checkpoint 1 after veto");
        vm.stopPrank();
        // The intermediary split remains 0
        assertEq(governed721.getSplit(IGoverned721.Role.Intermediary), 0, "Intermediary split should be 0%");
    }
}
