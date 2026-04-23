// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import { TestSetupPowers } from "../TestSetup.t.sol";
import { PowersMock } from "../mocks/PowersMock.sol";
import { SimpleErc20Votes } from "../mocks/SimpleErc20Votes.sol";
import { Erc20Taxed } from "../mocks/Erc20Taxed.sol";
import { ElectionList } from "@src/helpers/ElectionList.sol";
import { SimpleErc1155 } from "../mocks/SimpleErc1155.sol";
import { Nominees } from "@src/helpers/Nominees.sol";
import { SimpleGovernor } from "../mocks/SimpleGovernor.sol";
import { EmptyTargetsMandate } from "../mocks/MandateMocks.sol";
import { MockTargetsMandate } from "../mocks/MandateMocks.sol";
import { PowersFactory } from "@src/helpers/PowersFactory.sol";
import { PowersDeployer } from "@src/helpers/PowersDeployer.sol";
import { Powers } from "@src/Powers.sol";
import { Soulbound1155 } from "@src/helpers/Soulbound1155.sol";
import { Ownable } from "@lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { AllowedTokens } from "@src/helpers/AllowedTokens.sol";
import { IZKPassport_PowersRegistry, ZKPassport_PowersRegistry } from "@src/helpers/ZKPassport_PowersRegistry.sol";
import { IZKPassportVerifier, IZKPassportHelper } from "@src/interfaces/IZKPassport.sol";
import { ZKProof } from "../mocks/ZKProof.sol";
import {
    DisclosedData,
    ProofVerificationParams,
    BoundData,
    ProofVerificationData,
    FaceMatchMode,
    OS,
    ServiceConfig
} from "@lib/circuits/src/solidity/src/Types.sol";
import { Governed721, IGoverned721 } from "@src/helpers/Governed721.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

//////////////////////////////////////////////////////////////
//                  ELECTION LIST TESTS                     //
//////////////////////////////////////////////////////////////
contract ElectionListTest is TestSetupPowers {
    uint256 electionId;
    string electionTitle = "Test Election";
    uint48 startBlock;
    uint48 endBlock;

    event ElectionCreated(uint256 indexed electionId, string title, uint48 startBlock, uint48 endBlock);
    event NominationReceived(uint256 indexed electionId, address indexed nominee);
    event VoteCast(address indexed voter, address indexed nominee, uint256 indexed electionId);

    function setUp() public override {
        super.setUp();
        vm.prank(address(daoMock));
        electionList = new ElectionList();

        startBlock = uint48(block.number + 10);
        endBlock = uint48(block.number + 100);
    }

    function testCreateElection() public {
        vm.prank(address(daoMock));
        // We can't easily predict the ID because it depends on hash, so we don't check the first indexed topic
        vm.expectEmit(false, false, false, true);
        emit ElectionCreated(0, electionTitle, startBlock, endBlock);

        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);

        ElectionList.Election memory election = electionList.getElectionInfo(id);
        assertEq(election.owner, address(daoMock));
        assertEq(election.title, electionTitle);
        assertEq(election.startBlock, startBlock);
        assertEq(election.endBlock, endBlock);
    }

    function testCreateElectionRevertsWithInvalidBlocks() public {
        vm.startPrank(address(daoMock));

        vm.expectRevert("invalid start or end block");
        electionList.createElection(electionTitle, 0, endBlock);

        vm.expectRevert("invalid start or end block");
        electionList.createElection(electionTitle, endBlock, startBlock); // end <= start

        vm.stopPrank();
    }

    function testCreateElectionRevertsWithDuplicate() public {
        vm.startPrank(address(daoMock));
        electionList.createElection(electionTitle, startBlock, endBlock);

        vm.expectRevert("election already exists");
        electionList.createElection(electionTitle, startBlock, endBlock);
        vm.stopPrank();
    }

    function testNominate() public {
        vm.prank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);

        vm.prank(address(daoMock));
        vm.expectEmit(true, true, false, false);
        emit NominationReceived(id, alice);
        electionList.nominate(id, alice);

        address[] memory nominees = electionList.getNominees(id);
        assertEq(nominees.length, 1);
        assertEq(nominees[0], alice);
        assertEq(electionList.getNomineeCount(id), 1);
    }

    function testNominateRevertsIfNotOwner() public {
        vm.prank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);

        vm.prank(alice);
        vm.expectRevert("Only election owner can call this function");
        electionList.nominate(id, alice);
    }

    function testNominateRevertsIfAlreadyNominated() public {
        vm.startPrank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);
        electionList.nominate(id, alice);

        vm.expectRevert("already nominated");
        electionList.nominate(id, alice);
        vm.stopPrank();
    }

    function testRevokeNomination() public {
        vm.startPrank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);
        electionList.nominate(id, alice);
        electionList.nominate(id, bob);

        assertEq(electionList.getNomineeCount(id), 2);

        electionList.revokeNomination(id, alice);
        vm.stopPrank();

        address[] memory nominees = electionList.getNominees(id);
        assertEq(nominees.length, 1);
        assertEq(nominees[0], bob);
    }

    function testRevokeNominationRevertsIfNotNominated() public {
        vm.startPrank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);

        vm.expectRevert("not nominated");
        electionList.revokeNomination(id, alice);
        vm.stopPrank();
    }

    function testVote() public {
        vm.startPrank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);
        electionList.nominate(id, alice);
        electionList.nominate(id, bob);
        vm.stopPrank();

        vm.roll(startBlock + 1);

        bool[] memory votes = new bool[](2);
        votes[0] = true; // Vote for alice
        votes[1] = false;

        vm.prank(address(daoMock));
        vm.expectEmit(true, true, true, false);
        emit VoteCast(charlotte, alice, id);
        electionList.vote(id, charlotte, votes);

        assertEq(electionList.getVoteCount(id, alice), 1);
        assertEq(electionList.getVoteCount(id, bob), 0);
        assertTrue(electionList.hasUserVoted(charlotte, id));
    }

    function testVoteRevertsIfClosed() public {
        vm.startPrank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);
        electionList.nominate(id, alice);
        vm.stopPrank();

        bool[] memory votes = new bool[](1);
        votes[0] = true;

        // Before start
        vm.roll(startBlock - 1);
        vm.prank(address(daoMock));
        vm.expectRevert("election closed");
        electionList.vote(id, charlotte, votes);

        // After end
        vm.roll(endBlock + 1);
        vm.prank(address(daoMock));
        vm.expectRevert("election closed");
        electionList.vote(id, charlotte, votes);
    }

    function testVoteRevertsIfAlreadyVoted() public {
        vm.startPrank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);
        electionList.nominate(id, alice);
        vm.stopPrank();

        vm.roll(startBlock + 1);

        bool[] memory votes = new bool[](1);
        votes[0] = true;

        vm.prank(address(daoMock));
        electionList.vote(id, charlotte, votes);

        vm.prank(address(daoMock));
        vm.expectRevert("already voted");
        electionList.vote(id, charlotte, votes);
    }

    function testVoteRevertsIfLengthMismatch() public {
        vm.startPrank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);
        electionList.nominate(id, alice);
        vm.stopPrank();

        vm.roll(startBlock + 1);

        bool[] memory votes = new bool[](2); // Mismatch

        vm.prank(address(daoMock));
        vm.expectRevert("votes array length mismatch");
        electionList.vote(id, charlotte, votes);
    }

    function testRanking() public {
        vm.startPrank(address(daoMock));
        uint256 id = electionList.createElection(electionTitle, startBlock, endBlock);
        electionList.nominate(id, alice);
        electionList.nominate(id, bob);
        electionList.nominate(id, charlotte);
        vm.stopPrank();

        vm.roll(startBlock + 1);

        // Vote 1: Alice & Bob
        bool[] memory votes1 = new bool[](3);
        votes1[0] = true;
        votes1[1] = true;
        votes1[2] = false;
        vm.prank(address(daoMock));
        electionList.vote(id, makeAddr("voter1"), votes1);

        // Vote 2: Alice
        bool[] memory votes2 = new bool[](3);
        votes2[0] = true;
        votes2[1] = false;
        votes2[2] = false;
        vm.prank(address(daoMock));
        electionList.vote(id, makeAddr("voter2"), votes2);

        // Scores: Alice 2, Bob 1, Charlotte 0.

        // Check ranking while active (should revert via getNomineeRanking but work via getRankingAnyTime)
        vm.expectRevert("election still active");
        electionList.getNomineeRanking(id);

        (address[] memory rankedNominees, uint256[] memory rankedVotes) = electionList.getRankingAnyTime(id);
        assertEq(rankedNominees[0], alice);
        assertEq(rankedVotes[0], 2);
        assertEq(rankedNominees[1], bob);
        assertEq(rankedVotes[1], 1);
        assertEq(rankedNominees[2], charlotte);
        assertEq(rankedVotes[2], 0);

        // End election
        vm.roll(endBlock + 1);

        (rankedNominees, rankedVotes) = electionList.getNomineeRanking(id);
        assertEq(rankedNominees[0], alice);
        assertEq(rankedNominees[1], bob);
        assertEq(rankedNominees[2], charlotte);
    }
}

