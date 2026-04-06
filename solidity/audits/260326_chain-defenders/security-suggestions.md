# Powers Protocol — Security Suggestions & Feedback

> **Context**: These are pre-audit suggestions shared with the protocol team after reviewing the architecture description and codebase overview. Not a formal audit.
> **Date**: 2026-03-24
> **Source**: https://github.com/publius-projects/powers-monorepo

---

## What You're Building is Genuinely Different

Unlike token-weighted Governor patterns, Powers uses role-based, mandate-driven execution with an elegant cross-mandate linking mechanism via actionId hashing. The constitutional phase + immutability model is a strong design primitive. The dual-phase execution (handleRequest VIEW + executeMandate) is a thoughtful separation.

That said, the flexibility that makes Powers powerful is also its main risk surface. Every mandate is a custom policy engine. The security of any deployment is only as strong as the weakest mandate in its constitution.

---

## Suggestions by Priority

### 1. Enforce handleRequest / executeMandate consistency (Critical)

There is currently no mechanism ensuring that `executeMandate()` runs what `handleRequest()` promised. A buggy (or malicious) mandate could simulate one action and execute another.

**Suggestion**: At `request()` time, hash the `(targets, values, calldatas)` returned by `handleRequest()` and store it on-chain. At `fulfill()` time, re-derive the hash from what `executeMandate()` actually produces and compare. If they diverge, revert.

```solidity
// At request():
bytes32 expectedHash = keccak256(abi.encode(targets, values, calldatas));
_actions[actionId].expectedCallHash = expectedHash;

// At fulfill():
// After executeMandate() runs, re-hash actual outputs and assert equality
require(actualHash == _actions[actionId].expectedCallHash, "Powers: calldata mismatch");
```

This turns a trust assumption into a cryptographic guarantee.

#### Reply 7Cedars 
Text here 

---

### 2. Add reentrancy protection to fulfill() (High)

`fulfill()` loops through `targets` calling `target.call{value}(calldata)`. If any target calls back into `Powers` (to trigger a new `request()` or `fulfill()`), there is no guard. Mandate chains make this realistic.

**Suggestion**: Add `nonReentrant` to `fulfill()` and document that mandates must not call back into the same Powers instance mid-execution. Consider also guarding `request()`.

---

### 3. Clarify role membership semantics at fulfill time (High)

When a proposal passes and enters timelock, roles can be revoked or reassigned before `fulfill()` executes. The voters at vote time may no longer be role holders at execution time.

**Suggestion**: Make the design intent explicit in documentation and NatSpec. Two valid options:
- **Snapshot model**: Record role membership at proposal creation, use that snapshot for quorum/threshold checks.
- **At-time-of-fulfill model**: Current behavior — document explicitly that roles are dynamic and operators must account for this.

Neither is wrong, but the choice has significant governance implications.

---

### 4. Mandate contracts must be audited before constitution (High)

During `constitute()`, mandates are initialized via `mandate.initializeMandate()`. A malicious mandate runs arbitrary code at this point, before `closeConstitute()` locks the structure. Powers provides no safety net here.

**Suggestion**: Add a prominent warning in docs (and ideally in a comment in `Powers.sol`) that every mandate contract must be fully audited before it is passed to `constitute()`. Consider whether a mandate registry or verification step is feasible in a future version.

---

### 5. Reject duplicate actionIds in non-terminal states (Medium)

The protocol does not explicitly block a caller from submitting a new `request()` with a `(mandateId, nonce)` pair that produces an actionId already in a REQUESTED or PROPOSED state.

**Suggestion**: At `request()` (and `propose()`), check that the derived actionId is not already in an active state. Revert with a clear error if so.

```solidity
require(_actions[actionId].actionState == ActionState.Null, "Powers: action already exists");
```

---

### 6. Blacklist needs a governance path (Medium)

Blacklisting is permanent unless admin actively reverses it. If no mandate was adopted during constitution to manage blacklisting, a blacklisted address has no recourse and no on-chain appeal mechanism.

**Suggestion**: Either include a default "blacklist review" mandate in example constitutions, or add an expiry timestamp to the blacklist struct so blacklisting can be time-bounded. Document clearly that perpetual blacklist without a governance path is a governance risk.

---

### 7. Clarify quorum semantics for dynamic roles (Medium)

`Conditions.quorum` and `successThreshold` are stored as `uint32` absolute counts. For roles with static membership this is fine. For roles where membership grows or shrinks after a mandate is configured, a fixed quorum can make a mandate permanently unexecutable (e.g., quorum=5 on a role with 3 members).

**Suggestion**: Either enforce a check at `adoptMandate()` time that quorum ≤ current role size, or support percentage-based thresholds as an alternative to absolute counts. At minimum, document the behavior clearly.

---

### 8. Document what happens when executeMandate reverts (Medium)

It is not obvious from the architecture what the action state becomes if `executeMandate()` reverts during `fulfill()`. Does the action stay REQUESTED and become retryable? Does it enter a FAILED state? Can an attacker force a revert to grief a legitimate fulfillment?

**Suggestion**: Add a FAILED state to the ActionState enum and explicitly handle the revert case. Document retry semantics.

---

### 9. Mandate version tracking (Low)

When a mandate is revoked and a new one is adopted with the same `mandateId`, historical actionIds (computed from the old mandate's context) could be confused with new ones. No version is tracked.

**Suggestion**: Include a mandate version or adoption timestamp in the actionId computation, or document that `mandateId` should never be reused after revocation.

---

### 10. PUBLIC_ROLE sentinel value (Informational)

`PUBLIC_ROLE = type(uint256).max` is a magic sentinel. If roles are ever iterated numerically in any integration, off-by-one or overflow bugs could accidentally include or skip PUBLIC_ROLE.

**Suggestion**: Define it as a named constant with a clear comment explaining it is intentionally max uint256 and must never be used in arithmetic. Add a check in `assignRole()` that rejects explicit assignments of PUBLIC_ROLE (since everyone implicitly has it).

---

### 11. EIP-712 domain separator (Informational)

Confirm the domain separator includes `block.chainid` to prevent cross-chain replay of off-chain signatures.

---

## Key Open Questions

1. **What is the recovery path** if a critical bug is found post-constitution and no upgrade mandate was adopted? Is this intentional (immutability as a feature)?

2. **Async pathways** (GitHub, Snapshot integrations) — how is off-chain data authenticated before it influences on-chain `fulfill()`? This is a significant attack surface.

3. **Mandate audit expectations** — will the team publish a set of "blessed" or audited mandates that deployers can use safely, vs. mandates that require their own independent audit?

4. **Is `executeMandate()` expected to be called only by Powers, or can it be called directly?** If directly callable, role/condition checks could be bypassed.

---

## Summary

| # | Area | Priority |
|---|------|----------|
| 1 | handleRequest / executeMandate divergence | Critical |
| 2 | Reentrancy in fulfill() | High |
| 3 | Role membership at fulfill time | High |
| 4 | Mandate trust at constitution | High |
| 5 | Duplicate actionId rejection | Medium |
| 6 | Blacklist governance path | Medium |
| 7 | Quorum semantics for dynamic roles | Medium |
| 8 | executeMandate revert handling | Medium |
| 9 | Mandate version tracking | Low |
| 10 | PUBLIC_ROLE sentinel | Informational |
| 11 | EIP-712 chain-specificity | Informational |