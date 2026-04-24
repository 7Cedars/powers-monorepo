// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// --- Forge/OpenZeppelin Imports ---
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "./Configurations.s.sol";

// --- Library Imports ---
import { Checks } from "@src/libraries/Checks.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";

// --- Interfaces ---
import { IPowers } from "@src/interfaces/IPowers.sol";
import { IMandate } from "@src/interfaces/IMandate.sol";
import { MandateRegistry } from "@src/helpers/MandateRegistry.sol";

// --- Library Imports ---
import { Checks } from "@src/libraries/Checks.sol";

// ELECTORAL MANDATES
import { PeerSelect } from "@src/mandates/electoral/PeerSelect.sol";
import { RoleByRoles } from "@src/mandates/electoral/RoleByRoles.sol";
import { SelfSelect } from "@src/mandates/electoral/SelfSelect.sol";
import { RenounceRole } from "@src/mandates/electoral/RenounceRole.sol";
import { AssignExternalRole } from "@src/mandates/electoral/AssignExternalRole.sol";
import { DelegateTokenSelect } from "@src/mandates/electoral/DelegateTokenSelect.sol";
import { Nominate } from "@src/mandates/electoral/Nominate.sol";
import { RevokeInactiveAccounts } from "@src/mandates/electoral/RevokeInactiveAccounts.sol";
import { RevokeAccountsRoleId } from "@src/mandates/electoral/RevokeAccountsRoleId.sol";

// EXECUTIVE MANDATES
import { PresetActions } from "@src/mandates/executive/PresetActions.sol";
import { OpenAction } from "@src/mandates/executive/OpenAction.sol";
import { StatementOfIntent } from "@src/mandates/executive/StatementOfIntent.sol";

import { CheckExternalActionState } from "@src/mandates/executive/CheckExternalActionState.sol";
import { BespokeAction_OnReturnValue } from "@src/mandates/executive/BespokeAction_OnReturnValue.sol";
import { BespokeAction_Advanced } from "@src/mandates/executive/BespokeAction_Advanced.sol";
import { BespokeAction_Simple } from "@src/mandates/executive/BespokeAction_Simple.sol";
import { ExternalAction_Simple } from "@src/mandates/executive/ExternalAction_Simple.sol";
import { ExternalAction_Flexible } from "@src/mandates/executive/ExternalAction_Flexible.sol";
import { PresetActions_OnOwnPowers } from "@src/mandates/executive/PresetActions_OnOwnPowers.sol";

// INTEGRATION MANDATES
// Election List
import { ElectionList_Nominate } from "@src/mandates/integrations/ElectionList/ElectionList_Nominate.sol";
import { ElectionList_Tally } from "@src/mandates/integrations/ElectionList/ElectionList_Tally.sol";
import { ElectionList_Vote } from "@src/mandates/integrations/ElectionList/ElectionList_Vote.sol";
import {
    ElectionList_CreateVoteMandate
} from "@src/mandates/integrations/ElectionList/ElectionList_CreateVoteMandate.sol";
import {
    ElectionList_CleanUpVoteMandate
} from "@src/mandates/integrations/ElectionList/ElectionList_CleanUpVoteMandate.sol";

// ERC721
import { ERC721_GatedAccess } from "@src/mandates/integrations/ERC721/ERC721_GatedAccess.sol";

// // GitHub -> Chainlink CCIP
// import { Github_ClaimRoleWithSig } from "@src/mandates/integrations/Github/Github_ClaimRoleWithSig.sol";
// import { Github_AssignRoleWithSig } from "@src/mandates/integrations/Github/Github_AssignRoleWithSig.sol";

// GovernedToken
import { GovernedToken_GatedAccess } from "@src/mandates/integrations/GovernedToken/GovernedToken_GatedAccess.sol";
import {
    GovernedToken_MintEncodedToken
} from "@src/mandates/integrations/GovernedToken/GovernedToken_MintEncodedToken.sol";
import {
    GovernedToken_CollectSplitPayment
} from "@src/mandates/integrations/GovernedToken/GovernedToken_CollectSplitPayment.sol";
import { GovernedToken_BurnToAccess } from "@src/mandates/integrations/GovernedToken/GovernedToken_BurnToAccess.sol";

// Governor
import { Governor_CreateProposal } from "@src/mandates/integrations/Governor/Governor_CreateProposal.sol";
import { Governor_ExecuteProposal } from "@src/mandates/integrations/Governor/Governor_ExecuteProposal.sol";