//////////////////////////////////////////////////////////////
//               SIMPLE ERC20 VOTES TESTS                   //
//////////////////////////////////////////////////////////////
contract SimpleErc20VotesTest is TestSetupPowers {
    SimpleErc20Votes token;

    function setUp() public override {
        super.setUp();
        vm.prank(address(daoMock));
        token = new SimpleErc20Votes();
    }

    function testConstructor() public view {
        assertEq(token.name(), "Votes");
        assertEq(token.symbol(), "VTS");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
    }

    function testMintVotes() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        assertEq(token.balanceOf(alice), amount);
        assertEq(token.totalSupply(), amount);
    }

    function testMintVotesRevertsWithZeroAmount() public {
        vm.expectRevert(SimpleErc20Votes.Erc20Votes__NoZeroAmount.selector);
        vm.prank(alice);
        token.mint(0);
    }

    function testMintVotesRevertsWithExcessiveAmount() public {
        uint256 excessiveAmount = 101 * 10 ** 18; // Exceeds MAX_AMOUNT_VOTES_TO_MINT

        vm.expectRevert(
            abi.encodeWithSelector(
                SimpleErc20Votes.Erc20Votes__AmountExceedsMax.selector, excessiveAmount, 100 * 10 ** 18
            )
        );
        vm.prank(alice);
        token.mint(excessiveAmount);
    }

    function testMintVotesWithMaxAmount() public {
        uint256 maxAmount = 100 * 10 ** 18;

        vm.prank(alice);
        token.mint(maxAmount);

        assertEq(token.balanceOf(alice), maxAmount);
        assertEq(token.totalSupply(), maxAmount);
    }

    function testDelegate() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        vm.prank(alice);
        token.delegate(alice);

        assertEq(token.getVotes(alice), amount);
        assertEq(token.delegates(alice), alice);
    }

    function testDelegateToAnotherAddress() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        vm.prank(alice);
        token.delegate(bob);

        assertEq(token.getVotes(bob), amount);
        assertEq(token.getVotes(alice), 0);
        assertEq(token.delegates(alice), bob);
    }

    function testMultipleMints() public {
        uint256 amount1 = 1000;
        uint256 amount2 = 2000;

        vm.prank(alice);
        token.mint(amount1);

        vm.prank(alice);
        token.mint(amount2);

        assertEq(token.balanceOf(alice), amount1 + amount2);
        assertEq(token.totalSupply(), amount1 + amount2);
    }

    function testTransfer() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        vm.prank(alice);
        require(token.transfer(bob, 500), "Transfer failed");

        assertEq(token.balanceOf(alice), 500);
        assertEq(token.balanceOf(bob), 500);
    }

    function testTransferFrom() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        vm.prank(alice);
        token.approve(bob, 500);

        vm.prank(bob);
        require(token.transferFrom(alice, charlotte, 500), "TransferFrom failed");

        assertEq(token.balanceOf(alice), 500);
        assertEq(token.balanceOf(charlotte), 500);
    }
}

//////////////////////////////////////////////////////////////
//               SIMPLE GOVERNOR TESTS                     //
//////////////////////////////////////////////////////////////
contract SimpleGovernorTest is TestSetupPowers {
    SimpleGovernor governor;
    SimpleErc20Votes token;

    function setUp() public override {
        super.setUp();
        vm.startPrank(address(daoMock));
        token = new SimpleErc20Votes();
        governor = new SimpleGovernor(address(token));
        vm.stopPrank();
    }

    function testConstructor() public view {
        assertEq(governor.name(), "SimpleGovernor");
        assertEq(governor.votingDelay(), 25);
        assertEq(governor.votingPeriod(), 50);
        assertEq(governor.proposalThreshold(), 0);
        assertEq(governor.quorum(0), 0); // No votes cast yet
    }

    function testProposalThreshold() public view {
        assertEq(governor.proposalThreshold(), 0);
    }

    function testVotingDelay() public view {
        assertEq(governor.votingDelay(), 25);
    }

    function testVotingPeriod() public view {
        assertEq(governor.votingPeriod(), 50);
    }

    function testQuorumFraction() public view {
        // Quorum fraction is 4, so quorum should be 4% of total supply
        // But since no votes are cast, quorum should be 0
        assertEq(governor.quorum(0), 0);
    }

    function testVotingToken() public view {
        assertEq(address(governor.token()), address(token));
    }

    function testClock() public view {
        assertEq(governor.clock(), block.number);
    }

    function testCLOCK_MODE() public view {
        assertEq(governor.CLOCK_MODE(), "mode=blocknumber&from=default");
    }

    function testHasVoted() public view {
        assertFalse(governor.hasVoted(0, alice));
    }

    function testGetVotes() public {
        // Mint tokens and delegate
        vm.prank(alice);
        token.mint(1000);

        vm.prank(alice);
        token.delegate(alice);

        vm.roll(block.number + 100);

        assertEq(governor.getVotes(alice, block.number - 10), 1000);
    }

    function testGetVotesWithDelegation() public {
        // Mint tokens to alice and delegate to bob
        vm.prank(alice);
        token.mint(1000);

        vm.prank(alice);
        token.delegate(bob);

        vm.roll(block.number + 100);

        // Alice's votes should be 0, bob's votes should be 1000
        assertEq(governor.getVotes(alice, block.number - 10), 0);
        assertEq(governor.getVotes(bob, block.number - 10), 1000);
    }

    function testProposeBasic() public {
        // Mint tokens to alice and delegate
        vm.prank(alice);
        token.mint(1000);

        vm.prank(alice);
        token.delegate(alice);

        // Create a proposal
        targets = new address[](1);
        targets[0] = address(governor);

        values = new uint256[](1);
        values[0] = 0;

        calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("name()");

        description = "Test proposal";

        vm.prank(alice);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        assertNotEq(proposalId, 0);
    }

    function testProposeRevertsWithEmptyTargets() public {
        // Mint tokens to alice and delegate
        vm.prank(alice);
        token.mint(1000);

        vm.prank(alice);
        token.delegate(alice);

        targets = new address[](0);
        values = new uint256[](0);
        calldatas = new bytes[](0);
        description = "Test proposal";

        vm.expectRevert();
        vm.prank(alice);
        governor.propose(targets, values, calldatas, description);
    }

    function testProposeRevertsWithMismatchedArrays() public {
        // Mint tokens to alice and delegate
        vm.prank(alice);
        token.mint(1000);

        vm.prank(alice);
        token.delegate(alice);

        targets = new address[](1);
        targets[0] = address(governor);

        values = new uint256[](2); // Mismatched length
        values[0] = 0;
        values[1] = 0;

        calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("name()");

        description = "Test proposal";

        vm.expectRevert();
        vm.prank(alice);
        governor.propose(targets, values, calldatas, description);
    }
}

