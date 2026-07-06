// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { TestSetupHelpers } from "../../TestSetup.t.sol";
import { PowersDeployer } from "@src/core/helpers/PowersDeployer.sol";
import { Powers } from "@src/Powers.sol";
import { PowersTypes } from "@src/interfaces/PowersTypes.sol";

/// @notice Unit tests for PowersDeployer
/// @dev Covers the deploy() function: successful deployment, constitution, admin handoff.
contract PowersDeployerTest is TestSetupHelpers {
    PowersDeployer deployer;

    function setUp() public override {
        super.setUp();
        deployer = new PowersDeployer();
    }

    // ─── BASIC BEHAVIOUR ───

    function testDeployReturnsNonZeroAddress() public {
        PowersTypes.MandateInitData[] memory mandateInitData = testConstitutions.helpersTestConstitution();

        address powersAddr = deployer.deploy(
            "Test DAO",
            "https://test.uri",
            10_000,
            10_000,
            25,
            mandateInitData,
            new PowersTypes.Flow[](0),
            alice,
            address(0)
        );

        assertTrue(powersAddr != address(0));
    }

    function testDeployedContractHasCorrectName() public {
        PowersTypes.MandateInitData[] memory mandateInitData = testConstitutions.helpersTestConstitution();

        address powersAddr = deployer.deploy(
            "Test DAO",
            "https://test.uri",
            10_000,
            10_000,
            25,
            mandateInitData,
            new PowersTypes.Flow[](0),
            alice,
            address(0)
        );

        assertEq(Powers(payable(powersAddr)).name(), "Test DAO");
    }

    function testFinalAdminHasAdminRole() public {
        PowersTypes.MandateInitData[] memory mandateInitData = testConstitutions.helpersTestConstitution();

        address powersAddr = deployer.deploy(
            "Test DAO",
            "https://test.uri",
            10_000,
            10_000,
            25,
            mandateInitData,
            new PowersTypes.Flow[](0),
            alice,
            address(0)
        );

        Powers newPowers = Powers(payable(powersAddr));
        // ADMIN_ROLE == 0 (type(uint256).min). hasRoleSince returns 0 when not a member.
        assertTrue(newPowers.hasRoleSince(alice, ADMIN_ROLE) > 0);
    }

    function testDeployerAddressDoesNotHaveAdminRole() public {
        PowersTypes.MandateInitData[] memory mandateInitData = testConstitutions.helpersTestConstitution();

        address powersAddr = deployer.deploy(
            "Test DAO",
            "https://test.uri",
            10_000,
            10_000,
            25,
            mandateInitData,
            new PowersTypes.Flow[](0),
            alice,
            address(0)
        );

        Powers newPowers = Powers(payable(powersAddr));
        // The test contract (msg.sender during deploy) should NOT hold ADMIN_ROLE after handoff.
        assertEq(newPowers.hasRoleSince(address(this), ADMIN_ROLE), 0);
    }

    function testDeployedContractHasMandates() public {
        PowersTypes.MandateInitData[] memory mandateInitData = testConstitutions.helpersTestConstitution();

        address powersAddr = deployer.deploy(
            "Test DAO",
            "https://test.uri",
            10_000,
            10_000,
            25,
            mandateInitData,
            new PowersTypes.Flow[](0),
            alice,
            address(0)
        );

        Powers newPowers = Powers(payable(powersAddr));
        // mandateCounter starts at 0 and increments for each adopted mandate.
        // helpersTestConstitution adds 1 mandate, so counter should be > 1 (counts from 1).
        assertTrue(newPowers.mandateCounter() > 1);
    }

    // ─── EDGE CASES ───

    function testDeployWithFlowsSucceeds() public {
        PowersTypes.MandateInitData[] memory mandateInitData = testConstitutions.helpersTestConstitution();

        // Build a simple flow referencing mandate slot 1.
        uint16[] memory ids = new uint16[](1);
        ids[0] = 1;
        PowersTypes.Flow[] memory flows = new PowersTypes.Flow[](1);
        flows[0] = PowersTypes.Flow({ mandateIds: ids, nameDescription: "Test flow" });

        address powersAddr = deployer.deploy(
            "Test DAO with Flow", "https://test.uri", 10_000, 10_000, 25, mandateInitData, flows, alice, address(0)
        );

        assertTrue(powersAddr != address(0));
    }

    function testDeployEmptyMandatesSucceeds() public {
        PowersTypes.MandateInitData[] memory emptyMandates = new PowersTypes.MandateInitData[](0);

        address powersAddr = deployer.deploy(
            "Empty DAO",
            "https://test.uri",
            10_000,
            10_000,
            25,
            emptyMandates,
            new PowersTypes.Flow[](0),
            alice,
            address(0)
        );

        assertTrue(powersAddr != address(0));
        // With no mandates constituted mandateCounter stays at 1 (the first slot is reserved).
        Powers newPowers = Powers(payable(powersAddr));
        assertEq(newPowers.mandateCounter(), 1);
    }

    // ─── ACCESS CONTROL ───

    function testDeployerCallerIsNotRetainedAsAdmin() public {
        // Verify the deployer contract itself never ends up holding the admin role in the
        // newly-deployed Powers instance.
        PowersTypes.MandateInitData[] memory mandateInitData = testConstitutions.helpersTestConstitution();

        address powersAddr = deployer.deploy(
            "Test DAO",
            "https://test.uri",
            10_000,
            10_000,
            25,
            mandateInitData,
            new PowersTypes.Flow[](0),
            bob,
            address(0)
        );

        Powers newPowers = Powers(payable(powersAddr));
        assertEq(newPowers.hasRoleSince(address(deployer), ADMIN_ROLE), 0);
        assertTrue(newPowers.hasRoleSince(bob, ADMIN_ROLE) > 0);
    }
}
