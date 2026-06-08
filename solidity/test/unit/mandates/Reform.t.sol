// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { TestSetupReform, TestSetupExecutive } from "../../TestSetup.t.sol";

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

/////////////////////////////////////////////////////////////////////
//                        ADOPT_MANDATES                           //
/////////////////////////////////////////////////////////////////////

// ─────────────────────────────────────────────
//               BASIC BEHAVIOUR
// ─────────────────────────────────────────────
contract AdoptMandatesBasicTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("Adopt_Mandates: A mandate to adopt new mandates into the DAO.", daoMock);
    }

    function testAdoptMandatesAdoptsSingleMandate() public {
        address[] memory mandatesArr = new address[](1);
        mandatesArr[0] = findMandateAddress("SelfSelect");
        uint256[] memory roleIdsArr = new uint256[](1);
        roleIdsArr[0] = ROLE_ONE;

        mandateCalldata = abi.encode(mandatesArr, roleIdsArr);
        uint16 counterBefore = daoMock.mandateCounter();

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Adopt SelfSelect");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
        assertEq(daoMock.mandateCounter(), counterBefore + 1);

        (address adoptedAddr,, bool active) = daoMock.getAdoptedMandate(counterBefore);
        assertEq(adoptedAddr, mandatesArr[0]);
        assertTrue(active);
    }

    function testAdoptMandatesAdoptsMultipleMandates() public {
        address[] memory mandatesArr = new address[](2);
        mandatesArr[0] = findMandateAddress("SelfSelect");
        mandatesArr[1] = findMandateAddress("RenounceRole");
        uint256[] memory roleIdsArr = new uint256[](2);
        roleIdsArr[0] = ROLE_ONE;
        roleIdsArr[1] = ROLE_TWO;

        mandateCalldata = abi.encode(mandatesArr, roleIdsArr);
        uint16 counterBefore = daoMock.mandateCounter();

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Adopt two mandates");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
        assertEq(daoMock.mandateCounter(), counterBefore + 2);

        (address addr0,, bool active0) = daoMock.getAdoptedMandate(counterBefore);
        (address addr1,, bool active1) = daoMock.getAdoptedMandate(uint16(counterBefore + 1));
        assertEq(addr0, mandatesArr[0]);
        assertTrue(active0);
        assertEq(addr1, mandatesArr[1]);
        assertTrue(active1);
    }
}

// ─────────────────────────────────────────────
//               EDGE CASES
// ─────────────────────────────────────────────
contract AdoptMandatesEdgeCaseTest is TestSetupExecutive {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("Adopt_Mandates: A mandate to adopt new mandates into the DAO.", daoMock);
    }

    function testAdoptMandatesWithEmptyArraysFulfills() public {
        address[] memory mandatesArr = new address[](0);
        uint256[] memory roleIdsArr = new uint256[](0);

        mandateCalldata = abi.encode(mandatesArr, roleIdsArr);
        uint16 counterBefore = daoMock.mandateCounter();

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Adopt zero mandates");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
        assertEq(daoMock.mandateCounter(), counterBefore);
    }
}

// ─────────────────────────────────────────────
//               ACCESS CONTROL
// ─────────────────────────────────────────────
contract AdoptMandatesAccessTest is TestSetupExecutive {
    function testAdoptMandatesRevertsIfCallerLacksRole() public {
        // Deploy a fresh DAO with Adopt_Mandates restricted to ROLE_ONE
        PowersMock freshDao = new PowersMock();

        PowersTypes.Conditions memory cond;
        cond.allowedRole = ROLE_ONE;

        PowersTypes.MandateInitData[] memory initData = new PowersTypes.MandateInitData[](1);
        initData[0] = PowersTypes.MandateInitData({
            nameDescription: "Adopt_Mandates: restricted to role 1.",
            targetMandate: findMandateAddress("Adopt_Mandates"),
            config: abi.encode(),
            conditions: cond
        });

        freshDao.constitute(initData);
        freshDao.closeConstitute();

        vm.prank(address(freshDao));
        freshDao.assignRole(ROLE_ONE, alice);

        address[] memory mandatesArr = new address[](1);
        mandatesArr[0] = findMandateAddress("SelfSelect");
        uint256[] memory roleIdsArr = new uint256[](1);
        roleIdsArr[0] = type(uint256).max;
        mandateCalldata = abi.encode(mandatesArr, roleIdsArr);

        uint16 restrictedId = findMandateIdInOrg("Adopt_Mandates: restricted to role 1.", Powers(payable(address(freshDao))));

        // charlotte has no roles in freshDao — must be rejected
        vm.prank(charlotte);
        vm.expectRevert(Powers__CannotCallMandate.selector);
        freshDao.request(restrictedId, mandateCalldata, nonce, "Charlotte attempts adoption");
    }

    function testAdoptMandatesSucceedsForCallerWithPublicRole() public {
        // In the executive constitution, Adopt_Mandates has allowedRole = type(uint256).max — any caller passes
        mandateId = findMandateIdInOrg("Adopt_Mandates: A mandate to adopt new mandates into the DAO.", daoMock);

        address[] memory mandatesArr = new address[](1);
        mandatesArr[0] = findMandateAddress("SelfSelect");
        uint256[] memory roleIdsArr = new uint256[](1);
        roleIdsArr[0] = type(uint256).max;
        mandateCalldata = abi.encode(mandatesArr, roleIdsArr);

        // eve has no assigned roles — public mandate must still let her through
        vm.prank(eve);
        daoMock.request(mandateId, mandateCalldata, nonce, "Eve adopts a mandate");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }
}