//////////////////////////////////////////////////////////////
//               ERC20 TAXED TESTS                         //
//////////////////////////////////////////////////////////////
contract Erc20TaxedTest is TestSetupPowers {
    Erc20Taxed token;

    function setUp() public override {
        super.setUp();
        token = new Erc20Taxed();
    }

    function testConstructor() public view {
        assertEq(token.name(), "Taxed");
        assertEq(token.symbol(), "TAX");
        assertEq(token.decimals(), 18);
        assertEq(token.taxRate(), 10);
        assertEq(token.DENOMINATOR(), 100);
        assertEq(token.EPOCH_DURATION(), 900);
        assertEq(token.AMOUNT_FAUCET(), 1 * 10 ** 18);
        assertFalse(token.faucetPaused());
    }

    function testMint() public {
        uint256 amount = 1000;
        uint256 balanceBefore = token.balanceOf(token.owner());
        uint256 totalSupplyBefore = token.totalSupply();

        vm.prank(token.owner());
        token.mint(amount);
        uint256 balanceAfter = token.balanceOf(token.owner());
        uint256 totalSupplyAfter = token.totalSupply();

        assertEq(balanceBefore + amount, balanceAfter);
        assertEq(totalSupplyBefore + amount, totalSupplyAfter);
    }

    function testMintRevertsWithZeroAmount() public {
        vm.prank(token.owner());
        vm.expectRevert(Erc20Taxed.Erc20Taxed__NoZeroAmount.selector);
        token.mint(0);
    }

    function testMintRevertsWhenNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.mint(1000);
    }

    function testBurn() public {
        uint256 amount = 500;
        vm.prank(token.owner());
        token.faucet();

        uint256 balanceBefore = token.balanceOf(token.owner());
        uint256 totalSupplyBefore = token.totalSupply();

        vm.prank(token.owner());
        token.burn(amount);
        uint256 balanceAfter = token.balanceOf(token.owner());
        uint256 totalSupplyAfter = token.totalSupply();

        assertEq(balanceBefore - amount, balanceAfter);
        assertEq(totalSupplyBefore - amount, totalSupplyAfter);
    }

    function testBurnRevertsWithZeroAmount() public {
        vm.prank(token.owner());
        vm.expectRevert(Erc20Taxed.Erc20Taxed__NoZeroAmount.selector);
        token.burn(0);
    }

    function testBurnRevertsWhenNotOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        token.burn(1000);
    }

    function testFaucet() public {
        uint256 initialBalance = token.balanceOf(alice);

        vm.prank(alice);
        token.faucet();

        assertEq(token.balanceOf(alice), initialBalance + token.AMOUNT_FAUCET());
        assertEq(token.totalSupply(), 1 * 10 ** 18 + token.AMOUNT_FAUCET());
    }

    function testFaucetRevertsWhenPaused() public {
        vm.prank(token.owner());
        token.pauseFaucet();

        vm.expectRevert(Erc20Taxed.Erc20Taxed__FaucetPaused.selector);
        vm.prank(alice);
        token.faucet();
    }

    function testPauseFaucet() public {
        assertFalse(token.faucetPaused());

        vm.prank(token.owner());
        token.pauseFaucet();
        assertTrue(token.faucetPaused());

        vm.prank(token.owner());
        token.pauseFaucet();
        assertFalse(token.faucetPaused());
    }

    function testPauseFaucetRevertsWhenNotOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        token.pauseFaucet();
    }

    function testChangeTaxRate() public {
        uint256 newTaxRate = 15;

        vm.prank(token.owner());
        token.changeTaxRate(newTaxRate);

        assertEq(token.taxRate(), newTaxRate);
    }

    function testChangeTaxRateRevertsWithOverflow() public {
        uint256 excessiveTaxRate = 99; // >= DENOMINATOR - 1

        vm.prank(token.owner());
        vm.expectRevert(Erc20Taxed.Erc20Taxed__TaxRateOverflow.selector);
        token.changeTaxRate(excessiveTaxRate);
    }

    function testChangeTaxRateRevertsWhenNotOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        token.changeTaxRate(20);
    }

    function testTransferWithTax() public {
        // Give alice some tokens
        vm.prank(alice);
        token.faucet();

        uint256 transferAmount = 100;
        uint256 expectedTax = (transferAmount * token.taxRate()) / token.DENOMINATOR();
        uint256 aliceBalanceBefore = token.balanceOf(alice);
        uint256 ownerBalanceBefore = token.balanceOf(token.owner());

        vm.prank(alice);
        require(token.transfer(bob, transferAmount), "Transfer failed");

        assertEq(token.balanceOf(alice), aliceBalanceBefore - transferAmount - expectedTax);
        assertEq(token.balanceOf(bob), transferAmount);
        assertEq(token.balanceOf(token.owner()), ownerBalanceBefore + expectedTax);
    }

    function testTransferRevertsWithInsufficientBalanceForTax() public {
        // Give alice just enough tokens for transfer but not for tax
        vm.prank(alice);
        token.faucet();

        uint256 transferAmount = token.balanceOf(alice);

        vm.expectRevert(Erc20Taxed.Erc20Taxed__InsufficientBalanceForTax.selector);
        vm.prank(alice);
        token.transfer(bob, transferAmount);
    }

    function testTransferFromOwnerNoTax() public {
        uint256 transferAmount = 100;
        vm.prank(token.owner());
        token.faucet();

        uint256 ownerBalanceBefore = token.balanceOf(token.owner());

        vm.prank(token.owner());
        require(token.transfer(alice, transferAmount), "Transfer failed");

        assertEq(token.balanceOf(token.owner()), ownerBalanceBefore - transferAmount);
        assertEq(token.balanceOf(alice), transferAmount);
    }

    function testTransferToOwnerNoTax() public {
        // Give alice some tokens
        vm.prank(alice);
        token.faucet();

        uint256 transferAmount = 100;
        uint256 aliceBalanceBefore = token.balanceOf(alice);
        uint256 ownerBalanceBefore = token.balanceOf(token.owner());

        vm.startPrank(alice);
        require(token.transfer(token.owner(), transferAmount), "Transfer failed");
        vm.stopPrank();

        assertEq(token.balanceOf(alice), aliceBalanceBefore - transferAmount);
        assertEq(token.balanceOf(token.owner()), ownerBalanceBefore + transferAmount);
    }

    function testGetTaxLogs() public {
        // Give alice some tokens and make a transfer
        vm.prank(alice);
        token.faucet();

        uint256 transferAmount = 100;
        uint256 expectedTax = (transferAmount * token.taxRate()) / token.DENOMINATOR();

        vm.prank(alice);
        require(token.transfer(bob, transferAmount), "Transfer failed");

        taxPaid = token.getTaxLogs(uint48(block.number), alice);
        assertEq(taxPaid, expectedTax);
    }

    function testMultipleTransfersAccumulateTax() public {
        // Give alice some tokens
        vm.prank(alice);
        token.faucet();

        uint256 transferAmount = 50;
        uint256 expectedTaxPerTransfer = (transferAmount * token.taxRate()) / token.DENOMINATOR();

        // Make two transfers
        vm.prank(alice);
        require(token.transfer(bob, transferAmount), "Transfer failed");

        vm.prank(alice);
        require(token.transfer(charlotte, transferAmount), "Transfer failed");

        uint256 totalTaxPaid = token.getTaxLogs(uint48(block.number), alice);
        assertEq(totalTaxPaid, expectedTaxPerTransfer * 2);
    }
}

