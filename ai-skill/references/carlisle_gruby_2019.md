# Carlisle & Gruby 2019 — Polycentric Systems of Governance

**Citation:** Carlisle & Gruby, 2019. "Polycentric Systems of Governance: A Theoretical Model
for the Commons." *Policy Studies Journal* 47(4): 927–952.
**Analytical level:** Structural + Dynamic
**Most relevant design decisions:** Q1, Q3, Q4, Q5, Q6, Q7

---

## Q1 — Role Structure

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

Section 4.1.1 (pp. 936–937): The first enabling condition is that "decision-making centers employ
diverse institutions." Institutional diversity means different mandate types for different
functions. A constitution where every governance step uses `StatementOfIntent` is institutionally
homogeneous and loses adaptive capacity — it has no structural variation to draw on. Diverse
institutions should correspond to diverse problems: collective-action problems call for different
mandate structures than principal-agent problems.

Section 4.2 (pp. 941–943): "Institutional fit" — the match between a governance institution and
the problem it is meant to address. Ecological fit considers whether the institution's jurisdiction
maps to the spatial/temporal scale of the problem. Social fit considers whether the institution
reflects "the interests, values, beliefs, and psychological needs of groups." In Powers:
`allowedRole` defines the social fit (who participates); the `target` address and `value` limits
define the ecological fit (what scope of action). Both must be sized to the problem, not to
administrative convenience.

---

## Q3 — Mandate Selection

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
1/1000 (E. Ostrom, 2012, quoting fisheries example). In Powers: two overlapping execution paths
(e.g., a preset action + an open action for the same function, held by different roles) reduce the
risk that a governance breakdown in one role makes the action impossible.

Section 4.2.1 (pp. 942–943): "Decision-making centers exist at different levels and across
political jurisdictions." In Powers: this is the argument for tiered role structures — a base
member layer, a representative layer, and an admin/steward layer — each with progressively
broader mandate authority. Cross-jurisdiction decisions (affecting multiple role layers) should
require input from multiple levels. Single-layer constitutions with only one decision-making
tier lack this vertical redundancy.

---

## Q4 — Dependency Chains

Section 3.2, p. 935: "Intense competition over distributional issues can undermine cooperation
and impede a governance system's capacity for self-organization." A `needNotFulfilled` chain that
creates winner-take-all competition between two roles (whoever acts first blocks the other)
without a cooperation mechanism is structurally fragile. Add a `StatementOfIntent` deliberation
step before the blocking mandate to create a cooperation channel.

Section 4.1.5 (pp. 940–941): E. Ostrom (2008) proposes "designing multiple tiers of arenas that
can engage in rapid discovery of conflicts and effective conflict resolution." Conflict resolution
systems should offer "a variety of approaches (conciliation, mediation, arbitration)" so
disputants can choose the forum appropriate to their circumstances. In Powers: the veto mandate
is the only built-in conflict resolution mechanism; for high-stakes governance, consider a
graduated veto chain (signal → formal veto → execution block) rather than a single binary veto.

Section 4.1.5 (p. 941): E. Ostrom (1990) identifies "rapid access to low-cost conflict resolution
mechanisms" as one of the design principles associated with robust institutions for sustaining
common-pool resources. This is relevant to setting `votingPeriod` on deliberation mandates:
overly long voting periods on conflict resolution mandates defeat the "rapid access" criterion.
Conflict resolution mandates should have shorter `votingPeriod` than standard execution mandates.

Section 4.1.4 (pp. 939–940): When conflict resolution is invoked through higher-level
(centralised) bodies, "it tends to centralise decision-making and control. This, in turn, may
impede adaptive capacity, as local decision makers sacrifice autonomy to innovate." In Powers:
avoid designing admin-only emergency mandates (pause, veto, revoke) as the only conflict
resolution path. Peer-accessible veto chains keep conflict resolution decentralised.

---

## Q5 — Membership Design

Section 4.1.2 (pp. 937–938): "The possibility of entry allows for the influx of fresh ideas and
methods." Rules and norms should "allow the entry of new actors and enable new institutional
pathways when existing governance actors cannot meet the needs and objectives of the governance
system." A constitution with only `PeerSelect` (existing members approve all new members) cannot
admit new members if existing membership stalls. Pair `PeerSelect` with an emergency `SelfSelect`
path or an admin override for the initial bootstrapping period.

Section 4.1.3 (pp. 938–939): Cross-scale linkages support adaptation, but warning: "reliance on
informal networks may result in ad hoc decision making and foster group homophily that diminishes
adaptive capacity" (Galaz et al., 2008). In Powers: `StatementOfIntent` used as a formal
deliberation step converts informal consensus into an on-chain record. This prevents homophily-
driven drift by requiring deliberation to be visible and attributable.

