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

### UK Community Interest Company (CIC) sources

A family of real-world legal-governance templates and regulatory documents. Treated as a single
analytical "tier" below (cited as Quaternary) because they post-date and supplement the academic
core sources rather than replacing them — they contribute concrete, statutorily-validated
calibration points and a genuinely novel external-oversight mechanism not found in the academic
sources.

| File | Citation | Analytical level |
|---|---|---|
| [`cic_model_articles_guarantee_small.md`](cic_model_articles_guarantee_small.md) | UK CIC Model Articles of Association, Limited by Guarantee, Small Membership, Companies House template. | Structural + Parametric |
| [`cic_model_articles_guarantee_large.md`](cic_model_articles_guarantee_large.md) | UK CIC Model Articles of Association, Limited by Guarantee, Large Membership, Companies House template. | Structural + Parametric |
| [`cic_model_articles_shares_sch2_small.md`](cic_model_articles_shares_sch2_small.md) | UK CIC Model Articles of Association, Limited by Shares (Schedule 2 — no private distribution), Small Membership, Companies House template. | Structural + Parametric |
| [`cic_model_articles_shares_sch2_large.md`](cic_model_articles_shares_sch2_large.md) | UK CIC Model Articles of Association, Limited by Shares (Schedule 2 — no private distribution), Large Membership, Companies House template. | Structural + Parametric |
| [`cic_model_articles_shares_sch3_small.md`](cic_model_articles_shares_sch3_small.md) | UK CIC Model Articles of Association, Limited by Shares (Schedule 3 — capped distribution permitted), Small Membership, Companies House template. | Structural + Parametric |
| [`cic_model_articles_shares_sch3_large.md`](cic_model_articles_shares_sch3_large.md) | UK CIC Model Articles of Association, Limited by Shares (Schedule 3 — capped distribution permitted), Large Membership, Companies House template. | Structural + Parametric |
| [`cic_memorandum_guarantee.md`](cic_memorandum_guarantee.md) | UK CIC Model Memorandum of Association, Limited by Guarantee, Companies Act 2006 template. | Structural (minimal) |
| [`cic_memorandum_shares.md`](cic_memorandum_shares.md) | UK CIC Model Memorandum of Association, Limited by Shares, Companies Act 2006 template. | Structural (minimal) |
| [`cic_regulations_2005.md`](cic_regulations_2005.md) | The Community Interest Company Regulations 2005, SI 2005/1788. | Structural + Parametric + Dynamic |
| [`cic_guidance_govuk.md`](cic_guidance_govuk.md) | UK Dept for Business and Trade / CIC Regulator, 2025. *Community Interest Companies Guidance.* GOV.UK. | Structural + Parametric + Dynamic |
| [`cic_model_articles_intro_govuk.md`](cic_model_articles_intro_govuk.md) | UK Dept for Business and Trade / CIC Regulator, 2025. *CIC model Articles of Association: introduction.* GOV.UK. | Structural |
| [`cic_plinth_guide.md`](cic_plinth_guide.md) | Plinth Team, 2026. *What is a Community Interest Company (CIC)? Complete Guide.* | Structural (comparative framing) |
| [`cic_wikipedia.md`](cic_wikipedia.md) | Wikipedia contributors. "Community interest company." *Wikipedia.* | Structural |
| [`cic_annual_report_2024_2025.md`](cic_annual_report_2024_2025.md) | Office of the Regulator of Community Interest Companies. *Annual Report 2024 to 2025.* | Dynamic (empirical) |

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

**Quaternary:** `cic_model_articles_guarantee_large.md` (representative of the six model-articles
files — see also the small-membership and shares variants)
Adds real statutory precedent for a layered delegation chain (executive role → revocable
committee-equivalent grants) and a dual-track removal design: peer-triggered automatic removal
for disengagement (three consecutive absences) versus member-voted removal for cause with a
mandatory hearing step. Use it when designing `Adopt_Mandates`/`Revoke_Mandates` delegation chains
or calibrating a removal-track split for an executive role.

