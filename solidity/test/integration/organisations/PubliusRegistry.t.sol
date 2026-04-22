// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test, console } from "forge-std/Test.sol";
import { Powers } from "@src/Powers.sol";
import { MandateRegistry } from "@src/helpers/MandateRegistry.sol";
import { Deploy } from "@governance/publius-registry/Deploy.s.sol";
import { Mandate } from "@src/Mandate.sol";

contract PubliusRegistry_IntegrationTest is Test {
    Deploy deployScript;
    Powers powers;
    MandateRegistry registry;

    address admin;
    uint16 registerMandateId;
    uint16 deactivateMandateId;
    uint16 reactivateMandateId;

    function setUp() public {
        // Deploy the script
        deployScript = new Deploy(); 
        (powers, registry) = deployScript.run();

        // Run the first setup mandate to set roles and treasury
        // The deployer is the admin, let's get the admin address dynamically
        admin = powers.getRoleHolderAtIndex(0, 0);

        vm.startPrank(admin);
        powers.request(1, abi.encode(""), 123, "Setup: Assign roles and labels");
        vm.stopPrank();
    }

    function test_Deployment() public view {
        // Verify Powers deployment
        assertTrue(address(powers) != address(0), "Powers contract should be deployed");
        
        // Verify MandateRegistry deployment
        assertTrue(address(registry) != address(0), "MandateRegistry contract should be deployed");

        // Verify Ownership
        assertEq(registry.owner(), address(powers), "Powers should be the owner of MandateRegistry");

        // verify roles have been set after running setup mandate
        // Role 0 = Admin
        assertTrue(powers.hasRoleSince(admin, 0) > 0, "Admin should have Admin role");
        
        console.log("Powers deployed at: %s", address(powers));
        console.log("MandateRegistry deployed at: %s", address(registry));
    }

    function findMandateIdInOrg(string memory description, Powers org) public view returns (uint16) {
        uint16 counter = org.mandateCounter();
        for (uint16 i = 1; i < counter; i++) {
            (address mandateAddress, , ) = org.getAdoptedMandate(i);
            string memory mandateDesc = Mandate(mandateAddress).getNameDescription(address(org), i);
            if (keccak256(abi.encodePacked(mandateDesc)) == keccak256(abi.encodePacked(description))) {
                return i;
            }
        }
        revert(string.concat("Mandate not found: ", description));
    }

    function test_RegistryGovernanceFlow() public {
        // Fetch mandate IDs
        registerMandateId = findMandateIdInOrg("Register Mandate: Admin can register new mandates in the registry.", powers);
        deactivateMandateId = findMandateIdInOrg("Deactivate Mandate: Admin can deactivate mandates in the registry.", powers);
        reactivateMandateId = findMandateIdInOrg("Reactivate Mandate: Admin can reactivate mandates in the registry.", powers);

        // Parameters for registering a mandate
        string memory version = "v1.0";
        string memory mandateName = "TestMandate";
        
        // We need to bypass the ERC165 check in registry by mocking the interface or using a real mandate.
        // Let's fetch a real mandate address to use. 
        (address realMandateAddress, , ) = powers.getAdoptedMandate(1);

        bytes memory registerCalldata = abi.encode(version, mandateName, realMandateAddress);
        uint256 nonce = 1;

        // Register Mandate Flow
        // ----------------------------------------
        vm.startPrank(admin);
        
        // Admin executes the registration request
        powers.request(registerMandateId, registerCalldata, nonce, "Registering a new mandate");
        
        // Verify it was registered
        assertTrue(registry.isMandateRegistered(version, mandateName), "Mandate should be registered");
        assertTrue(registry.isVersionActive(version, mandateName), "Mandate should be active");
        
        vm.stopPrank();

        // Deactivate Mandate Flow
        // ----------------------------------------
        bytes memory deactivateCalldata = abi.encode(version, mandateName);
        nonce++;

        vm.startPrank(admin);
        powers.request(deactivateMandateId, deactivateCalldata, nonce, "Deactivating the mandate");
        
        // Verify it was deactivated
        assertFalse(registry.isVersionActive(version, mandateName), "Mandate should be inactive");
        
        vm.stopPrank();

        // Reactivate Mandate Flow
        // ----------------------------------------
        bytes memory reactivateCalldata = abi.encode(version, mandateName);
        nonce++;

        vm.startPrank(admin);
        powers.request(reactivateMandateId, reactivateCalldata, nonce, "Reactivating the mandate");
        
        // Verify it was reactivated
        assertTrue(registry.isVersionActive(version, mandateName), "Mandate should be active again");
        
        vm.stopPrank();
    }
}
