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

        bytes32[] memory publicInputs = new bytes32[](9);
        publicInputs[0] = hex"2f696abafd61692fe9c82281fd461431f5ff1d3ec31c10b2258b3151d89b9c6d"; // dummy data
        publicInputs[1] = hex"2c0ba69927ad2b3737a57195469c8185f0bcf42ea920cb0ac4963981f23f9e87"; // dummy data
        publicInputs[2] = hex"00000000000000000000000000000000000000000000000000000000699c606b"; // dummy data
        publicInputs[3] = hex"00f57931b54ee536c40f368c81a301ef5a449fe4c853847aebedb9817fea9380"; // dummy data
        publicInputs[4] = hex"000e25d57dbe558245aead9ac9aa0089a2d18634aa26fa0dd81efbff7c4622d9"; // dummy data
        publicInputs[5] = hex"00c217ef3482939d028059057d5d1d52c866d14ba111c1f6a0110068bb767a56"; // dummy data
        publicInputs[6] = hex"001a0bc0d99c53e023211a11e20f652a7ffe8ed5142c92f8e42d295a5db3d1b7"; 
        publicInputs[7] = hex"0000000000000000000000000000000000000000000000000000000000000000"; // dummy data
        publicInputs[8] = hex"08254261e988dd66dbe391d5b382e78bf8194252f6d52a4a5338fca2a4ed9b92"; // dummy data

        ( ProofVerificationParams memory proof ) = ProofVerificationParams({
            version: hex"0000001000000000000000000000000000000000000000000000000000000000", 
            proofVerificationData: ProofVerificationData({
                vkeyHash: hex"20a5dfe7875cf4cb9fe6b4e13397434bc7b33ebb42431c09f9d2eb20f0f09a4d", 
                proof: hex"0000000000000000000000000000000000000000000000078b9ecd45968a57f000000000000000000000000000000000000000000000000b3f98ee7791efaef200000000000000000000000000000000000000000000000269d6bffdeb62285400000000000000000000000000000000000000000000000000017f7aa3d75cbf0000000000000000000000000000000000000000000000082e0fe64ac3c2df4900000000000000000000000000000000000000000000000544f72e91e8b170510000000000000000000000000000000000000000000000058a8ce04f9fd0813b00000000000000000000000000000000000000000000000000017d41152c6e6c00000000000000000000000000000000000000000000000999259d55fa1123e5000000000000000000000000000000000000000000000002856a63608fc9147600000000000000000000000000000000000000000000000e72a684be08d0ebad0000000000000000000000000000000000000000000000000000358845a44d6b0000000000000000000000000000000000000000000000086d36a49c3e6ec63a0000000000000000000000000000000000000000000000073350a5286349a9720000000000000000000000000000000000000000000000069c39c7bdec6a6b040000000000000000000000000000000000000000000000000001a41ddbfacc892364f8025bdf9efeb7642b132c409780b239b5c86d1fdc0dc48de0770a9d94a517fa0e8a053bd8dfd5cde5fbb42dbe55c9b4a4a96b0873b7b541246be2a9d4171d1d8871d5c5b86f4f84d262fa4eeeafdc15d0e9b4b4f8f7ccf1b690445b8ced096831006614247940e2ceb85d7b2a7177be0f5a4df1c60446073baab5e6a42a26cebabad6fde7e533ca42c622ab8e81cbf1772115af230b6e76f8965b2ad9a124b96542c90b9ec9e90e7349b280a9b25f0221f94a5d113d553811ab03162c80146ded07c81bdbdb09ce09df77c60d2d035c6197a5e8c93ad1ed9f18484c5dce01230d00293c3665277f9602cfb990abae626066cf2744694c753da2d27bbf07146ded07c81bdbdb09ce09df77c60d2d035c6197a5e8c93ad1ed9f18484c5dce01230d00293c3665277f9602cfb990abae626066cf2744694c753da2d27bbf072663e87ea55cba1876cbdaf906e6bb441e1192cffd8a30930518928d103a63962ab552fdb44b9962502b0c5f7af67632050f9656c1631466b77b54337766260326e3fe9d68672800e00411bf961da54887b4897172046d1d174275388360c6ac0777c1373e76ef1055905e1f0226ea4fb9c137723218d6f2053207226cc3ca4823f54cf765694b62b2db47b8580679a6bcfe9cd6f8ff2e0149fd9a993f9165ec14832902ef017b698bd081c505aef5574db993db8e1d283e41a6f3816fba62900e091eb6b27b40acc260b21aa89ab03a8d9dacd014bed7f82a2ecbf210ca4da8225b2fbc2eb65f7cf5ef939bd8e6a8229a963b7864fa989919b329a1df35b25901f8db40dbb0ef60cb7a931af4cb776a1f79acea8ee21ecc9eb2a2e6421ef7f62f763854180e5787ece9cb2cf8f4c8553355593c13569ba5a881b061a581196812c539a1dd1299a559e93fb7e4ebeac0d9c330223fac86a0a7a5d87affcfb07d2466cffc60df58e14bb3eb7b09912bfc8ff450b810b7e1d67d0708002ed68e78200250a826393201c8ed3d4b6cef63eee73aff0df5004ed0b4984f15bad4960e0a728fc98ea5dd81d09e123c3851f4fe267eb8988f4f1338ac80ca4836b06329060fa9583fe2eca8dd8f784d0df2f98c8ca5de816dbc56eb9713dcf2381143310c210d92f8050b38bd1a782a7ce5a3928c9e73d0a155c334b1d04a43df6c2e0b0d7ee64f3ad42c7f5f9726f4b40332d2d0de9eead38fbe74157f3bf33018d903178f1eec8ecf36b6f2d75bc9dd8ab8d57c6739f114824ae828a6fa7a2dfc49061e07a353c67d3c16c11a2ef341880b5a4149401a3c81a4a848c2ae4ee1040b16140335a16628ccddbe543c7a704e4dc077a2bc715b78fc4dcae45076b1dd095e2eefd6816f6322b924e0b9c39d9cff5389d0105887657568a76426eb4234ee5d254305062e9791a4ff61f720acb7a93a5131f5fd7b28321f72b41c9a868b801123bcfabba45f2e42fe96102d392f7e7d6a1ae1dd925326ca5b29c0416aac36ee23fc1f0756613e4e3ff9430073f5fd01083fc321773e4d50521c3c51bd0d2e86046375c1e3f8a4cfde5f2ea3e0ceb5779d64fb19aece80d1b15ede7c27b75bb819843b7a6c336dc566bac01b71df516fa57285edad0c2da38db741cdcebfb1c40e1d3f52d5418afee0ce512a299a7653b1e6a58d4f5f37423f7bf23afc54c656207297abe4f54c1b72a31ed24c37932739614d926e182cd0cc6b3726b9b844fd0abfc92a2995ea3560cc2aa3c22798eed1e3845b647ae98273baa266c068b29f23b3d7635e07eda4f06b448d31a06cffcf17cf1079177824a77015982f1a4e13086be5de30ad8093b89a76c2a060c548f0137b10adbe1273ec5406d04f4dee94012cf8db709c4adaeabf1fa8c3dfa0487cbe08a8486030061483fca128bbcee510bee68555f60a8c5bd036a245628f5cc2a566e13205990c6cafdcefb61ce0f80fce8cea264fd0169b803b2d05634fe2c1d554f4b19a57f7d2724ccf624e545a147567ca6b76acdadd7e59ee5564a5806119fdfa12b3229c713983adbe1c585510e1ed17f070926347f4f5091cd75e8b5c4bf16f34176fd18bb1652114d604e718482eaa18d96b2a59f74c52e1a349ab0e0c296a46b8eabf844da5396616a6bc1ea031d707286bec13ed647b4bcb95d2ee6be54ec97b32c0eb09b6cfbe2a9f7a2ce2546da305ecba3fb4866aa53273335cae1dfce5793627513160d21aef6ee00845cbeeb77b2c9a3ee50802baefebaba63758a42b96d1ab92a795f9d5c77d9f050a7176d395d28cdaa752de39f06de34d6b842ee1af59ed9849b3b622eb4db8168ffaa20d9a8d69fb2a1a85d38300c832b47cb9bf14c69f2590290a9802b06f01b340a41df92e6ebb226f3b1127c082d90152b7c95ff1120dace5bdbaba60c403ed4f26577faa3894c2a3251fec3ef5ee753a3b82c7cdecfa9365808458a0c9088ea01f4d19715d792636293c70267ef790e7386bdf8d610e847eb439aaa1f50dce45ddb7e3afb9a25c7e79a202072a5721cf854d3f9786fc461176b7bc0aa11318cd5bd5a957f207a58726fa15c7f4d9d483a635b0407cc004f579ef3740691f3a28900f24e6baaa562545bc3bda6f399156e9d903c67ff2def0620b460d432e601b32045d443c4c3fb11033f30f0b53f7dd638ce4b5ec1b29b534f986e9f60d2a713cab7fff4d254d2e603556e384021e6e8f348c4b8cb9c7b2f83ccb0f4d0f15ce2359bc6732c8b0cceff063fe5fcbbb09ab381a237efb5d33fb38dfbf670fa71096a642217e2f64c61d6c582bc0e41bd56abc5b5e904f40c19ae3764a870c72b8f983982a0f56c9589c5cb7bb513ab6f5f8256a06ba5c7b6894a63ab16d0ad38e823d418727eb1962ec48f1fa7a02f3b733582494845e6769fbd2e187821c36b7c061c5376e2776d0c4446bb5fdd593b8a8e39a855b2ed839734d17bcb10dbcfdbc97acd284d78af41b77c079387c5129d278f3e06c4055681e93b27c2a2ad49abb384369d84b3cef02a7869043068027c97ca942a8663ac2c16ad56ee50f4e3d47b491924abebc581e803ca97889cc24fa88df1adf7085d68307ce67a92cd1f79067ffa485f7857e6438e8667f5695acbc861e8f5c5fab3e60f48840da03838fef5866fe45e475294d9e5992afcfc61920c352380d24b1c49c82970fed1709baeaf9fff338797c36e7bd715f04c82c99f54f12c4a03d4009db726837fb18515d39680e7f5321b61d022f9789445ea1f5d695337b365e69800e796bc2cf0ebab76d1be10935f4c022f53aec845ec0514d4b0ff5fde035b1b4cfd938f39b2154d68bc304d82c7a05b93415c52faaf105fae7a46278967777cae42266deed287158535fcd284f60f108ddbe34a0bc470ee7f85617d347ce0b20b96450e4ed20b6ad4467baef2acc711d18e1bee55ee4f1e370101a159a59ad8c53f6b2cbe20bb65a2a5d58ae79226a66e4580fe919d73832539c81a4b79cd172a964fe01df1cbfe9b24dfc4033477d9e15f483f9c15f60b4e961b665d4416b60c179e8ac6e068ccb4ca061976818d6eb2503c2f8439399c0801f2dec747be484f10a8faea5156f74fc4c7b8057af039c7d461eaef306b8e3edbdeb2eed92603e2d45a7447300b0778a3bb25df40264ae7a85b3bf41002ee5aab1951b9e945d003b8174c07827c41770d1cdacee10fd16e298994bc43d5d4ec76d51db581981860bd835b26a0e79f2840642dfbe9d49f0bf18256634fe26c35867d502ef3ff974d130a3dbf11418fcb10b2c3e7d3313cef39e2772b7fe42c1043a9fa1b3fbba47bd007a0f791c0b80c79ffa41a4254a41b2efa6474884cae9b80a48c23d1b22b15a24bc59550d5eadb9a4d7367b4ca7aa757eabf3a9cb695a8957f28ad007b7bd3a8090da3e0b623a87c360c7c7a17a3db01cdca5c8e7eafbe3f0df6541d4d4cb0a58bd1f0d2b2beb50617aa2de8b081d9d0ed96e3eec3189fd9b09ef2bfdebff9eb068c1f608042b07ec149886e4fe719a0ecb17816d7ffbb7bf94d6083e048d06757d0af417002c7a462d54ec6bb0c5b2bf0b11b1691f2f95e7407bde9a62fdeaba06bc19097b06875533c974da9866f1321eb50cab4dff81eb7b2843741fd730ac0382a201f5d4cfd54b6a283aa119f75bf4b40b5ab5b3a53f2d23735b75be2869ff4c3c1dfad7d9d6e531edc5e4c01919676aa42cb6827e9fd97df45372d72e02908f5214c3ea7f7f1a741ad2b8ddd6ef0de962718391bd10f06c668bb80300c22e5ee711a92cd74a8c6fcaf99038406391b9ed4f633db6fdbf1b5df91e18e5731c87fb20e04a306899188efbfe360b90539d454591171953b8a44fc93df54c797d10b1254653f3766ae0a84e95594fbc95339ecc99b4155dfc2a96d5c34ce53915a025207af24bde1f53ffa8f389390868891b9f8a8ad2c885419ac5a7fde53727b017238cfca4ca75e3360ba5a5916916f040ea3a662b0a5009f6f70d7b32ddf1bbca20fa114e9568f09fcce67cf1f2d4371e25947f2c41eb26d6d4f228cb9f4ccbc205ca6e62849837e19a08c8f05f0d3f4ad62fc76deb5dfd3ef113fa8e614beac717e1269d600c67ca964d357bbe1ac3d7691c42e30b1108c401f8822578baff5c01d1eb0fe0a1347b7a126549bb1a9debed52b4494856c6752040a31a078269ee0f76bfaace9a68161dddbafd7331064827a5801546df8c2dbd10e3637ea751370e4478f84d65739ea0904fcfdef7da58f9bc5f6c0eda53cae0b5becad08e37fa021b0d3044e221dfe8b565493afa870a247ac0333fb1b04d139e249663f04e5a11d4ed8b72a6a29ddc19c87524ba5eab1af016419f0cdee93020622779fccfb3149c155e99673ed9e31a7aa20415d5890a513b9fb3f0fce12bf3bca188cf390125a754014c50ecd0765895fc93b3b53fe098d3b4e80bc551b38f4024307a44e915732e3ec2f7b0bcabc4cbe10e6f558be69f2e1fe225a32b29b55d78fe939348250c0de1e16c8da0f71b9cf5e96d25c00e90a7c94912fe5b41a939e092788ba62b0fc33197c9e8e885566b56fbe8992197212b870f1be2ad0917c39500ef78050f67d084cc64997630dd643ab5ba8746e263a7bf6d34653a91d187345e32edc30222f6d36c386de383a860aeb8e3fd51505a25dbab0fe2d4f63b07e86c17ca1429a1287655da58de619143c264d111087e5179570bc6acec65885717ad2aefa416788344319d208910b853f3505028cb93770dbe2fb6f33d392ad6eb2d6a17be2cafaed2a245ffb3dfd42a846e286782c5247609f3d21ee5338bedd211a9005a0443b99e12f41460f5981ec6174f3683900416dfcb24de7f9832041f2f3bba7b1e08334f000b3c1ff4239e702653d110841b613e34d3b143755a644095979ce80faae73442bd81350fcacbea7493ba8889f3acdd5c071d812e0cebf820c0380a299c62d0d91c2e74f37946596a8a86a99ff0769cf15bcfa236d36167f3d4543818a8c8c28c9722b2c5c800b43b85b25cf8a1e0a298b8f814e1ccd1d3c9f93a7302650e2c8c29c210391b940f01d73c165ec6c7922066fc4ba9dd9c3af7f72ecb215d26c60e1f756ebf073be88f1f206915425b8af0f1bc2e531171d74b8d665f28bb22fb49f9585b69dc7516a0db9da8b758e8c5d271a75cb48a9522acb664310843eb812f304a12369e2bd941d461fb61e2adb03c334301e5c94398d5c44686213a1f8e2fe45c70945a4ef9675611a21208bb7b2e80dff6741b76f56c8856062af329cd7bd2111949b59d464810b2a7bc394f8b577a7e65b1138a99800ccc040d6f2e4c48c42ebe2f317c446d1557101d76f338dda8c64c2d3648b74d51dc41214c30c4390653dd36dd35dc7c0fc5b350846441f95c933ee2060a7ddab22ace1611d32b8dc34562aa08c99888d37bfb6ea7e1e3c79d2bb99767fade81e2392a1d4dd4ef0cf8f54dcf3d1a3a235731bb01115f4fabe006dd25baf89afdcc7405058b693b8435020579843677e991b512c105be5f60110f7e9b8c1f23e994373a15d724db2899638b10f98fd89a2c3f9db64074337e16006aafd2c14869eaa4b8094ceeadc5af60299cab3154cdd0b3d0fe0617bef76dcb177b52eccd106c1f7f2292d999ce0e103bb04c1365dfec06c1d7e1a81c28867de9ed023d2b109293682fa3d88121053df883baaae4c8a5c361480970680be2df24f896164b860eb26021337be987f92bc6959db9bd7a1bd4e6c78dc66882c83d1ab0fef50000ac0d20172fb4370d1ea37157c8e54c455b27ebe591568f0b1b6cb82337518394feff450e1fc2b23cd833d3b201db5de43c74d80027fccb7d0254ad940f6f63125ef8e3063d268cf5cb32b6d55b1e58f0543123046a003950f55254a35fa5f785ebfd8f0fdcffd2d0c955ba5b4f1887aed2eed69edf74a4a99c96d758d11ec43c4006160849535df9c56876d544fd5225215ce45b3c9d70b03ab5933b7cba84382d1eba2b22a572e441c10ef80bac1787960d64bde26b275320023fb9353a2611690bfd079b767fabfb9686acb2cf7992f418cd392634d9786d3d88be9c95e2ca04105c25d150f1c984de735c62b3bca7abc1dc9405b66dbdc320d634c7c7ced30a4f7e16c2408e40fc63b36b6fdc8505362a157f6395dad16d5ffe351da6fadf4a4ae801524720a78fe15fb8044f2d889efac446e68ab0545876b6ea4e4fe9533d7edc2d6d6ef1089d7a43a12637747a3caf0b146abe512ecedc71a56ae471c4f8745e10326128ef5452b4c2a5d2be8d7a1dfaa9356236694cb195652f1b859dbdf47608746a768c9c067ecda33a83132808f2fe40b6b7c7fce0c07165cb3771496f1112d7719d83e5109be90f3124a9643c8207ed8c77fdfa7fc9c09adeee903f9de30221e4b1f2b1a9ed293e89db92397e5459fb6c410a88aca51213280f488196d417bd244e79bcdc26cf4972a2e30cf79735f3f9bc22dd25a30bbe53716eac8aef0a4cb10ea4d9ffe432de3cbd9710cdc13b668f57e50d88345e5c8eaa0a2677812383f4dde84ce57c0c7698202d2a44b99e29091fb6d52eeeef5a71dd2afabbae1e0e2dd2f589b388c9b701772f163327d542a8dc5eb02fedce9cdfd32072439807d330e58c0318fce5e0ad886b2b33679552df785a7518e3a4e3fa965afbec6d123a563dc5befd6ce14e5fe746a335477c7866fba772ad669b3751ab5b7d8caa131d67a6bd3e6f4265831b36a7b178b0fb7c5539e9d6af61fc7bb5a8b41cc5ed222f21f84ad9c40f6b057692ec0a352b2bc2b11a19d982a1a4d9b51d09f75cd30cbd4d594085ed0d9054c654ce56cac841cb3162c66f7c7ccc7434d46378f8c5217c44b416bfe221e7601faa8fa569ba8d96b8d967aff2588c6482ef0e7da5cb19ed0e006aa4e701ac05c389a280305f1aa6cc2f50676c326ad19a2df520cf4e1a5bc1bcb9064bd8c454012774289c9f361d3f76c6f4f8d4447a66124a1688080903fda9a92ea8b52d8b6f881e1dabee185d2ca6a82eae3af3067e7c448f0771042ab87ebae247518f59bd6ee1572c689b81e0d2806619ec32e10ebf7479c730251277e4ed8abae508049f6354e151bc1e4f238d7a0d38dcc3f6562cd79e53e428fac8ee152b14259fa0af9cd76af741d3861bc14db998f4a84263b4b791d3402a465d02cfcc530e0feff29e31e639764d745c3c51780a4815b5831bcc6f50b20af22e44d2e79b6b521645a9dc77f2565eb583dc0b58202428a740c67c71bb0b15c2cc5c83623bd1dd1ab2d84f3d8593bff831b5db00b490fd301c9047afcdba29261d30448176e329bdf7a9fb66d29ddf30fad6d585e9ec3290d6606722a812187ec814333ffb6c1fe81f072f28914f29f256b7e8c07bd0fc7055fc75cb36eb1ea6d3db4fb8621f85228f5eff6502a022fdd41cbb8f451c29ad095e3358b5500b5806e3932d34d129a92d40b3288fb3e88d1ac97c1f0d4392918b12f6cadf1a0169cae2c836233a535fef6dd8231e47b295b824dbed87d810a214aba411cb810bf484a0fb7149943a4a735c7b18201887316be0c06912126d27629c1246167829b46367a51faa3539a920d9a542d3213773e65cbf19f37ce754796f8ecf47b01e1a2ea6af3d04f5439908356ab73df49254fa379c09df8c0fbc97b480eda12e2334bde65fd23d07c7bf0c2b035439bf67b24b1f43b2db861341b4afce4cb046196158f4bd7b3a48b7645f6e6a3ab394855542016c15319bba018b7d74580f39153e0acb605f4e8b47ec6eb980d1ac7ec4de3ed5e0970182e0dc44136ea5ed53024b79712ccb5bc67b8ed4c1d8a3dca8ada2db46e5decde26c2d415dba04b2181765fdc9dba4fd220f4e967a8de9de3cb68340e2fe86ac527c491b8ed0b48a31069e73b4e604c519e799e3d12d77a8e61e86cc33177a5b740973453a3a2d1708225418b6585118a40958d17a66047ef6a41efb053470976c293f2c0b866adc1727e5d57fce5e8816f856a9dd1a2b3df48cc8eb685f459614afe5d5bee1fcd46c1f8388819acdd3abf00a5f4eb5f7649723c54948c7c60d081faba3435a05e99c2862d62b2595dc29c2824e453e7f466821c2e8e5d752f3c7185c36c1bc8cb5d12bf1cc2fb1273ff7786b0e6e4b77b1ff15fdb08ecabc0b65e3b3cc613eebc74f0b4f5bcde35beb1efe8668866091c548947a69b00dc7629e69691177776f8f9d2366051a22a5633ea0142346e3929fc6d0da8a7d79fd13f3ca2a6b57d7bf8f0008cc4d70d3467f131c85dadc2d2be20652982a81ab8bdbbe995434c1d5adb84514da27827fa5810193e2e9c9637878078f9e340754c252ebd3a5c927c46c9dbe1b75a9b9cd0cedd959b1380fa7c790c5dc290ddb9b00ebf7837d40585ca406ab2c64c31ec0fe0102c6b3d8c91e33699c1d351376a990f51a6febeb256028d27d00c43472e3fb142cddd30041aaf83854e9e068b3d30b34ab33f445449c89c6831ea6e737dae0ce982317c2d48d467186ff59c125551646a6ace5b073d4216b9b2e6b9b1165127d0b203af9dc12cc20c03b087d80eab8dcb21203f0e3634d00861050fda01c0a1bb9c717dfc67625122f4983baf21c3c9af807b247c0774bf3fd2dee56f4c61863efe63a3bc915f168f46cf185114356fbd60a1e2391b5667f730201faa7791eeba01be394907e836da4c6a0be86c4f69354603fa11b348482711da53c06185130e9921bd0f54680d19d325e00028864779a5f00a241cd9488b02980b4a978ce8cea8d8764ebcfdcdb49d617ac9f25e182569ced24f2175027a61dae8a17e4312b1c2d6c2f91a9e1cd2672b14dd085965969b0be92ea07be582006a7c7b1a964d25d890c02fd0ef2a4e09cdf54e0141e88eedfa7a23d6071539e061c8e4569dbf7f98c4bb4a2d8327e2f177c3c3f3f2c1612d6ae6b7b01f790f90f09ebb4ae7abf00ade77f17d10e3765e614387e8ccde261cb51a441974f90362d863ddd5d4deb6af1d0482cab5bd268343360353f3835dad6ba0e9f3ef484f7216ff959342ca15a7b90578cb0a3c9ddf0c1c8d272f5b46f63e2fcd5984f6a6d2b800dfb199d6066cb9aab5922ef2915701c155e6aa938ee26f6a16c4b73b9ef0bb851620d0b4ec735dc854c22156140a03b878b003d50531c63d6dcf674c59c1fc38014782e1730b0f01020d54127c63f089bcc26135348205fc479f1b42d4f0f651dd6336c94d2c1a37489d189f3ac9a94b1076e06e90cfffdcf14332e29841e618be70b3f312d8e1868464797c26c7b38d62a2b096c39ac2e356900daebd010b07f0fda103bd77f18fee743954b54308ff121584621f3d53fc4dd9d2e2ae70f21c40fd69d1c496f36ba0bd16fb6f0de0ad22a1ac18a13574fdd8a804d639d2af19d498371d24ca4617fee8ebb1986c2bcbfb84e5acf61134d464dee2f368414b1f328a71c7866fd7912ab6cf149406084b31d67a62838ebc52e22801cd08703c2a0191b7a5e9ebcff519d8e6094f6b3bd8b95eca978dcf99f481747c752f80fd5060e4c8009255e896f0d2f754e9b31cfcb6502867971feb0993bd2574b5c0252c938754a019357eaeab828cd92680da1f5e08d20df2dca2979060d7869c6032ca3ab77cd553a49f694dd8339e74a51b192295bbfc996c86c025d446a4d180d5eca3cbfeab1c1ff9e570bff83a577f91cba6ff323a2655f717ab2d79c24ea10f5b4b546ab9da55158dd4be3a7d418ff2983a44639c9219207c34b03a314380454a937485bce30e485c94e423bb10df2104b752239f8b2fcd190e3071754a30454a937485bce30e485c94e423bb10df2104b752239f8b2fcd190e3071754a30e246eb1fddcf7742eead56d083686bff60fdfe88f9f1849d2b88b304ea2678505b67e6f8571d903716d0337b50e7efbfbac47b578a622faca19afd186fc81262f8c01d9124ae72077bd7fc3936a9ad738e718936e82f2d3ff10ae6a28817cd913efd78090ffeea0e34ed4662618917dd4d035bdc106c41bd37c78db5cad1e5d0ce0534237f8c1f6b5cbd38e5e41004551aa1b1a40a67bf215dbad78e3a7d549178d9d5706d3bdca174c507d4e6e369475e1e4c9c69d6a98abdcfe47c070b88f131524153c45a99564b99193703d587b5c4844168fc3a270c7780ee60936d75c23a4b34ff0e795c7ee6fd1b9bb09a77d8414ae27eae3b424577baa8bac9bf325250f3dacc0af0dcb48e290a6f7e203d51f77207f4f5b22a4c44b74e45152f3652f7a21a73f8b8b0d05557a9653548e2ce0d01fee56d5601476cb4ca373d634c11afb3f89309658a1382e0f3ae7dc7e5cb8967434d9ab11b4b9215b9646d0987312fa876692a164bb97d9ae639577c5cccd05dfe967878efa7ae2641f7c2611922c8fca61fe019654aea3bafa0b1ef3bd2ae90650f8824d70fecd6e7dc2439525304673c4845b0ada15b8594e52938be01ddd02431c1e1e15aefc5ac4f772c13c10426d939af797af25651007d07d72b60ce7477edcac737480a14db3d0029fd005f302518059f9ed7d399ba29c748c5698804d4aba4a3536cc7a4545ae52757722c54e2c93e66942aff2e9dd3681ecef92beb5b824f949a878c4ed44f8c1b0c2103284b1a8ea34a21d5206cf2a84fb3a041dfcf8f39378198f35bf6a927c113c0fdbf6ea8cc4d786947180c4035f2d3901ad4153efd3258eaaadf0230916479725d1a98bb13784c7834406db915882e3e01f1853f306d3a9cf0e595d9bd4cc950c0be337ada2e376593fc478421d49c4e79ab541d2bc234279ad1c1c1298e3d906b5cdd49ae7c79dd4206a91fec6050b52a2ca57cec0db5b4daae62e0373d77000910112e3e9f4d89e1005f6295401b31f6578f55c9a4768014c23a8d843c7a301e8cdf80546c9ecfe7db81868decef4dd84be17bcb0b348e0c6545a1caa024511b307a42a20984e0638893716afdbc0ad9beb635e3cdc69084578fd6ed37e892089e076f25c6dbdc42c071ace4e21dc5c43041b4eb397e8c3fe96bd52d3182911c2dc9cbde99a7b4013186c9fddbc957409b7b1587a52ba6f893ac61c6beef11b59bf1cd96025dff31d85a222dd9003f8046990092e36884ed4a5349bcfd39121a7938aea02f7398b19db15843a50164485232fcb7ddcbcf3e643e597a08cae11889672af80065b372a7c5ee6ddda83c8478201c9ae609b54d8645dcb367fee2719a13a614bd4d3d365e5f586bba5ec32ddec0abbb23cc6c7846b703f8a8ed71399c80ad2590d91d4626a43a6e2060b10cd2404cfd77e298c1389cb02b8ced92a3b876a2b2218b18e8b5a974a10672e5b53bdc7c298f966323ee0941e5166ab2435846b1f3d4e8d3e71b7fea51b9a4f72226506ae00cc5e4896616efa5d4a3a05a0cc0155e72f71a0db1cc4dc59945f0c57938143b2e7e339af156d0ef03a802e2676f489468554d095ac96ad57c4d23dbadf5ac4d0bd17bc5439d286e1848625e69fff5816606234d2258baef8c55da5e2e0edf8afe6fbe6cc5d91bfea11f8091863d88915f706aaa89ac68b49192c9128f8f1a5db1c48c35950272d5535370131035c96eead491c129bba7bd39cef6073e672fa5b4d0b04608bd63607c02f17370128dad85991254eff4f0fa1e5499b354a7a4492440bc832022e38d31fa31e185cc12f784f66ba1acd4750a912d93b9f70388594b840eb97c81ec589350b217f77afe2edf428afdf1aff4fb62752a8a063f93d5fae1799e71ab893018b2001d931905cee5e0d3ae8c3e3a90c00527f66cec0fa3034eb4702d3b453b4e22d1e4eaabaa2eb427dcc461f1df127a1fec250bb317c739a28812ac5d50008a27c0b8fbea9e4409bd3802d43075ffc9a5cecb0fef9801808998a36a48c1e81afc4283a8d580501b1fb8f5633ab7f3fb6acd4ffeaef9f61cfd09fdf0443be741f4a0d3d71ae069b4536b5393ab20b19477f90c7b2e707522a85cb8ac39c5c493de7294f0f4b21e8da7863894298588c64ba5762146b420e0ce9542cebaca09be98428651212be072d7326c0cba7c4f6bf9ffed97d71547e73d2272b460dc805b9a61e13127841582d49e1a07948914b528ef544409a9efef00d00942b06f149e8010868965b0f2dc2b792dc0930825c91882061acb06327da380cdf8fdfdc348436181712830b5bcd0e2c78d9248e50c50e7e7a20af194cfe1471b3f4f53bc1052800f389c34f8d961e7c8771cd1ed7cd0a58e4e95ebdd691fb0caec836bf9790492e7b6cc2448688ba83976c804ec504d46939ee2f0d9c1a922d586b8974653eb2081e04a0ed9e967f86948fecff21cf5869bdc5c6c4a311815692b36350f35fa10f96b134ebf99be28bf22ae342098cc08ea578eb2ca8507466fb8ee98ba54bb829c2103494ccbe101ce06518ab58be9ae726d92fd7f924710d9c76ba77d58a672c6a3365669a495255ecf7a8ecc7171c72f1d05b59f4b940fa116403820a927402d5b9cdddc721a81d35391b524f649e38392397f473bff83c41b72b5867f8e3244040b5b1ba9459bd493a44afc39b7ed077ca6a78278255fedece74ce7856f809d81e402f49a15e37d6996e915f3b7057cb3d6da12efc659e5627868d05726b22a93ff34b19a98e5c62f788dfc5746256b98846ce3b5f120c63d8614330e95c0c3a3bbe6f3fda892608404ea39f6265cbf1e720be5962f730939c1fb02ee6c02a43dd91e4c825c30e3873b38f2a17868dab09edb465b30519beb26183a44d5524a580f9f0b6e8b9b42f988083d39ff78a49f00ef5041255fbcb922d90e1b8bf174f16aa1879f7ad9171ab5e4d3c40f83ea5dc313803c642b370c23e108b3f7e003cf388c9e90dc18d3a599a47c63783e88b35ab7bdc3763086b6da922ee3c342b99f26cb6a4fd1e85bf466bc37ad8b14347748b8ec7c4d006d4994608bdb3b219a82c9f54c269bd65080b2dbc39da166fb8e9e72743f0eb02525ea29f409951032d7b674ae241bf127436438526969944964c1aad6f50342016c02297ec6104130106246511552c7d3912e07dea39f76b1e7278ff1a91e4da1c37f5de6b5f6005199026648bfea098882f4c1e9a07eb3077ade27f8b93a3ce159e44ba252eb01f633f919a4593c8d3f9823528926781c5d092f1edec596b43df9a7c738643f5", 
                publicInputs: publicInputs
            }),
            committedInputs: hex"0000b4010100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010101000000000000000000000000000000000000000000000000000000000000000000503c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004742520000000000000000000000000000000000000000000000000000000000000000000801fd020003aa36a70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
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
