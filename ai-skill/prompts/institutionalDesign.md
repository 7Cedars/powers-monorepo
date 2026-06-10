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
**Structure:** Candidates are nominated, voters elect from the nominee list, elected members govern.  
**Use when:** You want periodic representative elections with a nomination + voting cycle.  
**Key mandates:** `ElectionRegistry_CreateVoteMandate` → `ElectionRegistry_Nominate` → `ElectionRegistry_Vote` → `ElectionRegistry_Tally` → `ElectionRegistry_CleanUpVoteMandate`

### Powers 101 (Basic)
**File:** `Powers101.s.sol`  
**Structure:** Open membership → delegates propose → admin veto → execute  
**Use when:** A small organisation wants a simple, learnable structure.

### Slate Voting
**File:** `SlateVoting.s.sol`  
**Structure:** Grantees compose competing slates (bundles of executable actions) → community votes → winning slates execute automatically.  
**Use when:** You want to elect between *programs of action* rather than between *people*. Ideal for grants rounds, budget allocation, or protocol upgrade elections where different factions propose complete packages.  
**Key mandates:** `SlateRegistry_AddSlate` (grantees submit slates) → `BespokeAction_Simple → SlateRegistry.vote` (community votes) → `SlateRegistry_ExecuteResult` (anyone triggers execution after voting closes)  
**Key helper:** `SlateRegistry` — manages elections, slate registration, vote tallying, and calls `Powers.request` on the winning slate mandate IDs. Must be assigned its own unique `roleId` in Powers and given ownership of the registry.  
**Design notes:**
- `SlateRegistry_AddSlate` dynamically adopts a `PresetActions` mandate for each slate and registers it in the election's flow slot. The slate's `allowedRole` is set to the `SlateRegistry.roleId` so only the registry can trigger execution.
- `SlateRegistry_RemoveSlate` uses `needFulfilled = addSlateMandateId` so the *same calldata and nonce* used to submit a slate must be re-submitted to withdraw it — this uniquely identifies the original action.
- Voting is handled via `BespokeAction_Simple → SlateRegistry.vote`; voters pass their own address as the `caller` argument so the registry can prevent double-voting.
- `SlateRegistry_ExecuteResult` reverts if `block.number <= endBlock`, so timing enforcement is in-contract rather than relying on governance conditions.

### Nested Safe Governance
**File:** `NestedSafeGovernance.s.sol`  
**Structure:** Powers governs a Gnosis Safe treasury.  
**Use when:** The organisation controls significant funds and needs Safe-level security.  
**Key mandates:** `Safe_ExecTransaction`, `SafeAllowance_Transfer`

### Account Abstraction
**File:** `AccountAbstraction.s.sol`  
**Structure:** Powers + ERC-4337 paymaster for gasless governance.  
**Use when:** Lowering the technical barrier to participation is a priority.

### Federated Sub-org Governance
**Reference:** `solidity/governance/claude/global-environmental-movement/Deploy.s.sol`  
**Structure:** A parent organisation spawns fully-constituted child organisations from a pre-loaded `PowersFactory`. Each child holds a role at the parent (e.g. "Recognised Sub-org"), giving it a formal vote in parent-level governance. Children call parent mandates via `ExternalAction_Simple`.  
**Use when:** A movement, protocol, or federation needs autonomous sub-units that remain formally connected to a parent constitution.

**Key mandates and wiring:**

1. **Pre-loaded factory** — Deploy a `PowersFactory`, call `addMandates(subOrgConstitution)` and `addFlows(subOrgFlows)` before transferring ownership to the parent Powers. Every subsequent `createPowers(name)` call deploys a fully-constituted child. Transfer factory ownership to parent Powers after loading.

2. **Spawn + register in one flow** — Chain two mandates:
   - `BespokeAction_Simple → factory.createPowers(name)` returns the child address.
   - `BespokeAction_OnReturnValue → parentPowers.assignRole(childRoleId, returnValue)` reads the child address from step 1 and assigns it a role at the parent. Config: `staticPrefix = abi.encode(childRoleId)`, `priorMandateId = createMandateId`, `dynamicParams = []`, `staticSuffix = abi.encode()`.

3. **Child-to-parent governance calls** — Assign the child Powers contract address a role at the parent (step 2). The child's constitution includes an `ExternalAction_Simple` mandate targeting the parent's approval/ratification mandate. When the child executes this mandate, the parent sees the caller as the child's contract address, which holds the child role — so `allowedRole` checks pass. Config: `abi.encode(parentPowersAddress, parentMandateId, description, params)`.

