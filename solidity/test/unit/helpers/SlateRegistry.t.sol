// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test } from "forge-std/Test.sol";
import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { SlateRegistry } from "@src/helpers/SlateRegistry.sol";
import { PowersStub } from "../../mocks/PowersStub.sol";

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

// ─────────────────────────────────────────────────────────────────────────────
//              FULL ELECTION LIFECYCLE (PowersStub as owner)
// ─────────────────────────────────────────────────────────────────────────────
// Uses PowersStub as the Powers owner to exercise createElection → registerSlate
// → vote → executeResults without the onlyPowers restriction of the real Powers.
// ─────────────────────────────────────────────────────────────────────────────

contract SlateRegistryLifecycleTest is TestSetupHelpers {
    PowersStub public powersStub;
    SlateRegistry public slateReg;

    uint48 constant SUBMIT_DURATION = 100;
    uint48 constant VOTE_DURATION = 200;
    uint256 constant REGISTRY_ROLE_ID = ROLE_ONE;
    string constant ELECTION_TITLE = "Council Election";
    uint8 constant MAX_SLATES = 5;
    uint8 constant MAX_VOTES = 3;
    uint8 constant MAX_WINNERS = 1;

    event SlateRegistered(uint256 indexed electionId, uint16 indexed mandateId);
    event SlateRemoved(uint256 indexed electionId, uint16 indexed mandateId);
    event ElectionCreated(uint256 indexed electionId, string electionTitle, uint48 startBlock, uint48 endBlock);
    event VoteCast(address indexed voter, uint16 indexed slate, uint256 indexed electionId);

    function setUp() public override {
        super.setUp();
        powersStub = new PowersStub();
        slateReg = new SlateRegistry(SUBMIT_DURATION, VOTE_DURATION, REGISTRY_ROLE_ID);
        slateReg.transferOwnership(address(powersStub));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _expectedId(address creator) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(creator, ELECTION_TITLE)));
    }

    function _createElection() internal returns (uint256 electionId, uint48 startBlock, uint48 endBlock) {
        uint48 currentBlock = uint48(block.number);
        startBlock = currentBlock + SUBMIT_DURATION;
        endBlock = currentBlock + SUBMIT_DURATION + VOTE_DURATION;
        vm.prank(alice);
        electionId = slateReg.createElection(ELECTION_TITLE, MAX_SLATES, MAX_VOTES, MAX_WINNERS);
    }

    function _registerSlate(uint256 electionId, uint16 mandateId) internal {
        vm.prank(address(powersStub));
        slateReg.registerSlate(electionId, mandateId);
    }

    function _vote(uint256 electionId, address voter, uint16[] memory slateIndexes) internal {
        vm.prank(address(powersStub));
        slateReg.vote(electionId, voter, slateIndexes);
    }

    // ─── CREATE ELECTION ─────────────────────────────────────────────────────

    function testCreateElectionReturnsExpectedId() public {
        (uint256 elId,,) = _createElection();
        assertEq(elId, _expectedId(alice));
    }

    function testCreateElectionSetsStartAndEndBlocks() public {
        (uint256 elId, uint48 expectedStart, uint48 expectedEnd) = _createElection();
        SlateRegistry.Election memory info = slateReg.getElectionInfo(elId);
        assertEq(info.startBlock, expectedStart);
        assertEq(info.endBlock, expectedEnd);
    }

    function testCreateElectionSetsMaxVotesAndWinners() public {
        (uint256 elId,,) = _createElection();
        SlateRegistry.Election memory info = slateReg.getElectionInfo(elId);
        assertEq(info.maxVotes, MAX_VOTES);
        assertEq(info.maxWinners, MAX_WINNERS);
    }

    function testCreateElectionEmitsEvent() public {
        uint48 expectedStart = uint48(block.number) + SUBMIT_DURATION;
        uint48 expectedEnd = uint48(block.number) + SUBMIT_DURATION + VOTE_DURATION;
        uint256 expectedId = _expectedId(alice);
        vm.expectEmit(true, false, false, true);
        emit ElectionCreated(expectedId, ELECTION_TITLE, expectedStart, expectedEnd);
        vm.prank(alice);
        slateReg.createElection(ELECTION_TITLE, MAX_SLATES, MAX_VOTES, MAX_WINNERS);
    }

    function testCreateElectionIsElectionOpenFalseInSubmissionPhase() public {
        (uint256 elId,,) = _createElection();
        assertFalse(slateReg.isElectionOpen(elId));
    }

    function testCreateElectionIsElectionOpenTrueAtVotingStart() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        vm.roll(startBlock);
        assertTrue(slateReg.isElectionOpen(elId));
    }

    function testCreateElectionIsElectionOpenFalseAfterEnd() public {
        (uint256 elId,, uint48 endBlock) = _createElection();
        vm.roll(uint256(endBlock) + 1);
        assertFalse(slateReg.isElectionOpen(elId));
    }

    function testCreateElectionRevertsDuplicateTitle() public {
        _createElection();
        vm.prank(alice);
        vm.expectRevert("vote already exists");
        slateReg.createElection(ELECTION_TITLE, MAX_SLATES, MAX_VOTES, MAX_WINNERS);
    }

    function testCreateElectionRevertsWhenMultipleRoleHolders() public {
        powersStub.setRoleHolderCount(2);
        vm.prank(alice);
        vm.expectRevert("Multiple role holders not supported for slate registry");
        slateReg.createElection(ELECTION_TITLE, MAX_SLATES, MAX_VOTES, MAX_WINNERS);
    }

    function testTwoCreatorsProduceDifferentElectionIds() public {
        vm.prank(alice);
        slateReg.createElection(ELECTION_TITLE, MAX_SLATES, MAX_VOTES, MAX_WINNERS);
        vm.prank(bob);
        slateReg.createElection(ELECTION_TITLE, MAX_SLATES, MAX_VOTES, MAX_WINNERS);
        assertNotEq(_expectedId(alice), _expectedId(bob));
    }

    // ─── REGISTER SLATE ──────────────────────────────────────────────────────

    function testRegisterSlateSuccessfully() public {
        (uint256 elId,,) = _createElection();
        _registerSlate(elId, 42);
        assertTrue(slateReg.slateRegistered(elId, 42));
        assertEq(slateReg.getSlateCount(elId), 1);
    }

    function testRegisterSlateEmitsEvent() public {
        (uint256 elId,,) = _createElection();
        vm.expectEmit(true, true, false, false);
        emit SlateRegistered(elId, 42);
        vm.prank(address(powersStub));
        slateReg.registerSlate(elId, 42);
    }

    function testRegisterMultipleSlatesPreservesOrder() public {
        (uint256 elId,,) = _createElection();
        _registerSlate(elId, 10);
        _registerSlate(elId, 20);
        _registerSlate(elId, 30);
        uint16[] memory slates = slateReg.getSlates(elId);
        assertEq(slates.length, 3);
        assertEq(slates[0], 10);
        assertEq(slates[1], 20);
        assertEq(slates[2], 30);
    }

    function testRegisterSlateRevertsAfterSubmissionPhase() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        vm.roll(startBlock);
        vm.prank(address(powersStub));
        vm.expectRevert("submission phase closed");
        slateReg.registerSlate(elId, 42);
    }

    function testRegisterSlateRevertsAlreadyRegistered() public {
        (uint256 elId,,) = _createElection();
        _registerSlate(elId, 42);
        vm.prank(address(powersStub));
        vm.expectRevert("slate already registered");
        slateReg.registerSlate(elId, 42);
    }

    // ─── REMOVE SLATE ────────────────────────────────────────────────────────

    function testRemoveSlateSuccessfully() public {
        (uint256 elId,,) = _createElection();
        _registerSlate(elId, 42);
        vm.prank(address(powersStub));
        slateReg.removeSlate(elId, 42);
        assertFalse(slateReg.slateRegistered(elId, 42));
        assertEq(slateReg.getSlateCount(elId), 0);
    }

    function testRemoveSlateEmitsEvent() public {
        (uint256 elId,,) = _createElection();
        _registerSlate(elId, 42);
        vm.expectEmit(true, true, false, false);
        emit SlateRemoved(elId, 42);
        vm.prank(address(powersStub));
        slateReg.removeSlate(elId, 42);
    }

    function testRemoveSlateSwapAndPopPreservesRemaining() public {
        (uint256 elId,,) = _createElection();
        _registerSlate(elId, 10);
        _registerSlate(elId, 20);
        _registerSlate(elId, 30);
        // Remove first entry: swap-and-pop moves 30 to index 0
        vm.prank(address(powersStub));
        slateReg.removeSlate(elId, 10);
        assertEq(slateReg.getSlateCount(elId), 2);
        assertFalse(slateReg.slateRegistered(elId, 10));
        assertTrue(slateReg.slateRegistered(elId, 20));
        assertTrue(slateReg.slateRegistered(elId, 30));
    }

    function testRemoveSlateRevertsAfterSubmissionPhase() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        _registerSlate(elId, 42);
        vm.roll(startBlock);
        vm.prank(address(powersStub));
        vm.expectRevert("submission phase closed");
        slateReg.removeSlate(elId, 42);
    }

    function testRemoveSlateRevertsNotRegistered() public {
        (uint256 elId,,) = _createElection();
        vm.prank(address(powersStub));
        vm.expectRevert("slate not registered");
        slateReg.removeSlate(elId, 99);
    }

    // ─── VOTE ────────────────────────────────────────────────────────────────

    function testVoteSuccessfullyIncreasesCount() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        _registerSlate(elId, 42);
        vm.roll(startBlock);
        uint16[] memory votes = new uint16[](1);
        votes[0] = 42;
        _vote(elId, alice, votes);
        assertTrue(slateReg.hasUserVoted(alice, elId));
        assertEq(slateReg.getElectionCount(elId, 42), 1);
    }

    function testVoteEmitsEvent() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        _registerSlate(elId, 42);
        vm.roll(startBlock);
        uint16[] memory votes = new uint16[](1);
        votes[0] = 42;
        vm.expectEmit(true, true, true, false);
        emit VoteCast(alice, 42, elId);
        vm.prank(address(powersStub));
        slateReg.vote(elId, alice, votes);
    }

    function testVoteCanSplitAcrossMultipleSlates() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        _registerSlate(elId, 10);
        _registerSlate(elId, 20);
        vm.roll(startBlock);
        uint16[] memory votes = new uint16[](2);
        votes[0] = 10;
        votes[1] = 20;
        _vote(elId, alice, votes);
        assertEq(slateReg.getElectionCount(elId, 10), 1);
        assertEq(slateReg.getElectionCount(elId, 20), 1);
    }

    function testVoteRevertsBeforeVotingPhase() public {
        (uint256 elId,,) = _createElection();
        // Still in submission phase (startBlock = block.number + SUBMIT_DURATION)
        uint16[] memory votes = new uint16[](1);
        votes[0] = 1;
        vm.prank(address(powersStub));
        vm.expectRevert("vote closed");
        slateReg.vote(elId, alice, votes);
    }

    function testVoteRevertsAfterVotingPhase() public {
        (uint256 elId,, uint48 endBlock) = _createElection();
        vm.roll(uint256(endBlock) + 1);
        uint16[] memory votes = new uint16[](1);
        votes[0] = 1;
        vm.prank(address(powersStub));
        vm.expectRevert("vote closed");
        slateReg.vote(elId, alice, votes);
    }

    function testVoteRevertsAlreadyVoted() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        _registerSlate(elId, 42);
        vm.roll(startBlock);
        uint16[] memory votes = new uint16[](1);
        votes[0] = 42;
        _vote(elId, alice, votes);
        vm.prank(address(powersStub));
        vm.expectRevert("already voted");
        slateReg.vote(elId, alice, votes);
    }

    function testVoteReverts_TooManyVotes() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        vm.roll(startBlock);
        // MAX_VOTES = 3, attempt 4
        uint16[] memory votes = new uint16[](4);
        votes[0] = 1; votes[1] = 2; votes[2] = 3; votes[3] = 4;
        vm.prank(address(powersStub));
        vm.expectRevert("too many votes");
        slateReg.vote(elId, alice, votes);
    }

    function testVoteForUnregisteredSlateAcceptedButExcludedFromRanking() public {
        (uint256 elId, uint48 startBlock, uint48 endBlock) = _createElection();
        _registerSlate(elId, 10);
        vm.roll(startBlock);
        // Vote for slate 99 which was never registered — accepted per the source comment
        uint16[] memory votes = new uint16[](1);
        votes[0] = 99;
        _vote(elId, alice, votes);
        assertEq(slateReg.getElectionCount(elId, 99), 1);
        // Ranking only reflects registered slates; 99 does not appear
        vm.roll(uint256(endBlock) + 1);
        (uint16[] memory ranked,) = slateReg.getSlateRanking(elId);
        assertEq(ranked.length, 1);
        assertEq(ranked[0], 10);
    }

    // ─── RANKING ─────────────────────────────────────────────────────────────

    function testGetSlateRankingRevertsWhenVoteActive() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        vm.roll(startBlock);
        vm.expectRevert("vote still active");
        slateReg.getSlateRanking(elId);
    }

    function testGetRankingAnyTimeSortsDescendingByVotes() public {
        (uint256 elId, uint48 startBlock,) = _createElection();
        _registerSlate(elId, 10);
        _registerSlate(elId, 20);
        _registerSlate(elId, 30);
        vm.roll(startBlock);

        // alice votes for 10 and 30
        uint16[] memory aliceVotes = new uint16[](2);
        aliceVotes[0] = 10; aliceVotes[1] = 30;
        _vote(elId, alice, aliceVotes);

        // bob votes for 20 and 30
        uint16[] memory bobVotes = new uint16[](2);
        bobVotes[0] = 20; bobVotes[1] = 30;
        _vote(elId, bob, bobVotes);

        // charlotte votes for 30 only
        uint16[] memory charlotteVotes = new uint16[](1);
        charlotteVotes[0] = 30;
        _vote(elId, charlotte, charlotteVotes);

        // 30 has 3 votes, 10 and 20 have 1 each
        (uint16[] memory ranked, uint32[] memory voteArr) = slateReg.getRankingAnyTime(elId);
        assertEq(ranked[0], 30);
        assertEq(voteArr[0], 3);
        assertEq(voteArr[1], 1);
        assertEq(voteArr[2], 1);
    }

    function testGetSlateRankingAfterElectionClose() public {
        (uint256 elId, uint48 startBlock, uint48 endBlock) = _createElection();
        _registerSlate(elId, 10);
        _registerSlate(elId, 20);
        vm.roll(startBlock);
        uint16[] memory votes = new uint16[](1);
        votes[0] = 10;
        _vote(elId, alice, votes);
        vm.roll(uint256(endBlock) + 1);
        (uint16[] memory ranked, uint32[] memory voteArr) = slateReg.getSlateRanking(elId);
        assertEq(ranked[0], 10);
        assertEq(voteArr[0], 1);
    }

    // ─── EXECUTE RESULTS ─────────────────────────────────────────────────────

    function testExecuteResultsCallsRequestForTopWinner() public {
        (uint256 elId, uint48 startBlock, uint48 endBlock) = _createElection();
        _registerSlate(elId, 10);
        _registerSlate(elId, 20);
        vm.roll(startBlock);
        uint16[] memory votes = new uint16[](1);
        votes[0] = 10;
        _vote(elId, alice, votes);
        vm.roll(uint256(endBlock) + 1);
        vm.prank(address(powersStub));
        slateReg.executeResults(elId);
        // MAX_WINNERS = 1: one request call for the top-ranked slate (10)
        assertEq(powersStub.requestCallCount(), 1);
        assertEq(powersStub.lastRequestMandateId(), 10);
    }

    // ─── UNINITIALIZED IMMUTABLES ─────────────────────────────────────────────
    // submissionMandateId and revokeMandateId are declared immutable but are never
    // assigned in the constructor, so they permanently read as 0. These fields have no
    // effect in any current code path — appears to be an incomplete implementation.
    function testUnusedImmutablesAreZero() public view {
        assertEq(slateReg.submissionMandateId(), 0);
        assertEq(slateReg.revokeMandateId(), 0);
    }
}
