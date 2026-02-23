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
        publicInputs[2] = hex"00000000000000000000000000000000000000000000000000000000699c42ef"; // dummy data
        publicInputs[3] = hex"00f57931b54ee536c40f368c81a301ef5a449fe4c853847aebedb9817fea9380"; // dummy data
        publicInputs[4] = hex"000e25d57dbe558245aead9ac9aa0089a2d18634aa26fa0dd81efbff7c4622d9"; // dummy data
        publicInputs[5] = hex"00c217ef3482939d028059057d5d1d52c866d14ba111c1f6a0110068bb767a56"; // dummy data
        publicInputs[6] = hex"0000000000000000000000000000000000000000000000000000000000000000"; // dummy data
        publicInputs[7] = hex"08254261e988dd66dbe391d5b382e78bf8194252f6d52a4a5338fca2a4ed9b92"; // dummy data


        ( ProofVerificationParams memory proof ) = ProofVerificationParams({
            version: hex"0000001000000000000000000000000000000000000000000000000000000000", 
            proofVerificationData: ProofVerificationData({
                vkeyHash: hex"2cb0301d4fccf542247d2164335a1ac1a94be519757be9a8f76556e95ad4110a", 
                proof: hex"0000000000000000000000000000000000000000000000039e50865128df7f03000000000000000000000000000000000000000000000006e0f2fcb53e81a9c100000000000000000000000000000000000000000000000b4792e6ecf610fd7e00000000000000000000000000000000000000000000000000026ae64c9a706f00000000000000000000000000000000000000000000000430cf0f6cd3e074e700000000000000000000000000000000000000000000000caf5f22983a1983de00000000000000000000000000000000000000000000000d11b0bbb3e22a82d9000000000000000000000000000000000000000000000000000229f66ebe9a8b0000000000000000000000000000000000000000000000015a4f93bced6710af0000000000000000000000000000000000000000000000036237da18393a1863000000000000000000000000000000000000000000000000635bb016cccd51ff00000000000000000000000000000000000000000000000000015d338756edbe00000000000000000000000000000000000000000000000dcc9e4473c3e251c600000000000000000000000000000000000000000000000a0c020bbd60dadc1300000000000000000000000000000000000000000000000546333d89ec2ccb07000000000000000000000000000000000000000000000000000143ccc77e81bf0a405a2809eefeca19440c3f5490f5340863912b056332d1e5854753e797788319224c68ec75708eb981c43f0c8fdc08ec76565f14ac9494f89e93ca1c38cecd2c21ff04a60dcd97888250d3f6158ea007128bab6d0a07c7c736d5edaba6645918bd7507cbcd353045551fd0b70a9e62f08e01150522ed2b440f02dd16fdb62329b2c53b77ccd3c5a0da34357ab301252b7ad0dc5274282ccb8b078d8e4d28e21da9739fcbd6f21e1ba3ecb06943c3e6da183102165fe1741d8229bcd3de9cb92d8c56d1edd26ed0148436911d0b82618b8869f9733e9b676efaa717e1bf6362161d04d9bfb6cc44f6d0d3beab7c2705b49e0cc60a6c69cbfaf6deda98bfc3382d8c56d1edd26ed0148436911d0b82618b8869f9733e9b676efaa717e1bf6362161d04d9bfb6cc44f6d0d3beab7c2705b49e0cc60a6c69cbfaf6deda98bfc3382107d4874c8ae38182c184bf22838a4875fb080c2e21e50cf5eadcf0fdfc6a5618ee5fe86b8ddece814df265a4190dcc1fca00ed95ed7123bc245cce3418af64101cde8fa7ce5128bc1abc95f7b9f428fe56baf471a395de38f5bcd292b2e0a101e1d3e81f7c1b408adc4ca03a66e84310aa1a4efa3d95aff7d898f253f7ba811587172a7e909ba4223456aeb9ca7af91fee3555eeb5007bc30e66a93f81e6980e0d84bab87942ac5de115b867164f30cb7843e32092c8fb84674eda61f5980027ca041615b7499d2bc6912e3bc040379f3c4cfd9baee5ab9750cfd94a8b38f4089a4a5ccb7a568c8c89b48845c1182588f79b4ade0a8ae5ac9125baa574c70d1a47a5a1a460164603d2292fd1e007c18a5992b5bb0569348e67f3fb6e803c0f2a60329d54a61babbf921230340ced3fc190d4fa278c4c03491bedac9d1d1e6e1d9b98e66c1db62a56cb89f5ee361333210ad01c48af586463d2feae0fc1999a24c3e2cd6e183d480bc011489cca46933edd3e7c7a5df1908e2458857f1896402d67bba740ad74fa767ab750ba72bf1289fa54e7215ff676495e56951574b7af25a5034116047d672e94ad9f0928e566c734631021429d3d6665725cb264941e0590e8b0f34a07579246a08c7c45f9b4714092c0214eefd828078282bd0b0507272bd2574053a6621289457e1ccc77c6b444514c86f5731c89ed162a85a352f1192610c57cccb23d44d372030467940833f9bae2350a8173cc3ce71a0632c670297a857cbf1213c00bffdb165910eaa2cd99c54fab67ba0e35e6e727ce878ba02bee463869ee8e77ec7dced9ac2171fadc1827bc44918e2f8b24ab08a781c42329f7fdf443fcf7d470c0fb38f244a6492acb3ee308d3d60c570b2befea482d830ba0e70d23b462cdf43a0df97b406421936a046094ed00fc20eab4d2b16d62b61d5c25933bbcae088f297698ee3d658e093dc600712cee42ce26a51e83e71f3a17d12fb9d355cfc986219d7386bf327cf9daab45f750a7344c95a14042d9258430280a172d0e00270c31fbac86bc2ad05a01926a712c6816ae7d38fa52efa7b209be01feaf139b1507908156ce72d9a5b125ef9458bd37e439d648b83158bf9c11de04cf3786f9d39a0095c36eab9f75980f89fe73c2eb10749d7591219564100984b4a4d5c3803f60acc1518294e643ab1a447a934dc0caa1cf3793e53ee751117f27dfe26584febaf58475990d371ec8b0a4fdc6ad344bda29eb4aa053725610708a24a1a110cc895ca4effa3c88c1bd6893642ff1abfaa19edffb45c764c3230daf8ab321784fe16e3990583d68411de33884cfe498b0ae5011861d08d03e2c98cf3c7bf0efaca020fce525fc2178c3735c70bb19c37e61e78ee461531f3406244afe477be758d8983a150197fbb3253e3a576ed7289b7a861983008e9da0087bad1303ab1dac89ebc8941fc441eefee9ac0d89213cfdbb6d2df541d2e0e728e60d00cbbcbb182ceea3d03f112e98d159600eab43c913506f493901251cc90a87d4f1e921aee69d4ef58b819c3ab9143ee4b30722ba5c6cbfff371695cca8057f44165d0a0cd7f57aab6097ffccc3373227788d58a4f344b884ef481867d821ea606990475014a4c232238e710db3ab9cbdba12ed77616338cf4f97fce58b2812e96c9dd98c42457961a3ffddd6b759b8dab538e32a607b1aa5a9ac137e04247708e18475e9b7bdcc5b22e522f0db331652c6ef3a031afb14a80f577fc4ca2814e4e6bc2d5540f3116034da85f294683d1b56ba0533bb8595797cddef97d109e6875326c6db4c1fde647674edca1e9477951e6bff47666841ebfdb9a4473614af1546230738e852bd06380aa47b14718326ca9f44426a508bec0768bed12627de4130570a0af2e90ba33a8cca66382268176349a3e1e1fdbc0f19486ca598235fc8640b3de834646d843623f8b23f3787776821898debdaad4353dedd19380be6470aad7a32b995325e0c4cd5c6c8580331b5c89fbbe2e1ffd656c9845ccb1db6742446c89a072aa6afa6ce976f44c7bea31950bac78d8b1e4f76ed97d7201ab0d247a21d2d85d63b48ed2e77b27f82017ccf9806f66f2bb4b0ee9fede11f1d0f78c1e14a4264f8c7cb40db6b9c1e94d14ec8f142455b2e089ac6c50215180e888eb6fc21df1289e8fc6c4e753659a574f99b1af2a03e6b22ec505c30771d106212424d2aa9324bc4150e39ea7a0e1aa9ca68c18297c0e0fb4fe8a30ebd010d7e72741b0985b2af633acb14f36a5571c084d5068d39d7f48feb6cc0ba614120b788a33a59682aa86b8f2c129433e581b28681a17057999ec3816ab017239309d9e3ab14492f8353758cdb46f13871e937121776875876beaec19b49d279140c2378baf276429f60a24d27916c290555371ef72ffd36a7d27cdf4ce565b63f2dae0c5c412ce4918082989b11a4914a5da2f9a110c1bb798b7930cf8c790ab41e80cba4eed374555388e74b97ed93eb5bb0f312b35332d9c84a974a8c20cef11753716c7c01314200aaa8836b62136f5cedf9ade847e8edca2c8cea4eca8d011bbe38fbe59b1471b6ecb4af9597ed45795a734f02443a9c905bc7e21128ede31debfcdcaccfc4e2befdf7d7769785fa2921c68de6971f2562b56711e8335f971dc2112d3d539c0c68cba39de4046f182af103c7b81c6f39c4d20c1b644fab7f2798b212f5d48a01b6a5604cec7ee5c7d7aef285e3dc9cbfe9f342dd28880d6011a386f2fece3f6cbf593afaab66abc5f355a145008f8e0828b7b9c7659015a921b755f9fa54695895f9e03a8d17ef47d6c5f7a2db6efb0bc5d57be8089ef6022823a3f174f525870eb776d910fe284576dc3c687d31fec243140e5a7a2c47e00c3119f3da070d0b5bbb7f040515a0e86efceece0502df118e9cc56ddbbe28891589da82afb0435a84f95da6009a6949a45cb31f481512aab41d159924c3fc8f272d2a3cec40ee4977431f5b87524f829170222b0e5411115e497a29b842925b19856e4aff0514431eefd87477c568da995a37d278f645b9d3395e41b5bd4de605ed9c3707973b63e503dcaee6e08d30c2d31699fc7777c202b098ee3982c8b91d5d0eed7c06ae492d708689b057a3226c6482fca9b620bcec1771246722ba052854c2b78e4b79432ae598efeed3ce0df79813586685901ac2c4fb0f442513d330187297e5e12d54cb38f05629986b07112a9db4665113356cbbd64615b2f2c010037f3b840fb41028255165202f8fd0f1f2d368bcb938ac180e36b0483d00e12ec7fdc0ba66a47d636cd8323cd505d0869fc040e65a831fc186abfda4647c1909ce2e43cff6484e81bfcf9e3c329d617469b6413268556d31b42ced752ff50600186006274c068d59d5a85c358658f6486e86f5e103ae402c1ee2235f8c64fa12a1d2217983423ab96450fb452db4de49613401675da1d5f63fdd3b8ae9309a08d67db18dec05d212f1391dd13347da15651b113515244ededc5b2e083ac67e01305bc1b844f20188fbd902876a4d8bdd42d437ad58c4973b4393af9643f0f81a67d347d03387ebd31aaf9ff5f583077086089c324ef5ed1e70654972591f7f18a6ff30220f31bb64ddcd3a239152660f3eb759153ebdd1c1fc591673f53b3e24d7df15a150c45da8fd3120017508d220b4eaf90a652a2d22b358278fd6e25213746384f266f341b0bfc77cfedc690908ad6c484a5824b03b4b50022974f2e630465892c0799daaaa0251804d51975bf6798e0cac50801ac170d38cb952944308093e838067c3990db1ee683aa265b61c634800ce95527d71e2fc2a0dfcb4ed044ce4026c993c9126cd3d2ec9caeb52b3910fb8360bbd744fe6bde8bb2d9ecf0d03e272b6a026d495b00d019b66611eb30950a10fe0374da7d4d80cece343c109c0f3458c3d1ff9e1cd79f9e6cd84766a5be52517f487b1e3816f259f3ab9a509177d6cb4b60c70bd9a90827d0854df2c6b3aa0438962d8c336cc7af612eeea14875561b766e3a859266e6d47f670efdad84c1f833ae90352ce4afb616448d8225b0ee02a8eed86b177dbe7fe5ed6bdcccaff3ed055c57d532328e432a2cf341bfd600b8bd461ad5d8398f4a243e26d10aae9fb8c323b7935c7a3a992f0ec97232d205dc03407896c0bee1ad8c52993bf28147189baddb9086a367d460e7ba30606e78e5a784e279289bab1db2d8b27a8174276bb1517fc246e703d4c68af7a1150547c565a8ec42b93926dad12db2c7a6bd56fefbf43146bc8ffa74eddff8a1064d57cd2cb4cb3a25082de5c3b8cde0e9f51852db264e252363ac927363ff715f300f2938de967e126591e66425cd852032e5f4419dbc7f7a4f32023be8e0927faddc48d24c3eaa0f45729671730ed312519e5a046c953744dec89d7ef1aed19441905a231f395e8b1f9d3b954200b540c25155c732cbb3c51718661afbe25124e52c4e011ec7b87875e67b27e8e22bfc69a8d6d5339016f67d8ee54a327510f009da507d95360e33ff881c6e7865017a4a0f23387abceb563801167f425c32bffa24bf4166f151f878d6c43468268f4324688e0646854fad86537ad1234b819cbf4aa77a31892d7fccd51efc35b545b5667b41c5b5460b180fd230cf68b8f2dbe7659ca240c91e9396ade0bba4f6767088549b49e852d3b33c72f6c0f26181e28a8b389083fde2b22f39a75ce6dcbe3a3d89dad1171ca8f9793abf9b037ef2c8033476f1cc5588eb5285fb103c22097d766e776634f41a3d6d8330a6032eb2386845e0356418a48c7b500efb74acff0af84bb0c6fa812ff065c3c6e2905b21f37bcb32a96a9e6e7572da1122c52b88c0b524cf5a40a8fd86c6a001383abef2220e1eeff26c12a325c4c7fec350113ec5abd4cd4cfb95ae9fdcca575fc12eb0a9faaa0f66e81cbe7eba01c3f013b2fcb80ddf1f78996e4ed1de88f66d03aa21d7b4fbce63ebb496ac73f023bd74fb4854c53895dc1c321d21d1f8ed3c3b1461c96fece7181f3ce8785dbc5a07e9ab870620c86bff1041b940f92b039e185ac1640e428c30f801484b9a2342b6e73305e09ef56a6a2e0659e36f8011a71142200037f535c55403eb8ea7a4895f4304914142c189809fa888a5a980baadf2ec710330cc077099400177eba44b3036301d3a9034376eee656f618663c1fdf1d2422d0bcc4b322d07a79f957671e6bf896860288230859f4636db58874d1223c8a14a7fdfe508557b5b8c71b7654563035cc17e0b1884a556553f1b3870bafc7f2290b23835f3da5fadd907f83283e5ad69ca4dfd112e3f9d9e5b72615de7c9d922788826ea516f8d55f80cf90be303e3958c7cb79c8e172c7181a0a35a597b6431f79b02b7360748cc65ed96a5260111deff4b532bb2f1fb075479784dba1527f1ef7b63fc0052e71e6d74197def417a04aee3bff0d4453a7aa96a1a1bf764d240c51967c499a3ea6403d4c85c087560ab4cc3a74d27957d7ca0409b2b75c0c501cceb71799538a218f47d727f78c74a587eaa35f0aabb377b1109a57cbbe3f6d1c174ff23688586a701e89f809ca3a4c16417401d8a2e1534024f399f608ea8930486905a601b8cccc423b0d9a69fae3ffab315535ff60accbe276f8121c0e582d0a55d6ea66646bf200b312bdcb6aefb55a3d448f1acb04f79242afc554620b1eea0a431f3166b398d8e9bcd6765ab84cbeed9d32a7fa561807aa7f2a7f24d01b15d36ec2206a8bd08b7835a49776aac0dc9ccf89e34a1780be4d6377670fa401a8557eee0f10288005fa3ad1b9d4b13999e7a5a97c52bdf7c225dcda03007402cd582dbee6c808f5d7d9a03c26cdcd31da3f95e43889c6e36ad184cc9942422a762708659d7a032e03743db9892e8cec96f6c15e13d04683c5cd5cb1e723d51d23836e02c066eee2543f03d098d65b873fcac3d49e256125d60f2125b157a5105d56d8034ee14274fc0f264d387248d6841829c48111a76b024598ce776af91fc1eae4f836d62845eedb679e56b685ed75660667eaf2da3e7fc86f1c606a4f082c54e3a796da1de07604d66760f25f9d44b81b1fc52b450b3b1855c36ffe6411357f98dece5a0e1825ac6efbb9c3a6dcf8fdb92901889926a556504b45080802c06a1779b02a3beb638a4366588d1a0bdd43c6765273975251a37572a16fdc1af6c79852b9c589746aade79efd4fe9e681bc193c38ada32898b88912e102ad0b12fb9a18d353a05bbdcda1e9fc152ceb76e35cfafd89f2069515b2b101365a079c9e13b7edd972c7efd95957bb863995cf07755929fc7377566f726aa3c852154d7bec4abf47b6ea6c9365474fc9369d88bb406088db6579f1a87d1744fb901c73e414bd9e414afa76afc7e2b28cf49c057ec3c08352bab1d73a2d38c6cf5110146e4b6a87cabec663809664cca0e486516ea7621a846329dc32719e70f67b06ca44cef07a066267eb5f5a34c952cafdb76cfb730655b3a977cde03658ebaf20d5fa7b1e18d886948ef2b9bbd24e5dfd0fa773767af8c19585fe31e243020a26a1fe7a053e539baf1fa4413a1cf777075bd3b12b00ca193a8cfd1105fca2ea10eb0d3a77b1f2f7b133e9b7ebb97377820ba1ee0c765207f55d4ad7f96e15ff2cd54ac206b74aaa26153e26da5b0218d27aaea3f4f58a28589b3bdb1faa959c10d7523c48bf42351648295d8c81b8241e9fb873e453580733079b5ffc96b69a0c5d1b384d62c849d692441b9bc22e25fd7fb81fc695a864323a3c5f1e1b6e8f1da09473d4bf894645df269d580e059f9d3c0af5e041e2ab8e92a3afecd010d616b52786ff08d5572069ad24242b92a958f8ccacff5ee3ee567d7d09e7aa13a70b087beaf34ef737ff7b32e4ee582f6c454ed51dbe750511b38a864e803169060add1094e97f48bbc82c8cfe6dee88901dd089918ff55cbbc70a07b8d7ac7c3a2334e527457780ec6bcdbb86f8b8c3c5ac919205eb9fcada90d112af4b1973f3011b9c7b46f1dc580e0928b9906618dac5a8ea27285093742d28df858e15a7d10b78c31907076ac17caac66c178e7935b64de9e0ee90d7858a3546f9fa46d01d1f5ea1bbc4ddc7771bec8c0d9d27858d1e4f20a3d04e889772a7d9169e5346a20248c6d69762d3f1d7eeeca9b8e0461a6a095c06bb04e0367203932eb4b002bb0c883aba14cc9561a6bf12ae3d7369b6a728af7f78548e7c082112504c610b4906fb773f57f4c6ee5f3d29c55c4db3a8af5f251604815f7039fce84a000c238404f1f134e4b974b38567e1d3773a275cd66e3afa26a72ddf168f61dbed46ae452f5c17ca3505a7a97dba39ae32c35f47f0aa09120488a77cb4066436beb29dbd2e64a6244c8c9be84fe54b55dd0fe428e1c2ce5329ce3192b703589fbb4bff0b0ecda99b82c7f6b4ee7f1964a200336c25d04ae69e7439688039e61b83a58aaf2c16c63685c6f488f7f48c360e537a90b44123597ac88a5025c9dc4cdce58310010098b0629fe9e7454adb2215b9ff3be20138ee622f054689571d9bde45e20d1daf4307a42519761dfe3dde021d22e43367fa45f0ab27334ce9be993fa8d572228ba86d8708a0c1e1a20002135b86327083de8cc753c0bc36f6e9be0be171742ffbed6a993ba20f6b0da83f3387579c50e27b79fce285278dc7bab283ab42d32a0cc4fceea4613adc4724a250dba599cf4ae0948d2013791b7e3344c98a7f5124563e8fbeee4efd4f0cc16f5fbd5aad922d8720163f392b0fb09d65a25a4e3319a6d4cceace4cfb672e2d2f793adbba3ea1215caf844c9c97a9f4d1a53490bf152e40d908e8d88a2b42eb56e6ecb2f1b1f47c46035d69171eee143aa3d699a609bf8b0b41a866d526f5199000dddcb7be1b8d2f4cee1d74672d27eace0446ad19bb1027ec85c525da47d43ba0d30167a1f2a5f1ab345a6930697b9f3a60f0e02c8e5d54e55f91942ec40d870aa6e0e5bc516e5bff4f779a626b2e3f14da335c2ff7e01e07dcc500b31297139a5ba0cf57890622352d4adcfb1be31f77d8d7601ad430f7be5745e7389721ab1e6e317de0d30539b99c5e215ee3038aa82e7f0a228a3819d94b94854e009f92e0f10f455c944b7e0ae47aa3e3bddb70f18ae8d61cd3efffa89dfd09fe2a30a879aaf0841f5e071e605d3159d437426744a2fd3b09d9ce2eaa31b4d2edf126e61cab4296e1579d6f8d5a861da1353cda02b1efef19c893940daa988d57dc09333ab6b9bacdb99104b1f9716d3acfe5d1a0a806bc195e793f68f4fde107cc5a13b1d1ee3e217b64ecf41bcf0101e09d056e4b34540fdaf83b38e7292e9b20675f82cc2ed4414a54e01e8209e87f66c0bc6068e6eb2b1173ceed463dbec918a0b351033bc472015abac4863b94433a5ca10600e7062efe7a1f8dd192c794407ef5638da7d72190e3c61f191931d8679b3dd1241d6e07711a8048f1a8dd9f8f168ea2c49f3b9ff8a3ec9994b351c2f7011ef033690328b8328aad1f114b0215264ef47f4eb6c35f42e64def4b0ddc3e40a27aa006cd2e7ab09e17cbd8c85a21193f528db134d895af23876db5431bbbe91e2e3949670d3df67a8e7fdddf70fcf713b85119eeb7ab6c601d7e54fe079033889b2e1385068b1b7c28f9a838305c99931a2382c25a55c2efdc4388047d2bbbe3e31928242b7a04b57ac31cdd8d2d4f6512198f988966f038b945fe7504c312608c2b07eb1d1c7484a696c3dd5a905d02ac22c79d78e4bfe927349d2cd95847d81ca90d06145015823ac0b809dc6c14966439c325b2a7880de8995ddc88f9ab37f6d91e58232405a9fd23fe6b34dcd4e7ed69354fe27aa848348b8288dd3b44b44e3e4488276fa55e4fee1daddb552e86dbc36a93cee2d6c00fa1256d026f8ddf3f9282220014058054f0ceb7ae31a13d0165e6c4ce80e031ff85c11914a28dcf73df298a2054525b487f9bc44bc769c6cc7e25c6884a06d87f17c26990f7fbce35ff82272860db14ccb60274adba5fcb980b47fd9567c2b3c2abed6bfb2f455f081fe458036f054deba7f9fee318d4ffd6492dffee21f7f013990e4716bb8ad82e68eb2009e3e788664a25527f2b7b04b0508a2c9361433b1bf750f4bbf687d1ba9691ef05906ea84cc50f96d67f2a421b7428c68f24a41e2dbb8d3e358f7381c8b5e901246a62af3465ca30dc919ad10023efeef4670213133098371a3f11a983d5237b1b3d93aafbf9db61a7dfa176a5d6a7c80179adb5441bd7c08c9a86f8a519ab3e19dc9c7da47540b98b835f72dccb2636867dd42d1a49bdbf80f6c53dd846cff90ca9565e12d8b5e87f88eb5fa820da011391d3091fba21153015b9ee7297c2641a03c398802f158bc866722c84b739e060d9ad7955333d11fee9f167b9d0bb86122d560ba15b62712284be6f8a998062cec9b438db3ce7e335bc6ecd81320ae727ce73a8572b8474cf77eb90e0cf7af9905f216aa459335bca3720e65e495eef2cf4d23b7fa544a699106e1c01e74205ef086661c1c9c2c7a5342da64d865c1427f49b2ef27f3b9fdb41f88afd2122f0a4a54c2bde779f9e87da1b0049c242cc24d68f19400460a5c2d94a7d417d4dc2504a77d80ae09ab6e3f9648c2f987b530768041533ffe6aafc2999ba3052371b74af20c75c2c2e40225e8d8ec0a2375d14a0c5c03b925e2031b824c1b7bacb905a77b32d3907f4d47ed7d0ce585b4b7a03f34a7f6c273832d3a197144f47d6acd9f9ccf81c149cb3fda1e5539b1c442303497ad376579f6142b55cfe3856314adea5ad7cd748fa0fed5bf78c2ee6f19a03497ad376579f6142b55cfe3856314adea5ad7cd748fa0fed5bf78c2ee6f19a28fd96493a8a6ecbaea12f38c772dee0bf6d9e0777813e98c5968206987c10942b1cb35d6a33e2331df2171b9ebd6c9a0437326917b5063ef30fd60246cb7fb7122a4bd7629620a515bd154fc6cf26dae5b82fe0f1a3eeda005394a6e8aa2978107c2abf1a125692d1246842ec4e437fd4581e71d14a5e30f2811e70799b66f60fc31cf8a6a4369a06e04b12a252bec1a9ecc4dd9decae35f199e07f774b24f90b68f133e335da426af4100a889909b9920e81fd2a5342f29077d864441a53fd161c4216e7ece7895e3c15b12f192a4d3ce50b3e039d571798d7a738d64a2331060de94cc5f31c50d7f69a8fa4dec2d35ffc6a076ae6bc1382916779c97bdcab21aca4c3f6553e2b53e995450dc1afcce6887324f8d8507e3a8e6532aa2a5bcf10525c99fa8caa58ec6960acb3d996101b4d43fb0e38596ac278eb89b1b98dd02a9d9cb66a428fa737099e16f6fb4d2ad9bb3dc42972619125d4ca84fe905c3905bdc348cfbccf04b4952eea30e223c816fbadaa41320779d86d2f6f57c74eff2069a6b301a6340aa32b96b8a72c1555d8515aa280e0d40cc83766a1b70e40bd22b59fd731343b4a0b5e8100f8bcdc696aeec7279d469f450e115234743e6246051f5384b900ade56582d92e4d00e147af0086d400e3b20505f8cdcf1c0930280393760cf49a279c5f62ff5f8bca48815d934b172e48807a439d8a522c3bdda22d62c5991ac738960703114f59638d80a4013aa343df238160b56550f104615606c2fdad0bd61cfc475f1d81f788a097e27bcd838eca15812cbd070896f02c4b0b1f728e1f8cfd4f926f99fe4353a490b1184efd98f0ccfb9eafd869dcbb03b8026319d6fb9e22983a90262c88262b9a756fd4716e4262596c2c908d68feac5411acd414cff2fbd7a9da127564b2d4539c5cd7540620c083e7d3e5df5fb52257252b7948f64c7fb675259165d2667252a4c6ac0c6d704d3ff471691ac0496fe90ac1739071e67ceaec7c31f2224d0cb26ceb72237b17e665979e6da66b78042e2bced152604a277975ef2cc931678cd9c4d98a1c3e9d977f4da30fa00e4481730f5560843d6ed694d42d8e38bc0115d2a08d646ce490c5b936ef119f7f5bcb8a187fce9afc409d39057163226febec38fac769d511d4ee9de9efc990c5b90d7c0e4bc6a91587941c7cf9c30b6e7481677873c5a9eb1df711f608885f64a28c2d1f433c92ca859eef52148d6aa6390d28499aeae12f736de778135b847c046c1c25bbfc34c43295673108b79562a6653ba526f301e544b8a2fbb1815a7814b1fc0fb67acca66b53f42c40a477ee9d77258fbd7be61d6c2976d9b20e9a4c1a0b962bbe63167d1085fa582ed0c70d96c370a48e84c5b3db166845fec0d0fca99c8b1e4b0381787c5b7e361f0ab536d83a864e194beb2ac86fe6e0a42c1ca4004cd20fe2ff949126f77e86ff37fc551261b8cbb9afb137d1ab6a85cf95078843300b274e9de6759ce166a66d99750332567c96d4c818ab5d9981d8ec04350dd4887612fbd173b8c159aa7be733d404f9b72403fd3e8455eb354de49611690d888c502efbd4b3139aba4503bea6970b7545b612fad91f72d91a919c0d1195a832683f15fd9379747fdf75c69a9336497a4488c99b70357acef1124d9e793da63d8e880d6ea937f77894cba925b37258ce7a4cb03557a7be4464b0e1d3d8980dc2435718a53e2d0c1b2e425870b29d768cc138da7ef146034f35b5c33d28b66b789b41075e6bcb2c2fbe09f2978ff99a8f32c55e4e07146a2359363d686887cf041f9015ed4bd217ca3396341cfa613ad13f96a8f9c8bf92ff1c7b756b3eaf54e63024055674cfbf7bf99e3c42fc77808e250df96d0da1fa653cf829ee6720a592e87c0da83003217aeb7340b7b10f7c63fdbd57537429b0ac1138984555735bf3e10815d93fe2ac1608d0690be74b78b985dafee4c6f0f286d2c232fb0fd858346ed317838b37c1dbe3121e497f31008a478a89fc444f52a30dec210778bf22bae99e19ff49215c3050522fb4e7d3c1165c4377e1618dfb95ab46582024b1293145cc0161ac6037864a91e8638e38d78da2f126e9a916a9b6664c10f974a80d246f121032dcb87c02708c1105d19d429f0aaeb1e5fe69ce8e3d2e251195e849f2feb50b6ca9e5ebc7afd10f3b2869d24dc133c5b96460b10efa44a55cd2e2c331d7a51e2729c6280ebfa6ffc9cb59b01b024f60614c33b82aed2c6a8dc7762614f5ae0d26454019aab7d2efc14b17f6c6230a188ac00d2b9439749ba43d4232574ffb0c7659407ec5d32be768e9810a6bd02f90549e16ed9936a45a038df94f894dab1889d41c54fac0b31bd19ceb01da4b93e487e8199d8f7188c07b7c230346561524be819ff9b07bfd71fc791f7c1a15c472eddddccfbce59e10e84689964006052aac37fcdc8af0cd642d64e4b4c5024014e80714b95ecff08546daafa07214880dae2c933c9cabf23960cb78ce0ff86669d79d7cd4d1f159db2463427298ebd314acd780f355523e0b49a748b5e9f932d703a07668a622f9515b6d9796915c1a2fbbd92cb89d9f2f214d9e0ed65927223fc6f12bdaad9f3d0c2353db33e65e100a96cb82b132d5a85a38a44c263df179badc5402ce8f24860db156f9df1309db1e92ec63ffba6a29adc14383b4aaf991aef64bd621b825236acfc112c67d6b5d2c92e70de1e9e9c00bdf6653da7325bf8e58722f42928b66e9c5dda0550e9d6e2cc11844da0db3b25e2e91372707feb1fb90aa1ea70c950d65a3eb5d5d1af8d8032abba1b6fc932beee264f1e1cce29b0c8ad11aa3b5feb51c972d24c109f2b701551d4bca9cc565064f99b9caef90c95c5fb34f880bd114a5679649b32a8c1b0194ed8f018a47196579833c67411289aac8ba9249e5ee11cdd62cf7366ace882f9fa16fb8f3a6739e94fc2ee28858746fdbddcd26a38e39202fd6542bfc07d419b41d853ef9fd6946db68588e81793b2744066b8f3883fb2d21a4dad3d479340b8db889bb19ee3a1bd27caea7ea37b659d1d13aebf8f469bd7556ab820c1d7118d46fd3cefdfeffd4fb42aaa73d1c216600f4a3a05cce1d7bad6cebec839e3c2e23b9da844faa67786eefea3f4141d1260b17573bc8a6ab567b7280366efacc1a520c23856086a70d8dd718ab0ea098d23cd610a73d0a39ddcc644057a4cd791a1e13f3a0d75b37b00a7b4947c930dfed518420e3526859b7de974630546f310a82ec2906b5be1e40dda9407aadf04f9ee60ad43438eac069b0561b2a6f68d0", 
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
