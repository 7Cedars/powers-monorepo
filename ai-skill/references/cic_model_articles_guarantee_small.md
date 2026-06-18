# UK CIC Model Articles — Limited by Guarantee, Small Membership

**Citation:** "Articles of Association of [Community Interest Company/C.I.C.] (CIC Limited by
Guarantee, Schedule 1, Small Membership)", UK Companies House model articles template,
V1.2 08/01/26, made under the Companies Act 2006 and the Community Interest Company
Regulations 2005 (Schedule 1).
**Analytical level:** Structural + Parametric
**Most relevant design decisions:** Q1, Q5, Q6, Q7

---

## Q1 — Role Structure

Article 11 ("Directors' general authority"): Directors are "responsible for the management of
the Company's business, for which purpose they may exercise all the powers of the Company,"
subject to the Articles. This is a single executive role with near-total default authority — the
direct analogue of an `allowedRole` with broad `OpenAction` access. Any design adapting this
template must deliberately narrow that grant by mandate, since the base template imposes no
functional split.

Article 22.3 ("Members' reserve power"): members may "by special resolution, direct the
Directors to take, or refrain from taking, specific action," and Article 22.2 confirms that no such
resolution invalidates prior Director action. This is a textbook `StatementOfIntent`-then-override
pattern: it is not a veto over a specific proposal but a standing reserve power exercised by special
resolution. In Powers terms, model this as a high-threshold `BespokeAction_Simple` available to
the member role, layered above (not blocking) the Directors' ordinary `OpenAction` authority,
since it cannot retroactively unwind completed Director decisions.

Article 23.4 ("Methods of appointing Directors") makes membership and directorship coextensive
by construction: "Each member of the company shall be a Director" (Article 23.3 in the index;
confirmed by Article 27(f), termination of directorship on ceasing to be a member). This collapses
the classic principal/agent separation between "members who appoint" and "directors who
manage" — there is structurally only one role layer. Any Powers design based on this template
should treat "member" and "director" as a single `allowedRole`, not two, unless the designer
deliberately reintroduces a non-director membership tier (which the base template does not
support).

Article 12.3 ("Chair"): the Directors "may appoint one of their number to be the chair... and may
at any time remove him or her from office" — an internal, peer-revocable sub-role with no
distinct authority beyond a tie-breaking vote (Article 17.3). This maps to a thin `PeerSelect` +
`RevokeAccountsRoleId` pairing scoped only to the chair-designation role, not to substantive
decision power.

---

## Q5 — Membership Design

Article 23.4 (becoming a member): "No person shall be admitted a member of the Company unless
he or she is approved by the Directors," and Article 23.5 requires a written application. This is a
closed, gatekept membership model — the existing Director body controls entry. Map directly to
`PeerSelect` with `allowedRole` = the existing member/Director role, not `SelfSelect`. Because
membership and directorship are fused (see Q1), the same `PeerSelect` mandate effectively
governs both board composition and the franchise.

Article 24.1 ("Termination of membership"): "Membership is not transferable to anyone else."
This forecloses any market-style transfer of governance rights — there is no share-equivalent that
can change hands. In Powers terms, do not pair this template with any token-delegation or
transferable-role mandate; the role must be re-granted by `PeerSelect`/admin action each time,
never assigned by secondary transfer.

Article 24.2 (termination triggers): membership ends automatically if "the member dies or ceases
to exist," "otherwise in accordance with the Articles," or "a member ceases to be a Director."
Because directorship termination (Article 21) includes failing to attend three consecutive Director
meetings (Article 21(e)) and resignation (21(d)), inactivity is a built-in, self-executing exit
condition. This is the design rationale for an automatic, non-discretionary
`RevokeAccountsRoleId` trigger keyed to attendance/participation data, rather than requiring an
affirmative vote to remove an inactive member.

Article 10 ("Liability of members"): liability is capped at £1 per member as a guarantee, payable
only on winding up. There is no proportional financial stake, so membership weight in this
template is strictly one-account-one-vote by construction — consistent with the Powers core
design (no weighted voting) and a strong argument for using this template (rather than the
shares variants) whenever the designer wants to avoid any temptation toward stake-weighted
extensions.

---

## Q6 — Adaptive Capacity

