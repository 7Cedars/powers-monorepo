# Ostrom 2009 — Beyond Markets and States

**Citation:** Ostrom, Elinor. 2010. "Beyond Markets and States: Polycentric Governance of
Complex Economic Systems." Nobel Prize Lecture, December 8, 2009. *American Economic Review*
100(3): 641–672.
**Analytical level:** Structural + Dynamic
**Most relevant design decisions:** Q1, Q2, Q3, Q5, Q6, Q7

---

## Q1 — Role Structure

Section 2A (pp. 410–411): V. Ostrom, Tiebout, and Warren (1961: 831–32) define polycentric
systems: "many centers of decision making that are formally independent of each other. Whether
they actually function independently, or instead constitute an interdependent system of
relations, is an empirical question." In Powers: formal independence is established by assigning
different mandate sets to different roles; functional interdependence is established by
`needFulfilled` chains between those mandates. A governance structure is polycentric in Powers
only if both conditions hold — roles with different labels but identical mandate access are not
genuinely independent.

Section 2A (pp. 411–412): Empirical studies of polycentric police industries found three
productivity mechanisms: (1) small- to medium-sized units outperform large ones in monitoring
performance; (2) dissatisfied actors can "vote with their feet" and move to better-fitting
arrangements; (3) local units can contract with larger producers if unsatisfied with services.
In Powers: (1) → specialised roles with narrower `allowedRole` membership are better
positioned for accountability than one large role; (2) → `SelfSelect` exit mechanisms
preserve the credible exit option; (3) → `BespokeAction_Simple` mandates calling external
contracts implement the contracting-out mechanism.

Section 1 (pp. 408–410): The mid-twentieth-century dichotomy — "the market" or "the state"
— produced a false two-option framework. Designers who frame governance choices as "admin
control vs. no control" replicate this error. The Powers mandate catalogue provides a third
space: self-organised, rule-based governance that is neither fully hierarchical nor fully
open-access.

---

## Q2 — Voting Parameters

Section 7C (p. 432): Six microsituational variables that empirically increase cooperation
in common-pool resource dilemmas:
1. **Communication feasible** — face-to-face interaction increases cooperation. In Powers:
   `StatementOfIntent` with `votingPeriod > 0` creates the structured communication channel.
   Setting `votingPeriod = 0` eliminates it.
2. **Reputations known** — knowledge of past behaviour increases cooperation. In Powers:
   the on-chain vote record makes all participants' histories permanently visible. This
   microsituational variable is automatically present in any mandate with a vote record.
3. **High marginal per capita return (MPCR)** — when individual contributions make a visible
   difference, cooperation increases. In Powers: smaller `allowedRole` memberships increase
   each member's marginal weight in governance — this is an argument for specialised roles
   over monolithic member roles for high-stakes decisions.
4. **Entry or exit capabilities** — the ability to leave if cooperation is not reciprocated.
   In Powers: `SelfSelect` (exit without permission) is the exit capability; constitutions
   that require `PeerSelect` for exit effectively trap members.
5. **Longer time horizon** — participants cooperate more when they expect repeated interaction.
   In Powers: longer `votingPeriod` on high-stakes mandates provides the extended interaction
   window that increases the incentive to participate and invest in outcomes.
6. **Agreed-upon sanctioning** — when participants themselves design the sanction system,
   cooperation increases and sanctions need not be used at high frequency. In Powers:
   graduated accountability chains (`StatementOfIntent` → `PauseMandates` → 
   `RevokeAccountsRoleId`) are participant-designed; externally imposed binary revocation
   without deliberation is the "externally imposed" alternative, which experiments show
   crowding out voluntary cooperation.

Section 5 (pp. 423–425): Communication experiments demonstrate that "cheap talk" — discussion
without external enforcement — significantly increases cooperation. Subjects who communicated
face-to-face and chose their own sanctioning system achieved 90 percent of optimal returns.
In Powers: `StatementOfIntent` mandates implement cheap talk on-chain. They are not
"mere signalling" — they are a governance mechanism with demonstrated empirical effect.

---

## Q3 — Mandate Selection

Section 2B (pp. 411–412): Four types of goods, each requiring a different governance
structure (V. Ostrom and E. Ostrom 1977; Figure 1):

