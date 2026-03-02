// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

/**
 * @dev Soulbound1155 is meant as a soulbound ERC 1155 token that has a dynamic token ID, allowing for encoding data into the token ID.
 */
interface ISoulbound1155 {
    function mint(address to, uint256 tokenId, address artist) external; 
    function burn(address from, uint256 tokenId) external;
}

// deterministic deployment factory for the Soulbound1155 contract. 
contract Soulbound1155Factory {
    function createSoulbound1155(string memory uri) external returns (address) {
        bytes32 salt = bytes32(abi.encodePacked(msg.sender));
        bytes memory creationCode = type(Soulbound1155).creationCode;
        bytes memory constructorArg = abi.encode(uri);
        bytes memory deploymentData = abi.encodePacked(creationCode, constructorArg);

        address deployedAddress = Create2.deploy(0, salt, deploymentData);

        Soulbound1155 soulbound = Soulbound1155(deployedAddress);
        soulbound.transferOwnership(msg.sender); // transfer ownership to the caller, so they can mint tokens. 
        return deployedAddress;
    }
}

// It is FAR more logical to use ERC721 here! 
contract Soulbound1155 is ERC1155, ISoulbound1155, Ownable {
    // the dao address receives half of mintable coins.
    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) { }

    // Mint tokenIds that encode the minter address and block number.
    function mint(address to, uint256 tokenId, address /* artists */) public virtual onlyOwner {
        _mint(to, tokenId, 1, ""); 
    }

    function burn(address from, uint256 tokenId) public onlyOwner {
        _burn(from, tokenId, 1);
    }

    // override to prevent transfers.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        virtual
        override
    {
        // allow minting and burning
        if (from != address(0) && to != address(0)) {
            revert("Soulbound1155: Transfers are disabled");
        }

        super._update(from, to, ids, values);
    }
}
