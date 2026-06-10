# Ostrom 2011 — Background on the IAD Framework

**Citation:** Ostrom, Elinor. 2011. "Background on the Institutional Analysis and Development
Framework." *Policy Studies Journal* 39(1): 7–27.
**Analytical level:** Structural + Parametric
**Most relevant design decisions:** Q1, Q3, Q4, Q5, Q7

---

## Q1 — Role Structure

p. 8: Frameworks, theories, and models are nested levels of analysis. The IAD *framework*
is the most general — it identifies the elements that any institutional arrangement must
address. In Powers: the mandate catalogue is the framework; a specific constitution is a
model derived from it. This nesting means that framework-level concepts (positions, actions,
outcomes) apply universally, even when the specific mandates differ across constitutions.

p. 10 (Figure 2): The core action-situation structure is: Actors → assigned to → Positions →
assigned to → Actions → linked to → Potential Outcomes. Powers replicates this exactly:
accounts hold roles (positions), roles grant access to mandates (actions), mandates produce
governance state changes (outcomes). A role without mandates is a position with no actions —
it participates formally but cannot affect outcomes. Check that every role in a constitution
has at least one mandate that generates an outcome with governance significance.

p. 11: The action situation has three tiers: operational (actors take actions within existing
rules), collective-choice (actors modify the rules that govern operational actions), and
constitutional (actors determine who can make collective-choice decisions). In Powers:
- Operational tier: `BespokeAction_Simple`, `PresetActions`, `OpenAction` — executing
  governance decisions.
- Collective-choice tier: `Adopt_Mandates`, `Revoke_Mandates`, `PauseMandates` — modifying
  which mandates are active.
- Constitutional tier: `MandatePackage` — replacing the governance structure wholesale.

A constitution that only specifies operational mandates and leaves no mechanism for
collective-choice modification is frozen at the operational tier. A constitution that only
specifies reform mandates with no execution mandates has no operational capacity.

p. 18: "Rules are shared understandings among those involved that refer to enforced
prescriptions about what actions are required, prohibited, or permitted." In Powers: mandates
are enforced on-chain — there is no gap between the rule and its enforcement. This structural
advantage should be surfaced explicitly to designers: unlike conventional governance, rules-
in-form and rules-in-use are identical in a correctly deployed Powers constitution.

---

## Q3 — Mandate Selection

p. 9 (Figure 1): The IAD framework maps External Variables (biophysical conditions,
community attributes, rules-in-use) → Action Situations → Interactions → Outcomes. In
Powers: biophysical conditions = the on-chain environment (token type, external contracts,
oracle availability); community attributes = the role composition and membership size;
rules-in-use = the active mandate set. Mandate selection must account for all three external
variable categories, not just the formal governance logic.

p. 10 (Figure 2, four goods types, referenced from E. Ostrom 2005: 24): The four-type goods
taxonomy determines which governance structure is appropriate:
- **Private goods** (high excludability, high subtractability): minimal governance; `PresetActions`
  with narrow `allowedRole` and tight `target` scope.
- **Toll/club goods** (high excludability, low subtractability): club governance; `PeerSelect`
  for membership, `BespokeAction_Simple` for provision decisions.
- **Public goods** (low excludability, low subtractability): collective provision; broad
  `SelfSelect` + `StatementOfIntent` deliberation.
- **Common-pool resources** (low excludability, high subtractability): boundary rules +
  graduated sanctions; `PeerSelect`/`SelfSelect` + graduated accountability chain
  (`StatementOfIntent` → `PauseMandates` → `RevokeAccountsRoleId`).

p. 11: Collective-choice problems require that "decision makers repeatedly have to make
policy decisions within the constraints of a set of collective-choice rules." In Powers: any
governance domain where the right answer is contested requires a deliberation step
(`StatementOfIntent` with `votingPeriod > 0`) before execution. Direct `BespokeAction_Simple`
without deliberation is appropriate only for well-defined, uncontested operational tasks.

---

## Q4 — Dependency Chains

p. 15: "When a 'boss' says to an 'employee,' 'How about changing the way we do X?' and they
jointly agree upon a better way, they have shifted from taking actions within previously
established rules to making decisions about the rules structuring future actions — they have
shifted to a collective-choice situation." In Powers: the `needFulfilled` dependency between
an execution mandate and a reform mandate is the on-chain implementation of this tier shift.
The dependency chain must cross tiers deliberately: an operational mandate triggering a
collective-choice mandate signals that the system is escalating from execution to rule-
modification.

p. 19: Seven types of working rules affect the seven elements of an action situation:
- **Boundary rules** → membership (`SelfSelect`/`PeerSelect`/`RevokeAccountsRoleId`)
- **Position rules** → role assignment (which roles exist and how they are held)
- **Scope rules** → `target` and `value` limits on mandates
- **Choice rules** → which mandate types are available to which roles
- **Aggregation rules** → voting thresholds and quorum (`votingPeriod` length, majority type)
- **Information rules** → what on-chain data is visible (`StatementOfIntent` vote records)
- **Payoff rules** → cost/benefit structure of participation incentives

