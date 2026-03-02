// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import { Test, console } from "forge-std/Test.sol";
import { Powers } from "@src/Powers.sol";
import { Governed721 } from "@src/helpers/Governed721.sol";
import { Deploy } from "@script/deployOrganisations/Governed721DAO/Deploy.s.sol";

contract Governed721DAO_IntegrationTest is Test {
    Deploy deployScript;
    Powers powers;
    Governed721 governed721;

    function setUp() public {
        // Deploy the script
        deployScript = new Deploy();
        deployScript.run();

        // Get the deployed contracts
        powers = deployScript.powers();
        governed721 = deployScript.governed721();
    }

    function test_Deployment() public {
        // Verify Powers deployment
        assertTrue(address(powers) != address(0), "Powers contract should be deployed");
        
        // Verify Governed721 deployment
        assertTrue(address(governed721) != address(0), "Governed721 contract should be deployed");

        // Verify Ownership
        assertEq(governed721.owner(), address(powers), "Powers should be the owner of Governed721");

        // Verify Payment Mandate ID is set (not 0)
        assertTrue(governed721.paymentMandateId() != 0, "Payment Mandate ID should be set");
        
        console.log("Powers deployed at: %s", address(powers));
        console.log("Governed721 deployed at: %s", address(governed721));
    }
}
