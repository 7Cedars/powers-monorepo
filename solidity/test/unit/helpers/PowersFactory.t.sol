// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { PowersFactory } from "@src/helpers/PowersFactory.sol";
import { PowersDeployer } from "@src/helpers/PowersDeployer.sol";
import { Powers } from "@src/Powers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Ownable } from "@lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/// @notice Unit tests for PowersFactory
/// @dev Covers addMandates, replaceMandate, getMandate, addFlows, replaceFlow, getFlow,
///      createPowers (both overloads), and getLatestDeployment.
contract PowersFactoryTest is TestSetupHelpers {
    PowersFactory factory;
    PowersDeployer deployer;

    function setUp() public override {
        super.setUp();

        deployer = new PowersDeployer();
        factory = new PowersFactory("https://testUri", 10_000, 10_000, 25, address(deployer), address(0));
    }

    // ─── BASIC BEHAVIOUR ───

    function testAddMandatesStoresMandates() public {
        PowersTypes.MandateInitData[] memory initData = testConstitutions.helpersTestConstitution();
        factory.addMandates(initData);

        PowersTypes.MandateInitData memory stored = factory.getMandate(0);
        assertEq(stored.targetMandate, initData[0].targetMandate);
    }

    function testGetMandateReturnsCorrectEntry() public {
        PowersTypes.MandateInitData[] memory initData = testConstitutions.helpersTestConstitution();
        factory.addMandates(initData);

        PowersTypes.MandateInitData memory stored = factory.getMandate(0);
        assertEq(stored.nameDescription, initData[0].nameDescription);
    }

    function testReplaceMandateUpdatesEntry() public {
        PowersTypes.MandateInitData[] memory initData = testConstitutions.helpersTestConstitution();
        factory.addMandates(initData);

        PowersTypes.MandateInitData memory replacement = PowersTypes.MandateInitData({
            nameDescription: "Replaced mandate",
            targetMandate: initData[0].targetMandate,
            config: initData[0].config,
            conditions: initData[0].conditions
        });

        factory.replaceMandate(0, replacement);

        PowersTypes.MandateInitData memory stored = factory.getMandate(0);
        assertEq(stored.nameDescription, "Replaced mandate");
    }

    function testAddFlowsStoresFlows() public {
        uint16[] memory ids = new uint16[](1);
        ids[0] = 1;
        PowersTypes.Flow[] memory flows = new PowersTypes.Flow[](1);
        flows[0] = PowersTypes.Flow({ mandateIds: ids, nameDescription: "Test flow" });

        factory.addFlows(flows);

        PowersTypes.Flow memory stored = factory.getFlow(0);
        assertEq(stored.nameDescription, "Test flow");
    }

    function testGetFlowReturnsCorrectEntry() public {
        uint16[] memory ids = new uint16[](1);
        ids[0] = 1;
        PowersTypes.Flow[] memory flows = new PowersTypes.Flow[](1);
        flows[0] = PowersTypes.Flow({ mandateIds: ids, nameDescription: "Flow A" });

        factory.addFlows(flows);

        PowersTypes.Flow memory stored = factory.getFlow(0);
        assertEq(stored.mandateIds[0], 1);
    }

    function testReplaceFlowUpdatesEntry() public {
        uint16[] memory ids = new uint16[](1);
        ids[0] = 1;
        PowersTypes.Flow[] memory flows = new PowersTypes.Flow[](1);
        flows[0] = PowersTypes.Flow({ mandateIds: ids, nameDescription: "Original flow" });
        factory.addFlows(flows);

        uint16[] memory newIds = new uint16[](1);
        newIds[0] = 2;
        PowersTypes.Flow memory replacement = PowersTypes.Flow({ mandateIds: newIds, nameDescription: "Replaced flow" });

        factory.replaceFlow(0, replacement);

        PowersTypes.Flow memory stored = factory.getFlow(0);
        assertEq(stored.nameDescription, "Replaced flow");
        assertEq(stored.mandateIds[0], 2);
    }

    function testCreatePowersReturnsNonZeroAddress() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        address powersAddr = factory.createPowers("FactoryDAO");

        assertTrue(powersAddr != address(0));
    }

    function testCreatePowersUpdatesLatestDeployment() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        address powersAddr = factory.createPowers("FactoryDAO");

        assertEq(factory.getLatestDeployment(), powersAddr);
    }

    function testCreatePowersCallerBecomesAdmin() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        address powersAddr = factory.createPowers("FactoryDAO");

        Powers newPowers = Powers(payable(powersAddr));
        // msg.sender inside createPowers(name) is the test contract (factory owner).
        assertTrue(newPowers.hasRoleSince(address(this), ADMIN_ROLE) > 0);
    }

    function testCreatePowersWithAdminParamReturnsNonZeroAddress() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        address powersAddr = factory.createPowers("FactoryDAO Admin", alice);

        assertTrue(powersAddr != address(0));
    }

    function testCreatePowersWithAdminParamSetsCorrectAdmin() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        address powersAddr = factory.createPowers("FactoryDAO Admin", alice);

        Powers newPowers = Powers(payable(powersAddr));
        assertTrue(newPowers.hasRoleSince(alice, ADMIN_ROLE) > 0);
    }

    function testCreatePowersWithAdminParamFactoryOwnerHasNoAdminRole() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        address powersAddr = factory.createPowers("FactoryDAO Admin", alice);

        Powers newPowers = Powers(payable(powersAddr));
        assertEq(newPowers.hasRoleSince(address(this), ADMIN_ROLE), 0);
    }

    function testGetLatestDeploymentReturnsZeroBeforeFirstDeploy() public view {
        // No deployment yet — latestDeployment defaults to address(0).
        assertEq(factory.getLatestDeployment(), address(0));
    }

    function testGetLatestDeploymentUpdatesOnSecondDeploy() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        factory.createPowers("DAO One");
        address second = factory.createPowers("DAO Two");

        assertEq(factory.getLatestDeployment(), second);
    }

    // ─── EDGE CASES ───

    function testAddMandatesMultipleTimes() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());
        factory.addMandates(testConstitutions.helpersTestConstitution());

        // Both entries are stored at index 0 and 1.
        factory.getMandate(0);
        factory.getMandate(1);
    }

    function testCreatePowersWithFlows() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        uint16[] memory ids = new uint16[](1);
        ids[0] = 1;
        PowersTypes.Flow[] memory flows = new PowersTypes.Flow[](1);
        flows[0] = PowersTypes.Flow({ mandateIds: ids, nameDescription: "Initial flow" });
        factory.addFlows(flows);

        address powersAddr = factory.createPowers("DAO With Flows");
        assertTrue(powersAddr != address(0));
    }

    // ─── ACCESS CONTROL ───

    function testAddMandatesRevertsNonOwner() public {
        PowersTypes.MandateInitData[] memory initData = testConstitutions.helpersTestConstitution();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.addMandates(initData);
    }

    function testReplaceMandateRevertsNonOwner() public {
        PowersTypes.MandateInitData[] memory initData = testConstitutions.helpersTestConstitution();
        factory.addMandates(initData);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.replaceMandate(0, initData[0]);
    }

    function testAddFlowsRevertsNonOwner() public {
        uint16[] memory ids = new uint16[](1);
        ids[0] = 1;
        PowersTypes.Flow[] memory flows = new PowersTypes.Flow[](1);
        flows[0] = PowersTypes.Flow({ mandateIds: ids, nameDescription: "Test flow" });

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.addFlows(flows);
    }

    function testReplaceFlowRevertsNonOwner() public {
        uint16[] memory ids = new uint16[](1);
        ids[0] = 1;
        PowersTypes.Flow[] memory flows = new PowersTypes.Flow[](1);
        flows[0] = PowersTypes.Flow({ mandateIds: ids, nameDescription: "Test flow" });
        factory.addFlows(flows);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.replaceFlow(0, flows[0]);
    }

    function testCreatePowersRevertsNonOwner() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.createPowers("Unauthorized DAO");
    }

    function testCreatePowersWithAdminRevertsNonOwner() public {
        factory.addMandates(testConstitutions.helpersTestConstitution());

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.createPowers("Unauthorized DAO", bob);
    }
}
