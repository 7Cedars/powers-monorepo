# Wikipedia 2026 — Community Interest Company

**Citation:** Wikipedia contributors. "Community interest company." *Wikipedia, The Free
Encyclopedia*. Retrieved version oldid=1350831293.
**Analytical level:** Structural
**Most relevant design decisions:** Q1, Q3, Q5

---

## Q1 — Role Structure

§History: Before the CIC regime existed, "limited companies that do not have charitable
status find it difficult to ensure that their assets are dedicated to public benefit." The
CIC form was created specifically to fill a structural gap between two existing role
configurations: an ordinary company (no community-benefit constraint on the board or on
asset distribution) and a charity (community-benefit constraint, but board members
generally cannot be paid and must cede strategic control to a volunteer board). In Powers
terms, this is a trade-off between `allowedRole` breadth for the executive role and the
presence of a structural constraint (the asset lock) that survives regardless of who holds
that role. A constitution can replicate the CIC's middle position by combining a paid,
empowered executive role (broad `allowedRole` on `BespokeAction_Simple`/`OpenAction`) with
an asset-lock-style constraint that is *not* role-gated — i.e., a `needFulfilled` check on
treasury-affecting mandates that is independent of who currently holds the executive role.

§Comparison with charities: "the founder of a social enterprise who wishes to be paid cannot
be on the board and must give up strategic control of the organization to a volunteer
board, which is often unacceptable" under the charity-equivalent model. This is the central
role-structure trade-off the CIC form resolves: it decouples "receives compensation" from
"loses governance authority." Designs that conflate compensation eligibility with exclusion
from decision-making roles are imposing the charity-style constraint by default — that
should be a deliberate choice, not an accidental one, when assigning `allowedRole` for paid
operator roles versus deliberation/oversight roles.

§Formation and registration: A CIC is only a legal form for "limited companies, either
limited by shares or limited by guarantee" — registered societies and unincorporated
associations cannot become CICs. The lesson for Powers is structural rather than literal:
not every governance pattern is compatible with every legal/organisational substrate. When
recommending a constitution, check what the underlying legal wrapper actually permits (e.g.,
a foundation-wrapped Powers instance may not support the same role/asset patterns as an
unincorporated DAO) before recommending mandates that assume unconstrained flexibility.

---

## Q3 — Mandate Selection

§Lead/Characteristics: The CIC exists to serve organisations "wishing to establish
businesses which trade with a social purpose... or to carry on other activities for the
benefit of the community," while keeping "the flexibility and certainty of the company
form." This is a hybrid-goods governance problem: the organisation behaves like a private
enterterprise (revenue-generating, operationally flexible) but is required to produce a
public good (community benefit) as a structural commitment, not a discretionary choice.
This maps to a hybrid mandate pattern: operational mandates (`OpenAction`,
`BespokeAction_Simple`) should be unconstrained for ordinary business activity, but any
mandate capable of moving the treasury or dissolving the organisation must be gated by a
`needFulfilled` check against the equivalent of the community-interest test — i.e., a
standing, non-bypassable constraint layered on top of otherwise-flexible execution. This is
distinct from a charity-pattern constitution, where the constraint would instead live in
`allowedRole` restrictions on who can propose financial mandates at all.

