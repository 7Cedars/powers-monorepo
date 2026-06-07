// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { TestSetupReform } from "../../TestSetup.t.sol";

import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { PowersErrors } from "@src/interfaces/PowersErrors.sol";
import { PowersMock } from "../../mocks/PowersMock.sol";

// ─────────────────────────────────────────────
//               BASIC BEHAVIOUR
// ─────────────────────────────────────────────
contract PauseMandatesBasicTest is TestSetupReform {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("PauseMandates: pause or restart mandates in flow.", daoMock);
    }

    function testPauseMandatesWorks() public {
        // Verify SelfSelect (mandateId=1) is active before pause
        (,, bool activeBefore) = daoMock.getAdoptedMandate(1);
        assertTrue(activeBefore);

        mandateCalldata = abi.encode(true); // paused=true

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Pause SelfSelect");

        // SelfSelect should now be revoked (inactive)
        (,, bool activeAfter) = daoMock.getAdoptedMandate(1);
        assertFalse(activeAfter);

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }

    function testRestartMandatesWorks() public {
        // Step 1: pause SelfSelect (nonce=123)
        mandateCalldata = abi.encode(true);
        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Pause SelfSelect");

        (,, bool pausedState) = daoMock.getAdoptedMandate(1);
        assertFalse(pausedState);

        // Step 2: restart SelfSelect (nonce=456 to avoid ActionAlreadyInitiated)
        // After 4 mandates are constituted, mandateCounter=5; restart creates mandateId=5
        mandateCalldata = abi.encode(false); // paused=false
        nonce = 456;

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Restart SelfSelect");

        // A new SelfSelect should now be adopted at mandateId=5
        (,, bool restartedActive) = daoMock.getAdoptedMandate(5);
        assertTrue(restartedActive);

        // flow[0][0] should now point to the new mandateId=5
        uint16[] memory flowMandates = daoMock.getFlowMandatesAtIndex(0);
        assertEq(flowMandates[0], 5);

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }

    function testInitializeMandateRevertsOnArrayLengthMismatch() public {
        // Use a fresh DAO to test constitute-time config validation
        PowersMock freshDao = new PowersMock();

        uint8[] memory indexFlow_ = new uint8[](2); // length 2
        uint8[] memory indexMandate_ = new uint8[](1); // length 1 — mismatch
        indexFlow_[0] = 0;
        indexFlow_[1] = 1;
        indexMandate_[0] = 0;

        PowersTypes.Conditions memory cond;
        cond.allowedRole = 1;

        PowersTypes.MandateInitData[] memory initData = new PowersTypes.MandateInitData[](1);
        initData[0] = PowersTypes.MandateInitData({
            nameDescription: "PauseMandates: mismatched arrays",
            targetMandate: findMandateAddress("PauseMandates"),
            config: abi.encode(indexFlow_, indexMandate_),
            conditions: cond
        });

        vm.expectRevert(bytes("Array length mismatch"));
        freshDao.constitute(initData);
    }
}

// ─────────────────────────────────────────────
//               EDGE CASES
// ─────────────────────────────────────────────
contract PauseMandatesEdgeCaseTest is TestSetupReform {
    function testRestartAlreadyActiveMandateSkipsWithNoEffect() public {
        // Calling restart (paused=false) when the mandate is already active should produce 0 calls
        mandateId = findMandateIdInOrg("PauseMandates: pause or restart mandates in flow.", daoMock);
        mandateCalldata = abi.encode(false); // paused=false on an already-active mandate

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Restart already-active mandate");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // SelfSelect (mandateId=1) should still be active — no state change
        (,, bool active) = daoMock.getAdoptedMandate(1);
        assertTrue(active);

        // flow[0][0] should still point to mandateId=1 — no change
        uint16[] memory flowMandates = daoMock.getFlowMandatesAtIndex(0);
        assertEq(flowMandates[0], 1);
    }

    function testPauseWithInvalidFlowIndexSkipsGracefully() public {
        // PauseMandates configured with flow index 99 (does not exist) skips via try/catch
        mandateId = findMandateIdInOrg("PauseMandates: invalid flow index.", daoMock);
        mandateCalldata = abi.encode(true); // paused=true

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Pause with invalid flow index");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // SelfSelect is unaffected — still active
        (,, bool active) = daoMock.getAdoptedMandate(1);
        assertTrue(active);
    }

    function testPauseWithOutOfBoundsMandateIndexSkipsGracefully() public {
        // PauseMandates configured with valid flow[0] but mandate index 99 (flow has only 1 entry)
        mandateId = findMandateIdInOrg("PauseMandates: out-of-bounds mandate index.", daoMock);
        mandateCalldata = abi.encode(true); // paused=true

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Pause with OOB mandate index");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // SelfSelect is unaffected — still active
        (,, bool active) = daoMock.getAdoptedMandate(1);
        assertTrue(active);
    }
}

// ─────────────────────────────────────────────
//               ACCESS CONTROL
// ─────────────────────────────────────────────
contract PauseMandatesAccessTest is TestSetupReform {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("PauseMandates: pause or restart mandates in flow.", daoMock);
        mandateCalldata = abi.encode(true);
    }

    function testPauseMandatesRevertsForCallerWithWrongRole() public {
        // charlotte has ROLE_TWO; mandate requires ROLE_ONE
        vm.prank(charlotte);
        vm.expectRevert(Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Charlotte attempts pause");
    }

    function testPauseMandatesRevertsForCallerWithNoRole() public {
        // eve has no roles at all
        vm.prank(eve);
        vm.expectRevert(Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Eve attempts pause");
    }
}
