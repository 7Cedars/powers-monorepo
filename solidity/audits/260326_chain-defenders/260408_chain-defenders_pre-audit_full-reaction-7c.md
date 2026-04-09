# Powers Protocol — Security Suggestions & Feedback

> **Context**: These are pre-audit suggestions shared with the protocol team after reviewing the architecture description and codebase overview. Not a formal audit.
> **Date**: 2026-03-24
> **Source**: https://github.com/publius-projects/powers-monorepo

---

## What You're Building is Genuinely Different

Unlike token-weighted Governor patterns, Powers uses role-based, mandate-driven execution with an elegant cross-mandate linking mechanism via actionId hashing. The constitutional phase + immutability model is a strong design primitive. The dual-phase execution (handleRequest VIEW + executeMandate) is a thoughtful separation.

That said, the flexibility that makes Powers powerful is also its main risk surface. Every mandate is a custom policy engine. The security of any deployment is only as strong as the weakest mandate in its constitution.

#### Reply 7Cedars
Thank you for noting that this is a genuinely new governance protocol and highlighting its design strengths. 

I would like to push back slightly on the statement that "The security of any deployment is only as strong as the weakest mandate in its constitution". 
- It is true that the strength of mandates used reflects in the overall strength of a governance system. Mandates need to be properly audited—obviously.  
- Having said this, because mandates are used in sandboxed governance flows, one weak mandate only impacts its specific flow and the functionality it controls. It does not impact other flows. 
- Also, because of the ability to create checks and balances *within* flows, the exploitation of a vulnerability in one mandate can be blocked through, for instance, a veto call by another mandate. 
- Finally, a single flow can be paused by removing its final mandate. This means that, instead of pausing an entire protocol, a single functionality can be paused. It lowers the bar for intervention and heightens security. 

However, as mentioned in this review, all of this depends on proper implementation of governance structures. Powers Protocol introduces a generic, rule-based layer to crypto governance. When implemented properly, its checks and balances result in an immensely strong security layer for governance. It can provide a type of governance that is far safer than most crypto governance currently used. 

If implemented poorly, it simply does not. 

Please note that changes to the code have already been synced to the `develop` branch of the `publius-projects/powers-monorepo` repository.

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
Notes: 
- The support for async calls in the standard `Mandate.sol` contract is the fundamental cause of this vulnerability. It is a feature of async calls that you cannot know the return value in advance, and hence the check is not implemented—even though it is implied (which makes the vulnerability worse). 
- Although I like the proposed solution, the actual fix is to separate async support from the standard `Mandate.sol` contract. 
- This means three core functions are left in `Mandate.sol`: `initializeMandate()`, `handleRequest()`, and `executeMandate()`. 
    - The internal functions have been removed. 
    - `executeMandate()` executes the output of `handleRequest()` directly and can only be called by its Powers instance. 
    - There is no opportunity to alter the output of `handleRequest()` before its execution by `executeMandate()`. 
    - This seemed the simplest and most efficient solution. 
- I created a new `AsyncMandate.sol` that takes an oracle address at initialization, allowing access restrictions, and that supports callback functionality. I will make sure that `handleRequest` returns a very clear signal that it is an async call—and hence the return data cannot be predicted.

---

### 2. Add reentrancy protection to fulfill() (High)

`fulfill()` loops through `targets` calling `target.call{value}(calldata)`. If any target calls back into `Powers` (to trigger a new `request()` or `fulfill()`), there is no guard. Mandate chains make this realistic.

**Suggestion**: Add `nonReentrant` to `fulfill()` and document that mandates must not call back into the same Powers instance mid-execution. Consider also guarding `request()`.

#### Reply 7Cedars 
The Powers instance should *never* be assigned a role ID in its own organization. If it is not, reentrancy attacks are impossible.   

Note that line 279 in `request()` makes it impossible for anyone without the correct role ID to create a request:

```solidity
if (!canCallMandate(_msgSender(), mandateId)) revert Powers__CannotCallMandate();
```