| Good type | Excludability | Subtractability | Powers mandate pattern |
|---|---|---|---|
| Private | High | High | `PresetActions` with narrow `target` + tight `value` |
| Toll/Club | High | Low | `PeerSelect` membership + `BespokeAction_Simple` for provision |
| Public | Low | Low | Broad `SelfSelect` + `StatementOfIntent` deliberation |
| Common-pool resource | Low | High | `PeerSelect`/`SelfSelect` + graduated accountability chain |

Apply this taxonomy before selecting mandate types. Misidentifying the good type produces
systematic mandate mismatches: applying CPR governance (exclusion + sanctions) to a public
goods DAO creates unnecessary friction; applying public-goods governance (open + deliberative)
to a CPR DAO produces open-access overuse.

Section 4E (pp. 421–422): The design principles emerged from studying long-surviving CPR
institutions and finding structural regularities — not specific rules. "I struggled to find
rules that worked across ecological, social, and economic environments, but the specific
rules associated with success or failure varied extensively across sites." The implication:
no mandate template guarantees success. The design principles are conditions, not
configurations. Use them as a review checklist, not as a prescriptive mandate list.

Section 8 (p. 435): "All too often a single policy prescription — such as Individual
Transferable Quotas — is recommended for all resources of a particular type." The
one-size-fits-all warning applies directly to mandate package selection: do not apply a
single constitution template to all DAOs of a similar sector without adjusting `allowedRole`,
`votingPeriod`, and mandate type to the specific community and resource context.

---

## Q5 — Membership Design

Section 4E (p. 422, Design Principles 1A and 1B): The two boundary design principles:
- **1A User Boundaries**: "Clear and locally understood boundaries between legitimate users
  and nonusers." In Powers: the `allowedRole` parameter on each mandate. The boundary must
  be understood (not just encoded) — if role members do not know which mandates they can use,
  the formal boundary is not locally understood.
- **1B Resource Boundaries**: "Clear boundaries that separate a specific common-pool resource
  from a larger social-ecological system." In Powers: the `target` address and `value` limits
  on execution mandates. A mandate with broad `allowedRole` but no `target` restriction has
  user boundaries (1A) without resource boundaries (1B) — only half of the first design
  principle is satisfied.

Section 4D (p. 421): All self-organised CPR systems in the meta-analysis created: (i) boundary
rules determining who could use the resource, (ii) choice rules governing the flow of resource
units, and (iii) active monitoring and local sanctioning. In Powers: all three layers must be
present — (i) `SelfSelect`/`PeerSelect` for boundary, (ii) `PresetActions`/`BespokeAction_Simple`
for choice constraints, (iii) `StatementOfIntent` + `RevokeAccountsRoleId` chain for monitoring
and sanctioning. A constitution missing any layer is structurally incomplete against the
empirical evidence.

Section 4D (p. 421): No self-organised CPR institution used the "grim trigger" strategy
(permanent exclusion on first violation) as a sanctioning mechanism, even though game theory
posited this as the rational enforcement strategy. In Powers: binary `RevokeAccountsRoleId`
as the only accountability tool is the on-chain grim trigger. Ostrom's evidence supports
replacing or supplementing it with graduated chains.

---

## Q6 — Adaptive Capacity

Section 4E (p. 422, Design Principle 3): "Collective-Choice Arrangements: Most individuals
affected by a resource regime are authorized to participate in making and modifying its rules."
This is an empirically validated design principle — constitutions where only admins can modify
mandates violate Principle 3. `Adopt_Mandates` must include the affected role (typically the
broadest member role), not be restricted to admin.

Section 4E (p. 422, Design Principle 8): "Nested Enterprises: When a common-pool resource
is closely connected to a larger social-ecological system, governance activities are organized
in multiple nested layers." In Powers: the nested enterprise principle is the justification
for tiered role structures (base member → representative → steward → admin), with each tier
governing the tier below through mandates that require `needFulfilled` from the lower tier.
Single-tier constitutions lack the nesting required for robust polycentric governance.

Section 8 (pp. 435–436): "How diverse polycentric institutions help or hinder the
innovativeness, learning, adapting, trustworthiness, levels of cooperation of participants,
and the achievement of more effective, equitable, and sustainable outcomes at multiple scales."
The goal of governance design is not to prevent all defection but to enable the system to
learn and adapt. Reform mandates (`Adopt_Mandates`, `MandatePackage`) are the mechanism for
institutional learning. Design them to be usable, not just available.

