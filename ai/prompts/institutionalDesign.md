# Institutional Design Reference — Powers Protocol

This document is a reference for the `/design-org` skill. It contains:
1. Design principles and heuristics
2. Named governance patterns (with example references)
3. Complete mandate catalogue with config encoding
4. Condition parameter guidance

---

## 1. Core Design Principles

### One account, one vote
Powers uses flat voting — no token weighting in the core protocol. Every role holder has exactly one vote. Token-weighted influence can be introduced only in the *selection* of role holders (e.g., `DelegateTokenSelect`), not in ongoing governance votes.

### Separation of powers
The most robust governance structures distribute authority across three distinct functions:
- **Proposal** — who can put something on the table
- **Deliberation / veto** — who can block or contest
- **Execution** — who carries out the decision

Assigning these to different roles (even if the same people hold multiple roles) creates accountability.

### Modular mandates
Every governance action runs through a `Mandate` contract. Each mandate is single-purpose. Governance structures are built by composing mandates, not by writing new logic.

### Dependency chains
Mandates can be chained through `needFulfilled` (mandate B can only run after mandate A has run for the same action) and `needNotFulfilled` (mandate B cannot run if mandate C has run for the same action). These two fields are the primary tool for building multi-step approval and veto mechanisms.

### Reform is governance
The organisation can modify its own governance structure at runtime using `Adopt_Mandates` and `MandatePackage`. Always include at least one reform flow in non-trivial governance structures so the organisation can evolve.

---

## 2. Named Governance Patterns

These patterns appear in `solidity/governance/examples/` and `solidity/test/TestConstitutions.sol`. Reference them by name when explaining design choices.

### Optimistic Execution
**File:** `OptimisticExecution.s.sol`  
**Structure:** Anyone proposes → admin veto window → role holders execute  
**Use when:** Most actions are routine; you want speed with a safety brake.  
**Key mandates:** `StatementOfIntent` (propose) → `StatementOfIntent` (veto, admin only, `needFulfilled=propose`) → `BespokeAction_Simple` (execute, `needFulfilled=propose`, `needNotFulfilled=veto`)

### Bicameralism
**File:** `Bicameralism.s.sol`  
**Structure:** Two separate chambers must both approve before execution.  
**Use when:** You have two distinct stakeholder groups who must both consent.  
**Key mandates:** `StatementOfIntent` (chamber A) → `StatementOfIntent` (chamber B, `needFulfilled=A`) → executor (`needFulfilled=B`)

### Token Delegates
**File:** `TokenDelegates.s.sol`  
**Structure:** Token holders delegate to representatives who govern.  
**Use when:** You have a token and want representative rather than direct democracy.  
**Key mandates:** `Nominate` + `DelegateTokenSelect` (elect delegates) → delegates govern via `StatementOfIntent` + `OpenAction`

### Election Lists
**File:** `ElectionListsDao.s.sol`  
**Structure:** Candidates are nominated, voters elect slates, elected members govern.  
**Use when:** You want periodic representative elections with slate voting.  
**Key mandates:** `ElectionRegistry_CreateVoteMandate` → `ElectionRegistry_Nominate` → `ElectionRegistry_Vote` → `ElectionRegistry_Tally`

### Powers 101 (Basic)
**File:** `Powers101.s.sol`  
**Structure:** Open membership → delegates propose → admin veto → execute  
**Use when:** A small organisation wants a simple, learnable structure.

### Nested Safe Governance
**File:** `NestedSafeGovernance.s.sol`  
**Structure:** Powers governs a Gnosis Safe treasury.  
**Use when:** The organisation controls significant funds and needs Safe-level security.  
**Key mandates:** `Safe_ExecTransaction`, `SafeAllowance_Transfer`

### Account Abstraction
**File:** `AccountAbstraction.s.sol`  
**Structure:** Powers + ERC-4337 paymaster for gasless governance.  
**Use when:** Lowering the technical barrier to participation is a priority.

---

## 3. Mandate Catalogue

### How to read this catalogue

Each entry shows:
- **Purpose** — what problem it solves
- **Config** — what goes in the `config` field of `MandateInitData` (this is encoded with `abi.encode(...)`)
- **inputParams** — what the user provides at runtime when calling the mandate
- **Typical conditions** — role, voting, timelock patterns that make sense for this mandate

---

### ELECTORAL MANDATES

