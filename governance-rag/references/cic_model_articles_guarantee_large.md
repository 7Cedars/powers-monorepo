# UK CIC Model Articles — Limited by Guarantee, Large Membership

**Citation:** Model Articles of Association, Community Interest Company Limited by Guarantee
(Schedule 1, Large Membership variant), UK Companies House / Office of the Regulator of
Community Interest Companies template, V1.2, under the Companies Act 2006 and the Community
Interest Company Regulations 2005 (as amended).
**Analytical level:** Structural + Parametric
**Most relevant design decisions:** Q1 (role structure), Q2 (voting parameters), Q5 (membership
design), Q6 (adaptive capacity/reform), Q7 (accountability/monitoring)

---

## Q1 — Role Structure

Art. 8: "Subject to the Articles, the Directors are responsible for the management of the
Company's business, for which purpose they may exercise all the powers of the Company." This is
a maximally broad executive grant — the Powers analogue is an admin/executive role with
`OpenAction` over essentially the entire treasury and operations, constrained only by the
Articles themselves. A constitution copying this structure unmodified concentrates too much
unchecked authority in one role; Powers designs should narrow this to `BespokeAction_Simple`
or `PresetActions` per function unless a genuine reserve power exists (see Art. 9 below).

Art. 9.1: "The members may, by special resolution, direct the Directors to take, or refrain from
taking, specific action." This is the members' reserve power — a structural override that sits
above the Directors' general authority. In Powers terms, this is a `StatementOfIntent` or
binding-vote mandate held by the general membership role that can override or pre-empt the
admin role's `OpenAction`, but the threshold (special resolution = 75% per Art. 45.1, see Q2) is
high, so it functions as an emergency brake rather than routine governance.

Art. 11.1–11.3, Art. 12: Directors may delegate "any of the powers conferred on them" to "such
person or committee," "by such means," "to such an extent," "in relation to such matters," and
"on such terms," and may revoke any delegation. This is a clean precedent for layered mandate
design: a top-level admin role (Directors collectively) can spin up subordinate roles
(committees) with narrower, revocable grants. Map to Powers as: admin role holds `Adopt_Mandates`
and `Revoke_Mandates` to create and dissolve narrower-scoped mandates for committee-equivalent
roles, with the parent role retaining override.

