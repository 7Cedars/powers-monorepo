// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// --- Forge/OpenZeppelin Imports ---
import { Script } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol";

// --- Library Imports ---
import { Checks } from "@src/libraries/Checks.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";

// --- Mandate Contract Imports ---
// async mandates


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
import { ElectionList_CreateVoteMandate } from "@src/mandates/integrations/ElectionList/ElectionList_CreateVoteMandate.sol";
import { ElectionList_CleanUpVoteMandate } from "@src/mandates/integrations/ElectionList/ElectionList_CleanUpVoteMandate.sol";
// ERC721 
import { ERC721_GatedAccess } from "@src/mandates/integrations/ERC721/ERC721_GatedAccess.sol";

// GitHub
import { Github_ClaimRoleWithSig } from "@src/mandates/integrations/Github/Github_ClaimRoleWithSig.sol";
import { Github_AssignRoleWithSig } from "@src/mandates/integrations/Github/Github_AssignRoleWithSig.sol";

// GovernedToken
import { GovernedToken_GatedAccess } from "@src/mandates/integrations/GovernedToken/GovernedToken_GatedAccess.sol";
import { GovernedToken_MintEncodedToken } from "@src/mandates/integrations/GovernedToken/GovernedToken_MintEncodedToken.sol";
import { GovernedToken_CollectSplitPayment } from "@src/mandates/integrations/GovernedToken/GovernedToken_CollectSplitPayment.sol";
import { GovernedToken_BurnToAccess } from "@src/mandates/integrations/GovernedToken/GovernedToken_BurnToAccess.sol";

// Governor
import { Governor_CreateProposal } from "@src/mandates/integrations/Governor/Governor_CreateProposal.sol";
import { Governor_ExecuteProposal } from "@src/mandates/integrations/Governor/Governor_ExecuteProposal.sol";


// PowersFactory
import { PowersFactory_AssignRole } from "@src/mandates/integrations/PowersFactory/PowersFactory_AssignRole.sol";
import { PowersFactory_AddSafeDelegate } from "@src/mandates/integrations/PowersFactory/PowersFactory_AddSafeDelegate.sol";

// Safe 
import { Safe_ExecTransaction } from "@src/mandates/integrations/Safe/Safe_ExecTransaction.sol";
import { Safe_RecoverTokens } from "@src/mandates/integrations/Safe/Safe_RecoverTokens.sol";
import { Safe_ExecTransaction_OnReturnValue } from "@src/mandates/integrations/Safe/Safe_ExecTransaction_OnReturnValue.sol";
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
import { Adopt_Preset_Mandates } from "@src/mandates/reform/Adopt_Preset_Mandates.sol";
import { Revoke_Preset_Mandates } from "@src/mandates/reform/Revoke_Preset_Mandates.sol";

// HELPER CONTRACTS 
import { ElectionList } from "@src/helpers/ElectionList.sol";
import { Nominees } from "@src/helpers/Nominees.sol";
import { Erc20Taxed } from "@mocks/Erc20Taxed.sol";  
import { SimpleErc20Votes } from "@mocks/SimpleErc20Votes.sol";  
import { OnchainIdRegistryMock, IdentityRegistryMock, ComplianceRegistryMock, RwaMock } from "@mocks/RwaMock.sol";
import { ZKPassport_PowersRegistry } from "@src/helpers/ZKPassport_PowersRegistry.sol";
import { Governed721 } from "@src/helpers/Governed721.sol";
import { Soulbound1155Factory } from "@src/helpers/Soulbound1155.sol";