"The set of working rules is a configuration in the sense that the effect of a change in one
rule may depend upon the other rules-in-use." In Powers: changing `allowedRole` on a mandate
(boundary rule) may require adjusting `votingPeriod` (aggregation rule) — a smaller eligible
population may need a shorter voting period to achieve quorum. Rule changes should be reviewed
for cross-type effects, not treated as independent parameter adjustments.

p. 20: "Aggregation rules affect the level of control that a participant in a position
exercises in the selection of an action at a node." The aggregation rule is the voting rule:
majority, supermajority, or unanimity. In Powers: `votingPeriod` length is the primary
aggregation parameter. Unanimity-approximating rules require longer periods; simple majority
rules can use shorter periods. Choose `votingPeriod` in relation to the expected active role
membership size, not in absolute terms.

---

## Q5 — Membership Design

p. 19: "Boundary rules affect the number of participants, their attributes and resources,
whether they can enter freely, and the conditions they face for leaving." In Powers:
- Free entry → `SelfSelect`
- Conditional entry → `PeerSelect` (existing members approve)
- Exit conditions → `RevokeAccountsRoleId` governed by which role and under which conditions

The boundary rule choice is not one decision but three: entry mechanism, eligibility criteria,
and exit mechanism. All three must be designed explicitly. A constitution with `SelfSelect`
(free entry) and no exit mechanism has no mechanism to remove members who violate governance
norms — it is open on both ends.

p. 21 (boundary rule examples): "Are appropriators from this resource limited to local
residents? To one group defined by ethnicity, race, caste, gender, or family structure? To
those who win a lottery? To those who have obtained a permit?" In Powers: the `allowedRole`
parameter is the equivalent of these boundary conditions. The design question is not just
"who is `allowedRole`?" but "why is the boundary drawn here, and what happens when someone
is on the wrong side of it?"

p. 18: "Rules-in-use may evolve over time as those involved in one action situation interact
with others or self-consciously change the rules in a collective-choice or constitutional
setting." In Powers, on-chain mandates are the rules-in-form. They can only evolve via
`Adopt_Mandates` or `Revoke_Mandates`. This means informal membership conventions (e.g.,
"we only accept members who have contributed X") cannot drift into the constitution
automatically — they must be formally codified via a collective-choice mandate.

---

## Q7 — Accountability

p. 16: Six evaluative criteria for governance outcomes: (i) economic efficiency,
(ii) fiscal equivalence, (iii) redistributional equity, (iv) accountability, (v) conformance
to values of local actors, and (vi) sustainability. Powers' on-chain record addresses
accountability (iv) automatically — every vote and execution is permanently attributable.
Fiscal equivalence (ii, those who benefit bear the cost) and redistribution (iii) must be
addressed explicitly through the design of execution mandates and role incentives.

p. 16 *Accountability*: "Officials should be accountable to citizens concerning the
development and use of public facilities and natural resources." In Powers: `StatementOfIntent`
with per-account vote tracking is the on-chain implementation. Mandates that aggregate votes
without tracking individual positions implement accountability without attribution — they
satisfy (iv) formally but not substantively.

p. 16 *Conformance to Values*: "Are those who keep promises more likely to be rewarded and
advanced in their careers? How do those who repeatedly interact within a set of institutional
arrangements learn to relate to one another over the long term?" In Powers: the permanent
on-chain vote record is the reputation mechanism. Designs that hide individual votes (e.g.,
commit-reveal schemes) sacrifice conformance-to-values accountability for anonymity —
this is a deliberate design trade-off, not a free choice.

p. 16 *Sustainability*: "Unless institutional arrangements are able to respond to ever-
changing environments, the sustainability of situations is likely to suffer." In Powers: the
presence of `Adopt_Mandates` in the active mandate set is the structural precondition for
sustainability. A constitution without reform mandates cannot respond to changing environments
and will become unsustainable as conditions diverge from the founding assumptions.

---

## What to skip

The Social-Ecological Systems (SES) framework discussion (pp. 22–23, Figure 4) is relevant
for resource governance field studies but does not map directly to mandate parameters. The
10 SES variables identified across field studies are empirical research variables, not
design parameters. Future Challenges (pp. 23–24) is a research agenda; it is not actionable
for mandate design. The discussion of bounded rationality and fallible learners (pp. 12–14)
is background for understanding actor behaviour but does not produce specific mandate
configuration rules.

---

## Mandate implications

- The three-tier IAD structure (operational / collective-choice / constitutional) provides a
  completeness check for any Powers constitution: confirm mandates exist at all three tiers,
  or explicitly document why a tier is absent and what the implication is.
- The seven rule types (boundary, position, scope, choice, aggregation, information, payoff)
  provide a second completeness check: for each rule type, identify which mandate or parameter
  addresses it. Missing rule types are governance gaps.
- Changing the `allowedRole` (boundary rule) of a mandate may require adjusting `votingPeriod`
  (aggregation rule) — rule types interact. Review cross-type effects whenever a mandate
  parameter is changed.
- "Rules-in-form = rules-in-use" is a structural advantage of Powers over conventional
  governance. Surface this explicitly when presenting a constitution to designers unfamiliar
  with on-chain governance.
- `StatementOfIntent` with per-account vote tracking is the Powers implementation of both
  accountability and conformance-to-values criteria. Mandates that aggregate without individual
  attribution satisfy accountability formally but not substantively.
