// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import {
    TestSetupReform,
    TestSetupExecutive,
    TestSetupMandatePackageStatic,
    TestSetupRevokeMandates
} from "../../TestSetup.t.sol";

import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";
import { Powers } from "@src/Powers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { PowersErrors } from "@src/interfaces/PowersErrors.sol";
import { PowersMock } from "../../mocks/PowersMock.sol";
import { MandatePackage } from "@src/mandates/reform/MandatePackage.sol";

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

        uint16 restrictedId =
            findMandateIdInOrg("Adopt_Mandates: restricted to role 1.", Powers(payable(address(freshDao))));

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

/////////////////////////////////////////////////////////////////////
//                    MANDATE PACKAGE STATIC                       //
/////////////////////////////////////////////////////////////////////

// ─────────────────────────────────────────────
//               BASIC BEHAVIOUR
// ─────────────────────────────────────────────
contract MandatePackageStaticBasicTest is TestSetupMandatePackageStatic {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("MandatePackage_Static: Adopt SelfSelect package.", daoMock);
    }

    function testPackageAdoptsMandatesOnExecution() public {
        uint16 counterBefore = daoMock.mandateCounter();
        mandateCalldata = abi.encode();

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Execute static package");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // The one baked-in mandate was adopted — counter incremented by 1
        assertEq(daoMock.mandateCounter(), counterBefore + 1);

        // The newly adopted mandate (at the slot that was counterBefore) is active
        (,, bool active) = daoMock.getAdoptedMandate(counterBefore);
        assertTrue(active);
    }

    function testPackageSelfRevokesAfterExecution() public {
        mandateCalldata = abi.encode();

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Execute static package");

        // The package mandate's own slot must now be inactive
        (,, bool active) = daoMock.getAdoptedMandate(mandateId);
        assertFalse(active);
    }
}

// ─────────────────────────────────────────────
//               EDGE CASES
// ─────────────────────────────────────────────
contract MandatePackageStaticEdgeCaseTest is TestSetupMandatePackageStatic {
    function testEmptyPackageOnlyRevokesSelf() public {
        mandateId = findMandateIdInOrg("MandatePackage_Static: empty package.", daoMock);
        uint16 counterBefore = daoMock.mandateCounter();
        mandateCalldata = abi.encode();

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Execute empty package");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // No new mandates were adopted — counter unchanged
        assertEq(daoMock.mandateCounter(), counterBefore);

        // The package mandate itself is now inactive
        (,, bool active) = daoMock.getAdoptedMandate(mandateId);
        assertFalse(active);
    }
}

