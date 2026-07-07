# Powers Protocol — Audit Response

**In response to:** [`260703_Fable5.md`](./260703_Fable5.md) (Claude Fable 5 / Opus 4.8, 2026-07-03)
**Response date:** 2026-07-07
**Target version at audit:** Powers `v0.6.1` — commit `c4e5bbf` on `develop`
**Author:** 7Cedars

> This document tracks how each finding from the Fable 5 audit is being addressed. It is a
> living record: as fixes land, their section moves from *Planned* / *Acknowledged* to *Fixed*
> with the concrete change and verification. Sections not yet addressed record the current
> intended disposition, not a completed change.

---

## 1. Status overview

| ID | Severity | Title | Disposition |
|----|----------|-------|-------------|
| C-01 | High | Quorum & success thresholds use live member count, not a vote snapshot | ✅ **Fixed** |
| C-02 | Medium | Vote approves *intent*, not payload; `Succeeded` actions never expire by default | ✅ **Addressed (guidance)** |
| C-03 | Medium | `DelegateTokenSelect` ranks on live `getVotes()` | ✅ **Fixed** |
| C-04 | Medium | Nominee-set mutation griefs / redirects pending selection results | ⏳ Under review |
| C-05 | Low | Reform mandates install child mandates with all-zero conditions | ⏳ Under review |
| C-06 | Low | `fulfill` blacklist only screens direct targets | 📝 Acknowledged |
| C-07 | Low | `SafeAllowance_Transfer` truncates `uint256` amount to `uint96` | ⏳ Under review |
| C-08 | Info | `initializeMandate` is unrestricted (bounded by namespacing) | 📝 Acknowledged (benign) |
| C-09 | Info | Decode-robustness & encoding nits | ⏳ Under review |
| C-10 | Info | Trust-model / centralization notes | 📝 Acknowledged (by design) |

Legend: ✅ Fixed · ⏳ Under review / planned · 📝 Acknowledged (no code change intended, or documentation-only).

---

## 2. Fixes implemented

### C-01 — Quorum & success thresholds now use a vote-time snapshot — ✅ Fixed

**Finding.** `_quorumReached` / `_voteSucceeded` computed the denominator (the number of
eligible voters) from the **live** role member count at the moment state was evaluated —
including inside `request()` after voting closed — while the `forVotes` / `abstainVotes`
numerators were fixed counts accrued during the vote. With no snapshot, the outcome of a
*concluded* vote could be flipped by changing role membership before `request()`: inflate the
role to defeat a passing proposal, or shrink it to pass a failing one.

**Why a count-only snapshot is not enough.** Simply freezing the denominator would have
introduced a *new* attack. Vote eligibility in `_castVote` was checked live (via
`canCallMandate` → `hasRoleSince != 0`), with no requirement that the voter was a member when
voting opened. Freezing the denominator while still letting post-snapshot joiners vote would let
`forVotes + abstainVotes` exceed the frozen denominator — a clean "pass a failing proposal by
stuffing the role with For-voters" vector. The fix therefore had to be **two coupled changes**.

**The fix.** Freeze the eligible-voter count at `voteStart` *and* restrict voting to members
who joined at or before `voteStart`. This leverages a checkpoint the protocol already stores —
`Member.since` (the join block) — rather than introducing any new bookkeeping. Together they
guarantee the eligible-voter set ⊆ members-at-`voteStart` = snapshot `N`, so
`numerator ≤ N` always holds and both directions of the finding close.

Concretely:

1. **Snapshot the count** — new field `uint32 voterCountSnapshot` on the `Action` struct
   (`PowersTypes.sol`). It packs into the existing Slot 2 (which had 128 free bits), so it costs
   **no additional storage slot**. Captured in `propose()` when `quorum > 0`:
   ```solidity
   action.voterCountSnapshot = quorum > 0 ? uint32(_countMembersRole(allowedRole)) : 0;
   ```
   `_quorumReached` and `_voteSucceeded` now read `proposedAction.voterCountSnapshot` as the
   denominator instead of the live `_countMembersRole(...)`.

2. **Gate voting eligibility** — `_castVote` now rejects any account whose membership postdates
   `voteStart`, with a dedicated error `Powers__JoinedAfterVoteStart` for diagnosability:
   ```solidity
   uint256 allowedRole = getConditions(mandateId).allowedRole;
   if (allowedRole != PUBLIC_ROLE && hasRoleSince(account, allowedRole) > action.voteStart) {
       revert Powers__JoinedAfterVoteStart();
   }
   ```
   `<=` semantics keep a member who joined in the same block as `propose()` eligible.
   `PUBLIC_ROLE` mandates cannot carry `quorum > 0` (blocked at adoption), so the gate only ever
   runs for finite roles.

3. **Expose the snapshot** — `getActionVoteData` returns `voterCountSnapshot` as an additional
   value (interface + implementation updated; the single internal consumer in `Checks.sol` and
   the affected tests were updated to the new arity).

