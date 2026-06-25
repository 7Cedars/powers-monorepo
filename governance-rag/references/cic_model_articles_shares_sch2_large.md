# UK CIC Model Articles — Limited by Shares, Schedule 2, Large Membership

**Citation:** Model Articles of Association, Community Interest Company Limited by Shares
(Schedule 2, Large Membership variant — dividends restricted to asset-locked bodies only), UK
Companies House / Office of the Regulator of Community Interest Companies template, V1.2, under
the Companies Act 2006 and the Community Interest Company Regulations 2005 (as amended).
**Analytical level:** Structural + Parametric
**Most relevant design decisions:** Q1 (role structure), Q2 (voting parameters), Q5 (membership
design), Q6 (adaptive capacity/reform), Q7 (accountability/monitoring)

---

## Q1 — Role Structure

Art. 8: "Subject to the Articles, the Directors are responsible for the management of the
Company's business, for which purpose they may exercise all the powers of the Company." Same
maximal executive grant as the guarantee-company variant. The Powers analogue is an admin role
with broad `OpenAction` scope, again checked only by the shareholders' reserve power (Art. 9).

Art. 9.1–9.2: "The shareholders may, by special resolution, direct the Directors to take, or
refrain from taking, specific action," and "no such special resolution invalidates anything which
the Directors have done before the passing of the resolution." Identical structure to the
guarantee-company template's members' reserve power, but here the override role is *shareholders*
rather than a guarantee-based membership. In Powers terms, the role holding the override mandate
is defined by share ownership rather than a flat membership register — a structural fork point:
if the underlying organisation is share-capital-based, the equivalent Powers `allowedRole` for
the override mandate should be tied to whatever on-chain proxy represents share ownership (e.g.,
a governance token balance threshold), which is a deviation from Powers' default
one-account-one-vote philosophy and should be flagged explicitly in any constitution adopting
this pattern.

Art. 11–12 (delegation and committees): identical delegation chain to the guarantee variant —
Directors may delegate to "such person or committee," revocably, and committees follow
Director-decision procedures unless the Directors specify otherwise. Same Powers mapping:
`Adopt_Mandates`/`Revoke_Mandates` held by the top executive role to create and dissolve narrower
committee-equivalent mandates.

Art. 24(e)–(f): Same dual-track director removal — automatic-trigger-but-peer-voted removal for
three consecutive absences (e), and shareholder ordinary-resolution removal with a mandatory
hearing (f) ("provided the meeting has invited the views of the Director concerned"). Same
mapping as the guarantee variant: peer-triggered `RevokeAccountsRoleId` for disengagement,
member/shareholder-voted `RevokeAccountsRoleId` with a `StatementOfIntent` hearing step for
substantive removal.

Art. 32.5–32.6 (Share transfers): "The Directors may refuse to register the transfer of a share
to a person of whom they do not approve," and may further require evidence and information before
registering a transfer. This is a director-level gatekeeping power over *who can become a
shareholder by transfer* — distinct from, and layered on top of, any membership-admission
gatekeeping. In Powers terms, this is a second `PeerSelect`-style gate: even if a role grant is
nominally transferable (e.g., a transferable NFT-bound role or token-bound role), the controlling
role (Directors-equivalent) can interpose an approval step before the transfer takes effect. This
is directly relevant if a Powers constitution allows role-transfer and wants to prevent
unapproved parties from acquiring governance roles via secondary transfer.

---

## Q2 — Voting Parameters

Art. 16.2, 18.1–18.3: Identical Director quorum floor (never less than two) and one-Director-one-
vote with chair's casting vote — same as the guarantee variant. Confirms this is a stable,
reusable design pattern independent of the underlying capital structure (guarantee vs. shares):
the *executive* layer's voting parameters are calibrated the same way regardless of how the
*membership/ownership* layer is structured.

Art. 49.2: General meeting quorum is "two persons entitled to vote on the business to be
transacted (each being a shareholder, a proxy for a shareholder or a duly authorised
representative of a shareholder); or 10% of the total shareholding (represented in person or by
proxy) whichever is greater." Same hybrid floor-plus-proportional formula as the guarantee
variant, but denominated in *shareholding* rather than *membership count*. Design implication for
Powers: if the underlying role is share/token-weighted rather than one-account-one-vote, the
quorum formula should be calibrated against the weighted total (e.g., 10% of total token supply
held by the role), not against the *count* of distinct role-holders — these can diverge sharply
if shareholding/token distribution is concentrated.