4. **Placeholder patching problem** — The sub-org factory template is built *before* the parent constitution (because it must be loaded into the factory before the factory is constituted). At that point the parent's mandate IDs are not yet known. Solution: use `address(0)` / `uint16(0)` placeholders in the sub-org's `ExternalAction_Simple` config, then call `factory.replaceMandate(index, updatedInitData)` in the deploy script *after* building the parent constitution but *before* calling `factory.transferOwnership(address(parentPowers))`. The deployer still owns the factory in that window. See §8 of `ai/templates/deployScript.md` for the deploy order.

**Design notes:**
- One-sub-org-one-vote (regardless of local membership size) is a deliberate design choice that protects small sub-orgs from being outvoted. Document this explicitly in the spec.
- The sub-org constitution template is frozen at factory-deploy time. Changing the template for future sub-orgs requires deploying a new factory and adopting a new `BespokeAction_Simple → newFactory.createPowers()` mandate at the parent level.
- The `ElectionRegistry` used inside the sub-org template must be deployed before the sub-org constitution is built; its address is baked into the template at build time. All sub-orgs from the same factory share the same `ElectionRegistry` instance.

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
**Purpose:** An account nominates or de-nominates itself as a candidate in a `Nominees` contract.  
**Config:** `abi.encode(address nomineesContract)`  
**inputParams:** `bool shouldNominate` — true to nominate, false to withdraw nomination (caller always nominates themselves)  
**Use when:** First step of a multi-step election (followed by `PeerSelect` or `DelegateTokenSelect`)  
**Note:** Requires deploying a `Nominees` helper contract and transferring its ownership to Powers.

#### `PeerSelect`
**Purpose:** Role holders vote to elect nominees into a role. Executes once: installs winners, evicts previous holders, and self-revokes.  
**Config:** `abi.encode(uint8 numberToSelect, uint256 roleId, address NomineesContract)`  
**inputParams:** `bool[]` — dynamic array, one entry per nominee in the current nominees list (true = vote for)  
**Conditions:** Set `votingPeriod`, `quorum`, `succeedAt`  
**Use when:** One-shot democratic election by existing members; pair with `Nominate` to build a two-step election flow  
**Note:** Input params are generated dynamically at initialization time from the current `Nominees` list.

#### `DelegateTokenSelect`
**Purpose:** Nominees are elected based on delegated token weight (not one-account-one-vote).  
**Config:** `abi.encode(address tokenContract, address nomineesContract, uint256 roleToAssign, uint256 maxRoleHolders)`  
**inputParams:** none (election is called, results are automatic)  
**Use when:** Token-based representative democracy

#### `RoleByRoles`
**Purpose:** Assign or revoke a role from an account based on whether it holds any of a set of prerequisite roles.  
**Config:** `abi.encode(uint256 newRoleId, uint256[] roleIdsNeeded)` — assigns `newRoleId` if account holds any role in `roleIdsNeeded`; revokes it if not  
**inputParams:** `address account`  
**Use when:** Cascading role assignment (e.g., all executives are also council members); supports multiple prerequisite roles

#### `RenounceRole`
**Purpose:** An account voluntarily gives up one of a configured list of roles.  
**Config:** `abi.encode(uint256[] allowedRoleIds)` — the roles the caller is permitted to renounce  
**inputParams:** `uint256 RoleId` — the specific role the caller wants to renounce (must be in the allowedRoleIds list)  
**Use when:** Any governance structure where members should be able to exit voluntarily

#### `RevokeAccountsRoleId`
**Purpose:** An authorised role holder revokes a role from all current holders of that role.  
**Config:** `abi.encode(uint256 RoleId, string[] InputParams)` — `InputParams` labels any additional inputs used to identify the account to revoke  
**inputParams:** defined by `InputParams` in config (typically `address account`)  
**Use when:** Governance needs ability to remove bad actors

#### `RevokeInactiveAccounts`
**Purpose:** Revoke a role from all holders who have not met a minimum participation threshold.  
**Config:** `abi.encode(uint256 RoleId, uint256 minimumActionsNeeded, uint256 numberActionsToCheck)` — checks the last `numberActionsToCheck` actions and revokes if fewer than `minimumActionsNeeded` were cast  
**inputParams:** none (scans all role holders automatically)  
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
**Purpose:** Submit a governance request to a specific mandate on a fixed external Powers contract.  
**Config:** `abi.encode(address PowersTarget, uint16 MandateIdTarget, string Description, string[] Params)`  
**inputParams:** defined by `Params` in config (forwarded as calldata to the target mandate)  
**Use when:** One Powers instance needs to formally trigger an action on another (fixed target at config time)

