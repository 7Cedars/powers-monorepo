# Reference Reading Guide — Powers Protocol Governance Design

This file is the index layer. Use it to decide which source to consult for a given design
question. Each entry summarises what a source contributes and which design decisions it covers
most directly. Full guides are in the individual source files listed below.

---

## Source files

| File | Citation | Analytical level |
|---|---|---|
| [`podger_2020.md`](podger_2020.md) | Podger, Su, Wanna & Chan (eds.), 2020. *Designing Governance Structures for Performance and Accountability.* ANU Press. | Structural + Parametric |
| [`carlisle_gruby_2019.md`](carlisle_gruby_2019.md) | Carlisle & Gruby, 2019. "Polycentric Systems of Governance: A Theoretical Model for the Commons." *Policy Studies Journal* 47(4): 927–952. | Structural + Dynamic |
| [`hynes_oecd_2020.md`](hynes_oecd_2020.md) | Hynes, Lees & Müller (eds.), 2020. *Systemic Thinking for Policy Making.* OECD/IIASA. | Dynamic |
| [`ostrom_2009.md`](ostrom_2009.md) | Ostrom, Elinor. 2010. "Beyond Markets and States: Polycentric Governance of Complex Economic Systems." Nobel Prize Lecture, Dec 8, 2009. *American Economic Review* 100(3): 641–672. | Structural + Dynamic |
| [`ostrom_2011.md`](ostrom_2011.md) | Ostrom, Elinor. 2011. "Background on the Institutional Analysis and Development Framework." *Policy Studies Journal* 39(1): 7–27. | Structural + Parametric |

---

## Which source to read for which design question

### Q1 — Role structure and separation of powers

**Primary:** `podger_2020.md`
The book provides the most actionable typology for role design: a spectrum from high-political-
control (departments) to high-independence (judicial bodies), with each point on the spectrum
mapping to specific mandate type and appointment mechanism choices. Use it when the core question
is "how much autonomy should this role have, and what mandate type follows from that?"

**Secondary:** `carlisle_gruby_2019.md`
Adds the de facto vs. formal autonomy test: after drafting roles, use this source to verify that
roles with different labels genuinely have different authority scopes and mandate sets, not just
different names.

**Tertiary:** `ostrom_2011.md`
Adds the three-tier IAD structure (operational / collective-choice / constitutional) as a
completeness check: confirm that mandates exist at all three tiers and that the seven rule
types (boundary, position, scope, choice, aggregation, information, payoff) are each addressed
by at least one mandate or parameter. Use it when auditing a completed constitution for gaps.

**Tertiary:** `ostrom_2009.md`
Adds the polycentric independence test: formal independence (different labels) + functional
interdependence (`needFulfilled` chains) must both be present for a structure to be genuinely
polycentric. Also provides the three-mechanism framework for why smaller, specialised roles
outperform large monolithic ones. Use it when choosing between a single broad role and
multiple specialised roles.

---

### Q2 — Voting parameters

**Primary:** `ostrom_2009.md`
The six microsituational cooperation variables (Section 7C) are the most directly actionable
source on voting design: communication channel (`votingPeriod > 0`), reputation visibility
(on-chain record), marginal per-capita return (role size), exit capability (`SelfSelect`),
time horizon (`votingPeriod` length), and agreed sanctioning (graduated chain design). Use it
when calibrating `votingPeriod` and when choosing between small specialised roles and large
member roles for high-stakes decisions.

**Secondary:** `ostrom_2011.md`
Adds the aggregation rule framework: majority, supermajority, and unanimity rules should be
calibrated to the expected active membership size, not set as absolute values. Also introduces
the cross-type interaction: changing `allowedRole` (boundary rule) may require adjusting
`votingPeriod` (aggregation rule). Use it when a role membership change prompts a review of
voting parameters.

---

### Q3 — Mandate selection

**Primary:** `carlisle_gruby_2019.md`
The institutional fit framework (Section 4.2) is the most directly applicable tool: it frames
mandate selection as a matching problem between the governance institution and the problem it
addresses. Use it when deciding between mandate types for a specific governance function.

