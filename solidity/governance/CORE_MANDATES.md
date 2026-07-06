# Core Mandates: Priority Ranking

This document ranks every mandate and helper contract by how central it is to producing a working Powers governance constitution — particularly via the `/design-org` skill.

> **Note (July 2026):** the reorganisation this ranking was written to inform has been executed. Tiers 0–3 now live under `src/core/` and Tier 4 under `src/addons/`, each with its own `mandates/` and `helpers/` subtree. Path references below (`src/mandates/`, `src/helpers/`) reflect the pre-reorganisation layout at the time the ranking was made.

Tiers are derived from three inputs:

1. **Skill requirements** — what `.claude/commands/design-org.md` (Appendix A) explicitly treats as always-included or required for non-trivial orgs.
2. **Example-org frequency** — how many of the 14 example deployments (`solidity/governance/examples/*.s.sol` + `solidity/governance/claude/*/Deploy.s.sol`) instantiate the contract.
3. **Pattern centrality** — whether the contract backs one of the skill's documented "go-to" governance patterns (Powers 101, Optimistic Execution, Bicameralism, Token Delegates, Election Lists, Slate Voting, Nested Safe Governance, Federated Sub-org Governance, Account Abstraction).

Two Snapshot integration contracts (`Snapshot_CheckSnapExists.sol`, `Snapshot_CheckSnapPassed.sol`) are fully commented-out/disabled in source and are excluded from this table as not-yet-live code.

## Tier 0 — Foundational

Appear in nearly every example org and/or are explicitly called out by the skill as always-included. Without these, no constitution can be built.

| Contract | Category | Used in examples | Justification |
|---|---|---|---|
| `PresetActions.sol` | executive | 13/14 (missing only from Governed721, which uses the `_OnOwnPowers` variant instead — 14/14 if counted together) | Skill: "Always include one of these in any constitution" — it is mandateId=0 in every deploy template, used for one-time setup (labeling Admin/Public roles, treasury, self-revoking). |
| `BespokeAction_Simple.sol` | executive | 14/14 | The only mandate present in literally every example. General-purpose "call one preconfigured function with caller-supplied params" building block used for role assignment, transfers, and arbitrary target calls. |
| `MandateRegistry.sol` | helper | 14/14 (imported by every example) | Universal address-resolution infrastructure — every deploy script looks up mandate implementations through this registry. Not a governance-design choice; a hard dependency. |

## Tier 1 — Standard flow essentials

Implement the canonical constitution template's non-setup stages (primary governance flow, membership, reform) that recur across most non-trivial orgs.

| Contract | Category | Used in examples | Justification |
|---|---|---|---|
| `StatementOfIntent.sol` | executive | 11/14 | Non-binding signaling/deliberation step; backs the "propose" stage of the propose→veto→execute template used throughout Appendix C. |
| `SelfSelect.sol` | electoral | 2/14 direct, but the skill's canonical Membership flow default | Skill template: default open-join mechanism ("Membership: join via SelfSelect, leave via RenounceRole"). Low raw frequency because many examples use elections instead, but it's the *default* baseline pattern. |
| `RenounceRole.sol` | electoral | 4/14 | Skill template: default membership-exit mechanism, paired with `SelfSelect`. |
| `Adopt_Mandates.sol` | reform | 3/14 | Skill: "Always include at least one reform flow in non-trivial governance structures so the organisation can evolve." This is the primary reform-adoption mandate named in that guidance. |
| `PauseMandates.sol` | reform | 3/14 | Safe way to disable a mandate without permanently losing it (supports restart by re-adopting/re-editing flow position) — recurring safety mechanism in the more complex example orgs (secured-slate, global-environmental-movement, yield-endowment). |

## Tier 2 — Common named patterns

Back one of the skill's explicitly documented "go-to" governance patterns; reusable across many org designs even where not universal.

| Contract | Category | Used in examples | Justification |
|---|---|---|---|
| `Nominate.sol` | electoral | 3/14 | Backs Powers 101 and Token Delegates patterns — self/peer nomination into a `Nominees` pool. |
| `PeerSelect.sol` | electoral | 1/14 | Backs the Powers 101 pattern (member-voted role assignment from nominees) — the skill's reference "simple, learnable structure" for small orgs. |
| `DelegateTokenSelect.sol` | electoral | 1/14 | Backs the Token Delegates pattern (role assignment by ERC20Votes-delegated balance ranking) — one of the skill's named default patterns. |
| `OpenAction.sol` | executive | 4/14 | Backs Optimistic Execution and Bicameralism patterns — unrestricted execution mandate for the highest-trust role in a propose/veto/execute flow. |
| `BespokeAction_Advanced.sol` | executive | 4/14 | Static+dynamic param splicing; core building block for multi-step dependency chains (`needFulfilled`/`needNotFulfilled`), which the skill calls "the primary tool for building multi-step approval and veto mechanisms." |
| `BespokeAction_OnReturnValue.sol` | executive | 4/14 | Same dependency-chain role as above, specifically for chaining a parent mandate's return data into the next action. |
| `ExternalAction_Simple.sol` | executive | 2/14 | Backs Nested Safe Governance / Federated Sub-org patterns — forwards a request to one preconfigured mandate on an external Powers instance. |
| `ExternalAction_Flexible.sol` | executive | 1/14 | Same federation family as above, with target/mandateId chosen at execution time rather than preconfigured. |
| `Revoke_Mandates.sol` | reform | 0/14 direct, but pairs with `Adopt_Mandates` | Necessary counterpart to `Adopt_Mandates` for a complete reform flow (remove mandates, not just add them); the skill groups reform mandates together as a set. |