**Quaternary:** `cic_regulations_2005.md`
Adds the one genuinely external-to-the-organisation oversight role in the library: the CIC
Regulator's power to appoint, pay, and remove a manager over a CIC's property and affairs, plus a
hard cap on how much board control non-members may hold (never a majority). Use it when a
constitution needs an external/funder oversight role with no Powers-native equivalent.

**Quaternary:** `cic_wikipedia.md`
Adds the CIC form's core role-design insight: "can be compensated" and "loses governance control"
are independently decidable, not bundled by default (contra the charity model). Use it when
assigning `allowedRole` to paid operator roles versus deliberation/oversight roles.

**Quaternary:** `cic_model_articles_intro_govuk.md`
Adds the rationale for collapsing a member role and an executive role into one `allowedRole` when
the two sets are coextensive, versus splitting them once membership exceeds the executive set. Use
it as a first-pass check before defining two separate roles: ask whether the stakeholder set and
the decision-making set are actually identical.

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

**Quaternary:** `cic_model_articles_guarantee_large.md` (consistent across all six model-articles
files)
Adds concrete, externally-validated calibration anchors: a minimum quorum floor of 2; a hybrid
quorum formula ("2 persons or 10% of total membership, whichever is greater") for roles of
variable size; an automatic quorum-waiver fallback on a failed-quorum adjournment, to prevent
permanent deadlock; a 75%-supermajority / simple-majority two-tier resolution threshold; and a
90%-near-unanimity threshold for bypassing standard notice/deliberation periods. Use these as
ready-made `votingPeriod`/quorum benchmarks when no other calibration source is available.

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

**Quaternary:** `cic_regulations_2005.md`
Adds the clearest binary mandate-selection fork in the library: choose once, at the
constitutional level, between a treasury mandate with no payout path to role-holders at all
(asset-lock-only) versus one permitting capped distributions. Use it when deciding whether a
treasury should ever pay out to role-holders, and if so, under what hard ceiling.

**Quaternary:** `cic_guidance_govuk.md`
Adds the four-branch transfer-justification gate (full consideration / nominated asset-locked
body / regulator-consented body / community benefit) and the pattern of hard-coding a fixed
distribution-cap percentage rather than leaving it to a discretionary vote each time. Use it when
designing treasury-outflow mandates that must balance flexibility against self-dealing risk.

**Quaternary:** `cic_plinth_guide.md`
Adds an income-model heuristic — ongoing trading/fee revenue favours an asset-locked,
restricted-distribution mandate set; one-off grant/donation revenue favours simpler
grant-compliance/reporting mandates instead. Use it early, before selecting any specific
mandate, to check that an asset-lock-style pattern actually fits the organisation's revenue model.

**Quaternary:** `cic_wikipedia.md`
Adds the hybrid-goods framing: an organisation that behaves like a flexible private enterprise but
must produce a structural public-good commitment needs operational mandates left unconstrained
while treasury/dissolution mandates carry a standing, non-bypassable purpose check. Use it to
distinguish this hybrid pattern from a pure charity-style pattern (which would instead restrict
*who may propose* financial mandates).

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

**Quaternary:** `cic_regulations_2005.md`
Adds the only sourced example of an external-approval dependency: a purpose-change reform has no
legal effect until an outside party approves it, independent of and subsequent to the internal
vote. Use it when a reform mandate must remain verifiably aligned with an outside standard (a
legal wrapper, grant condition, or registry membership) rather than being fully self-amendable.

**Quaternary:** `cic_guidance_govuk.md`
Adds a consult-then-decide-then-appeal chain around the single highest-stakes treasury action
(final asset distribution on wind-up): notify affected parties, allow objection, only then
execute. Use it when designing a dissolution or final-liquidation mandate that should not be a
single-step vote.

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

**Quaternary:** `cic_model_articles_guarantee_small.md` (and the other model-articles files)
Adds concrete closed-membership patterns: gatekept entry requiring approval by the existing
controlling role, non-transferable membership with no secondary-market exit, and automatic
(non-discretionary) termination triggers tied to inactivity or to a member ceasing to exist. Use
it when designing an admission/exit mandate pair that should not rely on a tradeable instrument.

