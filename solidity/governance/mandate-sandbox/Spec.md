---
title: "Mandate Sandbox — Governance Specification"
description: "Governance design specification for Mandate Sandbox"
---

# Mandate Sandbox — Governance Specification

> **Status:** Draft
> **Network:** Arbitrum Sepolia (421614)
> **Design date:** 2026-06-24

---

## Purpose

Mandate Sandbox is not a real-world organisation — it exists purely to exercise every practical Powers mandate type and input shape in one deployment, so the frontend dApp can be clicked through end-to-end against real on-chain state on Arbitrum Sepolia. Voting periods, quorums, and timelocks are deliberately short so a single person can walk through every flow in one sitting.

---

## Roles

| Role ID | Name | Description | How to join | Max members |
|---------|------|-------------|-------------|-------------|
| 0 | Admin | Founding administrator, highest trust; vetoes, manual revocations, reform vetoes | Assigned at deployment | 1 |
| max | Public | Everyone; no application needed | Automatic | Unlimited |
| 1 | Member | Base membership | SelfSelect (open) | Unlimited |
| 2 | Delegate | Peer-elected representative | Nominate + PeerSelect | 2 |
| 3 | Council | Token-weighted elected representative | Nominate + DelegateTokenSelect | 3 |
| 4 | Executive | Cascading role for anyone holding Member or Delegate | RoleByRoles | Unlimited |
| 5 | Tracked | Demo role used for inactivity monitoring | SelfSelect (open) | Unlimited |
| 6 | NftHolder | Granted for holding a test ERC721 | ERC721_GatedAccess | Unlimited |
| 7 | GovernedHolder | Granted for holding a test Governed721 token | GovernedToken_GatedAccess | Unlimited |
| 8 | ElectionWinner | Winner of the formal ElectionRegistry cycle | ElectionRegistry_Tally | 5 |
| 9 | SlateRegistryRole | Held by the SlateRegistry contract itself (required by its internal mechanics) | Assigned once at setup | 1 |

> Role IDs intentionally avoid overlap with the mandate categories below so each electoral mechanism can be tested independently.

---

## Governance Flows

### Flow 1: Membership

**Purpose:** Open join/leave — baseline electoral coverage.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | SelfSelect | Public | No | Assigns role 1 |
| 2 | RenounceRole | Role 1 | No | Caller renounces role 1 |

**Rationale:** Every design needs an open membership baseline; this is the simplest possible electoral pair and the easiest first thing to click in the frontend.

---

### Flow 2: Delegate Election (peer vote)

**Purpose:** Demonstrate the classic nominate → peer-vote election cycle.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | Nominate | Role 1 | No | Self-nominate/withdraw via shared `Nominees` contract |
| 2 | PeerSelect | Role 1 | Yes — 20% quorum, 51% succeedAt, 10 min | Selects 2 winners into role 2; self-revokes after running |

**Rationale:** Short voting period keeps this testable in one sitting; `numberToSelect = 2` keeps the election cycle visibly contested with only a handful of test accounts.

---

### Flow 3: Council Election (token-weighted)

**Purpose:** Demonstrate token-delegation-based representative selection, reusing the same nominee pool as Flow 2.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | BespokeAction_Simple → `SimpleErc20Votes.mint(uint256)` | Public | No | Lets any tester mint themselves test voting tokens |
| 2 | DelegateTokenSelect | Public | No (token-weighted, not voted) | Throttled to once per 10 min; assigns top-3 delegators of `SimpleErc20Votes` into role 3 |

**Rationale:** Including the mint step means a tester doesn't need pre-funded tokens to try this flow — they can self-serve test tokens and then `delegate()` directly against the ERC20Votes contract before triggering the election.

---

### Flow 4: Cascading Executive Role

**Purpose:** Demonstrate role-derived role assignment.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | RoleByRoles | Public (caller supplies `address account`) | No | Grants/revokes role 4 based on whether `account` holds role 1 or role 2 |

**Rationale:** `RoleByRoles` is the simplest way to compose roles; Executive (role 4) is then reused as the "trusted executor" role in several other flows below.

---

### Flow 5: Inactivity Monitoring & Manual Revocation

