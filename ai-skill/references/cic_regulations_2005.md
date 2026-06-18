# The Community Interest Company Regulations 2005 — Reading Guide

**Citation:** The Community Interest Company Regulations 2005, SI 2005/1788, made under the
Companies (Audit, Investigations and Community Enterprise) Act 2004. UK Department of Trade and
Industry.
**Analytical level:** Structural + Parametric + Dynamic
**Most relevant design decisions:** Q1, Q3, Q4, Q5, Q6, Q7

---

## Q1 — Role Structure

Regulation 30–33 (Part 8, "Managers"): the Regulator of Community Interest Companies may appoint
a "manager" over the property and affairs of a CIC, set and disallow the manager's remuneration
(regulation 30), require the manager to post security (regulation 31), and remove the manager for
failure to discharge their duties after a formal notice-and-representations process (regulation
32). This is a distinct, externally-appointed role layered on top of the company's own directors —
not a replacement for them, but a parallel oversight role triggered by Regulator concern. In
Powers terms, this is structurally unlike any internal mandate: it is an external role with its
own appointment, remuneration, and removal mechanism, entirely outside the DAO's own role
hierarchy. There is no Powers mandate that creates a role appointed and removable by a party
outside the protocol's own membership — `RevokeAccountsRoleId` and `PauseMandates` are both
internal actions taken by roles the constitution itself defines.

Schedule 1, paragraph 3(2)–(3) (provisions for guarantee companies without share capital):
caps the proportion of directors that non-members may appoint or remove — non-member appointees
may never constitute a majority of the board, and the number of directors removed by non-members
in a financial year may not exceed the number of remaining directors. This is a structural rule
limiting how much external/non-member control can be exercised over the board even when the
constitution permits some external appointment power. In Powers terms: if a constitution grants
an external party (e.g., a funder or partner organisation) a role with `RevokeAccountsRoleId`
power over executive roles, this Schedule supports capping that external role's revocation power
— for example via a `throttleExecution` limit on revocation frequency, or a hard ceiling encoded
in the mandate's conditions — so that external influence cannot capture a majority of the
governing roles within a short window.

---

## Q3 — Mandate Selection

Regulation 10 / Schedule 2 vs. Schedule 3 (Part 3, "Requirements concerning the memorandum and
articles"): a CIC with share capital chooses between two alternative rule-sets — Schedule 2
(asset-locked: the company may not distribute assets to members at all, including no dividends,
no distribution on winding up beyond paid-up value, no share buybacks above paid-up value) or
Schedule 3 (distribution-permitted, but subject to the dividend/interest caps in regulations
17–22). This is a binary mandate-selection fork built into the legal form itself: an organisation
must decide up front whether it is a pure asset-lock vehicle or a capped-distribution vehicle, and
different downstream rules attach to each choice. In Powers terms, this maps directly onto a
treasury-mandate selection decision: choose between a treasury mandate with no payout path at all
(Schedule-2-equivalent — supports only `PresetActions` for programme spending, never distribution
to role-holders) versus a treasury mandate that permits capped payouts to members, gated by a
hard ceiling encoded in the mandate's parameters (Schedule-3-equivalent — an `OpenAction` or
`BespokeAction_Simple` with a `value` ceiling tied to a percentage of treasury holdings, mirroring
the "35 per cent of distributable profits" aggregate cap in regulation 22(1)(b)).

---

## Q4 — Dependency Chains

Regulation 13–15 (Part 5, "Alteration of objects"): a special resolution altering a CIC's stated
objects has no legal effect until the Regulator approves it; the registrar must not even record
the resolution or register the altered memorandum until the Regulator's approval notice is given
(regulation 15(6)). The Regulator's approval test (regulation 15(3)) requires that the altered
objects (a) comply with the statutory community-benefit requirement, (b) still satisfy the
community interest test, and (c) that the company has taken reasonable steps to notify persons
affected by its activities. This is a sequential dependency chain with an external gate: propose
→ notify affected parties → submit to external reviewer → only then does the change take legal
effect. In Powers terms, this is the strongest precedent in the CIC sources for gating
`Adopt_Mandates` or `MandatePackage` reform actions that change an organisation's stated purpose
behind a `needFulfilled` dependency on a prior `StatementOfIntent` notification step — the
Regulations explicitly treat "did affected parties get notified" as a precondition independent of
the vote itself, not a thing the vote alone satisfies.