Note that line 327 in `fulfill()` makes it impossible for a non-active mandate to fulfill a request:

```solidity
if (mandate.targetMandate != _msgSender()) revert Powers__CallerNotTargetMandate();
```

Please correct me if I am wrong, but these checks should make reentrancy impossible as long as the organization does not have a role assigned to itself.

I added a check at `_setRole` that makes it impossible to assign a role to the organization itself:
```solidity 
if (account == address(this)) revert Powers__CannotAddPowersAddressAsMember();
```
---

### 3. Clarify role membership semantics at fulfill time (High)

When a proposal passes and enters timelock, roles can be revoked or reassigned before `fulfill()` executes. The voters at vote time may no longer be role holders at execution time.

**Suggestion**: Make the design intent explicit in documentation and NatSpec. Two valid options:
- **Snapshot model**: Record role membership at proposal creation, use that snapshot for quorum/threshold checks.
- **At-time-of-fulfill model**: Current behavior — document explicitly that roles are dynamic and operators must account for this.

Neither is wrong, but the choice has significant governance implications.

#### Reply 7Cedars  
Completely correct. Because the protocol does not use tokens to assign voting weights but role designations, I thought it would be simplest—and still secure—to use the at-time-of-fulfill model. 

I completely agree that this should be made very clear in the documentation. Will do.

---

### 4. Mandate contracts must be audited before constitution (High)

During `constitute()`, mandates are initialized via `mandate.initializeMandate()`. A malicious mandate runs arbitrary code at this point, before `closeConstitute()` locks the structure. Powers provides no safety net here.

**Suggestion**: Add a prominent warning in docs (and ideally in a comment in `Powers.sol`) that every mandate contract must be fully audited before it is passed to `constitute()`. Consider whether a mandate registry or verification step is feasible in a future version.

#### Reply 7Cedars  
Completely agree. I added the note, and a repository of audited "blessed" mandates will be created. The auditing and addition of mandates will be governed through a Powers organization.


---

### 5. Reject duplicate actionIds in non-terminal states (Medium)

The protocol does not explicitly block a caller from submitting a new `request()` with a `(mandateId, nonce)` pair that produces an actionId already in a REQUESTED or PROPOSED state.

**Suggestion**: At `request()` (and `propose()`), check that the derived actionId is not already in an active state. Revert with a clear error if so.

```solidity
require(_actions[actionId].actionState == ActionState.Null, "Powers: action already exists");
```

#### Reply 7Cedars  
Adapted the check at `propose()` to now check if a mandateId has been linked to an actionId. This indicates whether the action has already been proposed:
```solidity
if (action.mandateId != 0) revert Powers__ActionAlreadyInitiated();
``` 

The `request()` function should not block actions in the PROPOSED state but should indeed block actions in the REQUESTED state. The following existing check in `request()` should effectively do this: 
```solidity
if (action.requestedAt > 0 || action.fulfilledAt > 0) revert Powers__ActionAlreadyInitiated();
``` 

For gas efficiency, it checks the block number directly on `action.requestedAt` instead of calling `getActionState()`, but it should have the same functionality. Please correct me if I am wrong.

---

### 6. Blacklist needs a governance path (Medium)

Blacklisting is permanent unless admin actively reverses it. If no mandate was adopted during constitution to manage blacklisting, a blacklisted address has no recourse and no on-chain appeal mechanism.

**Suggestion**: Either include a default "blacklist review" mandate in example constitutions, or add an expiry timestamp to the blacklist struct so blacklisting can be time-bounded. Document clearly that perpetual blacklist without a governance path is a governance risk.

#### Reply 7Cedars
This works as intended. Adding an address to the blacklist is also not possible without adopting a mandate. This will be added to the documentation.  

---

### 7. Clarify quorum semantics for dynamic roles (Medium)

`Conditions.quorum` and `successThreshold` are stored as `uint32` absolute counts. For roles with static membership this is fine. For roles where membership grows or shrinks after a mandate is configured, a fixed quorum can make a mandate permanently unexecutable (e.g., quorum=5 on a role with 3 members).

