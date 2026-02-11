// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract SimpleErc721 is ERC721 {
    uint256 public nextTokenId;

    constructor() ERC721("Simple NFT", "SNFT") {}

    function mint(address to) external {
        _mint(to, nextTokenId++);
    }
}
