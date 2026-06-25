# CIC Regulator 2025 — Annual Report 2024 to 2025

**Citation:** Office of the Regulator of Community Interest Companies. *Annual Report
2024 to 2025*. Companies House / Department for Business and Trade, 2025 (document ref.
0157-2025-CIC-AR-25).
**Analytical level:** Dynamic (empirical record of real-world governance outcomes over time)
**Most relevant design decisions:** Q6, Q7

---

## Q7 — Accountability

§8 Complaints (p. 18): In 2024-25 the Regulator received 36 complaints about CICs across
37,081 companies on the register — roughly 1 complaint per 1,030 active CICs. The complaint
categories, in descending order, were: Confusion CIC or Charity (7), Activities (6),
Financial Mismanagement (5), Governance (5), Political Activity (5), Directors Activities
(3), Other (3), Directors Remuneration (2), Asset Transfer (0), Fundraising (0). The single
largest complaint category — "Confusion CIC or Charity" — is not a governance failure at
all; it is a *legibility* failure: outsiders cannot tell what kind of organisation they are
dealing with or what protections apply. This is directly transferable: a Powers constitution
should make its mandate set and accountability guarantees externally legible (e.g., via a
discoverable, human-readable summary of active `Adopt_Mandates`/`PauseMandates` state) so
that counterparties are not confused about what governance protections actually apply,
mirroring the CIC's biggest real-world complaint driver.

§8 Complaints (p. 18): "This year, the Regulator did not need to use her statutory powers
to launch a formal investigation into any CICs." Combined with the Official Property Holder
report (§10, p. 23): "No property either held by, or in trust for a community interest
company has been vested in the Official Property Holder; No persons in whom such property
is vested has been required to transfer it to the Official Property Holder" — i.e., the
asset-lock enforcement mechanism (the strongest accountability tool in the CIC regime,
analogous to a `RevokeAccountsRoleId` + forced asset seizure) was not triggered even once
across the entire financial year, despite 5 Financial Mismanagement complaints and 5
Governance complaints being logged. This is the single most load-bearing empirical finding
in the report: a light-touch, complaint-driven oversight model with a severe-but-rarely-used
enforcement backstop produced zero formal investigations and zero asset seizures in a
37,000-entity population. For Powers design, this validates a graduated-but-rare
enforcement chain (`StatementOfIntent` flagging → `PauseMandates` as the common response →
`RevokeAccountsRoleId`/asset-lock-equivalent only as a backstop that is structurally present
but expected to be invoked near-never) rather than a chain that assumes frequent escalation
to the harshest sanction. Design for the backstop to exist and be credible, not for it to be
the primary accountability mechanism.

§11 Key statistics (p. 24, 20-year longitudinal table): Dissolutions as a share of approvals
have risen steadily and substantially over the regime's life: 0% (2007-08 cohort) → 35%
dissolved of 814 approved in 2007/08 → climbing to 3,832 dissolved against 8,376 approved in
2024/25 (45.7% of that year's approvals, and 3,832/37,081 ≈ 10.3% of the entire live
register dissolving in a single year — see §7 Dissolutions, p. 17, which states this 10%
figure explicitly and notes a 12% year-on-year increase in dissolutions). Cumulatively, only
22% of CICs registered since the model's 2005 inception are still active (Executive summary,
p. 4; Key statistics infographic, p. 5). This is a structural finding, not noise: a governance
form with very low entry friction (£27-35 registration fee, light-touch ongoing reporting)
and an asset lock as its main accountability guarantee has a roughly 78% lifetime attrition
rate. For Powers, this implies that low-friction `SelfSelect`-style entry into a governance
structure should be paired with an explicit expectation of high organisational mortality —
designs should not assume that successful initial deployment implies durability, and
constitutions should include a clean, low-cost wind-down/dissolution path (the on-chain
equivalent of the asset lock redirecting residual treasury to another asset-locked body)
rather than assuming permanence.

§8 Complaints (p. 18): The complaint taxonomy itself is a usable checklist for what kinds of
accountability gaps actually materialise in light-touch-regulated community organisations:
confusion about organisational identity/protections, disputes about activities matching
stated purpose, financial mismanagement, governance process complaints, improper political
activity, and director remuneration disputes. Of these, "Asset Transfer" and "Fundraising"
both registered zero complaints — the asset-lock mechanism (the CIC's structural,
non-discretionary constraint) generated no complaints, while the discretionary,
judgment-dependent categories (governance process, activities matching purpose, financial
mismanagement) generated the most. This suggests that hard-coded, non-discretionary
constraints (Powers equivalent: `needFulfilled` checks baked into mandate logic) are more
effective at preventing disputes than relying on after-the-fact judgment calls about
whether discretionary behaviour was appropriate (Powers equivalent: depending solely on
`StatementOfIntent` deliberation without supporting structural constraints).