// ─────────────────────────────────────────────
//               ACCESS CONTROL
// ─────────────────────────────────────────────
contract MandatePackageStaticAccessTest is TestSetupMandatePackageStatic {
    function testPackageRevertsIfCallerLacksRole() public {
        // pkg3 requires ROLE_ONE; charlotte holds only ROLE_TWO
        mandateId = findMandateIdInOrg("MandatePackage_Static: restricted to role 1.", daoMock);
        mandateCalldata = abi.encode();

        vm.prank(charlotte);
        vm.expectRevert(Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Charlotte attempts restricted package");
    }

    function testPackageSucceedsForPublicCaller() public {
        // pkg1 has allowedRole = type(uint256).max; eve has no assigned roles
        mandateId = findMandateIdInOrg("MandatePackage_Static: Adopt SelfSelect package.", daoMock);
        mandateCalldata = abi.encode();

        vm.prank(eve);
        daoMock.request(mandateId, mandateCalldata, nonce, "Eve executes public package");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
    }
}

/////////////////////////////////////////////////////////////////////
//                        MANDATE PACKAGE                          //
/////////////////////////////////////////////////////////////////////

// ─────────────────────────────────────────────
//               BASIC BEHAVIOUR
// ─────────────────────────────────────────────
contract MandatePackageBasicTest is TestSetupExecutive {
    MandatePackage mandatePackage;
    uint16 adoptMandatesId;
    uint16 pkgMandateId;

    function setUp() public override {
        super.setUp();
        adoptMandatesId = findMandateIdInOrg("Adopt_Mandates: A mandate to adopt new mandates into the DAO.", daoMock);

        address[] memory pkgAddresses = new address[](2);
        pkgAddresses[0] = findMandateAddress("OpenAction");
        pkgAddresses[1] = findMandateAddress("StatementOfIntent");
        mandatePackage = new MandatePackage(pkgAddresses);

        pkgMandateId = daoMock.mandateCounter();
        address[] memory toAdopt = new address[](1);
        toAdopt[0] = address(mandatePackage);
        uint256[] memory roleIds_ = new uint256[](1);
        roleIds_[0] = ROLE_ONE;

        vm.prank(alice);
        daoMock.request(adoptMandatesId, abi.encode(toAdopt, roleIds_), nonce, "Adopt MandatePackage");
    }

    function testMandatePackageHandleRequestAdoptsMandatesAndSelfDestructs() public {
        uint16 counterBefore = daoMock.mandateCounter();
        nonce = 456;
        mandateCalldata = abi.encode();

        vm.prank(alice);
        daoMock.request(pkgMandateId, mandateCalldata, nonce, "Execute MandatePackage");

        actionId = MandateUtilities.computeActionId(pkgMandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));
        assertEq(daoMock.mandateCounter(), counterBefore + 3);

        (,, bool pkgActive) = daoMock.getAdoptedMandate(pkgMandateId);
        assertFalse(pkgActive);

        (,, bool active0) = daoMock.getAdoptedMandate(counterBefore);
        (,, bool active1) = daoMock.getAdoptedMandate(uint16(counterBefore + 1));
        (,, bool active2) = daoMock.getAdoptedMandate(uint16(counterBefore + 2));
        assertTrue(active0);
        assertTrue(active1);
        assertTrue(active2);

        // The needFulfilled/needNotFulfilled chain should wire the 3 new mandates together
        PowersTypes.Conditions memory cond1 = daoMock.getConditions(uint16(counterBefore + 1));
        assertEq(cond1.needFulfilled, counterBefore);

        PowersTypes.Conditions memory cond2 = daoMock.getConditions(uint16(counterBefore + 2));
        assertEq(cond2.needFulfilled, counterBefore);
        assertEq(cond2.needNotFulfilled, uint16(counterBefore + 1));
    }

    function testGetNewMandatesReturnsCorrectInitData() public {
        address openActionAddr = findMandateAddress("OpenAction");
        address statementAddr = findMandateAddress("StatementOfIntent");

        address[] memory pkgAddresses = new address[](2);
        pkgAddresses[0] = openActionAddr;
        pkgAddresses[1] = statementAddr;

        uint16 mandateCount = 10;
        PowersTypes.MandateInitData[] memory initData =
            mandatePackage.getNewMandates(pkgAddresses, address(daoMock), mandateCount);

        assertEq(initData.length, 3);

        // mandateInitData[0]: StatementOfIntent, voteable by role 1
        assertEq(initData[0].targetMandate, statementAddr);
        assertEq(initData[0].conditions.allowedRole, 1);
        assertEq(initData[0].conditions.quorum, 20);
        assertEq(initData[0].conditions.succeedAt, 66);
        assertEq(initData[0].conditions.votingPeriod, 1200);
        assertEq(initData[0].conditions.needFulfilled, 0);

        // mandateInitData[1]: Veto (StatementOfIntent), admin only, needs slot mandateCount fulfilled
        assertEq(initData[1].targetMandate, statementAddr);
        assertEq(initData[1].conditions.allowedRole, 0);
        assertEq(initData[1].conditions.needFulfilled, mandateCount);

        // mandateInitData[2]: OpenAction, role 2, needs mandateCount fulfilled and mandateCount+1 NOT fulfilled
        assertEq(initData[2].targetMandate, openActionAddr);
        assertEq(initData[2].conditions.allowedRole, 2);
        assertEq(initData[2].conditions.needFulfilled, mandateCount);
        assertEq(initData[2].conditions.needNotFulfilled, uint16(mandateCount + 1));
    }
}