Art. 53.4–53.5: "On a vote on a resolution on a show of hands ... every person present in person
... and entitled to vote shall have a maximum of one vote," but "on a vote on a resolution on a
poll at a meeting every shareholder present in person or by proxy or Authorised Representative
shall have one vote" (Art. 53.5 — note: read against the broader Companies Act default, a poll
vote for a shares-limited company is ordinarily weighted by shareholding unless the articles
state otherwise; this template's Art. 53.5 text mirrors the guarantee company's one-vote-per-
holder language exactly, suggesting the drafters deliberately preserved one-shareholder-one-vote
even on a poll, rather than introducing share-weighting). This is a significant and easily missed
design choice: many "company limited by shares" structures default to capital-weighted voting,
but this model explicitly does **not** — it keeps one-shareholder-one-vote on both show-of-hands
and poll. For Powers: when adapting a shares-based template, do not assume share/token-weighted
voting is required; this CIC template demonstrates that "limited by shares" and "one-account-one-
vote" are compatible, which aligns with Powers' core no-weighted-voting philosophy more than a
casual reading of "shares" would suggest.

Art. 45.1, 59.1.1–59.1.2: Special/written resolutions require 75% of total voting rights; ordinary
resolutions require simple majority. Same two-tier threshold calibration as the guarantee
variant — reuse directly for `Adopt_Mandates`/`Revoke_Mandates` (75%-equivalent) versus routine
`OpenAction` proposals (simple-majority).

Art. 45.2: Shorter meeting notice than the 14-Clear-Day default is permitted if agreed by a
majority representing at least 90% of total voting rights at the meeting. This is a near-unanimity
override valve for urgent business — a useful calibration benchmark for a Powers
`throttleExecution` bypass: if a constitution wants to allow expedited action bypassing the
standard notice/voting-period delay, gate the bypass at a very high consensus threshold (≈90%)
rather than a simple majority, so the fast-path cannot be triggered by routine factional control.

---

## Q3 — Mandate Selection

Art. 3.2(a)–(b) (Asset Lock, Schedule 2 variant): transfers of assets are permitted without
breaching the asset lock only (a) to a specified asset-locked body (with Regulator consent for
unspecified ones) or (b) "for the benefit of the community other than by way of a transfer of
assets into an asset-locked body" — and critically, **this Schedule 2 variant does not list
dividend payment, share buy-back, or capital reduction as permitted exceptions** (contrast with
the Schedule 3 variant, which explicitly carves these out — see `cic_model_articles_shares_sch3_
large.md`). This is the load-bearing structural choice of this template: it is a shares-based
company that nonetheless commits never to distribute value to private shareholders — value can
only flow to community-benefit uses or other asset-locked bodies. The Powers mandate-selection
implication: an organisation choosing this governance pattern is signalling that share/token
ownership confers *governance rights* (voting weight, proposal rights) but explicitly *not*
*economic extraction rights*. In Powers terms, this justifies separating the governance-role
mandate (token-weighted `allowedRole` for voting) from the treasury-disbursement mandate (which
should have a `needFulfilled` check restricting all outflows to a fixed allow-list of
community/asset-locked recipients, with no path for pro-rata distribution to role-holders).

---

## Q5 — Membership Design

Art. 27.1, 27.3 (shares fully paid; no separate "becoming a member" article distinct from share
allotment): unlike the guarantee variant, this template does not have a discrete membership-
admission gate — becoming a shareholder *is* becoming a member, and is governed by share
allotment/transfer rules rather than a separate application-and-approval process. This is a
structural simplification relevant to Powers design: when role-membership is defined by holding
a fungible/transferable asset (a token or share), the "becoming a member" question collapses into
"how is the asset issued and transferred," and the relevant Powers mandate is the
issuance/transfer-approval mandate (see Art. 32.5 above), not a separate `SelfSelect`/`PeerSelect`
admission flow.

Art. 32.5–32.8: Director approval is required for any share transfer, evidence of the
transferor's right to transfer must be provided, and a refusal must be communicated "within two
months." This sets a concrete SLA on a gatekeeping decision — a useful parametric benchmark for
Powers: if a role-transfer requires approval, the approving role should be bound to a maximum
response time (here, ~2 months in the legal context; for an on-chain constitution this should be
expressed as a block-number or timestamp deadline after which the transfer either auto-approves
or the constitution specifies an appeal path), preventing indefinite stonewalling of a transfer
request.

---

## Q6 — Adaptive Capacity

Art. 9.2, 44.1–44.2, 58.1–58.2: Identical prospective-only override and amendment-threshold-
matching rules as the guarantee variant (special resolutions amendable only for non-substantive
correction; ordinary resolutions amendable by ordinary resolution at the meeting with 48 hours'
notice). Same Powers mapping: amendment power should be capped at the same threshold tier as the
underlying resolution to prevent threshold laundering.

