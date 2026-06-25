# UK CIC Model Articles — Limited by Shares, Schedule 3, Small Membership

**Citation:** "Articles of Association of [Community Interest Company/C.I.C.] (CIC Limited by
Shares, Schedule 3, Small Membership)", UK Companies House model articles template, V1.2
08/1/26, made under the Companies Act 2006 and the Community Interest Company Regulations
2005 (Schedule 3).
**Analytical level:** Structural + Parametric
**Most relevant design decisions:** Q1, Q5, Q6, Q7

---

## Q1 — Role Structure

Article 8 ("Directors' general authority") and Article 22.3 ("Each member of the company shall
be a Director") replicate the Schedule 2 variant exactly: a single fused member/director
`allowedRole` with broad default `OpenAction`-style authority. The structural role design is
identical to Schedule 2 — the difference between the two Schedule-3 and Schedule-2 documents
is not in role structure but in the asset-lock carve-outs governing what that role may distribute (see
Q5/Mandate implications below).

Article 9 ("Shareholders' reserve power") again gives shareholders the power to "direct the
Directors to take, or refrain from taking, specific action" by special resolution — the same
reserve-power pattern as both other templates, supporting the same `BespokeAction_Simple`
mapping.

---

## Q5 — Membership Design

Article 26.3 ("No share shall be issued to a person except a Director") and Article 31.5 (Director
veto over share transfer registration) are word-for-word identical to the Schedule 2 variant. The
membership-design mapping (fused shareholder/director `allowedRole`; `needFulfilled` board
approval gating transfer recognition) is therefore the same as for Schedule 2.

The decisive difference is **Article 3.2**, the asset-lock exemption list. Where Schedule 2's
asset lock (Article 3.1–3.3, reviewed separately) restricts almost all distributions to transfers
into another asset-locked body, Schedule 3's Article 3.2 explicitly carves out, in addition to
asset-locked-body transfers (3.2(a)–(b)):

> "(c) the payment of dividends in respect of shares in the Company;
> (d) the distribution of assets on a winding up;
> (e) payments on the redemption or purchase of the Company's own shares;
> (f) payments on the reduction of share capital; and
> (g) the extinguishing or reduction of the liability of shareholders in respect of share capital not
> paid up on the reduction of share capital."

This means Schedule 3 is the CIC variant designed to pay capped dividends and make capital
distributions to private shareholders (subject to the separate statutory CIC dividend/asset-lock cap
administered by the Regulator — see What to skip), whereas Schedule 2 is designed for CICs
whose only shareholder is itself an asset-locked body and which do not intend ever to distribute to
private investors (Schedule 2, footnote 24: "A company which does not intend to pay dividends or
make other distributions to private investors... should not make use of this provision"). For
Powers design purposes, Schedule 3 is the template to use when modelling a DAO that intends to
make ongoing value distributions to a defined role (e.g., a treasury-share-style payout to core
contributors or founders) subject to a hard cap, while Schedule 2 (and the guarantee variant) are
the templates for DAOs with no private distribution intent at all.

---

## Q6 — Adaptive Capacity

Article 44.1.2 (75% special-resolution threshold) is identical to both other templates — reinforce
this as the cross-template calibration anchor for `Adopt_Mandates`/`Revoke_Mandates`.

Article 51 ("Exclusion of model articles") again confirms the document operates as a full
replacement of the statutory default, supporting `MandatePackage` rather than incremental
`Adopt_Mandates` when porting a from-scratch bespoke constitution like this one.

Article 36.1 ("Procedure for declaring dividends"): "the Company may by ordinary resolution
declare dividends, and the Directors may, provided that such decision is authorised by an
ordinary resolution of the shareholders, decide to pay interim dividends." Because dividend
declaration is itself a governance act requiring shareholder authorisation (not solely a Director
decision), this is the precedent for treating a Powers treasury-distribution mandate as a distinct
governed action with its own `allowedRole` and `votingPeriod`, separate from ordinary executive
mandates — distributions should not be executable under the same broad `OpenAction` grant that
covers day-to-day management (Article 8).

Article 36.3 ("A dividend must not be declared unless the Directors have made a recommendation
as to its amount. Such a dividend must not exceed the amount recommended by the Directors."):
this creates a two-step dependency — Directors propose an amount, shareholders ratify up to that
cap, and shareholders cannot vote a higher amount than recommended. Map directly to a
`needFulfilled` chain: the distribution-ratification mandate available to shareholders must require
prior completion of a Director-proposal mandate, and the ratification mandate's parameters
(maximum payable amount) should be bounded by the proposal's value, not independently set.

---

## Q7 — Accountability

Articles 19–20 (conflicts of interest) and Article 23(e) (automatic removal after three consecutive
absences) are identical in text and structure to both other templates — same
`needNotFulfilled`/`needFulfilled` and `RevokeAccountsRoleId` mappings apply.

Article 48.4 ("Records and accounts"): identical "no person is entitled to inspect... merely by
virtue of being a shareholder" language to Schedule 2. Same `StatementOfIntent`-reporting-gap
implication applies, with added weight here because Schedule 3 permits real financial distributions
to shareholders (dividends) — the absence of an automatic inspection right is more consequential
when money is actually flowing to private holders, strengthening the case for an explicit
on-chain reporting mandate.

Article 36.9 (interim dividend on preferred vs deferred shares): "If the Directors act in good
faith, they do not incur any liability to the holders of shares conferring preferred rights for any
loss they may suffer by the lawful payment of an interim dividend on shares with deferred or
non-preferred rights." This is a liability shield for Directors acting on a good-faith distribution
decision between competing share classes — the closest analogue in Powers terms is a safe-harbour
condition on a treasury-distribution mandate: if the distribution mandate's `needFulfilled`
preconditions were satisfied at execution time, a subsequent dispute over priority among role-
holders should not retroactively expose the executing role to penalty.

---

## What to skip

As with Schedule 2: share certificate mechanics (Article 29), replacement certificates (Article 30),
transmission of shares on death/bankruptcy (Articles 33–35), common seal requirements (Article
29.5(a)), and indemnity/insurance boilerplate (Articles 49–50) are company-law mechanics with
no on-chain analogue. The CIC dividend cap itself — the statutory percentage limit on dividends
per share and the aggregate dividend cap, administered by the Regulator of Community Interest
Companies under the Community Interest Company Regulations — is not stated in this document
(it is a Regulator policy figure set outside the Articles) and is too regime-specific to port directly;
the actionable design lesson is only the structural pattern (capped, ratified distributions), not the
specific UK percentage. Skip Article 42 (capitalisation of profits) and Articles 37–41 (payment
mechanics, non-cash distributions, waiver of distributions) as administrative payment-processing
detail.

---

## Mandate implications

- Schedule 3's asset-lock carve-out for dividends, winding-up distributions, share buy-backs, and
  capital reductions (Article 3.2(c)–(g)) is the deciding factor for choosing this template over
  Schedule 2 or the guarantee variant: use Schedule 3 as the reference model whenever a Powers
  constitution needs a capped, ratified treasury-distribution mandate to a defined role; use
  Schedule 2 or the guarantee variant when the constitution should structurally forbid any value
  distribution to role-holders (pure asset-lock).
- The two-step dividend dependency (Article 36.1 ordinary-resolution authorisation; Article 36.3
  Director-recommendation-then-shareholder-cap) should be implemented as a `needFulfilled`
  chain: a Director-proposal mandate sets a maximum distributable amount, and a separate
  shareholder/member-ratification mandate can approve up to but not above that cap — do not
  collapse this into a single mandate, since the source document deliberately splits proposal from
  ratification.
- Treasury-distribution mandates should use a distinct, narrower `allowedRole` and a dedicated
  `votingPeriod` from the general management `OpenAction` grant (Article 8), reflecting Article
  36's treatment of dividend declaration as a separate governed act, not an ordinary executive
  action.
- The Director good-faith liability shield for distribution decisions among competing classes
  (Article 36.9) supports adding a safe-harbour clause to any treasury-distribution mandate: if
  `needFulfilled` preconditions were satisfied at execution time, the executing role should not be
  penalised for later-disputed prioritisation among recipients.
- All other mandate implications (fused shareholder/director `allowedRole`, `PeerSelect`-gated
  transfer, 75% special-resolution anchor for `Adopt_Mandates`/`Revoke_Mandates`,
  `needNotFulfilled` conflict-of-interest exclusion, automatic `RevokeAccountsRoleId` on
  three-absence trigger) are identical to the Schedule 2 variant — see
  `cic_model_articles_shares_sch2_small.md`.
