// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TestSetupExecutive } from "../../TestSetup.t.sol";

import { Mandate } from "@src/Mandate.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { PowersErrors } from "@src/interfaces/PowersErrors.sol";

contract StatementOfIntentTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("StatementOfIntent: A mandate to propose actions without execution.", daoMock);
    }

    function testStatementOfIntentRequestWorks() public {
        description = "Proposing an action via StatementOfIntent";
        mandateCalldata = abi.encode(true);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, description);

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        PowersTypes.ActionState actionState = daoMock.getActionState(actionId);
        assertEq(uint8(actionState), uint8(PowersTypes.ActionState.Fulfilled));
    }

    function testStatementOfIntentDoesNotExecutePayload() public {
        // Prepare payload that would mint tokens if executed
        callData = abi.encodeWithSignature("mint(uint256,address)", 100, alice);

        targets = new address[](1);
        targets[0] = address(simpleErc1155);

        values = new uint256[](1);
        values[0] = 0;

        calldatas = new bytes[](1);
        calldatas[0] = callData;

        mandateCalldata = abi.encode(targets, values, calldatas);
        nonce = 999;

        balanceBefore = simpleErc1155.balanceOf(alice, 0);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Try to mint");

        balanceAfter = simpleErc1155.balanceOf(alice, 0);

        // Assert balance did NOT change
        assertEq(balanceAfter, balanceBefore, "StatementOfIntent should not execute the payload");
    }
}

contract OpenActionTest is TestSetupExecutive {
    event CoinsMinted(address indexed to, uint256 amount);

    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("OpenAction: A mandate to execute any action with full power.", daoMock);
    }

    ////////////////////////////////////////////////////////////////
    //                     EXECUTE OPEN ACTION FLOW               //
    ////////////////////////////////////////////////////////////////

    function testOpenActionExecuteExternal() public {
        // 1. Prepare calldata for external action (Mint coins on SimpleErc1155)
        mintAmount = 100;
        callData = abi.encodeWithSelector(bytes4(keccak256("mint(uint256,address)")), mintAmount, alice);

        // 2. Prepare mandate inputs
        targets = new address[](1);
        targets[0] = address(simpleErc1155);

        values = new uint256[](1);
        values[0] = 0;

        calldatas = new bytes[](1);
        calldatas[0] = callData;

        // Encode mandate calldata
        // OpenAction expects: abi.encode(address[] targets, uint256[] values, bytes[] calldatas)
        mandateCalldata = abi.encode(targets, values, calldatas);

        description = "Minting coins via OpenAction";

        // 3. Execute request (OpenAction allows immediate execution by public)
        // Verify balance before
        balanceBefore = simpleErc1155.balanceOf(alice, 0);

        vm.prank(alice); // Alice can execute as allowedRole is max (public)
        daoMock.request(mandateId, mandateCalldata, nonce, description);

        // 4. Verify result
        balanceAfter = simpleErc1155.balanceOf(alice, 0);
        assertEq(balanceAfter, balanceBefore + mintAmount, "Balance should increase by mint amount");
    }

    function testOpenActionExecuteMultipleExternalActions() public {
        // Execute two actions: Mint coins twice
        mintAmount = 50;
        callData = abi.encodeWithSelector(bytes4(keccak256("mint(uint256,address)")), mintAmount, alice);

        targets = new address[](2);
        targets[0] = address(simpleErc1155);
        targets[1] = address(simpleErc1155);

        values = new uint256[](2);
        values[0] = 0;
        values[1] = 0;

        calldatas = new bytes[](2);
        calldatas[0] = callData;
        calldatas[1] = callData;

        mandateCalldata = abi.encode(targets, values, calldatas);
        nonce = 222;

        balanceBefore = simpleErc1155.balanceOf(alice, 0);

        vm.prank(bob);
        daoMock.request(mandateId, mandateCalldata, nonce, "Double Mint");

        balanceAfter = simpleErc1155.balanceOf(alice, 0);
        assertEq(balanceAfter, balanceBefore + (mintAmount * 2), "Balance should increase by 2x mint amount");
    }

    function testOpenActionRevertsIfCalldataMalformed() public {
        // Send random bytes that cannot be decoded as (address[], uint256[], bytes[])
        mandateCalldata = abi.encode("random string");

        vm.prank(alice);
        vm.expectRevert(); // Should revert during decoding in OpenAction.handleRequest
        daoMock.request(mandateId, mandateCalldata, nonce, "Malformed call");
    }
}

