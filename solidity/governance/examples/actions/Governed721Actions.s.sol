// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "./ActionHelpers.s.sol";
import { Governed721, IGoverned721 } from "@src/helpers/Governed721.sol";
import { ElectionRegistry } from "@src/helpers/ElectionRegistry.sol";

/// @notice All Governed721 DAO action functions — NFT operations, governance management,
///         role assignment, and election flows — in a single contract. Extends ActionHelpers
///         so callers need only one import and one instance.
contract Governed721Actions is ActionHelpers {

    ///////////////////////////////////////////////////////////////
    //                     NFT OPERATIONS                        //
    ///////////////////////////////////////////////////////////////

    function mintNftAtGoverned721(address governed721, address intermediary, uint256 privateKeyOwner, address artist, uint256 quantity) public {
        address owner = vm.addr(privateKeyOwner);

        vm.startBroadcast();
        for (uint256 i = 1; i < quantity + 1; i++) {
            IGoverned721(governed721).mint(owner, i, artist, string.concat("Token_", vm.toString(i)));
        }
        vm.stopBroadcast();

        vm.startBroadcast(privateKeyOwner);
        for (uint256 i = 1; i < quantity + 1; i++) {
            IGoverned721(governed721).approve(intermediary, i);
        }
        vm.stopBroadcast();
    }

    function buyNftAtGoverned721(address governed721, uint256 tokenId, uint256 price, address oldOwner, address newOwner, uint256 privateKeyIntermediary, uint256 nonce) public {
        vm.startBroadcast(privateKeyIntermediary);
        IGoverned721(governed721).safeTransferFromWithETH{value: price}(oldOwner, newOwner, tokenId, price, nonce);
        vm.stopBroadcast();
    }

    ///////////////////////////////////////////////////////////////
    //                   PAYMENT MANAGEMENT                      //
    ///////////////////////////////////////////////////////////////

    function whitelistPaymentTokensPropose(address powers, address token, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Add Allowed Token: Whitelist a token.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        actionIds.push(IPowers(payable(powers)).propose(mandateSlots[0], abi.encode(token), nonce, string.concat("Whitelisting token: ", vm.toString(token))));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers,
            mandateSlots[0],
            actionIds[0],
            privateKeys,
            nonce,
            100
        );

        console2.log("Votes cast for token whitelist proposal: ", forVote);
        console2.log("Votes cast against token whitelist proposal: ", againstVote);
        console2.log("Total voters: ", roleCount);
    }

    function whitelistPaymentTokensExecute(address powers, address token, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Add Allowed Token: Whitelist a token.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        Powers(payable(powers)).request(mandateSlots[0], abi.encode(token), nonce, string.concat("Whitelisting token: ", vm.toString(token)));
        vm.stopBroadcast();
    }

    function blacklistAccountPropose(address powers, address account, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Add account to blacklist: Blacklist an account. They will not be able to transfer or mint NFTs.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        actionIds.push(Powers(payable(powers)).propose(mandateSlots[0], abi.encode(account), nonce, string.concat("Blacklisting account: ", vm.toString(account))));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers,
            mandateSlots[0],
            actionIds[0],
            privateKeys,
            nonce,
            100
        );

        console2.log("Votes cast for blacklist proposal: ", forVote);
        console2.log("Votes cast against blacklist proposal: ", againstVote);
        console2.log("Total voters: ", roleCount);
    }

    function blacklistAccountExecute(address powers, address account, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Add account to blacklist: Blacklist an account. They will not be able to transfer or mint NFTs.", Powers(payable(powers))));

        vm.startBroadcast(privateKeys[0]);
        Powers(payable(powers)).request(mandateSlots[0], abi.encode(account), nonce, string.concat("Blacklisting account: ", vm.toString(account)));
        vm.stopBroadcast();
    }

    function collectPayment(address powers, uint256 transferId, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Collect Split Payment: Role holders can collect their split of payment.", Powers(payable(powers))));

        for (uint i = 0; i < privateKeys.length; i++) {
            address claimant = vm.addr(privateKeys[i]);
            console2.log("Claimant:", claimant);
            vm.startBroadcast(privateKeys[i]);
            Powers(payable(powers)).request(mandateSlots[0], abi.encode(transferId), nonce + i, string.concat("Collecting split payment for transfer ID: ", vm.toString(transferId), " by claimant: ", vm.toString(claimant)));
            vm.stopBroadcast();
        }
    }

    function initiateSplitPayment(address powers, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Propose Split Payment: Executive proposes new split. Role 1 = Artist, Role 2 = Intermediary. The old owner gets the remainder after Artist and Intermediary split.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Split Checkpoint 1: Confirm no Minter veto.", Powers(payable(powers))));

        uint256 privateKey = getPrivateKeyRoleHolder(powers, 5, 0, privateKeys);

        vm.startBroadcast(privateKey);
        Powers(payable(powers)).request(mandateSlots[0], abi.encode(role, percentage), nonce, string.concat("Proposing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage)));
        vm.stopBroadcast();

        vm.startBroadcast(privateKey);
        Powers(payable(powers)).propose(mandateSlots[1], abi.encode(role, percentage), nonce, string.concat("Executing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage)));
        vm.stopBroadcast();
    }

    function vetoSplitPayment(address powers, uint256 mandateSlot, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Veto Split (Minter): Minter can veto split change.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Veto Split (Owner): Owner can veto split change.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Veto Split (Intermediary): Intermediary can veto split change.", Powers(payable(powers))));

        uint256 privateKey = getPrivateKeyRoleHolder(powers, 5, 0, privateKeys);
        vm.startBroadcast(privateKey);
        Powers(payable(powers)).request(mandateSlots[mandateSlot], abi.encode(role, percentage), nonce, string.concat("Vetoing split payment for role: ", vm.toString(role), " with percentage: ", vm.toString(percentage)));
        vm.stopBroadcast();
    }

    function executeSplitPayment(address powers, uint8 role, uint8 percentage, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Split Checkpoint 1: Confirm no Minter veto.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Split Checkpoint 2: Confirm no Owner veto.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Execute Split Payment: Set new split payment.", Powers(payable(powers))));

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

    ///////////////////////////////////////////////////////////////
    //                       ROLE MANAGEMENT                     //
    ///////////////////////////////////////////////////////////////

    function getOwnerArtistIntermediaryRole(address powers, uint256 tokenId, uint256 nonce) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg("Check ownership Token: This check is needed to assign the owner role to the NFT owner in the next mandate.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Check artist Token: This check is needed to assign the artist role to the NFT artist in the next mandate.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Check intermediary Token: This check is needed to assign the intermediary role to the NFT intermediary in the next mandate.", Powers(payable(powers))));

        vm.startBroadcast();
        for (uint256 i = 0; i < mandateSlots.length; i++) {
            Powers(payable(powers)).request(mandateSlots[i], abi.encode(tokenId), nonce, string.concat("Claiming role for tokenId: ", vm.toString(tokenId)));
        }
        vm.stopBroadcast();

        delete mandateSlots;
        mandateSlots.push(findMandateIdInOrg("Assign Owner Role: Assigns Owner role to the owner of the NFT.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Assign Artist Role: Assigns Artist role to the artist of the NFT.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Assign Intermediary Role: Assigns Intermediary role to the approved address of the NFT.", Powers(payable(powers))));

        vm.startBroadcast();
        for (uint256 i = 0; i < mandateSlots.length; i++) {
            Powers(payable(powers)).request(mandateSlots[i], abi.encode(tokenId), nonce, string.concat("Claiming role for tokenId: ", vm.toString(tokenId)));
        }
        vm.stopBroadcast();
    }

    function claimVoterRole(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Claim Voter Role: Artists, Owners, and Intermediarys can claim voter role.", Powers(payable(powers))));

        for (uint256 i = 0; i < privateKeys.length; i++) {
            address claimant = vm.addr(privateKeys[i]);
            if (Powers(payable(powers)).hasRoleSince(claimant, 1) > 0 || Powers(payable(powers)).hasRoleSince(claimant, 2) > 0 || Powers(payable(powers)).hasRoleSince(claimant, 3) > 0) {
                vm.startBroadcast();
                Powers(payable(powers)).request(mandateSlots[0], abi.encode(claimant), nonce, string.concat("Claiming voter role for: ", vm.toString(claimant)));
                vm.stopBroadcast();
            }
        }
    }

    ///////////////////////////////////////////////////////////////
    //                  VOTER AND EXECUTIVE ROLES                //
    ///////////////////////////////////////////////////////////////

    function createExecutiveElection(address powers, uint256[] memory privateKeys, uint256 nonce) public returns (uint256) {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Create Executive Election: Voters can create election.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Nominate for Executive: Voters can nominate.", Powers(payable(powers))));

        uint256 electionId = createElectionAndNominate(
            powers,
            mandateSlots[0],
            mandateSlots[1],
            "Executive Election 1",
            privateKeys,
            nonce
        );

        return electionId;
    }

    function voteInExecutiveElection(address powers, address electionRegistry, bool[][] memory voteSelections, uint256 electionId, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Open Executive Vote: Open voting.", Powers(payable(powers))));

        openVotingAndCastVotes(
            powers,
            electionRegistry,
            mandateSlots[0],
            electionId,
            "Executive Election 1",
            privateKeys,
            voteSelections,
            nonce
        );
    }

    function tallyExecutiveElection(address powers, uint256[] memory privateKeys, uint256 nonce) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg("Tally Executive Election: Tally votes.", Powers(payable(powers))));
        mandateSlots.push(findMandateIdInOrg("Cleanup Election: Cleanup mandates.", Powers(payable(powers))));

        tallyElection(
            powers,
            mandateSlots[0],
            mandateSlots[1],
            privateKeys,
            "Executive Election 1",
            nonce
        );
    }
}