#### `ExternalAction_Flexible`
**Purpose:** Like `ExternalAction_Simple` but the target Powers address and mandate ID are provided at runtime, not fixed in config.  
**Config:** `abi.encode(string[] Params)` — labels for the extra inputs forwarded to the target mandate  
**inputParams:** `address PowersTarget, uint16 MandateIdTarget, ...` (extra params per config)  
**Use when:** A single mandate instance needs to route to different external contracts depending on the situation

#### `ExternalAction_OnReturnValue`
**Purpose:** Forward the return value of a prior mandate execution as calldata to an external Powers instance.  
**Config:** `abi.encode(bytes paramsBefore, string[] Params, uint16 parentMandateId, bytes paramsAfter)` — return value is sandwiched between the two static byte arrays  
**inputParams:** `address PowersTarget, uint16 MandateIdTarget, ...` (extra params per config)  
**Use when:** Chaining a local computation (e.g. a factory that deploys a contract) into a cross-chain governance request

#### `CheckExternalActionState`
**Purpose:** Check that a specific mandate's action has been fulfilled on a parent Powers contract before proceeding.  
**Config:** `abi.encode(address parentPowers, uint16 mandateId, string[] inputParams)` — `inputParams` must match the parent mandate's inputs so the action ID can be recomputed  
**inputParams:** same as the parent mandate's inputParams  
**Use when:** Child organisation must wait for parent organisation to approve or execute a specific action first

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
**Purpose:** Pause **or restart** specific mandates at pre-configured flow positions. A single mandate handles both directions — the caller provides `bool paused` at runtime.  
**Config:** `abi.encode(uint8[] indexFlow, uint8[] indexMandate)` — the flow and mandate positions this instance is allowed to target. Fixed at deploy time; a `PauseMandates` instance cannot affect positions outside its configured list.  
**inputParams:** `bool paused` — `true` revokes the target mandates; `false` re-adopts them from their stored config and updates the flow indices.  
**Use when:** Emergency pause with guaranteed restart path. Assign to a high-trust role with no voting period.  
**Critical notes:**
- The restart path (`paused = false`) re-adopts the mandate with its *original* config — parameters cannot be changed during a pause/restart cycle, preventing emergency powers from quietly modifying governance.
- The flow/mandate position indices are 0-based within the `flows` array. Verify indices after adding mandates via reform, as `Adopt_Mandates` may shift positions.
- Deploy separate `PauseMandates` instances for logically distinct groups (e.g., one for treasury execution, one for membership mandates) to keep emergency scope explicit.

#### `MandatePackage`
**Purpose:** Adopt a bundle of mandates in a single governance action. The bundle is defined at constructor time.  
**Config:** none (all `MandateInitData[]` are baked into the contract at deployment)  
**inputParams:** none  
**Use when:** Major governance reforms where the set of new mandates is known at deploy time

#### `MandatePackage_Static`
**Purpose:** Like `MandatePackage` but fully pre-configured and self-revoking — installs the bundle then removes itself.  
**Config:** none (mandates stored in constructor)  
**inputParams:** none  
**Use when:** One-shot governance upgrade where the full bundle is known at deploy time and no further customisation is needed at execution

---

### KEY INTEGRATION MANDATES

#### `Safe_ExecTransaction`
**Purpose:** Execute a specific function on a target contract via the Gnosis Safe treasury (Powers must be a Safe owner).  
**Config:** `abi.encode(string[] InputParams, bytes4 FunctionSelector, address Target)` — `InputParams` labels the caller-provided arguments; the function call is `Target.FunctionSelector(mandateCalldata)`  
**inputParams:** defined by `InputParams` in config  
**Use when:** The organisation controls a Gnosis Safe and needs governed calls to an external contract routed through the Safe

#### `Safe_ExecTransaction_OnReturnValue`
**Purpose:** Execute a Safe transaction using the return value of a prior mandate as a dynamic argument.  
**Config:** `abi.encode(address TargetContract, bytes4 FunctionSelector, bytes paramsBefore, string[] Params, uint16 parentMandateId, bytes paramsAfter)` — return value is sandwiched between the static byte arrays  
**inputParams:** defined by `Params` in config (must match parent mandate inputs so action ID can be recomputed)  
**Use when:** A prior action (e.g. deploying a contract) produces a value that must be passed to the Safe

#### `Safe_RecoverTokens`
**Purpose:** Sweep all ERC20 tokens held by the Powers contract itself into the Safe treasury.  
**Config:** `abi.encode(address safeTreasury, address allowanceModule)` — uses the allowance module's token list to discover which tokens to check  
**inputParams:** none (auto-discovers tokens and balances)  
**Use when:** Tokens have been accidentally sent to the Powers contract address and need to be recovered