contract BespokeAction_SimpleTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("BespokeAction_Simple: A mandate to execute a simple function call.", daoMock);
    }

    function testSimpleExecute() public {
        mintAmount = 50;
        // In this mandate, mandateCalldata is appended directly to the selector.
        // mint takes one uint256 parameter.
        mandateCalldata = abi.encode(mintAmount, alice);

        balanceBefore = simpleErc1155.balanceOf(alice, 0);

        vm.prank(alice); // Alice has Role 1, which is allowed
        daoMock.request(mandateId, mandateCalldata, nonce, "Mint 50 coins");

        balanceAfter = simpleErc1155.balanceOf(alice, 0);
        assertEq(balanceAfter, balanceBefore + mintAmount, "Balance should increase by minted amount");
    }

    function testSimpleRevertsUnauthorized() public {
        // Frank does not have Role 1
        mandateCalldata = abi.encode(100);

        vm.prank(frank);
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Unauthorized request");
    }
}

contract BespokeAction_AdvancedTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "BespokeAction_Advanced: A mandate to execute complex function calls with mixed parameters.", daoMock
        );
    }

    function testAdvancedExecute() public {
        // Configured to call assignRole(ROLE_ONE, address account)
        // Static param: ROLE_ONE (1)
        // Dynamic param: address account

        newMember = makeAddr("newMember");

        // Verify initial state
        assertEq(daoMock.hasRoleSince(newMember, ROLE_ONE), 0);

        vm.prank(alice); // Alice has Role 1, which is allowed
        daoMock.request(mandateId, abi.encode(newMember), nonce, "Assign Role");

        // Verify execution result
        assertNotEq(daoMock.hasRoleSince(newMember, ROLE_ONE), 0, "Role should be assigned");
    }

    function testAdvancedRevertsUnauthorized() public {
        vm.prank(frank); // Frank does not have Role 1
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, abi.encode(alice), nonce, "Unauthorized request");
    }
}

contract PresetActionsTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("PresetActions: A mandate to execute preset actions.", daoMock);
    }

    function testPresetExecute() public {
        // Verify initial state
        assertEq(daoMock.getRoleLabel(ROLE_ONE), "");
        assertEq(daoMock.getRoleLabel(ROLE_TWO), "");

        // PresetActions ignores the content of calldata (except for hashing)
        mandateCalldata = abi.encode(true);

        vm.prank(alice); // Alice has Role 1
        daoMock.request(mandateId, mandateCalldata, nonce, "Execute Preset Action");

        // Verify execution
        assertEq(daoMock.getRoleLabel(ROLE_ONE), "Member");
        assertEq(daoMock.getRoleLabel(ROLE_TWO), "Delegate");

        // Check action state
        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }

    function testPresetRevertsUnauthorized() public {
        mandateCalldata = abi.encode(true);

        vm.prank(frank); // Frank does not have Role 1
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Unauthorized");
    }

    function testPresetSelfRevokesAfterExecution() public {
        // Mandate is active before execution.
        (,, bool activeBefore) = daoMock.getAdoptedMandate(mandateId);
        assertTrue(activeBefore);

        mandateCalldata = abi.encode(true);

        vm.prank(alice); // Alice has Role 1
        daoMock.request(mandateId, mandateCalldata, nonce, "Execute Preset Action");

        // Preset action still ran.
        assertEq(daoMock.getRoleLabel(ROLE_ONE), "Member");
        assertEq(daoMock.getRoleLabel(ROLE_TWO), "Delegate");

        // Mandate revoked itself: it is now inactive.
        (,, bool activeAfter) = daoMock.getAdoptedMandate(mandateId);
        assertFalse(activeAfter);
    }

    function testPresetCannotBeExecutedTwice() public {
        mandateCalldata = abi.encode(true);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "First execution");

        // Second request reverts because the mandate revoked itself.
        vm.prank(alice);
        vm.expectRevert(PowersErrors.Powers__MandateNotActive.selector);
        daoMock.request(mandateId, mandateCalldata, nonce + 1, "Second execution");
    }
}