/// @title InitialisePowers
/// @notice Deploys all library and mandate contracts deterministically using CREATE2
/// and saves their names and addresses to a obj1 file.
contract InitialisePowers is Script {
    string outputFile;
    Configurations helperConfig; 
    string[] names;
    address[] addresses;
    bytes[] creationCodes;
    bytes[] constructorArgs;

    string[] namePackages;
    address[] addressPackages;
    bytes[] creationCodesPackages;
    bytes[] constructorArgsPackages;

    function run() external {
        string memory obj1 = "some key";
        string memory outputJson;

        address checksAddr = deploy(type(Checks).creationCode, abi.encode("Checks"));
        vm.serializeAddress(obj1, "Checks", checksAddr);

        address mandateUtilsAddr = deploy(type(Checks).creationCode, abi.encode("MandateUtilities"));
        vm.serializeAddress(obj1, "MandateUtilities", mandateUtilsAddr);

        string memory powersBytecode = generatePowersBytecode(checksAddr);
        vm.serializeString(obj1, "powers", powersBytecode);

        helperConfig = new Configurations();
        outputJson = deployAndRecordMandates();

        string memory finalJson = vm.serializeString(obj1, "mandates", outputJson);

        outputFile = string.concat("../frontend/public/powered/", vm.toString(block.chainid), ".json");
        vm.writeJson(finalJson, outputFile);
        console2.log("Success! All deployment data saved to:", outputFile);
    }

    /// @notice Uses vm.ffi() and the 'serialize' function to add bytecode to the obj1 string.
    function generatePowersBytecode(address _checks) internal returns (string memory) {
        // Must return the modified string
        string[] memory inputs = new string[](5);
        inputs[0] = "forge";
        inputs[1] = "build";
        inputs[2] = "--libraries";
        inputs[3] = string.concat("src/libraries/Checks.sol:Checks:", vm.toString(_checks));
        inputs[4] = "--force";

        vm.ffi(inputs);

        string memory artifactJson = vm.readFile("out/Powers.sol/Powers.json");
        string memory deploymentBytecode = vm.parseJsonString(artifactJson, ".bytecode.object");

        return deploymentBytecode; // Return the new obj1 string
    }

    /// @notice Deploys all mandate contracts and uses 'serialize' to record their addresses.
    function deployAndRecordMandates()
        internal
        returns (string memory outputJson)
    {
        //////////////////////////////////////////////////////////////////////////
        //                         Async Mandates                               //
        //////////////////////////////////////////////////////////////////////////
        names.push("Github_ClaimRoleWithSig");
        creationCodes.push(type(Github_ClaimRoleWithSig).creationCode);
        constructorArgs.push(abi.encode(helperConfig.getChainlinkFunctionsRouter(block.chainid)));

        names.push("Github_AssignRoleWithSig");
        creationCodes.push(type(Github_AssignRoleWithSig).creationCode);
        constructorArgs.push(abi.encode());

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

        names.push("Adopt_Preset_Mandates");
        creationCodes.push(type(Adopt_Preset_Mandates).creationCode);
        constructorArgs.push(abi.encode("Adopt_Preset_Mandates"));

        names.push("Revoke_Mandates");
        creationCodes.push(type(Revoke_Mandates).creationCode);
        constructorArgs.push(abi.encode("Revoke_Mandates"));

        names.push("Revoke_Preset_Mandates");
        creationCodes.push(type(Revoke_Preset_Mandates).creationCode);
        constructorArgs.push(abi.encode("Revoke_Preset_Mandates"));

        //////////////////////////////////////////////////////////////////////////
        //                  Singleton Helper Contracts                          //
        //////////////////////////////////////////////////////////////////////////
        names.push("ElectionList");
        creationCodes.push(type(ElectionList).creationCode);
        constructorArgs.push(abi.encode());

        names.push("Nominees");
        creationCodes.push(type(Nominees).creationCode);
        constructorArgs.push(abi.encode("Nominees"));

        names.push("Erc20Taxed");
        creationCodes.push(type(Erc20Taxed).creationCode);
        constructorArgs.push(abi.encode());

        names.push("SimpleErc20Votes");
        creationCodes.push(type(SimpleErc20Votes).creationCode);
        constructorArgs.push(abi.encode());

        names.push("ComplianceRegistryMock");
        creationCodes.push(type(ComplianceRegistryMock).creationCode);
        constructorArgs.push(abi.encode());
        
        names.push("RwaMock");
        creationCodes.push(type(RwaMock).creationCode);
        constructorArgs.push(abi.encode());

        names.push("Governed721"); 
        creationCodes.push(type(Governed721).creationCode);
        constructorArgs.push(abi.encode());

        names.push("Soulbound1155Factory");
        creationCodes.push(type(Soulbound1155Factory).creationCode);
        constructorArgs.push(abi.encode());

        names.push("OnchainIdRegistryMock");
        creationCodes.push(type(OnchainIdRegistryMock).creationCode);
        constructorArgs.push(abi.encode());
 
        names.push("ZKPassport_PowersRegistry");
        creationCodes.push(type(ZKPassport_PowersRegistry).creationCode);
        constructorArgs.push(abi.encode(
            helperConfig.getZkPassportVerifier(block.chainid),
            helperConfig.getZkPassportHelper(block.chainid),
            "powers-git-develop-7cedars-projects.vercel.app",
            "powers"
        ));
 
        //////////////////////////////////////////////////////////////////////////
        //                          DEPLOY SEQUENCE                             //
        //////////////////////////////////////////////////////////////////////////
        string memory obj2 = "second key";
        address mandateAddr;
        for (uint256 i = 0; i < names.length; i++) {
            mandateAddr = deploy(creationCodes[i], constructorArgs[i]);
            addresses.push(mandateAddr);
            vm.serializeAddress(obj2, names[i], mandateAddr);
        }
        outputJson = vm.serializeUint(obj2, "chainId", uint256(block.chainid));
    }

    /// @dev Deploys a mandate using CREATE2. Salt is derived from constructor arguments.
    function deploy(bytes memory creationCode, bytes memory constructorArg) internal returns (address) {
        bytes32 salt = bytes32(abi.encodePacked(constructorArg));
        bytes memory deploymentData = abi.encodePacked(creationCode, constructorArg);
        address computedAddress = Create2.computeAddress(salt, keccak256(deploymentData), CREATE2_FACTORY);

        if (computedAddress.code.length == 0) {
            vm.startBroadcast();
            address deployedAddress = Create2.deploy(0, salt, deploymentData);
            vm.stopBroadcast();
            // require(deployedAddress == computedAddress, "Error: Deployed address mismatch.");
            return deployedAddress;
        }
        return computedAddress;
    }

    // @dev wrapper function to expose deployAndRecordMandates externally and only return addresses and names of mandates.
    function getDeployed() external returns (string[] memory mandateNames, address[] memory mandateAddresses) {
        helperConfig = new Configurations();
        deployAndRecordMandates();
        return (names, addresses);
    }

    function getInitialisedAddress(string memory mandateName) public view returns (address) {
        bytes32 mandateHash = keccak256(abi.encodePacked(mandateName));
        for (uint256 i = 0; i < names.length; i++) {
            bytes32 nameHash = keccak256(abi.encodePacked(names[i]));
            if (nameHash == mandateHash) {
                return addresses[i];
            }
        }
        revert(string.concat("Mandate not found: ", mandateName));
    }

    function getInitialisedAddressNoRevert(string memory mandateName) public view returns (address) {
        bytes32 mandateHash = keccak256(abi.encodePacked(mandateName));
        for (uint256 i = 0; i < names.length; i++) {
            bytes32 nameHash = keccak256(abi.encodePacked(names[i]));
            if (nameHash == mandateHash) {
                return addresses[i];
            }
        }
        return address(0);
    }
}
