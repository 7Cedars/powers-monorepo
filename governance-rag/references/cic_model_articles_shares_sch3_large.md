# UK CIC Model Articles — Limited by Shares, Schedule 3, Large Membership

**Citation:** Model Articles of Association, Community Interest Company Limited by Shares
(Schedule 3, Large Membership variant — dividends to private/external shareholders permitted,
subject to the CIC dividend cap regime), UK Companies House / Office of the Regulator of
Community Interest Companies template, V1.2 (8/1/26), under the Companies Act 2006 and the
Community Interest Company Regulations 2005 (as amended).
**Analytical level:** Structural + Parametric
**Most relevant design decisions:** Q1 (role structure), Q2 (voting parameters), Q3 (mandate
selection), Q5 (membership design), Q6 (adaptive capacity/reform), Q7 (accountability/monitoring)

---

## Q1 — Role Structure

Art. 8: Directors' general authority is identical to both other variants — "responsible for the
management of the Company's business," exercising "all the powers of the Company," subject to
the Articles. Same broad-`OpenAction`-plus-override pattern as the guarantee and Schedule 2
templates.

Art. 9.1: Shareholders' reserve power to direct or restrain the Directors by special resolution —
same structure as Schedule 2. The override role (`allowedRole` for the binding-direction mandate)
is again shareholding-based rather than flat membership, with the same caveat as noted in the
Schedule 2 guide: this deviates from Powers' default one-account-one-vote unless the constitution
explicitly preserves one-shareholder-one-vote (it does — see Q2 below).

Art. 11–12: Same delegation/committee chain as the other two variants — `Adopt_Mandates` /
`Revoke_Mandates` held by the top executive role to spin up and dissolve narrower mandates.

Art. 24(e)–(f): Same dual-track director removal (peer-triggered for three consecutive absences;
shareholder ordinary-resolution removal with mandatory hearing). Identical mapping to
`RevokeAccountsRoleId` with a `StatementOfIntent` hearing gate for cause-based removal.

Art. 25.2–25.3, "Subject to the Articles and in particular Article 3": Director remuneration is
explicitly made subject to the asset-lock article, even in this dividend-permitting variant —
i.e., Directors' pay is capped/constrained by the same asset-lock discipline that limits investor
distributions, even though investors themselves can receive dividends here. This is a role-design
point: a role with discretionary spending power over its own compensation (Directors setting
their own remuneration, Art. 25.1: "Directors may undertake any services for the Company that the
Directors decide") should have that discretion explicitly bounded by the same hard constraint
that governs the riskiest category of outflow (here, the asset lock), regardless of what other
distributions are permitted elsewhere in the constitution. In Powers: if a role can set its own
compensation via `OpenAction`, that compensation-setting action should still be required to pass
through the same `needFulfilled` treasury-safety check as any other treasury outflow — self-set
pay should never bypass the general spending guardrail.

Art. 32.5–32.8: Director-approval-gated share transfer, identical to Schedule 2 — same
`PeerSelect`-style secondary transfer gate mapping.

---

## Q2 — Voting Parameters

Art. 16.2, 18.1–18.3, 49.2: Identical Director quorum floor (minimum 2), one-Director-one-vote
majority rule with chair's casting vote, and the hybrid "2 persons or 10% of total shareholding,
whichever is greater" general-meeting quorum formula — all identical across all three CIC
templates reviewed. This convergence across guarantee, Schedule 2 shares, and Schedule 3 shares
variants confirms these are stable, structure-independent design defaults: they should be treated
as a robust baseline for Powers `votingPeriod`/quorum calibration regardless of how the
underlying ownership/membership layer is configured.

Art. 53.4–53.6: One vote per person on a show of hands; one vote per shareholder (not per share)
on a poll; no casting vote for the chair on a tie even on a poll. Confirms — as in Schedule 2 —
that this CIC template preserves one-shareholder-one-vote even in the dividend-permitting
variant, despite being a "limited by shares" company where capital-weighted voting would be the
more conventional company-law default. This is the strongest evidence across all three documents
that the UK CIC large-membership template family deliberately chooses person-based voting over
capital-based voting, aligning with Powers' core no-weighted-voting design philosophy even when
adapting templates whose legal form (shares) might suggest otherwise.

Art. 45.1, 59.1.1–59.1.2: Same 75%-for-special-resolution / simple-majority-for-ordinary-
resolution two-tier threshold as the other variants — reuse for `Adopt_Mandates`/`Revoke_Mandates`
calibration.

Art. 45.2: Same 90%-of-voting-rights threshold to shorten the standard notice period — same
`throttleExecution`-bypass calibration benchmark as Schedule 2.

---

## Q3 — Mandate Selection

Art. 3.2(a)–(g) (Asset Lock, Schedule 3 variant): this is the most important structural
divergence point across the three documents. Unlike Schedule 2, this Schedule 3 asset lock
explicitly **permits** several categories of outflow beyond community/asset-locked-body transfer:
(c) "the payment of dividends in respect of shares in the Company," (d) "the distribution of
assets on a winding up," (e) "payments on the redemption or purchase of the Company's own
shares," (f) "payments on the reduction of share capital," and (g) "the extinguishing or
reduction of the liability of members in respect of share capital not paid up." Art. 3.3(b) adds
a further condition: any such transfer "must not exceed any limits imposed by ... Part 2 of the
Companies (Audit, Investigations and Community Enterprise) Act 2004" — i.e., the statutory CIC
dividend cap regime still applies even though private dividends are permitted in principle.

This is a fundamentally different mandate-selection signal than Schedule 2: this organisation
type is designed to attract private capital (investors who expect a return, redemption rights,
and a share of residual assets on winding up) while still being bound by community-benefit
objects and a *capped* (not unlimited) extraction right. For Powers: this maps to a hybrid
treasury-disbursement mandate design — not a flat allow-list restriction (as in Schedule 2), but
a `needFulfilled` condition that checks a *quantitative cap* on the proportion of treasury/profit
that can be distributed to private role-holders, with any excess automatically routed to the
community/asset-locked-body allow-list. This is the closest Powers analogue to a "capped profit
distribution" mandate, distinct from both pure non-distribution (Schedule 2/guarantee) and
unrestricted distribution (a standard for-profit DAO).

Art. 33 (Purchase of own shares): the Company "may purchase its own shares (including any
redeemable shares)" and pay for this "otherwise than out of the distributable profits ... or the
proceeds of a fresh issue of shares," with redemption "at its nominal value" — i.e., a defined,
capped buy-back mechanism. This is a relevant precedent for any Powers constitution wanting to
let role-holders exit by having their role/token bought back by the treasury rather than only by
secondary transfer: the redemption price should be fixed/capped (here, nominal value) rather than
market-determined, preventing the buy-back mechanism from becoming a vector for extracting
treasury value above the role's nominal entitlement.