Art. 24(e)–(f): Two distinct director-removal tracks exist — (e) automatic removal by the other
Directors for non-attendance at three consecutive meetings (a peer-enforced, no-vote-needed
mechanism), and (f) removal by ordinary resolution at a general meeting, "provided the meeting
has invited the views of the Director concerned and considered the matter in the light of such
views." This dual-track structure separates *peer accountability* (board self-policing for
disengagement) from *membership accountability* (members' vote for substantive removal). In
Powers: assign automatic non-performance removal to a `RevokeAccountsRoleId` triggered by a
director-peer role with a `needFulfilled` attendance-tracking condition, and assign substantive
removal to a separate `RevokeAccountsRoleId` gated by a member-role vote with a mandatory
hearing/representations step (a `StatementOfIntent` from the affected Director before the vote
closes).

Art. 23.2: Directors may be appointed "by ordinary resolution" (members) or "by a decision of
the Directors" (co-optation). Two parallel appointment pathways exist at a lower threshold than
removal. In Powers: a director role can be filled by either `PeerSelect` (existing directors
co-opt) or a member-roleholder vote, giving flexibility without requiring a special-resolution
threshold for routine appointments — but note that removal under Art. 24(f) requires a vote with
procedural safeguards, so appointment and removal need not (and should not) be symmetric in
difficulty.

---

## Q2 — Voting Parameters

Art. 16.2: Director quorum "must never be less than two, and unless otherwise fixed it is [two]."
This is a hard floor — a minimum-viable quorum for any executive decision body. Translate
directly to a Powers `votingPeriod`/quorum parameter floor: never configure an executive-role
quorum below 2 distinct accounts, regardless of total role size, to prevent single-actor capture
even when delegation is otherwise broad.

Art. 18.1–18.3: Director decisions are by majority vote, one vote per Director (no weighting),
with the Chair holding a casting vote on ties. This is one-account-one-vote at the executive
layer, directly consistent with Powers' core design philosophy (no weighted voting). The casting
vote for ties is a tie-breaking mechanism Powers designs should make explicit: either assign a
distinguished tie-breaking account, or specify that ties default to no-action (fail-safe) rather
than relying on an undefined resolution rule.

Art. 30.2: General meeting quorum is "two persons entitled to vote ... or 10% of the total
membership ..., whichever is greater." This is a hybrid floor-plus-proportional quorum rule
calibrated for variable membership size — at small scale the absolute floor binds; at large
scale the percentage binds. For Powers `votingPeriod`/quorum design in a membership role of
unknown or growing size, use this hybrid formula rather than a single fixed number: it prevents
both the "two members control a 10,000-member DAO" failure mode and the "quorum is technically
unreachable once membership grows" failure mode.

Art. 30.3: If quorum is not met within half an hour, the meeting is automatically adjourned to
"the same day in the next week," and at the reconvened meeting "those present and entitled to
vote shall be a quorum" — i.e., the quorum requirement is waived on the second attempt. This is
a concrete anti-deadlock design: a governance system should specify a fallback rule that
guarantees a decision can eventually be reached even if the primary quorum is never met. In
Powers: pair a `votingPeriod` with a secondary, lower (or zero) quorum threshold that activates
automatically if the first vote round fails to reach quorum, rather than leaving the proposal
permanently stuck.

Art. 39.1–39.2: One vote per person on a show of hands; one vote per member on a poll — both
strictly one-member-one-vote with no multi-voting even for proxies holding multiple
appointments. Reinforces that the guarantee-company (membership, not shareholding) structure is
the closest legal analogue to Powers' one-account-one-vote default; no `allowedRole` should be
calibrated using a per-share or capital-weighted formula when modelling this type of
organisation.

Art. 44.1, 45.1: A written/special resolution requires 75% of total voting rights ("not less
than 75%"); an ordinary resolution (written) requires a simple majority. This two-tier threshold
— simple majority for routine business, 75% supermajority for constitutionally significant
action — is the calibration point for `votingPeriod` and pass-threshold design on any
`Adopt_Mandates` / `Revoke_Mandates` action versus a routine `OpenAction` proposal.

---

## Q3 — Mandate Selection

Art. 11.1–11.2 (delegation power) combined with Art. 9 (members' reserve power) demonstrates a
template that deliberately keeps the executive grant broad (Art. 8) but layers two independent
correction mechanisms on top: a permissioned delegation/revocation chain (Directors → committees)
and a membership override (special resolution). This maps to a Powers mandate-selection
principle: when an organisation's executive role is given broad `OpenAction`-equivalent power
because its functions cannot be fully enumerated in advance (cf. "all such lawful things as may
further the Company's objects," Art. 6), compensate by ensuring at least one independent role
(the broad membership) retains a `StatementOfIntent`-or-stronger override that does not depend
on the executive's cooperation to invoke.

---

## Q5 — Membership Design

Art. 27.1–27.4: First members are subscribers to the Memorandum; subsequent admission requires
(a) Director approval and (b) a completed application "in such form ... as the Directors
require." This is gatekept, not open, membership — the admission decision sits entirely with the
existing executive role. In Powers terms this is `PeerSelect`-style gatekeeping (the controlling
role vets new entrants) rather than `SelfSelect`; design constitutions modelled on this template
with a `PeerSelect`-gated entry mandate for the membership role, not an open `SelfSelect`.

Art. 28.1–28.2: Membership is non-transferable and terminates on death/cessation, "otherwise in
accordance with the Articles," or by expulsion. Expulsion requires a Directors' meeting with at
least half the Directors present, passing a resolution "on the ground that his or her continued
membership is harmful ... to the interests of the Company," but only after 14 Clear Days' notice
specifying the alleged grounds and "a reasonable opportunity of being heard ... or of making
written representations." This is a due-process-gated removal: notice + grounds + hearing +
vote, not summary expulsion. Map to Powers as a `RevokeAccountsRoleId` mandate that requires
(i) a `needFulfilled` notice-period delay, (ii) a `StatementOfIntent` step allowing the targeted
member to submit a defence on-chain before the vote closes, and (iii) a Directors-equivalent
role vote (not a unilateral admin call) to execute. An expelled member remains liable for "any
subscription or other sum owed" — i.e., expulsion does not extinguish financial obligations, a
detail relevant if the Powers constitution ties membership to a staking or bond mechanism.

Art. 39.5 (Member Organisations / Authorised Representatives): when a member is itself an
organisation rather than an individual, it nominates an "Authorised Representative" by written
notice, and the Company need not verify the appointment internally — "conclusive evidence" of
authority is the notice itself. This is a delegation-of-voting-identity pattern relevant to any
Powers design where a `roleId` may be held by a multisig, DAO, or other composite entity rather
than a single EOA: the constitution should specify how that entity's single on-chain vote is
authorised internally, analogous to nominating an Authorised Representative, rather than leaving
this undefined.

---

## Q6 — Adaptive Capacity

Art. 9.1–9.2: The members' special-resolution reserve power to direct or restrain the Directors
explicitly "does not invalidate anything which the Directors have done before the passing of the
resolution" — i.e., the override is prospective only, not retroactive. This is a clean rule for
any Powers `Revoke_Mandates` or override mechanism: revoking or overriding a mandate should not
unwind already-executed actions; design `Revoke_Mandates` to be forward-looking by default unless
the constitution explicitly adds a clawback mechanism.

Art. 44.1–44.2: Ordinary resolutions can be amended at the meeting by ordinary resolution if
notice is given 48 hours in advance and the amendment doesn't "materially alter the scope."
Special resolutions can only be amended for "grammatical or other non-substantive error" — i.e.,
the amendment power is calibrated to the same threshold tier as the underlying resolution.
Translate to Powers: a proposal under a low-threshold mandate can be amended pre-vote by the same
low threshold; a proposal under a high-threshold mandate (`Adopt_Mandates`-equivalent) should only
permit cosmetic amendment, not substantive amendment, without restarting the higher-threshold
process — this prevents threshold-laundering (proposing something innocuous at a low bar, then
amending it into something substantive without re-triggering the high bar).

Art. 52: Asset Lock (Art. 3.1–3.5) restricts the Company from transferring assets other than for
full consideration, except to a specified asset-locked body or for community benefit, and on
winding-up requires residual assets to go to the specified asset-locked body. This statutory
asset lock is a permanent, non-amendable constraint on the treasury — it cannot be removed by
ordinary governance and is enforced by the external Regulator, not by the company's own
resolution mechanisms. The design lesson for Powers: a constitution can include an "asset lock"
analogue — a treasury-disbursement mandate with a hard-coded, non-revocable destination
restriction (e.g., a `needFulfilled` check against a fixed allow-list of recipient addresses) that
sits outside the scope of any `Adopt_Mandates`/`Revoke_Mandates` reform power, ensuring no future
governance vote — however large the majority — can redirect treasury assets to extractive uses.

---

## Q7 — Accountability

Art. 20–22 (Conflicts of Interest): A Director with a Conflict of Interest must declare it,
remain only for the portion of a meeting "necessary to inform the debate," not be counted in the
quorum for that part, and withdraw during the vote. This is a structural conflict-screening
mechanism distinct from removal — it operates per-decision rather than as a sanction. In Powers,
this maps to a `needNotFulfilled` condition on a specific role's voting weight for a specific
proposal: if a role-holder has a declared conflict on proposal X, their vote should not count
toward quorum or the tally for X, without requiring full role revocation. This is a more
proportionate accountability tool than binary `RevokeAccountsRoleId` and should be offered as a
standard option for any role with discretionary spending power.

Art. 24(e): Automatic removal for failing to attend three consecutive Directors' meetings,
contingent on "the Directors resolve that the Director be removed for this reason" — i.e., the
trigger is objective (3 absences) but the consequence still requires an affirmative peer vote,
not fully automatic ejection. This is a graduated accountability design: an objective, easily
monitored failure condition feeds into a discretionary peer-review gate rather than triggering
removal immediately. Useful Powers pattern: a `needFulfilled` attendance/participation tracker
that *unlocks* (rather than directly triggers) a `RevokeAccountsRoleId` vote, preserving peer
discretion over the ultimate sanction while still creating an objective, auditable accountability
record.

Art. 48 (Minutes): Directors must keep minutes of "all appointments of officers," "all
resolutions," and "all proceedings at meetings," retained for at least ten years, and minutes
signed by the chair are "sufficient evidence of the proceedings" against any member or Director.
This is an off-chain analogue of Powers' on-chain action log — the template treats a durable,
authoritative record of decisions as a baseline accountability requirement, not an optional
extra. Confirms that any Powers constitution should treat the on-chain action/vote history as
satisfying (and exceeding) this requirement automatically, but also suggests off-chain
constitutions reviewed against this template should not assume informal recordkeeping is
sufficient — a `StatementOfIntent` audit trail or similar explicit record may be needed for
governance actions that don't naturally leave on-chain residue.

---

## What to skip

Skip the share-certificate and share-transfer mechanics entirely (not applicable — this is a
guarantee company with no share capital). Skip the registered-office, common-seal, and
statutory-filing provisions (Art. 49 records and accounts, Companies House filing deadlines) —
these are UK company-law administrative requirements with no on-chain governance analogue. Skip
the indemnity/insurance provisions for Directors (Art. 50–51) — standard liability-shielding
boilerplate, not a governance design choice. Skip the detailed "Electronic Means"/"Address"
definitional plumbing in the Schedule — this is legal-drafting precision for UK notice-service
rules, not a transferable design principle. The £1 guarantee liability cap (Art. 7) is a
UK-guarantee-company-specific liability mechanism with no Powers equivalent (Powers roles do not
carry personal financial liability by default).

---

## Mandate implications

- The Directors' broad general-authority grant (Art. 8) combined with the members' special-
  resolution override (Art. 9) supports designing an admin role with wide `OpenAction` scope
  *only if* a separate membership role retains an independently triggerable
  `StatementOfIntent`-or-binding-vote override that does not require the admin's cooperation.
  Never grant unconstrained `OpenAction` without this counterweight.
- Director removal for cause (Art. 24(f)) requires the constitution to build in a mandatory
  hearing step before a `RevokeAccountsRoleId` vote closes — implement this as a
  `StatementOfIntent` window for the targeted account that must elapse (or be explicitly waived)
  before the revocation vote can execute.
- The hybrid quorum formula (Art. 30.2: "2 persons or 10%, whichever is greater") should be the
  default `votingPeriod`/quorum calibration for any membership role of variable or unknown size,
  rather than a single fixed absolute number.
- The automatic-adjournment-with-quorum-waiver fallback (Art. 30.3) should be built into any
  `votingPeriod` design as a secondary, lower-threshold round that activates if the primary
  quorum is not met within a defined window — preventing permanent deadlock.
- Membership admission gatekept by the existing executive role (Art. 27.3) maps to `PeerSelect`
  gating for the membership role's entry mandate, not `SelfSelect` — large-membership CIC
  templates of this kind are not open-membership by default.
- The conflict-of-interest screening mechanism (Art. 20–21) should be implemented as a
  per-proposal `needNotFulfilled` condition that excludes a conflicted role-holder's vote from a
  specific tally, offered as a less drastic alternative to full `RevokeAccountsRoleId`.
- The statutory asset lock (Art. 3) is a model for a non-amendable treasury-destination
  restriction that sits outside the reach of `Adopt_Mandates`/`Revoke_Mandates` — any Powers
  constitution intending a similar "no future vote can redirect treasury to extractive uses"
  guarantee should hard-code the restriction at the mandate level rather than relying on a
  reformable governance rule.
- The amendment-threshold-matching rule (Art. 44) — amendments to high-threshold resolutions may
  only be cosmetic, not substantive — should be enforced wherever a Powers proposal can be amended
  pre-vote, to prevent threshold laundering.
