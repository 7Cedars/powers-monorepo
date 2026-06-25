# Plinth Team 2026 — What is a Community Interest Company (CIC)? Complete Guide

**Citation:** Plinth Team, 2026. *What is a Community Interest Company (CIC)? Complete Guide.*
Plinth. Published 21 February 2026.
**Analytical level:** Structural (comparative framing only) — this is a secondary, practitioner/
marketing source with limited independent governance-design content beyond what
`cic_guidance_govuk.md` and `cic_model_articles_intro_govuk.md` already establish.
**Most relevant design decisions:** Q3 (mandate selection — comparative framing for when an
asset-locked structure is the right pattern vs. not)

---

## Q3 — Mandate Selection

"CIC vs Charity vs CIO: Key Differences" section and "The critical practical difference is tax"
paragraph: the decisive factor in choosing a CIC over a charity/CIO is the *income model*, not the
governance structure per se — "CICs are therefore better suited to organisations that primarily
earn income through trading... rather than those that rely heavily on public donations or grant
funding. If your main revenue will come from grants and donations, a charity or CIO structure
almost always offers more financial advantage." In Powers: this translates into a mandate-selection
heuristic independent of the asset-lock question — an organisation whose treasury is funded
primarily by recurring trading/protocol revenue (e.g. fee capture, service payments) is a good fit
for an asset-locked, restricted-distribution mandate set (mirroring the CIC pattern: see
`cic_guidance_govuk.md`), whereas an organisation funded primarily by one-off grants or donations
needs governance focused on grant-compliance and reporting mandates rather than ongoing
distribution-restriction mandates — the asset-lock pattern is solving a different problem
(restraining self-dealing in an ongoing trading entity) than a grant-compliance problem (proving
funds were spent as promised, a single retrospective audit need).

"When is a CIC the Right Choice?" section gives three positive conditions: trading commercially for
most income; wanting to attract investors who accept a capped return; wanting "the credibility of a
recognised legal structure without the regulatory requirements of registered charity status" — and
one negative condition: when the work doesn't meet a stricter charitable-purpose definition (e.g.
benefits a restricted, non-public community, or has a partly commercial character). In Powers: the
"capped return to investors" condition maps directly to a distribution mandate with a hard-coded
payout ceiling (see `cic_guidance_govuk.md`'s dividend-cap discussion) layered on top of the asset
lock — this is the signal that a designer should reach for an asset-locked + capped-distribution
mandate pair specifically when the organisation needs to raise outside capital while preserving
community-benefit commitments, not merely when it wants any treasury restriction at all. The
negative condition (restricted/non-public beneficiary group, or partly-commercial activity) is a
reminder that asset-locking is a governance commitment device, not inherently a "more legitimate"
structure — an organisation serving a narrow private-benefit group has no real need for the
lock's main payoff (broad community trust) and may be better served by a simpler, unlocked treasury
mandate with ordinary majority-vote control.

"What is the difference between a CIC limited by guarantee and a CIC limited by shares?" FAQ
section: guarantee structures suit organisations that "do not need to raise equity investment,"
while shares structures "suit social enterprises seeking patient capital from investors who accept
a limited return in exchange for social impact." This restates, in plainer language, the
guarantee-vs-shares fork already covered structurally in `cic_model_articles_intro_govuk.md`, but
adds the practitioner framing of "patient capital" — i.e. the shares/capped-dividend variant is
specifically for investors with a long time horizon and reduced return expectations, not investors
seeking market-rate returns. In Powers: a capped-distribution mandate intended to attract outside
capital should be presented to prospective participants with this expectation explicit (e.g. in the
mandate's off-chain documentation/metadata) — the cap is a filter that selects for patient,
mission-aligned capital and self-selects out return-maximizing capital, which is a feature, not a
limitation to be minimized.

---

## What to skip

The bulk of this document is marketing-adjacent and UK-administrative content with no on-chain
governance-design value: the "Legal Framework" section's historical/statutory framing (Companies
(Audit, Investigations and Community Enterprise) Act 2004, 1 July 2005 commencement date), the
specific registration document list (community interest statement, political-party declaration),
the CIC34 annual report filing reference (already covered more authoritatively in
`cic_guidance_govuk.md`), the year-on-year CIC registration statistics (37,081 CICs in 2024–25, a
12% rise; 120 conversions, a 4% rise) which are descriptive market-sizing data aimed at persuading a
reader the form is popular, not governance guidance, and the embedded chatbot/"Recommended Next
Pages" cross-links to other Plinth marketing content (CIO guide, Social Enterprise guide, Charity
Trustee guide, CRM-for-charities product page) which are navigation/lead-generation elements with
no substantive content of their own. The "How is a CIC regulated?" FAQ restates material already
covered in more authoritative and more detailed form in `cic_guidance_govuk.md`'s "Regulator's
Role" section and adds nothing new. Treat this source as confirmatory/comparative framing only —
it does not introduce governance mechanisms beyond those already documented in the two GOV.UK
sources, and where it does add value (the trading-vs-grant-funding selection heuristic, the
"patient capital" framing) that value is interpretive/comparative rather than mechanistic.

---

## Mandate implications

- The income-model heuristic (CIC vs Charity vs CIO section) supports a mandate-selection rule:
  recommend an asset-locked + restricted-distribution mandate set for organisations with ongoing
  trading/fee revenue; recommend simpler grant-compliance/reporting-focused mandates (without a
  permanent asset lock) for organisations funded primarily by one-off grants or donations, since
  the two income models create different governance risks (self-dealing vs. proving compliant
  spend).
- The "capped return for patient capital" framing supports explicitly documenting, in mandate
  metadata, that a capped-distribution mandate is intended to select for mission-aligned investors
  rather than market-rate-return investors — this is a design-intent note for `BespokeAction_Simple`
  or distribution-style mandates layered on top of an asset lock, not a new mandate type.
- The negative-condition framing (restricted/non-public beneficiary group not needing broad
  community trust) is a caution against defaulting to an asset-locked mandate pattern whenever any
  treasury restriction is wanted — if the organisation's beneficiary group is narrow and there is no
  need to signal broad community trust, a simpler unlocked treasury mandate under ordinary
  majority-vote control may be the better-fitting (lower-overhead) choice.
