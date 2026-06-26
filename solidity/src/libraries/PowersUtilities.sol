// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { PowersTypes } from "../interfaces/PowersTypes.sol";
import { PowersErrors } from "../interfaces/PowersErrors.sol";
import { ERC165Checker } from "@lib/openzeppelin-contracts/contracts/utils/introspection/ERC165Checker.sol";
import { IMandate } from "../interfaces/IMandate.sol";
import { Mandate } from "../Mandate.sol";

/// @title Powers Utilities
/// @notice Library with bytecode-heavy internal logic extracted from Powers to keep it under EIP-170's 24KB limit.
library PowersUtilities {
    function setRole(mapping(uint256 => PowersTypes.Role) storage roles, uint256 roleId, address account, bool access)
        public
    {
        if (roleId == type(uint256).max) revert PowersErrors.Powers__CannotSetPublicRole();
        if (account == address(0)) revert PowersErrors.Powers__CannotAddZeroAddress();
        if (account == address(this)) revert PowersErrors.Powers__CannotAddPowersAddressAsMember();

        PowersTypes.Role storage role = roles[roleId];
        uint256 index = role.members[account];
        bool hasRole = index != 0;

        if (access && !hasRole) {
            role.membersArray.push(PowersTypes.Member({ account: account, since: uint48(block.number) }));
            role.members[account] = role.membersArray.length;
        } else if (!access && hasRole) {
            uint256 indexEnd = role.membersArray.length - 1;
            PowersTypes.Member memory memberEnd = role.membersArray[indexEnd];

            // swap-and-pop: replace removed member with the last member, then pop.
            // Note: index is 1-based to distinguish "no member" (0) from "first member" (1).
            role.membersArray[index - 1] = memberEnd;
            role.membersArray.pop();

            role.members[memberEnd.account] = index;
            role.members[account] = 0;
        }
    }

    function storeMandate(
        mapping(uint16 => PowersTypes.AdoptedMandate) storage mandates,
        mapping(address => bool) storage blacklist,
        uint16 mandateId,
        PowersTypes.MandateInitData memory mandateInitData
    ) public {
        if (!ERC165Checker.supportsInterface(mandateInitData.targetMandate, type(IMandate).interfaceId)) {
            revert PowersErrors.Powers__IncorrectInterface(mandateInitData.targetMandate);
        }
        if (blacklist[mandateInitData.targetMandate]) revert PowersErrors.Powers__AddressBlacklisted();
        if (mandateInitData.conditions.allowedRole == type(uint256).max && mandateInitData.conditions.quorum > 0) {
            revert PowersErrors.Powers__VoteWithPublicRoleDisallowed();
        }

        PowersTypes.AdoptedMandate storage mandate = mandates[mandateId];
        mandate.active = true;
        mandate.targetMandate = mandateInitData.targetMandate;
        mandate.conditions = mandateInitData.conditions;

        Mandate(mandateInitData.targetMandate)
            .initializeMandate(mandateId, mandateInitData.nameDescription, "", mandateInitData.config);
    }

    function countVote(
        mapping(uint256 => PowersTypes.Action) storage actions,
        uint256 actionId,
        address account,
        uint8 support
    ) public {
        PowersTypes.Action storage proposedAction = actions[actionId];

        proposedAction.hasVoted[account] = true;

        if (support == uint8(PowersTypes.VoteType.Against)) {
            proposedAction.againstVotes++;
        } else if (support == uint8(PowersTypes.VoteType.For)) {
            proposedAction.forVotes++;
        } else if (support == uint8(PowersTypes.VoteType.Abstain)) {
            proposedAction.abstainVotes++;
        } else {
            revert PowersErrors.Powers__InvalidVoteType();
        }
    }
}