contract BespokeAction_OnReturnValueTest is TestSetupExecutive {
    event Consumed(uint256 value);

    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "BespokeAction_OnReturnValue: Execute a call using return value of previous mandate call.", daoMock
        );
    }

    function testExecuteWithReturnValue() public {
        // 1. Execute Parent Action (BespokeActionReturner - ID 9)
        uint16 parentMandateId = findMandateIdInOrg("BespokeActionReturner: Returns a value for testing.", daoMock);
        bytes memory emptyCalldata = "";
        uint256 testNonce = 12_345;

        vm.prank(alice);
        daoMock.request(parentMandateId, emptyCalldata, testNonce, "Parent Action");

        // Verify parent action fulfilled
        uint256 parentActionId = MandateUtilities.computeActionId(parentMandateId, emptyCalldata, testNonce);
        assertEq(uint8(daoMock.getActionState(parentActionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // 2. Execute Child Action (BespokeAction_OnReturnValue - ID 10)
        // Must use SAME calldata and nonce as parent

        vm.expectEmit(true, true, true, true);
        emit Consumed(42); // Expect 42 from ReturnDataMock.getValue()

        vm.prank(alice);
        daoMock.request(mandateId, emptyCalldata, testNonce, "Child Action");

        // Verify child action fulfilled
        actionId = MandateUtilities.computeActionId(mandateId, emptyCalldata, testNonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }
}

// ─────────────────────────────────────────────
//           EXTERNAL ACTION FLEXIBLE
// ─────────────────────────────────────────────
contract ExternalAction_FlexibleTest is TestSetupExecutive {
    uint16 targetMandateId;

    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "ExternalAction_Flexible: A mandate to flexibly execute actions on another Powers instance.", daoMock
        );
        targetMandateId =
            findMandateIdInOrg("StatementOfIntent: A mandate to propose actions without execution.", daoMock);
    }

    // ─────────────────────────────────────────────
    //               BASIC BEHAVIOUR
    // ─────────────────────────────────────────────

    function testFlexibleActionExecutesOnTargetPowers() public {
        // ExternalAction_Flexible calls StatementOfIntent back on daoMock itself.
        // StatementOfIntent has PUBLIC_ROLE so daoMock (the caller) is allowed.
        bytes memory innerCalldata = abi.encode(true);
        mandateCalldata = abi.encode(address(daoMock), targetMandateId, innerCalldata);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Flexible to StatementOfIntent");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        uint256 innerActionId = MandateUtilities.computeActionId(targetMandateId, innerCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(innerActionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }

    // ─────────────────────────────────────────────
    //               EDGE CASES
    // ─────────────────────────────────────────────

    function testInitializeMandatePrependsSystemParams() public view {
        (address mandateAddress,,) = daoMock.getAdoptedMandate(mandateId);
        bytes memory rawParams = Mandate(mandateAddress).getInputParams(address(daoMock), mandateId);
        string[] memory storedParams = abi.decode(rawParams, (string[]));
        assertEq(storedParams[0], "address PowersTarget");
        assertEq(storedParams[1], "uint16 MandateIdTarget");
        assertEq(storedParams.length, 2, "No extra params: config was empty string[]");
    }

    function testFlexibleActionRevertsIfCalldataMalformed() public {
        // Bytes that cannot be decoded as (address, uint16, bytes) cause a revert in handleRequest.
        mandateCalldata = abi.encode("not a valid payload");

        vm.prank(alice);
        vm.expectRevert();
        daoMock.request(mandateId, mandateCalldata, nonce, "Malformed calldata");
    }

    // ─────────────────────────────────────────────
    //               ACCESS CONTROL
    // ─────────────────────────────────────────────

    function testFlexibleActionRevertsIfCallerLacksRole() public {
        mandateCalldata = abi.encode(address(daoMock), targetMandateId, abi.encode(true));

        vm.prank(frank); // frank holds no role — allowedRole is 1
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Unauthorized");
    }
}

// ─────────────────────────────────────────────
//         CHECK EXTERNAL ACTION STATE
// ─────────────────────────────────────────────
contract CheckExternalActionStateBasicTest is TestSetupExecutive {
    uint16 parentMandateId;

    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "CheckExternalActionState: Checks if an action is fulfilled on a parent contract.", daoMock
        );
        parentMandateId =
            findMandateIdInOrg("StatementOfIntent: A mandate to propose actions without execution.", daoMock);
    }

    // ─────────────────────────────────────────────
    //               BASIC BEHAVIOUR
    // ─────────────────────────────────────────────

    function testCheckExternalActionStateWorks() public {
        mandateCalldata = abi.encode(true);

        // Fulfill the parent StatementOfIntent with the same calldata+nonce the gate will check
        vm.prank(alice);
        daoMock.request(parentMandateId, mandateCalldata, nonce, "Parent: StatementOfIntent");

        uint256 parentActionId = MandateUtilities.computeActionId(parentMandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(parentActionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // Gate should now pass: the remote action is Fulfilled
        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Gate: CheckExternalActionState");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }

    function testCheckExternalActionStateNoSideEffects() public {
        // Gate returns empty arrays — no external state should change
        mandateCalldata = abi.encode(true);
        nonce = 777;

        vm.prank(alice);
        daoMock.request(parentMandateId, mandateCalldata, nonce, "Parent");

        balanceBefore = simpleErc1155.balanceOf(alice, 0);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Gate");

        balanceAfter = simpleErc1155.balanceOf(alice, 0);
        assertEq(balanceAfter, balanceBefore, "Gate mandate must not execute any external calls");
    }
}

// ─────────────────────────────────────────────
//   CHECK EXTERNAL ACTION STATE — REVERTS
// ─────────────────────────────────────────────
contract CheckExternalActionStateRevertTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "CheckExternalActionState: Checks if an action is fulfilled on a parent contract.", daoMock
        );
    }

    // ─────────────────────────────────────────────
    //              REVERT CONDITIONS
    // ─────────────────────────────────────────────

    function testCheckExternalActionStateRevertsIfParentNotFulfilled() public {
        // Parent action never executed — gate must block with "Action not fulfilled"
        mandateCalldata = abi.encode(true);

        vm.prank(alice);
        vm.expectRevert();
        daoMock.request(mandateId, mandateCalldata, nonce, "Gate without fulfilled parent");
    }
}

