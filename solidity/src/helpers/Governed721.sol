// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
// import { PowersTypes } from "@src/interfaces/PowersTypes.sol";

/**
 * @dev Governed721 is meant as an ERC 721 token where minting and transfers are managed by a Powers protocol instance. 
 * This allows for enforcing soulboundness, split payments, etc.  
 * It also allows for encoding data into the token ID, which can be useful for certain applications. 
 */ 
interface IGoverned721 is IERC721 {
    struct TransferData {
        address oldOwner;
        address newOwner;  
        address artist;
        address intermediary;
        uint256 tokenId;
        address paymentToken; 
        uint256 quantity;
        uint256 nonce;
    }

    enum Role { Admin, Artist, OldOwner, Intermediary, NewOwner }  
    
    function mint(address to, uint256 tokenId, address artist, string memory tokenURI) external; 
    function burn(uint256 tokenId) external;
    function setPaymentId(uint16 mandateId) external;
    function setSplit(Role role, uint8 percentage) external;  
    function setWhitelist(address token, bool isWhitelisted) external;
     
    function isWhitelisted(address token) external view returns (bool);
    function getArtist(uint256 tokenId) external view returns (address artist); 
    function getSplit(Role role) external view returns (uint8 percentage);
    function getTransferData(uint256 actionId) external view returns (TransferData memory);
}

contract Governed721 is ERC721URIStorage, IGoverned721, Ownable {
    uint8 public constant DENOMINATOR = 100; 

    mapping (uint256 tokenId => address) private _artists; // tokenId => artist address. 
    mapping (uint256 transferId => TransferData) internal _transfers;
    mapping (address token => bool isWhitelisted) public whitelist; // this is a simple whitelist mapping for tokens.
    mapping (address account => bool isBlacklisted) public blacklist; // this is a simple blacklist mapping for accounts.
    mapping (Role => uint8) public roleToSplit; // mapping to store the split percentage for each role.
    
    uint8 totalSplitPayment; // total percentage of the payment that will be split among the roles.  
    uint16 public paymentMandateId; // the mandate ID that will be required to collect payments. 

    event TransferId(uint256 indexed transferId);

    constructor() ERC721("Governed721", "G721") Ownable(msg.sender) {} 

    ////////////////////////////////////////////////////////////////////////////////////////
    //                                  GOVERNED FUNCTIONS                                //
    //////////////////////////////////////////////////////////////////////////////////////// 
    function setPaymentId(uint16 _mandateId) external onlyOwner { 
        paymentMandateId = _mandateId;
    }

    function setSplit(Role role, uint8 percentage) external onlyOwner {
        if (percentage + roleToSplit[Role.Intermediary] >= DENOMINATOR) revert("Total split payment cannot be 100% or more");
        roleToSplit[Role.Artist] = percentage;
        totalSplitPayment = roleToSplit[Role.Artist] + roleToSplit[Role.Intermediary];
    }

    function setWhitelist(address token, bool isWhitelisted) external onlyOwner {
        whitelist[token] = isWhitelisted;
    }

    function setBlacklist(address account, bool isBlacklisted) external onlyOwner {
        blacklist[account] = isBlacklisted;
    }

    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    //                                   PUBLIC FUNCTIONS                                 //
    //////////////////////////////////////////////////////////////////////////////////////// 
    // Note: In this version, anyone can mint tokens. 
    function mint(address to, uint256 tokenId, address artist, string memory tokenURI) external {
        if (tokenId == 0) revert("Token ID cannot be 0");
        if (artist == address(0)) revert("Artist address cannot be 0");
        if (bytes(tokenURI).length == 0) revert("Token URI cannot be empty");
        if (_ownerOf(tokenId) != address(0)) revert("Token ID already exists");

        _safeMint(to, tokenId);
        _artists[tokenId] = artist;
        _setTokenURI(tokenId, tokenURI);
    }

    /// @dev The payment functionality does NOT currently support native tokens. This is very much a PoC type contract.  
    function safeTransferFrom(address oldOwner, address newOwner, uint256 tokenId, bytes memory data) public override (ERC721, IERC721) {
        address paymentToken; 
        uint256 quantity;
        uint256 nonce; 
        
        if (data.length == 0) {
            // if no data is provided, we assume it's a normal transfer without payment. 
            paymentToken = address(0);
            quantity = 0;
        } else {
            // if data is provided, we assume it's a transfer with payment. The data needs to be encoded as (address paymentToken, uint256 quantity, uint256 nonce). 
            (paymentToken, quantity, nonce) = abi.decode(data, (address, uint256, uint256));
        }

        // check 1: is token whitelisted? 
        if (paymentToken != address(0) && !whitelist[paymentToken]) revert("Payment token is not whitelisted");

        // check 2: are any accounts blacklisted? 
        if (blacklist[oldOwner] || blacklist[newOwner] || blacklist[msg.sender]) revert("Blacklisted account involved in transfer");

        // if checks pass, we proceed with fetching tokens to Powers instance. 
        (bool success) = IERC20(paymentToken).transferFrom(newOwner, owner(), quantity); // transfer payment tokens to this contract. This requires the sender to have approved this contract to spend their tokens.

        if (!success) revert("Payment transfer failed");

        // if payment succeeded, we proceed with the transfer. First we log the transfer 
        uint256 transferId = uint256(keccak256(abi.encode(oldOwner, newOwner, tokenId, paymentToken, quantity, nonce)));
        _transfers[transferId] = TransferData(
            oldOwner, // oldOwner 
            newOwner, // = newOwner
            _artists[tokenId], 
            getApproved(tokenId),
            tokenId, 
            paymentToken, 
            quantity,
            nonce
            );

        // We emit an event that links tokenId and TransferId (note that a Transfer event will also be emited after the NFT transfer concludes.)
        emit TransferId(transferId);
        
        // Followed by the existing function.
        super.safeTransferFrom(oldOwner, newOwner, tokenId, data);
    }

    // This function is meant to be called by the Powers instance after a transfer with payment has been executed, to distribute the payment splits to the relevant parties.
    // Note: it takes the same parameters as the safeTransferFrom function 
    function collectPayment(Role role, address oldOwner, address newOwner, uint256 tokenId, bytes memory data) external { 
        // check: are any accounts blacklisted? 
        if (blacklist[oldOwner] || blacklist[newOwner]) revert("Blacklisted account involved in transfer");

        uint256 nonce = block.number; // only needed for uniqueness, does not need to be random. 

        // this will trigger payment.  
        IPowers(owner()).request(paymentMandateId, abi.encode(role, oldOwner, newOwner, tokenId, data), nonce, "Request payment"); 
    } 

    ////////////////////////////////////////////////////////////////////////////////////////
    //                                  GETTER FUNCTIONS                                  //
    //////////////////////////////////////////////////////////////////////////////////////// 

    function getSplit(Role role) external view returns (uint8 percentage) {
        if (role == Role.OldOwner) {
            return DENOMINATOR - totalSplitPayment; // the old owner gets the remainder after Artist and Intermediary split.
        }
        return roleToSplit[role];
    }

    function getArtist(uint256 tokenId) external view returns (address artist) {
        return _artists[tokenId];
    }

    function getTransferData(uint256 actionId) public view returns (TransferData memory) {
        return _transfers[actionId];
    }

    function isWhitelisted(address token) external view returns (bool) {
        return whitelist[token];
    }

    function isBlacklisted(address account) external view returns (bool) {
        return blacklist[account];
    }
}
