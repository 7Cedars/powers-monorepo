# Reference Reading Guide — Powers Protocol Governance Design

This file maps each source in `ai/references/` to the specific governance design decisions made
by the `/design-org` skill. For each source, entries follow the format defined in
`reading_guide_template.md`. New sources should be appended here as new sections.

---

## Sources in this folder

| File | Citation | Analytical level |
|---|---|---|
| `Podger_Chan_Wanna_2020_...` | Podger, Su, Wanna & Chan (eds.), 2020. *Designing Governance Structures for Performance and Accountability.* ANU Press. | Structural + Parametric |
| `Carlisle_Gruby_2019_...` | Carlisle & Gruby, 2019. "Polycentric Systems of Governance: A Theoretical Model for the Commons." *Policy Studies Journal* 47(4): 927–952. | Structural + Dynamic |
| `May_2022_...` | May, 2022. *Complex Adaptive Governance Systems.* | **FILE UNREADABLE** — see note below |
| `879c4f7a-en.pdf` | Hynes, Lees & Müller (eds.), 2020. *Systemic Thinking for Policy Making.* OECD/IIASA. | Dynamic |

---

## Podger, Chan & Wanna 2020 — Designing Governance Structures

**Analytical level:** Structural + Parametric  
**Most relevant design decisions:** Q1 (role structure), Q3 (mandate selection), Q5 (membership), Q7 (accountability)

### Q1 — Role Structure

Ch 1, p. 11 (Podger, Chan, Wanna): The book's central conclusion is that functions can be "usefully
mapped to different degrees of independence (and different areas of autonomy) to optimise
performance and accountability." Specifically: core policy-setting functions should sit towards the
high-political-control end; regulatory and integrity functions towards the high-independence end;
service delivery in between. In Powers terms: assign `OpenAction` only to roles at the high-trust,
low-political-control end; use `BespokeAction_Simple` or `PresetActions` for roles that need
constrained discretion.

Ch 2, Figure 2.1 (Wanna, p. 20): Spectrum of political control over public sector organisations
(departments → cost centres → non-statutory bodies → advisory statutory bodies → marketing bodies
→ government business enterprises → judicial bodies). The section "Dimensions of independence —
balancing 'control' and 'relative autonomy'" (pp. 19–22) distinguishes *formal* independence from
*de facto* independence — formal grants of autonomy can be undermined by budgetary control or
appointment power. In Powers: a role assigned through `PeerSelect` has higher de facto autonomy
than one assigned through admin-controlled `RevokeAccountsRoleId`, even if both are nominally
"elected."

### Q3 — Mandate Selection

Ch 1, pp. 5–6 (Podger): Inconsistency between similar functions having different levels of
political control "may adversely affect performance." The argument is for coherence: the mandate
type selected for a governance function should be consistently applied across similar functions.
Do not mix `OpenAction` (broad discretion) and `BespokeAction_Simple` (narrow discretion) for
functionally equivalent roles.

Ch 6 (Gilchrist): The Delivering Community Services Partnership (DCSP) established a Partnership
Forum — a formal cross-sector deliberation body between government and the not-for-profit sector.
This is a structural analogue for `StatementOfIntent` used as a deliberation mandate rather than
a blocking veto: it creates a recorded signal without immediately stopping execution.

### Q5 — Membership Design

Ch 7, pp. 6–7 (Godwin): Integrity organisations with formal independence protections in their
statutes still had membership controlled through politically sensitive appointment processes.
The lesson: formal membership rules (who can join) and actual appointment mechanisms (how they
get there) must both be designed. In Powers, `SelfSelect` sets the formal rule (anyone can join);
but a subsequent `PeerSelect` or `RevokeAccountsRoleId` is what governs the actual composition.

Ch 8, pp. 8–9 (Chen & Liu): Community-based organisations in Hong Kong and Taiwan provide "a
degree of independence from the vicissitudes of contemporary politics" and "space for active
deliberation." This maps to the open-membership pattern: `SelfSelect` with a broad `allowedRole`
creates a base membership layer that is insulated from top-down control.

### Q7 — Accountability

Ch 1, p. 2 (Wanna): Accountability runs both "upward" (to governing supervisors) and "outward"
(to the public and clients). Powers' on-chain action record provides upward accountability
automatically (all votes and executions are attributable). Outward accountability — to those
affected but not participating — requires additional design, such as a public `StatementOfIntent`
mandate accessible to a broad role.

Ch 7, pp. 5–6 (Godwin): The merit protection commissioner describes a "more complex balancing of
control and autonomy" between enforcement (binary: revoke) and educational accountability
(graduated: signal, warn, then revoke). In Powers: `RevokeAccountsRoleId` is binary enforcement;
a deliberation mandate (`StatementOfIntent`) used as a censure or warning step is the graduated
alternative. For accountability-sensitive roles, prefer graduated before binary.

