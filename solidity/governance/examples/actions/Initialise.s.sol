// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
 
import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "./ActionHelpers.s.sol"; 

// This script contains a set of modular interactions with the primary layer. They  can be used for testing or setting up up an organisation after deployment. 

contract Initialise is ActionHelpers { 
    uint16[] mandateSlots; 
    uint256[] actionIds; 

    uint256 roleCount; 
    uint256 againstVote; 
    uint256 forVote; 
    uint256 abstainVote;

    function runSetupMandate(address powers, uint256 nonce) public {
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;

        // step 1: identify mandates to run. 
        mandateSlots.push(findMandateIdInOrg("Initial Setup: Assign role labels and revokes itself after execution", Powers(payable(powers))));

        // step 2: check if user has the permissions to run these mandates.
        Powers(payable(powers)).canCallMandate(msg.sender, mandateSlots[0]); // should return true.

        // step 3: execute mandates. 
        vm.startBroadcast();
        IPowers(powers).request(mandateSlots[0], abi.encode(), nonce, "Executing initial setup mandate");
        vm.stopBroadcast();
    }

    function unpackReformPackages(address powers, uint256 nonce) public {
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;

        // step 1: identify mandates to run. 
        // find mandates that have "Reform Package " in their nameDescription.
        for (uint16 i = 1; i < Powers(payable(powers)).mandateCounter(); i++) {
            mandateSlots.push(findMandateIdInOrg(string(abi.encodePacked("Reform Package ", vm.toString(i + 1))), Powers(payable(powers))));
        } 
        // step 2: check if user has the permissions to run these mandates.
        for (uint i = 0; i < mandateSlots.length; i++) {
            Powers(payable(powers)).canCallMandate(msg.sender, mandateSlots[i]); // should return true.
        }
        // step 3: unpack reform packages. 
        for (uint i = 0; i < mandateSlots.length; i++) {
            Powers(payable(powers)).request(mandateSlots[i], abi.encode(), nonce + i, "Unpacking reform package for Ideas Layer");  
        }
    }
}