/////////////////////////////////////////////////////////////////////
//                  PRESET ACTIONS ON OWN POWERS                   //
/////////////////////////////////////////////////////////////////////

// ─────────────────────────────────────────────
//               BASIC BEHAVIOUR
// ─────────────────────────────────────────────
contract PresetActionsOnOwnPowersBasicTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "PresetActions_OnOwnPowers: A mandate to execute preset calls on the DAO itself.", daoMock
        );
    }

    function testPresetActionsOnOwnPowersExecutesCallOnDao() public {
        // Config bakes in labelRole(3, "Council", "") — verify the label changes on daoMock
        assertEq(daoMock.getRoleLabel(3), "");

        mandateCalldata = abi.encode(true); // calldata unused by handleRequest

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Label role 3 as Council");

        assertEq(daoMock.getRoleLabel(3), "Council");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }

    function testPresetActionsOnOwnPowersTargetIsAlwaysPowers() public {
        // handleRequest must set targets[i] = powers for every call — never an external address
        (address mandateAddress,,) = daoMock.getAdoptedMandate(mandateId);
        bytes memory rawConfig = Mandate(mandateAddress).getConfig(address(daoMock), mandateId);
        bytes[] memory callDatas = abi.decode(rawConfig, (bytes[]));

        // Executing the mandate proves the target resolves to daoMock (Powers contract itself).
        // If targets[i] were anything else, the labelRole call would not affect daoMock state.
        mandateCalldata = abi.encode(true);
        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Target is DAO");

        assertEq(daoMock.getRoleLabel(3), "Council", "Call was not routed to daoMock");
        assertEq(callDatas.length, 1);
    }
}

// ─────────────────────────────────────────────
//               EDGE CASES
// ─────────────────────────────────────────────
contract PresetActionsOnOwnPowersEdgeCaseTest is TestSetupExecutive {
    function testPresetActionsOnOwnPowersEmptyCallDatasSucceeds() public {
        mandateId = findMandateIdInOrg("PresetActions_OnOwnPowers: empty callDatas.", daoMock);
        mandateCalldata = abi.encode(true);

        uint16 counterBefore = daoMock.mandateCounter();

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Empty callDatas");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // No calls were made — DAO state must be unchanged
        assertEq(daoMock.mandateCounter(), counterBefore);
        assertEq(daoMock.getRoleLabel(3), "");
    }
}