//////////////////////////////////////////////////////////////
//               SIMPLE ERC1155 TESTS                       //
//////////////////////////////////////////////////////////////
contract SimpleErc1155Test is TestSetupPowers {
    SimpleErc1155 token;
    uint256 COIN_ID = 0;

    function setUp() public override {
        super.setUp();
        token = new SimpleErc1155();
    }

    function testMintCoins1() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount, alice);

        assertEq(token.balanceOf(alice, COIN_ID), amount);
    }

    function testMintCoinsRevertsWithZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SimpleErc1155.SimpleErc1155__NoZeroAmount.selector);
        token.mint(0, alice);
    }

    function testMintCoinsRevertsWithExcessiveAmount() public {
        uint256 excessiveAmount = 101 * 10 ** 18; // Exceeds MAX_AMOUNT_COINS_TO_MINT

        vm.expectRevert(
            abi.encodeWithSelector(
                SimpleErc1155.SimpleErc1155__AmountExceedsMax.selector, excessiveAmount, 100 * 10 ** 18
            )
        );
        vm.prank(alice);
        token.mint(excessiveAmount);
    }

    function testMintCoinsWithMaxAmount() public {
        uint256 maxAmount = 100 * 10 ** 18;

        vm.prank(alice);
        token.mint(maxAmount, alice);

        assertEq(token.balanceOf(alice, COIN_ID), maxAmount);
    }

    function testMultipleMints() public {
        uint256 amount1 = 1000;
        uint256 amount2 = 2000;

        vm.prank(alice);
        token.mint(amount1, alice);

        vm.prank(alice);
        token.mint(amount2, alice);

        assertEq(token.balanceOf(alice, COIN_ID), amount1 + amount2);
    }

    function testTransfer() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount, alice);
        vm.prank(alice);
        token.safeTransferFrom(alice, bob, COIN_ID, 500, "");

        assertEq(token.balanceOf(alice, COIN_ID), 500);
        assertEq(token.balanceOf(bob, COIN_ID), 500);
    }

    function testBatchTransfer() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        uint256[] memory ids = new uint256[](1);
        ids[0] = COIN_ID;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 500;

        vm.prank(alice);
        token.safeBatchTransferFrom(alice, bob, ids, amounts, "");

        assertEq(token.balanceOf(alice, COIN_ID), 500);
        assertEq(token.balanceOf(bob, COIN_ID), 500);
    }

    function testApprove() public {
        vm.prank(alice);
        token.setApprovalForAll(bob, true);

        assertTrue(token.isApprovedForAll(alice, bob));
    }

    function testApproveReverts() public {
        vm.prank(alice);
        token.setApprovalForAll(bob, true);

        vm.prank(alice);
        token.setApprovalForAll(bob, false);

        assertFalse(token.isApprovedForAll(alice, bob));
    }

    function testTransferFrom() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        vm.prank(alice);
        token.setApprovalForAll(bob, true);

        vm.prank(bob);
        token.safeTransferFrom(alice, charlotte, COIN_ID, 500, "");

        assertEq(token.balanceOf(alice, COIN_ID), 500);
        assertEq(token.balanceOf(charlotte, COIN_ID), 500);
    }

    function testTransferFromRevertsWithoutApproval() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        vm.expectRevert();
        vm.prank(bob);
        token.safeTransferFrom(alice, charlotte, COIN_ID, 500, "");
    }

    function testSupportsInterface() public view {
        // Should support ERC1155 interface
        assertTrue(token.supportsInterface(0xd9b67a26)); // ERC1155
        assertTrue(token.supportsInterface(0x01ffc9a7)); // ERC165
    }

    function testURI() public view {
        string memory expectedURI =
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreighx6axdemwbjara3xhhfn5yaiktidgljykzx3vsrqtymicxxtgvi";
        assertEq(token.uri(COIN_ID), expectedURI);
    }

    function testMultipleUsersMinting() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        vm.prank(bob);
        token.mint(amount);

        vm.prank(charlotte);
        token.mint(amount);

        assertEq(token.balanceOf(alice, COIN_ID), amount);
        assertEq(token.balanceOf(bob, COIN_ID), amount);
        assertEq(token.balanceOf(charlotte, COIN_ID), amount);
    }
}

//////////////////////////////////////////////////////////////
//               NOMINEES TESTS                            //
//////////////////////////////////////////////////////////////
contract NomineesTest is TestSetupPowers {
    Nominees nomineesContract;

    function setUp() public override {
        super.setUp();
        vm.prank(address(daoMock));
        nomineesContract = new Nominees();
    }

    function testConstructor() public view {
        assertEq(nomineesContract.owner(), address(daoMock));
        assertEq(nomineesContract.nomineesCount(), 0);
    }

    function testNominate() public {
        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);

        assertTrue(nomineesContract.nominations(alice));
        assertTrue(nomineesContract.isNominee(alice));
        assertEq(nomineesContract.nomineesCount(), 1);
    }

    function testNominateRevertsWhenAlreadyNominated() public {
        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);

        vm.expectRevert("already nominated");
        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);
    }

    function testRevokeNomination() public {
        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);

        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, false);

        assertFalse(nomineesContract.nominations(alice));
        assertFalse(nomineesContract.isNominee(alice));
        assertEq(nomineesContract.nomineesCount(), 0);
    }

    function testRevokeNominationRevertsWhenNotNominated() public {
        vm.expectRevert("not nominated");
        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, false);
    }

    function testNominateRevertsWhenNotCalledByOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        nomineesContract.nominate(alice, true);
    }

    function testGetNominees() public {
        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);

        vm.prank(address(daoMock));
        nomineesContract.nominate(bob, true);

        address[] memory nomineesList = nomineesContract.getNominees();
        assertEq(nomineesList.length, 2);
        assertEq(nomineesList[0], alice);
        assertEq(nomineesList[1], bob);
    }

    function testMultipleNominations() public {
        vm.startPrank(address(daoMock));
        nomineesContract.nominate(alice, true);
        nomineesContract.nominate(bob, true);
        nomineesContract.nominate(charlotte, true);
        vm.stopPrank();

        assertEq(nomineesContract.nomineesCount(), 3);
        assertTrue(nomineesContract.isNominee(alice));
        assertTrue(nomineesContract.isNominee(bob));
        assertTrue(nomineesContract.isNominee(charlotte));
    }

    function testRevokeMiddleNominee() public {
        vm.startPrank(address(daoMock));
        nomineesContract.nominate(alice, true);
        nomineesContract.nominate(bob, true);
        nomineesContract.nominate(charlotte, true);
        vm.stopPrank();

        assertEq(nomineesContract.nomineesCount(), 3);

        // Revoke bob (middle nominee)
        vm.prank(address(daoMock));
        nomineesContract.nominate(bob, false);

        assertEq(nomineesContract.nomineesCount(), 2);
        assertTrue(nomineesContract.isNominee(alice));
        assertFalse(nomineesContract.isNominee(bob));
        assertTrue(nomineesContract.isNominee(charlotte));

        // Check that bob was removed from the array
        address[] memory nomineesList = nomineesContract.getNominees();
        assertEq(nomineesList.length, 2);
        // The order might change due to swap-and-pop, so check that bob is not in the list
        bool aliceFound = false;
        bool charlotteFound = false;
        bool bobFound = false;
        for (i = 0; i < nomineesList.length; i++) {
            if (nomineesList[i] == alice) aliceFound = true;
            if (nomineesList[i] == charlotte) charlotteFound = true;
            if (nomineesList[i] == bob) bobFound = true;
        }
        assertTrue(aliceFound);
        assertTrue(charlotteFound);
        assertFalse(bobFound);
    }

    function testRevokeLastNominee() public {
        vm.startPrank(address(daoMock));
        nomineesContract.nominate(alice, true);
        nomineesContract.nominate(bob, true);
        vm.stopPrank();

        assertEq(nomineesContract.nomineesCount(), 2);

        // Revoke bob (last nominee)
        vm.prank(address(daoMock));
        nomineesContract.nominate(bob, false);

        assertEq(nomineesContract.nomineesCount(), 1);
        assertTrue(nomineesContract.isNominee(alice));
        assertFalse(nomineesContract.isNominee(bob));

        address[] memory nomineesList = nomineesContract.getNominees();
        assertEq(nomineesList.length, 1);
        assertEq(nomineesList[0], alice);
    }

    function testRevokeFirstNominee() public {
        vm.startPrank(address(daoMock));
        nomineesContract.nominate(alice, true);
        nomineesContract.nominate(bob, true);
        nomineesContract.nominate(charlotte, true);
        vm.stopPrank();

        assertEq(nomineesContract.nomineesCount(), 3);

        // Revoke alice (first nominee)
        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, false);

        assertEq(nomineesContract.nomineesCount(), 2);
        assertFalse(nomineesContract.isNominee(alice));
        assertTrue(nomineesContract.isNominee(bob));
        assertTrue(nomineesContract.isNominee(charlotte));

        address[] memory nomineesList = nomineesContract.getNominees();
        assertEq(nomineesList.length, 2);
        // Check that alice is not in the list
        bool aliceFound = false;
        for (i = 0; i < nomineesList.length; i++) {
            if (nomineesList[i] == alice) aliceFound = true;
        }
        assertFalse(aliceFound);
    }

    function testNominateAndRevokeMultipleTimes() public {
        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);
        assertEq(nomineesContract.nomineesCount(), 1);

        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, false);
        assertEq(nomineesContract.nomineesCount(), 0);

        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);
        assertEq(nomineesContract.nomineesCount(), 1);

        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, false);
        assertEq(nomineesContract.nomineesCount(), 0);
    }

    function testIsNominee() public {
        assertFalse(nomineesContract.isNominee(alice));

        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);
        assertTrue(nomineesContract.isNominee(alice));

        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, false);
        assertFalse(nomineesContract.isNominee(alice));
    }

    function testNominationsMapping() public {
        assertFalse(nomineesContract.nominations(alice));

        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, true);
        assertTrue(nomineesContract.nominations(alice));

        vm.prank(address(daoMock));
        nomineesContract.nominate(alice, false);
        assertFalse(nomineesContract.nominations(alice));
    }
}