Article 22.1/22.2 (members' reserve power, special resolution) is the primary self-correction lever
in this template: members can direct Directors by special resolution (Article 25.6.2 sets the
written-resolution special-resolution threshold at "not less than 75% of the total voting rights of
eligible members"). In Powers terms, this 75% threshold is a strong calibration anchor for
`Adopt_Mandates`/`Revoke_Mandates` votingPeriod and quorum settings when the organisation
wants member reform power to be exercisable but deliberately hard to reach — much higher than
an ordinary majority (Article 25.6.1, "simple majority of the total voting rights").

Article 28.10(d) ("Exclusion of model articles"): the template explicitly excludes the unmodified
statutory model articles for a company limited by guarantee, confirming the whole document
operates as the alteration mechanism itself — these Articles are themselves a bespoke variant.
This underlines that the equivalent on-chain step (deploying a `MandatePackage` that fully
supersedes a prior governance flow rather than incrementally patching it) is the appropriate
mapping when an organisation is replacing a default/generic flow rather than tuning an existing
one.

The fixed minimum Director quorum of two (Article 16.2: "it must never be less than two") and
the fallback rule in Article 16.3 — when Director numbers drop below quorum, the only
permitted decisions are to appoint further Directors or call a general meeting to enable members
to appoint further Directors — is a hard-coded recovery path for board collapse. This is the
direct precedent for a `PauseMandates`-with-restart design: when a critical role's headcount falls
below its functional minimum, the only live mandates should be those that restore headcount, not
ordinary business mandates.

---

## Q7 — Accountability

Article 19 (conflicts of interest): a Director with a Conflict of Interest must "remain only for such
part of the meeting as... is necessary to inform the debate," "not be counted in the quorum for that
part of the meeting," and "withdraw during the vote and have no vote on the matter" (Articles
19.3.1–19.3.3). This is a precise on-chain analogue for a `needNotFulfilled` gate: a role-holder
flagged with a declared conflict should be excluded from both the quorum count and the vote
tally for the specific action, not merely asked to recuse informally.

Article 19.6 (Directors' power to authorise a conflict): the board can pre-authorise a Director's
conflicted position and "decide that the Director with a Conflict of Interest can participate in a
vote on the matter and can be counted in the quorum" (19.6.2). This is a deliberate override of the
default exclusion rule, gated by an antecedent board decision — map to a `needFulfilled`
dependency where the conflict-override mandate must execute before the conflicted vote is
admissible, otherwise the default exclusion in Article 19.3 applies.

Article 21(e) ("Termination of Director's appointment"): failure to "attend three consecutive
meetings of the Directors" combined with a Director resolution is an automatic-trigger removal
condition requiring no special resolution or member vote — the lowest-friction accountability
mechanism in the document, exercisable by the board's own ordinary majority (Article 17.1). Map
to `RevokeAccountsRoleId` with `allowedRole` = the Director/board role itself (peer accountability)
rather than requiring escalation to the member layer, since members and Directors are the same
people here.

Article 21.D (footnote 15): "The board of directors cannot remove a director other than in
accordance with the provisions in article 23 [sic, 21] and the Companies Act 2006." This is an
explicit closed-list constraint on removal grounds — removal is not a general discretionary power
of the board. In Powers terms: `RevokeAccountsRoleId` triggers for a core role should be tied to
specific, named conditions (attendance failure, legal incapacity, resignation) rather than an
open-ended majority-vote removal, to avoid converting a removal mechanism into a covert no-
confidence weapon.

---

## What to skip

Article 4 (Asset Lock formalities), Article 10 (the £1 guarantee mechanics), Articles 26–36
(records, minutes retention periods, indemnity/insurance boilerplate), and the Schedule
(definitions of "Electronic Means," "Hard Copy Form," company-seal-adjacent terms) are UK
company-law and regulator-specific mechanics with no on-chain analogue — they do not change
any mandate design choice. The requirement to file annual reports/returns/accounts with the
Regulator (Article 28) and the registered-office/communications rules (Article 26) are statutory
filing mechanics, not governance design choices, and should be skipped entirely.

---

## Mandate implications

- Because membership and directorship are fused (Article 23.3/27(f)), design a single
  `allowedRole` for both, governed by one `PeerSelect` mandate for entry (Article 23.4) and one
  `RevokeAccountsRoleId` mandate for exit/removal (Article 21) — do not build a separate
  member-tier role unless deliberately diverging from this template.
- The members' special-resolution reserve power (Article 22.1, 75% threshold in Article 25.6.2)
  should be implemented as a high-threshold `BespokeAction_Simple` that directs but cannot
  retroactively void Director action (Article 22.2) — set `votingPeriod` long enough to reach 75%
  turnout, reflecting the deliberate difficulty of invoking this power.
- Non-transferable membership (Article 24.1) rules out any token-delegation or share-style
  mandate; role assignment must always run through `PeerSelect`/admin re-grant, never through
  a transfer mechanism.
- Automatic membership/directorship termination on three consecutive absences (Article 21(e))
  should be implemented as a `RevokeAccountsRoleId` trigger gated on an attendance-tracking
  `needFulfilled` condition, exercisable by ordinary board majority — keep this distinct from any
  higher-threshold removal-for-cause mandate.
- The conflict-of-interest exclusion from quorum and vote (Article 19.3) should be implemented
  as a `needNotFulfilled` condition on the specific action: a role-holder with a declared/flagged
  conflict is excluded from both the quorum calculation and the vote tally for that action only,
  unless a prior `needFulfilled` board-authorisation mandate (Article 19.6) has cleared them.
- The quorum-collapse recovery rule (Article 16.3) should be implemented as a `PauseMandates`
  state: when a role's headcount drops below its functional minimum, only mandates that restore
  headcount (i.e., admission mandates) remain live until quorum is restored.