Regulation 23(7)–(8), (11) (Part 6, "Distribution of assets on a winding up"): before directing
where residual assets go, the Regulator "must... consult the directors and members of the
company, to the extent that he considers it practicable and appropriate," must give notice of any
direction, and any member or director may appeal that direction to the Appeal Officer. This
establishes a consult-then-decide-then-appeal chain around the single highest-stakes treasury
action a CIC can take (final asset distribution). In Powers terms: a `PresetActions` or
`BespokeAction_Simple` mandate governing final treasury liquidation should not be a single-step
vote — it should be preceded by a `StatementOfIntent` consultation step and, ideally, followed by
a window in which a `needNotFulfilled` veto/appeal mandate can block execution before funds move.

---

## Q5 — Membership Design

Regulation 2 (interpretation) + Schedules 1–3 paragraph 1: the recurring "asset-locked body"
definition (a CIC, a charity, a Scottish charity, or an equivalent body outside Great Britain) is
the boundary device for where assets may permanently go — not a membership boundary in the usual
sense, but a *recipient-class* boundary that persists independent of who the current members are.
This is a novel boundary type relative to the existing reference library (Ostrom's user/resource
boundary pair, Carlisle's social/ecological fit): it is a boundary on transferees, not on
participants. In Powers terms, this supports a mandate design where a treasury mandate's `target`
parameter is restricted not to a fixed address but to a class predicate ("any address registered
as an asset-locked body" — operationalised on-chain as a registry of approved recipient
addresses) — a third boundary type alongside `allowedRole` (who can act) and `value` (how much),
namely *whom funds may flow to*, which persists even as `allowedRole` membership changes.

Schedule 1 paragraph 2(3)–(6) (membership in the guarantee-without-share-capital form): "No person
shall be admitted a member of the company unless he is approved by the directors," every applicant
must submit a written application "executed by him," membership is non-transferable, and
membership terminates if the member dies, ceases to exist, or as otherwise provided in the
articles. This is a closed-membership, director-gatekept entry pattern with no exit-sale option —
the Powers analogue is `PeerSelect` (admission requires approval by an existing role-holder body)
combined with a non-transferable role token, rather than `SelfSelect` or a tradeable membership
NFT. The "ceases to exist" termination ground (covering, e.g., a corporate member's dissolution)
is a precedent for an automatic, non-discretionary `RevokeAccountsRoleId` trigger tied to a
verifiable external state change, distinct from a discretionary removal-for-cause mechanism.

---

## Q6 — Adaptive Capacity

Regulation 13 (Part 5): "An alteration of the memorandum of a community interest company with
respect to the statement of the company's objects does not have effect except in so far as it is
approved by the Regulator." This is the single clearest example in the CIC source set of a
purpose-change gate that sits *outside* the organisation's own governance process — internal
members can vote unanimously to change their objects, and the change still has no legal effect
until an external body approves it. This is structurally different from anything currently in the
Powers mandate catalogue: `Adopt_Mandates`, `Revoke_Mandates`, and `MandatePackage` are all
self-contained — once the constitution's own `allowedRole` and `votingPeriod` conditions are
satisfied, the change takes effect immediately, with no external veto layer. A Powers constitution
that wants to reproduce this CIC pattern (e.g., a DAO whose mission must remain verifiably
aligned with an external funder's mandate, or a regulated entity's on-chain wrapper) would need a
`needFulfilled` dependency pointing at an oracle-attested external approval mandate — there is no
native "approval external to the protocol" primitive otherwise.

Regulation 16 (exemption from regulations 13–15 on conversion to charity status): a CIC converting
itself into a charity is exempted from the Regulator-approval requirement on object changes,
because charity law's own gatekeeping takes over. This is a precedent for a Powers design rule:
an external-approval gate on a reform mandate should be removable/bypassable only when an
equally strong alternative gate (not a weaker one) takes its place — the regulation does not
remove oversight, it substitutes one accountable oversight regime for another.

---

## Q7 — Accountability

Regulations 30–33 (Part 8, "Managers") together with the parent Act's appointment power: this is
the most novel accountability mechanism in this source relative to the rest of the reference
library. The Regulator can install an external manager over a CIC's property and affairs, fund
that manager's pay from the company's own income, require the manager to post a security bond,
and remove the manager (after due notice and a right to make representations, regulation 32(2)(d))
for failing to discharge their duties. This is genuinely *external* emergency oversight: a party
outside the organisation's own membership, accountable to a public regulator rather than to the
DAO's roles, with power to take over financial control. Compare/contrast directly with Powers'
internal-only emergency mechanisms:
- `PauseMandates` halts a mandate, but only an internal role with the right `allowedRole` can
  trigger it — there is no equivalent of an outside party pausing a Powers DAO's mandates without
  itself holding a role in that DAO.
- `RevokeAccountsRoleId` removes a role-holder, but again only via an internal mandate's own vote;
  it cannot be triggered by a party with no assigned role in the constitution.
- The CIC manager mechanism has no Powers equivalent at all: there is no protocol-level concept of
  an oracle-appointed external controller that can act on a Powers instance's treasury without
  holding any of that instance's own roles. Designers wanting this pattern would need to grant a
  specific external address (e.g., a multisig controlled by a funder or registry) a standing role
  with emergency `BespokeAction_Simple` powers, gated by `needFulfilled` on an attestation from
  that external party — effectively simulating regulatory appointment via a pre-arranged
  emergency role rather than a true outside-the-protocol intervention.

Regulation 26 (Part 7, "Community interest company report" — general requirements): every CIC
must publish, annually, "a fair and accurate description of the manner in which the company's
activities... have benefited the community" and "a description of the steps... taken... to
consult persons affected by the company's activities, and the outcome of any such consultation."
This is a standing, recurring, public-facing accountability report independent of any specific
vote or transaction — a different accountability mode than Powers' transaction-level on-chain
record (which shows *what* was done and by whom, but not a synthesised narrative of *who
benefited*). In Powers terms: this supports adding a recurring `StatementOfIntent` mandate (cadence
governed by `votingPeriod`, e.g. annual) whose content is a structured self-report rather than a
proposal — a "community interest report" mandate that any role can read and that creates an
on-chain record of the DAO's own account of its impact, reviewable independently of the
transaction log.

Regulations 17(1)(b) and 27 (dividend declaration and reporting): a dividend may be declared only
if "an ordinary or special resolution of the company's members has approved the declaration," and
the subsequent community interest company report must then disclose the amount declared, the
applicable cap, and how compliance was determined. This pairs a vote-gate with a mandatory
disclosure-after-the-fact — voting alone is not the accountability mechanism; the public report
closes the loop. In Powers terms: any treasury-distribution mandate (`OpenAction` or
`BespokeAction_Simple` with a payout target) should be paired with a `needFulfilled` link to a
subsequent disclosure `StatementOfIntent`, rather than treating the vote itself as sufficient
accountability — the regulation's design assumes votes can be procedurally valid yet still need
independent downstream disclosure to be checkable.

---

## What to skip

The statutory definition machinery for the "community interest test" (regulations 3–6: excluding
political-party and political-campaigning activity from counting as community benefit) is tied to
UK political-finance law and does not generalise — there is no on-chain equivalent of "political
campaigning organisation" that needs excluding by category. The Companies House filing mechanics
(Part 4, prescribed formation/conversion documents; Part 9, registrar-of-companies handling; Part
10, fee schedule in Schedule 5) are UK administrative process with no protocol analogue. The
Appeal Officer procedural rules (Part 11, regulations 37–42: notice format, time limits, dismissal
grounds) are UK administrative-tribunal procedure, not a governance design pattern — though the
underlying *existence* of an appeal channel against Regulator decisions is itself worth noting
under Q7 even though the specific procedure is not transferable. The precise numeric dividend/
interest cap formulas (regulation 22: "5 percentage points higher than the Bank of England's base
lending rate," "35 per cent of distributable profits") are UK-rate-pegged and not directly
portable, though the *existence* of a percentage-of-distributable-profits ceiling is the
actionable pattern (see Mandate implications below), not the specific 35% figure. Schedule 4's
average-debt calculation formula is pure accounting mechanics with no governance content.

---

## Mandate implications

- **Asset lock as a permanent, non-amendable treasury constraint.** Schedule 1 paragraph 1(1)
  ("the company shall not transfer any of its assets other than for full consideration," with
  narrow asset-locked-body exceptions) is the precedent for designing a treasury mandate whose
  core transfer restriction is *not* subject to ordinary `Adopt_Mandates` amendment — i.e., a
  constitutional-tier constraint that requires a fundamentally higher bar (or is hard-coded and
  genuinely non-upgradable) to change, versus an ordinary parameter that any successful vote can
  adjust. Treat "can members vote to remove the asset lock" as a design fork to decide explicitly,
  the same way UK law forces CICs to choose Schedule 2 (no removal path) vs. Schedule 3 (capped
  distribution permitted) at formation.
- **Dividend/distribution caps as a revocable parameter, asset lock as an irrevocable one.** The
  dividend cap (regulation 22) is explicitly designed to be *adjustable over time* by the
  Regulator with Secretary of State approval, with a mandatory three-month forward notice period
  before a new cap takes effect (regulation 22(4)(a)) — unlike the asset lock itself, which is
  structural and effectively permanent. Powers designs should mirror this two-tier distinction:
  a treasury mandate's payout-percentage ceiling can be an ordinary, votable `value` parameter
  (with a mandatory delay before changes take effect, mirroring the three-month notice — implement
  via `throttleExecution` or a deliberate `votingPeriod` floor on the parameter-change mandate
  itself), while the underlying prohibition on uncompensated transfers stays outside the ordinary
  amendment path entirely.
- **External emergency override has no native Powers equivalent — design it explicitly if wanted.**
  The Regulator's manager-appointment power (regulations 30–33) is a genuinely external-to-the-
  organisation emergency mechanism with no analogue among `PauseMandates`, `RevokeAccountsRoleId`,
  or any other internal mandate. If a constitution wants an external-emergency-override pattern
  (e.g., satisfying a funder, partner DAO, or legal wrapper's oversight requirement), it must be
  built explicitly as a standing role held by the external party, with its own `allowedRole` and
  emergency mandate set — Powers provides no implicit "regulator" concept, and conflating this
  with `PauseMandates` would misrepresent an internal mechanism as an external one.
- **Purpose/objects changes can be gated by an external dependency, not just an internal vote.**
  Regulation 13's "no effect except in so far as approved by the Regulator" is the precedent for
  chaining `Adopt_Mandates`/`MandatePackage` reforms that alter a DAO's stated purpose behind a
  `needFulfilled` link to an oracle-attested external approval, when the organisation's purpose
  must remain verifiably aligned with an outside standard (legal wrapper, grant conditions,
  registry membership) rather than being fully self-amendable by an internal vote alone.
- **Boundary on transfer recipients, not just on participants.** The recurring "asset-locked body"
  definition supports a third mandate-parameter boundary type beyond `allowedRole` (who acts) and
  `value` (how much): a recipient-class restriction on `target`, persisting independently of
  current role membership — useful for treasury mandates in organisations with a permanent
  mission commitment that should survive membership turnover.
- **Pair distribution votes with mandatory downstream disclosure.** Regulations 17(1)(b) + 27
  support adding a `needFulfilled`-linked `StatementOfIntent` disclosure step after any treasury
  distribution mandate executes, rather than treating the executing vote as accountability-
  complete in itself.
- **Cap external board/role influence even where some is granted.** Schedule 1 paragraph 3(2)–(3)'s
  ceiling on non-member-appointed/removed directors supports capping any external role's
  `RevokeAccountsRoleId` reach (e.g., via a hard ceiling or `throttleExecution` on revocation
  frequency) whenever a constitution grants outside parties some — but not full — control over
  internal roles.
