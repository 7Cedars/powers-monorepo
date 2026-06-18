# UK CIC Model Articles — Limited by Shares, Schedule 2, Small Membership

**Citation:** "Articles of Association of [Community Interest Company/C.I.C.] (CIC Limited by
Shares, Schedule 2, Small Membership)", UK Companies House model articles template, V1.2
08/1/26, made under the Companies Act 2006 and the Community Interest Company Regulations
2005 (Schedule 2).
**Analytical level:** Structural + Parametric
**Most relevant design decisions:** Q1, Q5, Q6, Q7

---

## Q1 — Role Structure

Article 8 ("Directors' general authority"): identical wording to the guarantee variant — Directors
"are responsible for the management of the Company's business, for which purpose they may
exercise all the powers of the Company." The default authority structure is the same broad
`OpenAction`-style grant to a single executive role, regardless of capital structure.

Article 22.3 ("Methods of appointing Directors"): "Each member of the company shall be a
Director." As in the guarantee variant, member and director roles are structurally fused. However,
footnote 16 clarifies the rationale differs here: "there is no requirement for all directors to be
members (shareholders) of the company, since it is likely that the only member will be Asset
Locked Bodies." This is a materially different design intent from the guarantee variant — Article
26.3 ("All shares to be fully paid up and issued at nominal value to a Director") restricts share
issuance strictly to Directors, but the template's drafters anticipate the shareholder(s) may
themselves be institutional asset-locked bodies (e.g., a parent CIC or charity) rather than
individuals. In Powers terms, this supports a design where the top `allowedRole` is held by a small
number of institutional or trustee-style accounts rather than a broad individual membership —
appropriate for a subsidiary or vehicle DAO controlled by a parent organisation.

Article 9 ("Shareholders' reserve power"): shareholders may "by special resolution, direct the
Directors to take, or refrain from taking, specific action" — the same reserve-power structure as
the guarantee variant's members' reserve power, now keyed to shareholding rather than
membership status. Map to the same high-threshold `BespokeAction_Simple` pattern.

---

## Q5 — Membership Design

