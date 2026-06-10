# Deploy Script Template — Powers Protocol

This template annotates the structure of a Powers deploy script. Use it alongside
`solidity/governance/examples/OptimisticExecution.s.sol` and `Powers101.s.sol` as concrete references.

---

## File structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// ─── Imports ─────────────────────────────────────────────────────────────────
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Configurations } from "@script/Configurations.s.sol";
import { DeployHelpers } from "../DeployHelpers.s.sol";        // provides minutesToBlocks()
import { IMandateRegistry } from "@src/helpers/MandateRegistry.sol";

import { PowersTypes } from "@src/interfaces/PowersTypes.sol";
import { Powers } from "@src/Powers.sol";
import { IPowers } from "@src/interfaces/IPowers.sol";

// Add external helper contracts only if needed:
// import { Nominees } from "@src/helpers/Nominees.sol";        // for Nominate + PeerSelect
// import { ElectionRegistry } from "@src/helpers/ElectionRegistry.sol"; // for election flows
// import { SimpleErc20Votes } from "../../test/mocks/SimpleErc20Votes.sol"; // for token flows

// ─── Contract declaration ─────────────────────────────────────────────────────
contract Deploy is DeployHelpers {

    // ── State variables ──────────────────────────────────────────────────────
    Configurations helperConfig;
    PowersTypes.MandateInitData[] constitution;   // grows as you add mandates
    PowersTypes.Conditions conditions;             // reuse this struct; always `delete conditions;` after push
    PowersTypes.Flow[] flows;                      // groups related mandates into named flows
    Powers powers;
    IMandateRegistry registry;

    address[] targets;          // for PresetActions config
    uint256[] values;           // for PresetActions config
    bytes[] calldatas;          // for PresetActions config
    string[] inputParams;       // for StatementOfIntent / BespokeAction config

    // ── Mandate version ──────────────────────────────────────────────────────
    // Always use these constants — they select the correct version from the registry.
    uint16 constant MAJOR = 0;
    uint16 constant MINOR = 1;
    uint16 constant PATCH = 8;

    // ── run() ────────────────────────────────────────────────────────────────
    function run() external returns (Powers) {
        // 1. Setup configuration and registry
        helperConfig = new Configurations();
        registry = IMandateRegistry(helperConfig.getMandateRegistry(block.chainid));

        // 2. Deploy Powers instance
        vm.startBroadcast();
        powers = new Powers(
            "Organisation Name",     // human-readable name
            "https://...",           // metadata URI (IPFS JSON with name, description, image)
            helperConfig.getMaxCallDataLength(block.chainid),
            helperConfig.getMaxReturnDataLength(block.chainid),
            helperConfig.getMaxExecutionsLength(block.chainid)
        );
        // If using Nominees or other helper contracts, deploy them here and record addresses.
        vm.stopBroadcast();
        console2.log("Powers deployed at:", address(powers));

        // 3. Build the constitution (see createConstitution() below)
        uint256 constitutionLength = createConstitution();
        console2.log("Constitution length:", constitutionLength);

        // 4. Constitute (commit all mandates + flows) and close.
        vm.startBroadcast();
        powers.constitute(constitution);
        powers.closeConstitute(msg.sender, flows);
        // Transfer ownership of helper contracts to Powers if needed:
        // nominees.transferOwnership(address(powers));
        vm.stopBroadcast();
        console2.log("Powers successfully constituted.");

        return powers;
    }

    // ── createConstitution() ─────────────────────────────────────────────────
    function createConstitution() internal returns (uint256) {
        uint16 mandateCount = 0;

        ////////////////////////////////////////////////////////////////////////
        //                           SETUP (mandateId = 0)                    //
        ////////////////////////////////////////////////////////////////////////
        // This mandate runs once at deployment, labels all roles, and revokes itself.
        // It uses PresetActions so no user input is needed — the calls are pre-encoded.

        targets = new address[](N);    // N = number of setup calls
        values  = new uint256[](N);
        calldatas = new bytes[](N);
        for (uint256 i = 0; i < N; i++) targets[i] = address(powers);

        // Label roles (always include Admin=0 and Public=type(uint256).max)
        calldatas[0] = abi.encodeWithSelector(IPowers.labelRole.selector, 0, "Admin", "");
        calldatas[1] = abi.encodeWithSelector(IPowers.labelRole.selector, type(uint256).max, "Public", "");
        calldatas[2] = abi.encodeWithSelector(IPowers.labelRole.selector, 1, "Members", "");
        // calldatas[3] = abi.encodeWithSelector(IPowers.labelRole.selector, 2, "Council", "");
        // calldatas[N-2] = abi.encodeWithSelector(IPowers.setTreasury.selector, address(powers));
        calldatas[N-1] = abi.encodeWithSelector(IPowers.revokeMandate.selector, mandateCount + 1);
        //                                                                              ^^^
        //                                  This revokes itself — change to correct ID if needed.

        mandateCount++;
        conditions.allowedRole = type(uint256).max; // Anyone can trigger setup
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Initial Setup: Assign role labels and revokes itself after execution",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "PresetActions"),
            config: abi.encode(targets, values, calldatas),
            conditions: conditions
        }));
        delete conditions;

        ////////////////////////////////////////////////////////////////////////
        //                         FLOW 1: [Flow Name]                        //
        ////////////////////////////////////////////////////////////////////////
        // Brief description of what this flow governs.

        // Register the flow (list which mandate IDs belong to it)
        uint16[] memory flow1MandateIds = new uint16[](3); // adjust size
        flow1MandateIds[0] = mandateCount + 1;
        flow1MandateIds[1] = mandateCount + 2;
        flow1MandateIds[2] = mandateCount + 3;
        flows.push(PowersTypes.Flow({
            mandateIds: flow1MandateIds,
            nameDescription: "Flow 1: [Human-readable name]"
        }));

        // ── Mandate: Propose ────────────────────────────────────────────────
        // Role [X] members propose [action]. Requires a vote.
        inputParams = new string[](2);
        inputParams[0] = "address Recipient";
        inputParams[1] = "uint256 Amount";

        mandateCount++;
        conditions.allowedRole = 1;                           // role 1 = Members
        conditions.votingPeriod = minutesToBlocks(
            7 * 24 * 60,                                      // 1 week
            helperConfig.getBlocksPerHour(block.chainid)
        );
        conditions.quorum = 30;                               // 30% of role holders must vote
        conditions.succeedAt = 51;                            // simple majority
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Propose [Action]: Members propose [what] for [purpose].",
            //                ^^^ IMPORTANT: this string is used for lookup in action scripts.
            //                    It must be identical across deploy, actions, and runner files.
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // ── Mandate: Veto ───────────────────────────────────────────────────
        // Admin can veto within the veto window after a proposal succeeds.
        mandateCount++;
        conditions.allowedRole = 0;                           // role 0 = Admin
        conditions.needFulfilled = mandateCount - 1;          // proposal must have passed first
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Veto [Action]: Admin vetoes a proposed [action].",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(inputParams),
            conditions: conditions
        }));
        delete conditions;

        // ── Mandate: Execute ────────────────────────────────────────────────
        // Role [Z] executes after proposal passed and no veto was cast.
        // Timelock must exceed the proposal voting period + safety buffer.
        mandateCount++;
        conditions.allowedRole = 2;                           // role 2 = Council
        conditions.needFulfilled = mandateCount - 2;          // proposal must exist
        conditions.needNotFulfilled = mandateCount - 1;       // veto must NOT exist
        conditions.timelock = minutesToBlocks(
            8 * 24 * 60,                                      // 8 days (> 7-day voting + buffer)
            helperConfig.getBlocksPerHour(block.chainid)
        );
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Execute [Action]: Council executes the approved [action] at [contract].",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "BespokeAction_Simple"),
            config: abi.encode(
                address(externalContract),               // target contract address
                bytes4(keccak256("transfer(address,uint256)")),  // function selector
                inputParams                              // ["address Recipient", "uint256 Amount"]
            ),
            conditions: conditions
        }));
        delete conditions;

        ////////////////////////////////////////////////////////////////////////
        //                         FLOW 2: Membership                         //
        ////////////////////////////////////////////////////////////////////////
        // Members can join and leave the organisation freely.

        uint16[] memory flow2MandateIds = new uint16[](2);
        flow2MandateIds[0] = mandateCount + 1;
        flow2MandateIds[1] = mandateCount + 2;
        flows.push(PowersTypes.Flow({
            mandateIds: flow2MandateIds,
            nameDescription: "Membership: Join or leave the Members role."
        }));

        // ── Mandate: Join ───────────────────────────────────────────────────
        mandateCount++;
        conditions.allowedRole = type(uint256).max;           // anyone can join
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Join as Member: Any account can self-select as a Member.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "SelfSelect"),
            config: abi.encode(uint256(1)),                   // roleId = 1 (Members)
            conditions: conditions
        }));
        delete conditions;

        // ── Mandate: Leave ──────────────────────────────────────────────────
        mandateCount++;
        conditions.allowedRole = 1;                           // only members can renounce
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Leave the organisation: A Member voluntarily renounces their role.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "RenounceRole"),
            config: abi.encode(uint256(1)),                   // roleId = 1 (Members)
            conditions: conditions
        }));
        delete conditions;

        ////////////////////////////////////////////////////////////////////////
        //                       FLOW 3: Governance Reform                    //
        ////////////////////////////////////////////////////////////////////////
        // Council can propose and adopt new mandates (governance evolves over time).

        uint16[] memory flow3MandateIds = new uint16[](2);
        flow3MandateIds[0] = mandateCount + 1;
        flow3MandateIds[1] = mandateCount + 2;
        flows.push(PowersTypes.Flow({
            mandateIds: flow3MandateIds,
            nameDescription: "Reform: Propose and adopt new governance mandates."
        }));

        // ── Mandate: Propose reform ─────────────────────────────────────────
        string[] memory reformParams = new string[](2);
        reformParams[0] = "address[] Mandates";
        reformParams[1] = "uint256[] RoleIds";

        mandateCount++;
        conditions.allowedRole = 2;                           // Council proposes
        conditions.votingPeriod = minutesToBlocks(14 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        conditions.quorum = 50;
        conditions.succeedAt = 66;
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Propose Governance Reform: Council votes to adopt new mandates.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "StatementOfIntent"),
            config: abi.encode(reformParams),
            conditions: conditions
        }));
        delete conditions;

        // ── Mandate: Adopt mandates ─────────────────────────────────────────
        mandateCount++;
        conditions.allowedRole = 2;
        conditions.needFulfilled = mandateCount - 1;
        conditions.timelock = minutesToBlocks(15 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));
        constitution.push(PowersTypes.MandateInitData({
            nameDescription: "Adopt New Mandates: Execute an approved governance reform.",
            targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "Adopt_Mandates"),
            config: abi.encode(),
            conditions: conditions
        }));
        delete conditions;

        return constitution.length;
    }
}
```

---

## Checklist before finalising the deploy script

- [ ] Every mandate has a unique `nameDescription` (exact strings carried over to actions + runner files)
- [ ] `mandateCount` increments before every `constitution.push()`
- [ ] `delete conditions;` after every `constitution.push()`
- [ ] The setup mandate's `revokeMandate` call uses the correct mandate ID (usually `mandateCount + 1` evaluated at the time of the setup mandate)
- [ ] All flows cover the complete set of mandates used in that flow
- [ ] Veto timelock > voting period of the proposal being vetoed
- [ ] All external helper contracts (Nominees, ElectionRegistry, etc.) have `transferOwnership(address(powers))` called
- [ ] `MAJOR`, `MINOR`, `PATCH` constants are set to 0, 1, 7

---

## Federated deploy order (parent + factory pattern)

When deploying a parent organisation that spawns child organisations via `PowersFactory`, there is a circular reference problem: the child template needs the parent's address and mandate IDs, but the factory must be loaded before the parent constitution is built (because its address needs to be known for the spawn mandate config).

**Correct deploy order:**

```
1. Deploy all helper contracts (ElectionRegistry, Nominees, etc.)
2. Deploy the parent Powers (empty — not yet constituted)
3. Build the sub-org (child) constitution using address(0) / uint16(0) as placeholders
   wherever the parent's address or mandate IDs are needed.
