# Global Environmental Movement — Governance Specification

> **Status:** Draft  
> **Network:** Ethereum Sepolia (11155111) / Arbitrum Sepolia (421614)  
> **Design date:** 2026-06-04

---

## Purpose

A global, pseudonymous social movement that organises and funds environmental action. The
movement operates at two levels: a parent organisation that allocates resources and spawns
sub-movements, and autonomous sub-organisations that decide locally how to act. All
participants except the visible leadership are anonymous; identity uniqueness is enforced
at membership entry via ZK-passport. The movement controls a Gnosis Safe treasury and
distributes funding to sub-orgs via Safe allowances.

---

## Roles — Parent Organisation

| Role ID | Name | Description | How to join | Max members |
|---------|------|-------------|-------------|-------------|
| 0 | Admin | Internal protocol role; held by deployer at genesis. No ongoing governance function. | Deployment | 1 |
| 1 | Leader | Visible, accountable governance layer. Can pause/restart key flows, proposes governance reform. | Annual election by all Members | 7 |
| 2 | Parent Coordinator | Manages daily proposal decisions at parent level. Separate from sub-org coordinators. | Self-nominate → assigned by Leaders | Unlimited |
| 3 | Member | Anonymous base layer. ZK-passport uniqueness verified at join. | ZK-passport check → SelfSelect | Unlimited |
| 4 | Recognised Sub-org | Non-human role. Assigned to the contract address of each spawned sub-movement. Grants the sub-org a vote on parent-level reform. | Assigned automatically when sub-org is spawned | One per sub-org |
| max | Public | Everyone. | Automatic | Unlimited |

---

## Roles — Sub-organisation (template, deployed per sub-movement)

| Role ID | Name | Description | How to join | Max members |
|---------|------|-------------|-------------|-------------|
| 0 | Admin | Held by the parent Powers address at spawn. | Spawn | 1 |
| 1 | Sub-org Coordinator | Manages local decisions and authorises ratification signals to parent. | Periodic election by local Members | Unlimited |
| 2 | Sub-org Member | Anonymous local participant. ZK-passport uniqueness at join. | ZK-passport check → SelfSelect | Unlimited |
| max | Public | Everyone. | Automatic | Unlimited |

---

## Governance Flows — Parent Organisation

---

### Flow 1: Member Onboarding

**Purpose:** Ensure every member is a unique real human. Membership is anonymous; uniqueness is
enforced by ZK-passport, not by any identifier visible on-chain.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `ZKPassport_Check` | Public | No | Uniqueness-only, check valid for join session |
| 2 | `SelfSelect` (Member, role 3) | Public | No | Must have completed step 1 for same action |
| 3 | `RenounceRole` (Member) | Members | No | Voluntary exit at any time |

**Rationale:** Ostrom's Design Principle 1A requires clear, locally understood membership
boundaries (Ostrom 2009, p. 422). `ZKPassport_Check` enforces that boundary without
revealing identity. Using `needFulfilled` to chain the ZK check to `SelfSelect` ensures no
one can claim membership without a valid proof. The `RenounceRole` exit path satisfies
Ostrom's microsituational cooperation variable of "exit capability" (Ostrom 2009, p. 432).

---

### Flow 2: Fund a Sub-organisation

**Purpose:** Allocate a treasury allowance from the parent's Gnosis Safe to a recognised
sub-movement. The flow ensures member oversight and coordinator accountability before funds
are committed.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `StatementOfIntent` — Propose Funding | Members | No | Open proposal, no vote required to submit |
| 2 | `StatementOfIntent` — Member Veto | Members | Yes — 20% quorum, 51% threshold, **2-day** window | Must follow step 1 (same action) |
| 3 | `StatementOfIntent` — Coordinator Approval | Parent Coordinators | Yes — 51% quorum, 51% threshold, **4-day** voting | Must follow step 1; must NOT have step 2; **3-day timelock** from proposal |
| 4 | `Safe_ExecTransaction` — Set Allowance | Parent Coordinators | No | Must have step 3; **8-day timelock** from proposal |

**Timing logic:** Veto window (days 0–2) closes before coordinator vote opens (day 3). The
executor timelock (day 8) exceeds the coordinator vote close (day 3 + 4 = day 7). Both
critical-rule requirements are satisfied.

