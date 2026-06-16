# Powers Protocol Reference

## XMTP Chat vs On-Chain Actions

XMTP group messages are governance communication — discussion, coordination, status updates. They carry no on-chain weight. When a participant says "vote yes on proposal 5" in an XMTP group, that is an instruction, not a vote. The agent must separately call `cast_vote` to actually register a vote on-chain. Never conflate a message with an action.

## Core Concepts

**Powers** is the central hub contract. All governance actions — propose, vote, execute — are submitted to and enforced by Powers. There is one Powers contract per organisation.

**Mandate** is a governance module adopted by a Powers contract. Each mandate encodes a specific governance rule or capability (e.g. "allow role X to transfer funds", "let members self-assign a role"). Mandates have conditions: voting period, quorum, pass threshold, and timelock. A mandate with `votingPeriod = 0` and `timelock = 0` executes immediately for any eligible role holder.

**Action** is a governance proposal targeting a specific mandate. An action has a lifecycle:
1. `propose_action` → action enters `Active` state; voting window opens (if `votingPeriod > 0`)
2. `cast_vote` → members vote FOR / AGAINST / ABSTAIN; voting window closes after `votingPeriod` blocks
3. If quorum and pass threshold are met, action moves to `Succeeded`; timelock countdown starts
4. Once `currentBlock >= voteEnd + timelock`, `execute_action` → action moves to `Fulfilled`

If `votingPeriod = 0`, there is no vote; the action moves directly to `Succeeded` after proposal (subject to timelock). If `timelock = 0`, execution is available immediately after the vote passes (or immediately after proposal if no vote).

**Role** is an on-chain integer (uint256). Roles gate access: each mandate declares which roleId is allowed to call it. `canCallMandate(agentAddress, mandateId)` returns true only if the agent holds the required role. Always check `get_governance_state` to confirm which mandates the agent can currently access.

**Flow** is a sequence of mandates linked by cross-mandate conditions. Mandate B can declare `needFulfilled(mandateId=A, nonce=N)`, meaning an action in Mandate A with matching nonce must reach `Fulfilled` state before the action in Mandate B can execute. This is how multi-step governance processes are enforced: phase 1 must complete before phase 2 can proceed.

## Cross-Mandate Conditional Flows

When the governance state shows a mandate with `needFulfilled` conditions, the agent must:
1. Identify which upstream mandate and nonce are required
2. Check whether the parent action is already `Fulfilled`
3. If not, determine whether to wait, or whether it should be the one to propose or execute the parent action first

Never propose an action in a flow-dependent mandate before checking that all upstream conditions are satisfied — the transaction will revert.

## Action States

| State | Meaning |
|---|---|
| `Active` | Voting window is open |
| `Cancelled` | Proposal was cancelled |
| `Succeeded` | Vote passed (or no vote required); timelock may still be running |
| `Defeated` | Vote failed to meet quorum or pass threshold |
| `Fulfilled` | Execution confirmed on-chain; downstream mandates can now proceed |

`readyToExecuteAt` in the governance context gives the block number after which execution is valid for any action in `Succeeded` state.

## Electoral Mandates

Electoral mandates assign and revoke roles. If the agent lacks a role it needs, it should:
1. Check whether a SelfSelect mandate exists for that role (agent can self-assign)
2. Check whether a nomination or peer-selection process is available
3. If neither, accept the constraint and do not attempt to call mandates it cannot access

Do not attempt to call a mandate where `canCall = false`.

## Practical Reasoning Rules

- Always call `get_governance_state` before any governance action. Never act on stale context.
- Before proposing, check for existing open actions on the same mandate with identical calldata — do not create duplicates.
- If an action is in `Succeeded` state but `currentBlock < readyToExecuteAt`, the timelock is still running. Log it, do not retry immediately; revisit on the next heartbeat.
- If a transaction simulation fails, read the revert reason returned by the tool. Diagnose before retrying: check role, action state, conditions, and nonce.
- The `reasoning` field in `propose_action` and `cast_vote` is stored on-chain. Write it clearly — it is the permanent public record of the agent's decision.
- On a heartbeat: if there is nothing actionable, take no action and send no message.
