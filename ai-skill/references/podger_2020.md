# Podger, Chan & Wanna 2020 — Designing Governance Structures

**Citation:** Podger, Su, Wanna & Chan (eds.), 2020. *Designing Governance Structures for
Performance and Accountability.* ANU Press.
**Analytical level:** Structural + Parametric
**Most relevant design decisions:** Q1 (role structure), Q3 (mandate selection), Q5 (membership), Q7 (accountability)

---

## Q1 — Role Structure

Ch 1, p. 11 (Podger, Chan, Wanna): The book's central conclusion is that functions can be "usefully
mapped to different degrees of independence (and different areas of autonomy) to optimise
performance and accountability." Core policy-setting functions should sit towards the high-political-
control end; regulatory and integrity functions towards the high-independence end; service delivery
in between. In Powers terms: assign `OpenAction` only to roles at the high-trust, low-political-
control end; use `BespokeAction_Simple` or `PresetActions` for roles that need constrained discretion.

Ch 2, Figure 2.1 (Wanna, p. 20): Spectrum of political control over public sector organisations
(departments → cost centres → non-statutory bodies → advisory statutory bodies → marketing bodies
→ government business enterprises → judicial bodies). This is directly usable as a role-design
checklist: before assigning mandate types, position each proposed role on this spectrum based on
its function. Roles near the "departments" end warrant tighter mandate chains; roles near the
"judicial bodies" end warrant higher autonomy and `PeerSelect` appointment mechanisms.

Ch 2, pp. 19–22 (Wanna): "Dimensions of independence — balancing 'control' and 'relative
autonomy'." Formal independence can be undermined by budgetary control or appointment power —
"formal grants of autonomy to decision-making centers do not guarantee them considerable de facto
autonomy." Governments have "a myriad of ways of influencing nominally independent statutory
bodies by making ministerial changes to board representation, adjusting budgets, altering the
empowering act of the body, making them subject to other legislation, using departmental oversight,
and even having a 'quiet word' with a minister." In Powers: a role assigned through `PeerSelect`
has higher de facto autonomy than one assigned through admin-controlled `RevokeAccountsRoleId`,
even if both are nominally "elected." The appointment mandate is as important as the execution
mandate for determining real independence.

Ch 2, pp. 21–22 (Wanna): Statutory bodies are established "to depoliticise a particular function
and to prevent ministers from either meddling or being blamed for unpopular decisions." The
existence of specialist agencies "develop and protect their level of autonomy through professional
norms, codes of practice and inculcated trainings." In Powers: for roles designed to perform
regulatory or integrity functions, use `PeerSelect` (professional peers approve membership) rather
than `SelfSelect` — professional peer vetting creates a cultural independence that formal rules alone
cannot replicate.

Ch 2, p. 14 (Wanna): The "Weberian paradox" — if bureaucrats are conditioned to follow rules
throughout their careers, who provides the leadership qualities at the pinnacle necessary for the
organisation to function? In Powers: a governance constitution that only specifies rules without
designating roles for adaptive leadership (reform mandates assigned to a subset of senior roles)
replicates this paradox at the on-chain level.

Ch 2, pp. 17–19 (Wanna): Organisational form is shaped by twin forces: *conformity* (imposing
commonality and standardised application for political control and accountability) and *flexibility*
(enabling performance through autonomy). A successful governance design holds these in tension
rather than resolving them in favour of either extreme. In Powers: a constitution that gives
every role `OpenAction` maximises flexibility but eliminates conformity accountability; one that
gives every role only `PresetActions` maximises conformity but loses adaptive capacity. Mix
mandate types intentionally across roles rather than applying the same type uniformly.

---

## Q3 — Mandate Selection

Ch 1, pp. 5–6 (Podger): Inconsistency between similar functions having different levels of
political control "may adversely affect performance." The argument is for coherence: the mandate
type selected for a governance function should be consistently applied across similar functions.
Do not mix `OpenAction` (broad discretion) and `BespokeAction_Simple` (narrow discretion) for
functionally equivalent roles.

Ch 5, pp. 5–6 (Gilchrist): The Delivering Community Services Partnership (DCSP) established a
Partnership Forum — a formal cross-sector deliberation body between government and the not-for-
profit sector. This is a structural analogue for `StatementOfIntent` used as a deliberation
mandate rather than a blocking veto: it creates a recorded signal without immediately stopping
execution. The DCSP case also illustrates that infrastructure investment (training, contracting
systems) is required for the Partnership Forum to function — a `StatementOfIntent` deliberation
step is only effective if the `allowedRole` includes members who have the capacity to participate.

Ch 5, p. 6 (Gilchrist): The audit found "insufficient funding of change management to effect the
paradigm change intended." Translated: governance structure changes without support mechanisms
fail. When adopting new mandates via `Adopt_Mandates`, the governance design should also consider
what capacity-building is needed for the new mandate to be used effectively.

