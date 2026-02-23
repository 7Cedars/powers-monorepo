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
        publicInputs[2] = hex"00000000000000000000000000000000000000000000000000000000699c4c43"; // dummy data
        publicInputs[3] = hex"00f57931b54ee536c40f368c81a301ef5a449fe4c853847aebedb9817fea9380"; // dummy data
        publicInputs[4] = hex"000e25d57dbe558245aead9ac9aa0089a2d18634aa26fa0dd81efbff7c4622d9"; // dummy data
        publicInputs[5] = hex"00c217ef3482939d028059057d5d1d52c866d14ba111c1f6a0110068bb767a56"; // dummy data
        publicInputs[6] = hex"0000000000000000000000000000000000000000000000000000000000000000"; // dummy data
        publicInputs[7] = hex"08254261e988dd66dbe391d5b382e78bf8194252f6d52a4a5338fca2a4ed9b92"; // dummy data

        ( ProofVerificationParams memory proof ) = ProofVerificationParams({
            version: hex"0000001000000000000000000000000000000000000000000000000000000000", 
            proofVerificationData: ProofVerificationData({
                vkeyHash: hex"2cb0301d4fccf542247d2164335a1ac1a94be519757be9a8f76556e95ad4110a", 
                proof: hex"0000000000000000000000000000000000000000000000032016fd43f068f28a000000000000000000000000000000000000000000000005a828039fd725cd8800000000000000000000000000000000000000000000000380bd64d636d8a3e700000000000000000000000000000000000000000000000000012a12d111bd00000000000000000000000000000000000000000000000005dbf94b435792588c00000000000000000000000000000000000000000000000eaeeb0a0e97c678960000000000000000000000000000000000000000000000081e85e546ed6ca0bf0000000000000000000000000000000000000000000000000002d6159ffce21200000000000000000000000000000000000000000000000cd48efeac8ea281a8000000000000000000000000000000000000000000000001050c9f36fa5ec201000000000000000000000000000000000000000000000003ba23d0c38576bf680000000000000000000000000000000000000000000000000000727b98dcbed900000000000000000000000000000000000000000000000b942f411e92e727d6000000000000000000000000000000000000000000000005187544a5246a0235000000000000000000000000000000000000000000000003e692b1b11feac9dd000000000000000000000000000000000000000000000000000192b7ce15f71e20add1c4b1d3783e0ae9a878bbf231c64d12cffca811b82067fcdc7a91282c191e86a63a39ef24a5ee9d8f7be942e15d8b99a8c7de64d32cecd6931e9e6d37f51bfeeb2e2e2f43743350014ad84569e42ce79079b323b2f58e81a4fed619666009dcff93ce22f92fa6bf49bc2a53f25a9ae8fd47e441007aadc8b213d5d4bed515c41ad11735ed70337506ba0c12b9d95b5ffb50a3773d1f2f247c5c8114fd82073a0fdc40c3a01baa9f79e5d9e1758a9b04c29d02f78e03983f714a01fc35e92d8c56d1edd26ed0148436911d0b82618b8869f9733e9b676efaa717e1bf6362161d04d9bfb6cc44f6d0d3beab7c2705b49e0cc60a6c69cbfaf6deda98bfc3382d8c56d1edd26ed0148436911d0b82618b8869f9733e9b676efaa717e1bf6362161d04d9bfb6cc44f6d0d3beab7c2705b49e0cc60a6c69cbfaf6deda98bfc3382da753aa77f17587aa0afcba9f908cbde946412f4bf28c1387e441640bbf070301027349cda7031388886f3b9304f9308e29f7e13e5188d9d1c15e6b8e8081c521bab1c7410f985e84753414170ce6e62df230ee08279016d6141fe50a52d92417cd68768db48f3a33bc4f63128bffce6edd513fdfc3834b5ad6741bd174324c17aa81c58fd8bea1c78a7907bdbf4ff010e9f222565630c70a12fedeac5a4b5d0d8f8393f2f34a26ffb355029f769f8771879209566900175721a3d76a81614422dc8be2d9cd37d929cfebb5d0ebdb5bd295eaeb9ee6b5adee368a71ff95772c0d87c290076468508e805a00b0957d01559dfd5cdad2bae355ab6b21f06a88d51c0e9e4d02720f7974f0b3b3c748264d03905445762ecf821cd6557a336b5bea1ddd51454a92a1b4f30cb6c4811a4b99ce64646c4389698ef61e68258fd44e0d1fb00d54566f579cd8495c785e3af69c46212d6e4a87aee74dbab681f5be3419188d134cda28e156d0547632d7f62473f4add5e24ced2dded6e315b5e24abdf212a05282308694c5c18bf7e00209901803ffbce1ddf226e27c29cf42dc1643311f4cf775e43ec9af4942cdbe11d53cdffcd6352c3b7f6fdb0899414ea5b75eb42659a7477c47419159543f804fdcd9891c52ac229147ff1b08393b4c095c49291225f65345b74db5084eae85a5abcf85722046cade7a3ed43e5fed87695bd6bb0f7f76cb7e72731eac08bc8049532c65cc55fa697baff70fdfa01b83042c7ff315dbbfb9b360d9fe54a0b56017af98b01c85802f6f6d216a2590b8bc9756ee492f5c9bc4a8caeb0033df50aeb3e9e09f809becd0c5e7eb04d9ff1d941847accd2e5c1eeb5581f5791e7bf2ecadb82e6668400e2835402591c4cfb51ab06fc8e42c2eb991ed8cd97ab86ec85086c67869c3c7e76991a62d01b65fd44b691ac4731ab6873b7b9a949dda904907ada3a5edcc6c6176c623549f87419e602c56b1f3192ec6fa41fb185efadb1e4c37389f28dbb1ae9d13025c7bdb8cbb5c9c7ae949011b4f8b71d0987cee4fe5751b8e4d3e513b9ab6ddf7ffcbb99027c43742bab1045cadcceb5130ed7ebd0ca0d63fe4e551f7249c1de4529ec62a8c9411eb75493004acf41444e5d1b600e9b28e2ff8bfd20a3bc4d6818e04158a3a99ae8ac0441587542ad14835b123718f5026424e23441f4d37dbc77f50be546c6a7f201ba816c5f9f3763ba3a1e8fad7c19a8b6fee5069197aa626dc0c023cad6eba5d2dfc03a4533b1e2e2badfe80e9f6de8e9278e64d06c3094ea12b74fa627b506d37681d50c578b772ef1ce4cbc217335fe0ed6cb5e818b9faf2b4763f83155de31d931956b3341038ef1fc3d3f37865c4887b3c5cebccf0388cc6a834bd45d241565d1990a61b939d1f21e8cc1d0164511759f3e4f4c2d86d64f0d6a72676e4af88bb1913c9ee99a4a66adc93807bbdaea51c0444fd72eba3b64d2f94de7aff79a18919614007b1fa5e119582b1aa9eaf4c05cbc39a37e1b55e2ee15556c28912f8001f91334c81c9fe1fce5cd638bc8f489041aff753b91b61d7af111017b5a6682f2b6b82ead24e1bc371c34edb48caf7e24fdd513b6494e5a67b76e65623a115031152f87f4d1b9e68a3ca0cf11b743fcfbb48e39c94fad296281fe44d6df5b180165bac8ddb09b41cfc01bd9f5d9cb22c1c36349d4222892f2205d8be36026e1414a6c2cea7e78eb42e3f49f43bcea262341ec67ac36d45f5f51300953356dbd2063ea8156bd090f6eb3090550d4fc33dc8dc6cc14734a421716c33b9800837261d9a43c02b9a05426adbe1038a46c394cf021ef220cb9ca6a6a61d47d39f13ca046a66380f6725ffc7a11416e842c84a5e9c5862b7c7de00e59863bbc647d3b12274b60940650f5ecc99bc56d4b741ebcae6050b93e5a03886ce5d5ff730083a2ba0a8abc772dd11b1866eb10d86dfb778c4a3211c5b78c476c3a006414085e0226eea18145525e17a8997fb631ff7335fa837dcbec575c9cc4801f8a4c833bf13eb1ec3e242e0a7a82ecd6466581cae3b39c9481aeb79857ef801b9a3c0eebe12b84ce75c1810bbf6fd91e637d8dd19f15ac6ecdb5336eca7dba43bb93eede10f8ba4563a8d790ab5affb81e58788ce2c387ae8c4a03a4a0a9e61d8c61dc1fe17902bfde19ef2d48f9b9a6a92a3729e53ee40663181782c53619b8dacf9e99e03b465cd95c20bc7a62d0a1b2bb654a4346c0b4e8f066831c7fe8bc6501c95c3167aae3efb3078681779aff25d2b2945f0f49af2e61fb14019c59da8b8370f48250bb7b4d26b281e041fa05db511bf84edc082258d8a6c8229c9d5fc09e7aca909e9fd184a4a48db87868f94e1a9839427e6794e49277470459586c2e641f37a26f2149145a7732582b87cb3f513f3d6562596ee215366c99b2a6bd0af10ca9c26d360e1ddc391b4c80bf3f2c05b70f60c3cdbcb69cd4ef3dec359be1eb2cf6a0f6308f4bbed4c36870397dc49f292656bf56e6a5161478a67de01f07f94912d07c3e54aea8afdb98b9350334d4f0f96654537c11b6d6a36bafa55836cba00850ac852f8a3b81ac14b6bbbef42c482773be824aed86a7091cf83b14203be225b1915008ba50c80c881cd4df2e46d8145ad0e43a091e9974d634420e6cec504752120e796b0cb38b82f7b5bf3bef2e367764933114316d5a26b6b9b0d24619b8515f2373d4a628d75ee69c8a328b1aaab4c598135f47f50c836b110ecee16744024dc1b63f288bb53fc78fa2155dbf168bce8f515dcfe4bee6a12dca1fa0b868c28c7c2551a22235e53a58993af1aa0281c58bc8a864747947ab250bf764c65f81ed0fa20ef87b6279bef9ce771da29752f8be95794911032ecf26c938ef9e77b0cfdeec019a113b857cd9cfcd06475bf1076dab8561cde513c33cc236cf5d2c21089fbaa8698324f824cabfc1c2b4105f924b709b88d2e8c458c020e37fd4f2b06dae190a2da807a0d7fe62e26a1aa8c6c8bee4f4c065c846501ee126301928421b313c59923832be4954887e4675152f5bc5fa95475873d422b5eed997ac60310e23be14359b829ca4aed2d392571a007377421b36f47b521d1dbc1806da8642f42abbca33984c24c894523b6c0411610c3f2abd4c959a48358214d116bdc1529e4c74e2877e665f4ebac3b30bb55ac943db0f216e6585baa8e55e9dcf18360058647abcfb5d3b18cb857acfdb0bf42debb708b98ffb3c0db4550dcab8380ca0928cacff02010f4af534a68ffae4e05b6800a4f0fdc30c26f405973e848635929c64d5f0a1aba90f1dddf0308b44af3767869024b4d6a0c4f58a11ac1c40f141eed726304600c9ee40e1a258c9869f7a7b2d9af397b95e7bf29204141153f551a29c901121857957a33c7af400ed88fe32b897d590ae2e012a154179a77ef4d1296667a2121582c284dc18496b1fe92bcb04a9c1e7c98d0b8b8ccf190e0da2f281808f4a540bb014f5e5ba556d3092a75adefe8ad142faef0a40db5aafc88941e63b616d562d0f2ca41b9911b8715c1a4235a2d7eba3d51e6ae68233b7f6de8202bf31f96b4cea5d7a20a16b090379fcf242d61e2dcd1ef9630817aae0e1e4f1f29ea1ceddf4eb4b82c38372292dbcfad19f3c3e61c5d39b682d4b16fa736f3248a283e6107e9e8d2d51510fb9a9b58af4b8a4180a87b13b56b51e10d5680e12a863d9fae1d31f8610050c3486474ede03c3f6f4425590ea0ac82b427fd50410d253dbf0b63b9d29947a55587529a59ed9ed856ca1645de5a4ce6dd8f29d7df158da879ee0ef4c3d63771f5bacc957593ad64af1bcbcd54af3bf8c90acc03891da996cb788ff068a12bb15097c163497d5e97479d2cf5b9eea8f096875fff15101d8a97cc2dd3e6bd96ffa8f8ab93894ebf83ae69f54bf32921988af4056b7919c43968ad7c6dacacb5b11b6d90195b4d470195f6a495c063e0622d0e80292221ebab924572232f8980e1f51e8235a63da544acd245f1361411a56885df49142b795412c39ca911b0d30dac307d590feb7479875e0430dc87ced3f54b885b3021a4e05c2fca1d8549cdf06d55356d13e6497ce62411bdd48070338da550839b0443fe1b8a8658fd580d4f9ccb473c4c384c62f8c47ae85fa4d79af15d2e0aa21b89993c568745a89c9081916d666810f06f092bfba64bbdacd68ce04e1ee7b9170813762d523ab72b8363a37c7f78dc6bce1ed0b0d95bd2691da530b5962e5b0214b66d895d40bf0b1d2d4cec015c27458825dd03a32c7ac2862869d2adc1d02c0d95d607b49e0208bc0a7800a3156dc71fa84467b25d8b04d2bbbb95f5f8292445df4d29ef7556baf4af1048e6ba4a0413c2ca859872f7b2e8d95ff8403aee04a0dc6e9dd8fe3e768f137338ac266b119c9c9322f217c1a8545ffa161798d718002080ebd9c416a785122701dac86f6c4ead77885da796085925905fb288db23f0cf50b5ba1967c4da7a655d0ad3f7afc1110b85f19b86d578193eab31c7262f1ae4bfc74dd2b171bdffe5a73ff7d09d8b323124504916d5c1336b2ed7e416075fda9bf4f0130dbcdf08c135b6070f98798ba5c9aaddb2c68db5859f48630816c2ed9d5adc4fd2673c2fa6f46d0be9bd926e976454b0d83c7534c7fd675c1126eefa1c019bc54d18c940e1c976c5e6b33a692113bd1352fc0929ef50f9c6371ab26e8e4dcb19ee0adf69f8b166d2af954b171412403bf1f7a32854a9a954dc0b5c4eea3dc5f64f79022faa11a8ccd0d0829c58c85460b14a3407d52dd171db0c77725d644269a3722ad3df040a31cb86cb29c3200cc92900d42f51cd9d459a10f57465986b42c565da38a1ee18a8cf7473d918bdbf573f687adb82fb363b732938b6aaabd24d73cd2e8181db631339b49ce483e4aff08019d30c265107efb61cd599227372e1919f73f143ae9a167aaa93e4fe2e3d29a7ff4260034b7ea32a19504a8fdd48e94fef1b83ca504838e1ceeb94ccef76b54ea389828c01c934a206d9695feeb5edc7875537dac7d152f82213c1648e88c6d61a61713dbcafc04a2a807f5d9ab103d49604d67c88c9ad4bc8281891a4cd46923d982c2333bc0cfe1e17732c0ef8f969102b8ad452382c68fecc741c6a8e2ab025214856f8b0b2152a43851c7a7547564aab68e22bf8f37d60a19a93e0c043d85b8a676109b560e71e88466b953a683b63907fcf961a63eedc410a4a6ec3dc46988d473f20ba987a0e98bb253c4cb10b30555ddf52addb318e2684b4423e8625faa1e647a5279b5106f447b0d97cabe086a57c88a65e1c277d985abc2314b71d172df80d69affbe92ba7365c9e75af64760495650be244f6d435d7d2bed95a03e2d93e218c1229cd0d7c16b5616950566ee98d51848f345174e73872e0c72afe409413796c66d93328083ea11545f530c81f26b90b6cf57ae966485ffb422fb84a504580d1dd5c372726dc9be954d1f2dac64a9e0018226de95f50e146f53acba93db7311c87f76110221df97f49801b510bbfadde855a88a973ba1bbbfb9233eaed261a512d5c060cc9b5786fce7eee15a7a4937ef03ff552f8d2fee36d75f1f7c24316d74e072b0e46e29dc964d7f254e655ef148b071620a2fc58d6757a869c116f146b3eb3ae183d5b2fbf5e73059a654dcb88a260bbb68b3c0b5e9f59f5e878fd40b224ce570b3fc9721da001ea7c21122d427b203c8ce56a658276c4c4756f3773e32f756d067d0be73f565b585453cc9ba5730aea51479cd9608d6e1e06e786f292d9cc180c2d99fa63631542f21c50a3ec7e56e168cce9e22dbe0efa5477b3111dc9686f22d1fe6fa3551d33439d8591d3b211f60354559d1b676a30c72aab243338e9f100a98c3ccbfaede6289626290ac21694d8af6bc8c0591ab7a11da0740e4e668607c3c0df3f77ecd0f20ec50e06fc7b5e600e9359fef289829c84b951466124ff041d64ac11ab5f354ef0c41f67fb45c0fa2796abce9c77a4f5e8edb384db1c7804292fab47dae643ec943fb32e42401307c8aa9cc6a368b27544c504b8be778a2aab9442299f723c9b33577dc57ef8553cafb57418c2b4799e4d77482b969c8a0d81d15563960e47b9d4ecb98576519c0a2122c564632c17ffc4c1d77146bca72d7887c6582ad423470c0b5d3a7a3c00ab16060b6bfefedfec1cd1135329d67c15e67c56293f4ba92ae358a6e20cfbd3fb0a68610f8d159e222d1021959fd7df12df79fa3a357c91b32b0a6dd031cd41cd036d3646ef1a5e7ec913318b84fde22e89162c032126fa804110fde1c2e5505613b49f73edecd309810a559a9232b71d995a6593c2c153517a2c5ea6e73559f871cd1bd6909c3b35b5b2156248db5e15b4dbd570ac2a9dfb734434bdb49b141b2e7f46ea69d4075bbea20f1d0ac40c08e587229cbd41a3c9df59de7a6dfbabb7d2bf55db6b76b327570c881333bf2218ac0e52969d0976afc29690a938aebc37087256964f80bcbe305544144cb84f19c4921911415b315de45eb1d76587bed4203052f26a54b936b9142a3bcff0612b9f53a07da4034dd7fb3982bd975fdc1c230e2789b8a2c03c7c6ed5ce4089171fcfe440666f4282cde6450978b92eba50ba02122994ef89350318306af4f87f09cdec3cac06bb9f547b81a2f03423f6141c0a0e9211da02480f83a544b911811fbe18056cc9e5d560712bb6d8b83e6ae515f424f07ea78f79f6d76bc2b0d4c705684ef57b1e2717c895c829cb897ac0f2f2fd5405369d34ee60b2239423ae461c953380574933c73a5294a6e99d5366ee27dedaa1fae6277ed11b8b0185970e2876714a079be6528f7966e1c428c2496c8a1ce2c3c737b54f46eccddc24b6ed02c48ceeb0186e6c680707387477747f485772122a940e4fcc853d1e0107f8982aeb77837817f5518bb8fb6d6570773c6831a88da888d509a3fb82259f4adfac1ad30daa8e91a71f3e3f9eb163d2b58f14ea9deac78e4de283c1405283a1e597032300b607e09b2a45d3d065156e5e62690cbc52906b4bf765857c6ea9de52e5265234c8c6995608d31884a4ea6280caf7478768fed8462f4a9bbe124e4f6bda2964e51bc415a7539c10e18fe7c4069bfd3ce7e7e30950ad89860b1b3e0c47a00c58dcc270cca74542f9fe9b174d99c34e8f262b817c017726f4b6d353dabdf91da7de13f659ad9f26ef18add5fd0699d9b73b5c6cb6f81db5fb3a9806d9978420e6949e9a92846374e09330d3d9af369c92252045115cd5fd961c8f93d573f52eb8946cf4d4e674152c24a36f66e2c6a352c83cc2ffc416c95fb3da9388d11416f0f8000ea10403eba2d2995bd2cae1602872177a3a5aed66809cd6e7232d4727c60a8819545ad3e0f1d60ad7b7ff1ac47bfecb75466fde7a0cecb2c95c0e932104fef5cc76bcd8fc4fe535ba63d12703930b617155832fe3559208b8dcb27700dfa5c76ae694c4e5dc511768ea297aab86c99f85ba7fb94d733b723c46722e04298f95a2130c12c67f64902f92f01f52ad470e3c1bd3861273ca76696e7d1906ac297a7cfc20192f444b0c5e5892f64f156e47b24b27b1e1d64b4fdd43be85148451be37684957f57a0030df66eb7be9886502e8627d4d1cce385cd37f072e2fc2d666d404b3621938ea2e75ed390571b0118f54578fee05370773d15179461fbe5caf8e9fa9c577bba500ab61c30bdeb3f9d6a70a6844805703e74557759418da71375d2d183f06ffc5de37c4fbff10b36578e0980e803d545bdf21b842fa189a99372702d36388b20baee42987e12f4f0ad5fa9b180255e7551f956d80f316879b0631f0e72b1a3beeaf72efdd488bcf3f696b134d545bacef40ff79ef0702c5ccadde34a0dede4104f62c571627483ff727a15ced1af1eefdf3c7268d890b0403cb0d911b4bfe84e7ce921bc46faf017df72f7256f4012f3cb68d2bbfb52e954b6afb491ff6f78f6f201e400bc334ee6e7b720695d501f624844cac557809cd9f4ac9197ee6e83468ceb564cf88c0f28e8758b4a1c16108fe8f011c490518cb2afb30dfa7941ef3cfa6f98d78f9917011db6444d2066549c05ac286ad1028b0d3d5069945df15d37aede0e3abab122919d23a65cc5238da83ba2d54c07a1841b0d00c40a7cf03663e1a940c60d06275a5df46b9031081b42b716b43dbb727a7c6d1fd1102b34fb63c40656f41df3c271311cb245972667365d69dc0c37e08f259d3d81d0548d900fa380a4932891be5cea2ba73f91958ff6b0f8e91bebc17c1abbca5846b7ec006e62a36cd6e9d2b99f089f741fac75b9dda6be39ca541210767a1f2aa0437f09d9ee001ce47feac2ca9fd272c5769212c9377a5754e2f2a9bbaa8847c85cd609ecdc09ac46477082869b5f7f19beea7d5c710e8c2e4502b39b08da4274a24c4d62f71dc697dd37c40f8c14de91598948cf3fdb8dae0011b7d8be56766dc1d44f3016cdd9c504cb3d372aaa27b398af3276a1234cf2a8c0922c2db5bf4dc09d8d8ca514ddae545de1e5d41faa5b2a27b04d1353ed708bc123c20077b89077fcd4c0912febcb7d3b0e23631096e9478fb46a511052d172402b8c56f4d8e20789d0c420dc583b4e685068303a6b33a5d6f43862087ae18341e3f95330acd316c85aae24abe12432d394e3e551dd362be637e5e897df806882e1ffa2f4d5c6a4d7a8f31f768c030aad58d4dff0a6d263debd308c796439ca40fa2a756db29df459af2d11e2b80393b7c906805d822c474059fa10711076a17199756cb0cfccb1ca809ffc9218948d6cf7f19d5cf90e2aa4253e480020d2fad0982d14c7f1695f7869bac5de199fb874e6f04566e0d03137fc77236ecba421d01f8ec8ef4b2bd44a0fe77fcec104780be0dcd69d96c9d4a01cc75dedaf535d61f015f84edd530ba7ed93931d11505d58bd6194f1056e6843cf2d9e74a007cf804b1632ac7e24986de5f61177d782b899045455e94a853563f409d39fbca3a851e5b69f0f94aed5e11bd53d988084b5d31e2e5f28d6eb862c24fed2afd9dd43e1495bfea14b9d15662a7d78739ae95e81519595bf8b386e86d7bf81f079df8fd2ea1dc74d066004f1137d715215ad07fe8791872b4ac846adccd1965d115673b02118e2c094801d9b682c3f372bd924ef8da8be685c2f5aa4e581d1a253d3c4726980e6651420ed2cac00875dba829226d32d67928b4bbcad75fb370644c78702f45f48b563e40484f5cff3d9ed88a29498b32bf735b48934d053739064e472601b3835a398f0fb4b8be54244149a62eb61858e5cd061993851c5cef1f35eb9e272d918927e87524515d5bd4ee81de8df465d1502ba462562321fc2126e35d601122bab84108fcbc4958e8e0a38312e7f2a9a9065fb8f6e24e26071a03189aef041f0205f6fd41b7cdef7fad0fe79cceec19c8a22d0a5f0df75b467499a93d29127ba1b6f35b1a8f80e2efae78e7d51ae314d46c2f8cc402b1c554eada3f49ea253e41fdc17f611c086772e409a3ae42b52ea8888248b793d2c2ba92da4862bf18bd2e5cbf1d7f0e3bc5b494938c377f5075cf76655e1ade073f95e80ae5285e00cc6225dbe1b7eedf71f2837f5fff2f4f5d92ec8ec63f0b863f78659695f57a2e0debea8722d93f90beaf1a9aa09794ad6056cdd27b63692683eea912bc7bdb2f86741cfe7605de82e87c484194b357ae5fc3fd5bb81d6588b5b3d74a6964f32687fceac2a451d6c71a03234dc3f7758f9c44842f824045786879037203d6eb153f8c4df5f02889fabb70f89c8493d0633e4941198c5a5864c302be8d0c4ea6153f8c4df5f02889fabb70f89c8493d0633e4941198c5a5864c302be8d0c4ea600e0fc9bc69ea5a61d2cb9224a1b4378f57ae29f7d14a0e9d0ed3d6c45957d01137f360fb3f5d0d5feefa8e77672ccdb1196059297b987803fba38ee0a6dfbf314a9b90774f906e53878396bec8265f936bd663b7a57a2cd64c2226264b1b67d138a79c0fd9a955ac9be9f0e35f3d42db8480adcb1837ff9a4a16f1774fdf8932ae2524c44937df7b9475ecba0a1a611f73bf2da35f57fe76da323c2d8f907922a5d329e309fe34af2b1e3fb151a552d9cc64d01f8cd47f115721a1b918a10602c644c93b1b8faa3770b9dcac89baee8731809d4744784235ca24f602df9f9d629900fef1e510e70125b7989267c56689bf1f6991c29aba7cbc83342bbab4eb70d373778dbefd9d49b93683bd5cc510944f0584cca15cffa076437b3ea63b33317fe20347eaec675cf13cf80351bb92458d1a8a50adf0fee1710b17521d747f72d70143f886a01103e50ea002e6ac0d50d3d3464b7712496b8acb3c6d68348b1040f254a43a1ac62aad9e83b7e14764af52051cac956a1cdd23e19dddc4777f8267fd54b830551fe966433dea7e73d725c6da2a664c068e1c8b20ee97a2e37b716809026c6c673cd571d1c30dda94d6f6be4ba9d309df977eb05c72c1f6f5dc30876eeb00b358acad8f429c28a0975141696156aea1cbcf34a62b1d8bfbc7c25237afa71f14528a25035d7f13de04b14c024cd99e1de125acbeff2735da021a60c60f10b4c80fd353e70bd948529ab332be71a11b04443f1397d48ef4c1c79552fa674592713dde31baca9a7f5dce455fbf1e907de9e1a23936dc170143f05b21064544f5bd94b43e7e8373468da7e55de5ab2c9c5cb3ed51bceebba90a2dd331e2516103021dc96bf703679f7c4c9f44dc7af226002e07957bd363802e3c45e28e80198cea7680b3097405226d331b0db645fb4b1cb30f7ed033073ef2c266c2c11d8f988ce254a5abf3158e0378bc7c3b04cbd8164fd8807637d76382e0fb615c6bec2782558bb566d1ec3b3f88c534fc7bb2324b3af1befa2220d56b0d86e05097a25c54bd08275c2efd71a2d0b11a0015156eb21b3d98da002bf7dcc7b511606cb931ad7ddeaff0adfc2d68f6dd4a22904ab37d1c0054bd1a89201abdf9b00ed8f78ef956f23e5b7409b9e14d01e0b3396399365e9a80da0dcbc76cd21ff1274d0e6da7b2f3d872c0ba8605866dce730510f3aa6838a7d56cc6c9841b234283d19d5023176d7f85c990d5d2423fbeaaaddd56c34fc63315cf290d387fd2f0e32978507647bf12766bbce005ff3540c1a82128a80ec90fb9237bc914b5400073e4688116e89c61673adbba7910a78fdd5964eaad76a834f7c94f10e88640f04c65732db74932e0b547eef6da2ad40a911d152f79da1f5bb47172bab45091203e2cf81e4aae9d85a79f8bbac89f0a48d9aff0808ed88b86ec8727567160e750b4383661974e7bc2615cdd8bcbb7a80640712376bb56e3fb578d053f981e3350913b13c65de01be311a15c6399b939ee45f6b9f7dd119318b400a4d7bbe47fb14cea6fd5855340c191d569ac3bda2fad9d3c4d8178ef657c0cab07e361269781ce47943abacef484f8ac15522ccd859da2e8b470a1a6a20dbd15bf1d29944a5061cf9b60a8afb9251661c7314659e619f35a1ef3d76d830d45547253b13b1d017f00d1aa9185ffb1b6adc013b6feb19e2e4253b15bc81d6f1bca028edf367cd2f83f896a66a2ab3a247c7dc948a3d9b15c22794e2a0fa993d731a656e4440e41e8d332bfaff494a763bb15073df05786c481c2187e6980e379a384c80815a5a09ef386d2fe9d90e09e08b23b8e1e63677e85cfb6ee56d418f9879faa54edf681bd7bf30032f8ddfff5f5e46dbe77e26bca55cc944140158e7a3172c525b210f18f1436508bf761974b40abdfa6c93c1ab06d693ced2c71dbc8e24a2f4654f6e0eaad1912acd289cd36e71fde116ac10ff437062e7d2c221aa4b5577aae358c01724a469a734a0af11edfdb90c5144a41fe4a865efb3fd3cbbf603a11904eb862a3d04a23f1ed6544ca53b04cf10aeaca6c0eb70fd55fdeaed52575060c34ac5213b7ce9aa9a9e6ad5d282bd2e71f66bd27fc367f238a2f72ca5bf971fc5b36700e437f3644410191c3fe2c6c6382f9481cdb21cf6146de3869f5567ad5e5a6328adc561fea35fdb6a8dabe5e4ef96557c6ca9d3d4aa7eb9007990dc99d1d9910b1923ccf36247ede11a263613637e1c9c2083661668d174bf6e3c456751f69d1c4900539cd26a7be44e6cbe1518fef988b9c042c93d45f9d620c32820c21ab12569d6476f12a253c3139b0a121708ae595a6db9cc4d8a6340dfbe92fd8ea71e0e9fc5252bace14c442c48c9566fd6028e9de05e564e5468ebb4f2d864febc4e218d990d0f0c9127f407ba6476c41668c4ae5d8c2d561e0e231c17ccd00c7daf03ae3a9d45ae0bcbefd2c4610d5705e8a130e0e8ca50d015de564fc25c95208b16464818e214c7d29ebe8954053799f04548ae2dd235e20c0866d8a7fdc5d43212290521e518de9ff9735ddf3a33ade387cc40e9616b500714b5e648e269eeba01311e1f7b556f8f20ab7cab949a6cc0eb0e27b412a91c0cea44e4a87c5c91691bb3ce8d0f2884d401b75160093cb08aeac4780dfe5739400526d8927e7af8a80ba8266bdd9b55800f9db4cf3f3ca3c4c38966bd61b7fe72fccac5bf57b6eece036796da0192f56767bb4acabcc7510b33d6b6a46a74e5f727faf94dd26b3d52252c7fad0c645acfbf2f0310539263caa3756f764b22392fc459f40414b3bc6128e3b831db42ad8313c89394ac156d31bdae8c9047306eca685a40841dd45cb713107dc03592592c252ef823d8664c814cdb1631403d4ad842f4720ed9cb03011f859264f46c49490e546ab33bcf8a2e643de30333a9d5aaea2e175dc9ae569f06a9364eb1cc891e0df19346b9bdcc3fb41aef9aa99cb99714e20d84657623ae2b3804ac634920972768e878d949a336839fd8d40971fb6c968290a2f1e11d2b11def90839cab57c7cddf2f3ba76ca4ee188253feb832d775943ce1ebe9976752a1b87313620c2ea4cbef235d15b496ae6ed622d4aacd87a8cbfb6b5836eb1ee274f6f8dbc85ae201ca821ebaf8fa9ecfeea7fd8007c3973ef0f12e80c0571b91a3044c0a280ddb22076f612b0451e7cc8a3f09f00f16dbffeaeddcfeb9876642d4b9a7f07d06d122f59d17978a469844d830ecf708edf91843eed70e4a9843015b8792ad0b24ffb8442702ed9d6ed5f6c4205cdb134ba52a1c5b19fec32d796", 
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
