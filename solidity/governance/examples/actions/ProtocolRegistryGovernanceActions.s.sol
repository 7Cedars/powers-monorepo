// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "./ActionHelpers.s.sol";

/// @notice Action functions for the Protocol Registry Governance organisation.
///         Covers all six governance flows: mandate registration, emergency deactivation,
///         submission criteria, governance reform, membership, and admin sunset.
///
///         Each flow has a propose/execute pair (or single-step where voting is not required).
///         Use the exact nameDescription strings from the deploy script for mandate lookups.
contract ProtocolRegistryGovernanceActions is ActionHelpers {

    ///////////////////////////////////////////////////////////////
    //                  FLOW 1: Register Mandate                 //
    ///////////////////////////////////////////////////////////////

    /// @notice Developers propose a new mandate registration and cast votes.
    /// @param powers       Address of the deployed organisation.
    /// @param mandateName  Human-readable name for the mandate (e.g. "StatementOfIntent").
    /// @param mandateAddr  Address of the mandate contract to register.
    /// @param codeHash     keccak256 of the mandate's creation code.
    /// @param privateKeys  Developer keys to vote with.
    /// @param nonce        Unique nonce to derive the action ID.
    function proposeMandateRegistration(
        address powers,
        string memory mandateName,
        address mandateAddr,
        bytes32 codeHash,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg(
            "Propose Mandate Registration: Developers vote to register a new mandate implementation.",
            Powers(payable(powers))
        ));

        bytes memory calldata_ = abi.encode(mandateName, mandateAddr, codeHash);

        vm.startBroadcast(privateKeys[0]);
        actionIds.push(IPowers(powers).propose(
            mandateSlots[0],
            calldata_,
            nonce,
            string.concat("Proposing registration of: ", mandateName)
        ));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers, mandateSlots[0], actionIds[0], privateKeys, nonce, 100
        );
        console2.log("Registration proposal votes - For:", forVote, "Against:", againstVote);
    }

    /// @notice Security Council approves a passed registration proposal.
    function approveRegistration(
        address powers,
        string memory mandateName,
        address mandateAddr,
        bytes32 codeHash,
        uint256 councilKey,
        uint256 nonce
    ) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Security Council Approve Registration: Security Council approves a proposed mandate registration.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(councilKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(mandateName, mandateAddr, codeHash),
            nonce,
            string.concat("Security Council approving registration of: ", mandateName)
        );
        vm.stopBroadcast();
        console2.log("Security Council approved registration of:", mandateName);
    }

    /// @notice Admin casts a veto on a registration proposal (founding period only).
    function vetoRegistration(
        address powers,
        string memory mandateName,
        address mandateAddr,
        bytes32 codeHash,
        uint256 adminKey,
        uint256 nonce
    ) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Admin Veto Registration: Admin vetoes a proposed mandate registration during the founding period.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(adminKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(mandateName, mandateAddr, codeHash),
            nonce,
            string.concat("Admin vetoing registration of: ", mandateName)
        );
        vm.stopBroadcast();
        console2.log("Admin vetoed registration of:", mandateName);
    }

    /// @notice Developer executes registerMandate() after approval, no veto, and timelock.
    function executeRegistration(
        address powers,
        string memory mandateName,
        address mandateAddr,
        bytes32 codeHash,
        uint256 developerKey,
        uint256 nonce
    ) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Execute Mandate Registration: Developer executes registerMandate() after approval and timelock.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(developerKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(mandateName, mandateAddr, codeHash),
            nonce,
            string.concat("Executing registration of: ", mandateName)
        );
        vm.stopBroadcast();
        console2.log("Registration executed for:", mandateName);
    }

    ///////////////////////////////////////////////////////////////
    //                FLOW 2: Emergency Deactivate               //
    ///////////////////////////////////////////////////////////////

    /// @notice Security Council immediately deactivates a mandate (no vote required).
    /// @param major        Major version of the mandate to deactivate.
    /// @param minor        Minor version.
    /// @param patch        Patch version.
    /// @param mandateName  Name key in the registry.
    function emergencyDeactivate(
        address powers,
        uint16 major,
        uint16 minor,
        uint16 patch,
        string memory mandateName,
        uint256 councilKey,
        uint256 nonce
    ) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Emergency Deactivate Mandate: Security Council immediately deactivates a mandate with a security vulnerability.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(councilKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(major, minor, patch, mandateName),
            nonce,
            string.concat("Emergency deactivating mandate: ", mandateName)
        );
        vm.stopBroadcast();
        console2.log("Emergency deactivation executed for:", mandateName);
    }

    /// @notice Community proposes to reactivate a deactivated mandate and casts votes.
    function proposeReactivation(
        address powers,
        uint16 major,
        uint16 minor,
        uint16 patch,
        string memory mandateName,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg(
            "Propose Mandate Reactivation: Community votes to reverse a Security Council emergency deactivation.",
            Powers(payable(powers))
        ));

        bytes memory calldata_ = abi.encode(major, minor, patch, mandateName);

        vm.startBroadcast(privateKeys[0]);
        actionIds.push(IPowers(powers).propose(
            mandateSlots[0],
            calldata_,
            nonce,
            string.concat("Proposing reactivation of: ", mandateName)
        ));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers, mandateSlots[0], actionIds[0], privateKeys, nonce, 100
        );
        console2.log("Reactivation proposal votes - For:", forVote, "Against:", againstVote);
    }

    /// @notice Developer executes reactivation after community vote and timelock.
    function executeReactivation(
        address powers,
        uint16 major,
        uint16 minor,
        uint16 patch,
        string memory mandateName,
        uint256 developerKey,
        uint256 nonce
    ) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Execute Mandate Reactivation: Developer executes reactivateMandate() after community vote.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(developerKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(major, minor, patch, mandateName),
            nonce,
            string.concat("Executing reactivation of: ", mandateName)
        );
        vm.stopBroadcast();
        console2.log("Reactivation executed for:", mandateName);
    }

    ///////////////////////////////////////////////////////////////
    //               FLOW 3: Submission Criteria                 //
    ///////////////////////////////////////////////////////////////

    /// @notice Developers vote on a criteria proposal for 30 days.
    function proposeCriteria(
        address powers,
        string memory title,
        string memory description,
        uint256[] memory developerKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg(
            "Propose Submission Criteria: Developers vote to set or update mandate submission criteria.",
            Powers(payable(powers))
        ));

        bytes memory calldata_ = abi.encode(title, description);

        vm.startBroadcast(developerKeys[0]);
        actionIds.push(IPowers(powers).propose(
            mandateSlots[0],
            calldata_,
            nonce,
            string.concat("Proposing criteria: ", title)
        ));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers, mandateSlots[0], actionIds[0], developerKeys, nonce, 100
        );
        console2.log("Criteria proposal votes - For:", forVote, "Against:", againstVote);
    }

    /// @notice Community casts a veto vote on a passed criteria proposal.
    function vetoCriteria(
        address powers,
        string memory title,
        string memory description,
        uint256[] memory communityKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg(
            "Community Veto Submission Criteria: Community blocks a Developer criteria proposal.",
            Powers(payable(powers))
        ));

        bytes memory calldata_ = abi.encode(title, description);

        vm.startBroadcast(communityKeys[0]);
        actionIds.push(IPowers(powers).propose(
            mandateSlots[0],
            calldata_,
            nonce,
            string.concat("Community vetoing criteria: ", title)
        ));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers, mandateSlots[0], actionIds[0], communityKeys, nonce, 100
        );
        console2.log("Criteria veto votes - For:", forVote, "Against:", againstVote);
    }

    ///////////////////////////////////////////////////////////////
    //               FLOW 4: Governance Reform                   //
    ///////////////////////////////////////////////////////////////

    /// @notice Developers propose a governance reform with a supermajority vote.
    function proposeReform(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256[] memory developerKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg(
            "Propose Governance Reform: Developer supermajority votes to adopt new governance mandates.",
            Powers(payable(powers))
        ));

        bytes memory calldata_ = abi.encode(newMandates, roleIds);

        vm.startBroadcast(developerKeys[0]);
        actionIds.push(IPowers(powers).propose(
            mandateSlots[0],
            calldata_,
            nonce,
            "Proposing governance reform"
        ));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers, mandateSlots[0], actionIds[0], developerKeys, nonce, 100
        );
        console2.log("Reform proposal votes - For:", forVote, "Against:", againstVote);
    }

    /// @notice Developer executes the approved governance reform after the 15-day timelock.
    function executeReform(
        address powers,
        address[] memory newMandates,
        uint256[] memory roleIds,
        uint256 developerKey,
        uint256 nonce
    ) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Adopt Governance Reform: Execute an approved governance reform after the timelock.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(developerKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(newMandates, roleIds),
            nonce,
            "Executing governance reform"
        );
        vm.stopBroadcast();
        console2.log("Governance reform executed.");
    }

    ///////////////////////////////////////////////////////////////
    //               FLOW 5: Membership Management               //
    ///////////////////////////////////////////////////////////////

    /// @notice Any account self-selects as a Community member (role 3).
    function joinAsCommunity(address powers, uint256 privateKey, uint256 nonce) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Join as Community Member: Any account can self-select as a Community member.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(privateKey);
        IPowers(powers).request(mandateSlots[0], abi.encode(), nonce, "Joining as Community member");
        vm.stopBroadcast();
        console2.log("Joined Community:", vm.addr(privateKey));
    }

    /// @notice Admin appoints an account as Developer (role 1).
    function adminAppointDeveloper(address powers, address account, uint256 adminKey, uint256 nonce) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Admin Appoints Developer: Admin assigns the Developer role to an account.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(adminKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(uint256(1), account),
            nonce,
            string.concat("Admin appointing Developer: ", vm.toString(account))
        );
        vm.stopBroadcast();
        console2.log("Admin appointed Developer:", account);
    }

    /// @notice Admin appoints an account as Security Council (role 2).
    function adminAppointCouncil(address powers, address account, uint256 adminKey, uint256 nonce) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Admin Appoints Security Council: Admin assigns the SecurityCouncil role to an account.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(adminKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(uint256(2), account),
            nonce,
            string.concat("Admin appointing Security Council: ", vm.toString(account))
        );
        vm.stopBroadcast();
        console2.log("Admin appointed Security Council:", account);
    }

    ///////////////////////////////////////////////////////////////
    //               FLOW 6: Sunset Admin Authority              //
    ///////////////////////////////////////////////////////////////

    /// @notice Developer supermajority votes to sunset Admin veto power (~6 months post-deploy).
    function proposeSunset(
        address powers,
        string memory rationale,
        uint256[] memory developerKeys,
        uint256 nonce
    ) public {
        delete mandateSlots;
        delete actionIds;

        mandateSlots.push(findMandateIdInOrg(
            "Propose Sunset Admin Veto: Developer supermajority votes to revoke the Admin Veto mandate.",
            Powers(payable(powers))
        ));

        bytes memory calldata_ = abi.encode(rationale);

        vm.startBroadcast(developerKeys[0]);
        actionIds.push(IPowers(powers).propose(
            mandateSlots[0],
            calldata_,
            nonce,
            "Proposing sunset of Admin veto authority"
        ));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(
            powers, mandateSlots[0], actionIds[0], developerKeys, nonce, 100
        );
        console2.log("Sunset proposal votes - For:", forVote, "Against:", againstVote);
    }

    /// @notice Developer executes the sunset after the 8-day timelock, revoking the Admin Veto mandate.
    function executeSunset(
        address powers,
        string memory rationale,
        uint256 developerKey,
        uint256 nonce
    ) public {
        delete mandateSlots;

        mandateSlots.push(findMandateIdInOrg(
            "Execute Sunset Admin Veto: Revoke the Admin Veto mandate to complete the founding period transition.",
            Powers(payable(powers))
        ));

        vm.startBroadcast(developerKey);
        IPowers(powers).request(
            mandateSlots[0],
            abi.encode(rationale),
            nonce,
            "Executing Admin veto sunset"
        );
        vm.stopBroadcast();
        console2.log("Admin Veto mandate revoked. Founding period transition complete.");
    }
}