//////////////////////////////////////////////////////////////
//               POWERS FACTORY TESTS                       //
//////////////////////////////////////////////////////////////
contract PowersFactoryTest is TestSetupPowers {
    PowersFactory factory;
    uint256 constant MAX_CALL_DATA = 1000;
    uint256 constant MAX_RETURN_DATA = 1000;
    uint256 constant MAX_EXECUTIONS = 10;

    function setUp() public override {
        super.setUp();

        (PowersTypes.MandateInitData[] memory mandateInitDataArray) =
            testConstitutions.powersTestConstitution(address(daoMock));

        PowersDeployer deployer = new PowersDeployer();
        vm.startPrank(address(daoMock));
        factory = new PowersFactory(
            "Factory DAO", // name
            "https://factory.dao", // uri
            MAX_CALL_DATA,
            MAX_RETURN_DATA,
            MAX_EXECUTIONS,
            address(deployer)
        );
        factory.addMandates(mandateInitDataArray);
        vm.stopPrank();
    }

    function testConstructor() public view {
        assertEq(factory.maxCallDataLength(), MAX_CALL_DATA);
        assertEq(factory.maxReturnDataLength(), MAX_RETURN_DATA);
        assertEq(factory.maxExecutionsLength(), MAX_EXECUTIONS);
        assertEq(factory.getLatestDeployment(), address(0));
    }

    function testDeployPowers() public {
        nameDescription = "Factory DAO";
        uri = "https://factory.dao";

        vm.prank(address(daoMock));
        address deployedAddress = factory.createPowers();

        assertEq(factory.getLatestDeployment(), deployedAddress);
        assertTrue(deployedAddress != address(0));

        Powers deployedPowers = Powers(payable(deployedAddress));
        assertEq(deployedPowers.name(), nameDescription);
        assertEq(deployedPowers.uri(), uri);

        // Check immutable variables were passed correctly
        assertEq(deployedPowers.MAX_CALLDATA_LENGTH(), MAX_CALL_DATA);
        assertEq(deployedPowers.MAX_RETURN_DATA_LENGTH(), MAX_RETURN_DATA);
        assertEq(deployedPowers.MAX_EXECUTIONS_LENGTH(), MAX_EXECUTIONS);

        // Check if the create DAO is set as the admin
        // assertTrue(deployedPowers.hasRoleSince(address(daoMock), deployedPowers.ADMIN_ROLE()) > 0); -- is going to change.

        // Check Factory is NOT Admin
        assertEq(deployedPowers.hasRoleSince(address(factory), deployedPowers.ADMIN_ROLE()), 0);

        // Check Constitution
        // mandateCounter starts at 1. If constituted, it should have incremented.
        // We verify that mandates were actually added
        assertTrue(deployedPowers.mandateCounter() > 1);

        // Verify at least one mandate is active (checking mandateId 1)
        (address mandateAddress,, bool active) = deployedPowers.getAdoptedMandate(1);
        assertTrue(active);
        assertTrue(mandateAddress != address(0));
    }

    function testDeployPowersWithDifferentArgs() public {
        nameDescription = "Another DAO";
        uri = "ipfs://QmHash";

        daoMockChild1 = new PowersMock();
        (PowersTypes.MandateInitData[] memory mandateInitDataArray) =
            testConstitutions.powersTestConstitution(address(daoMock));

        PowersDeployer deployer = new PowersDeployer();
        vm.startPrank(address(daoMockChild1));
        factory = new PowersFactory(
            "Another DAO", // name
            "ipfs://QmHash", // uri
            MAX_CALL_DATA,
            MAX_RETURN_DATA,
            MAX_EXECUTIONS,
            address(deployer)
        );
        factory.addMandates(mandateInitDataArray);
        address deployedAddress = factory.createPowers();
        vm.stopPrank();

        Powers deployedPowers = Powers(payable(deployedAddress));
        assertEq(deployedPowers.name(), nameDescription);

        // Another Powers should be admin. Not factory or daoMock.
        // -- removed for now, will change in future updates
        // assertEq(deployedPowers.hasRoleSince(deployedAddress, deployedPowers.ADMIN_ROLE()), 0);
        // assertEq(deployedPowers.hasRoleSince(address(factory), deployedPowers.ADMIN_ROLE()), 0);
        // assertNotEq(deployedPowers.hasRoleSince(address(daoMockChild1), deployedPowers.ADMIN_ROLE()), 0);
    }

    function testLastMandateDeployment() public {
        vm.prank(address(daoMock));
        address deployedAddress = factory.createPowers();

        (PowersTypes.MandateInitData[] memory mandateInitDataArray) =
            testConstitutions.powersTestConstitution(address(daoMock));

        Powers deployedPowers = Powers(payable(deployedAddress));

        // Get the total number of mandates deployed
        // mandateCounter returns the next ID to assign, so the last mandate ID is mandateCounter - 1
        uint16 mandateCount = deployedPowers.mandateCounter();
        uint16 expectedMandateCount = uint16(mandateInitDataArray.length) + 1; // +1 because mandateCounter starts at 1
        assertTrue(mandateCount > 1, "No mandates were deployed");
        assertTrue(mandateCount == expectedMandateCount, "Mandate count does not match initialization data length");

        uint16 lastMandateId = mandateCount - 1;

        // Verify the last mandate is active and has a valid address
        (address mandateAddress,, bool active) = deployedPowers.getAdoptedMandate(lastMandateId);
        assertTrue(active, "Last mandate is not active");
        assertTrue(mandateAddress != address(0), "Last mandate has zero address");
    }
}

//////////////////////////////////////////////////////////////
//             SOULBOUND ERC1155 TESTS                      //
//////////////////////////////////////////////////////////////
contract Soulbound1155Test is TestSetupPowers {
    Soulbound1155 sbToken;

    function setUp() public override {
        super.setUp();
        vm.prank(address(daoMock));
        sbToken = new Soulbound1155("This is a test uri");
    }

    function testConstructor() public view {
        assertEq(sbToken.owner(), address(daoMock));
        assertEq(sbToken.uri(0), "This is a test uri");
    }

    function testMint() public {
        vm.prank(address(daoMock));
        sbToken.mint(alice, 123_456);

        uint48 blockNum = uint48(block.number);
        uint256 expectedTokenId = 123_456;

        assertEq(sbToken.balanceOf(alice, expectedTokenId), 1);
    }

    function testMintRevertsWhenNotOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        sbToken.mint(alice, 123_456);
    }

    function testTransferReverts() public {
        vm.prank(address(daoMock));
        sbToken.mint(alice, 123_456);

        uint48 blockNum = uint48(block.number);
        uint256 tokenId = 123_456;

        vm.expectRevert("Soulbound1155: Transfers are disabled");
        vm.prank(alice);
        sbToken.safeTransferFrom(alice, bob, tokenId, 1, "");
    }
}