// ─────────────────────────────────────────────
//               ACCESS CONTROL
// ─────────────────────────────────────────────
contract PresetActionsOnOwnPowersAccessTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "PresetActions_OnOwnPowers: A mandate to execute preset calls on the DAO itself.", daoMock
        );
        mandateCalldata = abi.encode(true);
    }

    function testPresetActionsOnOwnPowersRevertsIfCallerLacksRole() public {
        // charlotte holds ROLE_TWO; mandate requires ROLE_ONE
        vm.prank(charlotte);
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Charlotte attempts DAO call");
    }

    function testPresetActionsOnOwnPowersRevertsForUnassignedCaller() public {
        // frank has no roles at all
        vm.prank(frank);
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Frank attempts DAO call");
    }
}

/////////////////////////////////////////////////////////////////////
//                EXTERNAL ACTION ON RETURN VALUE                  //
/////////////////////////////////////////////////////////////////////

// ─────────────────────────────────────────────
//               BASIC BEHAVIOUR
// ─────────────────────────────────────────────
contract ExternalAction_OnReturnValueBasicTest is TestSetupExecutive {
    uint16 parentMandateId;
    uint16 targetMandateId;

    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "ExternalAction_OnReturnValue: Forward parent return value to an external Powers instance.", daoMock
        );
        parentMandateId = findMandateIdInOrg("BespokeActionReturner: Returns a value for testing.", daoMock);
        targetMandateId =
            findMandateIdInOrg("StatementOfIntent: A mandate to propose actions without execution.", daoMock);
    }

    function testInitializeMandatePrependsSystemParams() public view {
        (address mandateAddress,,) = daoMock.getAdoptedMandate(mandateId);
        bytes memory rawParams = Mandate(mandateAddress).getInputParams(address(daoMock), mandateId);
        string[] memory storedParams = abi.decode(rawParams, (string[]));
        assertEq(storedParams.length, 3, "Should have 2 system params + 1 user param");
        assertEq(storedParams[0], "address PowersTarget");
        assertEq(storedParams[1], "uint16 MandateIdTarget");
        assertEq(storedParams[2], "uint256 Value");
    }

    function testHandleRequestForwardsReturnValueToExternalPowers() public {
        // mandateCalldata encodes (PowersTarget, MandateIdTarget) — shared by the parent call and
        // the ExternalAction_OnReturnValue call so that parentActionId resolves correctly
        mandateCalldata = abi.encode(address(daoMock), targetMandateId);
        uint256 testNonce = 55_555;

        // 1. Execute parent to store return data (getValue() returns 42)
        vm.prank(alice);
        daoMock.request(parentMandateId, mandateCalldata, testNonce, "Parent: get return value");

        uint256 parentActionId = MandateUtilities.computeActionId(parentMandateId, mandateCalldata, testNonce);
        assertEq(uint8(daoMock.getActionState(parentActionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // 2. Execute ExternalAction_OnReturnValue — reads parent return data, calls daoMock.request(StatementOfIntent, ...)
        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, testNonce, "Forward return value");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, testNonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // 3. Verify the forwarded inner request fulfilled StatementOfIntent on daoMock
        bytes memory returnData = daoMock.getActionReturnData(parentActionId, 0);
        uint256 innerActionId = MandateUtilities.computeActionId(targetMandateId, returnData, testNonce);
        assertEq(uint8(daoMock.getActionState(innerActionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }
}

// ─────────────────────────────────────────────
//               EDGE CASES
// ─────────────────────────────────────────────
contract ExternalAction_OnReturnValueEdgeCaseTest is TestSetupExecutive {
    uint16 targetMandateId;

    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "ExternalAction_OnReturnValue: Forward parent return value to an external Powers instance.", daoMock
        );
        targetMandateId =
            findMandateIdInOrg("StatementOfIntent: A mandate to propose actions without execution.", daoMock);
    }

    function testHandleRequestRevertsIfCalldataMalformed() public {
        mandateCalldata = abi.encode("not a valid payload");

        vm.prank(alice);
        vm.expectRevert();
        daoMock.request(mandateId, mandateCalldata, nonce, "Malformed calldata");
    }

    function testHandleRequestRevertsIfParentNotExecuted() public {
        // Parent action has no return data — getActionReturnData panics with array OOB
        mandateCalldata = abi.encode(address(daoMock), targetMandateId);

        vm.prank(alice);
        vm.expectRevert();
        daoMock.request(mandateId, mandateCalldata, nonce, "Parent not executed");
    }
}

// ─────────────────────────────────────────────
//               ACCESS CONTROL
// ─────────────────────────────────────────────
contract ExternalAction_OnReturnValueAccessTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "ExternalAction_OnReturnValue: Forward parent return value to an external Powers instance.", daoMock
        );
    }

    function testHandleRequestRevertsIfCallerLacksRole() public {
        mandateCalldata = abi.encode(address(daoMock), uint16(1));

        vm.prank(frank); // frank holds no role — mandate requires ROLE_ONE
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Unauthorized");
    }
}