#### `SafeAllowance_Transfer`
**Purpose:** Transfer tokens from a Gnosis Safe via the Allowance Module. Powers must be registered as a delegate.  
**Config:** `abi.encode(address allowanceModule, address safeProxy)`  
**inputParams:** `address Token, uint256 Amount, address PayableTo`  
**Use when:** Role holders need regular spending authority within pre-approved allowance limits

#### `SafeAllowance_PresetTransfer`
**Purpose:** Like `SafeAllowance_Transfer` but the token and amount are fixed at config time; the caller only provides the recipient.  
**Config:** `abi.encode(address Token, uint256 Amount, address allowanceModule, address safeProxy)`  
**inputParams:** `address PayableTo`  
**Use when:** Recurring payments of a fixed amount (e.g. contributor salaries, grants)

#### `SafeAllowance_Action`
**Purpose:** Call an arbitrary function on the Allowance Module via the Safe (e.g. update allowance parameters, add delegates).  
**Config:** `abi.encode(string[] inputParams, bytes4 functionSelector, address allowanceModule)`  
**inputParams:** defined by `inputParams` in config  
**Use when:** Governance needs to modify Allowance Module settings directly through the Safe

#### `ElectionRegistry_CreateVoteMandate` / `_Nominate` / `_Vote` / `_Tally` / `_CleanUpVoteMandate`
**Purpose:** Full election cycle using a standalone `ElectionRegistry` helper contract.  
**Use when:** Formal periodic elections with nomination periods, voting periods, and tallying  
**Note:** These five mandates must all be present and configured together. The helper contract is `ElectionRegistry` (not `ElectionList`).

#### `GovernedToken_MintEncodedToken` / `_GatedAccess` / `_BurnToAccess` / `_CollectSplitPayment`
**Purpose:** Issue or gate access using a `Governed721` token (ERC-721 based, not ERC-1155).  
**Use when:** Membership credentials, proof of participation, burn-to-access mechanics, or collecting split payments from token sales  

- **`GovernedToken_MintEncodedToken`** — Mints a `Governed721` token whose ID encodes the caller's address and the current block number. Config: `abi.encode(address governedToken)`. inputParams: `address To`.  
- **`GovernedToken_GatedAccess`** — Assigns a role to callers who hold sufficient valid `Governed721` tokens. Config: `abi.encode(address governedTokenAddress, uint256 assignRoleId, uint256 checkRoleId, uint48 blocksThreshold, uint48 tokensThreshold)`. inputParams: `uint256[] tokenIds`.  
- **`GovernedToken_BurnToAccess`** — Burns a `Governed721` token to grant access (caller must hold the token). Config: `abi.encode(string[] inputParams, address governedTokenAddress)`. inputParams: `uint256 tokenId`.  
- **`GovernedToken_CollectSplitPayment`** — Lets an Artist, Intermediary, or Old Owner collect their percentage share of a `Governed721` token sale. Config: `abi.encode(address Governed721Address)`. inputParams: `uint256 TransferId`.

#### `ZKPassport_Check`
**Purpose:** Verify age or nationality via zero-knowledge proof (ZKPassport).  
**Use when:** Age-gated governance, jurisdiction-based access control

#### `SlateRegistry_AddSlate` / `_RemoveSlate` / `_ExecuteResult`
**Purpose:** Full slate-voting election cycle using a standalone `SlateRegistry` contract.  
**Use when:** Elections where voters choose between *programs of action* (slates of executable calls) rather than between candidates.  
**Deployment:** These mandate contracts are **not** in the `MandateRegistry` — deploy them directly with `new SlateRegistry_AddSlate()` etc. and use the deployed addresses as `targetMandate`.  
**SlateRegistry constructor:** `new SlateRegistry(uint48 submitSlateDuration, uint48 voteDuration, uint256 roleId)` — the registry must be given ownership of Powers *after* `closeConstitute`, and its `roleId` must be assigned to the registry contract address in the initial setup mandate.

**`SlateRegistry_AddSlate`**  
Config: `abi.encode(address slateRegistry, address presetActions)`  
inputParams: `string ElectionTitle, string NameDescription, address[] Targets, uint256[] Values, bytes[] Calldatas`  
Effect: adopts a `PresetActions` mandate, places it in the election's flow slot, registers it in the `SlateRegistry`.