## Tier 3 — Specialized but reusable integrations

Multi-contract subsystems used in several examples for a specific governance need (elections, slate voting, Safe-based treasury, federation deployment).

| Contract | Category | Used in examples | Justification |
|---|---|---|---|
| `ElectionRegistry_Nominate.sol` | integrations (ElectionRegistry) | 3/14 | Backs the Election Lists pattern — external-registry nomination step. |
| `ElectionRegistry_CreateVoteMandate.sol` | integrations (ElectionRegistry) | 3/14 | Opens an election and deploys the associated vote mandate. |
| `ElectionRegistry_Vote.sol` | integrations (ElectionRegistry) | 3/14 | Casts a role-holder vote for a nominee via the external registry. |
| `ElectionRegistry_Tally.sol` | integrations (ElectionRegistry) | 3/14 | Closes an election, ranks nominees, assigns/revokes roles based on results. |
| `ElectionRegistry_CleanUpVoteMandate.sol` | integrations (ElectionRegistry) | 0/14 direct but part of the subsystem | Retires the per-election vote mandate after conclusion — completes the ElectionRegistry lifecycle. |
| `ElectionRegistry.sol` | helper | 3/14 | Standalone multi-election management contract underlying all `ElectionRegistry_*` mandates. |
| `SlateRegistry_AddSlate.sol` | integrations (SlateRegistry) | 3/14 | Backs the Slate Voting pattern — submits a candidate slate of preset actions. |
| `SlateRegistry_RemoveSlate.sol` | integrations (SlateRegistry) | 3/14 | Removes/unregisters a submitted slate, freeing its flow slot. |
| `SlateRegistry_ExecuteResult.sol` | integrations (SlateRegistry) | 3/14 | Tallies a closed slate election and executes the winning slate. |
| `SlateRegistry.sol` | helper | 3/14 | Standalone slate-election management contract underlying all `SlateRegistry_*` mandates. |
| `Safe_ExecTransaction.sol` | integrations (Safe) | 1/14 | Executes an arbitrary transaction on a Gnosis Safe where Powers is an owner — core Safe-treasury pattern. |
| `Safe_ExecTransaction_OnReturnValue.sol` | integrations (Safe) | 1/14 | Same, with a parent mandate's return data spliced into the call — federated Safe treasury pattern. |
| `SafeAllowance_Transfer.sol` | integrations (Safe) | 2/14 | Moves tokens from a Safe via the Allowance Module using a delegate signature — recurring treasury pattern (global-environmental-movement, yield-endowment). |
| `SafeAllowance_Action.sol` | integrations (Safe) | 1/14 | Generic configurable call through the Safe Allowance Module. |
| `SafeAllowance_PresetTransfer.sol` | integrations (Safe) | 0/14 direct | Preset-amount variant of `SafeAllowance_Transfer` — narrower version of an already-used pattern. |
| `Safe_RecoverTokens.sol` | integrations (Safe) | 0/14 direct | Treasury-recovery utility for allowance-tracked balances — situational safety mechanism. |
| `PowersFactory.sol` | helper | 2/14 | Backs Federated Sub-org / Nested Safe Governance patterns — deploys new configured Powers instances. |
| `PowersDeployer.sol` | helper | 2/14 | Companion to `PowersFactory`, offloading heavy creation bytecode (EIP-170 size limit workaround). |
| `Nominees.sol` | helper | 3/14 | Standalone nomination-pool contract underlying `Nominate`, `PeerSelect`, and `DelegateTokenSelect`. |
| `MandatePackage.sol` | reform | 0/14 direct | Bundles a fixed list of mandate addresses and atomically adopts them all, then self-destructs — packaged variant of `Adopt_Mandates` for shipping a reform as one unit. |
| `MandatePackage_Static.sol` (`ReformMandate_Static`) | reform | 0/14 direct, exercised by `test/TestConstitutions.sol` | Adopts a fixed set of `MandateInitData` configured at deployment, then revokes/self-destructs — same packaged-reform role as `MandatePackage`, with init data fixed at deploy time instead of construction-time list. |