// PowersFactory
import { PowersFactory_AssignRole } from "@src/mandates/integrations/PowersFactory/PowersFactory_AssignRole.sol";
import {
    PowersFactory_AddSafeDelegate
} from "@src/mandates/integrations/PowersFactory/PowersFactory_AddSafeDelegate.sol";

// Safe
import { Safe_ExecTransaction } from "@src/mandates/integrations/Safe/Safe_ExecTransaction.sol";
import { Safe_RecoverTokens } from "@src/mandates/integrations/Safe/Safe_RecoverTokens.sol";
import {
    Safe_ExecTransaction_OnReturnValue
} from "@src/mandates/integrations/Safe/Safe_ExecTransaction_OnReturnValue.sol";
import { SafeAllowance_Transfer } from "@src/mandates/integrations/Safe/SafeAllowance_Transfer.sol";
import { SafeAllowance_PresetTransfer } from "@src/mandates/integrations/Safe/SafeAllowance_PresetTransfer.sol";
import { SafeAllowance_Action } from "@src/mandates/integrations/Safe/SafeAllowance_Action.sol";

// Snapshot
// Will be reintegrated soon.

// ZKPassport
import { ZKPassport_Check } from "@src/mandates/integrations/ZKPassport/ZKPassport_Check.sol";

// REFORM MANDATES
import { Adopt_Mandates } from "@src/mandates/reform/Adopt_Mandates.sol";
import { Revoke_Mandates } from "@src/mandates/reform/Revoke_Mandates.sol";
import { PauseMandates } from "@src/mandates/reform/PauseMandates.sol";