**Rationale:** The proposer/veto/approval/execute separation implements Ostrom's separation
of proposal, deliberation, and execution roles (institutionalDesign.md §1). The member veto
satisfies Design Principle 3 (collective-choice participation by affected parties). Setting
the veto threshold at 51% of voting members — rather than 51% of all members — makes the
veto reachable without requiring the entire membership to be active (Ostrom 2009, §7C).
The coordinator approval layer introduces accountability between the broad member base and
the execution function (Podger 2020, Ch 1).

---

### Flow 3: Spawn a Sub-movement

**Purpose:** Deploy a new, fully-constituted sub-organisation from the parent's factory
contract, and register it at the parent level so it can participate in governance reform.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `StatementOfIntent` — Propose Sub-movement | Members | No | Open proposal |
| 2 | `StatementOfIntent` — Member Veto | Members | Yes — 20% quorum, 51% threshold, **5-day** window | Must follow step 1 |
| 3 | `StatementOfIntent` — Coordinator Approval | Parent Coordinators | Yes — 51% quorum, 66% threshold, **2-week** voting | Must follow step 1; must NOT have step 2; **6-day timelock** |
| 4 | `BespokeAction_Simple` → `factory.createPowers(name)` | Parent Coordinators | No | Must have step 3; **3-week timelock** |
| 5 | `BespokeAction_OnReturnValue` → `powers.assignRole(4, newChildAddress)` | Parent Coordinators | No | Must have step 4; uses return value of step 4 |

**Factory note:** A `PowersFactory` is pre-loaded with the standard sub-org constitution
template and owned by the parent Powers. Step 4 calls `createPowers(name)` which deploys
and fully constitutes the child organisation in a single on-chain call. Step 5 immediately
registers the child's address as a Recognised Sub-org (role 4) at the parent. No separate
constitution step is required.

**Rationale:** Spawning is more consequential than funding (it creates a permanent autonomous
entity), so the veto window and coordinator threshold are higher. The 3-week timelock before
spawn execution gives the full community time to react. Using `BespokeAction_OnReturnValue`
to chain spawn → registration in a single governance action avoids a window where a child
exists but is not yet recognised (Carlisle & Gruby 2019, §4.3 on redundancy and tight coupling).

---

### Flow 4: Annual Leader Election

**Purpose:** Elect up to 7 leaders annually. Candidates must be existing members (and
therefore already ZK-verified). Leaders are visible: they de-anonymise themselves as part
of standing for election.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `BespokeAction_Simple` → `electionRegistry.createElection()` | Members | No | **Throttled**: once per year (~2.3M blocks on Sepolia) |
| 2 | `ElectionRegistry_Nominate` | Members | No | Nomination open during election window |
| 3 | `ElectionRegistry_CreateVoteMandate` | Members | No | Must have step 1 (same action) |
| 4 | `ElectionRegistry_Vote` | Members | Yes — dedicated vote mandate | Voting open during vote window |
| 5 | `ElectionRegistry_Tally` | Members | No | Must have step 3; assigns Leader role (max 7 winners) |
| 6 | `BespokeAction_OnReturnValue` → `powers.revokeMandate()` | Members | No | Must have step 3; cleans up vote mandate |

**Rationale:** One-account-one-vote across the full anonymous membership maximises democratic
legitimacy. The annual cadence via `throttleExecution` prevents leadership turnover paralysis
while keeping leadership accountable (Ostrom 2009, §7B on trust through reputation transparency).
Requiring candidates to be existing members means every candidate has already passed the ZK
uniqueness check, providing Sybil resistance without a separate candidacy verification step.

---

### Flow 5: Vote of No Confidence

**Purpose:** Allow the membership to remove a specific leader before their term ends.
Deliberately set at a high threshold to prevent frivolous removal.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `StatementOfIntent` — No-Confidence Proposal | Members | Yes — 50% quorum, 66% threshold, **1-week** voting | Names specific leader address |
| 2 | `BespokeAction_Simple` → `powers.revokeRole(1, leaderAddress)` | Members | No | Must have step 1; **8-day timelock** |

