// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// --- Forge/OpenZeppelin Imports ---
import { Script } from "forge-std/Script.sol";
import { Create2 } from "@lib/openzeppelin-contracts/contracts/utils/Create2.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "./Configurations.s.sol";
import { MandateAndHelpers } from "./MandatesAndHelpers.s.sol";

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
import { Erc20Taxed } from "../test/mocks/Erc20Taxed.sol";  
import { SimpleErc20Votes } from "../test/mocks/SimpleErc20Votes.sol";  
import { OnchainIdRegistryMock, IdentityRegistryMock, ComplianceRegistryMock, RwaMock } from "../test/mocks/RwaMock.sol";
import { ZKPassport_PowersRegistry } from "@src/helpers/ZKPassport_PowersRegistry.sol";
import { Governed721 } from "@src/helpers/Governed721.sol";
import { Soulbound1155Factory } from "@src/helpers/Soulbound1155.sol";

/// @title InitialisePowers
/// @notice Deploys all library and mandate contracts deterministically using CREATE2
/// and saves their names and addresses to a obj1 file.
contract InitialisePowers is Script, MandateAndHelpers {
    string outputFile; 
    address[] addresses;
   
    function run() external override { 
        string memory obj1 = "some key"; 

        address checksAddr = deploy(type(Checks).creationCode, abi.encode("Checks"));
        vm.serializeAddress(obj1, "Checks", checksAddr);
 
        address mandateUtilsAddr = deploy(type(MandateUtilities).creationCode, abi.encode("MandateUtilities"));
        vm.serializeAddress(obj1, "MandateUtilities", mandateUtilsAddr);

        string memory powersBytecode = generatePowersBytecode(checksAddr);
        vm.serializeString(obj1, "powers", powersBytecode);

        helperConfig = new Configurations(); 
        string memory outputJson = deployAndRecordMandates();

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
        (string[] memory _names, bytes[] memory _creationCodes, bytes[] memory _constructorArgs) = recordMandatesAndHelpers();
 
        //////////////////////////////////////////////////////////////////////////
        //                          DEPLOY SEQUENCE                             //
        //////////////////////////////////////////////////////////////////////////
        string memory obj2 = "second key";
        address mandateAddr;
        for (uint256 i = 0; i < _names.length; i++) {
            mandateAddr = deploy(_creationCodes[i], _constructorArgs[i]);
            addresses.push(mandateAddr);
            vm.serializeAddress(obj2, _names[i], mandateAddr);
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
}