**Secondary:** `podger_2020.md`
Adds the coherence principle: similar functions should use similar mandate types. Use it to check
that the mandate selection across roles is internally consistent.

**Tertiary:** `hynes_oecd_2020.md`
Adds the systemic perspective: mandates for contested or multi-stakeholder domains should include
a `StatementOfIntent` deliberation step; constitutions without reform mandates are structurally
incomplete. Use it when the organisation's governance domain is complex or contested.

**Tertiary:** `ostrom_2009.md`
Adds the four-type goods taxonomy (private / toll-club / public / common-pool resource) as the
mandate selection entry point: identify the good type first, then select the mandate pattern
from the table in `ostrom_2009.md`. Use it when the organisation type is ambiguous or when
the designer is applying a template without checking whether it matches the resource type.

**Tertiary:** `ostrom_2011.md`
Adds the three-tier IAD match: operational mandates for execution, collective-choice mandates
for rule modification, constitutional mandates for wholesale restructuring. Use it to confirm
that the mandate type selected matches the decision tier being addressed.

---

### Q4 — Dependency chains

**Primary:** `hynes_oecd_2020.md`
The cascading failure analysis (Ch 12) is the most specific source on dependency chain risks.
Use it when designing `needFulfilled` chains: it provides the fault-tolerance constraint (max 3
sequential dependencies) and the fat-tailed risk argument for robust emergency paths.

**Secondary:** `carlisle_gruby_2019.md`
Adds the conflict resolution dimension: dependency chains that create winner-take-all competition
need a deliberation step. Also provides the "rapid access" argument for keeping conflict
resolution mandates short in `votingPeriod`.

---

### Q5 — Membership design

**Primary:** `podger_2020.md`
The most detailed treatment of the formal vs. actual membership distinction. Use it when designing
the combination of open entry (`SelfSelect`) and gatekeeping (`PeerSelect`, `RevokeAccountsRoleId`)
— the key insight is that both layers must be designed, not just the formal rule.

**Secondary:** `carlisle_gruby_2019.md`
Adds the bootstrapping problem (Section 4.1.2): pure `PeerSelect` constitutions can stall if no
seed members exist. Also adds the homophily warning: informal networks without on-chain
deliberation records reduce membership diversity over time.

**Tertiary:** `ostrom_2009.md`
Adds the dual boundary requirement (Design Principles 1A + 1B): user boundaries (`allowedRole`)
and resource boundaries (`target` + `value` limits) must both be designed. A mandate specifying
only one is structurally incomplete. Also provides empirical evidence that no self-organised
institution in the meta-analysis used binary revocation (grim trigger) as its only enforcement
mechanism — use it to justify graduated accountability chains.

**Tertiary:** `ostrom_2011.md`
Adds the three-component boundary design (entry mechanism, eligibility criteria, exit
mechanism) and the rules-in-form vs. rules-in-use gap: informal membership conventions cannot
drift into on-chain constitutions automatically — they must be formally codified via
`Adopt_Mandates`. Use it when auditing whether informal membership practices match the formal
mandate rules.

---

### Q6 — Adaptive capacity and reform

**Primary:** `carlisle_gruby_2019.md`
Provides the clearest conceptual distinction between process-level adaptation (`Adopt_Mandates`)
and structural adaptation (`MandatePackage`). Use it when deciding which reform mandate type
fits the scope of the intended change.

**Secondary:** `hynes_oecd_2020.md`
Adds the institutional argument: good governance must be built into the mandate structure, not
depend on individuals. Provides the IRGC 7-step completeness check — does the constitution cover
monitoring and adaptation (step 7), or only execution (steps 1–6)?

**Tertiary:** `ostrom_2009.md`
Adds empirically validated design principles for adaptive capacity: Design Principle 3
(collective-choice arrangements must include affected roles, not only admin) and Principle 8
(nested enterprises for polycentric resilience). Use it when justifying why `Adopt_Mandates`
must be accessible to member roles, not restricted to admin.