**Files changed.**
- `src/interfaces/PowersTypes.sol` — new `voterCountSnapshot` field on `Action`.
- `src/interfaces/PowersErrors.sol` — new `Powers__JoinedAfterVoteStart` error.
- `src/Powers.sol` — snapshot capture in `propose()`; snapshot used as denominator in
  `_quorumReached` / `_voteSucceeded`; eligibility gate in `_castVote`; `getActionVoteData` getter.
- `src/interfaces/IPowers.sol` — `getActionVoteData` signature.
- `src/libraries/Checks.sol` — updated `getActionVoteData` destructuring arity.
- `frontend/context/builds/Powers.json` — regenerated ABI (`make update-builds`).

**Verification.**
- `forge build` — clean.
- `forge test` — **736 passed, 0 failed, 7 skipped** (baseline was 732; the 4 new tests below
  are additive, and no existing test regressed).
- Four regression tests added in `test/unit/Powers.t.sol` (`VoteTest`), each exercising a vector
  the old code got wrong:
  - `testVoteOutcomeNotDefeatedByMembershipInflation` — inflating the role after a passing vote
    leaves the action `Succeeded` (previously flippable to `Defeated`).
  - `testVoteOutcomeNotPassedByMembershipDeflation` — shrinking the role after a minority vote
    leaves the action `Defeated` (previously flippable to `Succeeded`).
  - `testVoteRevertsForMemberJoinedAfterVoteStart` — a post-`voteStart` joiner's `castVote`
    reverts `Powers__JoinedAfterVoteStart` (closes the stuffing vector).
  - `testVoterCountSnapshotEqualsMemberCountAtVoteStart` — the snapshot equals the member count
    at `voteStart`.

---

### C-02 — Stale-state window surfaced in `/design-org` guidance — ✅ Addressed (guidance)

**Finding.** A succeeded vote approves *intent* (`mandateId + calldata + nonce`), not a concrete
payload. `handleRequest()` runs live at `request()`-time and may read mutable state (role sets,
balances, delegation, tallies) not bound by the calldata. Because a `Succeeded` action never
expires on its own and `maxExecutionDelay` defaults to `0` (disabled), the gap between "voters
approved" and "state read at execution" is unbounded unless a designer opts in. C-01, C-03 and
C-04 are concrete faces of this.

**Disposition — minimal recommendation taken.** Per the audit's own minimum bar ("surface the risk
in `/design-org` guidance so every state-reading, quorum-gated mandate ships with a
`maxExecutionDelay`"), this is resolved as a **guidance** change; no protocol behavior was altered.

**Why the code default is left unchanged.** `maxExecutionDelay = 0` is a deliberate fail-open
default: it preserves the pre-existing unbounded-wait behavior and is already documented on
`PowersTypes.Conditions.maxExecutionDelay` (`src/interfaces/PowersTypes.sol:27-33`). Enforcement
already exists in `Checks.check()`. The residual risk was that the design tooling never mentioned
the field — designers had no way to know to opt in. That gap is now closed.

**The change.** The `/design-org` skill (`.claude/commands/design-org.md`) now surfaces the field
and the rule in every place a designer would look:

1. **§A.4 struct reference** — `maxExecutionDelay` added to the `Conditions` field list (it was
   previously absent; the reference listed only 8 of the 9 fields).
2. **§A.4 stale-state rule** — a new *"Stale-state rule (critical for quorum-gated, state-reading
   mandates)"* callout, in the same voice as the adjacent veto rule: any mandate that is both
   quorum-gated and reads mutable state at execution must set a non-zero `maxExecutionDelay`
   (rule of thumb `≈ votingPeriod`), with a list of which catalogue mandates read mutable state
   (`PeerSelect`, `DelegateTokenSelect`, `ElectionRegistry_*`, `SlateRegistry_*`,
   `SelfSelect`/`RenounceRole` on the voting role, balance-dependent `BespokeAction*`/
   `ExternalAction*`) vs. the intent-only ones that don't.
3. **§A.4 heuristics table** — a `Max Exec Delay` column (Small = 3 days, Medium = 1 week,
   Large = 2 weeks, i.e. ≈ voting period).
4. **Worked deploy example** — `maxExecutionDelay` set on the quorum-gated proposal mandates, with
   an explanatory comment tying back to the §A.4 rule.
5. **Finalisation checklist** — a new item: *"Every quorum-gated mandate that reads mutable state
   sets a non-zero `maxExecutionDelay`."*

**Files changed.**
- `.claude/commands/design-org.md` — struct reference, stale-state rule, heuristics column,
  worked example, finalisation checklist.

**Verification.** Documentation-only; verified by inspection —
`grep -n maxExecutionDelay .claude/commands/design-org.md` now returns the field across the §A.4
reference, the stale-state callout, the heuristics table, the worked example, and the checklist,
and the §A.4 field list matches `PowersTypes.Conditions` (all 9 fields).