### What to skip

The empirical case material on Australia, Taiwan, and PRC governance reforms (Chapters 3–6, 9–11)
is too jurisdiction-specific. The performance monitoring chapters (Bennis Wai Yip So on Taiwan's
historical performance management; Meng et al. on provincial environmental pilots in China) have
no direct mapping to mandate parameters.

### Mandate implications

- The "form should follow function" principle (Ch 1) supports a design rule: select mandates that
  match the functional independence level of the role. High-independence roles (regulatory,
  integrity) → `PeerSelect` + veto chain. Low-independence roles (service delivery) →
  `BespokeAction_Simple` with admin timelock.
- The distinction between formal and de facto independence (Ch 2) warns against assuming that
  assigning a role via `PeerSelect` guarantees independent behaviour if the admin role can
  unilaterally revoke that assignment. Consider adding a `needFulfilled` requirement on any
  revocation mandate — revocation should itself require a vote, not just admin action.

---

## Carlisle & Gruby 2019 — Polycentric Systems of Governance

**Analytical level:** Structural + Dynamic  
**Most relevant design decisions:** Q1, Q3, Q4, Q5, Q6, Q7

### Q1 — Role Structure

Section 3.1 (pp. 931–933): The first attribute of a polycentric system is "multiple, overlapping
decision-making centers with some degree of autonomy." The key test is *de facto* autonomy: "A
grant of formal independence to decision-making centers does not guarantee them considerable de
facto autonomy" (p. 933). In Powers: verify that roles with different labels genuinely have
different mandate sets and different authority scopes. A veto role with the same quorum threshold
as the proposing role has limited de facto independence.

Section 3.2 (pp. 934–935): The second attribute is "choosing to act in ways that take account of
others through cooperation, competition, conflict, and conflict resolution." This is the on-chain
definition of `needFulfilled` / `needNotFulfilled`: mandate B takes account of mandate A by
requiring (or being blocked by) its prior completion. Any governance structure where mandates do
not reference each other is monocentric by this definition, regardless of how many roles exist.

### Q3 — Mandate Selection

Section 4.2.2 (pp. 943–944): "The jurisdiction or scope of authority of decision-making centers
should be coterminous with the boundaries of the problem being addressed." Scale mismatches
between a mandate's `allowedRole` and the actual scope of the governed action create either
under-governance (role too broad) or over-governance (role too narrow). An `OpenAction` mandate
granted to a role that governs only treasury spending is a scope overmatch.

Table 1 (p. 946): Theoretical model of a functional polycentric governance system. Use this as a
design checklist: for each of the three posited advantages (adaptive capacity, institutional fit,
risk mitigation through redundancy), confirm that the corresponding enabling conditions are
present in the governance structure. A structure claiming resilience through redundancy must have
"decision-making centers at different levels and across political jurisdictions" (or in Powers
terms: multiple overlapping mandates or roles that can perform the same function).

Section 4.3 (pp. 944–945): Redundancy illustration — if three independent authorities each face
a 1/10 failure probability, the probability of simultaneous coastwide failure drops from 1/10 to
1/1000. In Powers: two overlapping execution paths (e.g., a preset action + an open action for
the same function, held by different roles) reduce the risk that a governance breakdown in one
role makes the action impossible.

### Q4 — Dependency Chains

Section 3.2, p. 935: "Intense competition over distributional issues can undermine cooperation
and impede a governance system's capacity for self-organization." A `needNotFulfilled` chain that
creates winner-take-all competition between two roles (whoever acts first blocks the other)
without a cooperation mechanism is structurally fragile. Add a `StatementOfIntent` deliberation
step before the blocking mandate to create a cooperation channel.

Section 4.1.5 (pp. 940–941): E. Ostrom (2008) proposes "multiple tiers of arenas that can
engage in rapid discovery of conflicts and effective conflict resolution" — conflict resolution
systems should offer "a variety of approaches (conciliation, mediation, arbitration)" so
disputants can choose the forum appropriate to their circumstances. In Powers: the veto mandate
is the only built-in conflict resolution mechanism; for high-stakes governance, consider a
graduated veto chain (signal → formal veto → execution block) rather than a single binary veto.

### Q5 — Membership Design

Section 4.1.2 (pp. 937–938): "The possibility of entry allows for the influx of fresh ideas and
methods." Rules and norms should "allow the entry of new actors and enable new institutional
pathways when existing governance actors cannot meet the needs and objectives of the governance
system." A constitution with only `PeerSelect` (existing members approve all new members) cannot
admit new members if existing membership stalls. Pair `PeerSelect` with an emergency `SelfSelect`
path or an admin override for the initial bootstrapping period.