**Gap:** `may_2022.md` is expected to be the strongest source for this question but is currently
unreadable. Replacing that file is the highest-priority scholarship gap.

---

### Q7 — Accountability and monitoring

**Primary:** `hynes_oecd_2020.md`
On-chain attributable accountability is framed here as a structural advantage of Powers vs.
conventional governance — every vote and execution is permanently associated with a specific
account. Use it to argue for broad `allowedRole` on accountability mandates and against
collective-responsibility structures without individual attribution.

**Secondary:** `podger_2020.md`
Adds the upward vs. outward accountability distinction and the graduated vs. binary enforcement
distinction (signal → warn → revoke). Use it when designing the accountability chain for
integrity or veto roles.

**Tertiary:** `carlisle_gruby_2019.md`
Adds the diffuse-accountability warning: shared mandates between multiple roles create shared
(and therefore weakened) accountability. Use it when two roles have overlapping mandate authority.

**Tertiary:** `ostrom_2009.md`
Adds the four empirically validated accountability design principles (4A monitoring users,
4B monitoring resource, 5 graduated sanctions, 6 conflict resolution). These are the most
directly specified accountability requirements in the library — sourced from meta-analysis of
institutions that survived long-term. Use it when designing or reviewing the accountability
chain for any execution or role-assignment mandate.

**Tertiary:** `ostrom_2011.md`
Adds the six evaluative criteria (efficiency, fiscal equivalence, redistribution, accountability,
conformance to values, sustainability) as a post-design review checklist. Also distinguishes
between accountability (attributable, on-chain) and conformance to values (reputation-building
over time). Use it when the designer asks "how do we know the governance is working?"

---

## Cross-cutting design rules supported by all three sources

These rules appear independently in all three readable sources and can be treated as
well-grounded design constraints:

1. **Formal ≠ de facto independence.** A role's actual independence is determined by its
   appointment and revocation mechanisms, not only its execution mandate. (Podger Ch 2,
   Carlisle Section 3.1, OECD Ch 13)

2. **Reform mandates are first-class.** A constitution without `Adopt_Mandates` or equivalent
   is structurally incomplete — it cannot adapt, learn, or correct itself. (Podger Ch 2 Weberian
   paradox, Carlisle Section 4.1, OECD IRGC step 7)

3. **Mandate diversity enables resilience.** A constitution that assigns the same mandate type
   to every function has no repertoire to draw on when the normal path fails. (Podger Ch 2
   twin-forces, Carlisle Section 4.1.1, OECD Ch 12 fat-tailed risk)

4. **Broad `allowedRole` on reform and accountability mandates.** Restricting reform or
   censure to an admin-only role concentrates adaptive capacity in a single point of failure
   and weakens outward accountability. (Podger Ch 1, Carlisle Section 4.1, OECD Ch 13)

5. **On-chain vote records are the accountability mechanism.** Mandates with `votingPeriod = 0`
   on treasury or role-assignment actions remove the social decision process that gives the
   constitution its legitimacy claim. (Podger Ch 1, Carlisle Section 4.1.4, OECD Ch 13)

6. **Dual boundary requirement.** Every mandate must specify both user boundaries (`allowedRole`)
   and resource boundaries (`target` + `value` limits). A mandate with only one boundary type
   is structurally incomplete against Ostrom's Design Principle 1A+1B. (Ostrom 2009 Section 4E,
   Ostrom 2011 p. 21, Carlisle Section 4.2)

7. **Graduated sanctions over binary revocation.** No long-surviving self-organised institution
   used binary exclusion as its only enforcement mechanism. The graduated chain
   (`StatementOfIntent` → `PauseMandates` → `RevokeAccountsRoleId`) is the empirically
   supported pattern. (Ostrom 2009 Design Principle 5, Podger Ch 7, Carlisle Section 4.1.5)

8. **Collective-choice reform must include the affected role.** Restricting `Adopt_Mandates`
   to admin violates Ostrom's Design Principle 3, which is associated with institutional failure
   in the empirical record. (Ostrom 2009 Section 4E, Carlisle Section 4.1, OECD Ch 13
   cogeneration principle)
