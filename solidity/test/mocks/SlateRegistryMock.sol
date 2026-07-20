// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal mock of SlateRegistry for structural isolation when testing SlateRegistry_* mandates.
/// Exposes the same external interface queried by those mandates (elections(), roleId(), registerSlate(),
/// removeSlate()) without the createElection → Powers.addFlow dependency that cannot work in unit tests
/// because Powers.addFlow is onlyPowers.
contract SlateRegistryMock {
    struct Election {
        uint8 flowIndex;
        uint8 maxVotes;
        uint8 maxWinners;
        uint48 startBlock;
        uint48 endBlock;
        string electionTitle;
    }

    mapping(uint256 => Election) public elections;
    uint256 public roleId;

    constructor(uint256 _roleId) {
        roleId = _roleId;
    }

    /// @notice Seed an election directly (test helper, bypasses createElection → addFlow path).
    function setElection(uint256 electionId, uint8 flowIndex, uint48 startBlock, uint48 endBlock) external {
        elections[electionId] = Election({
            flowIndex: flowIndex,
            maxVotes: 1,
            maxWinners: 1,
            startBlock: startBlock,
            endBlock: endBlock,
            electionTitle: ""
        });
    }

    function registerSlate(
        uint256,
        /*electionId*/
        uint16 /*mandateId*/
    )
        external { }

    function removeSlate(
        uint256,
        /*electionId*/
        uint16 /*mandateId*/
    )
        external { }

    function executeResults(
        uint256 /*electionId*/
    )
        external { }
}
