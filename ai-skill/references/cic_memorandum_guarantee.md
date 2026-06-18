# UK CIC Model Memorandum of Association (Limited by Guarantee) — Reading Guide

**Citation:** UK Department for Business and Trade / Office of the Regulator of Community
Interest Companies. *Model Memorandum of Association — Community Interest Company Limited by
Guarantee.* Companies Act 2006 template.
**Analytical level:** Structural (minimal)
**Most relevant design decisions:** Q1, Q5

---

## Q1 — Role Structure

Clause/recital (preamble): "Each subscriber to this Memorandum of Association wishes to form a
company under the Companies Act 2006 and agrees to become a member of the Company." This is the
entire substantive content of the document for role structure — a flat, undifferentiated founding
act. There is no objects clause, no statement of purpose, and no role differentiation in the
Memorandum itself. Since the Companies Act 2006 reform, a CIC's statement of objects, its
community interest statement, and its liability cap all moved into the Articles (and the separate
community interest statement document) — the Memorandum is reduced to a bare subscriber list and
authentication record. In Powers terms: this document corresponds only to the deployment
transaction itself (the equivalent of `Powers.constitute()` being called by the founding accounts)
— it carries no `allowedRole` or mandate content. Any Powers constitution must look to the
Articles-equivalent document (a separate source) for the actual objects/purpose clause that would
gate a `BespokeAction_Simple` or `Adopt_Mandates` purpose check.

---

## Q5 — Membership Design

Preamble: each subscriber "agrees to become a member of the Company" — for the guarantee variant,
this is a membership of obligation (the guarantee), not of capital contribution. There is no
maximum or minimum subscriber count stated ("there is no upper limit to the number of subscribers
and further entries may be added as appropriate," per the drafting note). In Powers terms: the
guarantee form is the closer analogue to a Powers DAO with a non-transferable, capped-liability
membership role — `allowedRole` defines who is a member, and there is no equivalent of a
tradeable stake. The absence of any stated guarantee amount in the Memorandum itself (the sum
members agree to contribute on winding up is fixed in the Articles, not here) means this document
alone gives no quantitative liability cap to map onto a `value` limit; it only establishes that
membership is an act of joining (subscribing one's name), not a purchase.

---

## What to skip

The document is almost entirely formal: the company-name footnote on the "c.i.c." / "cwmni
buddiant cymunedol" naming suffix (UK-specific, no on-chain equivalent), the subscriber
name/authentication table itself (a notarial formality, equivalent to a deployment signature, not
a governance rule), and the explanatory footnotes about pre-2009 vs. post-2009 incorporation
practice (UK company-law history, not transferable). There is no content here for Q2 (voting),
Q3 (mandate selection), Q4 (dependency chains), Q6 (reform), or Q7 (accountability) — the
Memorandum is deliberately silent on all operating rules; they are reserved to the Articles. Do
not pad this guide with inferred content; the source genuinely has nothing to say beyond the two
sections above.

---

## Mandate implications

- The Memorandum/Articles split is itself a design lesson: a Powers constitution should separate
  the founding/identity act (deploying `Powers.sol`, naming the DAO) from the operating rules
  (which mandates are adopted). Treat the deployment transaction as the Memorandum-equivalent —
  it should carry minimal content — and put all substantive role/mandate logic in the
  constitution's initial `Adopt_Mandates` calls, the Powers equivalent of the Articles.
- Because the guarantee variant ties membership to a non-transferable personal undertaking rather
  than a financial stake, it supports using `SelfSelect` or `PeerSelect` (identity- or
  reputation-based entry) rather than a token-weighted entry mandate when modelling a
  guarantee-style CIC on Powers — capital contribution is not the membership boundary in this
  legal form, and a Powers design imitating it should not gate membership on token holdings.