**Suggestion**: Either enforce a check at `adoptMandate()` time that quorum ≤ current role size, or support percentage-based thresholds as an alternative to absolute counts. At minimum, document the behavior clearly.

#### Reply 7Cedars
This might have been an issue with viewing a different version of the repository. 

As far as I can see, `Conditions.quorum` and `Conditions.succeedAt` (I do not see a `successThreshold` anywhere) are stored as uint8 and handled as relative values to the number of members in a role. With the DENOMINATOR set at 100, `Conditions.quorum` and `Conditions.succeedAt` values should be handled as percentages of the number of members in a role. See the `_quorumReached()` and `_voteSucceeded()` functions.  

Please let me know if this is not the case.

---

### 8. Document what happens when executeMandate reverts (Medium)

It is not obvious from the architecture what the action state becomes if `executeMandate()` reverts during `fulfill()`. Does the action stay REQUESTED and become retryable? Does it enter a FAILED state? Can an attacker force a revert to grief a legitimate fulfillment?

**Suggestion**: Add a FAILED state to the ActionState enum and explicitly handle the revert case. Document retry semantics.


#### Reply 7Cedars
Agreed that there should be an explicit FAILED state for actions. I opted to disallow retries. 

I added a `failedAt` field to the `Action` struct and added a `Failed` state to the `ActionState` enum. 

Then, in `fulfill()`, I added logging for failed calls:  

```solidity 
 if (!success) {
    action.failedAt = uint48(block.number); // log time of failure. 
    if (returndata.length > 0) {
... 
```

And at `getActionState()`, we check this to return the correct action state: 
```solidity 
if (action.failedAt > 0) {
    return ActionState.Failed;
}
```


---

### 9. Mandate version tracking (Low)

When a mandate is revoked and a new one is adopted with the same `mandateId`, historical actionIds (computed from the old mandate's context) could be confused with new ones. No version is tracked.

**Suggestion**: Include a mandate version or adoption timestamp in the actionId computation, or document that `mandateId` should never be reused after revocation.

#### Reply 7Cedars
MandateIds only increment. Old mandateIds should never be able to be reused—exactly for the reasons mentioned here. Please let me know if this invariant is breached, and how.

---

### 10. PUBLIC_ROLE sentinel value (Informational)

`PUBLIC_ROLE = type(uint256).max` is a magic sentinel. If roles are ever iterated numerically in any integration, off-by-one or overflow bugs could accidentally include or skip PUBLIC_ROLE.

**Suggestion**: Define it as a named constant with a clear comment explaining it is intentionally max uint256 and must never be used in arithmetic. Add a check in `assignRole()` that rejects explicit assignments of PUBLIC_ROLE (since everyone implicitly has it).

#### Reply 7Cedars
This might be a versioning issue. In my version, `PUBLIC_ROLE` is a named constant, and there is a check in `_setRole()` that disallows setting of Public Role. 
I did add an extra comment noting that `type(uint256).max` should be avoided in any kind of arithmetic.

---

### 11. EIP-712 domain separator (Informational)

Confirm the domain separator includes `block.chainid` to prevent cross-chain replay of off-chain signatures.

#### Reply 7Cedars 
Yes, OpenZeppelin Contracts (last updated v5.0.0) (utils/cryptography/EIP712.sol) uses `block.chainid`.

---

## Key Open Questions

1. **What is the recovery path** if a critical bug is found post-constitution and no upgrade mandate was adopted? Is this intentional (immutability as a feature)?

2. **Async pathways** (GitHub, Snapshot integrations) — how is off-chain data authenticated before it influences on-chain `fulfill()`? This is a significant attack surface.

3. **Mandate audit expectations** — will the team publish a set of "blessed" or audited mandates that deployers can use safely, vs. mandates that require their own independent audit?

4. **Is `executeMandate()` expected to be called only by Powers, or can it be called directly?** If directly callable, role/condition checks could be bypassed.

#### Reply 7Cedars 
I replied to these questions in my earlier answer. 

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