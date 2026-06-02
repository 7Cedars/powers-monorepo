// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol";
import { DeployHelpers } from "../DeployHelpers.s.sol";
import { IMandateRegistry } from "@src/helpers/MandateRegistry.sol";

import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

/// @title ProtocolRegistryGovernance Deployment Script
/// @notice Deploys an on-chain organisation that owns and governs the Powers MandateRegistry.
///         After deployment, the current MandateRegistry owner must call
///         `transferOwnership(address(powers))` manually — this is NOT done in this script.
contract Deploy is DeployHelpers {
    Configurations helperConfig;
    PowersTypes.MandateInitData[] constitution;
    PowersTypes.Conditions conditions;
    PowersTypes.Flow[] flows;
    Powers public powers;
    IMandateRegistry registry;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string[] inputParams;

    uint16 constant MAJOR = 0;
    uint16 constant MINOR = 1;
    uint16 constant PATCH = 7;

    function run() external returns (Powers) {
        helperConfig = new Configurations();
        registry = IMandateRegistry(helperConfig.getMandateRegistry(block.chainid));

        vm.startBroadcast();
        powers = new Powers(
            "Protocol Registry Governance",
            "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeicqhl4mo4b5dep3fzheijqnkdrviiqlf23wlasfqznrpqhd3z3qfy/protocolRegistryGovernance.json",
            helperConfig.getMaxCallDataLength(block.chainid),
            helperConfig.getMaxReturnDataLength(block.chainid),
            helperConfig.getMaxExecutionsLength(block.chainid)
        );
        vm.stopBroadcast();
        console2.log("Powers deployed at:", address(powers));

        uint256 constitutionLength = createConstitution();
        console2.log("Constitution length:", constitutionLength);

        vm.startBroadcast();
        powers.constitute(constitution);
        powers.closeConstitute(msg.sender, flows);
        vm.stopBroadcast();
        console2.log("Powers successfully constituted.");
        console2.log("IMPORTANT: Transfer MandateRegistry ownership to", address(powers));

        return powers;
    }

    function createConstitution() internal returns (uint256) {
        uint16 mandateCount = 0;
        address mandateRegistryAddress = helperConfig.getMandateRegistry(block.chainid);

        ////////////////////////////////////////////////////////////////////////
        //                     SETUP (mandateId = 1)                          //
        // Labels all roles and revokes itself. Anyone can trigger this once. //
        ////////////////////////////////////////////////////////////////////////
        calldatas = new bytes[](6);
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "");
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "");
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Developer", "");
        calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "SecurityCouncil", "");
        calldatas[4] = abi.encodeWithSelector(IPowers.labelRole.selector, 3, "Community", "");
        calldatas[5] = abi.encodeWithSelector(IPowers.revokeMandate.selector, uint16(mandateCount + 1));

        mandateCount++;
        conditions.allowedRole = type(uint256).max;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Initial Setup: Assign role labels and revokes itself after execution",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "PresetActions_OnOwnPowers"),
            config: abi.encode(calldatas),
            conditions: conditions
        }));
        delete conditions;

        ////////////////////////////////////////////////////////////////////////
        //                  FLOW 1: Register Mandate                          //
        // Developer vote → Security Council approval → Admin veto window     //
        // → Developer executes registerMandate() after 14-day timelock.      //
        ////////////////////////////////////////////////////////////////////////
        {
            uint16[] memory flow1Ids = new uint16[](4);
            flow1Ids[0] = mandateCount + 1;
            flow1Ids[1] = mandateCount + 2;
            flow1Ids[2] = mandateCount + 3;
            flow1Ids[3] = mandateCount + 4;
            flows.push(PowersTypes.Flow({
                mandateIds: flow1Ids,
                nameDescription: "Register Mandate: Propose, approve, and register a new mandate implementation."
            }));
        }

        // Developers vote to propose a mandate registration. Input: name, address, code hash.
        inputParams = new string[](3);
        inputParams[0] = "string MandateName";
        inputParams[1] = "address MandateAddress";
        inputParams[2] = "bytes32 CreationCodeHash";

        mandateCount++;
        conditions.allowedRole = 1; // Developer
        conditions.votingPeriod = minutesToBlocks(7 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 50;
        conditions.succeedAt = 66;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Propose Mandate Registration: Developers vote to register a new mandate implementation.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // Security Council must affirmatively approve after the proposal passes.
        // If they do not approve, execution is permanently blocked for this action.
        mandateCount++;
        conditions.allowedRole = 2; // SecurityCouncil
        conditions.needFulfilled = mandateCount - 1;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Security Council Approve Registration: Security Council approves a proposed mandate registration.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // Admin can veto within the 14-day timelock window after the proposal passes.
        uint16 adminVetoMandateId = mandateCount + 1; // = 4, stored for reference in sunset flow
        mandateCount++;
        conditions.allowedRole = 0; // Admin
        conditions.needFulfilled = mandateCount - 2; // = Propose mandate
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Admin Veto Registration: Admin vetoes a proposed mandate registration during the founding period.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // Developer executes registerMandate() — requires Security Council approval, no Admin veto,
        // and 14-day timelock (7 days longer than voting period to give both gates time to act).
        mandateCount++;
        conditions.allowedRole = 1; // Developer
        conditions.needFulfilled = mandateCount - 2; // = Security Council Approve
        conditions.needNotFulfilled = mandateCount - 1; // = Admin Veto
        conditions.timelock = minutesToBlocks(14 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Execute Mandate Registration: Developer executes registerMandate() after approval and timelock.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "BespokeAction_Simple"),
            config: abi.encode(
                mandateRegistryAddress,
                bytes4(keccak256("registerMandate(string,address,bytes32)")),
                inputParams
            ),
            conditions: conditions
        }));
        delete conditions;

        ////////////////////////////////////////////////////////////////////////
        //                  FLOW 2: Emergency Deactivate                      //
        // Security Council deactivates immediately (no vote).                //
        // Community can vote to reactivate within ~9 days.                   //
        ////////////////////////////////////////////////////////////////////////
        {
            uint16[] memory flow2Ids = new uint16[](3);
            flow2Ids[0] = mandateCount + 1;
            flow2Ids[1] = mandateCount + 2;
            flow2Ids[2] = mandateCount + 3;
            flows.push(PowersTypes.Flow({
                mandateIds: flow2Ids,
                nameDescription: "Emergency Deactivate: Security Council deactivates a mandate; community can reverse."
            }));
        }

        // Security Council deactivates immediately — no vote, no timelock, acts within hours of a vulnerability.
        inputParams = new string[](4);
        inputParams[0] = "uint16 Major";
        inputParams[1] = "uint16 Minor";
        inputParams[2] = "uint16 Patch";
        inputParams[3] = "string MandateName";

        mandateCount++;
        conditions.allowedRole = 2; // SecurityCouncil
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Emergency Deactivate Mandate: Security Council immediately deactivates a mandate with a security vulnerability.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "BespokeAction_Simple"),
            config: abi.encode(
                mandateRegistryAddress,
                bytes4(keccak256("deactivateMandate(uint16,uint16,uint16,string)")),
                inputParams
            ),
            conditions: conditions
        }));
        delete conditions;

        // Community + Developers vote to reactivate a deactivated mandate.
        // This is the accountability check on Security Council emergency powers.
        mandateCount++;
        conditions.allowedRole = 3; // Community (anyone self-selected)
        conditions.votingPeriod = minutesToBlocks(7 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 30;
        conditions.succeedAt = 51;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Propose Mandate Reactivation: Community votes to reverse a Security Council emergency deactivation.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // Developer executes reactivateMandate() after community vote passes and 2-day timelock.
        mandateCount++;
        conditions.allowedRole = 1; // Developer
        conditions.needFulfilled = mandateCount - 1;
        conditions.timelock = minutesToBlocks(2 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Execute Mandate Reactivation: Developer executes reactivateMandate() after community vote.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "BespokeAction_Simple"),
            config: abi.encode(
                mandateRegistryAddress,
                bytes4(keccak256("reactivateMandate(uint16,uint16,uint16,string)")),
                inputParams
            ),
            conditions: conditions
        }));
        delete conditions;

        ////////////////////////////////////////////////////////////////////////
        //                  FLOW 3: Set Submission Criteria                   //
        // Developers deliberate for 30 days; Community can veto for 14 days. //
        // Produces an on-chain governance record (no contract state change).  //
        ////////////////////////////////////////////////////////////////////////
        {
            uint16[] memory flow3Ids = new uint16[](2);
            flow3Ids[0] = mandateCount + 1;
            flow3Ids[1] = mandateCount + 2;
            flows.push(PowersTypes.Flow({
                mandateIds: flow3Ids,
                nameDescription: "Submission Criteria: Developers set criteria for mandate proposals; community can veto."
            }));
        }

        inputParams = new string[](2);
        inputParams[0] = "string CriteriaTitle";
        inputParams[1] = "string CriteriaDescription";

        // Developers vote for 30 days on a proposed criteria change.
        mandateCount++;
        conditions.allowedRole = 1; // Developer
        conditions.votingPeriod = minutesToBlocks(30 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 50;
        conditions.succeedAt = 66;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Propose Submission Criteria: Developers vote to set or update mandate submission criteria.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // Community can veto a passed criteria proposal within 14 days.
        mandateCount++;
        conditions.allowedRole = 3; // Community
        conditions.needFulfilled = mandateCount - 1;
        conditions.votingPeriod = minutesToBlocks(14 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 20;
        conditions.succeedAt = 51;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Community Veto Submission Criteria: Community blocks a Developer criteria proposal.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        ////////////////////////////////////////////////////////////////////////
        //                  FLOW 4: Governance Reform                         //
        // Developer supermajority proposes new mandates (14 days).           //
        // 15-day timelock then allows adoption.                              //
        ////////////////////////////////////////////////////////////////////////
        {
            uint16[] memory flow4Ids = new uint16[](2);
            flow4Ids[0] = mandateCount + 1;
            flow4Ids[1] = mandateCount + 2;
            flows.push(PowersTypes.Flow({
                mandateIds: flow4Ids,
                nameDescription: "Governance Reform: Developers propose and adopt new governance mandates."
            }));
        }

        inputParams = new string[](2);
        inputParams[0] = "address[] Mandates";
        inputParams[1] = "uint256[] RoleIds";

        // Developer supermajority (66%/66%) votes to propose a reform over 14 days.
        mandateCount++;
        conditions.allowedRole = 1; // Developer
        conditions.votingPeriod = minutesToBlocks(14 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 66;
        conditions.succeedAt = 66;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Propose Governance Reform: Developer supermajority votes to adopt new governance mandates.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // Developer executes the reform after 15-day timelock (one day past voting period).
        mandateCount++;
        conditions.allowedRole = 1; // Developer
        conditions.needFulfilled = mandateCount - 1;
        conditions.timelock = minutesToBlocks(15 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Adopt Governance Reform: Execute an approved governance reform after the timelock.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "Adopt_Mandates"),
            config: abi.encode(),
            conditions: conditions
        }));
        delete conditions;

        ////////////////////////////////////////////////////////////////////////
        //                  FLOW 5: Membership Management                     //
        // Open Community self-select; Admin appoints Developers and Council. //
        // All roles can be voluntarily renounced.                             //
        ////////////////////////////////////////////////////////////////////////
        {
            uint16[] memory flow5Ids = new uint16[](6);
            flow5Ids[0] = mandateCount + 1;
            flow5Ids[1] = mandateCount + 2;
            flow5Ids[2] = mandateCount + 3;
            flow5Ids[3] = mandateCount + 4;
            flow5Ids[4] = mandateCount + 5;
            flow5Ids[5] = mandateCount + 6;
            flows.push(PowersTypes.Flow({
                mandateIds: flow5Ids,
                nameDescription: "Membership: Join as Community; Admin appoints Developers and Security Council; all can leave."
            }));
        }

        // Anyone can join the Community role (role 3) without a vote.
        mandateCount++;
        conditions.allowedRole = type(uint256).max;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Join as Community Member: Any account can self-select as a Community member.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "SelfSelect"),
            config: abi.encode(uint256(3)),
            conditions: conditions
        }));
        delete conditions;

        // Community members can voluntarily leave role 3.
        mandateCount++;
        conditions.allowedRole = 3;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Leave Community: A Community member voluntarily renounces their role.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "RenounceRole"),
            config: abi.encode(uint256(3)),
            conditions: conditions
        }));
        delete conditions;

        // Developers can voluntarily leave role 1.
        mandateCount++;
        conditions.allowedRole = 1;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Leave Developer Role: A Developer voluntarily renounces their Developer role.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "RenounceRole"),
            config: abi.encode(uint256(1)),
            conditions: conditions
        }));
        delete conditions;

        // Security Council members can voluntarily leave role 2.
        mandateCount++;
        conditions.allowedRole = 2;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Leave Security Council: A Security Council member voluntarily renounces their role.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "RenounceRole"),
            config: abi.encode(uint256(2)),
            conditions: conditions
        }));
        delete conditions;

        // Admin can appoint a new Developer (role 1) during the founding period.
        {
            string[] memory appointParams = new string[](1);
            appointParams = new string[](1);
            appointParams[0] = "address Account";

            mandateCount++;
            conditions.allowedRole = 0; // Admin
            constitution.push(PowersTypes.MandateInitData({
                nameDescription: "Admin Appoints Developer: Admin assigns the Developer role to an account.",
                targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "BespokeAction_Simple"),
                config: abi.encode(address(powers), IPowers.assignRole.selector, appointParams),
                conditions: conditions
            }));
            delete conditions;

            // Admin can appoint a new Security Council member (role 2) during the founding period.
            mandateCount++;
            conditions.allowedRole = 0; // Admin
            constitution.push(PowersTypes.MandateInitData({
                nameDescription: "Admin Appoints Security Council: Admin assigns the SecurityCouncil role to an account.",
                targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "BespokeAction_Simple"),
                config: abi.encode(address(powers), IPowers.assignRole.selector, appointParams),
                conditions: conditions
            }));
            delete conditions;
        }

        ////////////////////////////////////////////////////////////////////////
        //                  FLOW 6: Sunset Admin Authority                    //
        // Developer supermajority votes to revoke the Admin Veto mandate.    //
        // Intended to be called ~6 months after deployment.                  //
        ////////////////////////////////////////////////////////////////////////
        {
            uint16[] memory flow6Ids = new uint16[](2);
            flow6Ids[0] = mandateCount + 1;
            flow6Ids[1] = mandateCount + 2;
            flows.push(PowersTypes.Flow({
                mandateIds: flow6Ids,
                nameDescription: "Sunset Admin Authority: Revoke the Admin Veto mandate to complete the founding period transition."
            }));
        }

        inputParams = new string[](1);
        inputParams[0] = "string Rationale";

        // Developer supermajority votes to sunset Admin veto authority.
        mandateCount++;
        conditions.allowedRole = 1; // Developer
        conditions.votingPeriod = minutesToBlocks(7 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 66;
        conditions.succeedAt = 66;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Propose Sunset Admin Veto: Developer supermajority votes to revoke the Admin Veto mandate.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // Execute: revoke the Admin Veto mandate (mandateId = 4) after 8-day timelock.
        calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(IPowers.revokeMandate.selector, adminVetoMandateId);

        mandateCount++;
        conditions.allowedRole = 1; // Developer
        conditions.needFulfilled = mandateCount - 1;
        conditions.timelock = minutesToBlocks(8 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Execute Sunset Admin Veto: Revoke the Admin Veto mandate to complete the founding period transition.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "PresetActions_OnOwnPowers"),
            config: abi.encode(calldatas),
            conditions: conditions
        }));
        delete conditions;

        return constitution.length;
    }
}
