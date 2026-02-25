// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
// import { PowersTypes } from "@src/interfaces/PowersTypes.sol";

/**
 * @dev Governed721 is meant as an ERC 721 token where minting and transfers are managed by a Powers protocol instance. 
 * This allows for enforcing soulboundness, split payments, etc.  
 * It also allows for encoding data into the token ID, which can be useful for certain applications. 
 */
interface IGoverned721Wrapper is IERC721 { 
    struct TransferData {
        address oldOwner;
        address newOwner;  
        address artist;
        address intermediary;
        uint256 tokenId;
        address paymentToken; 
        uint256 quantity; 
    }

    function governed721Address() external view returns (address);
    function transferMandateId() external view returns (uint16);
    function getTransfer(uint256 actionId) external view returns (TransferData memory);
}

contract Governed721Wrapper is IGoverned721Wrapper {    
    address public governed721Address;
    address public powersAddress;
    address public deployer;
    uint16 public mintMandateId; 
    uint16 public transferMandateId;

    mapping(uint256 => TransferData) internal _transfers;

    constructor(address _governed721Address, address _powersAddress, uint16 _mintMandateId, uint16 _transferMandateId) {
        governed721Address = _governed721Address;
        powersAddress = _powersAddress;
        mintMandateId = _mintMandateId; // this is the mandate ID that the Powers instance will use for minting. It needs to be set up in the constitution.
        transferMandateId = _transferMandateId; // this is the mandate ID that the Powers instance will use for transfers. It needs to be set up in the constitution.
        deployer = msg.sender;
    }

    function setMandateIds(uint16 _mintMandateId, uint16 _transferMandateId) external {
        if (msg.sender != deployer) revert("Only deployer can set mandate IDs");
        mintMandateId = _mintMandateId;
        transferMandateId = _transferMandateId;
    }

    //////////////////////////////////////////////
    // Functions that are subject to governance // 
    //////////////////////////////////////////////
    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        safeTransferFrom(from, to, tokenId, "");
    }

    /// @dev The payment functionality does NOT currently support native tokens. This is very much a PoC type contract.  
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        uint256 nonce = block.number; 
        address paymentToken; 
        uint256 quantity;
        
        if (data.length == 0) {
            // if no data is provided, we assume it's a normal transfer without payment. 
            paymentToken = address(0);
            quantity = 0;
        } else {
            // if data is provided, we assume it's a transfer with payment. The data needs to be encoded as (address paymentToken, uint256 quantity). 
            // this is just an example, in a real implementation you would need to handle this more robustly and securely.
            (paymentToken, quantity) = abi.decode(data, (address, uint256));
        }

        uint256 actionId = uint256(keccak256(abi.encode(transferMandateId, abi.encode(from, to, tokenId, paymentToken, quantity), nonce)));
        _transfers[actionId] = TransferData(
            from, // oldOwner 
            to, // = newOwner
            IGoverned721(governed721Address).getArtist(tokenId), 
            IGoverned721(governed721Address).getApproved(tokenId),
            tokenId, 
            paymentToken, 
            quantity
            );

        IPowers(powersAddress).request(transferMandateId, abi.encode(from, to, tokenId, paymentToken, quantity), block.number, "");
    }

    ////////////////////////////////////
    // GETTER FUNCTIONS FOR TRANSFERS //
    ////////////////////////////////////
    function getTransfer(uint256 actionId) public view returns (TransferData memory) {
        return _transfers[actionId];
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // The rest of the functions are just pass through to the underlying Governed721 contract.    //
    //////////////////////////////////////////////////////////////////////////////////////////////// 
    function balanceOf(address owner) external view override returns (uint256 balance) {
        return IERC721(governed721Address).balanceOf(owner);
    }

    function ownerOf(uint256 tokenId) external view override returns (address owner) {
        return IERC721(governed721Address).ownerOf(tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) external override {
        revert ("Depricated"); 
    }

    function approve(address to, uint256 tokenId) external override {
        IERC721(governed721Address).approve(to, tokenId);
    }

    function getApproved(uint256 tokenId) external view override returns (address operator) {
        return IERC721(governed721Address).getApproved(tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external override {
        IERC721(governed721Address).setApprovalForAll(operator, approved);
    }

    function isApprovedForAll(address owner, address operator) external view override returns (bool) {
        return IERC721(governed721Address).isApprovedForAll(owner, operator);
    }

    function supportsInterface(bytes4 interfaceId) external view override returns (bool) {
        return IERC721(governed721Address).supportsInterface(interfaceId);
    } 
}

interface IGoverned721 is IERC721 {
    enum Role { Artist, Intermediary } // Old owner NOT included. It receives the remainder after Artist and Intermediary split.

    function mint(address to, uint256 tokenId, address artist) external; 
    function setArtistSplit(uint16 percentage) external;
    function setIntermediarySplit(uint16 percentage) external;
    function oldOwnerSplit() external view returns (uint16 percentage);
    function setWhitelist(address token, bool isWhitelisted) external;
    function isWhitelisted(address token) external view returns (bool);
    function getArtist(uint256 tokenId) external view returns (address artist);
    function artistSplit() external view returns (uint16 percentage);
    function intermediarySplit() external view returns (uint16 percentage);
}

contract Governed721 is ERC721, IGoverned721, Ownable {
    uint8 public constant DENOMINATOR = 100; 

    mapping (uint256 tokenId => address) private _artists; // tokenId => artist address. 
    mapping (address token => bool isWhitelisted) public whitelist; // this is a simple whitelist mapping.
    uint16 public artistSplit; 
    uint16 public intermediarySplit;  
    uint16 totalSplitPayment; // total percentage of the payment that will be split among the roles.  

    constructor() ERC721("Governed721", "G721") Ownable(msg.sender) { }

    // override to prevent any execution of token outside of the Powers protocol.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        onlyOwner
        returns (address)
    { 
        address result = super._update(to, tokenId, auth);
        return result;
    }

    function mint(address to, uint256 tokenId, address artist) external onlyOwner {
        _safeMint(to, tokenId);
        _artists[tokenId] = artist;
    }

    function setArtistSplit(uint16 percentage) external onlyOwner {
        if (percentage + intermediarySplit >= DENOMINATOR) revert("Total split payment cannot be 100% or more");
        artistSplit = percentage;
        totalSplitPayment = artistSplit + intermediarySplit;
    }

    function setIntermediarySplit(uint16 percentage) external onlyOwner {
        if (percentage + artistSplit >= DENOMINATOR) revert("Total split payment cannot be 100% or more");
        intermediarySplit = percentage;
        totalSplitPayment = artistSplit + intermediarySplit;
    }

    function oldOwnerSplit() external view returns (uint16 percentage) {
        return DENOMINATOR - totalSplitPayment; // the old owner gets the remainder after Artist and Intermediary split.
    }


    function setWhitelist(address token, bool isWhitelisted) external onlyOwner {
        whitelist[token] = isWhitelisted;
    }

    function isWhitelisted(address token) external view returns (bool) {
        return whitelist[token];
    }

    function getArtist(uint256 tokenId) external view returns (address artist) {
        return _artists[tokenId];
    }
}