---

## Q6 — Adaptive Capacity

§9 Finance (p. 19, Finance table p. 20): Companies House filing fees increased in May 2024,
and the Regulator's own office expenditure rose 8% year-on-year (£351,103 → £380,212,
2023/24 to 2024/25), while income from CIC reports and formations rose proportionally more
(£425,715 → £473,670), keeping the income/expenditure ratio above 100% throughout the
five-year window shown (102%-152%, 2020/21-2024/25). The regulatory regime adapts its cost
structure incrementally (fee changes, expenditure growth tracking registration growth)
without requiring wholesale restructuring of the oversight model itself. This is a weak but
real adaptive-capacity signal: a governance/regulatory layer that scales its own resourcing
in proportion to the population it oversees (here, cost-recovery via per-filing fees) is
more sustainable than one with fixed costs against a growing register. For Powers, this
favours mandate-execution costs (e.g., gas, treasury draws for any on-chain "registrar"
function) that scale with the number of active governed entities rather than being fixed,
where an analogous registry/factory pattern (e.g., `PowersFactory`) is used to oversee many
deployed instances.

§Foreword (p. 2-3) and Executive summary (p. 4): The Regulator's tenure-based leadership
(Louise Smyth's final report before retirement) and the explicit statement that growth "has
exceeded all expectations of the model when it was originally created in 2005" together
show a regime that has not needed to formally amend its founding rules despite 20 years of
scale change (208 CICs in year one to 37,081 in year twenty). This is suggestive but not
strongly actionable: the report does not describe any specific rule amendments triggered by
this growth, so the lesson is limited to "a stable, simple rule set can absorb two orders of
magnitude of scale growth without formal reform" — worth noting as a data point for designers
worried that growth alone necessitates `Adopt_Mandates`-driven restructuring, but not a
substitute for an actual case study of adaptive reform in action.

---

## What to skip

The CIC case studies (§6, pp. 8-16: Active Youth NI, Market Harborough Fixers, Mental
Health Swims, The Game Change Project) are organisational impact narratives — participant
counts, CO2 savings, mental health survey results — with no governance-structure content;
they describe what the organisations achieved, not how they govern themselves, and contain
no information about role structure, voting, or accountability mechanisms. The Mission
statement (§1, p. 1) and Applications and growth narrative prose (§5, p. 6) restate
figures available more precisely in the Key statistics table and add no analytical content
beyond what is captured above. Procedural detail about the Official Property Holder's legal
status as a "corporation sole" and the statutory cross-references to Schedule 5 of the 2004
Act (§10, pp. 21-22, paragraphs 1-17) are UK civil-service structure with no on-chain
analogue beyond the single substantive finding already extracted (zero property vested,
zero forced transfers).

---

## Mandate implications

- The single largest real-world complaint category against light-touch-regulated
  organisations is identity/legibility confusion ("Confusion CIC or Charity," 7 of 36
  complaints) — Powers constitutions should expose a legible, discoverable summary of active
  mandates and accountability guarantees so participants and counterparties are not
  confused about what protections actually apply. This is a concrete design requirement, not
  just a UI nicety.
- Zero formal investigations and zero asset-lock enforcements occurred in a 37,000-entity,
  one-year population despite 10 governance/financial-mismanagement complaints being
  logged — this validates designing the harshest accountability mandate
  (`RevokeAccountsRoleId` / forced asset redirection) as a credible-but-rare backstop, with
  `PauseMandates` as the expected first-line response to a flagged problem, rather than
  building an accountability chain that assumes frequent recourse to maximal sanction.
- Non-discretionary, hard-coded constraints (the asset lock: 0 complaints) outperformed
  discretionary judgment calls (governance process, activities-matching-purpose: 10
  complaints combined) at preventing disputes. Wherever possible, encode accountability
  rules as `needFulfilled`/`needNotFulfilled` checks evaluated automatically rather than
  relying solely on `StatementOfIntent` deliberation to catch the same problem after the
  fact.
- A ~78% lifetime attrition rate among CICs registered since 2005 (22% still active, Exec
  summary p. 4) implies that low-friction entry into a governance structure should be
  designed with an expected high failure/dissolution rate in mind: include a clean,
  low-cost wind-down mandate path (treasury redirection to another governed entity,
  analogous to the asset-lock's "asset-locked body" requirement) rather than assuming the
  deployed constitution will persist indefinitely.
- Regulatory/oversight cost structures that scale with the size of the governed population
  (per-filing fee income tracking expenditure growth, Finance table p. 20) are more
  sustainable than fixed-cost oversight layers — relevant when designing any on-chain
  registry or factory pattern that oversees multiple deployed Powers instances.