**Quaternary:** `cic_regulations_2005.md` / `cic_guidance_govuk.md` / `cic_wikipedia.md`
Add a third boundary type, distinct from `allowedRole` (who can act): a recipient-class
restriction on `target` — who funds may flow to — that persists independently of current role
membership (the "asset-locked body" concept). Use it when a treasury mandate's destination
restriction needs to survive membership turnover, and to avoid conflating a beneficiary/output
boundary with a governance-participation boundary.

**Quaternary:** `cic_memorandum_guarantee.md` / `cic_memorandum_shares.md`
Add the binary founding choice between capital-stake membership (token-gated `allowedRole`) and
personal-undertaking membership (`SelfSelect`/`PeerSelect` keyed to identity, no balance
requirement) as a one-time, foundational decision UK company law forces explicitly at
incorporation. Use it as the first design question when scoping a new constitution's membership
unit.

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

**Quaternary:** `cic_regulations_2005.md`
Adds the clearest example of a reform constraint sitting permanently outside the ordinary
amendment surface: the asset lock cannot be removed by any internal vote, while the
distribution-cap percentage layered on top of it is an ordinary, revocable parameter. Use it when
deciding which parts of a constitution should be excluded from `Adopt_Mandates`/`Revoke_Mandates`
entirely versus left as a votable parameter.

**Quaternary:** `cic_annual_report_2024_2025.md`
Adds real longitudinal data: roughly 78% lifetime attrition among UK CICs registered since 2005,
and a regulatory cost structure that scaled with a 100x population increase over 20 years without
requiring any rule amendment. Use it when deciding whether a constitution needs an explicit,
low-cost wind-down/dissolution mandate path rather than assuming indefinite persistence.

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

**Quaternary:** `cic_annual_report_2024_2025.md`
Adds the strongest empirical accountability evidence in the entire library: real complaint and
enforcement statistics from a 37,000-entity population showing the harshest sanction (asset
seizure) was never invoked in a year with multiple financial-mismanagement and governance
complaints logged, and that hard-coded constraints (the asset lock) generated zero disputes while
discretionary judgment calls generated the most. Use it when deciding how aggressively to design
an enforcement/escalation chain — design the harshest sanction as a credible-but-rare backstop,
not the primary mechanism.

**Quaternary:** `cic_regulations_2005.md`
Adds the external-manager-appointment mechanism (no Powers-native equivalent) and the
disclosure-after-vote pattern: a distribution vote alone is not treated as accountability-complete
without a mandatory downstream public report. Use it when a constitution needs an external
oversight role or a mandatory post-distribution reporting mandate.

**Quaternary:** `cic_guidance_govuk.md`
Adds the "excessive role-holder compensation is a disguised asset-lock breach" framing, and the
light-touch/complaint-driven oversight model (most effective oversight here is reactive, not
constantly active). Use it when designing remuneration mandates or scoping how active an
oversight role needs to be.

---

## Cross-cutting design rules

Rules 1–8 appear independently in all three core academic sources (Podger, Carlisle, OECD) and
can be treated as well-grounded design constraints. Rules 9–10 are added from the CIC source
family and are well-grounded in statute/regulation and empirical enforcement data rather than
academic meta-analysis, but are corroborated by the academic sources' boundary and sanctions
principles (see cross-references):

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

9. **Recipient/output boundaries are a third boundary type, distinct from participant
   boundaries.** A restriction on *who funds may flow to* (`target`) must be designed
   independently of, and can outlive, a restriction on *who may act* (`allowedRole`) — changing
   role membership should never silently change where treasury assets are allowed to go.
   (CIC Regulations 2005 Sched. 1 ¶1, CIC Guidance "Asset Lock" section, Wikipedia "The asset
   lock" section)

10. **Hard-coded constraints prevent more disputes than discretionary review.** Real-world
    enforcement data shows non-discretionary, automatically-checked rules generate far fewer
    disputes than rules that depend on after-the-fact judgment calls about whether discretionary
    behaviour was appropriate. Prefer `needFulfilled`/`needNotFulfilled` checks evaluated
    automatically over relying solely on `StatementOfIntent` deliberation to catch the same
    problem later. (CIC Annual Report 2024–25 §8, reinforcing Cross-cutting rule 6)