**Rationale:** High quorum (50%) and supermajority (66%) make removal difficult — this is
intentional. Leaders need sufficient security to take unpopular but necessary decisions
(Podger 2020, Ch 2 on de facto autonomy). The 8-day timelock after a successful vote gives
the affected leader time to respond publicly before removal takes effect. The timelock must
exceed the 1-week voting period, satisfying the veto-timelock critical rule.

---

### Flow 6: Assign Parent Coordinator

**Purpose:** Leaders designate Parent Coordinators from community nominees to manage
day-to-day governance decisions at the parent level.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `Nominate` — Coordinator Candidacy | Members | No | Any member nominates themselves via Nominees helper |
| 2 | `BespokeAction_Advanced` → `powers.assignRole(2, nominee)` | Leaders | No | Leaders select from nominees list; no prior vote needed |
| 3 | `RenounceRole` (Parent Coordinator, role 2) | Parent Coordinators | No | Voluntary exit |

**Rationale:** Leaders hold appointment power over coordinators (separation of leadership
from coordination, Podger 2020, Ch 1). The `Nominate` step creates a transparent public
record of who is willing to serve — satisfying Ostrom's information rules — while keeping
final discretion with leaders. `RenounceRole` preserves exit capability.

---

### Flow 7: Parent Governance Reform

**Purpose:** Modify the parent organisation's governance structure. Requires both leader
consensus and ratification by a majority of recognised sub-organisations, giving sub-movements
a formal voice in how the overall movement evolves.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `StatementOfIntent` — Leaders Propose Reform | Leaders | Yes — 50% quorum, 66% threshold, **2-week** voting | — |
| 2 | `StatementOfIntent` — Sub-org Ratification | Recognised Sub-orgs (role 4) | Yes — 50% quorum, 51% threshold, **2-week** voting | Must have step 1; **3-week timelock** |
| 3 | `Adopt_Mandates` — Execute Reform | Leaders | No | Must have step 2; **8-week timelock** |

**Sub-org ratification mechanism:** Each sub-org's Powers contract address holds role 4
at the parent. Sub-org coordinators vote internally (using their own governance flow D),
then the sub-org calls `ExternalAction_Simple` targeting the parent's step-2 mandate. From
the parent's perspective, the caller is the sub-org contract (a role-4 holder), so the call
is accepted. Each recognised sub-org = one vote, regardless of local membership size.

**Rationale:** This implements Ostrom's nested enterprise principle (Design Principle 8):
governance activities are organised across multiple levels, with sub-movements having formal
standing to contest or ratify changes made at the top level (Ostrom 2009, p. 422; Ostrom
2011, p. 11 on collective-choice tier). The 8-week execution timelock for reforms is
intentionally slow — this is constitutional-tier governance, not operational governance.
The supermajority at leadership level and majority at sub-org level implement a bicameral
consent structure (Carlisle & Gruby 2019, §3.1 on multiple decision-making centres).

---

### Flow 8: Emergency Pause and Restart

**Purpose:** Leaders can instantly suspend key governance flows in an emergency and restart
them when conditions normalise. This is the sole flow without a voting period.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `PauseMandates` — Pause or Restart | Leaders | No | `bool paused`: true = suspend, false = restart |

**Config:** Pre-configured at deployment with specific flow/mandate position indices to
target. Typical targets: the funding flow executor (mandate 4 of Flow 2) and the spawn
executor (mandate 4 of Flow 3). Multiple `PauseMandates` mandates can be deployed targeting
different flows.

**Rationale:** Podger (2020, Ch 2) notes that emergency authority is legitimate when its
scope is pre-defined and its exercise is visible. `PauseMandates` satisfies both conditions:
the flow positions it can affect are fixed at deploy time (limited scope), and every
pause/restart is recorded on-chain (visible). The restart function (`bool paused = false`)
re-adopts the original mandate with its original config — no parameters can be changed
during a pause cycle, preventing emergency powers from being used to quietly modify governance.

---

## Governance Flows — Sub-organisation (template)

---

### Sub-org Flow A: Member Join

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `ZKPassport_Check` (uniqueness) | Public | No | — |
| 2 | `SelfSelect` (Sub-org Member, role 2) | Public | No | Must have step 1 |
| 3 | `RenounceRole` (Sub-org Member) | Sub-org Members | No | Voluntary exit |

---