/// @title DeployMandates
/// @notice Deploys all library and mandate contracts
/// and registers them to the MandateRegistry via the Powers protocol.
contract DeployMandates is Script {
    Configurations helperConfig;
    MandateRegistry registry;
    string[] names;
    bytes[] creationCodes;
    bytes[] constructorArgs;
    uint48[] versions;
    address[] addresses;

    function run() external returns (address) {
        helperConfig = new Configurations();

        address registryAddr = helperConfig.getMandateRegistry(block.chainid);
        if (registryAddr != address(0)) {
            registry = MandateRegistry(registryAddr); 
        } else {
            console2.log("No existing MandateRegistry found for this network. Deploying new MandateRegistry...");
        }
        vm.startBroadcast();
            registry = new MandateRegistry();
        vm.stopBroadcast();
        // MandateRegistry registry = MandateRegistry(registryAddr);
        // IPowers powers = IPowers(registry.owner());
        // uint16 submitMandateId = helperConfig.getSubmitMandateId(block.chainid);

        _recordMandates();

        string[] memory regNames = new string[](names.length);
        address[] memory regAddresses = new address[](names.length);
        bytes32[] memory regCreationCodeHashes = new bytes32[](names.length);
        uint256 regCount = 0;

        for (uint256 i = 0; i < names.length; i++) {
            bool isRegistered = registry.isMandateRegistered(bytes32(keccak256(creationCodes[i])));
            if (isRegistered) {
                console2.log("Mandate already registered, skipping:", names[i]);
                continue;
            }
            address mandateAddr = deploy(creationCodes[i], constructorArgs[i]);
            addresses.push(mandateAddr);

            regNames[regCount] = names[i];
            regAddresses[regCount] = mandateAddr;
            regCreationCodeHashes[regCount] = bytes32(keccak256(creationCodes[i]));
            regCount++;
        }

        // Create exactly-sized arrays for the registration payload
        if (regCount > 0) {
            // bytes memory dynamicParams = abi.encode(finalNames, finalAddresses);
            vm.startBroadcast(); 
            registry.batchRegisterMandates(regNames, regAddresses, regCreationCodeHashes);
            // powers.request(submitMandateId, dynamicParams, 0, "Batch Register Mandates");
            vm.stopBroadcast();

            console2.log("Successfully registered mandates to MandateRegistry.");
        } else {
            console2.log("No mandates for registration.");
        }

        console2.log("-----------------------------------------");
        console2.log("Registry Address:", address(registry));
        console2.log("Total contracts deployed:", names.length);
        console2.log("Total mandates registered:", regCount);
        console2.log("-----------------------------------------");

        return address(registry);
    }

    /// @dev Deploys a mandate normally (no CREATE2).
    function deploy(bytes memory creationCode, bytes memory constructorArg) internal returns (address) {
        bytes memory deploymentData = abi.encodePacked(creationCode, constructorArg);
        address deployedAddress;

        vm.startBroadcast();
        assembly {
            deployedAddress := create(0, add(deploymentData, 0x20), mload(deploymentData))
        }
        vm.stopBroadcast();

        require(deployedAddress != address(0), "Error: Deployment failed.");
        return deployedAddress;
    }

    function _packVersion(uint16 major, uint16 minor, uint16 patch) public pure returns (uint48) {
        return (uint48(major) << 32) | (uint48(minor) << 16) | uint48(patch);
    }

    function _recordMandates() internal {
        //////////////////////////////////////////////////////////////////////////
        //                      Electoral Mandates                              //
        //////////////////////////////////////////////////////////////////////////
        names.push("PeerSelect");
        creationCodes.push(type(PeerSelect).creationCode);
        constructorArgs.push(abi.encode("PeerSelect"));

        names.push("RoleByRoles");
        creationCodes.push(type(RoleByRoles).creationCode);
        constructorArgs.push(abi.encode("RoleByRoles"));

        names.push("SelfSelect");
        creationCodes.push(type(SelfSelect).creationCode);
        constructorArgs.push(abi.encode("SelfSelect"));

        names.push("RenounceRole");
        creationCodes.push(type(RenounceRole).creationCode);
        constructorArgs.push(abi.encode("RenounceRole"));

        names.push("AssignExternalRole");
        creationCodes.push(type(AssignExternalRole).creationCode);
        constructorArgs.push(abi.encode("AssignExternalRole"));

        names.push("DelegateTokenSelect");
        creationCodes.push(type(DelegateTokenSelect).creationCode);
        constructorArgs.push(abi.encode("DelegateTokenSelect"));

        names.push("Nominate");
        creationCodes.push(type(Nominate).creationCode);
        constructorArgs.push(abi.encode("Nominate"));

        names.push("RevokeInactiveAccounts");
        creationCodes.push(type(RevokeInactiveAccounts).creationCode);
        constructorArgs.push(abi.encode("RevokeInactiveAccounts"));

        names.push("RevokeAccountsRoleId");
        creationCodes.push(type(RevokeAccountsRoleId).creationCode);
        constructorArgs.push(abi.encode("RevokeAccountsRoleId"));

        //////////////////////////////////////////////////////////////////////////
        //                       Executive Mandates                             //
        //////////////////////////////////////////////////////////////////////////
        names.push("PresetActions");
        creationCodes.push(type(PresetActions).creationCode);
        constructorArgs.push(abi.encode("PresetActions"));

        names.push("PresetActions_OnOwnPowers");
        creationCodes.push(type(PresetActions_OnOwnPowers).creationCode);
        constructorArgs.push(abi.encode("PresetActions_OnOwnPowers"));

        names.push("OpenAction");
        creationCodes.push(type(OpenAction).creationCode);
        constructorArgs.push(abi.encode("OpenAction"));

        names.push("StatementOfIntent");
        creationCodes.push(type(StatementOfIntent).creationCode);
        constructorArgs.push(abi.encode("StatementOfIntent"));

        names.push("BespokeAction_Advanced");
        creationCodes.push(type(BespokeAction_Advanced).creationCode);
        constructorArgs.push(abi.encode("BespokeAction_Advanced"));

        names.push("BespokeAction_OnReturnValue");
        creationCodes.push(type(BespokeAction_OnReturnValue).creationCode);
        constructorArgs.push(abi.encode("BespokeAction_OnReturnValue"));

        names.push("BespokeAction_Simple");
        creationCodes.push(type(BespokeAction_Simple).creationCode);
        constructorArgs.push(abi.encode("BespokeAction_Simple"));

        names.push("CheckExternalActionState");
        creationCodes.push(type(CheckExternalActionState).creationCode);
        constructorArgs.push(abi.encode("CheckExternalActionState"));

        names.push("ExternalAction_Simple");
        creationCodes.push(type(ExternalAction_Simple).creationCode);
        constructorArgs.push(abi.encode("ExternalAction_Simple"));

        names.push("ExternalAction_Flexible");
        creationCodes.push(type(ExternalAction_Flexible).creationCode);
        constructorArgs.push(abi.encode("ExternalAction_Flexible"));

        //////////////////////////////////////////////////////////////////////////
        //                      Integrations Mandates                           //
        //////////////////////////////////////////////////////////////////////////
        names.push("Governor_CreateProposal");
        creationCodes.push(type(Governor_CreateProposal).creationCode);
        constructorArgs.push(abi.encode("Governor_CreateProposal"));

        names.push("Governor_ExecuteProposal");
        creationCodes.push(type(Governor_ExecuteProposal).creationCode);
        constructorArgs.push(abi.encode("Governor_ExecuteProposal"));

        names.push("Safe_ExecTransaction");
        creationCodes.push(type(Safe_ExecTransaction).creationCode);
        constructorArgs.push(abi.encode("Safe_ExecTransaction"));

        names.push("Safe_ExecTransaction_OnReturnValue");
        creationCodes.push(type(Safe_ExecTransaction_OnReturnValue).creationCode);
        constructorArgs.push(abi.encode("Safe_ExecTransaction_OnReturnValue"));

        names.push("Safe_RecoverTokens");
        creationCodes.push(type(Safe_RecoverTokens).creationCode);
        constructorArgs.push(abi.encode("Safe_RecoverTokens"));

        names.push("SafeAllowance_Transfer");
        creationCodes.push(type(SafeAllowance_Transfer).creationCode);
        constructorArgs.push(abi.encode("SafeAllowance_Transfer"));

        names.push("SafeAllowance_PresetTransfer");
        creationCodes.push(type(SafeAllowance_PresetTransfer).creationCode);
        constructorArgs.push(abi.encode("SafeAllowance_PresetTransfer"));

        names.push("SafeAllowance_Action");
        creationCodes.push(type(SafeAllowance_Action).creationCode);
        constructorArgs.push(abi.encode("SafeAllowance_Action"));

        names.push("PowersFactory_AssignRole");
        creationCodes.push(type(PowersFactory_AssignRole).creationCode);
        constructorArgs.push(abi.encode("PowersFactory_AssignRole"));

        names.push("PowersFactory_AddSafeDelegate");
        creationCodes.push(type(PowersFactory_AddSafeDelegate).creationCode);
        constructorArgs.push(abi.encode("PowersFactory_AddSafeDelegate"));

        names.push("GovernedToken_GatedAccess");
        creationCodes.push(type(GovernedToken_GatedAccess).creationCode);
        constructorArgs.push(abi.encode("GovernedToken_GatedAccess"));

        names.push("ERC721_GatedAccess");
        creationCodes.push(type(ERC721_GatedAccess).creationCode);
        constructorArgs.push(abi.encode("ERC721_GatedAccess"));

        names.push("GovernedToken_MintEncodedToken");
        creationCodes.push(type(GovernedToken_MintEncodedToken).creationCode);
        constructorArgs.push(abi.encode("GovernedToken_MintEncodedToken"));

        names.push("GovernedToken_BurnToAccess");
        creationCodes.push(type(GovernedToken_BurnToAccess).creationCode);
        constructorArgs.push(abi.encode("GovernedToken_BurnToAccess"));

        names.push("ElectionList_Vote");
        creationCodes.push(type(ElectionList_Vote).creationCode);
        constructorArgs.push(abi.encode("ElectionList_Vote"));

        names.push("ElectionList_Nominate");
        creationCodes.push(type(ElectionList_Nominate).creationCode);
        constructorArgs.push(abi.encode("ElectionList_Nominate"));

        names.push("ElectionList_CreateVoteMandate");
        creationCodes.push(type(ElectionList_CreateVoteMandate).creationCode);
        constructorArgs.push(abi.encode("ElectionList_CreateVoteMandate"));

        names.push("ElectionList_Tally");
        creationCodes.push(type(ElectionList_Tally).creationCode);
        constructorArgs.push(abi.encode("ElectionList_Tally"));

        names.push("ElectionList_CleanUpVoteMandate");
        creationCodes.push(type(ElectionList_CleanUpVoteMandate).creationCode);
        constructorArgs.push(abi.encode("ElectionList_CleanUpVoteMandate"));

        names.push("GovernedToken_CollectSplitPayment");
        creationCodes.push(type(GovernedToken_CollectSplitPayment).creationCode);
        constructorArgs.push(abi.encode("GovernedToken_CollectSplitPayment"));

        names.push("ZKPassport_Check");
        creationCodes.push(type(ZKPassport_Check).creationCode);
        constructorArgs.push(abi.encode());

        //////////////////////////////////////////////////////////////////////////
        //                          Reform Mandates                             //
        //////////////////////////////////////////////////////////////////////////
        names.push("Adopt_Mandates");
        creationCodes.push(type(Adopt_Mandates).creationCode);
        constructorArgs.push(abi.encode("Adopt_Mandates"));

        names.push("PauseMandates");
        creationCodes.push(type(PauseMandates).creationCode);
        constructorArgs.push(abi.encode("PauseMandates"));

        names.push("Revoke_Mandates");
        creationCodes.push(type(Revoke_Mandates).creationCode);
        constructorArgs.push(abi.encode("Revoke_Mandates"));
    }
}