#### `SelfSelect`
**Purpose:** Anyone (or a specific role) can claim a role without a vote.  
**Config:** `abi.encode(uint256 roleId)` — the role to be self-assigned  
**inputParams:** none  
**Use when:** Open membership; anyone should be able to join a base role  
**Example:**
```solidity
config: abi.encode(uint256(1)), // role 1 = Members
conditions.allowedRole = type(uint256).max; // PUBLIC = anyone
```

#### `Nominate`
**Purpose:** An account nominates itself (or another) as a candidate, recorded in a `Nominees` contract.  
**Config:** `abi.encode(address nomineesContract)`  
**inputParams:** `address nominee, bool nominateMe`  
**Use when:** First step of a multi-step election (followed by `PeerSelect` or `DelegateTokenSelect`)  
**Note:** Requires deploying a `Nominees` helper contract and transferring its ownership to Powers.

#### `PeerSelect`
**Purpose:** Role holders vote to assign a role to a nominee.  
**Config:** `abi.encode(address nomineesContract, uint256 roleToAssign, uint256 maxRoleHolders)`  
**inputParams:** `address nominee`  
**Conditions:** Set `votingPeriod`, `quorum`, `succeedAt`  
**Use when:** Democratic election by existing members

#### `DelegateTokenSelect`
**Purpose:** Nominees are elected based on delegated token weight (not one-account-one-vote).  
**Config:** `abi.encode(address tokenContract, address nomineesContract, uint256 roleToAssign, uint256 maxRoleHolders)`  
**inputParams:** none (election is called, results are automatic)  
**Use when:** Token-based representative democracy

#### `RoleByRoles`
**Purpose:** Automatically assign a role to an account based on it holding another role.  
**Config:** `abi.encode(uint256 sourceRoleId, uint256 targetRoleId)`  
**inputParams:** `address account`  
**Use when:** Cascading role assignment (e.g., all executives are also council members)

#### `RenounceRole`
**Purpose:** An account voluntarily gives up a role.  
**Config:** `abi.encode(uint256 roleId)`  
**inputParams:** none  
**Use when:** Any governance structure where members should be able to exit voluntarily

#### `RevokeAccountsRoleId`
**Purpose:** An authorised role holder revokes a role from a specific account.  
**Config:** `abi.encode(uint256 roleId)`  
**inputParams:** `address account`  
**Use when:** Governance needs ability to remove bad actors

#### `RevokeInactiveAccounts`
**Purpose:** Revoke a role from accounts that have not participated above a threshold.  
**Config:** `abi.encode(uint256 roleId, uint256 inactivityThreshold)` (threshold in blocks)  
**inputParams:** `address account`  
**Use when:** Membership should lapse for inactive participants

#### `AssignExternalRole`
**Purpose:** Assign a role in a *child* Powers organisation to mirror a role in the *parent*.  
**Config:** `abi.encode(address parentPowers, uint256 parentRoleId, uint256 childRoleId)`  
**Use when:** Federated or nested organisational structures

---

### EXECUTIVE MANDATES

#### `StatementOfIntent`
**Purpose:** Record a proposal without executing any on-chain calls. Used as a pure voting/signalling step.  
**Config:** `abi.encode(string[] inputParams)` — labels for the fields the proposer fills in  
**inputParams:** defined by config  
**Use when:** Proposing, deliberating, vetoing — whenever you want a vote but no immediate execution  
**Note:** `StatementOfIntent` with `needFulfilled` pointing to itself creates a veto pattern.

#### `OpenAction`
**Purpose:** Execute any arbitrary on-chain call. The caller provides targets, values, and calldatas at runtime.  
**Config:** `abi.encode(string[] inputParams)` — same as `StatementOfIntent`  
**inputParams:** `address[] targets, uint256[] values, bytes[] calldatas`  
**Use when:** General-purpose execution role; the role holder can do anything (within gas/size limits)  
**Warning:** Only assign to highly trusted roles.

#### `PresetActions`
**Purpose:** Execute a fixed set of pre-configured calls that cannot be changed at runtime.  
**Config:** `abi.encode(address[] targets, uint256[] values, bytes[] calldatas)`  
**inputParams:** none  
**Use when:** One-time setup (label roles, set treasury, revoke setup mandate). Always include one of these in any constitution.

#### `PresetActions_OnOwnPowers`
**Purpose:** Like `PresetActions` but the target is always the Powers contract itself.  
**Config:** `abi.encode(address[] targets, uint256[] values, bytes[] calldatas)`  
**Use when:** Governance self-modification that runs automatically without caller input