// ─────────────────────────────────────────────
//               EDGE CASES
// ─────────────────────────────────────────────
contract MandatePackageEdgeCaseTest is TestSetupExecutive {
    function testMandatePackageInitializeMandateOverridesInputParams() public {
        address[] memory pkgAddresses = new address[](2);
        pkgAddresses[0] = findMandateAddress("OpenAction");
        pkgAddresses[1] = findMandateAddress("StatementOfIntent");
        MandatePackage pkg = new MandatePackage(pkgAddresses);

        uint16 adoptId = findMandateIdInOrg("Adopt_Mandates: A mandate to adopt new mandates into the DAO.", daoMock);
        uint16 pkgId = daoMock.mandateCounter();

        address[] memory toAdopt = new address[](1);
        toAdopt[0] = address(pkg);
        uint256[] memory roleIds_ = new uint256[](1);
        roleIds_[0] = ROLE_ONE;

        vm.prank(alice);
        daoMock.request(adoptId, abi.encode(toAdopt, roleIds_), nonce, "Adopt package");

        // MandatePackage.initializeMandate overrides inputParams to abi.encode() (empty)
        bytes memory storedParams = pkg.getInputParams(address(daoMock), pkgId);
        assertEq(storedParams.length, 0);
    }

    function testMandatePackageGetNewMandatesNeedFulfilledOffsets() public {
        address[] memory pkgAddresses = new address[](2);
        pkgAddresses[0] = findMandateAddress("OpenAction");
        pkgAddresses[1] = findMandateAddress("StatementOfIntent");
        MandatePackage pkg = new MandatePackage(pkgAddresses);

        uint16 mandateCount = 42;
        PowersTypes.MandateInitData[] memory initData = pkg.getNewMandates(pkgAddresses, address(daoMock), mandateCount);

        // Veto slot depends on propose slot (mandateCount)
        assertEq(initData[1].conditions.needFulfilled, mandateCount);
        // Execute slot depends on propose (mandateCount) and is blocked by veto (mandateCount+1)
        assertEq(initData[2].conditions.needFulfilled, mandateCount);
        assertEq(initData[2].conditions.needNotFulfilled, uint16(mandateCount + 1));
    }
}

/////////////////////////////////////////////////////////////////////
//                       REVOKE_MANDATES                           //
/////////////////////////////////////////////////////////////////////

// ─────────────────────────────────────────────
//               BASIC BEHAVIOUR
// ─────────────────────────────────────────────
contract RevokeMandatesBasicTest is TestSetupRevokeMandates {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("Revoke_Mandates: revoke a list of mandates.", daoMock);
    }

    function testRevokeMandatesRevokesSingleMandate() public {
        uint16 targetId = findMandateIdInOrg("SelfSelect: self-assign as member.", daoMock);

        (,, bool activeBefore) = daoMock.getAdoptedMandate(targetId);
        assertTrue(activeBefore);

        uint16[] memory toRevoke = new uint16[](1);
        toRevoke[0] = targetId;
        mandateCalldata = abi.encode(toRevoke);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Revoke SelfSelect member");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        (,, bool activeAfter) = daoMock.getAdoptedMandate(targetId);
        assertFalse(activeAfter);
    }

    function testRevokeMandatesRevokesMultipleMandates() public {
        uint16 targetId1 = findMandateIdInOrg("SelfSelect: self-assign as member.", daoMock);
        uint16 targetId2 = findMandateIdInOrg("SelfSelect: self-assign as delegate.", daoMock);

        uint16[] memory toRevoke = new uint16[](2);
        toRevoke[0] = targetId1;
        toRevoke[1] = targetId2;
        mandateCalldata = abi.encode(toRevoke);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Revoke two mandates");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        (,, bool active1) = daoMock.getAdoptedMandate(targetId1);
        (,, bool active2) = daoMock.getAdoptedMandate(targetId2);
        assertFalse(active1);
        assertFalse(active2);
    }
}

