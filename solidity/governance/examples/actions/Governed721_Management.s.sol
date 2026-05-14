// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
 
import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "./ActionHelpers.s.sol";
import { IGoverned721 } from "@src/helpers/Governed721.sol";

// This script contains a set of modular interactions with the primary layer. They  can be used for testing or setting up up an organisation after deployment. 

contract Governed721_Management is ActionHelpers {
    uint16[] mandateSlots; 
    uint256[] actionIds; 

    uint256 roleCount; 
    uint256 againstVote; 
    uint256 forVote; 
    uint256 abstainVote;

    /////////////////////////////////////////////////////////////// 
    //                          CLAIM ROLES                      //
    /////////////////////////////////////////////////////////////// 
    function mintNftAtGoverned721(address governed721, address intermediary, uint256 privateKeyOwner, address artist, uint256 quantity) public { // the org has to mint. This should be in the reform mandate.
        // mint tokens 
        address owner =  vm.addr(privateKeyOwner);

        vm.startBroadcast();
        for (uint256 i = 1; i < quantity + 1; i++) {
            IGoverned721(governed721).mint(owner, i, artist, string.concat("Token_", vm.toString(i)));
        }
        vm.stopBroadcast();

        // set intermediary as approved address per token (getApproved is used to record intermediary in TransferData)
        vm.startBroadcast(privateKeyOwner);
        for (uint256 i = 1; i < quantity + 1; i++) {
            IGoverned721(governed721).approve(intermediary, i);
        }
        vm.stopBroadcast();
    }

    function buyNftAtGoverned721(address governed721, uint256 tokenId, uint256 price, address oldOwner, address newOwner, uint256 privateKeyIntermediary, uint256 nonce) public {
        // sell token
        vm.startBroadcast(privateKeyIntermediary);
        IGoverned721(governed721).safeTransferFromWithETH{value: price}(oldOwner, newOwner, tokenId, price, nonce);
        vm.stopBroadcast();
    }

    /////////////////////////////////////////////////////////////// 
    //                          CLAIM ROLES                      //
    /////////////////////////////////////////////////////////////// 
    function whitelistPaymentTokensPropose(address powers, address token, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;

        // step 1 : identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Add Allowed Token: Whitelist a token.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        actionIds.push(IPowers(payable(powers)).propose(mandateSlots[0], abi.encode(token), nonce, string.concat("Whitelisting token: ", vm.toString(token))));
        vm.stopBroadcast();

        // voting on proposal.
        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers,
            mandateSlots[0],
            actionIds[0],
            privateKeys, // note: private keys 
            nonce, // randomiser
            100 // pass chance in percentage. 
        );

        console2.log("Votes cast for creating convergence layer proposal: ", forVote);
        console2.log("Votes cast against creating convergence layer proposal: ", againstVote);
        console2.log("Votes cast abstaining on creating convergence layer proposal: ", abstainVote);
        console2.log("Total voters: ", roleCount);
    }

    function whitelistPaymentTokensExecute(address powers, address token, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;

        // step 1 : identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Add Allowed Token: Whitelist a token.", Powers(payable(powers)))); 

        // Step 2: Execute call
        vm.startBroadcast(privateKeys[0]);
        Powers(payable(powers)).request(mandateSlots[0], abi.encode(token), nonce, string.concat("Whitelisting token: ", vm.toString(token)));
        vm.stopBroadcast();   
    }

    // function deWhitelistPaymentTokens(address powers, address token, uint256[] memory privateKeys, uint256 nonce) public { 
    //     // step 0: reset state variables.
    //     delete mandateSlots;
    //     delete actionIds;
 
    //     // step 1: identify mandates to run.
    //     mandateSlots.push(findMandateIdInOrg("Remove Allowed Token: De-whitelist a token.", Powers(payable(powers)))); 

    //     // Step 2: Execute call
    //     vm.startBroadcast(privateKey);
    //     Powers(payable(powers)).request(mandateSlots[0], abi.encode(token), nonce, string.concat("De-whitelisting token: ", vm.toString(token)));
    //     vm.stopBroadcast();   

    // }

    function blacklistAccountPropose(address powers, address account, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Add account to blacklist: Blacklist an account. They will not be able to transfer or mint NFTs.", Powers(payable(powers)))); 

        // Step 2: Execute call
        vm.startBroadcast(privateKeys[0]);
        actionIds.push(Powers(payable(powers)).propose(mandateSlots[0], abi.encode(account), nonce, string.concat("Blacklisting account: ", vm.toString(account))));
        vm.stopBroadcast();

        // voting on proposal.
        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers,
            mandateSlots[0],
            actionIds[0],
            privateKeys, // note: private keys + msg.sender will vote. 
            nonce, // randomiser
            100 // pass chance in percentage. 
        );

        console2.log("Votes cast for creating convergence layer proposal: ", forVote);
        console2.log("Votes cast against creating convergence layer proposal: ", againstVote);
        console2.log("Votes cast abstaining on creating convergence layer proposal: ", abstainVote);
        console2.log("Total voters: ", roleCount);
    }

    function blacklistAccountExecute(address powers, address account, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Add account to blacklist: Blacklist an account. They will not be able to transfer or mint NFTs.", Powers(payable(powers)))); 

        // Step 2: Execute call
        vm.startBroadcast(privateKeys[0]);
        Powers(payable(powers)).request(mandateSlots[0], abi.encode(account), nonce, string.concat("Blacklisting account: ", vm.toString(account)));
        vm.stopBroadcast();
    }

    // function deBlacklistAccount(address powers, address account, uint256[] memory privateKeys, uint256 nonce) public { 
    //     // step 0: reset state variables.
    //     delete mandateSlots;
    //     delete actionIds;
 
    //     // step 1: identify mandates to run.
    //     mandateSlots.push(findMandateIdInOrg("Remove account from blacklist: Unblacklist an account. They will be able to transfer or mint NFTs.", Powers(payable(powers)))); 

    //     // Step 2: Execute call
    //     vm.startBroadcast(privateKey);
    //     Powers(payable(powers)).request(mandateSlots[0], abi.encode(account), nonce, string.concat("De-blacklisting account: ", vm.toString(account)));
    //     vm.stopBroadcast();   
    // }

    function collectPayment(address powers, uint256 transferId, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Collect Split Payment: Role holders can collect their split of payment.", Powers(payable(powers)))); 

        // Step 2: Execute call
        for (uint i = 0; i < privateKeys.length; i++) {
             address claimant = vm.addr(privateKeys[i]);
             console2.log("Claimant:", claimant);
             vm.startBroadcast(privateKeys[i]);
             Powers(payable(powers)).request(mandateSlots[0], abi.encode(transferId), nonce + i, string.concat("Collecting split payment for transfer ID: ", vm.toString(transferId), " by claimant: ", vm.toString(claimant)));
             vm.stopBroadcast();   
        }
    } 
 
    function initiateSplitPayment(address powers, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Propose Split Payment: Executive proposes new split. Role 1 = Artist, Role 2 = Intermediary. The old owner gets the remainder after Artist and Intermediary split.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Split Checkpoint 1: Confirm no Minter veto.", Powers(payable(powers)))); 

        // step 2: identify relevant accounts 
        uint256 privateKey = getPrivateKeyRoleHolder(powers, 5, 0, privateKeys); 

        // Step 2: Execute call
        vm.startBroadcast(privateKey);
        Powers(payable(powers)).request(mandateSlots[0], abi.encode(role, percentage), nonce, string.concat("Proposing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage))); 
        vm.stopBroadcast();

        // Note that this mandate has a timelock, hence we first need to propose - and request after the timelock has passed. 
        vm.startBroadcast(privateKey);
        Powers(payable(powers)).propose(mandateSlots[1], abi.encode(role, percentage), nonce, string.concat("Executing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage))); 
        vm.stopBroadcast();
    }

    // note: this function can call veto function for each role.  The privateKey needs to have the appropriate role. 
    function vetoSplitPayment(address powers, uint256 mandateSlot, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Veto Split (Minter): Minter can veto split change.", Powers(payable(powers)))); 
        mandateSlots.push(findMandateIdInOrg("Veto Split (Owner): Owner can veto split change.", Powers(payable(powers)))); 
        mandateSlots.push(findMandateIdInOrg("Veto Split (Intermediary): Intermediary can veto split change.", Powers(payable(powers)))); 

        // Step 2: Execute call
        uint256 privateKey = getPrivateKeyRoleHolder(powers, 5, 0, privateKeys); 
        vm.startBroadcast(privateKey);
        Powers(payable(powers)).request(mandateSlots[mandateSlot], abi.encode(role, percentage), nonce, string.concat("Vetoing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage)));
        vm.stopBroadcast();   
    }

    // note privateKey needs to have executive role
    function executeSplitPayment(address powers, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public { 
        // step 0: reset state variables.
        delete mandateSlots;
        delete actionIds;
 
        // step 1: identify mandates to run.
        mandateSlots.push(findMandateIdInOrg("Split Checkpoint 1: Confirm no Minter veto.", Powers(payable(powers)))); 
        mandateSlots.push(findMandateIdInOrg("Split Checkpoint 2: Confirm no Owner veto.", Powers(payable(powers)))); 
        mandateSlots.push(findMandateIdInOrg("Execute Split Payment: Set new split payment.", Powers(payable(powers))));
        
        // Step 2: Execute call
        uint256 privateKey = getPrivateKeyRoleHolder(powers, 5, 0, privateKeys);
        vm.startBroadcast(privateKey);
        Powers(payable(powers)).request(mandateSlots[0], abi.encode(role, percentage), nonce, string.concat("Executing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage)));
        vm.stopBroadcast();

        vm.startBroadcast(privateKey);
        Powers(payable(powers)).request(mandateSlots[1], abi.encode(role, percentage), nonce, string.concat("Executing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage)));
        vm.stopBroadcast();   
 
        vm.startBroadcast(privateKey);
        Powers(payable(powers)).request(mandateSlots[2], abi.encode(role, percentage), nonce, string.concat("Executing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage)));
        vm.stopBroadcast();   
    }
}