---

### C-03 — `DelegateTokenSelect` now ranks on a past snapshot (`getPastVotes`) — ✅ Fixed

**Finding.** The mandate ranked nominees by `ERC20Votes.getVotes(nominee)` — the *live* delegated
voting power read at `request()`-time. Because `getVotes` is instantaneous (not a historical
checkpoint), an attacker could acquire or borrow a large `ERC20Votes` balance, delegate it to a
chosen nominee (or self-nominate and self-delegate) in the **same block** as `request()`, capture
the top-N seats, then undelegate/return the tokens — trivially manipulable, including via
flash-loaned governance tokens, wherever the mandate is a `quorum == 0` direct action.

**The fix.** Rank on `ERC20Votes.getPastVotes(nominee, snapshotBlock)` — voting power measured at a
block strictly in the past — so it cannot be borrowed just-in-time. `getPastVotes` reverts on a
future/equal timepoint, so the snapshot is always a completed block:

- **Quorum-gated elections:** `snapshotBlock = proposedAt` (the vote-open block). Voting power is
  fixed when the election opens — consistent with the C-01 snapshot philosophy — so delegation
  acquired after the vote opens does not count.
- **`quorum == 0` direct actions** (no proposal, `proposedAt == 0`): `snapshotBlock =
  block.number - 1`. The whole action runs in one block, so any prior block defeats same-block
  (flash-loan) manipulation, which is atomic within a single block.

```solidity
(, uint48 proposedAt,,,,,) = IPowers(payable(powers)).getActionData(actionId);
mem.snapshotBlock = proposedAt > 0 ? uint256(proposedAt) : block.number - 1;
...
mem.delegatedVotes[mem.i] =
    ERC20Votes(mem.votesToken).getPastVotes(mem.nominees[mem.i], mem.snapshotBlock);
```

This assumes the votes token uses a block-number clock (the OpenZeppelin default), consistent with
the rest of the protocol (`proposedAt`/`voteStart` are block numbers). That assumption is
documented in the mandate's NatSpec.

**Files changed.**
- `src/core/mandates/electoral/DelegateTokenSelect.sol` — derive `snapshotBlock` from `proposedAt`;
  rank on `getPastVotes(nominee, snapshotBlock)` instead of live `getVotes`; NatSpec updated.

**Verification.**
- `forge build` — clean.
- `forge test` — **737 passed, 0 failed, 7 skipped** (was 736; the new regression test below is
  additive, and no existing test regressed).
- `test/unit/mandates/Electoral.t.sol` updated/added:
  - `testDelegateTokenSelectIgnoresSameBlockDelegation` (new) — a nominee self-delegates a large
    balance in the execution block; the past snapshot ignores it, so the snapshot top-3 win and the
    just-in-time delegator is excluded. This fails under the old `getVotes` code (the delegator
    would have been elected).
  - `testDelegateTokenSelectRanksByDelegatedVotes` (updated) — now delegates in a block *before*
    `request()` (`vm.roll`) and orders nominations opposite to vote weight, so it genuinely
    exercises the past-snapshot ranking rather than passing on insertion order.

---

## 3. Findings under review

The following are being evaluated; this section will be updated as decisions and fixes land.

- **C-04** — Binding electoral selections to nominee *addresses* (or a snapshot of the nominee
  list) instead of positional `bool[]` over a mutable array; freezing nominations during an open
  selection. This is the electoral-mandate face of the same live-state class as C-01.
- **C-05** — Letting reform mandates carry full `Conditions`/`config` per adopted child, or
  curating the adoptable set and documenting that adopted mandates are ungoverned by default.
- **C-07** — Adding a `uint96` bound in `SafeAllowance_Transfer` before the cast.
- **C-09** — `calldatasize` guard in `arrayifyBools`; underflow note in `hexStringToBytes`;
  dropping the extra `adoptMandate` args in `ElectionRegistry_CreateVoteMandate`.

---

## 4. Acknowledged (no code change intended)

- **C-06** — The `fulfill` blacklist is a target-only control by design; it cannot completely
  block a blacklisted *beneficiary* of an otherwise-innocuous call. Scope will be documented so
  operators do not over-rely on it for value containment.
- **C-08** — `initializeMandate` is namespaced by `msg.sender`; an attacker can only write into
  their own namespace and cannot overwrite a real Powers instance's config. Confirmed benign; no
  safety change required.
- **C-10** — The trust model (privileged mandates, `OpenAction` power, `Ownable` registries /
  factory) is intentional. The dominant deployed-org risk is mandate-to-role gating, which is a
  configuration responsibility surfaced in tooling rather than a core-protocol bug.

---

## 5. Positive observations (from the audit, retained)

The audit confirmed the core engine's `fulfill` reentrancy ordering, uniform `onlyPowers` access
control, the `PUBLIC_ROLE` + quorum adoption block, duplicate-vote / duplicate-action guards, and
bounded execution limits. These remain unchanged.