Art. 3 (Asset Lock) interacting with Art. 28 (power to issue different classes of shares): the
Company may issue new share classes "with such rights or restrictions as may be determined by
ordinary resolution" (Art. 28.1), but any such class's economic rights remain subordinate to the
overriding asset-lock prohibition on private distribution. This shows that *governance-structure*
reform (issuing new classes of voting/role-defining tokens) is permitted at a low threshold
(ordinary resolution), while the underlying *economic constraint* (no private dividend) sits
outside the reach of any ordinary governance reform — only a Regulator-level/statutory change
could alter that. Powers translation: separate the reform threshold for role/voting-structure
changes (can be relatively low, e.g., ordinary `Adopt_Mandates`) from the threshold (or outright
immutability) for treasury-distribution-restriction changes (should be hard-coded or require a
threshold so high it is functionally immutable, e.g., unanimous or supermajority beyond any
single faction's reach).

---

## Q7 — Accountability

Art. 20–21 (Conflicts of Interest): identical conflict-screening provisions to the guarantee
variant — declare, withdraw from the conflicted portion of the meeting, excluded from quorum and
vote on that matter. Same `needNotFulfilled` per-proposal exclusion mapping.

Art. 24(e)–(f): identical dual-track removal (peer-triggered for absence; shareholder-voted with
mandatory hearing for cause).

Art. 63.4: "Except as provided by law or authorised by the Directors or an ordinary resolution of
the Company, no person is entitled to inspect any of the Company's accounting or other records
or Documents merely by virtue of being a shareholder." This is a notable accountability *limit*:
shareholder status alone does not confer a right to inspect internal records — inspection rights
require either a statutory basis, Director authorisation, or an ordinary resolution. The Powers
parallel: holding a governance role/token does not automatically entail full visibility into
every operational detail; if a constitution wants role-holders to have audit/inspection rights
over treasury or operational data beyond what the on-chain record already exposes, that visibility
right needs to be an explicit mandate (e.g., a `StatementOfIntent`-gated disclosure obligation
triggered by member request), not assumed to follow automatically from token/role ownership.

---

## What to skip

Skip the share-certificate issuance/replacement mechanics (Art. 30–31) and the "transmission of
shares" provisions on death/bankruptcy of a holder (Art. 34–36) — these are UK probate/insolvency
interface rules with no on-chain governance analogue (on-chain role transfer on holder death is
either undefined or handled by wallet-recovery mechanisms outside the constitution's scope). Skip
the capitalisation-of-profits mechanics (Art. 43) — converting retained profit into new shares is
a capital-structure operation specific to company law, not a governance design choice. Skip the
detailed dividend-payment-method provisions (Art. 38: bank transfer, cheque, etc.) — payment-rail
mechanics, not governance. Skip the registered-office and Companies House filing requirements
(Art. 63.1–63.3) — statutory filing obligations, not transferable. Note specifically that because
this is the Schedule 2 (no-private-dividend) variant, the dividend-declaration procedure itself
(Art. 37) is close to vestigial in practice — it can only ever distribute to asset-locked bodies,
so the procedural detail of "how a dividend is declared" is less interesting for Powers design
than the *restriction* on who can receive it (covered under Q3 above).

---

## Mandate implications

- This Schedule 2 variant demonstrates a clean separation pattern: governance rights
  (`allowedRole` for voting, potentially token-weighted) can be fully decoupled from economic
  extraction rights (treasury outflows). Any Powers constitution modelling a "shares confer
  voting power but profits stay locked to mission-aligned uses" structure should implement the
  treasury-disbursement mandate with a `needFulfilled` allow-list check that excludes pro-rata
  distribution to role-holders, regardless of what the voting-weight `allowedRole` permits.
- Director/admin approval-gated transfer (Art. 32.5) is a `PeerSelect`-style secondary gate on
  role acquisition via transfer — relevant whenever a Powers constitution allows a role-bound
  token/NFT to be transferred and wants to prevent unapproved parties from acquiring governance
  power through the secondary market. Pair the transfer mechanism with an approval mandate and a
  bounded response-time deadline (cf. Art. 32.7's two-month SLA) to prevent indefinite blocking.
- The "limited by shares but explicitly one-shareholder-one-vote, including on a poll" design
  (Art. 53.4–53.5) is a precedent for combining a capital/token-based membership structure with
  Powers' one-account-one-vote default — do not assume that token-based role design requires
  token-weighted voting; this template shows the two are separable.
- The near-unanimity (90%) threshold for bypassing standard notice periods (Art. 45.2) is a
  reusable benchmark for calibrating a `throttleExecution` bypass or expedited-action path: gate
  it at near-unanimity, not simple majority, so urgency cannot be used to evade deliberation by a
  bare majority faction.
- Inspection/audit rights are not automatic from role-holding (Art. 63.4) — if a Powers
  constitution wants role-holders to have a right to demand treasury or operational disclosure
  beyond the default on-chain record, implement it as an explicit `StatementOfIntent`-triggered
  disclosure mandate rather than assuming it is implied by holding a role.
- Reform thresholds should be split by what is being reformed: role/voting-structure changes
  (new share/token classes, Art. 28) can use a routine `Adopt_Mandates` threshold, while changes
  to the treasury-distribution restriction itself should sit outside ordinary reform reach
  entirely (hard-coded) or require a threshold so high it is functionally immutable.