// ─────────────────────────────────────────────
//               EDGE CASES
// ─────────────────────────────────────────────
contract RevokeMandatesEdgeCaseTest is TestSetupRevokeMandates {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("Revoke_Mandates: revoke a list of mandates.", daoMock);
    }

    function testRevokeMandatesWithEmptyArrayFulfills() public {
        uint16[] memory toRevoke = new uint16[](0);
        mandateCalldata = abi.encode(toRevoke);

        vm.prank(alice);
        daoMock.request(mandateId, mandateCalldata, nonce, "Revoke empty list");

        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);
        assertEq(uint8(daoMock.getActionState(actionId)), uint8(PowersTypes.ActionState.Fulfilled));

        // Both other mandates remain active — no state change
        uint16 id1 = findMandateIdInOrg("SelfSelect: self-assign as member.", daoMock);
        uint16 id2 = findMandateIdInOrg("SelfSelect: self-assign as delegate.", daoMock);
        (,, bool still1) = daoMock.getAdoptedMandate(id1);
        (,, bool still2) = daoMock.getAdoptedMandate(id2);
        assertTrue(still1);
        assertTrue(still2);
    }
}

// ─────────────────────────────────────────────
//               ACCESS CONTROL
// ─────────────────────────────────────────────
contract RevokeMandatesAccessTest is TestSetupRevokeMandates {
    function setUp() public override {
        super.setUp();
        mandateId = findMandateIdInOrg("Revoke_Mandates: revoke a list of mandates.", daoMock);
        uint16[] memory toRevoke = new uint16[](1);
        toRevoke[0] = 1;
        mandateCalldata = abi.encode(toRevoke);
    }

    function testRevokeMandatesRevertsForCallerWithWrongRole() public {
        // charlotte holds ROLE_TWO; mandate requires ROLE_ONE
        vm.prank(charlotte);
        vm.expectRevert(Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Charlotte attempts revoke");
    }

    function testRevokeMandatesRevertsForCallerWithNoRole() public {
        // eve has no roles
        vm.prank(eve);
        vm.expectRevert(Powers__CannotCallMandate.selector);
        daoMock.request(mandateId, mandateCalldata, nonce, "Eve attempts revoke");
    }
}

// ─────────────────────────────────────────────
//               ACCESS CONTROL
// ─────────────────────────────────────────────
contract MandatePackageAccessTest is TestSetupExecutive {
    MandatePackage mandatePackage;
    uint16 pkgMandateId;

    function setUp() public override {
        super.setUp();
        uint16 adoptMandatesId =
            findMandateIdInOrg("Adopt_Mandates: A mandate to adopt new mandates into the DAO.", daoMock);

        address[] memory pkgAddresses = new address[](2);
        pkgAddresses[0] = findMandateAddress("OpenAction");
        pkgAddresses[1] = findMandateAddress("StatementOfIntent");
        mandatePackage = new MandatePackage(pkgAddresses);

        pkgMandateId = daoMock.mandateCounter();
        address[] memory toAdopt = new address[](1);
        toAdopt[0] = address(mandatePackage);
        uint256[] memory roleIds_ = new uint256[](1);
        roleIds_[0] = ROLE_ONE;

        vm.prank(alice);
        daoMock.request(adoptMandatesId, abi.encode(toAdopt, roleIds_), nonce, "Adopt MandatePackage");
    }

    function testMandatePackageRevertsForCallerWithWrongRole() public {
        nonce = 456;
        mandateCalldata = abi.encode();

        // charlotte holds ROLE_TWO; package was adopted with allowedRole = ROLE_ONE
        vm.prank(charlotte);
        vm.expectRevert(Powers__CannotCallMandate.selector);
        daoMock.request(pkgMandateId, mandateCalldata, nonce, "Charlotte attempts execution");
    }
}
