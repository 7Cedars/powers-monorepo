// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IPowers } from "../interfaces/IPowers.sol";
import { IMandate } from "../interfaces/IMandate.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { PowersTypes } from "../interfaces/PowersTypes.sol";

// import { console2 } from "forge-std/console2.sol"; // remove before deploying.

/// @title SlateRegistry
/// @notice A contract to manage elections between slates of executable actions.   
/// @dev IMPORTANT: the contract needs to have been assigned its own role Id in the Powers protocol. Without it, it will not bbe able to execute the results of a slate vote. If more than one address holds the role, the contract will revert. 
/// @author 7Cedars
contract SlateRegistry is Ownable {
    // Election storage
    struct Election { 
        uint8 flowIndex; 
        uint8 maxVotes; 
        uint8 maxWinners;
        uint48 startBlock;
        uint48 endBlock;
        string electionTitle;
    }

    mapping(uint256 electionId => Election) public elections;
    mapping(uint256 electionId => uint16[]) slates; 
    mapping(uint256 electionId => mapping(uint16 slate => uint32)) votesCount;
    mapping(uint256 electionId => mapping(address voter => bool)) hasVoted;
    
    uint48 immutable public voteDuration;
    uint48 immutable public submitSlateDuration;  
    uint256 immutable public roleId; // roleId of the registry. Has to be unique. 
    uint16 immutable public submissionMandateId; // the mandateId used to submit slates.
    uint16 immutable public revokeMandateId; // the mandateId used revoke slates.

    // Events
    event SlateReceived(uint256 indexed electionId, address indexed slate);
    event SlateRevoked(uint256 indexed electionId, address indexed slate);
    event ElectionCreated(uint256 indexed electionId, string electionTitle, uint48 startBlock, uint48 endBlock);
    event VoteCast(address indexed voter, uint16 indexed slate, uint256 indexed electionId);

    // constructor
    constructor(uint48 _submitSlateDuration, uint48 _voteDuration, uint256 _roleId) Ownable(msg.sender) {
        submitSlateDuration = _submitSlateDuration;
        voteDuration = _voteDuration;
        roleId = _roleId; 
    }

    // Functions
    /// Create a new vote
    /// @param electionTitle electionTitle of the vote.
    /// @param maxSlates Maximum number of slates allowed in the election.
    /// @param maxVotes Maximum number of votes allowed per voter.
    /// @param maxWinners Maximum number of winners allowed in the election.
    function createElection(string memory electionTitle, uint8 maxSlates, uint8 maxVotes, uint8 maxWinners) external returns (uint256) {
        uint256 electionId = uint256(keccak256(abi.encodePacked(msg.sender, electionTitle)));

        if (IPowers(owner()).getAmountRoleHolders(roleId) > 1) {
            revert ("Multiple role holders not supported for slate registry");
        } 
        if (elections[electionId].startBlock != 0) revert("vote already exists");

        // initialise election
        PowersTypes.Flow memory election = PowersTypes.Flow({
            mandateIds: new uint16[](maxSlates),
            nameDescription: electionTitle
        });
        IPowers(owner()).addFlow(election);

        elections[electionId] =
            Election({ 
                flowIndex: uint8(IPowers(owner()).getFlowCount() - 1), 
                startBlock: uint48(block.number) + submitSlateDuration, 
                endBlock: uint48(block.number) + submitSlateDuration + voteDuration, 
                electionTitle: electionTitle,
                maxVotes: maxVotes,
                maxWinners: maxWinners
            });

        emit ElectionCreated(electionId, electionTitle, uint48(block.number) + submitSlateDuration, uint48(block.number) + submitSlateDuration + voteDuration);
        
        return electionId;
    }

    /// Election for nominees in a vote
    /// @param electionId ID of the vote.
    /// @param caller Address of the voter. 
    function vote(uint256 electionId, address caller, uint16[] memory slateIndexes) external onlyOwner() {        
        Election storage currentElection = elections[electionId];
        if (block.number < currentElection.startBlock || block.number > currentElection.endBlock) {
            revert("vote closed");
        }
        if (hasVoted[electionId][caller]) revert("already voted");
        if (slateIndexes.length > currentElection.maxVotes) revert("too many votes");

        hasVoted[electionId][caller] = true;
        // Cast vote for a slate (by its mandate Id). 
        // Note there is no check if the mandate Id is actually part of the election. If it is an incorrect vote, the vote will simply not be counted in the election results. 
        for (uint256 i = 0; i < slateIndexes.length; i++) {
            uint16 slateIndex = slateIndexes[i];
            votesCount[electionId][slateIndex]++;
            emit VoteCast(caller, slateIndex, electionId);
        }
    }

    function executeResults(uint256 electionId) external onlyOwner() {
        // retrieve election results.  
        Election storage currentElection = elections[electionId];
        
        (uint16[] memory rankedSlates, ) = getSlateRanking(electionId); 

        for (uint256 i = 0; i < currentElection.maxWinners; i++) {
            uint16 slateIndex = rankedSlates[i];
            IPowers(owner()).request(slateIndex, "", i, string.concat("Execution of slate in election: ", currentElection.electionTitle));  
        }
    }

    // --- View helpers ---
    function isElectionOpen(uint256 electionId) external view returns (bool) {
        Election storage currentElection = elections[electionId];
        return block.number >= currentElection.startBlock && block.number <= currentElection.endBlock;
    }

    function getElectionInfo(uint256 electionId) external view returns (Election memory) {
        return elections[electionId];
    }

    function getSlates(uint256 electionId) public view returns (uint16[] memory) {
        return slates[electionId];
    }

    function getSlateCount(uint256 electionId) external view returns (uint256) {
        return slates[electionId].length;
    }

    function getElectionCount(uint256 electionId, uint16 slate) external view returns (uint256) {
        return votesCount[electionId][slate];
    }

    function hasUserVoted(address voter, uint256 electionId) external view returns (bool) {
        return hasVoted[electionId][voter];
    }

    function getSlateRanking(uint256 electionId)
        public
        view
        returns (uint16[] memory rankedSlates, uint32[] memory votes)
    {
        Election storage currentElection = elections[electionId];
        if (block.number >= currentElection.startBlock && block.number <= currentElection.endBlock) {
            revert("vote still active");
        }

        (rankedSlates, votes) = getRankingAnyTime(electionId);
    }

    function getRankingAnyTime(uint256 electionId)
        public
        view
        returns (uint16[] memory rankedSlates, uint32[] memory votes)
    {
        uint256 numSlates = getSlates(electionId).length;
        if (numSlates == 0) return (new uint16[](0), new uint32[](0));

        rankedSlates = new uint16[](numSlates);
        votes = new uint32[](numSlates);

        // Copy slates and their votes
        for (uint256 i; i < numSlates; i++) {
            rankedSlates[i] = slates[electionId][i];
            votes[i] = votesCount[electionId][rankedSlates[i]];
        }

        // Simple bubble sort by vote count (descending)
        for (uint256 i; i < numSlates - 1; i++) {
            for (uint256 j; j < numSlates - i - 1; j++) {
                if (votes[j] < votes[j + 1]) {
                    // Swap votes
                    uint32 tempVotes = votes[j];
                    votes[j] = votes[j + 1];
                    votes[j + 1] = tempVotes;

                    // Swap slates                    
                    uint16 tempSlate = rankedSlates[j];
                    rankedSlates[j] = rankedSlates[j + 1];
                    rankedSlates[j + 1] = tempSlate;
                }
            }
        }

        return (rankedSlates, votes);
    }
}