---

## Q5 — Membership Design

Same as Schedule 2: membership and shareholding are coextensive, so there is no separate
admission gate beyond share allotment/transfer (Art. 27, 32). Same Powers mapping: the relevant
mandate is the issuance/transfer-approval mandate (Director-approval-gated transfer, Art. 32.5),
not a discrete `SelfSelect`/`PeerSelect` admission flow.

Art. 34.3 (Transmission of shares): "transmittees do not have the right to attend or vote at a
general meeting ... in respect of shares to which they are entitled, by reason of the holder's
death or bankruptcy or otherwise, unless they become the holders of those shares." This
establishes a clear rule that *economic* entitlement to a share (via inheritance/transmission)
does not automatically carry *governance* entitlement (voting) until the transmittee formally
becomes the registered holder. Powers translation: if a role/token can be inherited or
transferred to a successor account, the successor should not automatically inherit voting rights
the instant economic entitlement transfers — voting rights should require an affirmative
"become the holder" step (e.g., explicit registration/claim transaction), preventing accidental
or contested transfers from silently shifting governance power before the transfer is confirmed.

---

## Q6 — Adaptive Capacity

Art. 9.2, 44, 58: Identical prospective-only override and amendment-threshold-matching rules as
both other variants.

Art. 28.1–28.2 (Powers to issue different classes of share): the Company "may issue shares with
such rights or restrictions as may be determined by ordinary resolution," including redeemable
shares on terms the Directors determine. Combined with the dividend-cap regime (Art. 3.3(b)),
this shows that *new economic instruments* (share classes with different dividend/redemption
terms) can be created at a routine governance threshold (ordinary resolution), while the
*overarching cap* on total extraction (the statutory dividend cap) remains fixed regardless of
what new instruments are created. Powers translation: a constitution can allow routine creation
of new role/token classes with different reward parameters via a standard `Adopt_Mandates`-tier
threshold, provided the aggregate distribution cap mandate sits at a structurally higher level
(ideally immutable or requiring a supermajority threshold no ordinary class-creation action can
reach) so that proliferating new classes cannot be used to circumvent the cap in aggregate.

