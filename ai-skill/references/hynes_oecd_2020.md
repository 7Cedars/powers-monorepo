# Hynes, Lees & Müller (OECD/IIASA) 2020 — Systemic Thinking for Policy Making

**Citation:** Hynes, Lees & Müller (eds.), 2020. *Systemic Thinking for Policy Making: The
Potential of Systems Analysis for Addressing Global Policy Challenges in the 21st Century.*
OECD/IIASA. doi:10.1787/879c4f7a-en.
**Analytical level:** Dynamic
**Most relevant design decisions:** Q3 (mandate selection), Q4 (dependency chains), Q6 (adaptive capacity), Q7 (accountability)

---

## Q1 — Role Structure

Executive Summary, p. 13: "Systems thinking inside the public sector is generally a 'sense making'
tool to make interconnectedness visible (usually with the help of outside experts) rather than a
day-to-day practice that helps guide everyday action and decision-making. Even if policymakers as
individuals are systems thinkers, it does not mean the policies they design are systemic; one needs
institutions to support systems policy making." In Powers: individual good actors are not sufficient.
The mandate structure must institutionalise good governance behaviour, not depend on role holders
voluntarily behaving well. This justifies mandatory deliberation steps (`StatementOfIntent` with
`votingPeriod > 0`) rather than optional ones.

Ch 13, p. 134 (Jacobzone et al.): "Public governance covers the formal and informal arrangements,
including institutions, tools, and processes that determine how public decisions are made and how
public actions are carried out." Governance is more than government — "forming strategic alliances
across governments, businesses, and civil society organisations has become the new operating norm."
In Powers: the `allowedRole` parameter is the mechanism through which the governance design
specifies who participates. Restricting all mandates to a single role produces monocentric
governance regardless of the nominal structure.

Ch 13, p. 134: The 2007/2008 financial crisis revealed that governance failed despite institutional
maturity, because of "the complexity of rules and regulations in place with corresponding gaps and
loopholes; difficulty in identifying contributing actors; unavailable or highly uncertain information
on cascading impacts; undefined responsibility for taking systemic risk management decisions; and
little attributable accountability for the consequences." In Powers: attributable accountability
(every vote and execution permanently associated with a specific account) is a structural advantage
that should be surfaced to designers as one of the core governance benefits of on-chain governance.

---

## Q3 — Mandate Selection

Ch 13, p. 135 (Jacobzone et al.): The key principle — a systems approach must be applied to
"both the system to be governed and the governance system itself" (citing Jentoft et al., 2007).
In Powers: the governance constitution is itself a system to be governed. This is the argument
for including reform mandates (`Adopt_Mandates`, `MandatePackage`) as first-class design elements,
not afterthoughts. A constitution with no reform mandate has no built-in mechanism for self-
modification — equivalent to an organisation with no board meeting procedure.

Ch 13, p. 137: For "wicked problems" with no agreed definition or solution, the linear
analyse-prioritise-implement approach fails. The alternative is "adaptive, evolutionary, and
participatory learning." In Powers: for contested governance domains (multi-stakeholder
organisations, organisations managing shared resources), prefer a `StatementOfIntent`-based
deliberation chain before any execution mandate, rather than direct `BespokeAction` with no
intermediate deliberation step. The deliberation step converts contested problems into structured
signals before action.

Ch 13, p. 137: OECD's 'whole of society' approach recognises that governance of systemic risk
must incorporate civil society and business alongside government. In Powers: `allowedRole` can
be set to a broad community role to implement this; restricting execution or deliberation to a
small admin role excludes the perspective diversity that the systemic approach requires.

Ch 13, pp. 137–138 (cogeneration example): IIASA's three-year stakeholder cogeneration process
brought together groups with "very different perspectives on the problem" to co-generate a
compromise solution that had "credibility and legitimacy" across stakeholders. In Powers: reform
mandates should have a broad `allowedRole` during reform phases — limiting `Adopt_Mandates` to
an admin-only role contradicts the cogeneration principle and concentrates adaptive capacity in
a single point of failure.

---

## Q4 — Dependency Chains

Ch 12, p. 124 (Poledna et al.): Systemic risk arises from "cascading failures" — "the default of
one financial agent may trigger defaults of others. Secondary defaults might cause avalanches of
defaults percolating throughout the entire network and can potentially wipe out the financial
system via a deleveraging cascade." In Powers: long `needFulfilled` chains create systemic
interdependence. If mandate A stalls (no quorum, no proposer), all downstream mandates B, C, D
are permanently blocked. Design for fault tolerance: avoid chains longer than 3 sequential
`needFulfilled` dependencies; use `throttleExecution` to prevent single mandates from becoming
permanent chokepoints.

Ch 12, p. 124: "Systemic risks overwhelmingly do not follow normal risk distributions, but tend
to be fat-tailed." In practical terms: emergency mandates (pause, veto, revoke) are rarely used
but must be robust precisely when the system is under stress — the exact condition under which
normal governance pathways are most likely to fail. Test emergency paths separately from the
happy path; do not assume that if the main flow works, the emergency flow is also sound.

Ch 12, p. 129 (IRGC 7-step approach): The IRGC *Guidelines for the Governance of Systemic Risk*
propose a seven-step approach: (1) explore system and define boundaries; (2) develop scenarios;
(3) determine goals and risk tolerability; (4) co-develop management strategies; (5) address
unanticipated barriers; (6) decide, test, implement; (7) **monitor, learn, review, and adapt.**
In Powers: the reform mandate is the on-chain implementation of step 7. A constitution with no
reform mandate has no built-in step 7, making it structurally incapable of the iterative
improvement that the IRGC framework requires.