Section 4.1.3, p. 939: "Cross-scale linkages or multi-stakeholder forums may be especially
vulnerable to domination or capture by powerful interests." When networks are "characterized by
power asymmetries, more powerful actors seeking to further their interests can dominate the
linkages in a way that further skews knowledge and information in their favor." In Powers: a
`StatementOfIntent` accessible to all role holders (not just a subset) reduces capture risk by
ensuring that the deliberation record reflects broad participation.

---

## Q6 — Adaptive Capacity

Section 4.1 (pp. 936–937): Adaptive capacity is "the ability of a resource governance system to
first alter processes and if required convert structural elements as response to experienced or
expected changes" (Pahl-Wostl, 2009, p. 355). In Powers: `Adopt_Mandates` = alter processes
(add a new mandate); `MandatePackage` = convert structural elements (adopt a bundle replacing
an entire flow). Use `Adopt_Mandates` for incremental adaptation, `MandatePackage` for
structural reform.

Section 4.1.1 (p. 937): The enabling condition "decision-making centers employ diverse
institutions" is also what enables adaptive capacity. A constitution that assigns the same mandate
type to every function cannot adapt by switching mandate types — it has no repertoire to draw on.
Deliberately building mandate diversity into the initial constitution expands the adaptive toolkit.

Section 4.1 (p. 937): Adaptability requires "rules and norms generally applicable to actors in
the system" that "provide sufficient incentives for experimentation and creative problem solving"
and "allow the entry of new actors and enable new institutional pathways." In Powers: reform
mandates (`Adopt_Mandates`, `Revoke_Mandates`) are the on-chain implementation of this condition.
Their `allowedRole` should be broad enough to include multiple role layers, not just admin.

Section 3.1, p. 933: De facto autonomy is "the capacity of decision-making centers to genuinely
exercise their assigned authority, not just nominally hold it." This is a test for whether the
constitution's adaptive mechanisms will actually be used: a `MandatePackage` that requires
admin approval will not be used by member roles even if formally available to them.

---

## Q7 — Accountability

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

Section 4.1.4 (p. 940): Agrawal and Ribot (1999) list accountability mechanisms for
decentralised governance: "monitoring by independent third parties (e.g., media or NGOs),
auditing and evaluation, public reporting requirements for governmental decision makers,
education, performance awards, and oversight by higher levels of government." In Powers:
`StatementOfIntent` with per-account vote tracking implements the public reporting requirement;
`RevokeAccountsRoleId` governed by a multi-role vote implements the third-party oversight.

Section 4.1.4 (p. 939): "Downward accountability to local constituents is often weak in natural
resource governance" (Lebel et al., 2006). "Mechanisms for accountability allow socially
vulnerable groups that bear disproportionate risks and receive insufficient benefits from natural
resource policies to challenge decision-making authorities." In Powers: for organisations managing
shared resources, add a `StatementOfIntent` mandate accessible to the broadest possible role
(base members) so that those most affected but least powerful can register dissent on-chain.

---

## What to skip

Section 2 (historical genealogy of the polycentricity concept, pp. 928–931) provides background
but no actionable design claims. Section 5 (research agenda, pp. 947–948) discusses empirical
gaps in the literature and is not actionable. The specific Pearl River Basin governance failure
case (da Silveira & Richards, 2013) is too context-specific. The detailed Maine lobster fishery
case (Low et al., 2003) is useful as an illustration of redundancy but not for parameter selection.

---

## Mandate implications

- The "de facto autonomy" test (Section 3.1) should be applied as a review step: after drafting a
  governance structure, check that each role's actual mandate set gives it genuinely different
  authority from adjacent roles, not just a different label.
- The redundancy claim (Section 4.3) provides the theoretical justification for adding veto
  mandates even when the organisation prefers speed: redundancy is a risk mitigation strategy, not
  overhead.
- The conflict resolution diversity argument (Section 4.1.5) supports graduated accountability
  chains (`StatementOfIntent` censure → `PauseMandates` → `RevokeAccountsRoleId`) over binary
  revocation.
- The institutional fit criteria (Section 4.2) provide a checklist for `allowedRole` and `target`
  parameter selection: ecological fit = target scope matches the problem scope; social fit =
  allowedRole membership reflects the stakeholder community with actual stakes in the decision.
- Table 1 should be used as a post-design review checklist against all three advantage claims
  (adaptive capacity, institutional fit, redundancy) before finalising a constitution.
