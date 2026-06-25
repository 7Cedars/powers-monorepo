# GOV.UK 2025 — Community Interest Companies Guidance

**Citation:** UK Department for Business and Trade / Office of the Regulator of Community
Interest Companies, 2025. *Community Interest Companies Guidance.* GOV.UK. Updated 4 April 2025.
**Analytical level:** Structural (asset-lock as a governance primitive), with Parametric elements
(dividend cap, remuneration test) and Dynamic elements (reform/exit constraints, regulator
oversight).
**Most relevant design decisions:** Q3 (mandate selection), Q4 (dependency chains), Q5
(membership design), Q6 (adaptive capacity), Q7 (accountability)

---

## Q3 — Mandate Selection

"Asset Lock" section: "The Asset Lock is a fundamental feature of Community Interest Companies
(CICs) and is a legal clause that prevents the assets of a company being used for private gain,
rather than the stated purposes of the organisation... no assets can be transferred from a CIC to
a limited company; and any assets that belong to or are donated to a CIC remain within the CIC."
In Powers: this is a permanent, non-negotiable transfer restriction on treasury assets — the
on-chain equivalent is a `needFulfilled` condition wired into every treasury-spending mandate
(e.g. `OpenAction`, `BespokeAction_Simple`) that checks the recipient against an allow-listed
registry of "asset-locked" addresses (other Powers DAOs, registered charities-equivalent, or a
designated successor organisation). Unlike a typical spending-cap parameter, this is not something
governance should be able to vote to remove — it is a structural constraint on the mandate's
encoding itself, not a parameter exposed to `Adopt_Mandates` reform.

"Asset Locked Body Nomination" section: a CIC may nominate one or more recipient organisations in
its constitution to receive residual assets on wind-up; absent a nomination, the regulator decides.
In Powers: an organisation designing a treasury-exit or dissolution mandate should pre-specify the
list of eligible successor addresses in the mandate's static configuration at deployment time,
rather than leaving the destination of locked funds to be decided ad hoc by a future vote — ad hoc
decisions under wind-up pressure are exactly the failure mode the nomination mechanism is designed
to prevent.