## Tier 4 — Niche / advanced / single-use integrations

Cover specialized governance needs (identity gating, external governance bridging, token-gated access, oracle integration, edge-case electoral logic, gas sponsorship) that appear in at most one or two examples.

| Contract | Category | Used in examples | Justification |
|---|---|---|---|
| `ZKPassport_Check.sol` | integrations (ZKPassport) | 1/14 | Identity-gating mandate — valuable for real-world-identity-linked orgs but a specialized, opt-in requirement. |
| `ZKPassport_PowersRegistry.sol` | helper | 1/14 | Supporting registry for `ZKPassport_Check`. |
| `Governor_CreateProposal.sol` | integrations (Governor) | 0/14 | Bridges to an external OZ Governor — relevant only for orgs migrating from/interoperating with standard Governor deployments. |
| `Governor_ExecuteProposal.sol` | integrations (Governor) | 0/14 | Same Governor-bridging family as above. |
| `ERC721_GatedAccess.sol` | integrations (ERC721) | 0/14 | Role assignment gated on holding a minimum balance of an arbitrary ERC721 collection — general-purpose but not used in current examples. |
| `GovernedToken_GatedAccess.sol` | integrations (GovernedToken) | 0/14 | Role assignment gated on a Governed721/Soulbound1155 token — Governed721-specific pattern. |
| `GovernedToken_BurnToAccess.sol` | integrations (GovernedToken) | 0/14 | Burn-to-unlock gating — narrow Governed721-specific mechanism. |
| `GovernedToken_MintEncodedToken.sol` | integrations (GovernedToken) | 1/14 | Mints a governed token with encoded metadata — specific to the Governed721 example. |
| `GovernedToken_CollectSplitPayment.sol` | integrations (GovernedToken) | 1/14 | Splits/collects proceeds on governed-token sale — specific to the Governed721 example. |
| `Governed721.sol` | helper | 1/14 | Interface contract underlying the `GovernedToken_*` mandate family. |
| `ChainlinkFunctions_Open.sol` | integrations (ChainlinkFunctions) | 0/14 | Async oracle-forwarding mandate — powerful but requires off-chain Chainlink Functions infrastructure, not used in any current example. |
| `RevokeInactiveAccounts.sol` | electoral | 1/14 | Participation-based role cleanup — situational governance-hygiene mechanism (yield-endowment only). |
| `RevokeAccountsRoleId.sol` | electoral | 0/14 | Bulk role revocation utility — not exercised by any current example. |
| `RoleByRoles.sol` | electoral | 1/14 | Composed-role assignment from prerequisite roles — used once (Governed721) for a specific role-composition need. |
| `AssignExternalRole.sol` | electoral | 0/14 | Parent/child role mirroring — relevant only to federated multi-Powers setups, not exercised by current examples. |
| `PowersFactory_AddSafeDelegate.sol` | integrations (PowersFactory) | 0/14 | Adds a Safe Allowance delegate for a factory-deployed org — narrow composition helper for the factory pattern. |
| `PowersFactory_AssignRole.sol` | integrations (PowersFactory) | 0/14 | Assigns a role in a factory-deployed org based on deployment return data — same narrow factory-composition family. |
| `CheckExternalActionState.sol` | executive | 0/14 | Gate mandate verifying an action's state on an external Powers instance — advanced federated dependency-chain tool. |
| `ExternalAction_OnReturnValue.sol` | executive | 0/14 | Forwards a parent mandate's return data to an external Powers mandate — advanced federated dependency-chain tool. |
| `PresetActions_OnOwnPowers.sol` | executive | 1/14 (Governed721) | Self-targeting variant of `PresetActions` for orgs governing their own Powers contract directly — narrower than the base pattern. |
| `PowersPaymaster.sol` | helper | 4/14 | ERC-4337 gas sponsorship — orthogonal to governance logic itself (an infra/UX convenience, not a mandate that shapes decision-making). |

## Summary

- **3 contracts** are foundational (Tier 0): `PresetActions`, `BespokeAction_Simple`, `MandateRegistry`.
- **5 contracts** round out the standard constitution template (Tier 1).
- **9 contracts** back the skill's named go-to patterns (Tier 2).
- **21 contracts** form specialized-but-reusable subsystems — elections, slates, Safe treasury, federation, packaged reform (Tier 3).
- **21 contracts** are niche, advanced, or currently unexercised by any example org (Tier 4).

A pragmatic "core mandates" folder (the follow-up work this document is meant to inform) would likely start with Tiers 0–1, optionally folding in the most-used Tier 2 items (`OpenAction`, `BespokeAction_Advanced`, `Nominate`/`PeerSelect`).