Ch 12, p. 129: Linkov and Trump (2019) define resilience as "the ability of a system to plan and
prepare for, absorb and withstand, recover from, and adapt to adverse events and disruptions."
In Powers: governance resilience requires all four phases to be supported by mandates — prepare
(`StatementOfIntent` deliberation), absorb (`PauseMandates`), recover (`RevokeAccountsRoleId`
with graduated chain), adapt (`Adopt_Mandates`). A constitution that only supports execution
(prepare and act) without the absorb/recover/adapt phases is resilient only in the normal case.

Ch 13, p. 137: The science-to-policy translation problem: "policy cannot be justified on
'objective' risk estimates" alone; "the importance of a credible and trustworthy social decision
process becomes apparent." In Powers: the on-chain vote record is the social decision process.
A mandate that executes without a voting period (`votingPeriod = 0`) removes the trustworthy
social process layer, reducing the constitution's legitimacy claim.

---

## Q6 — Adaptive Capacity

Executive Summary, p. 13: "Even if policymakers as individuals are systems thinkers, it does not
mean the policies they design are systemic; one needs institutions to support systems policy
making." Individual goodwill is not a governance substitute. The mandate structure must
institutionalise good governance behaviour, not depend on role holders voluntarily behaving well.
This justifies requiring `votingPeriod > 0` on any mandate that controls treasury funds or role
assignment, even when the organisation is small enough that informal consensus would suffice.

Ch 13, pp. 137–138: Adaptive governance of systemic risk requires an "iterative process" that
"bridges the gap between expert analyses and implementation challenges" through adaptive,
evolutionary, and participatory learning. In Powers: `Adopt_Mandates` with broad `allowedRole`
is the mechanism for this iterative cycle. Constitutions that make reform difficult (admin-only
reform mandates, high quorum requirements on `Adopt_Mandates`) limit the iterative adaptation
that complex governance systems require.

Ch 13, p. 138: IIASA's co-generation process explicitly required "adequate resources to enable
their participation" as a prerequisite for meaningful stakeholder involvement. In Powers: the
`allowedRole` for reform mandates should include roles with sufficient standing and information
to make reform decisions — a base member role with no access to governance data cannot
meaningfully exercise reform authority even if formally granted it.

---

## Q7 — Accountability

Ch 13, p. 135: "A fundamental challenge to governing systemic risk is understanding the system as
a complex network of individual and institutional actors with different and often conflicting
interests, values, and worldviews." Standard accountability mechanisms (elections, hearings) are
inadequate when responsibility is dispersed. Powers' on-chain action record provides explicit,
attributable accountability — every vote, proposal, and execution is permanently associated with
a specific account. This is a structural governance advantage: the record is the accountability
mechanism, not a supplement to it.

Ch 13, p. 135 (Helbing, 2013): "Collective responsibility" as a principle of systemic risk
governance raises the attribution problem: when everyone is responsible, diffuse accountability
means no one is effectively held to account. In Powers: avoid mandates where accountability is
collective without individual attribution (e.g., a role where all members jointly propose but no
individual can be identified). `StatementOfIntent` with per-account vote tracking solves this.

Ch 13, p. 136: OECD's good governance framework for critical infrastructure resilience underlines
"the importance of a whole of government and even a whole of society approach, with a systems'
perspective on the governance of critical risks." In Powers: accountability to the whole
organisation — not just to admins or stewards — is implemented by assigning accountability-
monitoring mandates (audit, censure, `StatementOfIntent` veto) to broad `allowedRole` values.

Ch 12, p. 128: "Management of systemic risk is, therefore, foremost in the public interest and
must require financial institutions to internalise costs of systemic risk or otherwise create an
incentive to minimise risks that are borne by the public." Translated to on-chain governance:
governance structures must create incentives for role holders to internalise the systemic costs
of their decisions. A veto or censure mandate accessible to those who bear the consequences
(not only those who take the actions) implements this internalisation requirement.

---

## What to skip

Chapters 2–11 (economic paradigms, environment and sustainable development, social and economic
change, innovation policy) address macro-policy domains with no direct mapping to mandate
parameters. Chapter 15 (training dimensions for systems thinking) and Chapter 16 (OECD-IIASA
work programme) are institutional planning documents. All quantitative financial network
modelling (DebtRank, CoVaR, SES, systemic expected shortfall) in Chapter 12 is not applicable
to on-chain governance design — the conceptual conclusions from that modelling are captured
above; the methods are not replicable in the Powers context.

---

## Mandate implications

- The cascading failure analysis (Ch 12) adds a design constraint: mandate chains longer than 3
  sequential `needFulfilled` dependencies should be reviewed for resilience. If the first mandate
  in a chain can stall indefinitely (e.g., no quorum mechanism), the entire downstream chain is
  at risk.
- The "institutions must support good governance" argument (Executive Summary) supports requiring
  `votingPeriod > 0` on any mandate that controls treasury funds or role assignment, even when
  the organisation is small enough that informal consensus would suffice. The mandate structure
  should work correctly even when actors are adversarial.
- The cogeneration principle (Ch 13) supports broad `allowedRole` on reform mandates — opening
  `Adopt_Mandates` to general members, not only admins, increases the organisation's adaptive
  capacity.
- The IRGC 7-step framework (Ch 12) provides a design completeness check: does the constitution
  cover all seven steps? Most constitutions naturally cover steps 1–6 (propose, deliberate,
  execute). Step 7 (monitor, learn, adapt) requires explicit reform mandates; confirm these exist.
- The fat-tailed risk observation (Ch 12) supports robust emergency paths: pause, veto, and
  revocation mandates should be tested against adversarial scenarios (quorum failure, admin
  capture, deliberate blocking) not just normal-use scenarios.