"Limited by Shares / Limited by Guarantee" section: "You should consider carefully the company
type most appropriate for your proposed CIC... a CIC limited by guarantee cannot be converted into
a company limited by shares (or vice versa)." This decision is made once and is irreversible. In
Powers: the choice between, e.g., a token-weighted electoral mandate (shares-like) and a one-
account-one-vote mandate (guarantee-like, consistent with Powers' core design) is similarly a
foundational choice that later reform is unlikely to be able to cleanly undo — once a community
has been onboarded under one electoral logic, switching to another disenfranchises or re-weights
existing participants. Treat the choice of electoral mandate (`SelfSelect`, `PeerSelect`, token-
delegation mandates) as a one-time foundational decision, not a parameter to be casually revisited
via `Adopt_Mandates`.

"Schedule 2 Articles" / "Schedule 3 Articles" sections: Schedule 2 permits dividends only to other
asset-locked bodies; Schedule 3 permits capped dividends to ordinary shareholders/private
investors. The dividend cap is fixed at 35% of distributable profits ("Explanation of Current
Dividend Cap" section: "the dividend cap has a single element called the maximum aggregate
dividend cap which is no more than 35% of CIC's profits... the remaining 65% of profits are
reinvested back into the company or used for the community"). In Powers: a treasury-distribution
mandate intended to allow some value extraction to external investors while preserving community
benefit should hard-code an analogous cap (e.g. a require-style check inside `BespokeAction_Simple`
limiting outflow to non-locked addresses to a fixed percentage of a distribution event), rather than
relying on a discretionary vote each time, since voted caps can be eroded incrementally.

---

## Q4 — Dependency Chains

"Asset Lock – Transfer of Assets" section: any transfer of CIC assets out of the company must
satisfy one of: (1) full market value paid, (2) transfer to a nominated asset-locked body, (3)
transfer to a non-nominated asset-locked body with regulator consent, or (4) transfer for the
benefit of the community. In Powers: this is a four-branch `needFulfilled`/`needNotFulfilled` gate
that should sit in front of any treasury-outflow mandate — a single boolean "is recipient
authorised" check is insufficient; the mandate needs to validate which of the four justifying
conditions applies and apply different downstream logic (e.g. branch 3 requires an additional
external-approval step analogous to a regulator sign-off, which in Powers terms maps to requiring
a `StatementOfIntent` from a designated oversight role before the transfer mandate executes).

"Transfer of Assets for less than full consideration" section: transfers below market value always
require prior consent ("must always be consented to by the Regulator") and must additionally be
disclosed in the next annual report. In Powers: below-market transfers should never be a single-step
`OpenAction`; they require a sequential dependency — approval mandate executes and writes an
on-chain record, only then does the transfer mandate become eligible (`needFulfilled` referencing
the approval action), and the record itself should be durably queryable (satisfied by Powers'
native action log) to support later audit, mirroring the "must be included in the CIC report"
disclosure requirement.

---

## Q5 — Membership Design

"Limited by Shares / Limited by Guarantee" section: guarantee members "guarantee to meet the debts
of the company up to a specific limit in the event of its failure" and "have no further personal
liability... beyond their guarantee," typically a nominal £1. In Powers: this models a low-stakes,
low-barrier membership entry condition appropriate for a `SelfSelect`-type role — membership cost
should be calibrated to be a credible-commitment signal (not zero) without being a capital barrier
that excludes participants, distinct from share-based membership where stake size determines
influence.

"Asset Locked Body Nomination" / "What is an Asset locked body?" sections: an asset-locked body
must itself be of a constrained type (CIC, charity, permitted society, or equivalent) — "a CIC
cannot nominate itself... a CIC also cannot nominate an individual, regardless of whether they have
contributed to the CIC." In Powers: when a constitution defines a successor or beneficiary role for
locked treasury assets, that role's `allowedRole`/recipient set must be restricted to other
asset-locked organisational accounts (other Powers instances with equivalent locks, or off-chain
equivalents with enforceable restrictions) — never to individual member or admin addresses, however
trusted, since that re-opens the private-gain channel the lock exists to close.

---

## Q6 — Adaptive Capacity

"Things to Consider" section: "Setting up a CIC is a big step, because once you are registered the
only 'ways out' are: dissolving the company and ceasing to exist altogether, or converting the CIC
to a charity or Charitable Incorporated Organisation (CIO)... once a company is a CIC it cannot
become an ordinary company." In Powers: the asset-lock-bearing mandate set should be designed so
that `Revoke_Mandates` cannot simply strip the lock and convert the organisation back into an
unconstrained treasury — if Powers governance is meant to replicate CIC-style commitment, the
lock-enforcing mandate must itself be excluded from the normal `Adopt_Mandates`/`Revoke_Mandates`
reform surface (e.g. placed outside any `MandatePackage` that ordinary governance can vote to
remove), with dissolution-to-successor as the only sanctioned exit path.

"Asset Lock – On Closure" section: with a nominated asset-locked body, transfer on wind-up proceeds
without further regulator consent; without one, regulator consent (via form CIC53) is required
first. In Powers: a constitution should pre-register the wind-up successor at deployment to avoid
needing a discretionary, possibly contested, final-stage governance action under the stress of
dissolution — this mirrors the OECD systems-thinking point (cf. `hynes_oecd_2020.md`, Ch 12, p.124)
that emergency/exit paths are precisely the paths most likely to be untested and most likely to
fail when actually invoked.

---

## Q7 — Accountability

"Remuneration" section: "CIC directors' remuneration should never be more than is reasonable,"
"arrangements should always be transparent," and "the Regulator – or the members of a CIC – may
take action if a CIC director's remuneration appears to be too high... If a CIC pays its directors
more than they are really worth to it and the community that it serves, it may well be breaching
the asset lock." In Powers: excessive role-holder compensation is treated as a disguised asset-lock
breach, not merely a governance quality issue. A mandate that pays salaries or bounties to admin/
executive roles from treasury funds should carry an explicit reasonableness check (e.g. a cap
relative to treasury size or a peer/member veto via `StatementOfIntent`) rather than being left to
unconstrained executive discretion — both members and an external-style oversight role should have
standing to challenge it.

"Stakeholder Engagement" / "Community Interest Report" sections: CICs must annually demonstrate
"what the CIC has done to benefit the community, how it has consulted those affected by its
activities and the outcome of such consultation" via the CIC34 report, and the Regulator can act on
that report and on complaints. In Powers: this is an argument for a recurring, mandatory disclosure
mandate (a scheduled `StatementOfIntent` or report-style `PresetActions` call) rather than
ad hoc, voluntary reporting — accountability mechanisms that are optional tend to lapse precisely
when an organisation is under-performing its stated purpose, which is when disclosure matters most.

"Regulator's Role" section: the regulator is explicitly a "'light touch' Regulator" that does "not
envisage pro-active supervision of individual CICs" — most of its time is spent on registration and
processing special resolutions, not ongoing monitoring; it intervenes mainly on complaint. In
Powers: external/community oversight roles should be designed as complaint-driven (reactive,
triggered by a `StatementOfIntent` veto or challenge mechanism) rather than requiring constant
active monitoring, which is both more realistic for volunteer-staffed oversight roles and more
consistent with how the source describes effective light-touch regulation working in practice.

---

## What to skip

This is a UK administrative/legal compliance document with no on-chain equivalent for most of its
content: Companies House registration mechanics, the CIC34 annual report form and its specific
field requirements, the "Confirmation Statement" filing obligation, share redemption/repurchase
rules under sections 30(1)–(2) of the CAICE Act and regulations 24–25 of the CIC Regulations 2005,
the performance-related interest cap on debentures (fixed at 20% since October 2014), the
"Exclusions" section barring political parties/campaigning organisations from CIC status (a
UK-specific eligibility rule, not a governance design pattern), and the Regulator's statutory
investigation powers under section 42/Schedule 7 of the CAICE Act (modeled on Companies Act
investigatory powers with no on-chain analogue — Powers' transparent action log already provides
the equivalent visibility without needing an investigatory body). The "Community Interest Test"
wording (a "reasonable person" standard for community benefit) is a legal-eligibility threshold for
UK incorporation, not a parameter that maps to a mandate.

---

## Mandate implications

- The asset lock (Asset Lock section) supports a structural, non-reformable transfer restriction:
  encode allowed recipients for treasury-outflow mandates as a fixed allow-list checked via
  `needFulfilled`, and exclude the lock-enforcing logic from the `Adopt_Mandates`/`Revoke_Mandates`
  reform surface entirely rather than making it an ordinary adjustable parameter.
- The four-branch transfer justification (Asset Lock – Transfer of Assets) supports a multi-path
  `needFulfilled`/`needNotFulfilled` gate in front of treasury-outflow mandates, with below-market
  transfers requiring an explicit prior approval step (`StatementOfIntent`) rather than a single
  boolean check.
- The irreversibility of the guarantee-vs-shares choice (Limited by Shares / Limited by Guarantee
  section) supports treating core electoral-mandate choice (one-account-one-vote vs. weighted) as a
  foundational, non-revisitable design decision rather than a parameter exposed to ordinary reform.
- The dividend cap (Explanation of Current Dividend Cap) supports hard-coding a fixed maximum
  percentage of treasury outflow to non-locked recipients in distribution mandates, rather than
  leaving it to a discretionary vote each time.
- The remuneration-as-asset-lock-breach framing (Remuneration section) supports adding a
  reasonableness check or member veto (`StatementOfIntent`) to any mandate that pays role holders
  from treasury funds.
- The light-touch/complaint-driven regulator model (Regulator's Role section) supports designing
  oversight/accountability mandates as reactive challenge mechanisms rather than mandates requiring
  constant active monitoring.
- The "no ways out except dissolve or convert" constraint (Things to Consider section) supports
  pre-registering a wind-up successor address at deployment time, rather than requiring a
  discretionary governance vote to determine the destination of locked treasury assets during
  dissolution.
