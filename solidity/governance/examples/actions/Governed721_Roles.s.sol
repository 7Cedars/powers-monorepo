// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
 
import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "./ActionHelpers.s.sol";

import { Governed721, IGoverned721 } from "@src/helpers/Governed721.sol";

// This script contains a set of modular interactions with the primary layer. They  can be used for testing or setting up up an organisation after deployment. 

contract Governed721_Roles is ActionHelpers {
    uint16[] mandateSlots; 
    uint256[] actionIds; 

    uint256 roleCount; 
    uint256 againstVote; 
    uint256 forVote; 
    uint256 abstainVote;
    
    ///////////////////////////////////////////////////////////////
    //                          CLAIM ROLES                      // 
    ///////////////////////////////////////////////////////////////
    function getOwnerArtistOperatorRole(address powers, uint256 tokenId, uint256 nonce) public {
        // step 0: reset state variables.
        delete mandateSlots;
        
        // step 1: identify mandates to run for checking tokens.
        mandateSlots.push(findMandateIdInOrg("Check ownership Token: This check is needed to assign the owner role to the NFT owner in the next mandate.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Check artist Token: This check is needed to assign the artist role to the NFT artist in the next mandate.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Check operator Token: This check is needed to assign the operator role to the NFT operator in the next mandate.", Powers(payable(powers))));

        // step 2: checking tokens.
        vm.startBroadcast();
        for (uint256 i = 0; i < mandateSlots.length; i++) {
            Powers(payable(powers)).request(mandateSlots[i], abi.encode(tokenId), nonce, string.concat("Claiming role for tokenId: ", vm.toString(tokenId)));
        }
        vm.stopBroadcast();

        // step 3: identify mandates to run for assigning roles 
        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Assign Owner Role: Assigns Owner role to the owner of the NFT.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Assign Artist Role: Assigns Artist role to the artist of the NFT.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Assign Operator Role: Assigns Operator role to the approved address of the NFT.", Powers(payable(powers))));

        // step 4: assigning roles.
        vm.startBroadcast();
        for (uint256 i = 0; i < mandateSlots.length; i++) {
            Powers(payable(powers)).request(mandateSlots[i], abi.encode(tokenId), nonce, string.concat("Claiming role for tokenId: ", vm.toString(tokenId)));
        }
        vm.stopBroadcast();
    }

    ///////////////////////////////////////////////////////////////
    //                 VOTER AND EXECUTIVE ROLES                 // 
    ///////////////////////////////////////////////////////////////
    function claimVoterRole(address powers, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
        
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Assign Owner Role: Assigns Owner role to the owner of the NFT.", Powers(payable(powers))));

        // step 2: Claim voter roles 
        for (uint256 i = 0; i < privateKeys.length; i++) {
            address claimant = vm.addr(privateKeys[i]);
            if (Powers(payable(powers)).hasRoleSince(claimant, 1) > 0 || Powers(payable(powers)).hasRoleSince(claimant, 2) > 0 || Powers(payable(powers)).hasRoleSince(claimant, 3) > 0) { // roleId 1 = Artist, roleId 2 = Owner, roleId 3 = Operator
                vm.startBroadcast();
                Powers(payable(powers)).request(mandateSlots[0], abi.encode(claimant), nonce, string.concat("Claiming voter role for: ", vm.toString(claimant)));
                vm.stopBroadcast();
            }   
        }
    }


    function createExecutiveElection(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Create Executive Election: Voters can create election.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Nominate for Executive: Voters can nominate.", Powers(payable(powers)))); 
        
        // step 2: Create Election & Nominate 
        createElectionAndNominate(
            powers, 
            mandateSlots[0], 
            mandateSlots[1], 
            "Executive Election 1", 
            privateKeys, // nominee private keys (if any)
            nonce
        );
    }

    function voteInExecutiveElection(address powers, address electionRegistry, bool[][] memory voteSelections, uint256 electionId, uint256[] memory privateKeys, uint256 nonce) public {
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Open Executive Vote: Open voting.", Powers(payable(powers)))); 

        // Step 2: Vote in Election
        openVotingAndCastVotes(
            powers, 
            electionRegistry,
            mandateSlots[0],  
            electionId,
            "Executive Election 1",
            privateKeys, // voter private keys
            voteSelections, 
            nonce
        );
    }

    function tallyExecutiveElection(address powers, uint256 nonce) public {
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Tally Executive Election: Tally votes.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Cleanup Election: Cleanup mandates.", Powers(payable(powers))));
        
        // Step 4: Tally votes and cleanup
        tallyElection(
            powers,  
            mandateSlots[0],  
            mandateSlots[1],   
            "Executive Election 1", 
            nonce
        );
    }
}