#### `BespokeAction_Simple`
**Purpose:** Execute a specific function on a specific contract. The caller provides only the function's arguments.  
**Config:** `abi.encode(address targetContract, bytes4 selector, string[] inputParams)`  
**inputParams:** defined by config (the arguments to the function)  
**Use when:** Governed function calls on a specific external contract (mint tokens, set a fee, transfer an asset)  
**Example:**
```solidity
config: abi.encode(
    address(tokenContract),
    bytes4(keccak256("mint(address,uint256)")),
    inputParams // ["address To", "uint256 Amount"]
)
```

#### `BespokeAction_Advanced`
**Purpose:** Like `BespokeAction_Simple` but supports mixing pre-encoded static values with caller-provided dynamic values in a single function call.  
**Config:** `abi.encode(address target, bytes4 selector, bytes staticPrefix, string[] dynamicParams, bytes staticSuffix)`  
**Use when:** The function signature has some fixed arguments and some user-provided arguments

#### `BespokeAction_OnReturnValue`
**Purpose:** Execute a function using the return value from a prior mandate's execution as an input argument.  
**Config:** `abi.encode(address target, bytes4 selector, bytes staticPrefix, string[] dynamicParams, uint16 priorMandateId, bytes staticSuffix)`  
**Use when:** Chaining two on-chain calls where output of step 1 is input of step 2

#### `ExternalAction_Simple`
**Purpose:** Execute a pre-configured external call (similar to `BespokeAction_Simple` but simpler config).  
**Config:** `abi.encode(address target, bytes4 selector, bytes calldata)`  
**Use when:** Fixed external calls with no user input required

#### `CheckExternalActionState`
**Purpose:** Check that an action in a *parent* Powers organisation has been fulfilled before proceeding.  
**Config:** `abi.encode(address parentPowers, uint256 requiredState)`  
**Use when:** Child organisation must wait for parent organisation to approve first

---

### REFORM MANDATES

