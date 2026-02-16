// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script } from "forge-std/Script.sol";

contract ConfigurationsNew is Script {
    // Chain IDs
    uint256 constant LOCAL_CHAIN_ID = 31_337;
    uint256 constant ETH_SEPOLIA_CHAIN_ID = 11_155_111;
    uint256 constant OPT_SEPOLIA_CHAIN_ID = 11_155_420;
    uint256 constant ARB_SEPOLIA_CHAIN_ID = 421_614;
    uint256 constant BASE_SEPOLIA_CHAIN_ID = 84_532;
    uint256 constant MANTLE_SEPOLIA_CHAIN_ID = 5003;

    // Storage: chainId => configKey => encodedValue
    mapping(uint256 => mapping(string => bytes)) private s_configurations;

    constructor() {
        _initConfig(ETH_SEPOLIA_CHAIN_ID);
        _initConfig(ARB_SEPOLIA_CHAIN_ID);
        _initConfig(OPT_SEPOLIA_CHAIN_ID);
        _initConfig(BASE_SEPOLIA_CHAIN_ID);
        _initConfig(MANTLE_SEPOLIA_CHAIN_ID);
        _initConfig(LOCAL_CHAIN_ID);
    }

    function getValue(uint256 chainId, string memory key) public view returns (bytes memory) {
        bytes memory value = s_configurations[chainId][key];
        // If the value is empty, it might mean it's not set or explicitly empty.
        // For now, we assume if it's length 0, it's not supported/found, similar to the revert in original.
        if (value.length == 0) {
            revert("Configurations__UnsupportedChainOrKey");
        }
        return value;
    }

    function _initConfig(uint256 chainId) internal {
        // BlocksPerHour (uint256)
        if (chainId == ETH_SEPOLIA_CHAIN_ID) s_configurations[chainId]["BlocksPerHour"] = abi.encode(uint256(300));
        else if (chainId == ARB_SEPOLIA_CHAIN_ID) s_configurations[chainId]["BlocksPerHour"] = abi.encode(uint256(14_400));
        else if (chainId == OPT_SEPOLIA_CHAIN_ID) s_configurations[chainId]["BlocksPerHour"] = abi.encode(uint256(1800));
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["BlocksPerHour"] = abi.encode(uint256(1800));
        else if (chainId == MANTLE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["BlocksPerHour"] = abi.encode(uint256(360_000));
        else if (chainId == LOCAL_CHAIN_ID) s_configurations[chainId]["BlocksPerHour"] = abi.encode(uint256(3600));

        // MaxReturnDataLength (uint256)
        if (chainId == ETH_SEPOLIA_CHAIN_ID || 
            chainId == ARB_SEPOLIA_CHAIN_ID || 
            chainId == OPT_SEPOLIA_CHAIN_ID || 
            chainId == BASE_SEPOLIA_CHAIN_ID || 
            chainId == MANTLE_SEPOLIA_CHAIN_ID || 
            chainId == LOCAL_CHAIN_ID) {
            s_configurations[chainId]["MaxReturnDataLength"] = abi.encode(uint256(10_000));
        }

        // MaxCallDataLength (uint256)
        if (chainId == ETH_SEPOLIA_CHAIN_ID || 
            chainId == ARB_SEPOLIA_CHAIN_ID || 
            chainId == OPT_SEPOLIA_CHAIN_ID || 
            chainId == BASE_SEPOLIA_CHAIN_ID || 
            chainId == MANTLE_SEPOLIA_CHAIN_ID || 
            chainId == LOCAL_CHAIN_ID) {
            s_configurations[chainId]["MaxCallDataLength"] = abi.encode(uint256(10_000));
        }

        // MaxExecutionsLength (uint256)
        if (chainId == ETH_SEPOLIA_CHAIN_ID || 
            chainId == ARB_SEPOLIA_CHAIN_ID || 
            chainId == OPT_SEPOLIA_CHAIN_ID || 
            chainId == BASE_SEPOLIA_CHAIN_ID || 
            chainId == MANTLE_SEPOLIA_CHAIN_ID || 
            chainId == LOCAL_CHAIN_ID) {
            s_configurations[chainId]["MaxExecutionsLength"] = abi.encode(uint256(25));
        }

        // ChainlinkFunctionsRouter (address)
        if (chainId == ETH_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsRouter"] = abi.encode(0xb83E47C2bC239B3bf370bc41e1459A34b41238D0);
        else if (chainId == ARB_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsRouter"] = abi.encode(0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C);
        else if (chainId == OPT_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsRouter"] = abi.encode(0xC17094E3A1348E5C7544D4fF8A36c28f2C6AAE28);
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsRouter"] = abi.encode(0xf9B8fc078197181C841c296C876945aaa425B278);
        else if (chainId == MANTLE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsRouter"] = abi.encode(address(0));
        else if (chainId == LOCAL_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsRouter"] = abi.encode(address(0));

        // ChainlinkFunctionsSubscriptionId (uint64)
        if (chainId == ETH_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsSubscriptionId"] = abi.encode(uint64(5819));
        else if (chainId == ARB_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsSubscriptionId"] = abi.encode(uint64(1));
        else if (chainId == OPT_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsSubscriptionId"] = abi.encode(uint64(256));
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsSubscriptionId"] = abi.encode(uint64(1));
        else if (chainId == MANTLE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsSubscriptionId"] = abi.encode(uint64(1));
        else if (chainId == LOCAL_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsSubscriptionId"] = abi.encode(uint64(1));

        // ChainlinkFunctionsGasLimit (uint32)
        if (chainId == ETH_SEPOLIA_CHAIN_ID || 
            chainId == ARB_SEPOLIA_CHAIN_ID || 
            chainId == OPT_SEPOLIA_CHAIN_ID || 
            chainId == BASE_SEPOLIA_CHAIN_ID || 
            chainId == MANTLE_SEPOLIA_CHAIN_ID || 
            chainId == LOCAL_CHAIN_ID) {
            s_configurations[chainId]["ChainlinkFunctionsGasLimit"] = abi.encode(uint32(300_000));
        }

        // ChainlinkFunctionsDonId (bytes32)
        if (chainId == ETH_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsDonId"] = abi.encode(bytes32(0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000));
        else if (chainId == ARB_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsDonId"] = abi.encode(bytes32(0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000));
        else if (chainId == OPT_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsDonId"] = abi.encode(bytes32(0x66756e2d6f7074696d69736d2d7365706f6c69612d3100000000000000000000));
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsDonId"] = abi.encode(bytes32(0x66756e2d6f7074696d69736d2d7365706f6c69612d3100000000000000000000));
        else if (chainId == MANTLE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsDonId"] = abi.encode(bytes32(0x66756e2d6f7074696d69736d2d7365706f6c69612d3100000000000000000000));
        else if (chainId == LOCAL_CHAIN_ID) s_configurations[chainId]["ChainlinkFunctionsDonId"] = abi.encode(bytes32(0x66756e2d6f7074696d69736d2d7365706f6c69612d3100000000000000000000));

        // ChainlinkFunctionsEncryptedSecretsEndpoint (string)
        if (chainId == ETH_SEPOLIA_CHAIN_ID || 
            chainId == ARB_SEPOLIA_CHAIN_ID || 
            chainId == OPT_SEPOLIA_CHAIN_ID || 
            chainId == BASE_SEPOLIA_CHAIN_ID || 
            chainId == MANTLE_SEPOLIA_CHAIN_ID || 
            chainId == LOCAL_CHAIN_ID) {
            s_configurations[chainId]["ChainlinkFunctionsEncryptedSecretsEndpoint"] = abi.encode("https://01.functions-gateway.testnet.chain.link/");
        }

        // SafeCanonical (address)
        if (chainId == ETH_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeCanonical"] = abi.encode(0x41675C099F32341bf84BFc5382aF534df5C7461a);
        else if (chainId == ARB_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeCanonical"] = abi.encode(0x41675C099F32341bf84BFc5382aF534df5C7461a);
        else if (chainId == OPT_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeCanonical"] = abi.encode(0x41675C099F32341bf84BFc5382aF534df5C7461a);
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeCanonical"] = abi.encode(0x41675C099F32341bf84BFc5382aF534df5C7461a);
        else if (chainId == MANTLE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeCanonical"] = abi.encode(address(0));
        else if (chainId == LOCAL_CHAIN_ID) s_configurations[chainId]["SafeCanonical"] = abi.encode(0x41675C099F32341bf84BFc5382aF534df5C7461a);

        // SafeL2Canonical (address)
        if (chainId == ETH_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeL2Canonical"] = abi.encode(0x29fcB43b46531BcA003ddC8FCB67FFE91900C762);
        else if (chainId == ARB_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeL2Canonical"] = abi.encode(0x29fcB43b46531BcA003ddC8FCB67FFE91900C762);
        else if (chainId == OPT_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeL2Canonical"] = abi.encode(0x29fcB43b46531BcA003ddC8FCB67FFE91900C762);
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeL2Canonical"] = abi.encode(0x29fcB43b46531BcA003ddC8FCB67FFE91900C762);
        else if (chainId == MANTLE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeL2Canonical"] = abi.encode(address(0));
        else if (chainId == LOCAL_CHAIN_ID) s_configurations[chainId]["SafeL2Canonical"] = abi.encode(0x29fcB43b46531BcA003ddC8FCB67FFE91900C762);

        // SafeProxyFactory (address)
        if (chainId == ETH_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeProxyFactory"] = abi.encode(0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67);
        else if (chainId == ARB_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeProxyFactory"] = abi.encode(0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67);
        else if (chainId == OPT_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeProxyFactory"] = abi.encode(0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67);
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeProxyFactory"] = abi.encode(0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67);
        else if (chainId == MANTLE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeProxyFactory"] = abi.encode(address(0));
        else if (chainId == LOCAL_CHAIN_ID) s_configurations[chainId]["SafeProxyFactory"] = abi.encode(0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67);

        // SafeAllowanceModule (address)
        if (chainId == ETH_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeAllowanceModule"] = abi.encode(0xCBE43419274415F51e66bd3136c4237172831b59);
        else if (chainId == ARB_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeAllowanceModule"] = abi.encode(0x7320c89189364C9F0154Bfd3ddb510Fb252cB10C);
        else if (chainId == OPT_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeAllowanceModule"] = abi.encode(0xaff1B87A225846c50e147ceAd5baA68004ec0f7c);
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeAllowanceModule"] = abi.encode(0xAA46724893dedD72658219405185Fb0Fc91e091C);
        else if (chainId == MANTLE_SEPOLIA_CHAIN_ID) s_configurations[chainId]["SafeAllowanceModule"] = abi.encode(address(0));
        else if (chainId == LOCAL_CHAIN_ID) s_configurations[chainId]["SafeAllowanceModule"] = abi.encode(0xaff1B87A225846c50e147ceAd5baA68004ec0f7c);

        // ZkPassportVerifier (address)
        if (chainId == ETH_SEPOLIA_CHAIN_ID || chainId == LOCAL_CHAIN_ID) {
            s_configurations[chainId]["ZkPassportVerifier"] = abi.encode(0x1D000001000EFD9a6371f4d90bB8920D5431c0D8);
        } else {
            s_configurations[chainId]["ZkPassportVerifier"] = abi.encode(0x0000000000000000000000000000000000000123);
        }

        // ZkPassportRootRegistry (address)
        if (chainId == ETH_SEPOLIA_CHAIN_ID || chainId == LOCAL_CHAIN_ID) {
            s_configurations[chainId]["ZkPassportRootRegistry"] = abi.encode(0x1D0000020038d6E40E1d98e09fA1bb3A7DAA8B70);
        } else {
            s_configurations[chainId]["ZkPassportRootRegistry"] = abi.encode(0x0000000000000000000000000000000000000123);
        }

        // ZkPassportHelper (address)
        if (chainId == ETH_SEPOLIA_CHAIN_ID || chainId == LOCAL_CHAIN_ID) {
            s_configurations[chainId]["ZkPassportHelper"] = abi.encode(0xd76aA09811dE7c7871E9BFc25eB85F4634adA5C6);
        } else {
            s_configurations[chainId]["ZkPassportHelper"] = abi.encode(0x0000000000000000000000000000000000000123);
        }
    }
}