//////////////////////////////////////////////////////////////
//               LAW MOCKS TESTS                           //
//////////////////////////////////////////////////////////////
contract EmptyTargetsMandateTest is TestSetupPowers {
    EmptyTargetsMandate emptyTargetsMandate;

    function setUp() public override {
        super.setUp();
        emptyTargetsMandate = new EmptyTargetsMandate();
    }

    function testConstructor() public view {
        // EmptyTargetsMandate inherits from Mandate, so we can test basic functionality
        assertTrue(address(emptyTargetsMandate) != address(0));
    }

    function testHandleRequestReturnsEmptyArrays() public {
        requester = alice;
        executor = bob;
        roleId = 1;
        bytes memory data = abi.encode("test data");
        uint256 timestamp = block.timestamp;

        (actionId, targets, values, calldatas) =
            emptyTargetsMandate.handleRequest(requester, executor, roleId, data, timestamp);

        // Check that actionId is returned correctly
        assertEq(actionId, 1);

        // Check that all arrays are empty
        assertEq(targets.length, 0);
        assertEq(values.length, 0);
        assertEq(calldatas.length, 0);
    }

    function testHandleRequestWithDifferentParameters() public {
        // Test with different parameters to ensure the function works consistently
        requester = bob;
        executor = charlotte;
        roleId = 5;
        bytes memory data = abi.encode("different data");
        uint256 timestamp = block.timestamp + 100;

        (actionId, targets, values, calldatas) =
            emptyTargetsMandate.handleRequest(requester, executor, roleId, data, timestamp);

        // Should still return the same empty result regardless of input
        assertEq(actionId, 1);
        assertEq(targets.length, 0);
        assertEq(values.length, 0);
        assertEq(calldatas.length, 0);
    }

    function testHandleRequestWithZeroAddresses() public {
        requester = address(0);
        executor = address(0);
        roleId = 0;
        bytes memory data = "";
        uint256 timestamp = 0;

        (actionId, targets, values, calldatas) =
            emptyTargetsMandate.handleRequest(requester, executor, roleId, data, timestamp);

        // Should still return empty arrays
        assertEq(actionId, 1);
        assertEq(targets.length, 0);
        assertEq(values.length, 0);
        assertEq(calldatas.length, 0);
    }

    function testHandleRequestWithLargeData() public {
        // Test with large data to ensure it doesn't affect the result
        bytes memory largeData = new bytes(1000);
        for (i = 0; i < largeData.length; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            largeData[i] = bytes1(uint8(i % 256));
        }

        (actionId, targets, values, calldatas) =
            emptyTargetsMandate.handleRequest(alice, bob, 1, largeData, block.timestamp);

        // Should still return empty arrays
        assertEq(actionId, 1);
        assertEq(targets.length, 0);
        assertEq(values.length, 0);
        assertEq(calldatas.length, 0);
    }
}

contract MockTargetsMandateTest is TestSetupPowers {
    MockTargetsMandate mockTargetsMandate;

    function setUp() public override {
        super.setUp();
        mockTargetsMandate = new MockTargetsMandate();
    }

    function testConstructor() public view {
        // MockTargetsMandate inherits from Mandate, so we can test basic functionality
        assertTrue(address(mockTargetsMandate) != address(0));
    }

    function testHandleRequestReturnsSpecificData() public {
        requester = alice;
        executor = bob;
        roleId = 1;
        bytes memory data = abi.encode("test data");
        uint256 timestamp = block.timestamp;

        (actionId, targets, values, calldatas) =
            mockTargetsMandate.handleRequest(requester, executor, roleId, data, timestamp);

        // Check actionId
        assertEq(actionId, 1);

        // Check targets array
        assertEq(targets.length, 2);
        assertEq(targets[0], address(0x1));
        assertEq(targets[1], address(0x2));

        // Check values array
        assertEq(values.length, 2);
        assertEq(values[0], 1 ether);
        assertEq(values[1], 2 ether);

        // Check calldatas array
        assertEq(calldatas.length, 2);
        assertEq(calldatas[0], abi.encodeWithSignature("test1()"));
        assertEq(calldatas[1], abi.encodeWithSignature("test2()"));
    }

    function testHandleRequestWithDifferentParameters() public {
        // Test with different parameters to ensure the function returns consistent data
        requester = charlotte;
        executor = alice;
        roleId = 10;
        bytes memory data = abi.encode("different data");
        uint256 timestamp = block.timestamp + 500;

        (actionId, targets, values, calldatas) =
            mockTargetsMandate.handleRequest(requester, executor, roleId, data, timestamp);

        // Should return the same mock data regardless of input
        assertEq(actionId, 1);
        assertEq(targets.length, 2);
        assertEq(targets[0], address(0x1));
        assertEq(targets[1], address(0x2));
        assertEq(values.length, 2);
        assertEq(values[0], 1 ether);
        assertEq(values[1], 2 ether);
        assertEq(calldatas.length, 2);
        assertEq(calldatas[0], abi.encodeWithSignature("test1()"));
        assertEq(calldatas[1], abi.encodeWithSignature("test2()"));
    }

    function testHandleRequestWithZeroAddresses() public {
        requester = address(0);
        executor = address(0);
        roleId = 0;
        bytes memory data = "";
        uint256 timestamp = 0;

        (actionId, targets, values, calldatas) =
            mockTargetsMandate.handleRequest(requester, executor, roleId, data, timestamp);

        // Should still return the same mock data
        assertEq(actionId, 1);
        assertEq(targets.length, 2);
        assertEq(targets[0], address(0x1));
        assertEq(targets[1], address(0x2));
        assertEq(values.length, 2);
        assertEq(values[0], 1 ether);
        assertEq(values[1], 2 ether);
        assertEq(calldatas.length, 2);
        assertEq(calldatas[0], abi.encodeWithSignature("test1()"));
        assertEq(calldatas[1], abi.encodeWithSignature("test2()"));
    }

    function testHandleRequestWithLargeData() public {
        // Test with large data to ensure it doesn't affect the result
        bytes memory largeData = new bytes(2000);
        for (i = 0; i < largeData.length; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            largeData[i] = bytes1(uint8(i % 256));
        }

        (actionId, targets, values, calldatas) =
            mockTargetsMandate.handleRequest(alice, bob, 1, largeData, block.timestamp);

        // Should still return the same mock data
        assertEq(actionId, 1);
        assertEq(targets.length, 2);
        assertEq(targets[0], address(0x1));
        assertEq(targets[1], address(0x2));
        assertEq(values.length, 2);
        assertEq(values[0], 1 ether);
        assertEq(values[1], 2 ether);
        assertEq(calldatas.length, 2);
        assertEq(calldatas[0], abi.encodeWithSignature("test1()"));
        assertEq(calldatas[1], abi.encodeWithSignature("test2()"));
    }

    function testHandleRequestMultipleCalls() public {
        // Test multiple calls to ensure consistency
        for (i = 0; i < 5; i++) {
            (actionId, targets, values, calldatas) = mockTargetsMandate.handleRequest(
                makeAddr(string(abi.encodePacked("requester", i))),
                makeAddr(string(abi.encodePacked("executor", i))),
                uint16(i),
                abi.encode(i),
                block.timestamp + i
            );

            // Each call should return the same mock data
            assertEq(actionId, 1);
            assertEq(targets.length, 2);
            assertEq(targets[0], address(0x1));
            assertEq(targets[1], address(0x2));
            assertEq(values.length, 2);
            assertEq(values[0], 1 ether);
            assertEq(values[1], 2 ether);
            assertEq(calldatas.length, 2);
            assertEq(calldatas[0], abi.encodeWithSignature("test1()"));
            assertEq(calldatas[1], abi.encodeWithSignature("test2()"));
        }
    }

    function testCalldataContent() public {
        (actionId, targets, values, calldatas) = mockTargetsMandate.handleRequest(alice, bob, 1, "", block.timestamp);

        // Verify the calldata contains the expected function signatures
        bytes memory expectedCalldata1 = abi.encodeWithSignature("test1()");
        bytes memory expectedCalldata2 = abi.encodeWithSignature("test2()");

        assertEq(calldatas[0], expectedCalldata1);
        assertEq(calldatas[1], expectedCalldata2);
    }

    function testValuesAreCorrectEtherAmounts() public {
        (actionId, targets, values, calldatas) = mockTargetsMandate.handleRequest(alice, bob, 1, "", block.timestamp);

        // Verify the values are exactly 1 ether and 2 ether
        assertEq(values[0], 1 ether);
        assertEq(values[1], 2 ether);

        // Verify they are not zero
        assertTrue(values[0] > 0);
        assertTrue(values[1] > 0);

        // Verify the second value is exactly double the first
        assertEq(values[1], values[0] * 2);
    }

    function testTargetsAreSpecificAddresses() public {
        (actionId, targets, values, calldatas) = mockTargetsMandate.handleRequest(alice, bob, 1, "", block.timestamp);

        // Verify the targets are the expected addresses
        assertEq(targets[0], address(0x1));
        assertEq(targets[1], address(0x2));

        // Verify they are not zero addresses
        assertTrue(targets[0] != address(0));
        assertTrue(targets[1] != address(0));

        // Verify they are different addresses
        assertTrue(targets[0] != targets[1]);
    }
}