§Characteristics (community interest test exclusions): CICs cannot "be primarily focused
on political activity," "be set up to serve an unduly restrictive group," or "be a political
party... or a subsidiary of a political party." These are purpose-scope exclusions baked
into the registration gate itself, not into ongoing operational review. The Powers
equivalent is a one-time `needFulfilled` check at constitution-deployment time (verifying
the organisation's stated purpose against exclusion criteria) rather than a recurring
operational check — once admitted, the CIC's day-to-day activities are not re-screened
against the political-activity bar. Designs that want a CIC-equivalent purpose restriction
should implement it as a deploy-time gate, not a per-action mandate, to avoid imposing
recurring overhead on legitimate operational activity.

§Comparison with charities: "They are more lightly regulated than charities, which can be
advantageous. On the other hand they do not have the benefit of charitable status, such as
favourable tax treatment." This documents an explicit trade-off between regulatory burden
and external benefit (tax treatment) that the CIC form accepts deliberately. When a
constitution designer is choosing between a heavily-monitored governance pattern (many
`StatementOfIntent` deliberation gates, frequent `needFulfilled` checks) and a lightly
governed one, the CIC case shows that "light touch" is a legitimate design point when the
organisation accepts giving up certain external validations (status, funding eligibility,
trust signalling) in exchange for operational flexibility — it is not automatically an
accountability failure, provided the trade-off is made explicitly (see Q7 below for the
limits of this).

---

## Q5 — Membership Design

§Characteristics / §The asset lock: The community interest test requires that the
organisation not be "set up to serve an unduly restrictive group" — community benefit must
extend to "the community," or at least "a section of the community," but cannot be drawn so
narrowly that it excludes everyone but the founders. This is a boundary-rule constraint on
*who benefits*, distinct from membership in the governance sense (who holds roles). In
Powers terms this maps to a constraint on the `target`/beneficiary scope of execution
mandates, not on `allowedRole` for governance roles — the asset lock and community-interest
test bound what the organisation can do with its output/treasury, while role assignment
mandates (`SelfSelect`/`PeerSelect`) govern who participates in deciding. Conflating the two
(e.g., restricting governance-role eligibility instead of restricting beneficiary scope) is
a common design error this source helps clarify: the CIC's "community interest" test is not
a membership gate, it is an output/distribution gate.

§The asset lock: "Assets not applied directly for the benefit of the community may only be
exchanged for full value or transferred to another 'asset-locked body'." Critically, this
constraint survives changes in governance-role membership — it binds the organisation
itself, independent of who currently holds executive roles. The Powers equivalent is a
mandate-level constraint that is *not* revocable by ordinary role turnover: an asset-lock
style rule should be encoded so that changing who holds the executive role (via
`RevokeAccountsRoleId` + new `SelfSelect`/`PeerSelect` assignment) cannot also change where
treasury assets may flow. This argues for keeping the asset-lock check at the
`Adopt_Mandates`/`Revoke_Mandates` tier (a constitutional-level rule) rather than embedding
it in the operational executive role's permissions, where a role turnover could silently
remove it.

---

## What to skip

The History section's account of which named individuals (Paul Corrigan, Jane Steele, Greg
Parston, Stephen Lloyd) and which think-tank (Public Management Foundation) originated the
CIC proposal in 2001 is historical trivia with no transferable governance content. The
Formation and registration section's procedural detail — specific form numbers (IN01,
CIC34, CIC36, CIC37), filing fees (£35, £27 online since 2019), and the chain of approval
from Registrar to Regulator to Companies House — is UK-specific bureaucratic detail that
does not generalise to on-chain mandate design. The Regulator section's biographical detail
about the officeholder (Louise Smyth, also CEO of Companies House) and the five-year
appointment term by the Secretary of State are organisational facts about a specific
real-world regulator with no mandate-design analogue. Note also that this version of the
article (oldid=1350831293) does not contain a developed "Criticisms" section discussing
light-touch oversight as a weakness — that material, if it exists in other revisions, is not
present here, so no claim about regulator criticism should be sourced to this file.

---

## Mandate implications

- The CIC's core innovation — decoupling "can be compensated" from "loses strategic
  control" — implies that paid operator roles and deliberation/oversight roles should be
  designed as independent `allowedRole` assignments, not as a single combined role with an
  implicit compensation-vs-control trade-off baked in by default.
- The community-interest test (purpose-scope exclusions checked at formation) implies a
  one-time deploy-stage `needFulfilled` gate on organisational purpose, separate from
  recurring operational mandates — do not re-litigate purpose-scope on every action.
- The asset lock's persistence across changes in role-holders implies that asset-lock-style
  constraints belong at the `Adopt_Mandates`/`Revoke_Mandates` (constitutional) tier, not
  embedded in an operational executive role's `allowedRole` scope, so that ordinary role
  turnover (`RevokeAccountsRoleId` + reassignment) cannot inadvertently remove the
  constraint.
- The "light touch vs. charity-grade scrutiny" trade-off documented in the Comparison with
  Charities section is a legitimate design choice (lower governance overhead in exchange for
  fewer external validations) — designers should make this trade-off explicit rather than
  defaulting to maximal `StatementOfIntent` deliberation gates on every mandate.
- Community-benefit boundary rules (who the organisation must serve) should be encoded as
  constraints on execution-mandate `target`/scope, not as `allowedRole` restrictions on
  governance participation — these are two distinct design axes that this source helps
  separate cleanly.