**Purpose:** Cover both automated and manual role-removal mandates.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | SelfSelect | Public | No | Assigns role 5 |
| 2 | StatementOfIntent | Role 5 | Yes — 20% quorum, 51%, 5 min | Pure signalling vote; casting a vote here is what counts as "activity" |
| 3 | RevokeInactiveAccounts | Public | No | Revokes role 5 from anyone who voted fewer than once in the last 5 checked actions |
| 4 | RevokeAccountsRoleId | Role 0 (Admin) | No | Manually revoke all current role-5 holders on demand |

**Rationale:** Pairing the automatic and manual revocation mandates on the same role lets a tester compare both mechanisms directly.

---

### Flow 6: Optimistic Execution

**Purpose:** The canonical propose → veto-window → execute pattern, using the fully open `OpenAction` executor.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | StatementOfIntent (propose) | Role 4 | Yes — 20% quorum, 51%, 10 min | — |
| 2 | StatementOfIntent (veto) | Role 0 (Admin) | No | `needFulfilled` = step 1 |
| 3 | OpenAction (execute) | Role 4 | No | `needFulfilled` = step 1, `needNotFulfilled` = step 2, 20 min timelock (> step 1's voting period) |

**Rationale:** This is the named "Optimistic Execution" pattern from the mandate catalogue — included verbatim because it's the cleanest demonstration of the veto-timing rule (timelock must exceed proposal voting period).

---

### Flow 7: Bespoke Executions

**Purpose:** Cover `BespokeAction_Simple`, `BespokeAction_Advanced`, and `BespokeAction_OnReturnValue` in one chain, plus mint a test NFT used later in Flow 9.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | BespokeAction_Simple → `SimpleErc721.mint(address)` | Public | No | Mints a test NFT to any address |
| 2 | BespokeAction_Advanced → `Powers.assignRole` | Role 4 | No | Caller supplies the account; role 4 is baked in as a static value mixed with the dynamic argument |
| 3 | BespokeAction_Simple → `ReturnDataMock.getValue()` | Public | No | Always returns `42`; a pure "returner" demo step |
| 4 | BespokeAction_OnReturnValue → `ReturnDataMock.consume(uint256)` | Public | No | `priorMandateId` = step 3; forwards the returned `42` into `consume()` |

**Rationale:** `ReturnDataMock` is a trivial, already-existing test contract that makes the return-value-chaining mechanic visible without depending on a meaningful business outcome.

---

### Flow 8: Self-Modifying Action (PresetActions_OnOwnPowers)

**Purpose:** Demonstrate a mandate whose target is always the Powers contract itself.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | PresetActions_OnOwnPowers | Role 4 | No | Re-asserts `setTreasury(address(powers))` — harmless and idempotent, included purely to demonstrate the mandate shape |

**Rationale:** No naturally "safe to repeat" governance action exists in this sandbox other than an idempotent treasury re-assertion, so that's what's baked in.

---

### Flow 9: Token-Gated Access

**Purpose:** Cover ERC721 gating and the full `GovernedToken_*` family.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | ERC721_GatedAccess | Public | No | Grants role 6 if caller holds ≥1 `SimpleErc721` (minted in Flow 7, step 1) |
| 2 | GovernedToken_MintEncodedToken | Public | No | Mints a `Governed721` token to any address; ID encodes minter + block number |
| 3 | GovernedToken_GatedAccess | Public | No | Grants role 7 if caller holds ≥1 `Governed721` token minted by a role-1 (Member) account within the last 100 blocks |
| 4 | GovernedToken_BurnToAccess | Public | No | Burns a `Governed721` token the caller holds |
| 5 | GovernedToken_CollectSplitPayment | Public | No | Collects a split-payment share from a `Governed721` transfer (input-type coverage; no real sale flow is wired up, so this will typically be a no-op call) |

**Rationale:** Token thresholds are set to the minimum (1 token, 100-block window) so a tester only needs to mint and hold a single token to qualify — no need to wait or accumulate.

---

### Flow 10: Formal Election Cycle

**Purpose:** The full `ElectionRegistry_*` nomination → vote → tally → cleanup cycle.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | BespokeAction_Simple → `ElectionRegistry.createElection` | Role 1 | No | Throttled to once per 10 min; opens a new election |
| 2 | ElectionRegistry_Nominate | Role 1 | No | Self-nominate/withdraw |
| 3 | ElectionRegistry_CreateVoteMandate | Role 1 | No | `needFulfilled` = step 1; spins up a dedicated, time-boxed vote mandate (max 1 vote per voter, role 1 eligible) |
| 4 | ElectionRegistry_Tally | Role 1 | No | `needFulfilled` = step 3; assigns up to 5 winners into role 8 |
| 5 | BespokeAction_OnReturnValue → `Powers.revokeMandate` | Role 1 | No | `needFulfilled` = step 3; cleans up the dedicated vote mandate created in step 3 |

**Rationale:** This is the only mandate family that *requires* all five steps together per the catalogue — they are not independently useful.

---

### Flow 11: Slate Voting

**Purpose:** The `SlateRegistry_*` "vote on programs of action" pattern, distinct from voting on candidates.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | BespokeAction_Simple → `SlateRegistry.createElection` | Role 1 | No | Opens a new slate election (`maxSlates`, `maxVotes`, `maxWinners`) |
| 2 | SlateRegistry_AddSlate | Role 1 | No | Submits a bundle of preset calls as a competing slate; occupies one of 3 reserved empty flow slots |
| 3 | SlateRegistry_RemoveSlate | Role 1 | No | `needFulfilled` = step 2 (same calldata+nonce required to withdraw) |
| 4 | BespokeAction_Simple → `SlateRegistry.vote` | Role 1 | No | Caller passes their own address; registry prevents double-voting |
| 5 | SlateRegistry_ExecuteResult | Public | No | Anyone can trigger tally + execution once the election's `endBlock` has passed |

**Rationale:** `SlateRegistry` requires its own dedicated `roleId` (role 9, single holder) per the helper contract's own constraints — this is set once at deployment and never changed.

---

### Flow 12: Federated Spawn (PowersFactory + AssignExternalRole)

**Purpose:** Cover `PowersFactory_AssignRole` and `AssignExternalRole` together using the lightest possible federated setup — a child Powers organisation pre-loaded with a minimal one-mandate template before it's ever spawned.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | BespokeAction_Simple → `PowersFactory.createPowers(string)` | Role 1 | No | Spawns a new, fully-constituted child Powers using the pre-loaded template below |
| 2 | PowersFactory_AssignRole | Role 1 | No | `factoryMandateId` = step 1; assigns role 1 in the *new child* to whoever called step 1 |

**Child template (pre-loaded into the factory before any spawn):**

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| C1 | SelfSelect | Public | No | Assigns role 1 in the child |
| C2 | AssignExternalRole | Public | No | `config = (parentPowers = address(this Mandate Sandbox), parentRoleId = 1)` — anyone holding role 1 *here* can adopt role 1 in the child without a separate vote |

**Rationale:** Building a full reciprocal federation (child voting back into the parent via `ExternalAction_Simple`, with placeholder-patched mandate IDs) is the advanced pattern documented for real federated movements — it's disproportionate complexity for a single-org sandbox. This lighter version still exercises both `PowersFactory_AssignRole` and `AssignExternalRole` end-to-end. See Limitations.

---

### Flow 13: External Action Coverage (self-referential demo)

**Purpose:** Cover `ExternalAction_Simple`, `ExternalAction_Flexible`, `ExternalAction_OnReturnValue`, and `CheckExternalActionState` — all four are designed to target an *external* Powers instance, but Mandate Sandbox has no second full peer organisation, so each mandate is wired to target Mandate Sandbox itself.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | ExternalAction_Simple | Role 4 | No | Fixed target = `address(this)`, fixed `MandateIdTarget` = Flow 1's SelfSelect mandate |
| 2 | ExternalAction_Flexible | Role 4 | No | Caller supplies `PowersTarget`/`MandateIdTarget` at runtime — point it at `address(this)` and any mandate ID to see the flexible-routing UI |
| 3 | ExternalAction_OnReturnValue | Role 4 | No | Forwards Flow 7 step 3's return value (`42`) into a self-targeted request |
| 4 | CheckExternalActionState | Public | No | Checks whether Flow 7 step 1 (mint NFT) has been fulfilled on `address(this)` |

**Rationale:** See Limitations — this demonstrates each mandate's config and input shape faithfully, but the "external" target is the same organisation. A true cross-org test would need a second, independently governed Powers deployment.

---

### Flow 14: Governance Reform

**Purpose:** Cover the full reform mandate family.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | StatementOfIntent (propose reform) | Role 4 | Yes — 20% quorum, 66%, 10 min | — |
| 2 | Adopt_Mandates | Role 4 | No | `needFulfilled` = step 1, 20 min timelock |
| 3 | Revoke_Mandates | Role 0 (Admin) | No | No vote — instant, highest-trust only |
| 4 | PauseMandates | Role 0 (Admin) | No | Configured against Flow 1's SelfSelect position; `bool paused` toggles pause/restart |
| 5 | MandatePackage | Role 4 | No | Adopts a small bundle (one extra `StatementOfIntent` "Sandbox Notice" mandate, public) in one action |
| 6 | MandatePackage_Static | Role 4 | No | Self-revoking one-shot bundle (one extra `SelfSelect` for a demo role 10) |

**Rationale:** Reform is always included per the design heuristics — an organisation that can't evolve its own mandate set is incomplete. Admin-only instant revoke/pause is intentional: emergency powers shouldn't wait on a vote.

---

### Flow 15: Account Abstraction

**Purpose:** Gasless transaction support via `PowersPaymaster`.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | StatementOfIntent (propose fund) | Role 0 (Admin) | Yes — 20% quorum, 51%, 5 min | — |
| 2 | PresetActions (execute fund) | Role 0 (Admin) | No | `needFulfilled` = step 1; sends 0.05 ETH to `powersPaymaster.deposit()` |
| 3 | StatementOfIntent (propose withdraw) | Role 0 (Admin) | Yes — 20% quorum, 51%, 5 min | Caller supplies `address withdrawAddress, uint256 amount` |
| 4 | BespokeAction_Simple (execute withdraw) | Role 0 (Admin) | No | `needFulfilled` = step 3; calls `powersPaymaster.withdrawTo(address,uint256)` |

**Rationale:** Admin is the most trusted role in this sandbox, so it governs paymaster funds — matching the skill's standard AA wiring.

---

## Checks and Balances

| Mechanism | How it works | Who holds it |
|-----------|-------------|--------------|
| Veto on Optimistic Execution | Admin can block within the proposal's 10-min voting window; executor timelock is 20 min | Admin (role 0) |
| Veto on reform | None automated — Admin instead holds direct `Revoke_Mandates`/`PauseMandates` emergency powers | Admin (role 0) |
| Quorum requirements | 20% across all voted mandates | Relevant role per flow |
| Role caps | Delegate (2), Council (3), ElectionWinner (5), SlateRegistryRole (1, enforced by helper contract) | Automatic |
| Manual + automatic inactivity revocation | Both `RevokeInactiveAccounts` (automatic) and `RevokeAccountsRoleId` (manual, Admin) target role 5 | Admin + automatic |

**Security considerations:**
- This is a test sandbox, not a production governance design. Several roles (Public-triggerable token-weighted election, public NFT minting) have no spam protection beyond `throttleExecution` — acceptable here, unacceptable in a real deployment.
- `OpenAction` (Flow 6) gives Executive (role 4) the ability to call *anything* once the optimistic-execution conditions are met. In a real organisation this would be paired with much stronger veto/timelock guarantees; here it's intentionally permissive so testers can see the full power of the mandate.

---

## External Dependencies

| System | Purpose | Required? |
|--------|---------|----------|
| `SimpleErc20Votes` (deployed fresh) | Token for `DelegateTokenSelect` (Flow 3) | Yes |
| `SimpleErc721` (deployed fresh) | Token for `ERC721_GatedAccess` and `BespokeAction_*` demos (Flows 7, 9) | Yes |
| `Governed721` (deployed fresh) | Token for `GovernedToken_*` mandates (Flow 9) | Yes |
| `Nominees` (deployed fresh) | Shared candidate pool for Flows 2 and 3 | Yes |
| `ElectionRegistry` (deployed fresh) | Formal election cycle (Flow 10) | Yes |
| `SlateRegistry` (deployed fresh) | Slate-voting cycle (Flow 11) | Yes |
| `ReturnDataMock` (deployed fresh) | Demo return-value source for `BespokeAction_OnReturnValue` (Flow 7) | Yes |
| `PowersFactory` + `PowersDeployer` (deployed fresh) | Spawns the child Powers used in Flow 12 | Yes |
| `PowersPaymaster` (deployed fresh) | Account abstraction (Flow 15) | Yes |
| Gnosis Safe / Allowance Module | Would be needed for `Safe_*`/`SafeAllowance_*` mandates | **No — excluded, see Limitations** |
| OpenZeppelin Governor | Would be needed for `Governor_*` mandates | **No — excluded, see Limitations** |
| Chainlink Functions subscription | Would be needed for `ChainlinkFunctions_Open` | **No — excluded, see Limitations** |
| ZKPassport registry | Would be needed for `ZKPassport_Check` | **No — excluded, see Limitations** |

---

## Design Rationale

Mandate Sandbox inverts the usual design process: instead of starting from stakeholders and deriving the minimal mandate set that serves them, it starts from the full mandate catalogue and builds the thinnest plausible role/flow structure that lets every mandate be triggered through the frontend with a small number of test accounts. Voting periods (5–10 min) and quorums (20%) are far below the heuristic ranges for even a "small" real organisation (`ai-skill/prompts/institutionalDesign.md` §Heuristics) — that's deliberate, not an oversight: legitimacy isn't the goal here, clickability is.

Where the mandate catalogue's own worked examples already cover a pattern well (Optimistic Execution, the `PowersFactory_AssignRole` test pattern, the `SlateRegistry` election cycle), this spec reuses that exact structure rather than inventing a new one, to maximise the chance the generated code matches already-verified behaviour in the codebase.

## Limitations

- **Safe and Governor integrations are excluded entirely.** `Safe_ExecTransaction*`, `SafeAllowance_*`, and `Governor_CreateProposal`/`Governor_ExecuteProposal` all require a real, already-deployed Gnosis Safe (with Allowance Module) or OpenZeppelin Governor on Arbitrum Sepolia. None exist for this sandbox and deploying production-grade versions of either is out of scope for a test organisation. If you later acquire a Safe or Governor deployment on Arb Sepolia, these mandate categories can be added via the Reform flow's `Adopt_Mandates` mandate without redeploying.
- **Async oracle mandates are excluded.** `ChainlinkFunctions_Open`, `ZKPassport_Check`, and the `Snapshot_*` mandates all depend on live off-chain infrastructure (a funded Chainlink Functions subscription, a real passport proof, or a Snapshot space) that can't be provisioned for a sandbox. The skill's own reference notes also flag the `Snapshot_*` contracts as paused/under development — not recommended even where infrastructure exists.
- **`ExternalAction_*` and `CheckExternalActionState` (Flow 13) target Mandate Sandbox itself**, not a genuinely separate organisation. This faithfully exercises each mandate's configuration and input shape, but doesn't prove true cross-organisation message-passing. A real test of that would need a second, independently governed Powers deployment.
- **`PowersFactory_AssignRole` + `AssignExternalRole` (Flow 12) use the lightest possible federation** — a child pre-loaded with two mandates, no reciprocal governance link back to the parent. The advanced "Federated Sub-org Governance" pattern (placeholder-patched `ExternalAction_Simple` calls from child to parent) is documented in the mandate catalogue but is disproportionate complexity for this sandbox; it remains available as a future Reform-flow addition if needed.
- **`GovernedToken_CollectSplitPayment` (Flow 9, step 5) has no real sale flow behind it.** It's included for input-type coverage; calling it without a prior `Governed721` transfer/sale will typically be a no-op or revert depending on the token's internal split-tracking state.

## Metadata URI

`TBD` — no metadata URI was supplied. The deploy script will use an empty string with a `// TODO: set metadata URI before deploying` comment. Upload a JSON file (`name`, `description`, optional `image`) to [Pinata](https://pinata.cloud) and paste the resulting URL in before deploying if you want it to render properly in block explorers and the frontend.

## Account Abstraction

A `PowersPaymaster` will be deployed alongside Mandate Sandbox and seeded with **0.05 ETH** at deployment. The deployer wallet must hold at least 0.05 ETH plus gas on Arbitrum Sepolia at deploy time. Admin (role 0) governs the Fund Paymaster and Withdraw from Paymaster flows (Flow 15).

---

## Implementation Notes

> This section is for the developer implementing the deploy script.

- **Deploy script:** `solidity/governance/mandate-sandbox/Deploy.s.sol`
- **Actions script:** `solidity/governance/mandate-sandbox/Actions.s.sol`
- **Runners script:** `solidity/governance/mandate-sandbox/Runners.s.sol`
- **Test file:** `solidity/governance/mandate-sandbox/Test.t.sol`
- **Mandate version:** MAJOR=0, MINOR=1, PATCH=8
- **Network:** Arbitrum Sepolia (chainId 421614)
- Mandate `nameDescription` strings must match exactly across Deploy/Actions/Runners.