//////////////////////////////////////////////////////////////
//               ALLOWED TOKENS TESTS                       //
//////////////////////////////////////////////////////////////
contract AllowedTokensTest is TestSetupPowers {
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    function setUp() public override {
        super.setUp();
        vm.prank(address(daoMock));
        allowedTokens = new AllowedTokens();
    }

    function testConstructor() public view {
        assertEq(allowedTokens.owner(), address(daoMock));
        assertEq(allowedTokens.getAllowedTokensCount(), 0);
    }

    function testAddToken() public {
        vm.expectEmit(true, false, false, false);
        emit TokenAdded(alice);

        vm.prank(address(daoMock));
        allowedTokens.addToken(alice);

        assertTrue(allowedTokens.isTokenAllowed(alice));
        assertEq(allowedTokens.getAllowedTokensCount(), 1);
        assertEq(allowedTokens.getAllowedToken(0), alice);
    }

    function testAddTokenRevertsWhenAlreadyAllowed() public {
        vm.prank(address(daoMock));
        allowedTokens.addToken(alice);

        vm.expectRevert("Token already allowed");
        vm.prank(address(daoMock));
        allowedTokens.addToken(alice);
    }

    function testAddTokenRevertsWhenNotOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        allowedTokens.addToken(alice);
    }

    function testRemoveToken() public {
        vm.prank(address(daoMock));
        allowedTokens.addToken(alice);

        vm.expectEmit(true, false, false, false);
        emit TokenRemoved(alice);

        vm.prank(address(daoMock));
        allowedTokens.removeToken(alice);

        assertFalse(allowedTokens.isTokenAllowed(alice));
        assertEq(allowedTokens.getAllowedTokensCount(), 0);
    }

    function testRemoveTokenRevertsWhenNotAllowed() public {
        vm.expectRevert("Token not allowed");
        vm.prank(address(daoMock));
        allowedTokens.removeToken(alice);
    }

    function testRemoveTokenRevertsWhenNotOwner() public {
        vm.prank(address(daoMock));
        allowedTokens.addToken(alice);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        allowedTokens.removeToken(alice);
    }

    function testMultipleTokens() public {
        vm.startPrank(address(daoMock));
        allowedTokens.addToken(alice);
        allowedTokens.addToken(bob);
        allowedTokens.addToken(charlotte);
        vm.stopPrank();

        assertEq(allowedTokens.getAllowedTokensCount(), 3);
        assertTrue(allowedTokens.isTokenAllowed(alice));
        assertTrue(allowedTokens.isTokenAllowed(bob));
        assertTrue(allowedTokens.isTokenAllowed(charlotte));

        // Check array indexing
        assertEq(allowedTokens.getAllowedToken(0), alice);
        assertEq(allowedTokens.getAllowedToken(1), bob);
        assertEq(allowedTokens.getAllowedToken(2), charlotte);
    }

    function testRemoveTokenLogic() public {
        // Setup 3 tokens: [alice, bob, charlotte]
        vm.startPrank(address(daoMock));
        allowedTokens.addToken(alice);
        allowedTokens.addToken(bob);
        allowedTokens.addToken(charlotte);

        // Remove middle token (bob)
        // Swap and pop: charlotte moves to bob's spot.
        // New array: [alice, charlotte]
        allowedTokens.removeToken(bob);
        vm.stopPrank();

        assertEq(allowedTokens.getAllowedTokensCount(), 2);
        assertFalse(allowedTokens.isTokenAllowed(bob));
        assertTrue(allowedTokens.isTokenAllowed(alice));
        assertTrue(allowedTokens.isTokenAllowed(charlotte));

        assertEq(allowedTokens.getAllowedToken(0), alice);
        assertEq(allowedTokens.getAllowedToken(1), charlotte);
    }

    function testRemoveLastToken() public {
        // Setup 2 tokens: [alice, bob]
        vm.startPrank(address(daoMock));
        allowedTokens.addToken(alice);
        allowedTokens.addToken(bob);

        // Remove last token (bob)
        allowedTokens.removeToken(bob);
        vm.stopPrank();

        assertEq(allowedTokens.getAllowedTokensCount(), 1);
        assertFalse(allowedTokens.isTokenAllowed(bob));
        assertTrue(allowedTokens.isTokenAllowed(alice));

        assertEq(allowedTokens.getAllowedToken(0), alice);
    }

    function testRemoveFirstToken() public {
        // Setup 2 tokens: [alice, bob]
        vm.startPrank(address(daoMock));
        allowedTokens.addToken(alice);
        allowedTokens.addToken(bob);

        // Remove first token (alice)
        // Swap and pop: bob moves to alice's spot.
        // New array: [bob]
        allowedTokens.removeToken(alice);
        vm.stopPrank();

        assertEq(allowedTokens.getAllowedTokensCount(), 1);
        assertFalse(allowedTokens.isTokenAllowed(alice));
        assertTrue(allowedTokens.isTokenAllowed(bob));

        assertEq(allowedTokens.getAllowedToken(0), bob);
    }
}

//////////////////////////////////////////////////////////////
//          ZKPASSPORT POWERS REGISTRY TESTS                //
//////////////////////////////////////////////////////////////
contract ZKPassport_PowersRegistryTest is TestSetupPowers {
    // this should run on forked mainnet.
    // Deploy the ZKregistry as is, with existing verifiers and helpers.
    // it should never ever use any mock contracts.
    // the forked chain has all the real verifiers and helpers deployed, so we can test the full integration.
    address registryAddress;
    ZKPassport_PowersRegistry registry;
    ZKProof zkProof;

    function setUp() public override {
        uint256 sepoliaFork = vm.createFork(vm.envString("SEPOLIA_RPC_URL"));
        vm.selectFork(sepoliaFork); // options: only sepoliaFork

        super.setUp();

        registryAddress = findMandateAddress("ZKPassport_PowersRegistry");
        console.log("Registry address on Sepolia fork:", registryAddress);
        registry = ZKPassport_PowersRegistry(registryAddress);
        zkProof = new ZKProof();

        // We will deploy the registry in the test function itself, since it needs to be deployed by the daoMock.
    }

    function testZKPassportPowersRegistry() public {
        // Deploy the registry
        vm.prank(address(daoMock));

        // Check that the registry is deployed and has the correct owner
        // assertEq(registry.owner(), address(daoMock));

        // Check that the registry has the expected verifiers and helpers (from the constitution)
        // We can only check that they are set, not their internal logic, since we are using real contracts on mainnet fork.
        address verifierAddress = address(registry.zkPassportVerifier());
        address helperAddress = address(registry.zkPassportHelper());

        assertTrue(verifierAddress != address(0));
        assertTrue(helperAddress != address(0));
    }

    function testSubmitProof() public {
        // because proofs actually expire after a certain time, we need to skip this test for now.
        vm.skip(true);

        ProofVerificationParams memory proof = zkProof.getProof();
        bool isIDCard = false;

        vm.prank(address(daoMock));
        ZKPassport_PowersRegistry(registryAddress).registerProof(proof, isIDCard);
    }

    function testSubmitProofBytecode() public {
        // because proofs actually expire after a certain time, we need to skip this test for now.
        vm.skip(true);

        bytes memory bytesInput = zkProof.getBytesInputs();

        vm.prank(address(daoMock));
        registryAddress.call(bytesInput);

        DisclosedData memory disclosedData = ZKPassport_PowersRegistry(registryAddress).getDisclosed(cedars);

        console2.log("Disclosed data name:", disclosedData.name);
        console2.log("Disclosed data issuing country:", disclosedData.issuingCountry);
        console2.log("Disclosed data nationality:", disclosedData.nationality);
        console2.log("Disclosed data gender:", disclosedData.gender);
        console2.log("Disclosed data birth date:", disclosedData.birthDate);
        console2.log("Disclosed data expiry date:", disclosedData.expiryDate);
        console2.log("Disclosed data document number:", disclosedData.documentNumber);
        console2.log("Disclosed data document type:", disclosedData.documentType);
    }

    function testRetrieveDisclosedData() public {
        vm.skip(true);

        DisclosedData memory disclosedData = ZKPassport_PowersRegistry(registryAddress).getDisclosed(cedars);

        console2.log("Disclosed data name:", disclosedData.name);
        console2.log("Disclosed data issuing country:", disclosedData.issuingCountry);
        console2.log("Disclosed data nationality:", disclosedData.nationality);
        console2.log("Disclosed data gender:", disclosedData.gender);
        console2.log("Disclosed data birth date:", disclosedData.birthDate);
        console2.log("Disclosed data expiry date:", disclosedData.expiryDate);
        console2.log("Disclosed data document number:", disclosedData.documentNumber);
        console2.log("Disclosed data document type:", disclosedData.documentType);

        assertEq(abi.encode(disclosedData.documentType), abi.encode("P<"));
    }
}