**`SlateRegistry_RemoveSlate`**  
Config: `abi.encode(address slateRegistry, uint16 addSlateMandateId)`  
inputParams: same as `_AddSlate` (identical calldata + nonce required — links back to the original submission)  
Conditions: set `needFulfilled = addSlateMandateId`  
Effect: revokes the slate's `PresetActions` mandate, frees the flow slot, unregisters from `SlateRegistry`.

**`SlateRegistry_ExecuteResult`**  
Config: `abi.encode(address slateRegistry)`  
inputParams: `string ElectionTitle`  
Conditions: `allowedRole = type(uint256).max` (anyone can trigger after voting closes)  
Effect: calls `SlateRegistry.executeResults`, which tallies votes and calls `Powers.request` on each winning slate mandate.

**Required election cycle:**
1. A governance member calls `SlateRegistry.createElection` (via `BespokeAction_Simple`) to open a new election and set `maxSlates`, `maxVotes`, `maxWinners`.
2. Grantees submit slates during the `submitSlateDuration` window via `_AddSlate`.
3. Community members vote during the `voteDuration` window via `BespokeAction_Simple → SlateRegistry.vote(electionId, caller, slateIndexes)`. Voters must pass their own address as `caller`.
4. After `endBlock`, anyone calls `_ExecuteResult` to tally and execute.

#### `ERC721_GatedAccess`
**Purpose:** Assign a role to the caller if they hold at least a minimum balance of a specified ERC721 token.  
**Config:** `abi.encode(address erc721Address, uint256 assignRoleId, uint256 minBalance)`  
**inputParams:** none  
**Use when:** Token-gated role onboarding (NFT holder membership)

#### `Governor_CreateProposal` / `Governor_ExecuteProposal`
**Purpose:** Create or execute proposals on an OpenZeppelin-compatible Governor contract.  
**Config:** `abi.encode(address GovernorContract)`  
**inputParams:** `address[] targets, uint256[] values, bytes[] calldatas, string description`  
**`Governor_ExecuteProposal`** reverts unless the proposal is in the `Succeeded` state.  
**Use when:** Bridging Powers governance into an existing OZ Governor deployment

#### `PowersFactory_AssignRole`
**Purpose:** Assign a role in a newly spawned child Powers organisation using the return value of a factory mandate.  
**Config:** `abi.encode(uint16 factoryMandateId, uint256 roleIdNewOrg, string[] inputParams)`  
**Use when:** Federated structures where a parent organisation governs child organisations

#### `PowersFactory_AddSafeDelegate`
**Purpose:** Add a delegate to the Gnosis Safe Allowance Module using the return value of a factory mandate.  
**Config:** `abi.encode(uint16 factoryMandateId, address allowanceModule, string[] inputParams)`  
**inputParams:** same as the factory mandate's inputs (used to recompute the action ID)  
**Use when:** Automatically appointing a new delegate based on the output of a prior factory action

#### `ChainlinkFunctions_Open`
**Purpose:** Generic async oracle mandate (extends `AsyncMandate`) that forwards string inputs to a configurable Chainlink Functions JavaScript script and awaits the result.  
**Config:** `abi.encode(string source, string[] inputParams, uint64 subscriptionId, uint32 gasLimit, bytes32 donId)` — all `inputParams` must be of type `string`  
**inputParams:** defined by `inputParams` in config  
**Use when:** Any governance flow that requires off-chain data verification (API checks, web2 credentials, computed values) before proceeding  
**Note:** Async — the Powers action is only completed once the Chainlink oracle responds.

#### `Snapshot_CheckSnapExists` / `Snapshot_CheckSnapPassed`
**Purpose:** Async mandates that use Chainlink Functions to verify the state of a Snapshot proposal.  
- **`_CheckSnapExists`** — verifies the proposal exists, is pending, and includes the specified voting choice.  
- **`_CheckSnapPassed`** — verifies the proposal is closed and the specified choice won.  
**Config:** `abi.encode(string spaceId, uint64 subscriptionId, uint32 gasLimit, bytes32 donID)`  
**inputParams:** `string proposalId, string choice, ...`  
**Use when:** Bridging off-chain Snapshot votes into on-chain execution  
**Note:** These contracts exist in source but are currently paused / under active development. Do not use in production.

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
config: abi.encode(
    inputParams,          // string[] of parameter labels for the caller-provided args
    bytes4(keccak256("functionName(type1,type2)")),  // function selector
    address(targetContract)  // the contract the Safe will call
)

// SafeAllowance_Transfer
config: abi.encode(address(allowanceModule), address(safeProxy))
// inputParams at runtime: (address token, uint256 amount, address payableTo)
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
