// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// import { console2 } from "forge-std/console2.sol"; // remove before deploying.

/// @title Erc20DelegateElection (standalone)
/// @notice Simple, standalone contract combining self-nomination and delegate-based selection.
/// - Accounts can nominate or revoke themselves as candidates.
/// - An election selects up to `maxRoleHolders` nominees with highest delegated votes (`ERC20Votes.getVotes`).
/// - No Powers/Mandate integration. Pure storage and helper utilities.
contract Nominees is Ownable {
    // Nomination storage
    mapping(address nominee => bool nominated) public nominations;
    address[] public nominees;
    uint256 public nomineesCount;

    // Events
    event NominationReceived(address indexed nominee);
    event NominationRevoked(address indexed nominee);

    constructor() Ownable(msg.sender) { }
 
    function nominate(address nominee, bool shouldNominate) public onlyOwner {
        if (shouldNominate) {
            if (nominations[nominee] == true) revert("already nominated");
            nominations[nominee] = true;
            nominees.push(nominee);
            unchecked {
                nomineesCount += 1;
            }
            emit NominationReceived(nominee);
        } else {
            if (nominations[nominee] == false) revert("not nominated");
            nominations[nominee] = false;
            // remove from nominees (swap-and-pop)
            uint256 len = nominees.length;
            for (uint256 i; i < len; i++) {
                if (nominees[i] == nominee) {
                    nominees[i] = nominees[len - 1];
                    nominees.pop();
                    break;
                }
            }
            unchecked {
                nomineesCount -= 1;
            }
            emit NominationRevoked(nominee);
        }
    }

    // This allows an outside party (e.g. a mandate) to revoke a nomination on behalf of the nominee, without needing to be the nominee themselves.
    function revokeNomination(address nominee) external onlyOwner {
        nominate(nominee, false);
    }

    // --- View helpers ---

    function getNominees() external view returns (address[] memory) {
        return nominees;
    }

    function isNominee(address account) external view returns (bool) {
        return nominations[account] == true;
    }
}
