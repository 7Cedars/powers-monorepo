// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script } from "forge-std/Script.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol";

import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { IMandate } from "@src/interfaces/IMandate.sol";
import { ElectionRegistry } from "@src/helpers/ElectionRegistry.sol";

contract ActionHelpers is Script { 
    Configurations helperConfig = new Configurations();

    //////////////////////////////////////////////////////////////////////////////////
    //                             Helper Functions                                 //
    //////////////////////////////////////////////////////////////////////////////////  
    // NB: the name + description needs to exactly match the name + description of the mandate in order to find the correct mandate ID.  
    function findMandateIdInOrg(string memory description, Powers org) public view returns (uint16) {
        uint16 counter = org.mandateCounter();
        for (uint16 i = 1; i < counter; i++) {
            (address mandateAddress, , ) = org.getAdoptedMandate(i);
            string memory mandateDesc = IMandate(mandateAddress).getNameDescription(address(org), i);
            if (Strings.equal(mandateDesc, description)) {
                return i;
            }
        }
        revert(string.concat("Mandate not found: ", description));
    }

    function calculateActionId(uint16 mandateId, bytes memory mandateCalldata, uint256 nonce) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(mandateId, mandateCalldata, nonce)));
    }

    function voteOnProposal(
        address organisation,
        uint16 mandateToVoteOn,
        uint256 actionIdLocal,
        uint256[] memory privateKeys,
        uint256 randomiser,
        uint256 passChance // in percentage
    )
        public
        returns (uint256 roleCountLocal, uint256 againstVoteLocal, uint256 forVoteLocal, uint256 abstainVoteLocal)
    {
        uint256 currentRandomiser;
        for (uint256 i = 0; i < privateKeys.length; i++) {
            // set randomiser..
            if (currentRandomiser < 10) {
                currentRandomiser = randomiser;
            } else {
                currentRandomiser = currentRandomiser / 10;
            } 
            address voter = vm.addr(privateKeys[i]); // msg.sender will also vote, so we add them to the end of the list of private keys.
            // vote
            console2.log("Voter: ", voter);
            if (Powers(payable(organisation)).canCallMandate(voter, mandateToVoteOn)) {
                roleCountLocal++; 
                if (currentRandomiser % 100 >= passChance) {
                    vm.startBroadcast(privateKeys[i]);
                    Powers(payable(organisation)).castVote(actionIdLocal, 0); // = against
                    vm.stopBroadcast();
                    againstVoteLocal++;
                } else if (currentRandomiser % 100 < passChance) {
                    vm.startBroadcast(privateKeys[i]);
                    Powers(payable(organisation)).castVote(actionIdLocal, 1); // = for
                    vm.stopBroadcast();
                    forVoteLocal++;
                } else {
                    vm.startBroadcast(privateKeys[i]);
                    Powers(payable(organisation)).castVote(actionIdLocal, 2); // = abstain
                    vm.stopBroadcast();
                    abstainVoteLocal++;
                } 
            }
        } 
    }

    //////////////////////////////////////////////////////////////////////////////////
    //                         Election Helper Functions                            //
    //////////////////////////////////////////////////////////////////////////////////
    // These functions are split at time-dependent points in the election flow.
    // Phase 1: createElectionAndNominate() - creates election and nominates candidates
    // ⏳ TIME BREAK - wait for nomination period to end (startBlock)
    // Phase 2: openVotingAndCastVotes() - opens voting and casts votes
    // ⏳ TIME BREAK - wait for voting period to end (endBlock)
    // Phase 3: tallyElection() + cleanupElection() - tallies results and cleans up

    /// @notice Phase 1+2: Create an election and nominate candidates
    /// @param organisation The Powers organisation address
    /// @param createElectionMandateId The mandate ID for creating elections
    /// @param nominateMandateId The mandate ID for self-nomination
    /// @param electionTitle The title of the election
    /// @param nomineePrivateKeys Array of private keys for accounts that will nominate themselves
    /// @return electionId The unique ID of the created election
    function createElectionAndNominate(
        address organisation,
        uint16 createElectionMandateId,
        uint16 nominateMandateId,
        string memory electionTitle,
        uint256[] memory nomineePrivateKeys, 
        uint256 nonce
    ) public returns (uint256 electionId) {
        // Calculate election ID (matches how ElectionRegistry calculates it)
        electionId = uint256(keccak256(abi.encodePacked(organisation, electionTitle)));
        
        // Step 1: Create the election
        bytes memory createCalldata = abi.encode(electionTitle);
        
        console2.log("Creating election:", electionTitle);
        vm.startBroadcast();
        Powers(payable(organisation)).request(createElectionMandateId, createCalldata, nonce, "");
        vm.stopBroadcast();
        
        // Step 2: Each nominee nominates themselves
        for (uint256 i = 0; i < nomineePrivateKeys.length; i++) {
            address nominee = vm.addr(nomineePrivateKeys[i]);
            bytes memory nominateCalldata = abi.encode(electionTitle);
            nonce = nonce + i;   
            
            console2.log("Nominating:", nominee);
            vm.startBroadcast(nomineePrivateKeys[i]);
            Powers(payable(organisation)).request(nominateMandateId, nominateCalldata, nonce, "");
            vm.stopBroadcast();
        }
        
        return electionId;
    }

    /// @notice Phase 3: Open election voting and cast votes
    /// @dev Must be called after startBlock (nomination period ended) and before endBlock
    /// @param organisation The Powers organisation address
    /// @param electionRegistry The ElectionRegistry contract address
    /// @param openVoteMandateId The mandate ID for opening election voting
    /// @param electionId The unique ID of the election
    /// @param electionTitle The title of the election
    /// @param voterPrivateKeys Array of private keys for voters
    /// @param voteSelections 2D array where each row is a voter's boolean selections for each nominee
    /// @return voteMandateId The mandate ID of the newly created Vote mandate
    function openVotingAndCastVotes(
        address organisation,
        address electionRegistry,
        uint16 openVoteMandateId,
        uint256 electionId,
        string memory electionTitle,
        uint256[] memory voterPrivateKeys,
        bool[][] memory voteSelections, 
        uint256 nonce
    ) public returns (uint16 voteMandateId) {
        require(voterPrivateKeys.length == voteSelections.length, "Voter count must match vote selections count");
        
        // Step 1: Open election voting by adopting a Vote mandate
        bytes memory openVoteCalldata = abi.encode(electionTitle);
        
        // Get the current mandate counter (new vote mandate will be this ID)
        voteMandateId = Powers(payable(organisation)).mandateCounter();
        
        console2.log("Opening election voting for:", electionTitle);
        console2.log("Vote mandate will be ID:", voteMandateId);
        
        vm.startBroadcast();
        Powers(payable(organisation)).request(openVoteMandateId, openVoteCalldata, nonce, "");
        vm.stopBroadcast();
        
        // Step 2: Cast votes
        // Get nominees to validate vote selections length
        address[] memory nominees = ElectionRegistry(electionRegistry).getNominees(electionId);
        
        for (uint256 i = 0; i < voterPrivateKeys.length; i++) {
            address voter = vm.addr(voterPrivateKeys[i]);
            
            // Check voter can call this mandate
            if (!Powers(payable(organisation)).canCallMandate(voter, voteMandateId)) {
                console2.log("Voter cannot call mandate, skipping:", voter);
                continue;
            }
            
            // Check voter hasn't already voted
            if (ElectionRegistry(electionRegistry).hasUserVoted(voter, electionId)) {
                console2.log("Voter already voted, skipping:", voter);
                continue;
            }
            
            require(voteSelections[i].length == nominees.length, "Vote selection length must match nominee count");
            
            // Encode the vote selections as raw bool values (not as an array)
            // The Vote mandate expects each bool as a separate 32-byte word
            bytes memory voteCalldata = new bytes(nominees.length * 32);
            for (uint256 j = 0; j < nominees.length; j++) {
                // Each bool is encoded as a 32-byte word
                bytes32 boolValue = voteSelections[i][j] ? bytes32(uint256(1)) : bytes32(uint256(0));
                for (uint256 k = 0; k < 32; k++) {
                    voteCalldata[j * 32 + k] = boolValue[k];
                }
            }
             
            console2.log("Voter casting vote:", voter);
            vm.startBroadcast(voterPrivateKeys[i]);
            Powers(payable(organisation)).request(voteMandateId, voteCalldata, nonce, "");
            vm.stopBroadcast();
        }
        
        return voteMandateId;
    }

    /// @notice Phase 4a: Tally election results and assign roles
    /// @dev Must be called after endBlock (voting period ended)
    /// @param organisation The Powers organisation address
    /// @param tallyMandateId The mandate ID for tallying election results
    /// @param electionTitle The title of the election
    function tallyElection(
        address organisation,
        uint16 tallyMandateId,
        uint16 cleanupMandateId,
        string memory electionTitle, 
        uint256 nonce
    ) public {
        bytes memory tallyCalldata = abi.encode(electionTitle); 

        console2.log("Tallying election:", electionTitle);
        vm.startBroadcast();
        Powers(payable(organisation)).request(tallyMandateId, tallyCalldata, nonce, "");
        vm.stopBroadcast();

        bytes memory cleanupCalldata = abi.encode(electionTitle);
        
        console2.log("Cleaning up election:", electionTitle);
        vm.startBroadcast();
        Powers(payable(organisation)).request(cleanupMandateId, cleanupCalldata, nonce, "");
        vm.stopBroadcast();
    }
}
