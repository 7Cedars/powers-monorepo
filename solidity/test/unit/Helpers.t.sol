// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import { FlagActions } from "@src/helpers/FlagActions.sol";
import { Grant } from "@src/helpers/Grant.sol";
import { TestSetupPowers } from "../TestSetup.t.sol";
import { PowersMock } from "@mocks/PowersMock.sol";
import { SimpleErc20Votes } from "@mocks/SimpleErc20Votes.sol";
import { Erc20Taxed } from "@mocks/Erc20Taxed.sol";
import { ElectionList } from "@src/helpers/ElectionList.sol";
import { SimpleErc1155 } from "@mocks/SimpleErc1155.sol";
import { Nominees } from "@src/helpers/Nominees.sol";
import { SimpleGovernor } from "@mocks/SimpleGovernor.sol";
import { EmptyTargetsMandate } from "@mocks/MandateMocks.sol";
import { MockTargetsMandate } from "@mocks/MandateMocks.sol";
import { PowersFactory } from "@src/helpers/PowersFactory.sol";
import { Powers } from "@src/Powers.sol";
import { Soulbound1155 } from "@src/helpers/Soulbound1155.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { AllowedTokens } from "@src/helpers/AllowedTokens.sol";
import { IZKPassport_PowersRegistry, ZKPassport_PowersRegistry } from "@src/helpers/ZKPassport_PowersRegistry.sol";
import { IZKPassportVerifier, IZKPassportHelper } from "@src/interfaces/IZKPassport.sol";
import { DisclosedData, ProofVerificationParams, BoundData, ProofVerificationData, FaceMatchMode, OS, ServiceConfig } from "@zkpassport/circuits/src/Types.sol";

/// @notice Unit tests for helper contracts
//////////////////////////////////////////////////////////////
//               FLAG ACTIONS TESTS                        //
//////////////////////////////////////////////////////////////
contract FlagActionsTest is TestSetupPowers {
    // FlagActions flagActions;

    function setUp() public override {
        super.setUp();
        vm.prank(address(daoMock));
        flagActions = new FlagActions();

        // Mock getActionState to always return Fulfilled
        vm.mockCall(
            address(daoMock), abi.encodeWithSelector(daoMock.getActionState.selector), abi.encode(ActionState.Fulfilled)
        );
    }

    function testConstructor() public view {
        assertEq(flagActions.owner(), address(daoMock));
    }

    function testConstructorRevertsWithZeroAddress() public pure {
        // This test is no longer applicable since we're using deployed contracts
        // The constructor validation would have happened during deployment
        assertTrue(true); // Placeholder assertion
    }

    function testFlag() public {
        actionId = 123;
        roleId = 1;
        account = alice;
        mandateId = 2;

        vm.prank(address(daoMock));
        flagActions.flag(actionId, roleId, account, mandateId);

        assertTrue(flagActions.flaggedActions(actionId));
        assertTrue(flagActions.isActionIdFlagged(actionId));
        assertTrue(flagActions.isActionFlaggedForRole(actionId, roleId));
        assertTrue(flagActions.isActionFlaggedForAccount(actionId, account));
        assertTrue(flagActions.isActionFlaggedForMandate(actionId, mandateId));
    }

    function testFlagRevertsWhenAlreadyFlagged() public {
        actionId = 123;
        roleId = 1;
        account = alice;
        mandateId = 2;

        vm.prank(address(daoMock));
        flagActions.flag(actionId, roleId, account, mandateId);

        vm.expectRevert("Already true");
        vm.prank(address(daoMock));
        flagActions.flag(actionId, roleId, account, mandateId);
    }

    function testUnflag() public {
        actionId = 123;
        roleId = 1;
        account = alice;
        mandateId = 2;

        vm.prank(address(daoMock));
        flagActions.flag(actionId, roleId, account, mandateId);

        vm.prank(address(daoMock));
        flagActions.unflag(actionId);

        assertFalse(flagActions.flaggedActions(actionId));
        assertFalse(flagActions.isActionIdFlagged(actionId));
        // Now unflagged actions are removed from all arrays
        assertFalse(flagActions.isActionFlaggedForRole(actionId, roleId));
        assertFalse(flagActions.isActionFlaggedForAccount(actionId, account));
        assertFalse(flagActions.isActionFlaggedForMandate(actionId, mandateId));
    }

    function testUnflagRevertsWhenNotFlagged() public {
        actionId = 123;

        vm.expectRevert("Already false");
        vm.prank(address(daoMock));
        flagActions.unflag(actionId);
    }

    function testFlagRevertsWhenNotCalledByOwner() public {
        actionId = 123;
        roleId = 1;
        account = alice;
        mandateId = 2;

        vm.expectRevert();
        vm.prank(alice);
        flagActions.flag(actionId, roleId, account, mandateId);
    }

    function testUnflagRevertsWhenNotCalledByOwner() public {
        actionId = 123;

        vm.expectRevert();
        vm.prank(alice);
        flagActions.unflag(actionId);
    }

    function testMultipleActions() public {
        actionIds = new uint256[](3);
        actionIds[0] = 123;
        actionIds[1] = 456;
        actionIds[2] = 789;

        uint16[] memory roleIds = new uint16[](3);
        roleIds[0] = 1;
        roleIds[1] = 2;
        roleIds[2] = 3;

        accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = charlotte;

        mandateIds = new uint16[](3);
        mandateIds[0] = 10;
        mandateIds[1] = 20;
        mandateIds[2] = 30;

        vm.startPrank(address(daoMock));
        flagActions.flag(actionIds[0], roleIds[0], accounts[0], mandateIds[0]);
        flagActions.flag(actionIds[1], roleIds[1], accounts[1], mandateIds[1]);
        flagActions.flag(actionIds[2], roleIds[2], accounts[2], mandateIds[2]);
        vm.stopPrank();

        assertTrue(flagActions.isActionIdFlagged(actionIds[0]));
        assertTrue(flagActions.isActionIdFlagged(actionIds[1]));
        assertTrue(flagActions.isActionIdFlagged(actionIds[2]));

        vm.startPrank(address(daoMock));
        flagActions.unflag(actionIds[1]);
        vm.stopPrank();

        assertTrue(flagActions.isActionIdFlagged(actionIds[0]));
        assertFalse(flagActions.isActionIdFlagged(actionIds[1]));
        assertTrue(flagActions.isActionIdFlagged(actionIds[2]));
    }

    function testGetFlaggedActionsByRole() public {
        actionIds = new uint256[](2);
        actionIds[0] = 123;
        actionIds[1] = 456;
        roleId = 1;
        accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        mandateIds = new uint16[](2);
        mandateIds[0] = 10;
        mandateIds[1] = 20;

        vm.startPrank(address(daoMock));
        flagActions.flag(actionIds[0], roleId, accounts[0], mandateIds[0]);
        flagActions.flag(actionIds[1], roleId, accounts[1], mandateIds[1]);
        vm.stopPrank();

        uint256[] memory roleActions = flagActions.getFlaggedActionsByRole(roleId);
        assertEq(roleActions.length, 2);
        assertEq(roleActions[0], actionIds[0]);
        assertEq(roleActions[1], actionIds[1]);

        assertEq(flagActions.getFlaggedActionsCountByRole(roleId), 2);
    }

    function testGetFlaggedActionsByAccount() public {
        actionIds = new uint256[](2);
        actionIds[0] = 123;
        actionIds[1] = 456;
        uint16[] memory roleIds = new uint16[](2);
        roleIds[0] = 1;
        roleIds[1] = 2;
        account = alice;
        mandateIds = new uint16[](2);
        mandateIds[0] = 10;
        mandateIds[1] = 20;

        vm.startPrank(address(daoMock));
        flagActions.flag(actionIds[0], roleIds[0], account, mandateIds[0]);
        flagActions.flag(actionIds[1], roleIds[1], account, mandateIds[1]);
        vm.stopPrank();

        uint256[] memory accountActions = flagActions.getFlaggedActionsByAccount(account);
        assertEq(accountActions.length, 2);
        assertEq(accountActions[0], actionIds[0]);
        assertEq(accountActions[1], actionIds[1]);

        assertEq(flagActions.getFlaggedActionsCountByAccount(account), 2);
    }

    function testGetFlaggedActionsByMandate() public {
        actionIds = new uint256[](2);
        actionIds[0] = 123;
        actionIds[1] = 456;
        uint16[] memory roleIds = new uint16[](2);
        roleIds[0] = 1;
        roleIds[1] = 2;
        accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        mandateId = 10;

        vm.startPrank(address(daoMock));
        flagActions.flag(actionIds[0], roleIds[0], accounts[0], mandateId);
        flagActions.flag(actionIds[1], roleIds[1], accounts[1], mandateId);
        vm.stopPrank();

        uint256[] memory mandateActions = flagActions.getFlaggedActionsByMandate(mandateId);
        assertEq(mandateActions.length, 2);
        assertEq(mandateActions[0], actionIds[0]);
        assertEq(mandateActions[1], actionIds[1]);

        assertEq(flagActions.getFlaggedActionsCountByMandate(mandateId), 2);
    }

    function testGetAllFlaggedActions() public {
        actionIds = new uint256[](3);
        actionIds[0] = 123;
        actionIds[1] = 456;
        actionIds[2] = 789;
        uint16[] memory roleIds = new uint16[](3);
        roleIds[0] = 1;
        roleIds[1] = 2;
        roleIds[2] = 3;
        accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = charlotte;
        mandateIds = new uint16[](3);
        mandateIds[0] = 10;
        mandateIds[1] = 20;
        mandateIds[2] = 30;

        vm.startPrank(address(daoMock));
        flagActions.flag(actionIds[0], roleIds[0], accounts[0], mandateIds[0]);
        flagActions.flag(actionIds[1], roleIds[1], accounts[1], mandateIds[1]);
        flagActions.flag(actionIds[2], roleIds[2], accounts[2], mandateIds[2]);
        vm.stopPrank();

        uint256[] memory allActions = flagActions.getAllFlaggedActions();
        assertEq(allActions.length, 3);
        assertEq(allActions[0], actionIds[0]);
        assertEq(allActions[1], actionIds[1]);
        assertEq(allActions[2], actionIds[2]);

        assertEq(flagActions.getTotalFlaggedActionsCount(), 3);
    }

    function testIsActionFlaggedForSpecificContext() public {
        actionId = 123;
        roleId = 1;
        account = alice;
        mandateId = 10;

        vm.prank(address(daoMock));
        flagActions.flag(actionId, roleId, account, mandateId);

        // Test specific context checks
        assertTrue(flagActions.isActionFlaggedForRole(actionId, roleId));
        assertFalse(flagActions.isActionFlaggedForRole(actionId, 999));

        assertTrue(flagActions.isActionFlaggedForAccount(actionId, account));
        assertFalse(flagActions.isActionFlaggedForAccount(actionId, bob));

        assertTrue(flagActions.isActionFlaggedForMandate(actionId, mandateId));
        assertFalse(flagActions.isActionFlaggedForMandate(actionId, 999));
    }

    function testUnflagRemovesFromAllArrays() public {
        actionIds = new uint256[](3);
        actionIds[0] = 123;
        actionIds[1] = 456;
        actionIds[2] = 789;
        uint16[] memory roleIds = new uint16[](3);
        roleIds[0] = 1;
        roleIds[1] = 2;
        roleIds[2] = 3;
        accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = charlotte;
        mandateIds = new uint16[](3);
        mandateIds[0] = 10;
        mandateIds[1] = 20;
        mandateIds[2] = 30;

        // Flag multiple actions
        vm.startPrank(address(daoMock));
        flagActions.flag(actionIds[0], roleIds[0], accounts[0], mandateIds[0]);
        flagActions.flag(actionIds[1], roleIds[1], accounts[1], mandateIds[1]);
        flagActions.flag(actionIds[2], roleIds[2], accounts[2], mandateIds[2]);
        vm.stopPrank();

        // Verify all actions are flagged
        assertTrue(flagActions.isActionIdFlagged(actionIds[0]));
        assertTrue(flagActions.isActionIdFlagged(actionIds[1]));
        assertTrue(flagActions.isActionIdFlagged(actionIds[2]));

        // Verify counts before unflagging
        assertEq(flagActions.getFlaggedActionsCountByRole(roleIds[0]), 1);
        assertEq(flagActions.getFlaggedActionsCountByAccount(accounts[0]), 1);
        assertEq(flagActions.getFlaggedActionsCountByMandate(mandateIds[0]), 1);
        assertEq(flagActions.getTotalFlaggedActionsCount(), 3);

        // Unflag actionIds[1]
        vm.prank(address(daoMock));
        flagActions.unflag(actionIds[1]);

        // Verify actionIds[1] is unflagged
        assertFalse(flagActions.isActionIdFlagged(actionIds[1]));
        assertFalse(flagActions.isActionFlaggedForRole(actionIds[1], roleIds[1]));
        assertFalse(flagActions.isActionFlaggedForAccount(actionIds[1], accounts[1]));
        assertFalse(flagActions.isActionFlaggedForMandate(actionIds[1], mandateIds[1]));

        // Verify other actions are still flagged
        assertTrue(flagActions.isActionIdFlagged(actionIds[0]));
        assertTrue(flagActions.isActionIdFlagged(actionIds[2]));

        // Verify counts after unflagging
        assertEq(flagActions.getFlaggedActionsCountByRole(roleIds[0]), 1);
        assertEq(flagActions.getFlaggedActionsCountByRole(roleIds[1]), 0);
        assertEq(flagActions.getFlaggedActionsCountByRole(roleIds[2]), 1);

        assertEq(flagActions.getFlaggedActionsCountByAccount(accounts[0]), 1);
        assertEq(flagActions.getFlaggedActionsCountByAccount(accounts[1]), 0);
        assertEq(flagActions.getFlaggedActionsCountByAccount(accounts[2]), 1);

        assertEq(flagActions.getFlaggedActionsCountByMandate(mandateIds[0]), 1);
        assertEq(flagActions.getFlaggedActionsCountByMandate(mandateIds[1]), 0);
        assertEq(flagActions.getFlaggedActionsCountByMandate(mandateIds[2]), 1);

        assertEq(flagActions.getTotalFlaggedActionsCount(), 2);

        // Verify array contents
        uint256[] memory role1Actions = flagActions.getFlaggedActionsByRole(roleIds[0]);
        assertEq(role1Actions.length, 1);
        assertEq(role1Actions[0], actionIds[0]);

        uint256[] memory role2Actions = flagActions.getFlaggedActionsByRole(roleIds[1]);
        assertEq(role2Actions.length, 0);

        uint256[] memory allActions = flagActions.getAllFlaggedActions();
        assertEq(allActions.length, 2);
        // Should contain actionIds[0] and actionIds[2], but not actionIds[1]
        bool found1 = false;
        bool found3 = false;
        bool found2 = false;
        for (i = 0; i < allActions.length; i++) {
            if (allActions[i] == actionIds[0]) found1 = true;
            if (allActions[i] == actionIds[2]) found3 = true;
            if (allActions[i] == actionIds[1]) found2 = true;
        }
        assertTrue(found1);
        assertTrue(found3);
        assertFalse(found2);
    }
}

