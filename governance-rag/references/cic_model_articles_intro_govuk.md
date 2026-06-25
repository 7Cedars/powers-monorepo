# GOV.UK 2025 — CIC Model Articles of Association: Introduction

**Citation:** UK Department for Business and Trade / Office of the Regulator of Community
Interest Companies, 2025. *CIC model Articles of Association: introduction.* GOV.UK. Updated
3 October 2025.
**Analytical level:** Structural (rationale for variant selection), with a minor Dynamic note on
constitutional irreversibility.
**Most relevant design decisions:** Q1 (role structure), Q3 (mandate selection), Q5 (membership
design)

---

## Q1 — Role Structure

"CIC model constitution: company limited by guarantee with a small membership" section: this
variant is "aimed at private companies limited by guarantee, all of whose directors are members of
the company and all of whose members are directors of the company. It assumes that the directors
will take most important decisions as directors rather than as members, and that directors may
hold office continuously for long periods of time without offering themselves for re-election. It
also allows, subject to certain minimum procedural safeguards, for relatively informal
decision-making by directors (including by email)." The rationale here is explicit: when the
member role and the director role are coextensive (same people, same set), formal separation
between a "membership vote" and a "board vote" is redundant overhead, so the model collapses them
and substitutes lightweight informal procedure (including decisions by email) for the heavier
voting machinery used when the two roles diverge. In Powers: when a designer is tempted to create
two separate roles (e.g. `member` and `admin`) that will in practice always be held by the same
accounts, this is a signal to collapse them into a single role with a single `allowedRole` value
and use a low-friction mandate (e.g. `StatementOfIntent` with a short `votingPeriod` or no
multi-step deliberation) rather than building parallel proposer/voter pathways for two roles whose
membership is identical.

"CIC model constitution: company limited by guarantee with a large membership" section, by
contrast: this variant is "aimed at private companies limited by guarantee, which have more members
than they have directors. Although it assumes that the directors will take most day to day
decisions about the company's business, it also gives the members a strong role in controlling the
overall governance of the company. The procedures for decision-making by directors are more formal
than in the other model constitutions." The rationale: once membership exceeds the director set,
day-to-day execution authority is delegated to a smaller director role for efficiency, but overall
governance control is deliberately kept with the larger membership, and director decision-making
procedure is made more formal (not less) precisely because directors are no longer self-policing
through identity with the membership. In Powers: this is the structural justification for
separating an `allowedRole` for routine execution mandates (a small executive role) from a broader
`allowedRole` for reform/oversight mandates (the full membership) once membership grows beyond the
executive set — and for adding stricter `votingPeriod`/quorum requirements on the executive role's
mandates as the principal-agent gap between members and directors widens, rather than keeping the
same informal procedure used in the small-membership variant.

---

## Q3 — Mandate Selection

The document's structuring choice itself is the key Q3 insight: it offers eight separate model
constitutions, varying along exactly two axes — guarantee vs. shares (with shares further split
into Schedule 2 vs. Schedule 3 by dividend eligibility), and small vs. large membership (i.e.
director-set equals member-set, or not). Every variant retains the same asset lock; what changes is
purely the decision-making and capital structure layered on top. In Powers: this models a reusable
design pattern — treat the asset-lock-equivalent (treasury transfer restriction, see
`cic_guidance_govuk.md`) as an invariant base layer common to every variant of an asset-locked
Powers DAO, and treat the choice of electoral/decision mandate (`SelfSelect` vs. `PeerSelect`
vs. token-weighted) and the choice of capital/dividend mandate (none vs. capped distribution) as
the two independent axes designers actually choose between. A `MandatePackage` for "asset-locked
community organisation" should be built as a small family of variants along these two axes, not as
a single one-size-fits-all package.

The "Plc (public company limited by shares)" section states flatly: "There are no model
constitutions for businesses wishing to become or convert to a CIC opting for public limited
liability (plc) status. In these cases you are advised to get independent legal advice." This is an
honest admission that the model-template approach does not scale to the most complex governance
case (public company with open share trading) — templates work for the common, well-understood
cases and intentionally stop short of the hardest one. In Powers: a mandate-package library should
similarly be explicit about which organisational shapes it does *not* have a ready-made package
for (e.g. fully open, freely-tradeable governance tokens with no asset lock), rather than stretching
a template to cover a case it wasn't designed for.

---

## Q5 — Membership Design

The director-equals-member vs. director-smaller-than-member distinction, restated across all four
small/large pairs (guarantee, Schedule 2 shares, Schedule 3 shares), is fundamentally a membership
boundary question: is the boundary of "who decides" identical to the boundary of "who has a stake,"
or is the stake-holding boundary wider than the decision-making boundary? The model articles treat
this as the single most important fork in governance design — more important than the
guarantee/shares distinction — since it is applied as the secondary split within each capital
structure. In Powers: when scoping `allowedRole` for a new organisation's core mandates, the first
design question should be "does the stakeholder set equal the decision-making set?" before any
other parameter choice (voting period, quorum, mandate type) is made, because the answer determines
whether informal/low-friction mandates (small membership case) or formal/higher-friction mandates
with broader `allowedRole` (large membership case) are appropriate.

---

## What to skip

This document is purely a navigational index: page 1 lists the eight model-constitution categories
and links to the underlying .doc templates (already covered by the parallel reading guides
`cic_model_articles_guarantee_large.md`, `cic_model_articles_guarantee_small.md`,
`cic_model_articles_shares_sch2_large.md`, `cic_model_articles_shares_sch2_small.md`,
`cic_model_articles_shares_sch3_large.md`, `cic_model_articles_shares_sch3_small.md`); the
"asset-locked body" contact details for the CIC Regulator's office (Companies House, Cardiff); the
Welsh-language company name suffixes; the schedule 1/2/3 statutory cross-references to the CIC
Regulations 2005 ("What needs to be done if a model constitution is not used" section); and the
caveat that red-highlighted clauses in the templates are statutory and must be retained verbatim.
None of this has an on-chain equivalent — it is UK company-law procedure for selecting and filing a
constitution, not governance design rationale. The "What needs to be done if a model constitution
is not used" section is purely a compliance checklist for drafting articles from scratch under UK
law and contains no design insight beyond what is already captured under Q1/Q3/Q5 above.

---

## Mandate implications

- The small-membership rationale (director-set equals member-set) supports collapsing redundant
  roles into a single `allowedRole` with a low-friction mandate (short or zero `votingPeriod`)
  whenever the designer notices that two proposed roles will always be held by identical accounts.
- The large-membership rationale (director-set smaller than member-set) supports splitting
  `allowedRole` between a small executive role (routine execution mandates) and the full membership
  (reform/oversight mandates), with stricter `votingPeriod`/quorum on the executive role's mandates
  as the membership-to-director ratio grows.
- The two-axis variant structure (capital structure x membership size) supports designing
  `MandatePackage` families along independent axes — asset-lock/treasury-restriction mandates as an
  invariant base layer, electoral mandate choice and distribution-mandate choice as the two
  variable axes — rather than a single monolithic package.
- The explicit absence of a plc-equivalent template is a reminder to scope mandate-package
  libraries honestly: state which organisational shapes (e.g. fully open, freely tradeable
  governance tokens with no lock) are out of scope rather than forcing an ill-fitting package onto
  them.