/////////////////////////////////////////////////////////////////////
//                     EXTERNAL ACTION SIMPLE                       //
/////////////////////////////////////////////////////////////////////

// ─────────────────────────────────────────────
//               BASIC BEHAVIOUR
// ─────────────────────────────────────────────
contract ExternalAction_SimpleBasicTest is TestSetupExecutive {
    uint16 targetMandateId;

    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "ExternalAction_Simple: Forward calldata to a preset mandate on another Powers instance.", daoMock
        );
        targetMandateId =
            findMandateIdInOrg("StatementOfIntent: A mandate to propose actions without execution.", daoMock);
    }

    function testSimpleExternalActionExecutesOnTargetPowers() public {
        // Config bakes in (daoMock, StatementOfIntent): the request is forwarded there.
        mandateCalldata = abi.encode(true);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Simple external action");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // The inner request on the target mandate must also be fulfilled.
        uint256 innerActionId = MandateUtilities.computeActionId(targetMandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(innerActionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }

    function testSimpleExternalActionForwardsCalldataUnchanged() public {
        // The inner action id derives from the exact calldata + nonce passed in; if the mandate
        // altered either, this id would not resolve to a fulfilled action.
        mandateCalldata = abi.encode(uint256(42), alice);
        nonce = 888;

        vm.prank(bob);
        daoMock.request(mandateId, mandateCalldata, nonce, "Forward calldata unchanged");

        uint256 innerActionId = MandateUtilities.computeActionId(targetMandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(innerActionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }
}

// ─────────────────────────────────────────────
//               EDGE CASES
// ─────────────────────────────────────────────
contract ExternalAction_SimpleEdgeCaseTest is TestSetupExecutive {
    uint16 targetMandateId;

    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "ExternalAction_Simple: Forward calldata to a preset mandate on another Powers instance.", daoMock
        );
        targetMandateId =
            findMandateIdInOrg("StatementOfIntent: A mandate to propose actions without execution.", daoMock);
    }

    function testInitializeMandateStoresConfiguredParams() public view {
        // Unlike ExternalAction_Flexible, no system params are prepended: the target Powers and
        // mandate id are baked into config, so inputParams is exactly the configured Params array.
        (address mandateAddress,,) = daoMock.getAdoptedMandate(mandateId);
        bytes memory rawParams = Mandate(mandateAddress).getInputParams(address(daoMock), mandateId);
        string[] memory storedParams = abi.decode(rawParams, (string[]));
        assertEq(storedParams.length, 1, "Only the configured params should be stored");
        assertEq(storedParams[0], "bool Confirm");
    }

    function testSimpleExternalActionWorksWithEmptyCalldata() public {
        // Calldata is passed through opaquely; the target StatementOfIntent accepts any payload.
        mandateCalldata = "";

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Empty calldata passthrough");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        uint256 innerActionId = MandateUtilities.computeActionId(targetMandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(innerActionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }
}

// ─────────────────────────────────────────────
//               ACCESS CONTROL
// ─────────────────────────────────────────────
contract ExternalAction_SimpleAccessTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg(
            "ExternalAction_Simple: Forward calldata to a preset mandate on another Powers instance.", daoMock
        );
    }

    function testSimpleExternalActionRevertsIfCallerLacksRole() public {
        vm.prank(frank); // frank holds no role — mandate requires ROLE_ONE
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, abi.encode(true), nonce, "Unauthorized");
    }

    function testSimpleExternalActionRevertsIfCallerHasWrongRole() public {
        vm.prank(charlotte); // charlotte holds ROLE_TWO — mandate requires ROLE_ONE
        vm.expectRevert(PowersErrors.Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, abi.encode(true), nonce, "Wrong role");
    }
}
