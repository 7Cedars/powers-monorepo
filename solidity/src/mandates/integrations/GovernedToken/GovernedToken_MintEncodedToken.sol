// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Mandate } from "../../../Mandate.sol";
import { IPowers } from "../../../interfaces/IPowers.sol";
import { Strings } from "@lib/openzeppelin-contracts/contracts/utils/Strings.sol";
import { MandateUtilities } from "@src/libraries/MandateUtilities.sol";

// import { console2 } from "forge-std/console2.sol"; // remove before deploying.

/**
 * @title governedToken
 * @notice Mandate to gate access to a role based on governedToken tokens.
 * @dev Integrates with governedToken.sol to create flexible gated access to roleId in Powers organisations.
 */
contract GovernedToken_MintEncodedToken is Mandate {
    using Strings for uint256;

    struct Mem {
        address governedToken;
        address to;
        address artist;
        string tokenURI;
        uint48 blockNumber;
        uint256 tokenId;
    }

    constructor() {
        bytes memory configParams = abi.encode("address governedToken");
        emit Mandate__Deployed(configParams);
    }

    function initializeMandate(
        uint16 index,
        string memory nameDescription,
        bytes memory inputParams,
        bytes memory config
    ) public override {
        inputParams = abi.encode("address To, address Artist, string TokenURI");
        super.initializeMandate(index, nameDescription, inputParams, config);
    }

    function handleRequest(
        address caller,
        address powers,
        uint16 mandateId,
        bytes calldata mandateCalldata,
        uint256 nonce
    )
        public
        view
        override
        returns (uint256 actionId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas)
    {
        Mem memory mem;
        actionId = MandateUtilities.computeActionId(mandateId, mandateCalldata, nonce);

        // 1. Get config
        mem.governedToken = abi.decode(getConfig(powers, mandateId), (address));
        (mem.to, mem.artist, mem.tokenURI) = abi.decode(mandateCalldata, (address, address, string));

        mem.blockNumber = uint48(block.number);
        mem.tokenId = (uint256(uint160(caller)) << 48) | uint256(mem.blockNumber);

        (targets, values, calldatas) = MandateUtilities.createEmptyArrays(1);
        targets[0] = mem.governedToken;
        calldatas[0] = abi.encodeWithSignature(
            "mint(address,uint256,address,string)", mem.to, mem.tokenId, mem.artist, mem.tokenURI
        );

        return (actionId, targets, values, calldatas);
    }
}
