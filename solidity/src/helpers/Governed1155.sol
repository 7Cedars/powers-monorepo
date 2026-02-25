// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Governed1155 is meant as a soulbound ERC 1155 token that has a dynamic token ID, allowing for encoding data into the token ID.
 */
interface IGoverned1155 {
    function mint(address to, uint256 tokenId, address artist) external; 
}

// It is FAR more logical to use ERC721 here! 
contract Governed1155 is ERC1155, IGoverned1155, Ownable {
    // the dao address receives half of mintable coins.
    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) { }

    // Mint tokenIds that encode the minter address and block number.
    // TODO? Include URI in mint? 
    function mint(address to, uint256 tokenId, address /* artists */) public onlyOwner {
        _mint(to, tokenId, 1, ""); 
    }

    // override to prevent transfers.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        virtual
        override
    {
        // allow minting and burning
        if (from != address(0) && to != address(0)) {
            revert("Governed1155: Transfers are disabled");
        }

        super._update(from, to, ids, values);
    }
}