#### `Adopt_Mandates`
**Purpose:** Let governance adopt new mandates at runtime (upgrading the organisation's capabilities).  
**Config:** none (caller provides mandate addresses and role IDs at runtime)  
**inputParams:** `address[] mandates, uint256[] roleIds`  
**Use when:** The organisation should be able to expand its governance toolkit over time

#### `Revoke_Mandates`
**Purpose:** Deactivate existing mandates.  
**inputParams:** `uint16[] mandateIds`  
**Use when:** Governance needs ability to remove outdated or unsafe mandates

#### `PauseMandates`
**Purpose:** Temporarily suspend mandates without removing them.  
**Use when:** Emergency pause capability

#### `MandatePackage`
**Purpose:** Adopt a bundle of mandates in a single governance action.  
**Config:** pre-encoded set of `MandateInitData[]`  
**Use when:** Major governance reforms that add many mandates at once

---

### KEY INTEGRATION MANDATES

#### `Safe_ExecTransaction`
**Purpose:** Execute a transaction on a Gnosis Safe where Powers is an owner.  
**Config:** `abi.encode(address safeAddress)`  
**Use when:** The organisation controls funds in a Gnosis Safe multisig

#### `SafeAllowance_Transfer`
**Purpose:** Transfer up to an allowance limit from a Safe without full Safe approval.  
**Config:** `abi.encode(address safeAddress, address allowanceModule, address token)`  
**Use when:** Role holders need regular spending authority within set limits

#### `ElectionRegistry_CreateVoteMandate` / `_Nominate` / `_Vote` / `_Tally` / `_CleanUpVoteMandate`
**Purpose:** Full election cycle using a standalone `ElectionRegistry` contract.  
**Use when:** Formal periodic elections with nomination periods, voting periods, and tallying  
**Note:** These five mandates must all be present and configured together.

#### `GovernedToken_MintEncodedToken` / `_GatedAccess` / `_BurnToAccess`
**Purpose:** Issue or gate access using a soulbound ERC-1155 token.  
**Use when:** Membership credentials, proof of participation, or burn-to-access mechanics

#### `ZKPassport_Check`
**Purpose:** Verify age or nationality via zero-knowledge proof (ZKPassport).  
**Use when:** Age-gated governance, jurisdiction-based access control

#### `PowersFactory_AssignRole`
**Purpose:** Assign a role in a newly spawned child Powers organisation.  
**Use when:** Federated structures where a parent organisation governs child organisations

---

## 4. Condition Parameter Guidance

The `Conditions` struct has these fields:

```
allowedRole      — which role can call this mandate (use type(uint256).max for PUBLIC)
votingPeriod     — number of blocks the vote stays open (0 = no vote required)
timelock         — number of blocks between proposal and execution
throttleExecution — minimum blocks between successive executions of this mandate
needFulfilled    — mandateId that must have been completed for the same actionId
needNotFulfilled — mandateId that must NOT have been completed for the same actionId
quorum           — minimum % of role holders who must vote (integer, denominator = 100)
succeedAt        — minimum % of votes that must be FOR (integer, denominator = 100)
```

### Block time conversion helper
```solidity
// Use minutesToBlocks(minutes, helperConfig.getBlocksPerHour(block.chainid))
// Sepolia/Arb Sepolia: ~300 blocks/hour (12s blocks)
// Optimism Sepolia: ~1800 blocks/hour (2s blocks)
// Anvil local: 1 block/second unless configured otherwise

// Common periods:
// 1 day  ≈ 7200 blocks on Sepolia
// 1 week ≈ 50400 blocks on Sepolia
// 48h timelock ≈ 14400 blocks on Sepolia
```

### Heuristics by organisation size

| Size | Quorum | SucceedAt | Voting Period | Timelock (treasury) |
|------|--------|-----------|---------------|---------------------|
| Small (< 15 members) | 50% | 66% | 3 days | 24h |
| Medium (15–50) | 30% | 51% | 1 week | 48h |
| Large (> 50) | 20% | 51% | 2 weeks | 1 week |

### Veto pattern (critical rule)
When using a veto mechanism: **the timelock on the executor must be longer than the voting period of the veto mandate.** Otherwise the action can be executed before the veto period ends.

```
Proposal mandate: votingPeriod = X blocks
Veto mandate: needFulfilled = proposalMandateId (no voting, just signals a veto was cast)
Executor mandate: needFulfilled = proposalMandateId
                  needNotFulfilled = vetoMandateId
                  timelock = X + buffer (must exceed proposal voting period)
```

---

## 5. Config Encoding Reference

Quick reference for the most common config encodings:

```solidity
// SelfSelect
config: abi.encode(uint256(roleId))

// StatementOfIntent (with labelled inputs)
string[] memory params = new string[](2);
params[0] = "address Recipient";
params[1] = "uint256 Amount";
config: abi.encode(params)

// PresetActions (setup mandate)
config: abi.encode(targets, values, calldatas)  // arrays of equal length

// BespokeAction_Simple
config: abi.encode(
    address(contractToCall),
    bytes4(keccak256("functionName(type1,type2)")),
    inputParams  // string[] of parameter labels
)

// Nominate
config: abi.encode(address(nomineesContract))

// DelegateTokenSelect
config: abi.encode(
    address(tokenContract),
    address(nomineesContract),
    uint256(roleToAssign),
    uint256(maxRoleHolders)
)

// Safe_ExecTransaction
config: abi.encode(address(safeAddress))
```

---

## 6. Constitution Structure Template

Every deploy script follows this structure:

```
SETUP MANDATE (mandateCount 0)
└─ PresetActions: label roles, set treasury, revoke itself (mandateCount+1)

FLOW 1: [first governance process]
├─ Mandate A: proposal step
├─ Mandate B: veto step (needFulfilled=A)
└─ Mandate C: execution step (needFulfilled=A, needNotFulfilled=B, timelock=...)

FLOW 2: [membership management]
├─ Mandate D: SelfSelect (join)
└─ Mandate E: RenounceRole (leave)

FLOW 3: [reform]
└─ Mandate F: Adopt_Mandates (add new capabilities later)
```

Always number mandates starting from 0. The setup mandate is always mandateId=0. Use `mandateCount` as an incrementing counter; always set `needFulfilled` and `needNotFulfilled` relative to the current `mandateCount` value.

---

## 7. Governance Theory Notes

Draw on the reference papers in `ai/references/` when explaining design choices. Key themes to look for:

- **Polycentric governance** (Ostrom, Carlisle): multiple overlapping centres of authority rather than a single hierarchy. Powers' multi-role, multi-mandate structure naturally implements polycentricity.
- **IAD framework** (Ostrom): governance as rules-in-use operating on action arenas. Mandates are the rules-in-use; the Powers contract is the action arena.
- **Adaptive governance** (May 2022): governance systems that can self-modify in response to changing conditions. The reform mandates (`Adopt_Mandates`, `MandatePackage`) implement adaptive capacity.
- **Design principles for commons** (Ostrom): clear boundaries, proportional rules, collective choice, monitoring, graduated sanctions, conflict resolution, external recognition. Use these as a checklist when reviewing a governance spec.
- **Designing governance structures** (Podger, Chan, Wanna 2020): balance between accountability, efficiency, and legitimacy. Helps frame the trade-off between voting period length (legitimacy) and execution speed (efficiency).