---

## Q7 — Accountability

Art. 20–21: identical conflict-of-interest screening to both other variants. Same
`needNotFulfilled` per-proposal exclusion mapping.

Art. 24(e)–(f): identical dual-track director removal.

Art. 63.4: identical "no automatic inspection right merely by virtue of being a shareholder"
provision as Schedule 2 — same implication that audit/disclosure rights need an explicit mandate
rather than being assumed.

Art. 37.8: "If the Directors act in good faith, they do not incur any liability to the holders of
shares conferring preferred rights for any loss they may suffer by the lawful payment of an
interim dividend on shares with deferred or non-preferred rights." This is a good-faith liability
shield specifically scoped to *inter-class* distribution disputes (preferred vs. deferred
shareholders) — relevant only if a Powers constitution creates multiple reward-tiers among
role-holders and wants to protect the distributing role (e.g., a treasury-management role) from
liability claims by a disadvantaged tier, provided the distribution decision was made in good
faith under the rules then in force. This is a narrow but real accountability-limiting provision:
without it, a treasury-distribution role exposed to multiple competing tiers of claimants could
face indefinite liability exposure for good-faith-but-imperfect allocation decisions.

---

## What to skip

Skip the share-certificate, replacement-certificate, and share-transmission-on-death/bankruptcy
mechanics (Art. 30–31, 34–36) for the same reasons as Schedule 2 — no on-chain analogue. Skip the
detailed dividend-payment-method provisions (Art. 38: bank transfer vs. cheque) — payment-rail
mechanics. Skip the capitalisation-of-profits provisions (Art. 43) — a capital-structure
operation, not a governance choice. Skip the registered-office and statutory filing requirements
(Art. 63.1–63.3). Skip the precise wording of the statutory CIC dividend cap formula itself (the
Companies (Audit, Investigations and Community Enterprise) Act 2004, Part 2, referenced but not
reproduced in the articles) — the *existence* of a cap is the actionable governance principle;
the specific UK statutory percentage is a regulator-specific number with no general transferability
to Powers design (a Powers constitution adopting a "capped distribution" pattern should set its
own cap percentage appropriate to its context, not import the UK figure).

---

## Mandate implications

- This Schedule 3 variant is the template to use when modelling an organisation that wants to
  attract investment with a *bounded* return rather than either zero return (Schedule 2/
  guarantee) or unbounded return (a standard for-profit DAO). Implement as a treasury-
  disbursement mandate with a `needFulfilled` quantitative cap check on the proportion
  distributable to private role-holders, with any excess automatically routed to a
  community/asset-locked allow-list (the Schedule 2 pattern) as the overflow destination.
- Self-set role compensation (Directors setting their own remuneration, Art. 25, "subject to ...
  Article 3") should always be required to pass through the same treasury-safety guardrail
  (`needFulfilled` check) as any other outflow — never let a role's `OpenAction` over its own pay
  bypass the general spending cap.
- A capped, fixed-price buy-back/redemption mechanism (Art. 33: redemption "at its nominal
  value") is the model for letting role/token-holders exit via treasury buy-back without that
  mechanism becoming an extraction vector — cap the redemption price rather than letting it float
  to market value.
- Economic entitlement to a role/token (via inheritance or pending transfer) should not
  automatically confer voting rights until an affirmative "become the holder" registration step
  is completed (Art. 34.3) — build this as an explicit claim/activation transaction rather than
  an automatic inheritance of voting power.
- New reward-tier role/token classes can be created at a routine `Adopt_Mandates` threshold
  (Art. 28), but the aggregate distribution cap that limits total extraction across all classes
  should sit at a structurally higher, ideally immutable threshold so that proliferating new
  classes cannot be used in aggregate to evade the cap.
- A good-faith liability shield (Art. 37.8) for a treasury-distribution role facing competing
  claims from multiple reward tiers is worth replicating if a Powers constitution creates
  multiple distribution tiers — without it, the distributing role bears open-ended liability risk
  for good-faith allocation decisions among competing claimants.
- The convergent one-shareholder-one-vote design across all three CIC templates (guarantee,
  Schedule 2, and this Schedule 3 variant) — despite this being a "limited by shares" company
  where capital-weighted voting is the company-law default — is strong cross-document evidence
  that person-based voting is compatible with, and was deliberately chosen over, capital-weighted
  voting in this template family. Treat this as confirming evidence for Powers' default
  one-account-one-vote philosophy even when the underlying legal/economic structure involves
  tradeable ownership units.