### Sub-org Flow B: Local Spending

**Purpose:** Sub-org coordinators approve how to spend the allowance allocated by the parent.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `StatementOfIntent` — Propose Spending | Sub-org Members | No | — |
| 2 | `StatementOfIntent` — Coordinator Approval | Sub-org Coordinators | Yes — 51% quorum, 51%, **1-week** voting | Must follow step 1 |
| 3 | `SafeAllowance_Transfer` — Execute Transfer | Sub-org Coordinators | No | Must have step 2; **2-day timelock** |

---

### Sub-org Flow C: Coordinator Election

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `BespokeAction_Simple` → `electionRegistry.createElection()` | Sub-org Members | No | Throttled: once every 6 months |
| 2 | `ElectionRegistry_Nominate` | Sub-org Members | No | Nomination window |
| 3 | `ElectionRegistry_CreateVoteMandate` | Sub-org Members | No | Must have step 1 |
| 4 | `ElectionRegistry_Vote` | Sub-org Members | Yes | Vote window |
| 5 | `ElectionRegistry_Tally` | Sub-org Members | No | Must have step 3; assigns Coordinator role |
| 6 | Cleanup (`BespokeAction_OnReturnValue` → `revokeMandate`) | Sub-org Members | No | Must have step 3 |

---

### Sub-org Flow D: Ratify Parent Reform

**Purpose:** Sub-org coordinators vote internally to authorise their sub-org to cast a
ratification vote on a pending parent-level governance reform.

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `StatementOfIntent` — Coordinators Propose Ratification | Sub-org Coordinators | Yes — 51% quorum, 51%, **1-week** voting | Includes parent action ID as input |
| 2 | `ExternalAction_Simple` → parent's Sub-org Ratification mandate | Sub-org Coordinators | No | Must have step 1; **1-day timelock** |

**Note:** The calldata forwarded to the parent's ratification mandate must match the
parent's `StatementOfIntent` inputParams exactly so the action ID at the parent can be
correctly computed and linked.

---

### Sub-org Flow E: Local Governance Reform

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | `StatementOfIntent` — Propose Local Reform | Sub-org Coordinators | Yes — 51% quorum, 66%, **2-week** voting | — |
| 2 | `Adopt_Mandates` — Execute Reform | Sub-org Coordinators | No | Must have step 1; **3-week timelock** |

---

## Checks and Balances

| Mechanism | How it works | Who holds it |
|-----------|-------------|--------------|
| ZK-passport gate | Every new member (parent or sub-org) must prove uniqueness via ZK-passport before self-selecting | Protocol-enforced |
| Member veto on funding | Members can block any proposed funding within 2 days of proposal | Members (role 3) |
| Member veto on spawning | Members can block any new sub-movement within 5 days of proposal | Members (role 3) |
| Coordinator approval layer | Coordinators must affirmatively approve before any treasury action executes | Parent Coordinators (role 2) |
| Sub-org ratification of reform | 50%+ of recognised sub-orgs must ratify before parent governance can change | Recognised Sub-orgs (role 4) |
| Vote of no confidence | High-threshold member vote can remove any individual leader | Members (role 3) |
| Emergency pause | Leaders can suspend specific execution mandates instantly | Leaders (role 1) |
| Timelocks on all execution | No treasury or structural action executes immediately; minimum wait enforced | Protocol-enforced |
| Annual leadership turnover | Elections every year with mandatory open nominations | Protocol-enforced via throttleExecution |
| Leader cap (max 7) | Prevents single-point capture of leadership | Protocol-enforced |

**Security considerations:**
- The parent's admin role (role 0) is held by the initial deployer and has no ongoing
  governance mandates assigned after setup. It should be transferred to the parent Powers
  contract itself (via `setTreasury`) during initialisation to eliminate residual admin power.
- Sub-org coordinators have significant spending discretion locally. The parent's allowance
  mechanism (rather than direct treasury access) contains the blast radius of coordinator
  misbehaviour.
- The `PauseMandates` power assigned to leaders is scoped to specific flow positions at
  deploy time. It cannot be used to pause the leader election or the vote of no confidence.

---

## External Dependencies

