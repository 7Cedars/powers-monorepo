// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { ElectionRegistry } from "@src/helpers/ElectionRegistry.sol";

// ─── ELECTIONREGISTRY UNIT TESTS ────────────────────────────────────────────
// Target:  src/helpers/ElectionRegistry.sol
// Current coverage: LH:46/LF:79. Key gaps:
//   - onlyOwner modifier body when election doesn't exist (owner == address(0))
//   - revokeNomination function (FNDA:0)
//   - vote bounds check (before startBlock / after endBlock)
//   - already-voted check
//   - isElectionOpen, getElectionInfo view helpers
//   - getNomineeCount, hasUserVoted view helpers
//   - getNomineeRanking reverts when election still active
//   - getRankingAnyTime full sort path
//
// The test contract IS the owner of elections it creates because createElection
// uses msg.sender as owner.  All write operations are called without vm.prank,
// which means address(this) is the caller and passes onlyOwner.
//
// Block arithmetic (nominationDuration=100, voteDuration=100):
//   createdAtBlock N →
//     nomination period: block.number in [N, N+100)
//     voting period    : block.number in [N+100, N+200]
//     closed           : block.number > N+200
// ─────────────────────────────────────────────────────────────────────────────

contract ElectionRegistryTest is TestSetupHelpers {
    ElectionRegistry electionReg;

    uint48 constant NOMINATION_DURATION = 100;
    uint48 constant VOTE_DURATION = 100;

    string constant TITLE = "Test Election";

    // Events copied from the source contract.
    event ElectionCreated(uint256 indexed electionId, string title, uint48 startBlock, uint48 endBlock);
    event NominationReceived(uint256 indexed electionId, address indexed nominee);
    event NominationRevoked(uint256 indexed electionId, address indexed nominee);
    event VoteCast(address indexed voter, address indexed nominee, uint256 indexed electionId);

    function setUp() public override {
        super.setUp();
        electionReg = new ElectionRegistry(NOMINATION_DURATION, VOTE_DURATION);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// @dev Create election from this contract, returning its id.
    function _createElection() internal returns (uint256 elId) {
        elId = electionReg.createElection(TITLE);
    }

    /// @dev Deterministic id matching the contract's keccak256 derivation.
    function _expectedId() internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(address(this), TITLE)));
    }

    /// @dev Advance to the first block of the voting window.
    function _rollToVoting(uint48 startBlock) internal {
        vm.roll(startBlock);
    }

    /// @dev Advance past the end of the election.
    function _rollPastEnd(uint48 endBlock) internal {
        vm.roll(uint256(endBlock) + 1);
    }

    // ─── BASIC BEHAVIOUR ─────────────────────────────────────────────────────

    function testConstructorStoresImmutables() public view {
        assertEq(electionReg.nominationDuration(), NOMINATION_DURATION);
        assertEq(electionReg.voteDuration(), VOTE_DURATION);
    }

    function testCreateElectionReturnsExpectedId() public {
        uint256 elId = _createElection();
        assertEq(elId, _expectedId());
    }

    function testCreateElectionSetsElectionFields() public {
        uint48 createdAt = uint48(block.number);
        uint256 elId = _createElection();

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        assertEq(info.owner, address(this));
        assertEq(info.startBlock, createdAt + NOMINATION_DURATION);
        assertEq(info.endBlock, createdAt + NOMINATION_DURATION + VOTE_DURATION);
        assertEq(info.title, TITLE);
    }

    function testCreateElectionEmitsEvent() public {
        uint48 createdAt = uint48(block.number);
        uint48 expectedStart = createdAt + NOMINATION_DURATION;
        uint48 expectedEnd = createdAt + NOMINATION_DURATION + VOTE_DURATION;

        vm.expectEmit(false, false, false, true);
        emit ElectionCreated(_expectedId(), TITLE, expectedStart, expectedEnd);
        _createElection();
    }

    function testCreateElectionRevertsIfDuplicate() public {
        _createElection();

        vm.expectRevert("election already exists");
        electionReg.createElection(TITLE);
    }

    function testNominateDuringNominationPeriod() public {
        uint256 elId = _createElection();

        vm.expectEmit(true, true, false, false);
        emit NominationReceived(elId, alice);
        electionReg.nominate(elId, alice);

        address[] memory list = electionReg.getNominees(elId);
        assertEq(list.length, 1);
        assertEq(list[0], alice);
    }

    function testNominateRevertsIfAlreadyNominated() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        vm.expectRevert("already nominated");
        electionReg.nominate(elId, alice);
    }

    function testNominateRevertsAfterElectionStart() public {
        uint256 elId = _createElection();
        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        // Roll to startBlock — nominations are no longer accepted.
        vm.roll(info.startBlock + 1);

        vm.expectRevert("nomination not possible after election start");
        electionReg.nominate(elId, alice);
    }

    function testVoteEmitsEventAndUpdatesCount() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);
        electionReg.nominate(elId, bob);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollToVoting(info.startBlock);

        bool[] memory votes = new bool[](2);
        votes[0] = true;
        votes[1] = false;

        vm.expectEmit(true, true, true, false);
        emit VoteCast(charlotte, alice, elId);
        electionReg.vote(elId, charlotte, votes);

        assertEq(electionReg.getVoteCount(elId, alice), 1);
        assertEq(electionReg.getVoteCount(elId, bob), 0);
    }

    // ─── EDGE CASES ──────────────────────────────────────────────────────────

    function testRevokeNominationDuringNominationPeriod() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);
        electionReg.nominate(elId, bob);

        vm.expectEmit(true, true, false, false);
        emit NominationRevoked(elId, alice);
        electionReg.revokeNomination(elId, alice);

        address[] memory list = electionReg.getNominees(elId);
        assertEq(list.length, 1);
        assertEq(electionReg.getNomineeCount(elId), 1);
    }

    function testRevokeNominationEmitsRevoke() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        vm.expectEmit(true, true, false, false);
        emit NominationRevoked(elId, alice);
        electionReg.revokeNomination(elId, alice);
    }

    function testRevokeNominationSwapAndPop() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);
        electionReg.nominate(elId, bob);
        electionReg.nominate(elId, charlotte);

        // Revoke middle nominee — exercises swap-and-pop.
        electionReg.revokeNomination(elId, bob);

        assertEq(electionReg.getNomineeCount(elId), 2);
        address[] memory list = electionReg.getNominees(elId);
        bool bobFound = false;
        for (uint256 k = 0; k < list.length; k++) {
            if (list[k] == bob) bobFound = true;
        }
        assertFalse(bobFound);
    }

    function testRevokeNominationRevertsIfNotNominated() public {
        uint256 elId = _createElection();

        vm.expectRevert("not nominated");
        electionReg.revokeNomination(elId, alice);
    }

    function testRevokeNominationRevertsAfterElectionStart() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        vm.roll(info.startBlock + 1);

        vm.expectRevert("revocation not possible after election start");
        electionReg.revokeNomination(elId, alice);
    }

    function testVoteRevertsBeforeStartBlock() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        // Still in nomination window — before startBlock.
        vm.roll(info.startBlock - 1);

        bool[] memory votes = new bool[](1);
        votes[0] = true;

        vm.expectRevert("election closed");
        electionReg.vote(elId, charlotte, votes);
    }

    function testVoteRevertsAfterEndBlock() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollPastEnd(info.endBlock);

        bool[] memory votes = new bool[](1);
        votes[0] = true;

        vm.expectRevert("election closed");
        electionReg.vote(elId, charlotte, votes);
    }

    function testVoteRevertsIfAlreadyVoted() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollToVoting(info.startBlock);

        bool[] memory votes = new bool[](1);
        votes[0] = true;

        electionReg.vote(elId, charlotte, votes);

        vm.expectRevert("already voted");
        electionReg.vote(elId, charlotte, votes);
    }

    function testVoteRevertsOnLengthMismatch() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollToVoting(info.startBlock);

        bool[] memory votes = new bool[](2); // mismatch — only 1 nominee

        vm.expectRevert("votes array length mismatch");
        electionReg.vote(elId, charlotte, votes);
    }

    function testIsElectionOpenDuringVoting() public {
        uint256 elId = _createElection();
        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);

        // Before startBlock — not open.
        assertFalse(electionReg.isElectionOpen(elId));

        _rollToVoting(info.startBlock);
        assertTrue(electionReg.isElectionOpen(elId));

        // Roll to exactly endBlock — still open.
        vm.roll(info.endBlock);
        assertTrue(electionReg.isElectionOpen(elId));

        // Roll past endBlock — closed.
        _rollPastEnd(info.endBlock);
        assertFalse(electionReg.isElectionOpen(elId));
    }

    function testGetElectionInfoReturnsCorrectData() public {
        uint48 createdAt = uint48(block.number);
        uint256 elId = _createElection();

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        assertEq(info.owner, address(this));
        assertEq(info.startBlock, createdAt + NOMINATION_DURATION);
        assertEq(info.endBlock, createdAt + NOMINATION_DURATION + VOTE_DURATION);
        assertEq(info.title, TITLE);
    }

    function testGetNomineeCountCorrect() public {
        uint256 elId = _createElection();
        assertEq(electionReg.getNomineeCount(elId), 0);

        electionReg.nominate(elId, alice);
        assertEq(electionReg.getNomineeCount(elId), 1);

        electionReg.nominate(elId, bob);
        assertEq(electionReg.getNomineeCount(elId), 2);

        electionReg.revokeNomination(elId, alice);
        assertEq(electionReg.getNomineeCount(elId), 1);
    }

    function testHasUserVotedBeforeAndAfter() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollToVoting(info.startBlock);

        assertFalse(electionReg.hasUserVoted(charlotte, elId));

        bool[] memory votes = new bool[](1);
        votes[0] = true;
        electionReg.vote(elId, charlotte, votes);

        assertTrue(electionReg.hasUserVoted(charlotte, elId));
    }

    function testGetNomineeRankingRevertsWhenElectionActive() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollToVoting(info.startBlock);

        // Election is active (within voting window) — must revert.
        vm.expectRevert("election still active");
        electionReg.getNomineeRanking(elId);
    }

    function testGetNomineeRankingWorksAfterElectionEnds() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);
        electionReg.nominate(elId, bob);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollToVoting(info.startBlock);

        // Cast 2 votes for alice, 1 for bob.
        bool[] memory votesAlice = new bool[](2);
        votesAlice[0] = true;
        votesAlice[1] = false;
        electionReg.vote(elId, charlotte, votesAlice);

        bool[] memory votesBoth = new bool[](2);
        votesBoth[0] = true;
        votesBoth[1] = true;
        electionReg.vote(elId, david, votesBoth);

        _rollPastEnd(info.endBlock);

        (address[] memory ranked, uint256[] memory voteCounts) = electionReg.getNomineeRanking(elId);
        // alice = 2, bob = 1 → alice should be ranked first.
        assertEq(ranked[0], alice);
        assertEq(voteCounts[0], 2);
        assertEq(ranked[1], bob);
        assertEq(voteCounts[1], 1);
    }

    function testGetRankingAnyTimeDuringActiveElection() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);
        electionReg.nominate(elId, bob);
        electionReg.nominate(elId, charlotte);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollToVoting(info.startBlock);

        // Vote: charlotte=2, alice=1, bob=0.
        bool[] memory v1 = new bool[](3);
        v1[2] = true; // charlotte
        electionReg.vote(elId, david, v1);

        bool[] memory v2 = new bool[](3);
        v2[0] = true; // alice
        v2[2] = true; // charlotte
        electionReg.vote(elId, eve, v2);

        // getRankingAnyTime must not revert while election is active.
        (address[] memory ranked, uint256[] memory voteCounts) = electionReg.getRankingAnyTime(elId);

        // charlotte (2) > alice (1) > bob (0).
        assertEq(ranked[0], charlotte);
        assertEq(voteCounts[0], 2);
        assertEq(ranked[1], alice);
        assertEq(voteCounts[1], 1);
        assertEq(ranked[2], bob);
        assertEq(voteCounts[2], 0);
    }

    function testGetRankingAnyTimeEmptyNominees() public {
        uint256 elId = _createElection();
        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollPastEnd(info.endBlock);

        (address[] memory ranked, uint256[] memory voteCounts) = electionReg.getRankingAnyTime(elId);
        assertEq(ranked.length, 0);
        assertEq(voteCounts.length, 0);
    }

    // ─── ACCESS CONTROL ──────────────────────────────────────────────────────

    function testNominateRevertsForNonOwner() public {
        uint256 elId = _createElection();

        vm.expectRevert("Only election owner can call this function");
        vm.prank(alice);
        electionReg.nominate(elId, alice);
    }

    function testRevokeNominationRevertsForNonOwner() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        vm.expectRevert("Only election owner can call this function");
        vm.prank(alice);
        electionReg.revokeNomination(elId, alice);
    }

    function testVoteRevertsForNonOwner() public {
        uint256 elId = _createElection();
        electionReg.nominate(elId, alice);

        ElectionRegistry.Election memory info = electionReg.getElectionInfo(elId);
        _rollToVoting(info.startBlock);

        bool[] memory votes = new bool[](1);
        votes[0] = true;

        vm.expectRevert("Only election owner can call this function");
        vm.prank(alice);
        electionReg.vote(elId, alice, votes);
    }

    function testOnlyOwnerModifierRevertsWhenElectionDoesNotExist() public {
        // Election id with no corresponding entry → owner is address(0) → msg.sender != address(0) → revert.
        uint256 nonExistentId = uint256(keccak256(abi.encodePacked(alice, "ghost election")));

        vm.expectRevert("Only election owner can call this function");
        electionReg.nominate(nonExistentId, alice);
    }
}
