// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockRegistry {
    function createList(string calldata name) external returns (uint120 id) {
        return 1;
    }

    function reassignOwnershipOfList(uint120 id, address newOwner) external { }

    function addAccountsToBlacklist(uint120 id, address[] calldata accounts) external { }

    function removeAccountsFromBlacklist(uint120 id, address[] calldata accounts) external { }

    function addAccountsToWhitelist(uint120 id, address[] calldata accounts) external { }

    function removeAccountsFromWhitelist(uint120 id, address[] calldata accounts) external { }
}