---

## Q5 — Membership Design

Ch 7, pp. 6–7 (Godwin): Integrity organisations with formal independence protections in their
statutes still had membership controlled through politically sensitive appointment processes.
The lesson: formal membership rules (who can join) and actual appointment mechanisms (how they
get there) must both be designed. In Powers, `SelfSelect` sets the formal rule (anyone can join);
but a subsequent `PeerSelect` or `RevokeAccountsRoleId` is what governs the actual composition.
Design both layers explicitly.

Ch 8, pp. 8–9 (Chen & Liu): Community-based organisations in Hong Kong and Taiwan provide "a
degree of independence from the vicissitudes of contemporary politics" and "space for active
deliberation." This maps to the open-membership pattern: `SelfSelect` with a broad `allowedRole`
creates a base membership layer that is insulated from top-down control. Chen and Liu also note
these organisations contribute to "capacity building in the broader public sector" — open
membership layers are not merely passive but actively develop governance capability.

Ch 2, p. 22 (Wanna): "Judicial and integrity commissions have been given the most autonomy, but
are still subject to budgetary review and financial controls, politicised appointment processes
and the odd rebuke." Design implication: for roles that must maintain genuine independence (e.g.
an audit role or veto role), the appointment mechanism and the revocation mechanism are more
critical to the actual independence than the execution mandate. A role with `OpenAction` but
`RevokeAccountsRoleId` revocable by admin has weaker independence than a role with
`BespokeAction_Simple` but revocation requiring a two-thirds supermajority.

---

## Q7 — Accountability

Ch 1, p. 2 (Wanna): Accountability runs both "upward" (to governing supervisors) and "outward"
(to the public and clients). Powers' on-chain action record provides upward accountability
automatically (all votes and executions are attributable). Outward accountability — to those
affected but not participating — requires additional design, such as a public `StatementOfIntent`
mandate accessible to a broad role.

Ch 7, pp. 5–6 (Godwin): The merit protection commissioner describes "a more complex balancing of
control and autonomy" between enforcement (binary: revoke) and educational accountability
(graduated: signal, warn, then revoke). In Powers: `RevokeAccountsRoleId` is binary enforcement;
a deliberation mandate (`StatementOfIntent`) used as a censure or warning step is the graduated
alternative. For accountability-sensitive roles, prefer graduated before binary.

Ch 7, p. 7 (Godwin): Integrity organisations increasingly work together "to optimise their
impact." A single `StatementOfIntent` mandate accessible to multiple accountability roles is more
robust than separate accountability paths that may conflict or overlap without coordination.

Ch 2, pp. 14–15 (Wanna): "Greater interest in the overall accountability of the bureaucracy began
to develop in the late 19th century, initially addressing issues of legality, judicial and
financial probity, administrative due process, legislative scrutiny." The evolution from internal
to external accountability mirrors the Powers mandate spectrum from `PresetActions` (internally
constrained) to `OpenAction` with `StatementOfIntent` veto chain (externally accountable).

Ch 1, pp. 3–5 (Podger): "Inconsistency between similar functions having different levels of
independence adversely affects performance." Inconsistency across accountability mechanisms — some
roles having strong veto chains and others having none — creates a structural accountability
imbalance that undermines the legitimacy of the entire constitution.

---

## What to skip

The empirical case material on Australia, Taiwan, and PRC governance reforms (Chapters 3–6, 9–11)
is too jurisdiction-specific. The performance monitoring chapters (Bennis Wai Yip So on Taiwan's
historical performance management; Meng et al. on provincial environmental pilots in China) have
no direct mapping to mandate parameters. Chapter 4 (Jiang on Taiwan structural reform) is
interesting but addresses constitutional architecture above the level of mandate design.

---

## Mandate implications

- The "form should follow function" principle (Ch 1) supports a design rule: select mandates that
  match the functional independence level of the role. High-independence roles (regulatory,
  integrity) → `PeerSelect` + veto chain. Low-independence roles (service delivery) →
  `BespokeAction_Simple` with admin timelock.
- The formal vs. de facto independence distinction (Ch 2) warns against assuming that assigning
  a role via `PeerSelect` guarantees independent behaviour if the admin role can unilaterally
  revoke that assignment. Consider adding a `needFulfilled` requirement on any revocation mandate
  — revocation should itself require a vote, not just admin action.
- The twin-forces analysis (Ch 2) suggests that mandate diversity across roles is not just
  organisational variety — it is the structural realisation of the conformity/flexibility balance.
  A constitution should have both high-constraint mandates (conformity) and high-discretion
  mandates (flexibility) assigned to different roles, with the balance determined by function.
- The Weberian paradox (Ch 2) justifies including reform mandates (`Adopt_Mandates`) as standard
  elements in any constitution: leadership capacity requires the ability to change the rules, not
  just follow them.