//////////////////////////////////////////////////////////////
//               GOVERNED 721 TESTS                         //
//////////////////////////////////////////////////////////////
contract Governed721Test is TestSetupPowers {
    Governed721 governed721;
    SimpleErc20Votes paymentToken;

    event TransferId(uint256 indexed transferId);

    function setUp() public override {
        super.setUp();
        vm.prank(address(daoMock));
        governed721 = new Governed721();

        vm.prank(address(daoMock));
        paymentToken = new SimpleErc20Votes();
    }

    function testConstructor() public view {
        assertEq(governed721.name(), "Governed721");
        assertEq(governed721.symbol(), "G721");
        assertEq(governed721.owner(), address(daoMock));
        assertEq(governed721.DENOMINATOR(), 100);
    }

    function testSetPaymentId() public {
        uint16 mandateId = 5;
        vm.prank(address(daoMock));
        governed721.setPaymentId(mandateId);
        assertEq(governed721.paymentMandateId(), mandateId);
    }

    function testSetPaymentIdRevertsWhenNotOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        governed721.setPaymentId(5);
    }

    function testSetSplit() public {
        vm.startPrank(address(daoMock));
        governed721.setSplit(IGoverned721.Role.Artist, 10);
        governed721.setSplit(IGoverned721.Role.Intermediary, 5);
        vm.stopPrank();

        assertEq(governed721.getSplit(IGoverned721.Role.Artist), 10);
        assertEq(governed721.getSplit(IGoverned721.Role.Intermediary), 5);
        // OldOwner gets the remainder: 100 - 15 = 85
        assertEq(governed721.getSplit(IGoverned721.Role.OldOwner), 85);
    }

    function testSetSplitRevertsInvalidRole() public {
        vm.prank(address(daoMock));
        (bool success,) = address(governed721).call(abi.encodeWithSelector(governed721.setSplit.selector, 5, 10));
        assertFalse(success);
    }

    function testSetSplitRevertsOver100() public {
        vm.startPrank(address(daoMock));
        governed721.setSplit(IGoverned721.Role.Artist, 60);
        vm.expectRevert("Total split payment cannot be 100% or more");
        governed721.setSplit(IGoverned721.Role.Intermediary, 40);
        vm.stopPrank();
    }

    function testSetSplitRevertsWhenNotOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        governed721.setSplit(IGoverned721.Role.Artist, 10);
    }

    function testSetWhitelist() public {
        vm.prank(address(daoMock));
        governed721.setWhitelist(address(paymentToken), true);
        assertTrue(governed721.isWhitelisted(address(paymentToken)));

        vm.prank(address(daoMock));
        governed721.setWhitelist(address(paymentToken), false);
        assertFalse(governed721.isWhitelisted(address(paymentToken)));
    }

    function testSetWhitelistRevertsWhenNotOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        governed721.setWhitelist(address(paymentToken), true);
    }

    function testSetBlacklist() public {
        vm.prank(address(daoMock));
        governed721.setBlacklist(alice, true);
        assertTrue(governed721.isBlacklisted(alice));

        vm.prank(address(daoMock));
        governed721.setBlacklist(alice, false);
        assertFalse(governed721.isBlacklisted(alice));
    }

    function testSetBlacklistRevertsWhenNotOwner() public {
        vm.expectRevert();
        vm.prank(alice);
        governed721.setBlacklist(alice, true);
    }

    function testMint() public {
        uint256 tokenId = 1;
        string memory uri = "ipfs://test";

        governed721.mint(alice, tokenId, bob, uri);

        assertEq(governed721.ownerOf(tokenId), alice);
        assertEq(governed721.getArtist(tokenId), bob);
        assertEq(governed721.tokenURI(tokenId), uri);
    }

    function testMintRevertsTokenZero() public {
        vm.expectRevert("Token ID cannot be 0");
        governed721.mint(alice, 0, bob, "uri");
    }

    function testMintRevertsArtistZero() public {
        vm.expectRevert("Artist address cannot be 0");
        governed721.mint(alice, 1, address(0), "uri");
    }

    function testMintRevertsEmptyURI() public {
        vm.expectRevert("Token URI cannot be empty");
        governed721.mint(alice, 1, bob, "");
    }

    function testMintRevertsExistingToken() public {
        governed721.mint(alice, 1, bob, "uri");
        vm.expectRevert("Token ID already exists");
        governed721.mint(bob, 1, charlotte, "uri2");
    }

    function testBurn() public {
        governed721.mint(alice, 1, bob, "uri");

        vm.prank(address(daoMock));
        governed721.burn(1);

        vm.expectRevert();
        governed721.ownerOf(1);
    }

    function testBurnRevertsWhenNotOwner() public {
        governed721.mint(alice, 1, bob, "uri");

        vm.expectRevert();
        vm.prank(alice);
        governed721.burn(1);
    }

    function testSafeTransferFromNoPayment() public {
        governed721.mint(alice, 1, bob, "uri");

        vm.prank(alice);
        governed721.safeTransferFrom(alice, charlotte, 1, "");

        assertEq(governed721.ownerOf(1), charlotte);
    }

    function testSafeTransferFromWithPayment() public {
        vm.prank(address(daoMock));
        governed721.setWhitelist(address(paymentToken), true);

        uint256 price = 100 * 10 ** 18;
        vm.prank(charlotte);
        paymentToken.mint(price);
        vm.prank(charlotte);
        paymentToken.approve(address(governed721), price);

        governed721.mint(alice, 1, bob, "uri");

        uint256 nonce = 123;
        bytes memory data = abi.encode(address(paymentToken), price, nonce);

        vm.prank(alice);
        governed721.safeTransferFrom(alice, charlotte, 1, data);

        assertEq(governed721.ownerOf(1), charlotte);
        assertEq(paymentToken.balanceOf(address(daoMock)), price);
        assertEq(paymentToken.balanceOf(charlotte), 0);

        uint256 transferId = uint256(keccak256(abi.encode(alice, charlotte, 1, address(paymentToken), price, nonce)));
        IGoverned721.TransferData memory transferData = governed721.getTransferData(transferId);
        assertEq(transferData.oldOwner, alice);
        assertEq(transferData.newOwner, charlotte);
        assertEq(transferData.artist, bob);
        assertEq(transferData.tokenId, 1);
        assertEq(transferData.paymentToken, address(paymentToken));
        assertEq(transferData.quantity, price);
        assertEq(transferData.nonce, nonce);
    }

    function testSafeTransferFromRevertsNotWhitelisted() public {
        uint256 price = 100 * 10 ** 18;
        governed721.mint(alice, 1, bob, "uri");

        bytes memory data = abi.encode(address(paymentToken), price, 123);

        vm.expectRevert("Payment token is not whitelisted");
        vm.prank(alice);
        governed721.safeTransferFrom(alice, charlotte, 1, data);
    }

    function testSafeTransferFromRevertsBlacklisted() public {
        vm.prank(address(daoMock));
        governed721.setWhitelist(address(paymentToken), true);

        vm.prank(address(daoMock));
        governed721.setBlacklist(alice, true);

        uint256 price = 100 * 10 ** 18;
        governed721.mint(alice, 1, bob, "uri");

        bytes memory data = abi.encode(address(paymentToken), price, 123);

        vm.expectRevert("Blacklisted account involved in transfer");
        vm.prank(alice);
        governed721.safeTransferFrom(alice, charlotte, 1, data);
    }

    function testCollectPaymentSuccess() public {
        uint16 mandateId = 2;
        vm.prank(address(daoMock));
        governed721.setPaymentId(mandateId);

        bytes memory data = abi.encode(address(paymentToken), 100, 123);

        vm.prank(address(daoMock));
        governed721.collectPayment(IGoverned721.Role.Artist, alice, charlotte, 1, data);
    }

    function testCollectPaymentRevertsBlacklisted() public {
        vm.prank(address(daoMock));
        governed721.setBlacklist(alice, true);

        bytes memory data = abi.encode(address(paymentToken), 100, 123);

        vm.expectRevert("Blacklisted account involved in transfer");
        governed721.collectPayment(IGoverned721.Role.Artist, alice, charlotte, 1, data);
    }
}