4. Deploy the factory. Load the sub-org constitution via addMandates() + addFlows().
   The factory owner is still the deployer at this point.
5. Build the parent constitution. This sets any mandate IDs needed for the child template
   (e.g. the sub-org ratification mandate ID). Store these as state variables.
6. PATCH: call factory.replaceMandate(index, updatedInitData) for every mandate that
   had a placeholder. Use the real parent address and mandate IDs from step 5.
   *** This MUST happen before transferOwnership in step 7 ***
7. Constitute the parent: powers.constitute(constitution) + powers.closeConstitute(...)
8. Transfer ownership of ALL helper contracts and the factory to the parent Powers:
   electionRegistry.transferOwnership(address(powers))
   factory.transferOwnership(address(powers))
   etc.
```

**Why the order matters:** After step 8, the factory is owned by the parent Powers contract. `factory.replaceMandate()` is `onlyOwner`, so calling it post-transfer requires going through parent governance — which means adding a governed mandate for it. Doing the patch in step 6 (while the deployer still owns the factory) avoids needing a dedicated reform mandate just for deployment wiring.

**Tracking placeholder indices:** Keep a comment in `_buildSubOrgConstitution()` noting which array index each placeholder mandate occupies (0-based). The patch function must use the exact same index. A mismatch silently corrupts the wrong mandate.

```solidity
// In run(), after _buildParentConstitution() sets subOrgRatifyMandateId:
function _fixSubOrgRatificationMandate() internal {
    // Rebuild the exact conditions used in _buildSubOrgConstitution() Flow D step 2.
    PowersTypes.Conditions memory c;
    c.allowedRole   = 1;
    c.needFulfilled = 13; // proposeRatifyId — fixed position in sub-org template
    c.timelock      = minutesToBlocks(1 * 24 * 60, helperConfig.getBlocksPerHour(block.chainid));

    vm.startBroadcast();
    subOrgFactory.replaceMandate(13, PowersTypes.MandateInitData({
        nameDescription: "Sub-org: Send Parent Ratification — ...",
        targetMandate: registry.getMandateAddress(MAJOR, MINOR, PATCH, "ExternalAction_Simple"),
        config: abi.encode(
            address(powers),        // real parent address
            subOrgRatifyMandateId,  // real mandate ID
            "description",
            params
        ),
        conditions: c
    }));
    vm.stopBroadcast();
}
```