---

## Q7 — Accountability

Section 4E (p. 422, Design Principles 4A, 4B, 5, 6):
- **4A Monitoring Users**: "Individuals who are accountable to or are the users monitor the
  appropriation and provision levels of the users." In Powers: `StatementOfIntent` with
  per-account vote tracking. The monitor must be accountable to the monitored group — admin-
  only monitoring without user oversight violates 4A.
- **4B Monitoring Resource**: "Individuals who are accountable to or are the users monitor the
  condition of the resource." In Powers: oracle integration via `AsyncMandate` or external
  data feeds. Governance systems managing shared assets should monitor the asset state, not
  only the governance actions.
- **5 Graduated Sanctions**: "Sanctions for rule violations start very low but become stronger
  if a user repeatedly violates a rule." In Powers: `StatementOfIntent` (public censure) →
  `PauseMandates` (restrict access) → `RevokeAccountsRoleId` (remove role). The graduation
  is a design requirement, not a nicety — constitutions with only binary revocation violate
  this principle.
- **6 Conflict-Resolution**: "Rapid, low-cost, local arenas exist for resolving conflicts."
  In Powers: conflict-resolution mandates must have shorter `votingPeriod` than standard
  execution mandates. Slow conflict resolution mechanisms fail the "rapid" criterion even
  if they are technically present.

Section 7B (p. 431): "Trust is the central mechanism to enhance transactional outcomes."
The on-chain vote record builds trust by making all participants' histories permanently
observable. This is a structural governance advantage of Powers: trust-building through
reputation transparency is automatic rather than requiring off-chain coordination.

Section 4D (p. 418): In the meta-analysis of CPR institutions, "rule conformance was a key
variable affecting the adequacy of water over time." In Powers: vote conformance (whether
role holders participate in mandates they are required to participate in) is the analogue.
Mandates with `votingPeriod > 0` but no minimum participation requirement may have low
conformance even when formally functional.

---

## What to skip

Sections 5 and 6 (pp. 423–428) on laboratory and field experiments provide empirical support
for the design principles but add no actionable design guidance beyond what the principles
themselves provide. The mathematical CPR extraction model (pp. 423–424) is not applicable
to mandate parameter selection. Section 7A (pp. 429–430) on developing a more general theory
of the individual is theoretical background; it does not produce specific mandate design
rules. The bibliographic references (pp. 436–444) are not substantive content.

---

## Mandate implications

- **Design Principle 1A+1B**: Every mandate must specify both user boundaries (`allowedRole`)
  and resource boundaries (`target` + `value`). A mandate specifying only one boundary type
  is structurally incomplete against Ostrom's first design principle.
- **Design Principle 3**: `Adopt_Mandates` must include the affected role, not only admin.
  This is one of Ostrom's eight empirically-validated design principles — its violation is
  associated with institutional failure.
- **Design Principle 5**: Replace binary `RevokeAccountsRoleId` with a graduated chain:
  `StatementOfIntent` (censure) → `PauseMandates` → `RevokeAccountsRoleId`. The grim trigger
  was never found in long-surviving CPR institutions.
- **Design Principle 6**: Conflict-resolution mandates must have shorter `votingPeriod` than
  execution mandates. Set conflict-resolution `votingPeriod` in proportion to the urgency
  of the conflicts the system is likely to face, not to administrative convenience.
- **Design Principle 8**: Use tiered role structures (`allowedRole` layers) with each tier
  governing the tier below via `needFulfilled` dependency chains. Single-tier constitutions
  lack the nested enterprise structure associated with long-term robustness.
- The goods taxonomy (Section 2B) provides the mandate selection entry point: identify the
  good type first, then select the mandate pattern from the table above. Do not select mandate
  types without first establishing what governance problem is being addressed.
- The six microsituational cooperation variables (Section 7C) provide a `votingPeriod` and
  role-size design checklist: confirm that the design enables communication, preserves
  reputation visibility, maintains high marginal per-capita weight, allows exit, provides
  a long enough time horizon, and includes participant-designed sanctions.
