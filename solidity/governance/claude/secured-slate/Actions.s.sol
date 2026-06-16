// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { console2 } from "forge-std/console2.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";
import { ActionHelpers } from "@governance/examples/actions/ActionHelpers.s.sol";
import { SlateRegistry } from "@src/helpers/SlateRegistry.sol";

/// @notice Manual action functions for Secured Slate Governance.
/// Each public function covers one step of a governance flow.
/// Use these to manually advance individual steps during development or testing.
contract SecuredSlateActions is ActionHelpers {

    ///////////////////////////////////////////////////////////////////////////
    //                       SETUP (one-time)
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Run the initial setup mandate once after deployment.
    function runInitialSetup(address powers, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Initial Setup: Assign role labels, set treasury, pre-assign Security Council and SlateRegistry roles, seed first member, then self-revoke.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(), nonce, "Running initial setup");
        vm.stopBroadcast();
        console2.log("Setup mandate executed.");
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW A: SLATE ELECTIONS
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Step 1 — Member creates a new slate election.
    function createElection(
        address powers,
        address slateRegistry,
        string memory electionTitle,
        uint8 maxSlates,
        uint8 maxVotes,
        uint8 maxWinners,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Create Election: A member opens a new slate election in the SlateRegistry.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(electionTitle, maxSlates, maxVotes, maxWinners);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, string.concat("Creating election: ", electionTitle));
        vm.stopBroadcast();

        uint256 electionId = uint256(keccak256(abi.encodePacked(powers, electionTitle)));
        console2.log("Election created. ID:", electionId);
        SlateRegistry.Election memory e = SlateRegistry(slateRegistry).getElectionInfo(electionId);
        console2.log("Submission window closes at block:", e.startBlock);
        console2.log("Voting window closes at block:    ", e.endBlock);
    }

    /// @notice Step 2 — Member casts a vote for one or more slates.
    function castVote(
        address powers,
        uint256 electionId,
        uint16[] memory slateIndexes,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Cast Vote: Members vote for their preferred slates during the voting window.",
            Powers(payable(powers))
        );
        address voter = vm.addr(privateKey);
        bytes memory calldata_ = abi.encode(electionId, voter, slateIndexes);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, string.concat("Casting vote in election ", vm.toString(electionId)));
        vm.stopBroadcast();
        console2.log("Vote cast by:", voter);
    }

    /// @notice Step 3 — Anyone triggers execution of winning slates after voting closes.
    function executeResults(
        address powers,
        string memory electionTitle,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Execute Results: After voting has closed, execute the winning slates on-chain.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(electionTitle), nonce, string.concat("Executing results for: ", electionTitle));
        vm.stopBroadcast();
        console2.log("Winning slates executed for election:", electionTitle);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW B: SLATE SUBMISSION
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Step 1 — Anyone proposes a slate of actions to compete in an election.
    function addSlate(
        address powers,
        string memory electionTitle,
        string memory slateName,
        address[] memory slateTargets,
        uint256[] memory slateValues,
        bytes[] memory slateCalldatas,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Add Slate: Any account can propose a slate of actions to compete in an election.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(electionTitle, slateName, slateTargets, slateValues, slateCalldatas);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, string.concat("Adding slate: ", slateName));
        vm.stopBroadcast();
        console2.log("Slate submitted:", slateName);
    }

    /// @notice Step 2 — Security Council vetoes a slate by removing it.
    /// Must use the SAME electionTitle, slateName, targets, values, calldatas and nonce as the original addSlate call.
    function removeSlate(
        address powers,
        string memory electionTitle,
        string memory slateName,
        address[] memory slateTargets,
        uint256[] memory slateValues,
        bytes[] memory slateCalldatas,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Remove Slate: Security Council vetoes and removes a submitted slate before voting opens.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(electionTitle, slateName, slateTargets, slateValues, slateCalldatas);
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, calldata_, nonce, string.concat("Removing slate: ", slateName));
        vm.stopBroadcast();
        console2.log("Slate removed:", slateName);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW C: MEMBER MANAGEMENT
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Step 1 — Members vote to onboard a new member address (2% quorum, simple majority).
    function proposeMemberAddition(
        address powers,
        address account,
        uint256[] memory privateKeys,
        uint256 nonce
    ) public returns (uint256 actionId) {
        uint16 id = findMandateIdInOrg(
            "Propose Member Addition: Members vote to onboard a new member.",
            Powers(payable(powers))
        );
        bytes memory calldata_ = abi.encode(account);

        vm.startBroadcast(privateKeys[0]);
        actionId = IPowers(powers).propose(id, calldata_, nonce, string.concat("Proposing member: ", vm.toString(account)));
        vm.stopBroadcast();

        (roleCount, againstVote, forVote, abstainVote) = voteOnProposal(powers, id, actionId, privateKeys, nonce, 100);
        console2.log("Member proposal votes — For:", forVote, "Against:", againstVote, "Total:", roleCount);
    }

    /// @notice Step 2 — Execute the approved member onboarding after the vote passes.
    function addMember(
        address powers,
        address account,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Add Member: Execute an approved member onboarding by assigning the Member role.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(account), nonce, string.concat("Adding member: ", vm.toString(account)));
        vm.stopBroadcast();
        console2.log("Member added:", account);
    }

    /// @notice A member voluntarily gives up their Member role.
    function renounceMembership(address powers, uint256 privateKey, uint256 nonce) public {
        uint16 id = findMandateIdInOrg(
            "Renounce Membership: A member voluntarily gives up their Member role.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(uint256(1)), nonce, "Renouncing membership");
        vm.stopBroadcast();
        console2.log("Membership renounced by:", vm.addr(privateKey));
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW D: BLACKLIST MANAGEMENT
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Step 1 — Security Council marks an account as Blacklisted (assigns role 4).
    /// This does NOT revoke the Member role. Call revokeBlacklistedMembership next if needed.
    function blacklistAccount(
        address powers,
        address account,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Blacklist Account: Security Council marks an account as blacklisted.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(account), nonce, string.concat("Blacklisting account: ", vm.toString(account)));
        vm.stopBroadcast();
        console2.log("Account blacklisted:", account);
    }

    /// @notice Step 2 — Security Council revokes the Member role from a blacklisted account.
    /// MUST use the SAME account address and nonce as the blacklistAccount call above.
    function revokeBlacklistedMembership(
        address powers,
        address account,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Revoke Membership of Blacklisted Account: Security Council removes the Member role from a blacklisted account.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(account), nonce, string.concat("Revoking member role from blacklisted account: ", vm.toString(account)));
        vm.stopBroadcast();
        console2.log("Member role revoked from blacklisted account:", account);
    }

    /// @notice Security Council removes the Blacklisted mark from an account.
    /// Does NOT restore the Member role — the account must re-apply via Flow C.
    function deBlacklistAccount(
        address powers,
        address account,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "De-Blacklist Account: Security Council removes the Blacklisted mark from an account.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(account), nonce, string.concat("De-blacklisting account: ", vm.toString(account)));
        vm.stopBroadcast();
        console2.log("Account de-blacklisted:", account);
    }

    ///////////////////////////////////////////////////////////////////////////
    //                     FLOW E: EMERGENCY CONTROLS
    ///////////////////////////////////////////////////////////////////////////

    /// @notice Security Council pauses (paused=true) or restarts (paused=false) critical mandates.
    function pauseOrRestartCriticalMandates(
        address powers,
        bool paused,
        uint256 privateKey,
        uint256 nonce
    ) public {
        uint16 id = findMandateIdInOrg(
            "Pause or Restart Critical Mandates: Security Council pauses or restarts voting and execution mandates in an emergency.",
            Powers(payable(powers))
        );
        vm.startBroadcast(privateKey);
        IPowers(powers).request(id, abi.encode(paused), nonce, paused ? "Pausing critical mandates" : "Restarting critical mandates");
        vm.stopBroadcast();
        console2.log(paused ? "Critical mandates paused." : "Critical mandates restarted.");
    }
}