Article 26.3 ("No share shall be issued to a person except a Director") is the core membership
gate: equity (and therefore voting rights — Article 43.3, "a person who is not a shareholder...
shall not have any right to vote at a general meeting") is restricted to the Director role. This
collapses ownership and governance authority into a single class with no separate non-voting
investor tier. In Powers terms, do not model a separate "shareholder" `allowedRole` distinct from
"director" — they are the same population by Article 26.3's restriction, just as in the guarantee
variant's member/director fusion.

Article 31.5–31.8 ("Share transfers," mandatory per footnote 19, reflecting paragraph 2 of
Schedule 2 to the Regulations): "The Directors may refuse to register the transfer of a share to a
person of whom they do not approve" (31.5), and on refusal must, within two months, "send to
the transferee notice of the refusal" (31.7). Unlike the guarantee variant's flatly non-transferable
membership, this template permits transfer but subjects every transfer to Director veto. Map this
to a `PeerSelect`-gated transfer: a `needFulfilled` condition requiring board approval before any
role-reassignment via the share-transfer path is recognised on-chain — i.e., even where the
underlying instrument is nominally transferable, the effective governance right is not freely
tradeable.

Article 32 ("Purchase of own shares"): the company may buy back its own shares at nominal
value, funded other than from distributable profits (footnote 22 warns this provision must not be
used to repurchase shares "which is not held by an asset-locked body," since doing so "will
amount to a breach of the asset lock provisions"). This is the share-class equivalent of a
controlled exit mechanism — comparable to a bounded `RevokeAccountsRoleId` that returns a
role-holder's stake to the organisation at a fixed (nominal) value rather than market value,
preventing exiting members from extracting accumulated surplus.

---

## Q6 — Adaptive Capacity

Article 44.1.2 (written resolutions): the special-resolution threshold for shareholders is "not less
than 75% of the total voting rights of eligible shareholders" — identical to the guarantee variant's
member threshold. This consistency across both templates is useful calibration evidence: 75% is
the UK statutory default for "special resolution" generally (Companies Act 2006 s.283), and
should be treated as a baseline anchor for `Adopt_Mandates`/`Revoke_Mandates` thresholds when
designers want a recognisable, externally-validated supermajority rather than an arbitrary number.

Article 51 ("Exclusion of model articles"): "The relevant model articles for a company limited by
shares are hereby expressly excluded" — confirming, as in the guarantee variant, that this
document is itself the full reform/alteration of the statutory default, not an incremental patch. Use
`MandatePackage` rather than piecemeal `Adopt_Mandates` when translating a from-scratch
bespoke constitution like this one into Powers.

Article 27.1 ("Powers to issue different classes of share"), footnote 19: "unless specific wording
is added to the contrary, the directors of a company with only one class of shares will be able to
issue new shares without needing the consent of the existing shareholders." This is a notable
permissiveness gap — the board alone can dilute or expand the controlling class without a
shareholder vote, unless the constitution caps it. In Powers terms, an `Adopt_Mandates` mandate
that expands `allowedRole` membership for the top role should require an explicit `needFulfilled`
gate on shareholder/member approval; the base template's default (board-only control over new
share issuance) is a structural permissiveness risk worth flagging to designers replicating it
on-chain, since it lets the executive role unilaterally grow its own electorate.

---

## Q7 — Accountability

Articles 19–20 (conflicts of interest, conflict authorisation) are verbatim identical in structure to
the guarantee variant: a conflicted Director must withdraw from the relevant part of the meeting,
is excluded from the quorum, and has no vote (Article 19.3.1–19.3.3), unless the board
pre-authorises the conflict (Article 20.1). Same `needNotFulfilled`/`needFulfilled` mapping as the
guarantee variant applies here.

Article 23(e) ("Termination of Director's appointment"): automatic removal on failure to "attend
three consecutive meetings of the Directors" combined with a board resolution — identical
self-executing accountability trigger to the guarantee variant. Same `RevokeAccountsRoleId`
mapping applies.

Article 48.4 ("Records and accounts"): "no person is entitled to inspect any of the Company's
accounting or other records or Documents merely by virtue of being a shareholder" — unless
authorised by the Directors or an ordinary resolution. This is a notably weak transparency default:
shareholders/members have no automatic audit right. In Powers terms, this is an argument for
designers using this template to deliberately add a `StatementOfIntent`-based reporting mandate
accessible to all role holders, since the base constitution does not guarantee visibility into
financial records as a baseline accountability mechanism the way an on-chain treasury naturally
would.

---

## What to skip

The full Shares mechanics — Article 26 (paid-up value), Article 27 (classes of share), Articles
29–30 (share certificates, replacement certificates), Articles 33–35 (transmission of shares on
death/bankruptcy), and Articles 36–42 (dividend declaration mechanics, capitalisation of profits)
— are company-law-specific instruments with no on-chain equivalent in a token-free,
one-account-one-vote Powers design. These exist to regulate a tradeable equity instrument; Powers
mandates do not need a parallel "share" object. Skip the asset-lock paragraph numbering detail
(Article 3.5, naming a specific recipient asset-locked body) as this is UK-regulator-specific
machinery for winding-up distributions, not a governance design choice. Skip the common-seal
and indemnity/insurance articles (29.5, 49–50) entirely.

---

## Mandate implications

- Because share issuance is restricted to Directors (Article 26.3) and voting is restricted to
  shareholders (Article 43.3), model "shareholder" and "director" as a single `allowedRole`, as in
  the guarantee variant — do not create a separate non-voting investor tier unless the design
  intentionally departs from this template.
- Director-gated share transfer (Article 31.5) should be implemented as a `needFulfilled`
  precondition on any role-reassignment mandate: the receiving account only gains the role after
  a `PeerSelect`-style board approval step, even though the underlying instrument is nominally
  transferable.
- The board's unilateral power to issue new shares of an existing class without shareholder
  consent (Article 27.1, footnote 19) should be flagged as a permissiveness risk: when porting this
  template on-chain, gate any mandate that grows the top `allowedRole`'s membership behind a
  `needFulfilled` shareholder/member-approval step, rather than allowing the executive role to
  expand its own electorate by default.
- The 75% special-resolution threshold (Article 44.1.2) — consistent with the guarantee variant —
  is a reusable calibration anchor for `Adopt_Mandates`/`Revoke_Mandates` quorum/threshold
  settings whenever a recognisable statutory-style supermajority is desired.
- The share buy-back-at-nominal-value mechanism (Article 32, subject to the asset-lock warning
  in footnote 22) maps to a bounded `RevokeAccountsRoleId`-plus-settlement design: exiting
  role-holders should be returned a fixed, pre-defined value rather than a market-determined
  payout, to avoid breaching the asset-lock-equivalent treasury protection.
- The absence of an automatic shareholder audit right (Article 48.4) supports adding a
  `StatementOfIntent` reporting mandate, accessible to the full role population, as a deliberate
  accountability addition not present in the base template.
