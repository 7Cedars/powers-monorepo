// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "./Configurations.s.sol";
import { ZKPassport_PowersRegistry } from "@src/addons/helpers/ZKPassport_PowersRegistry.sol";

/// @notice Deploys a mock ZKPassport_PowersRegistry with a non-valid domain and scope.
contract DeployZKPassportPowersRegistry is Script {
    // Not a real domain — intentionally invalid for mock/testing purposes.
    string constant MOCK_DOMAIN = "mock.invalid.powers";
    string constant MOCK_SCOPE = "mock-scope-powers-test";

    function run() external returns (address) {
        Configurations config = new Configurations();
        uint256 chainId = block.chainid;

        address verifier = config.getZkPassportVerifier(chainId);
        address helper = config.getZkPassportHelper(chainId);

        console2.log("Deploying ZKPassport_PowersRegistry...");
        console2.log("  Chain ID:  ", chainId);
        console2.log("  Verifier:  ", verifier);
        console2.log("  Helper:    ", helper);
        console2.log("  Domain:    ", MOCK_DOMAIN);
        console2.log("  Scope:     ", MOCK_SCOPE);

        vm.startBroadcast();
        ZKPassport_PowersRegistry registry = new ZKPassport_PowersRegistry(verifier, helper, MOCK_DOMAIN, MOCK_SCOPE);
        vm.stopBroadcast();

        console2.log("ZKPassport_PowersRegistry deployed at:", address(registry));
        return address(registry);
    }
}