### Q6 — Adaptive Capacity

Section 4.1 (pp. 936–937): Adaptive capacity is "the ability of a resource governance system to
first alter processes and if required convert structural elements as response to experienced or
expected changes" (Pahl-Wostl, 2009, p. 355). In Powers: `Adopt_Mandates` = alter processes
(add a new mandate); `MandatePackage` = convert structural elements (adopt a bundle replacing
an entire flow). Use `Adopt_Mandates` for incremental adaptation, `MandatePackage` for
structural reform.

Section 4.1.1 (p. 937): "Decision-making centers employ diverse institutions" is the enabling
condition for adaptive capacity. Institutional diversity means different mandate types for
different functions. A constitution where every governance step uses `StatementOfIntent` is
institutionally homogeneous and cannot adapt — it has no structural variation to draw on.

Section 4.1.3 (pp. 938–939): Cross-scale linkages support adaptation, but warning: "reliance on
informal networks may result in ad hoc decision making and foster group homophily that diminishes
adaptive capacity." In Powers: `StatementOfIntent` used as a formal deliberation step converts
informal consensus into an on-chain record. This prevents homophily-driven drift by requiring
deliberation to be visible and attributable.

### Q7 — Accountability

Section 4.1.4 (pp. 939–940): In polycentric systems, dispersed responsibility makes
accountability harder. Lieberman (2011) found that when multiple actors were responsible for the
same task, "governance actors had strong incentives to shirk responsibilities because they could
rely upon other actors who were assigned the same responsibilities." In Powers: when two roles
share a mandate (e.g., both can veto), clearly distinguish their accountability domains — either
assign each a different mandate with overlapping `needFulfilled` requirements, or accept that
shared mandates have shared (diffuse) accountability.

Section 4.1.4 (p. 940): E. Ostrom (2000) notes that polycentric systems "provide more
opportunity for citizens and officials to correct maldistributions of authority and takeover by
opportunistic individuals." Multiple overlapping roles make capture harder — this is the
accountability argument for bicameral or multi-role structures even when a simpler structure
would be faster.

### What to skip

Section 2 (historical genealogy of the polycentricity concept, pp. 928–931) provides background
but no actionable design claims. Section 5 (research agenda, pp. 947–948) discusses empirical
gaps in the literature and is not actionable. The specific Pearl River Basin governance failure
case (da Silveira & Richards, 2013) is too context-specific.

### Mandate implications

- The "de facto autonomy" test (Section 3.1) should be applied as a review step: after drafting a
  governance structure, check that each role's actual mandate set gives it genuinely different
  authority from adjacent roles, not just a different label.
- The redundancy claim (Section 4.3) provides the theoretical justification for adding veto
  mandates even when the organisation prefers speed: redundancy is a risk mitigation strategy, not
  overhead.
- The conflict resolution diversity argument (Section 4.1.5) supports graduated accountability
  chains (`StatementOfIntent` censure → `PauseMandates` → `RevokeAccountsRoleId`) over binary
  revocation.

---

## May 2022 — Complex Adaptive Governance Systems

**FILE UNREADABLE.** The file `May_2022_Complex_Adaptive_Governance_Systems.pdf` fails to parse
as a valid PDF and appears to be stored in a different format (HTML or corrupted). No content
could be extracted.

**Expected contribution based on title and context in `institutionalDesign.md`:**

Based on the title and the references in `ai/prompts/institutionalDesign.md`, this source is
expected to address:
- Q6 (Adaptive Capacity): conditions under which governance systems can self-modify without
  collapsing; distinction between designed adaptability (explicit reform rules) and emergent
  adaptability (informal workarounds).
- Q3 (Mandate Selection): when `MandatePackage` (bundle upgrade) is preferable to incremental
  `Adopt_Mandates`.
- Q7 (Accountability): monitoring and sensing mechanisms that enable adaptation.

**Action required:** Replace the file with a valid PDF copy of the source before creating the
reading guide entry. When replacing, follow the template in `reading_guide_template.md` and
append the entry to this file.

---

## Hynes, Lees & Müller (OECD/IIASA) 2020 — Systemic Thinking for Policy Making

**Analytical level:** Dynamic  
**Most relevant design decisions:** Q3 (mandate selection), Q4 (dependency chains), Q6 (adaptive capacity), Q7 (accountability)

### Q3 — Mandate Selection

