# How to Create a Reference Reading Guide for a New Source

This document is a process template. Use it whenever a new governance theory source is added to
`ai/references/`. The goal is to produce a concise lookup entry that maps the source's content
to the specific governance design decisions made by the `/design-org` skill.

The output is a new section appended to `reading_guide.md`.

---

## Step 1 — Identify the Source's Analytical Level

Before reading in detail, determine which of the three levels the source primarily operates at.
This tells you which design decisions it will inform most directly.

| Level | What it addresses | Relevant design decisions |
|---|---|---|
| **Structural** | What governance forms exist and how they differ | Role structure, separation of powers, mandate selection |
| **Parametric** | How to calibrate governance rules for context | Voting parameters, membership design |
| **Dynamic** | How governance systems change and fail over time | Reform flows, adaptive capacity, accountability |

A source may span more than one level. Note the primary level and any secondary ones.

---

## Step 2 — Extract Answers to the Seven Core Design Questions

Read the source with these seven questions in mind. For each one, note the relevant passage
(chapter, section, or page) and the core claim that is actionable for governance design.

### Q1 — Role Structure and Separation of Powers
*Who should hold authority over what, and how should it be distributed?*

Look for:
- Typologies of governance forms (unitary, bicameral, federated, polycentric)
- Arguments for or against concentrating decision authority in one body
- Conditions under which separation of powers increases accountability or creates gridlock
- Vocabulary the source uses that maps to Powers roles (proposer, deliberator, executor, auditor)

### Q2 — Voting Parameters
*What makes a vote legitimate? How long, how many, what threshold?*

Look for:
- Minimum conditions for a decision to be considered valid or legitimate
- Trade-offs between participation breadth (quorum) and decision quality (supermajority)
- Time horizon arguments — when does a longer deliberation period improve outcomes?
- Any empirical benchmarks (e.g., "organisations of N members tend to use X% quorum")

### Q3 — Mandate Selection
*Which governance pattern fits this organisation's purpose and stakeholder structure?*

Look for:
- Typologies of governance problems (collective action, principal-agent, commons management, etc.)
- Which structural features are associated with which problem types
- Arguments for redundancy (overlapping mandates) vs. simplicity (minimal mandates)
- Conditions under which optimistic/permissive governance is safe vs. risky

### Q4 — Dependency Chains
*Which decisions must follow others, and which must be mutually exclusive?*

Look for:
- Sequential vs. parallel decision processes and when each is appropriate
- Veto and override mechanisms — what triggers them, who holds them
- Feedback loop analysis: does the source identify reinforcing or balancing loops in governance?
- Sequencing failures (what goes wrong when a step is skipped or reordered)

### Q5 — Membership Design
*Who belongs, how do they join, and how can they be removed?*

Look for:
- Boundary definitions — how does the source define who is inside or outside a governance system?
- Entry and exit conditions and their effects on participation incentives
- Removal mechanisms — who holds them, under what conditions, with what safeguards?
- Open vs. closed membership trade-offs

### Q6 — Adaptive Capacity and Reform
*Can the governance system modify its own rules, and how?*

Look for:
- Conditions under which self-modification is stabilising vs. destabilising
- Minimum structural requirements for governed reform (as opposed to top-down change)
- Distinction between incremental rule adjustment and wholesale restructuring
- What the source says about governance systems that *cannot* adapt (brittleness, capture)

### Q7 — Accountability and Monitoring
*How does the system detect and correct role-holder behaviour that violates its rules?*

Look for:
- Monitoring mechanisms and who performs them (internal vs. external, peer vs. hierarchical)
- Enforcement mechanisms and proportionality (graduated sanctions vs. binary removal)
- What the source says about the cost of monitoring relative to the cost of non-compliance
- Accountability gaps — structural conditions that make accountability fail

---

## Step 3 — Identify What Is NOT Useful

Note explicitly what to skip. This prevents the lookup guide from becoming a general summary.
Common things to exclude:
- Empirical case material that is too context-specific to generalise (particular countries,
  agencies, historical periods)
- Mathematical or formal models that the protocol cannot implement
- Historical/genealogical narrative about the development of the concept
- Normative arguments about what governance *should* be (useful for framing, not for parameters)

---

## Step 4 — Write the Lookup Entry

Use this structure for each source entry. Keep each cell to one or two sentences — the goal is
a quick lookup, not a summary.

```markdown
## [Author(s) Year] — [Short Title]

**Analytical level:** [Structural / Parametric / Dynamic]
**Most relevant design decisions:** [list Q numbers from Step 2]

### Q1 — Role Structure
[Chapter/section reference]: [one actionable claim]

### Q2 — Voting Parameters
[Chapter/section reference]: [one actionable claim]

### Q3 — Mandate Selection
[Chapter/section reference]: [one actionable claim]

### Q4 — Dependency Chains
[Chapter/section reference]: [one actionable claim]

### Q5 — Membership Design
[Chapter/section reference]: [one actionable claim]

### Q6 — Adaptive Capacity
[Chapter/section reference]: [one actionable claim]

### Q7 — Accountability
[Chapter/section reference]: [one actionable claim]

### What to skip
[One sentence on what is not useful for design decisions]
```

Omit any Q entry where the source has nothing actionable to say. A source strong on Q3 and Q6
but silent on Q2 should leave Q2 out entirely rather than filling it with a weak observation.

---

## Step 5 — Check Against the Mandate Catalogue

After drafting the entry, scan `ai/prompts/institutionalDesign.md` Section 3 (Mandate Catalogue)
and ask: does anything in this new source change how a mandate should be used or when it should
be recommended? If yes, note it in the entry under a short **Mandate implications** heading.

Example candidates:
- A new argument for when `OpenAction` is too risky → add to Q3 entry
- Evidence that veto periods shorter than 48h tend to be ignored → add to Q4 entry
- A framework for when `RevokeInactiveAccounts` creates perverse incentives → add to Q5 entry

---

## Checklist Before Finalising

- [ ] Every Q entry cites a specific chapter, section, or page — not just "the book argues..."
- [ ] Every claim is actionable: it changes a design choice, not just provides vocabulary
- [ ] The "What to skip" section is present and honest
- [ ] The entry has been checked against the mandate catalogue (Step 5)
- [ ] The new source is added to the table at the top of `reading_guide.md`