| System | Purpose | Required? |
|--------|---------|----------|
| Gnosis Safe (parent) | Main treasury for the parent organisation | Yes |
| Safe Allowance Module | Distributes per-sub-org spending allowances | Yes |
| ZKPassport registry | On-chain registry for ZK-passport uniqueness proofs | Yes |
| PowersFactory + PowersDeployer | Spawns fully-constituted sub-org instances | Yes |
| ElectionRegistry (×2) | Manages leader election (parent) and coordinator elections (sub-orgs) | Yes |
| Nominees contract (parent) | Stores coordinator candidacy nominations | Yes |
| Nominees contract (per sub-org) | Stores coordinator candidacy nominations per sub-org | Yes (in sub-org template) |

---

## Design Rationale

This structure is a **federated polycentric governance system** in the sense of Carlisle &
Gruby (2019): multiple overlapping decision-making centres (parent, sub-orgs, members,
leaders, coordinators) each with genuine de facto autonomy and formal interdependence
through `needFulfilled` dependency chains.

The parent–sub-org relationship follows Ostrom's nested enterprise principle (Design
Principle 8): governance activities are structured across two tiers, with the parent
governing financial allocation and structural reform while sub-orgs govern their own action
and spending. Neither tier can unilaterally override the other in ordinary operation — the
parent must go through the spawn flow to create sub-orgs; sub-orgs must go through Flow D
to participate in parent reform.

The three-tier IAD model (Ostrom 2011, p. 11) is present at both levels:
- **Operational tier**: spending, local action, coordinator assignment
- **Collective-choice tier**: governance reform, sub-org spawning, leader election  
- **Constitutional tier**: the factory-baked sub-org template (can only be changed via a
  new factory deployment, itself requiring parent governance reform)

The deliberate speed asymmetry — funding in days, spawning in weeks, parent reform in months
— reflects Podger's (2020, Ch 1) principle that governance structures should match the
urgency profile of the decisions they govern.

Anonymity is protected structurally rather than procedurally: ZK-passport uniqueness is
enforced at the chain level, but no identity information is stored. On-chain vote records
create reputation transparency (Ostrom 2011, p. 16) without exposing identity.

---

## Limitations

- **Sub-org template is fixed at factory deploy time.** The factory's stored constitution
  cannot be changed after deployment without a new factory deployment. To change the
  template for future sub-orgs, a parent governance reform must deploy and configure a new
  factory. Existing sub-orgs are unaffected.

- **Sub-org ratification is one-sub-org-one-vote.** A sub-org with 100 members has the same
  ratification weight as one with 10. This is intentional (protecting smaller sub-movements
  from being outvoted by larger ones) but means the reform approval threshold does not
  reflect the aggregate membership.

- **Leader visibility is a social constraint, not a protocol constraint.** The protocol
  does not enforce that leader accounts are linked to real identities — this relies on the
  movement's social norms and the ZK-passport uniqueness check (which prevents leaders from
  holding multiple accounts, but does not reveal identity on-chain).

- **`PauseMandates` scope is fixed at deploy time.** The emergency pause targets specific
  flow positions. If new execution mandates are added via governance reform, they are not
  automatically within scope of the existing pause mandate — a new `PauseMandates` mandate
  covering the new positions must be adopted.

---

## Implementation Notes

> This section is for the developer implementing the deploy script.

- **Deploy script:** `solidity/governance/claude/global-environmental-movement/Deploy.s.sol`
- **Actions script:** `solidity/governance/claude/global-environmental-movement/Actions.s.sol`
- **Runners script:** `solidity/governance/claude/global-environmental-movement/Runners.s.sol`
- **Test file:** `solidity/governance/claude/global-environmental-movement/Test.t.sol`
- **Mandate version:** MAJOR=0, MINOR=1, PATCH=7
- **Mandate nameDescription strings must match exactly across all four files.**
- Deploy order: parent Powers → factory (with sub-org template pre-loaded) → transfer factory
  ownership to parent → constitute parent → close constitute → transfer Nominees ownership to parent.
- The ElectionRegistry instances (one for leader elections, one per sub-org template) must
  be deployed before constitution and their ownership transferred to the respective Powers
  instance after `closeConstitute`.
- The parent Safe must be deployed independently and the parent Powers must be added as a Safe
  owner with the Allowance Module enabled before any treasury flows can execute.