Ch 13, p. 135 (Jacobzone et al.): The key principle — a systems approach must be applied to
"both the system to be governed and the governance system itself" (citing Jentoft et al., 2007).
In Powers: the governance constitution is itself a system to be governed. This is the argument
for including reform mandates (`Adopt_Mandates`, `MandatePackage`) as first-class design elements,
not afterthoughts.

Ch 13, p. 137: For "wicked problems" with no agreed definition or solution, the linear
analyse-prioritise-implement approach fails. The alternative is "adaptive, evolutionary, and
participatory learning." In Powers: for contested governance domains (multi-stakeholder
organisations, organisations managing shared resources), prefer a `StatementOfIntent`-based
deliberation chain before any execution mandate, rather than direct `BespokeAction` with no
intermediate deliberation step.

### Q4 — Dependency Chains

Ch 12, p. 124 (Poledna et al.): Systemic risk arises from "cascading failures" — the default of
one node triggers defaults in connected nodes, potentially "wiping out the financial system via a
deleveraging cascade." In Powers: long `needFulfilled` chains create systemic interdependence.
If mandate A stalls (no quorum, no proposer), all downstream mandates B, C, D are permanently
blocked. Design for fault tolerance: avoid chains longer than 3 steps; use `throttleExecution`
to prevent single mandates from becoming permanent chokepoints.

Ch 12, p. 124: "Systemic risks overwhelmingly do not follow normal risk distributions, but tend
to be fat-tailed." Emergency mandates (pause, veto, revoke) are rarely used but must be robust
precisely when the system is under stress. Test emergency paths separately from the happy path.

IRGC 7-step approach (Ch 12, p. 129): Step 7 is "Monitor, learn, review, and adapt." In Powers:
the reform mandate is the on-chain implementation of this step. A constitution with no reform
mandate has no built-in step 7.

### Q6 — Adaptive Capacity

Executive Summary, p. 13: "Even if policymakers as individuals are systems thinkers, it does not
mean the policies they design are systemic; one needs institutions to support systems policy
making." In Powers: individual good actors are not sufficient. The mandate structure must
institutionalise good governance behaviour, not depend on role holders voluntarily behaving well.
This justifies mandatory deliberation steps (`StatementOfIntent` with `votingPeriod > 0`) rather
than optional ones.

Ch 13, pp. 137–138 (cogeneration example): IIASA's three-year stakeholder cogeneration process
brought together groups with "very different perspectives on the problem" to co-generate a
compromise solution. In Powers: reform mandates should have a broad `allowedRole` during reform
phases — limiting `Adopt_Mandates` to an admin-only role contradicts the cogeneration principle
and concentrates adaptive capacity in a single point of failure.

### Q7 — Accountability

Ch 13, p. 135: "A fundamental challenge to governing systemic risk is understanding the system as
a complex network of individual and institutional actors with different and often conflicting
interests, values, and worldviews." Standard accountability mechanisms (elections, hearings) are
inadequate when responsibility is dispersed (p. 135). Powers' on-chain action record provides
explicit, attributable accountability — every vote, proposal, and execution is permanently
associated with a specific account. This is a structural advantage that should be made visible
to designers: the record is the accountability mechanism.

Ch 13, p. 135 (Helbing 2013): "Collective responsibility" as a principle of systemic risk
governance raises the attribution problem: when everyone is responsible, diffuse accountability
means no one is effectively held to account. In Powers: avoid mandates where accountability is
collective without individual attribution (e.g., a role where all members jointly propose but no
individual can be identified). `StatementOfIntent` with per-account vote tracking solves this.

### What to skip

Chapters 2–11 (economic paradigms, environment and sustainable development, social and economic
change, innovation policy) address macro-policy domains with no direct mapping to mandate
parameters. Chapter 15 (training dimensions for systems thinking) and Chapter 16 (OECD-IIASA
work programme) are institutional planning documents. All quantitative financial network
modelling (DebtRank, CoVaR, SES, systemic expected shortfall) is not applicable to on-chain
governance design.

### Mandate implications

- The cascading failure analysis (Ch 12) adds a design constraint: mandate chains longer than 3
  sequential `needFulfilled` dependencies should be reviewed for resilience. If the first mandate
  in a chain can stall indefinitely (e.g., no quorum mechanism), the entire downstream chain is
  at risk.
- The "institutions must support good governance" argument (Executive Summary) supports requiring
  `votingPeriod > 0` on any mandate that controls treasury funds or role assignment, even when
  the organisation is small enough that informal consensus would suffice. The mandate structure
  should work correctly even when actors are adversarial.
- The cogeneration principle (Ch 13) supports broad `allowedRole` on reform mandates — opening
  `Adopt_Mandates` to general members, not only admins, increases the organisation's adaptive
  capacity.