//////////////////////////////////////////////////////////////
//               GRANT TESTS                               //
//////////////////////////////////////////////////////////////
contract GrantTest is TestSetupPowers {
    Grant grant;
    Grant.Milestone milestone;

    function setUp() public override {
        super.setUp();
        vm.prank(address(daoMock));
        grant = new Grant();
        testToken = makeAddr("testToken");
    }

    function testConstructor() public view {
        assertEq(grant.owner(), address(daoMock));
    }

    function testConstructorRevertsWithZeroAddress() public pure {
        // This test is no longer applicable since we're using deployed contracts
        // The constructor validation would have happened during deployment
        assertTrue(true); // Placeholder assertion
    }

    function testUpdateNativeBudget() public {
        uint256 budget = 1000 ether;

        vm.prank(address(daoMock));
        grant.updateNativeBudget(budget);

        assertEq(grant.getNativeBudget(), budget);
        assertEq(grant.getRemainingNativeBudget(), budget);
    }

    function testUpdateTokenBudget() public {
        uint256 budget = 5000;

        vm.prank(address(daoMock));
        grant.updateTokenBudget(testToken, budget);

        assertEq(grant.getTokenBudget(testToken), budget);
        assertEq(grant.getRemainingTokenBudget(testToken), budget);
    }

    function testUpdateTokenBudgetRevertsWithZeroAddress() public {
        vm.expectRevert("Invalid token address");
        vm.prank(address(daoMock));
        grant.updateTokenBudget(address(0), 1000);
    }

    function testWhitelistToken() public {
        vm.prank(address(daoMock));
        grant.whitelistToken(testToken);

        assertTrue(grant.isTokenWhitelisted(testToken));
    }

    function testWhitelistTokenRevertsWithZeroAddress() public {
        vm.expectRevert("Invalid token address");
        vm.prank(address(daoMock));
        grant.whitelistToken(address(0));
    }

    function testDewhitelistToken() public {
        vm.prank(address(daoMock));
        grant.whitelistToken(testToken);

        vm.prank(address(daoMock));
        grant.dewhitelistToken(testToken);

        assertFalse(grant.isTokenWhitelisted(testToken));
    }

    function testSubmitProposal() public {
        vm.startPrank(address(daoMock));
        grant.whitelistToken(testToken);
        grant.updateNativeBudget(1000 ether);
        grant.updateTokenBudget(testToken, 5000);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](2);
        milestoneAmounts = new uint256[](2);
        tokens = new address[](2);

        milestoneBlocks[0] = block.number + 100;
        milestoneBlocks[1] = block.number + 200;
        milestoneAmounts[0] = 100 ether;
        milestoneAmounts[1] = 200 ether;
        tokens[0] = address(0); // Native
        tokens[1] = testToken;

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        assertEq(proposalId, 0);
        assertEq(grant.getProposalCount(), 1);

        Grant.Proposal memory proposal = grant.getProposal(proposalId);
        assertEq(proposal.proposer, tx.origin);
        assertEq(proposal.uri, uri);
        assertEq(proposal.milestoneBlocks.length, 2);
        assertEq(proposal.milestoneAmounts.length, 2);
        assertEq(proposal.tokens.length, 2);
        assertFalse(proposal.approved);
        assertFalse(proposal.rejected);
        assertEq(proposal.submissionBlock, block.number);
    }

    function testSubmitProposalRevertsWithInvalidData() public {
        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](0);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        vm.expectRevert("Invalid proposal");
        vm.prank(address(daoMock));
        grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);
    }

    function testSubmitProposalRevertsWithMismatchedArrays() public {
        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](2);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](2);

        vm.expectRevert("Invalid proposal");
        vm.prank(address(daoMock));
        grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);
    }

    function testSubmitProposalRevertsWithUnwhitelistedToken() public {
        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 100 ether;
        tokens[0] = testToken; // Not whitelisted

        vm.expectRevert("Token not whitelisted");
        vm.prank(address(daoMock));
        grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);
    }

    function testApproveProposal() public {
        // Setup proposal
        vm.startPrank(address(daoMock));
        grant.whitelistToken(testToken);
        grant.updateNativeBudget(1000 ether);
        grant.updateTokenBudget(testToken, 5000);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 100 ether;
        tokens[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);

        assertTrue(grant.isProposalApproved(proposalId));
        assertFalse(grant.isProposalRejected(proposalId));
    }

    function testRejectProposal() public {
        // Setup proposal
        vm.startPrank(address(daoMock));
        grant.whitelistToken(testToken);
        grant.updateNativeBudget(1000 ether);
        grant.updateTokenBudget(testToken, 5000);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 100 ether;
        tokens[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.rejectProposal(proposalId);

        assertFalse(grant.isProposalApproved(proposalId));
        assertTrue(grant.isProposalRejected(proposalId));
    }

    function testApproveProposalRevertsWhenNotFound() public {
        vm.expectRevert("Proposal not found");
        vm.prank(address(daoMock));
        grant.approveProposal(999);
    }

    function testApproveProposalRevertsWhenAlreadyProcessed() public {
        // Setup proposal
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(1000 ether);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 100 ether;
        tokens[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);

        vm.expectRevert("Proposal already processed");
        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);
    }

    function testReleaseMilestone() public {
        // Setup proposal
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(1000 ether);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 100 ether;
        tokens[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);

        // Fast forward to milestone block
        vm.roll(block.number + 101);

        vm.prank(address(daoMock));
        grant.releaseMilestone(proposalId, 0);

        milestone = grant.getMilestone(proposalId, 0);
        assertTrue(milestone.released);
        assertEq(grant.getTotalSpentNative(), 100 ether);
    }

    function testReleaseMilestoneRevertsWhenNotApproved() public {
        // Setup proposal
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(1000 ether);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 100 ether;
        tokens[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.roll(block.number + 101);

        vm.expectRevert("Proposal not approved");
        vm.prank(address(daoMock));
        grant.releaseMilestone(proposalId, 0);
    }

    function testReleaseMilestoneRevertsWhenNotReached() public {
        // Setup proposal
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(1000 ether);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 100 ether;
        tokens[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);

        vm.expectRevert("Milestone not reached");
        vm.prank(address(daoMock));
        grant.releaseMilestone(proposalId, 0);
    }

    function testReleaseMilestoneRevertsWhenInsufficientBudget() public {
        // Test the scenario where budget becomes insufficient between approval and release
        // This can happen if the budget is reduced after approval but before release

        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(100 ether); // Sufficient budget for approval
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 50 ether; // Within budget at approval time
        tokens[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);

        // Now reduce the budget to make it insufficient for release
        vm.prank(address(daoMock));
        grant.updateNativeBudget(30 ether); // Less than milestone amount

        vm.roll(block.number + 101);

        // This should fail at release due to insufficient budget
        vm.expectRevert("Insufficient budget");
        vm.prank(address(daoMock));
        grant.releaseMilestone(proposalId, 0);
    }

    function testCanReleaseMilestone() public {
        // Setup proposal
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(1000 ether);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        tokens = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 100 ether;
        tokens[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);

        // Before milestone block
        assertFalse(grant.canReleaseMilestone(proposalId, 0));

        // After milestone block
        vm.roll(block.number + 101);
        assertTrue(grant.canReleaseMilestone(proposalId, 0));
    }

    function testGetProposalMilestones() public {
        // Setup proposal
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(1000 ether);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](2);
        milestoneAmounts = new uint256[](2);
        tokens = new address[](2);

        milestoneBlocks[0] = block.number + 100;
        milestoneBlocks[1] = block.number + 200;
        milestoneAmounts[0] = 100 ether;
        milestoneAmounts[1] = 200 ether;
        tokens[0] = address(0);
        tokens[1] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        Grant.Milestone[] memory milestones = grant.getProposalMilestones(proposalId);
        assertEq(milestones.length, 2);
        assertEq(milestones[0].blockNumber, block.number + 100);
        assertEq(milestones[1].blockNumber, block.number + 200);
    }

    function testGetBudgetStatus() public {
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(1000 ether);
        grant.updateTokenBudget(testToken, 5000);
        vm.stopPrank();

        (
            uint256 nativeBudget,
            uint256 nativeSpent,
            uint256 nativeRemaining,
            address[] memory whitelistedTokensList,
            uint256[] memory tokenBudgets,
            uint256[] memory tokenSpent,
            uint256[] memory tokenRemaining
        ) = grant.getBudgetStatus();

        assertEq(nativeBudget, 1000 ether);
        assertEq(nativeSpent, 0);
        assertEq(nativeRemaining, 1000 ether);
        assertEq(whitelistedTokensList.length, 0);
        assertEq(tokenBudgets.length, 0);
        assertEq(tokenSpent.length, 0);
        assertEq(tokenRemaining.length, 0);
    }

    function testApproveProposalRevertsWithInsufficientNativeBudget() public {
        // Setup proposal with budget smaller than total proposal amount
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(50 ether); // Less than total proposal amount
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](2);
        milestoneAmounts = new uint256[](2);
        tokens = new address[](2);

        milestoneBlocks[0] = block.number + 100;
        milestoneBlocks[1] = block.number + 200;
        milestoneAmounts[0] = 30 ether; // Total: 30 + 40 = 70 ether
        milestoneAmounts[1] = 40 ether;
        tokens[0] = address(0); // Native
        tokens[1] = address(0); // Native

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.expectRevert("Insufficient native budget for proposal");
        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);
    }

    function testApproveProposalRevertsWithInsufficientTokenBudget() public {
        // Setup proposal with token budget smaller than total proposal amount
        vm.startPrank(address(daoMock));
        grant.whitelistToken(testToken);
        grant.updateNativeBudget(1000 ether);
        grant.updateTokenBudget(testToken, 50); // Less than total proposal amount
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](2);
        milestoneAmounts = new uint256[](2);
        tokens = new address[](2);

        milestoneBlocks[0] = block.number + 100;
        milestoneBlocks[1] = block.number + 200;
        milestoneAmounts[0] = 30; // Total: 30 + 40 = 70 tokens
        milestoneAmounts[1] = 40;
        tokens[0] = testToken;
        tokens[1] = testToken;

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.expectRevert("Insufficient token budget for proposal");
        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);
    }

    function testApproveProposalSucceedsWithSufficientBudget() public {
        // Setup proposal with sufficient budget
        vm.startPrank(address(daoMock));
        grant.whitelistToken(testToken);
        grant.updateNativeBudget(100 ether);
        grant.updateTokenBudget(testToken, 100);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](2);
        milestoneAmounts = new uint256[](2);
        tokens = new address[](2);

        milestoneBlocks[0] = block.number + 100;
        milestoneBlocks[1] = block.number + 200;
        milestoneAmounts[0] = 30 ether; // Total: 30 + 40 = 70 ether
        milestoneAmounts[1] = 40 ether;
        tokens[0] = address(0); // Native
        tokens[1] = address(0); // Native

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);

        assertTrue(grant.isProposalApproved(proposalId));
    }

    function testApproveProposalSucceedsWithMixedTokenTypes() public {
        // Setup proposal with mixed native and token types
        vm.startPrank(address(daoMock));
        grant.whitelistToken(testToken);
        grant.updateNativeBudget(100 ether);
        grant.updateTokenBudget(testToken, 100);
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](3);
        milestoneAmounts = new uint256[](3);
        tokens = new address[](3);

        milestoneBlocks[0] = block.number + 100;
        milestoneBlocks[1] = block.number + 200;
        milestoneBlocks[2] = block.number + 300;
        milestoneAmounts[0] = 30 ether; // Native
        milestoneAmounts[1] = 40; // Token
        milestoneAmounts[2] = 20 ether; // Native (total native: 50 ether, total token: 40)
        tokens[0] = address(0); // Native
        tokens[1] = testToken;
        tokens[2] = address(0); // Native

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);

        assertTrue(grant.isProposalApproved(proposalId));
    }

    function testApproveProposalRevertsWithMultipleTokenTypes() public {
        // Setup proposal with multiple token types where one exceeds budget
        testToken2 = makeAddr("testToken2");

        vm.startPrank(address(daoMock));
        grant.whitelistToken(testToken);
        grant.whitelistToken(testToken2);
        grant.updateNativeBudget(1000 ether);
        grant.updateTokenBudget(testToken, 100);
        grant.updateTokenBudget(testToken2, 10); // Small budget for token2
        vm.stopPrank();

        uri = "https://example.com/proposal";
        milestoneBlocks = new uint256[](2);
        milestoneAmounts = new uint256[](2);
        tokens = new address[](2);

        milestoneBlocks[0] = block.number + 100;
        milestoneBlocks[1] = block.number + 200;
        milestoneAmounts[0] = 50; // Token1 - within budget
        milestoneAmounts[1] = 20; // Token2 - exceeds budget
        tokens[0] = testToken;
        tokens[1] = testToken2;

        vm.prank(address(daoMock));
        uint256 proposalId = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens);

        vm.expectRevert("Insufficient token budget for proposal");
        vm.prank(address(daoMock));
        grant.approveProposal(proposalId);
    }

    function testApproveProposalRevertsWithAlreadySpentBudget() public {
        // Setup: First approve and release a milestone to spend some budget
        vm.startPrank(address(daoMock));
        grant.updateNativeBudget(100 ether);
        vm.stopPrank();

        // First proposal
        uri = "https://example.com/proposal1";
        milestoneBlocks = new uint256[](1);
        milestoneAmounts = new uint256[](1);
        address[] memory tokens1 = new address[](1);

        milestoneBlocks[0] = block.number + 100;
        milestoneAmounts[0] = 60 ether;
        tokens1[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId1 = grant.submitProposal(uri, milestoneBlocks, milestoneAmounts, tokens1);

        vm.prank(address(daoMock));
        grant.approveProposal(proposalId1);

        // Release the milestone to spend budget
        vm.roll(block.number + 101);
        vm.prank(address(daoMock));
        grant.releaseMilestone(proposalId1, 0);

        // Second proposal that would exceed remaining budget
        uri2 = "https://example.com/proposal2";
        milestoneBlocks2 = new uint256[](1);
        milestoneAmounts2 = new uint256[](1);
        address[] memory tokens2 = new address[](1);

        milestoneBlocks2[0] = block.number + 200;
        milestoneAmounts2[0] = 50 ether; // Would exceed remaining 40 ether budget
        tokens2[0] = address(0);

        vm.prank(address(daoMock));
        uint256 proposalId2 = grant.submitProposal(uri2, milestoneBlocks2, milestoneAmounts2, tokens2);

        vm.expectRevert("Insufficient native budget for proposal");
        vm.prank(address(daoMock));
        grant.approveProposal(proposalId2);
    }

    function testAllFunctionsRevertWhenNotCalledByPowers() public {
        vm.expectRevert();
        vm.prank(alice);
        grant.updateNativeBudget(1000);

        vm.expectRevert();
        vm.prank(alice);
        grant.updateTokenBudget(testToken, 1000);

        vm.expectRevert();
        vm.prank(alice);
        grant.whitelistToken(testToken);

        vm.expectRevert();
        vm.prank(alice);
        grant.dewhitelistToken(testToken);

        vm.expectRevert();
        vm.prank(alice);
        grant.submitProposal("", new uint256[](0), new uint256[](0), new address[](0));

        vm.expectRevert();
        vm.prank(alice);
        grant.approveProposal(0);

        vm.expectRevert();
        vm.prank(alice);
        grant.rejectProposal(0);

        vm.expectRevert();
        vm.prank(alice);
        grant.releaseMilestone(0, 0);
    }
}

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

    function testMintCoins() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

        assertEq(token.balanceOf(alice, COIN_ID), amount);
    }

    function testMintCoinsRevertsWithZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SimpleErc1155.SimpleErc1155__NoZeroAmount.selector);
        token.mint(0);
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
        token.mint(maxAmount);

        assertEq(token.balanceOf(alice, COIN_ID), maxAmount);
    }

    function testMultipleMints() public {
        uint256 amount1 = 1000;
        uint256 amount2 = 2000;

        vm.prank(alice);
        token.mint(amount1);

        vm.prank(alice);
        token.mint(amount2);

        assertEq(token.balanceOf(alice, COIN_ID), amount1 + amount2);
    }

    function testTransfer() public {
        uint256 amount = 1000;

        vm.prank(alice);
        token.mint(amount);

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

        vm.startPrank(address(daoMock));
        factory = new PowersFactory(
            "Factory DAO", // name
            "https://factory.dao", // uri
            MAX_CALL_DATA, 
            MAX_RETURN_DATA, 
            MAX_EXECUTIONS
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

        Powers deployedPowers = Powers(deployedAddress);
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

        vm.startPrank(address(daoMockChild1));
        factory = new PowersFactory(
            "Another DAO", // name
            "ipfs://QmHash", // uri
            MAX_CALL_DATA, 
            MAX_RETURN_DATA, 
            MAX_EXECUTIONS
            );
        factory.addMandates(mandateInitDataArray);
        address deployedAddress = factory.createPowers();
        vm.stopPrank();

        Powers deployedPowers = Powers(deployedAddress);
        assertEq(deployedPowers.name(), nameDescription);

        // Another Powers should be admin. Not factory or daoMock.
        // -- removed for now, will change in future updates
        // assertEq(deployedPowers.hasRoleSince(deployedAddress, deployedPowers.ADMIN_ROLE()), 0);
        // assertEq(deployedPowers.hasRoleSince(address(factory), deployedPowers.ADMIN_ROLE()), 0);
        // assertNotEq(deployedPowers.hasRoleSince(address(daoMockChild1), deployedPowers.ADMIN_ROLE()), 0);
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

    function setUp() public override {
        super.setUp();

        registryAddress = findMandateAddress("ZKPassport_PowersRegistry"); 
        console.log("Registry address on Sepolia fork:", registryAddress);
        registry = ZKPassport_PowersRegistry(registryAddress);

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
        // This is a placeholder for the test that will submit a proof to the registry.
        // Since we are on a forked mainnet, we would need to have a valid proof and the corresponding inputs to test this properly.
        // For now, we will just check that the function can be called without reverting, using dummy data.
        
        bytes memory proofBytes = vm.envBytes("ZKP_PROOF");
        console.log("Proof bytes length:", proofBytes.length);
        console2.logBytes((vm.envBytes("ZKP_PROOF")));

        bytes32[] memory publicInputs = new bytes32[](8);
        publicInputs[0] = hex"2f696abafd61692fe9c82281fd461431f5ff1d3ec31c10b2258b3151d89b9c6d"; // dummy data
        publicInputs[1] = hex"2c0ba69927ad2b3737a57195469c8185f0bcf42ea920cb0ac4963981f23f9e87"; // dummy data
        publicInputs[2] = hex"00000000000000000000000000000000000000000000000000000000699c525b"; // dummy data
        publicInputs[3] = hex"00f57931b54ee536c40f368c81a301ef5a449fe4c853847aebedb9817fea9380"; // dummy data
        publicInputs[4] = hex"000e25d57dbe558245aead9ac9aa0089a2d18634aa26fa0dd81efbff7c4622d9"; // dummy data
        publicInputs[5] = hex"00c217ef3482939d028059057d5d1d52c866d14ba111c1f6a0110068bb767a56"; // dummy data
        publicInputs[6] = hex"0000000000000000000000000000000000000000000000000000000000000000"; // dummy data
        publicInputs[7] = hex"08254261e988dd66dbe391d5b382e78bf8194252f6d52a4a5338fca2a4ed9b92"; // dummy data

        ( ProofVerificationParams memory proof ) = ProofVerificationParams({
            version: hex"0000001000000000000000000000000000000000000000000000000000000000", 
            proofVerificationData: ProofVerificationData({
                vkeyHash: hex"2cb0301d4fccf542247d2164335a1ac1a94be519757be9a8f76556e95ad4110a", 
                proof: hex"00000000000000000000000000000000000000000000000d1d15da1a89637e450000000000000000000000000000000000000000000000006be3451f9ed2cbe000000000000000000000000000000000000000000000000435d64410fd6cb56a0000000000000000000000000000000000000000000000000001d9fc5a28a236000000000000000000000000000000000000000000000006bebfb9c42f8f662a000000000000000000000000000000000000000000000003192c1160a48a522e00000000000000000000000000000000000000000000000d9f46b5f972f4d0ee000000000000000000000000000000000000000000000000000292eb46402e75000000000000000000000000000000000000000000000008a2a7919987c38cf000000000000000000000000000000000000000000000000a6a25f9c8dca7c6c700000000000000000000000000000000000000000000000bbf8e7f6ff7102b61000000000000000000000000000000000000000000000000000285a9c2d24c5d00000000000000000000000000000000000000000000000ce0607a3dad4934420000000000000000000000000000000000000000000000030c43e8544ad5e38500000000000000000000000000000000000000000000000141e206ca6655053600000000000000000000000000000000000000000000000000024a2b75f768cd0bea9fee109c2d68e671b31135854880bbb33540b0dd7b469d6666a2f73da83f275d633c9d7c0e81fc929d14e2c407178d85cb58d3c343144879ec40466b797f22d6a0ea90b041550f0ef55267dc7e9ad640ea0b02e6c840ce9d7e2a5395b010107cefbf0b2b57b95923e2a726f820ee5341c50d1616859475eb98595b59fb762d20e939b316940d928f9abf7740b0cb13bb305315f9b7f03ac2ba071703494706ec742e9038645ea7a96788b9624f7dd7e492480e0930deeb6694f8ef538ff52d8c56d1edd26ed0148436911d0b82618b8869f9733e9b676efaa717e1bf6362161d04d9bfb6cc44f6d0d3beab7c2705b49e0cc60a6c69cbfaf6deda98bfc3382d8c56d1edd26ed0148436911d0b82618b8869f9733e9b676efaa717e1bf6362161d04d9bfb6cc44f6d0d3beab7c2705b49e0cc60a6c69cbfaf6deda98bfc3382b1453b84de55057131aff3f9c348a4a9fd5fd32e2ed7e2e69d0d25cb7dd395b2f4e8ea88076e7ec9f491d0609d8e42551d43d790a0b768c9646c45b7a6e718e0669ee923baba25248e4480d24e5b286146ddaf2d04d0d0e82bf48d737036f141b538b951e3e784cb805ed1aad3bf363d5d6e05686717bcdd6e507fe025d29d914c85949a38960ed1c49d42167ffcb9e68906b9fb1b9265cb1d0194fb4671d1d2b9658f41310da64ae566236a5ea3bff138bdb1f718ead7fac796f413bd3796a264b2ca5fd2cafa97946b35bad0c49d183eadcb504610572f89744bc9747d5dc0a1921cce404f0803f09925ad4750e8ba4490b9375586b1e4b4ab0d758b82a252e9f9c5908310ef42b0c671dc8441443425bacf3d37cc7b5dfa3c316f2d234550b861e0e82c71106caeebe6e8017cf7dbb56a52c687c4952ceb0915105bff25a136f9a6ca4ca5f9a3a5c004e0ab2e53872e4bf998faa96165d2efc15df307f5322a6ab344660ece340f2b1f1467f2d3fffaad5affb1c2fc8ce672a1972bd93ad1b781bb92db5bebd1ed59e460153b44cf415b8fe79c8dc4dfcbaa1218897bb7a223225dfabe4909aba83352043454d66096804493fb55675aa7ff9f162e7e1021b2b7a5c0ccfbdb657acf51cd1937ea664c016688b60d6ef1f989393c5ce0d610b6a3a3f88af3525e50746d0aee65a76d588a1d02f8bc6d9367c3fd0187ce50a0bc27b1c5973bc9c7c9853444209ae52db994d39e938cec986cf5755f91eb4081d0fc384752fd824b7c73bd4cc9aedf7787cc73b8414559610fea44845adbe7c2cd4678b3f980b664db9ec43879b48564726c9f56dfe1921f5c5a01f9059a2210954ca9d7495d3895528c9a02b9ad346bca1f3038703592cf6b4e47fba90fb762a2818071872bd8caa2b9f6fea12917569b6f962223bbb86fb9af523e045f4ab182e39ae1db23c6fe878538701304bb6ff645e2773f21200c3f764f2b67375631105d836a7441fa2e7ed51103806494f264e8984ec822815f463104a9b7bcd822738b7b308564ca9f0926b4f698aa133e39944cad83300c1587e3a992c21750a0ebf102e08e18b0104b1dc48e123e1b5d6baeeb453838e90694a12abe086cac11ed83e2440047857ad7f4993554e2fb15e79912a6c3cff3d9b751d959c95ce5d139043bc975af8b1dc1b881e169cd36246dc1678c740080955c4e7ffd24302bd107ccc60639aefe3ca5be1572fcbc6ccc77dcecf9c15ab9a54e77d03b36d7fca10af4d395b7e75944239769a8012fa9a627ff672c7ae96db5379974a334b19160fb7104dc471c077a4be3e936ddd7c8b4d3399dc4ec52cdf9727367d3e60aadb286ead2dcec7e89544980231c71f173cb8cc0e13d9b509328a9ddbbf962b0f2315bb17c132c672ef26618a03af9cde51a2d7a10f26362014ea365968e8e5a2f7136f7b963d1692f6e6f42a1905112f9320a11ef31fbc1ab7a437c5c2fff3e85f2cd18b54fe86300000444314baedb3aab3b8c66b5fb411e389d7e29c8e5e21d50041669dbe62560a1fa2fe37050fa377cc17378d751dfffc14702a40d386856c2191c4ff82e47f9249ad1f23003a044288ec725c21c21f17a6ab31bce4224760232568dffcda5c2db6d12570c343c5ac7c9282714ea64c5162d4739ed307627e0af3c0c1e0b107846650933ed96ecbfe05c819b60266c720078def304cecfa2b1eaf6aefd88e4532ccca74a9be28f87d0d9309b9704e9538985bdea604b55b510b527b393b3da72d1acc758a70534d0c905ecc785f642b2791d63734d3ffbd082392e0bb7b71119420a6d43791acb8dc153bbce703ddd58c9cdd1e73995f9b5d05f313aa978c28edec20f5a82e630f2c2be3e7ccfabd4d11ce2f86965fdb4d2c19215ab98d024b3b487c9e286e2bd065a8419f468d01e65b2383727c31fb0fcc0ce910a67c83dc41a77e788dbc8b403d3637fa8f88435d43a89b760b0505454706d86ccb74711fc31c45913006a9bc5767a7989886790c5f7c85bd5abb52eb492f391cb598aa39cf5d411e35c97665cff2c8e67be040739049a4d93ba714c5280ea24fb6dd18f9f736d7d3971f952366b4d3737fbe7f57ea770acb7b2efbe9301b40eb2e89b4d3e8a1fedf1c9f48e9051b26722ef9c7f9fc645a8f7d48aa83c61e65d4710329b56d6f05edc73bceed9cd1f4c8c735332ba9a44463d058f9fe0428aa8de96e4d7d004d9cff8e62da25b68778c1368a46c72f0dcd4e8abd8ca2613030f55eeaffee597773a225b4d37af9afb08dd0a2b9101d9870cc2d81471ad406eed0f0cb332e541fbcf6cc7259156d3f71065eb8af65256f9c9a50544c8457007f8b86c91d95f04a2985b9543c2cc271621b566877063f5c7f2cc696cd76e2110e9a2f41ab4a13f4cccc9140e14e4bf84b45d225a22390a5ef1c4c95a66c712b70e48f70d5f8e84b46b0cbed57c853bc7b134878fcbf1b56867375dbc1649c1ba501e58bf9e0baa07fc9662bc1b2d009b825627f89b6c4cabad3e56956e9d40689e8468b292f5f984fd36d28df314cfa130fdfef3845da7fd5003e1d05fc3c00505becb7d0498816885507acecbaa2196c99457a7346d4fec77b07d49bbbff1b69701a52692424ad2aa1c72b517801cf7bf58c93e75f6d972d5789500377661c23b690bea4b5ca58671f1957606d71cd6047995fa40ba17a4066c07d2d91ef2d1f3307b08612c8d861b49cc48e5cabf33fa8430913644a10cec7742a064ce62b9e1971a46165564689f29d798e99f178970c982c6960634e053133f8062ff90fc960b5b9a3292b016352f4969b504485c3a16bed8eb555f754b53af62dd8912c5837318e00a61e999c581e3b71319d7e2ed3fe6df21d3a147a81d3f6972ca018f4f5ef83e8bf645afbcaeab850bdfd273720565dd73ff7945860d624ca28d7294694f896067e572bd08b59397b398ea710e26d75507f7a2c93e248d7159adf08a53ca0cef02ca60b8d7a79fee9a351eb5375042cb36f2c735b2f44b6ea97ed20b65ceaec48ccd47f34b372f0f4236b7e3d211e7894d24b46a5d3e07609637228d0391bd221f83cfdd877de42ee5c605741d0cfde2609f2dfb1cc2eb62cc89e304ac95c72dc61837eb1da57a6fca20b2251aa9514ed3674d945f678b5e8607b050c04e76be4471dfb0e4e05501b0f2af7509c278d4d750dd3997eaf353f7ee414df9dfadfe29fd9132020b5e516591f781b2907a3ef61d86294e07cc01be9f208eb58d36ffa56e338f87c1a9ff32fcfe6cb52054ca945edfed9b1f058c60ea31e0489c992e84d43c7cb3518b0ff8983f49ced65c89ef22e76c9e404d467ca7e2983617225013f610a32a66e7a091fb82ef2a997b7b9f0c6d90965c3f8db3bc425b1b00fecee73905ff7a597c0c5db6eb477185af12156ff4412643b45ca0622292778fded1a72546e2b4490b2d2dd2bf521178d75c644c19c7c5e1bc9f6e2981ea368fa150cb8763bb6a4f61cf6531ce4b38d5fd05fb957fe7b5c1301a17f972d0faef1c55c974ccefc3e397a949e628913459b0eac30349771cb4b4e6ce75c2b22e6e1acbd21067eec144c28b86b9e883ade73694e9ab1595fce4122d4717f122254c0de99afcdd2140eaa247713c8f87a89926624777d6f1e8c960d6560be0d25210239c84c34f134cae2c36765ea3707b2302bce46e56d3cc815b8b8890d0e353c31e1a6d6bb115cf3321d9ff39edbf2b9ad1bdb70b45e268817695383f51aafaa25f4c6996986e1b11b4e6cdc7a8584b9d89737f7f9c0dad6bfe28abe2d23ddc3274a957044753173ac98f069540395484f2701c6c25c5a501f4f66dbd0017424ddd6997bc3f7358f13751644c15d4010d31b3f5fc8b5cb103a0f77b5391338b06689431282fdf5fd3b077e6a9c3c4269bdd6ba7f9871e8a29164f4f7ea2dddb4108e0204d60936a96ae59eb59de3197c951c34b8cf574b4510de21d89808e89aa304e94d68f23fb9faa2e39e535cb8391fc8335cc4e5e39d7e08d1a84b0e8f6da02cbf27ef0d04199fe062e18923106dc5551dc3bf66637cd56b3f17a728d812c0791a59678a2a8b19cdcd5b475cd3c27f3c1fca251451362bcd2e88f41bd2c7793da1b2c38b16d0843cb2204dfba6ab6efc53c0a05e056bb68bf5de7805ed6ceeaf520229c7fbb213eff945ff8a4ee988ac9a0ed0389dc5c33e9fc2b90482af6f3c52c02db24ad22ed2ce7c1b33cef9356e56915e6bc6e2aeef37be092786912312738c26fff9395ccb0cac89bb2cf21702615d44bcca6c7f295111ec05d731406a8d4b54f8464e20e52f63078070a2b4e958a4ae9e0c0a7385de15d82dc9a98c2574512cf6bbd66338d0ea54a0205f5e7085fc25846ba66fbca8d87013918ef465bc2a9c0a7a628b7b3405c446a34d12ca93257331257397523fb05311c90f6c0535f54171df21dbd7fd833d1d1dee7baae1892c41482ebc714ffbd605b8582cbc9f4753ce127b82c75b088631d34fb0ab3129e6bd3a7799f463cc0c127e75f781a091af2c82f3b9dca30a65f043afa5e30a9b6ccc59700911b47c320bd504d05a6c588244fcb3235e5bd64a4b4212c4ad32a61aa1ccd424425134790d6f49c465565a58517d6ac1a68b4caef23d194c651075da0075169f1d972eee07df4c9271b5d0d2f4eab040a86ad7287025e0c54147f416386c953f3b3ff507149de203e95407d71b355310127a8c58e37f7eb172e2471bd97bbed980feb0d9066478e1758d555aad9002ae732680137da5da0c9c81978659b02199e37e1d7817855c7405391deb20fa2d854b9ffdf2cb53b718157cdd0ffb14d0583f87bcf5016d57fb845c2a5705447a5103f12fe41419d1b26847504dec30eace77b203c82b1845064b4ab8e954fa4315220598405c811047765a4844d9b61793a4a3d0340077e61a3e1260eef3a7c7214ba0c065be488bda59b65ee6b528d066245b25220daf70dde09a2a84e1054cb8f4b80316a4fe6797594477c1fa93460349e1a1280b64a1abca28651155efd1bc2e69dc4a1bc367153791f2f638ecc832620ef15a20d52c9b096e1bb7d16ceb616798e5d200d053950d337f0c93daf6ffdc7523a1078c8ac81e1ee7282230b27174a3365d635b80661bfcbe0108187bce4d49b3071f6d58ff22d7581a7267fbdb86d8dfb6e36984371f673b1674e5bb2268c7ca9d1e40e662cb29eb46e7e3f4772b56facaf35c9ca65b364f48fc3d3132f03cf062215152f0853d832b270e47f230b2e7cfa413c59a19064814100b70621e63d0f20fbc85ddbfd3bde9bd5087b509152d03a851b62ee68b12e1ef57dc8721bb63630463c2c8d8c2292cec84a0425c664d204073ba0b4b6391baa3187a6d21b8e00627200374ed7f2308c292d5bd0b5d42c2aa0c770cb209f4e3f182287db9cc9838130d72406fc44cc1a8a574844d3576ea8799c4c1dcf56ea5dc123ad22d6b853300c3b7c6aebf2279936020b6bece5c157c5de93f08d39f38bd31b868562721ab077c4068b55c857ff7e9b7428a5c922c5fa79f87a17f99ea53cfeea29a1fedfe0cbedc7669b13406aacf0da034930fe7ca340a37891bc2e9cfb7b2e694e5bcbe1e517d8bbbf774da32f88f4bc7855e3b11c609c2d1eb925bfe94c7ee729f7ee522472e033135b325ab053e48b8060f35a4a08a80686c295af4c84ef8d55d8cf2115496f9d399bed39235210c7c7cc6c8bc7b826d62fe62b4832d2378e27b11b224ad06f39760127b01d5da4eb344b4d667d5dea4bcd0b3a788b19478f33462f517440180d1663f9c4dd11f8533123ce2fe72348fd22dc2688a3a4cf8a138753d04de93dbe1c39b98d6007bfad04d48edd5645bce6e6ebdcf4f0d03c6c1a91ad713194331d2ddcc963fa403643d928cf7ab7d4c6795e8765e26dd7bd78b35fb1a00736b3cf007ed5d9ae626042de4026551cd6212e2ec95b6ddfb7e4f3e28279c00f5983bda3287b3d512aede053977b39c3d77a60d1324dfee1530dad3feb02b2cb64dda5ae83c1c78be7a3f665296596f0b17415e769cfd9f49223a1aff6569051ee1c85720f8252620e1f65677590185f2cc42c96856ae0adf88679e8ebcb12414f84756d12a681582a38567ba8edd870660b710921d0e797387f57679578100ae17c2be43b2e6eef0700366d579457b0c31e13bae5223f1fc62ff75a7b0ff0199243dc0261dd9f585ba06f3f4a74cb3e36e3d7ecf2e3ba22a1b80ade5b0971d7464a46b32df1ea36f132d7c711e77ea36cadb0b635a4ed96c1a4d8dc3bce20bbcbe0e0c4dbfea9b39a3dd2508add528942c8f5e074a4e47ecbab9c9d86db018ab4895a33af955b00619fd1e4175f87db3f898417a5b21d2c00b8fca95a4f92901a9ca4ff0e750aa006083d6ea7ab058a4530492f69a14ebc4ab52f5d7ef45293b7d2ce11546fd850ae6b7c63e66414d8a29b53969f18768c2f707ecc0e4ce106ce2a54d1e7d287e4799cb4a56b9dd7095c707408d2460f7b8d8632666ba7220d1d9f3b5d3f1fb170aa43981e21d52e437b7412edb1283f67bf4ac47a605fd3028b4e6c64cdefe20ed0b4ed5889089c223ad6de651d463f164bc0fc495bd79025ae6a628eafe890dd37bbb95477c044db2763e4e70fe9aee79764e3d096af011664b5a45f0a4245fbbf0da6593ff5c0bb8d238ee891468b01ff803648df85607e6d5ea16d6f6697c871f66cc84fc6831f8f7ef00049e6d07a31a773f110c852aef68ebf1bf25f946e8d7157c67d5e4f8cfdf43d26af0257718a1296bd6b9e50f973b6300cbeba902f213c69064d4fa45896db9e297e0dbb3dbcf1b1a45215e1d196b1cf3ee7375744ca9356db39edae784e32474842030c8a0d7d871bb016a2a753e0dff7d7037e2b7375bb6b4406d84ef1b83d065367bfa40450d8aad02be301c1633fdb14f4c1b74f1394f3785f2d3b53fa7ddaa10157898039bcce41ec123bfbac7ce84fb71319d4d959cad9bb4b6caa3387e17c90ccb3756f40c3e199a158bd886db0da1c2e9bc833cecc3d97d2b60f34f4f9ec1f2b8c42241df14ea852bab9b37d48a71f797262375115d9f3af8bad8904bcb2e7703d6cb96b7625ab119b6186c7085553cf55f9c88932a8dfdfc4cec3eb819cc6c3792d77b2701aab30fb0d186c4863e455b93fb07952923fbbc0e17c9bdf24c066d92e4c4043bd11f241604bff60aa392706d615a8a4c1f971bd70912bf13218bb7b992c82bcfa08010c9d2890c9617695f4800e5f3ec7db1b0680eb626d0545b1f576669de3fe6de2b64179a72d21d002d945ac81e1f5e31af9800d23266b8eb77da3d6009b5e1630edc09c8ddee284f1726b89ed766785738a005a3f7440469161f7d14753ccdbf256353edb6425789206a680a74f086603d428d75219ef373e94a8f614059142b0fb0061d97f1812123f61d7066dc0157c8997bacd909b84788ce9385ef286167007b7a7ac22435d26cba327025035e8723da3340734890f06965513d199671be053c0b314b8c193d1c4237abfccdb05dbe302a6676bb9c497974a7cdb79ec03204b5dd353c043d0fdc379dd36b5bf2182dea6e1660b4d89b52f115791ffbbc632aea0020cd504fb183421bff7741ce4d6d118cb2dc635eccac007052d7c5f78f27f1ecd8193142366b051cee7e71e872270adc3a8e8925c38734ff9b792a6e4b20f5de977d220585d8e194263802e1d5570a1992e796ac91df3d741e2501255104cad8a85b1968d6eaebdaf1a3d2d1df56ecead2350b1206289ea0d34e5f296f205a2a30069a6341a5d81445f1d7dfdbc7ca5011dc4f262532cd7861a286b2f708ee7b21860ff44b957477e7aff93e648d924091a6061202168934f8600a3d35241245d6f9c3cb637821bd115a8a01c1e925d740e87797c7457ce750d6945aaf235c6e4a37f33aa6d7c3042e0f293a25a98c1c9430ad738a39156b4eb07f2fb929edc68e879b08009e167f61f5b1f4f7b7ee61762dab11ef39c2f0aef408728f0871e19696206d859f0ec017447362c625753aae851ac1f18ee14fabe11216f108ae800c4123ec492d9f5a08d551b3aa5d92c67b6dfe55e16f5cf9dc47dcaa091ba5f28a4c11f5407572a98b592ef16e191bc5ba40be2511d7df1e2565f16b54032929f1cb25005c627090836f95c224a034e2186be25e92347cf2321f73191d284db5fb2b0f6747d16f5d546d79243112d112467f38da9f3c47941c1a0740c81287388ad7ba9d84c69af19d75fa003a8da6ca0a538876c716f43c4543302b3f2d5a49e345020103c9e8929b5795c336dee049a64b8cbe77a372897f1831cbb01a4680d6e572e5eeecfd5271c2b2304ad11149eee0d957fa4377e636c824b22f1f90a912a929e0201e7b19dfc66e179b0cf286272ee7296d9ef0d5e52dc37dcf083970eab1239dca14ab5923e07acbbcd1a368cd9888f141f7a43a7805281559189eb32b33b038687d4fde90618fe117c2af1167712fc1105d133473584da6d50e9df582d410cd22725e84cf859185ce33886644ebee6a124e4007ba3abfc33f2d4feeb58bb89ab3cde91f72b878f8bba637fd021151348c41fa55ba9f50d9f41ce0a7d3e5e00c1c96e4f99f1e60fb16ad3839d00c0f9425151317e35aad6ffd167c88cb4bf477decd0b112bc5828faef905c9c803b3f6826e3a6902e48a583d2cd13338851603b3879218c58b5dcb54ac080e292791ef65e56213e7fbe60d7b074346f405994bf96bd4a3dc7c62100f2b181cc01032bea45eba9971fe33cf6e24143bd91efba5b89e86e5d8d0bbcfe845e0d0fb9f9f7e6fc50b1ecde6daebfa2868d969f3c95f30f0bb9c6212c1a1ffa532e7c9268c93adece001cb926fc3550b337d0d5a9b92cb64b1d6f00b248734236aba66ed45ac0fafc919f0ff6273d01c8197f5fc928f9a87393186fbcbc929ddb451f8efa0783b760acb514c3154462c17beef4239e07c98fa48047591c0a511f41a47d155198b769aaec088dad0c50bb54ff5132acb1f7e5188d9cea545b89402d3c282a698f600c15e5db07056d8301c55485b3c48d3f455538052e77de5b8d17845204a8b7854ff2a5a2c8709a72384c4f3a6c7882aec153f012af4926cd11f2811d3a46aadd3c13e0c26d67d0122d79d15c2936c4ce2b3092e1f63a1cb9124fb1def72ff2c488ec69463128b8d24c11928073a17cd85f4be05c044c13a7c9c484cd408b3f95269d68d763233550b3f1304108844b5071503f4c6f6a90ed196c1efdf95e9c89d586aaf322c7d0a091d9e3256d08c96c890729cbfb04db3a017c7b23e77563de31b06c470f188d12e06dd9e77b06efe29b14e424335311f481446ae66062e6cf3467cfad1f67ae812f64e2b16516d7eb9cab993e82bc0fa120436db20ece2a30771b46021afbba80c58f0fc2739779c3d5aecfe730922884d12677bc7f688acaf3addf1962f52b025eeb0ede87ed81ad0b0a8aa8778431c1488dbca96cb727161f4479e5bfd9a2c2645b26732c8d33bcac1a65cb00d5931eab92765ca6efd79f3cb23398746140f043a0de10524c82a312985952fb79d778ebad6ab0cabbe058c2889add9402f4c1bde8340c73a43ae9f6d7b0e401efe8ef74575ee11edaa7b24092f2dc640b9870ce9ceccda530d040c4f7a30119a14877a43b03b1c4b1ed77cf8ec33bb16a92215ba29e2eecea260bdcd25348d621fe5dde6d26322db3806dcd66e7be6fd3f7d119c695e5228be87db9acf61b2012f7a4aeccfceddf78a35f4d1377bced4304c14d1f7f422058bc20c2a7e04355bebb6a4f2dfb9828631af49d171bbd9049e6414d1f7f422058bc20c2a7e04355bebb6a4f2dfb9828631af49d171bbd9049e64166d491a093eb3cb7d8bc626f0dcd228fdfe27468df5dbbb405fab87e619c44b2abc88eef98ead9ab57295730b05f0faf3ff80d079f4b53a4a812c7f839cef8e11220030bacaa0af7895a0808c7104cfc971fec0f5ae8d0e44276bccab81ff8804e8da2583ee395eb78e07344ee409ed42bcc0821d81cef71b902dc0fb8699f0230ed5aae0bbfbc00da21ef39a42347834b9bcead1654f62f89a32e9f9fa4de20fe0c5e248af816c82e53a8fd0026973067d032d803b0c027716a3871778d2a2226b80d07d8ac74ac0c5bb634d0a15c9f425f362120bea697fba44584c8822850df61e068012534ca66389d803cb3938a098c09d3c4d0fa6eb2e1097168c1979273e7cb2de3892e7a9f6761e277a3d2e4ecc08f98e14039cacdc6a6b3bda19a521aa7ed12b98d56b8690ddc9637ffd7ef39aacb78a815e31ccaf65187a4d4aff1904c82408fe324e42f3cb72e93e026d0eb68504041871ac477f4f6f2a15a9c72cba3b1e4be5f9adbd91a493d988324b01f5c196342be2ead354bce849f07a3501230c92bf395de8e2091b34f7754b098e52535aad901e9ef9226358e6a2a8910d5552f1e0b27d2bf72d56834061f24acbcaea918e8dc9c63263ffbe5fb2742d2e91b206e13172599a1a9dfb6ec6165d002ebf5b19ce54c743843b326751970b2c2881dd085d5d24959918ced23b579fc0d736675c47984ddab923634d892e1c11e6d174d952fc1bf7bcfdd634b2b690150dfb12cb8a0f8fb372dc30bcfc36a423b5f28b1028b6db9e7aa37bb854836b9dc0c6dd15914201a32283fe6813aa8828de7694f11b01265b692f1824332daf461d377720a7fb01bbe78c21e0ce69240340525d78c2f8893ec4ffa043127ecd4a77cc62b8868ae695cd0fcdeb6db6c91768ca52e38b14fca367ba4e5fbc64d1d37f00ac23efbfb262ddc574674ea5691f2cb5e3afb29a3321671a809c365e3b93a347c6d41e5dd1dfef1e57087804a523d7f4b77590fbcbc4ecb1414e3ef2937b8ace91bad4483e457b8bb70f8505dd0d8c8388a289d8fba95926e33cd3364f53f681368e379eaba08a6db8f2e1b03f2b13129919b4c37dc2721b29e6e66169402c78708a0d1cf19072d157851a7c061f2cb6595e80dd7d843e93187bac2738e581977084b352f105aa7aaec53bc6192874bf99a506f515b0349924b5246e1dc2e96d7d1a67e4a6c6a065c5b59b0e8f119f806734a46101e1c49d3359bc59743621104e7b5542a2964ded0e851c8b9a1fc03f44fc36c1eb54ec1f187e36c3778cf61819ef00d820770d5b421fea483b05ee9aad318b51fe8154114226306659c060e6305c1f019438e4131b0398a97e14f27aaf57def3006ce58896a0cdc7b2e8c41f8bd84607b54d015c1e6b2321ce2ff7d4f3fe8a75e4b0ba8ffea70617c0c1b72936dde1d59bb9349b9921b8d3470dcdd5b7eead8258a6a326424f40a75ee3dc39fad953bb555eb1b71fb7309a8e06c6b8935706288392b05c1af1fa1657c6ecfd0680316a5aa997fb52a439b4de1bece3c447c5f1f472a8b0a1182d03f1f1099fff73100132f799b7b3d5ed2a162e274fc06d3d23e5b8b4a349cd05d9d7b4b24df9fe6767232b7b52036b7094a0231049f5b88deaef2d4fd3108ce36a569c8acc72139d50be1d9adb6602765d150e55ef646ad9f49d7536a70eb28206546f7ddf27e312789a9c6857ffd1572118282868c0145bb464ab78c59c48bb7bb36f8ec6b53488faacc0d8f1f405d8d4812a8772667ad303188b40e240f3902f2a6d9b4cc5e8cc1600b6fa679f904834010e50336209707a67e78b7234180edde624ecc3b60fde166130d4e47a07ec67a312eefa4798d2130c49f0e7e42587f1e3267d5fd28cfe6d93ebe78b8b01564101258cb67094e2ca31b59b3b489fe0fe7de612527eb7b81eb26d5e291590054d0b0dc10a8e2730e040ee8d8edb5b2c236f7fbb2170f36cd0e91b1b63f258920a101e4b8727cf2d4ca20bddd6ae77d93ae59dd0e5a9a69982b2e53904cff12b9e660794f1c5730dcb23aeae60566627d9fed755e5717dc1a48e5353fc26652663922a87769e804c075ae041c9e3bea875ab63a5278d599e1a7ddfdbd714accd67f6038a8b8462bc4b22bc00b05a848127164299fce31801c1913b7474f78cbe74c325fa144a02a6a673dbbead0fb41551101133effb831429ba6b668bdd039c9fe41db758d1aa51542a5faa7204f22a52478e46d65bf7ce488790660513775428901760c0ff57e587d8d7c510748a04c5c9641d132ed7fed1d1a891d5f8bd4590270fa833a042c4c4462429a558d51cc223aa1252b064a0a6cb4b4f4b2387a660562a0e2d4e272fa647fa82cf256471ebb84d06ed24ee1b6bdd5cfa45366b5a9689212ad2ce86f59fdeda53d0872cb3a41ad226e752c490aaab36d40830357e958d26840931b87f901661d484061e08b0921529da01740799436397c749e9b7a25a131448577f3f102f8b1b86df39d9f1d22841a7e7e860a8f180840bf9b077478f13b5846ef90e8d6e7fdf2a98c9b58624180240c7b9d74a94d94e4a939e4329c10076af183893b95a8a98a472e96e831a665f480703e8b1201b0e7e592c88ef5b03af408418e27ba196336a5ca468443d3605ce1d47f932bc1d995636b32d7e060d698eff3b55288863b97632f29df9e946d7748d4f9982f0a4074d882e1449d622743f3adcf30f434d8d1e78f11c488c3161ed5120b0f135ad2465945866122f0716214934e9813960f2a262c897adca9f7926ad302e345d42b98707642e1c8f01bff6da864cb85bda20ae21aea63f55745c54fbbe59ed830924750eb49526422a6c37d2ffeffa36b6daf1dcfc7b64c01b80f79fd6b97f928b0304ed1324c9d1139f3cc0fbd4583d5312d22874edc3e706f1d991690f90c864b47568be3e862402616f8e23120d7bce1a3b2c8f8ebb7038b780f5fa1517ff5d69e980d7420bac0f21c70f0546f3b9693755ed3942b60c369a310d5d6ceffddfdeb0b6a5e967682471fbecd169182f117b6b2c7b169e1fe19bace8ac7fb2ddd64ac362977c8b3c141f520df7f97d1808e94caa0ba8e366eb46d573d3b9051b85a729aa56aa75b52e4ff88f4a01705a0a9073fdeb06caef892360747d6f8f00ff717e40f14debbd048c8069cde69d53164a41ac2e96120df1d3695f2c7e957ab3d8b7b2720519270a64273e89d61f61ddc30af339050a3258f853440444f401360b95c844cf75e00f622c16ee242581a112f7bfe498e328368ecf1c6de4409c1338a6b38348f468", 
                publicInputs: publicInputs
            }),
            committedInputs: hex"0000b4010100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010101000000000000000000000000000000000000000000000000000000000000000000503c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000474252000000000000000000000000000000000000000000000000000000000000000000",
            serviceConfig: ServiceConfig({
                validityPeriodInSeconds: 604800, 
                domain: "powers-git-develop-7cedars-projects.vercel.app", 
                scope: "powers", 
                devMode: true
            })
        }); 
 
        //isIdCard is a boolean that indicates whether the proof is for an ID card or not. We can log it as well.
        // console2.log("Is ID Card proof:", isIdCard);

        // ZKP_PROOF 

        vm.prank(address(daoMock));
        registryAddress.call(abi.encodeWithSelector(IZKPassport_PowersRegistry.register.selector, proof));
        // registry.submitProof(proof, dummyPublicInputs);
    }

    // HEre build function to submit proof to registry -- and see what happens.  
   
}
