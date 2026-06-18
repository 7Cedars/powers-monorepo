# UK CIC Model Memorandum of Association (Limited by Shares) — Reading Guide

**Citation:** UK Department for Business and Trade / Office of the Regulator of Community
Interest Companies. *Model Memorandum of Association — Community Interest Company Limited by
Shares.* Companies Act 2006 template.
**Analytical level:** Structural (minimal)
**Most relevant design decisions:** Q1, Q5

---

## Q1 — Role Structure

Preamble: "Each subscriber to this Memorandum of Association wishes to form a company under the
Companies Act 2006 and agrees to become a member of the Company **and to take at least one
share**." As with the guarantee variant, this is the entire substantive content for role
structure: a flat founding act with no objects clause and no role differentiation. The only
difference from the guarantee-form Memorandum is the six added words "and to take at least one
share" — the founding act is now conditioned on a minimum capital contribution rather than a
guarantee undertaking. In Powers terms, this is still pre-constitution: it maps to the deployment
transaction, not to any `allowedRole` or mandate. The objects/purpose clause and any treasury or
distribution rules again live in the Articles (a separate document), not here.

---

## Q5 — Membership Design

Preamble clause (the only clause distinguishing this document from the guarantee variant):
membership requires "tak[ing] at least one share" — i.e., a capital contribution is a precondition
of membership, however small (no minimum share value is fixed by the Memorandum itself). This is
the one place where the shares variant gives a different signal than the guarantee variant for
membership-boundary design: capital stake, not personal guarantee, is the unit of admission.
Compare directly to `cic_memorandum_guarantee.md`: the guarantee form ties membership to an
undertaking (a promise to contribute on winding-up), while the shares form ties membership to an
upfront stake (a share, however nominal). In Powers terms, the shares variant is the closer
structural analogue to a token-gated `allowedRole` — possession of at least one unit of capital
is the entry condition — whereas the guarantee variant has no token/stake equivalent at all.
Neither document specifies whether shares carry voting weight proportional to number held; that
question (one-share-one-vote vs. one-member-one-vote) is left to the Articles and is therefore out
of scope for this source.

---

## What to skip

Identical formal content to the guarantee-form Memorandum: the "c.i.c." naming-suffix footnote,
the subscriber name/authentication table, and the pre-/post-2009 incorporation footnotes. None of
this generalises to on-chain governance design. There is no content for Q2 (voting), Q3 (mandate
selection), Q4 (dependency chains), Q6 (reform), or Q7 (accountability) in this source — as with
the guarantee variant, all operating rules are reserved to the Articles, which this document does
not contain.

---

## Mandate implications

- The single substantive distinction between the two Memorandum variants — "agrees to become a
  member" vs. "agrees to become a member and to take at least one share" — is a precedent for
  making the capital-stake-vs-personal-undertaking choice explicit and minimal at the point of
  constitution design: decide once, at the root, whether membership in the Powers DAO is gated by
  holding a quantity of a token (shares model, supports `allowedRole` keyed to token balance or
  a dedicated membership NFT) or by an identity/reputation act with no capital requirement
  (guarantee model, supports `SelfSelect`/`PeerSelect` keyed to account identity, not balance).
  Mixing the two without deciding which is primary risks the same ambiguity UK company law avoids
  by forcing a binary choice of company type at incorporation.
- Because the Memorandum fixes only "at least one share" with no value floor, a Powers
  implementation modelling this form should treat the share-equivalent membership token as a
  binary gate (hold ≥ 1 unit) rather than building voting weight into the gate itself — weighting,
  if wanted, is a separate `votingPeriod`/aggregation-rule design decision belonging to the
  Articles-equivalent layer, not the founding-membership layer.
