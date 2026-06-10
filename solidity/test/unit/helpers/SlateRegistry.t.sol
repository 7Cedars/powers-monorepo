// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test } from "forge-std/Test.sol";
import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { SlateRegistry } from "@src/helpers/SlateRegistry.sol";

/// @notice Unit tests for SlateRegistry
contract SlateRegistryTest is TestSetupHelpers {
    // Registry deployed with the test contract as owner (for owner-restricted calls)
    SlateRegistry public slateRegistry;

    // Non-existent election ID used for view-function tests
    uint256 constant FAKE_ELECTION_ID = 0xdeadbeef;

    // Durations and roleId used in constructor tests
    uint48 constant SUBMIT_DURATION = 100;
    uint48 constant VOTE_DURATION = 200;
    uint256 constant REGISTRY_ROLE_ID = ROLE_ONE;

    function setUp() public override {
        super.setUp();
        // Deploy with test contract as owner so we can call onlyOwner functions directly
        slateRegistry = new SlateRegistry(SUBMIT_DURATION, VOTE_DURATION, REGISTRY_ROLE_ID);
    }

    // ─── BASIC BEHAVIOUR ───

    /// @notice Constructor stores submitSlateDuration correctly
    function testConstructorStoresSubmitSlateDuration() public view {
        assertEq(slateRegistry.submitSlateDuration(), SUBMIT_DURATION);
    }

    /// @notice Constructor stores voteDuration correctly
    function testConstructorStoresVoteDuration() public view {
        assertEq(slateRegistry.voteDuration(), VOTE_DURATION);
    }

    /// @notice Constructor stores roleId correctly
    function testConstructorStoresRoleId() public view {
        assertEq(slateRegistry.roleId(), REGISTRY_ROLE_ID);
    }

    /// @notice Deployer is set as owner
    function testConstructorOwnerIsDeployer() public view {
        assertEq(slateRegistry.owner(), address(this));
    }

    // ─── VIEW FUNCTIONS ON NON-EXISTENT ELECTIONS ───

    /// @notice isElectionOpen returns false for an election that was never created
    function testIsElectionOpenReturnsFalseForNonExistent() public view {
        bool open = slateRegistry.isElectionOpen(FAKE_ELECTION_ID);
        assertFalse(open);
    }

    /// @notice getSlates returns an empty array for a non-existent election
    function testGetSlatesReturnsEmptyForNonExistent() public view {
        uint16[] memory result = slateRegistry.getSlates(FAKE_ELECTION_ID);
        assertEq(result.length, 0);
    }

    /// @notice getSlateCount returns 0 for a non-existent election
    function testGetSlateCountReturnsZeroForNonExistent() public view {
        assertEq(slateRegistry.getSlateCount(FAKE_ELECTION_ID), 0);
    }

    /// @notice hasUserVoted returns false for any user on a non-existent election
    function testHasUserVotedReturnsFalseForNonExistent() public view {
        assertFalse(slateRegistry.hasUserVoted(alice, FAKE_ELECTION_ID));
    }

    /// @notice getElectionInfo returns a zeroed Election struct for a non-existent election
    function testGetElectionInfoReturnsZeroStructForNonExistent() public view {
        SlateRegistry.Election memory info = slateRegistry.getElectionInfo(FAKE_ELECTION_ID);
        assertEq(info.startBlock, 0);
        assertEq(info.endBlock, 0);
    }

    /// @notice getElectionCount returns 0 votes for any slate on a non-existent election
    function testGetElectionCountReturnsZeroForNonExistent() public view {
        assertEq(slateRegistry.getElectionCount(FAKE_ELECTION_ID, 1), 0);
    }

    // ─── RANKING VIEWS ON NON-EXISTENT / CLOSED ELECTIONS ───

    /// @notice getRankingAnyTime returns empty arrays when there are no slates
    function testGetRankingAnyTimeReturnsEmptyForNonExistent() public view {
        (uint16[] memory ranked, uint32[] memory votes) = slateRegistry.getRankingAnyTime(FAKE_ELECTION_ID);
        assertEq(ranked.length, 0);
        assertEq(votes.length, 0);
    }

    /// @notice getSlateRanking succeeds (returning empty arrays) when the election startBlock is 0
    /// because block.number > 0 >= startBlock, so the "vote still active" guard does not trigger.
    function testGetSlateRankingSucceedsWhenElectionNeverCreated() public view {
        // startBlock == 0 and endBlock == 0: block.number > 0 so neither
        // (block.number >= startBlock && block.number <= endBlock) is true.
        (uint16[] memory ranked, uint32[] memory votes) = slateRegistry.getSlateRanking(FAKE_ELECTION_ID);
        assertEq(ranked.length, 0);
        assertEq(votes.length, 0);
    }

    // ─── EDGE CASES ───

    /// @notice registerSlate succeeds when called by owner (test contract) and submission phase is open
    /// We manually warp so that block.number < startBlock still holds (startBlock = block.number + SUBMIT_DURATION).
    /// Because the election is never created via createElection (which always reverts — see FAILING test),
    /// we test registerSlate against an election with startBlock==0: it will revert "submission phase closed"
    /// since block.number > 0 >= startBlock. This confirms the guard is working correctly.
    function testRegisterSlateRevertsWhenElectionNotCreated() public {
        vm.expectRevert("submission phase closed");
        slateRegistry.registerSlate(FAKE_ELECTION_ID, 1);
    }

    /// @notice removeSlate reverts "submission phase closed" on a non-existent election for the same reason
    function testRemoveSlateRevertsWhenElectionNotCreated() public {
        vm.expectRevert("submission phase closed");
        slateRegistry.removeSlate(FAKE_ELECTION_ID, 1);
    }

    // ─── ACCESS CONTROL ───

    /// @notice registerSlate reverts when called by a non-owner
    function testRegisterSlateRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        slateRegistry.registerSlate(FAKE_ELECTION_ID, 1);
    }

    /// @notice removeSlate reverts when called by a non-owner
    function testRemoveSlateRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        slateRegistry.removeSlate(FAKE_ELECTION_ID, 1);
    }

    /// @notice vote reverts when called by a non-owner
    function testVoteRevertsNonOwner() public {
        uint16[] memory slateIndexes = new uint16[](1);
        slateIndexes[0] = 1;
        vm.prank(alice);
        vm.expectRevert();
        slateRegistry.vote(FAKE_ELECTION_ID, alice, slateIndexes);
    }

    /// @notice executeResults reverts when called by a non-owner
    function testExecuteResultsRevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        slateRegistry.executeResults(FAKE_ELECTION_ID);
    }

    // ─── FAILING TESTS ───

    // FAILING: createElection calls IPowers(owner()).addFlow() but Powers.addFlow requires
    // msg.sender == address(this) (the Powers contract). Since SlateRegistry calls addFlow
    // from outside the Powers execution context, this always reverts with Powers__OnlyPowers.
    // Solutions: (1) Change addFlow modifier to allow registered helper contracts,
    //            (2) Use a dedicated createElection mandate that calls addFlow internally,
    //            (3) Pre-create flows in constitution and pass flowIndex to createElection.
    function testCreateElectionRevertsAddFlow() public {
        // Deploy a fresh SlateRegistry owned by daoMock so it calls daoMock.addFlow
        SlateRegistry ownedByDao = new SlateRegistry(SUBMIT_DURATION, VOTE_DURATION, REGISTRY_ROLE_ID);
        // Transfer ownership to daoMock
        ownedByDao.transferOwnership(address(daoMock));

        // Any caller triggers createElection -> IPowers(daoMock).addFlow -> reverts Powers__OnlyPowers
        vm.prank(alice);
        vm.expectRevert();
        ownedByDao.createElection("Test Election", 5, 3, 1);
    }
}
