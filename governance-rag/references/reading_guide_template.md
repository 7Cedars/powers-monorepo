# How to Add a New Reference Source

Adding a new source is a two-step process:

1. **Create a source file** — a dedicated `author_year.md` in `ai/references/` with the full
   reading guide for the source (150–300 lines).
2. **Update the index** — add a row to the source table and routing entries to `reading_guide.md`.

---

## Step 1 — Create the source file

Name the file `[first_author_lastname]_[year].md` (e.g., `ostrom_1990.md`).

Use this structure:

```markdown
# [Author(s) Year] — [Short Title]

**Citation:** [Full citation]
**Analytical level:** [Structural / Parametric / Dynamic — may combine]
**Most relevant design decisions:** [list Q numbers]

---

## Q1 — Role Structure

[Chapter/section reference]: [actionable claim mapped to Powers mandate/role terminology]

[Additional entries as needed — each a separate paragraph]

---

## Q2 — Voting Parameters

[Omit this section entirely if the source has nothing actionable to say on Q2]

---

## Q3 — Mandate Selection

...

## Q4 — Dependency Chains

...

## Q5 — Membership Design

...

## Q6 — Adaptive Capacity

...

## Q7 — Accountability

...

---

## What to skip

[One or two sentences on what parts of the source are too context-specific, too formal/
mathematical, or otherwise not actionable for Powers mandate design.]

---

## Mandate implications

- [Bullet: a design rule directly derived from this source, with the specific mandate or
  parameter it affects]
- [...]
```

**Rules for the source file:**

- Omit any Q section where the source has nothing actionable to say. A source strong on Q3 and
  Q6 but silent on Q2 should leave Q2 out entirely.
- Every claim must cite a specific chapter, section, or page — not just "the book argues..."
- Every claim must be actionable: it should change a design choice (mandate type, parameter
  value, role structure), not just provide vocabulary or background.
- Use Powers mandate names in their exact form: `OpenAction`, `BespokeAction_Simple`,
  `PresetActions`, `StatementOfIntent`, `PeerSelect`, `SelfSelect`, `RevokeAccountsRoleId`,
  `Adopt_Mandates`, `Revoke_Mandates`, `MandatePackage`, `PauseMandates`, `needFulfilled`,
  `needNotFulfilled`, `allowedRole`, `votingPeriod`, `throttleExecution`.
- Target 150–300 lines per source file.

---

## Step 2 — Determine the analytical level

Before writing, identify which of the three levels the source primarily operates at:

| Level | What it addresses | Relevant design decisions |
|---|---|---|
| **Structural** | What governance forms exist and how they differ | Role structure, separation of powers, mandate selection |
| **Parametric** | How to calibrate governance rules for context | Voting parameters, membership design |
| **Dynamic** | How governance systems change and fail over time | Reform flows, adaptive capacity, accountability |

A source may span more than one level. Note the primary level and any secondary ones.

---

## Step 3 — Extract answers to the seven core design questions

Read the source with these questions in mind. For each one, note the relevant passage and the
core claim that is actionable for governance design.

**Q1 — Role Structure and Separation of Powers**
*Who should hold authority over what, and how should it be distributed?*
Look for: typologies of governance forms; arguments for/against concentrating authority; conditions
under which separation of powers increases accountability or creates gridlock; vocabulary that maps
to Powers roles (proposer, deliberator, executor, auditor).

**Q2 — Voting Parameters**
*What makes a vote legitimate? How long, how many, what threshold?*
Look for: minimum conditions for a decision to be valid; trade-offs between quorum and quality;
time-horizon arguments; empirical benchmarks.

**Q3 — Mandate Selection**
*Which governance pattern fits this organisation's purpose and stakeholder structure?*
Look for: typologies of governance problems (collective action, principal-agent, commons); which
structural features match which problem types; arguments for redundancy vs. simplicity; conditions
under which permissive governance is safe vs. risky.

**Q4 — Dependency Chains**
*Which decisions must follow others, and which must be mutually exclusive?*
Look for: sequential vs. parallel decision processes; veto and override mechanisms; feedback loop
analysis; sequencing failures (what goes wrong when a step is skipped or reordered).

**Q5 — Membership Design**
*Who belongs, how do they join, and how can they be removed?*
Look for: boundary definitions; entry and exit conditions and their effects on participation
incentives; removal mechanisms; open vs. closed membership trade-offs.

**Q6 — Adaptive Capacity and Reform**
*Can the governance system modify its own rules, and how?*
Look for: conditions under which self-modification is stabilising vs. destabilising; minimum
requirements for governed reform; distinction between incremental adjustment and wholesale
restructuring; what happens to governance systems that cannot adapt.

**Q7 — Accountability and Monitoring**
*How does the system detect and correct role-holder behaviour that violates its rules?*
Look for: monitoring mechanisms (internal vs. external, peer vs. hierarchical); enforcement
mechanisms and proportionality (graduated sanctions vs. binary removal); accountability gaps.

---

## Step 4 — Check against the mandate catalogue

After drafting the source file, scan `ai/prompts/institutionalDesign.md` Section 3 (Mandate
Catalogue) and ask: does anything in this new source change how a mandate should be used or when
it should be recommended? If yes, note it in the **Mandate implications** section.

---

## Step 5 — Update reading_guide.md

Add two things to `reading_guide.md`:

**A. Add a row to the source table:**

```markdown
| [`author_year.md`](author_year.md) | Full citation | Structural / Parametric / Dynamic |
```

**B. Add routing entries under the relevant Q headings:**

For each Q the source covers meaningfully, add a **Primary / Secondary / Tertiary** entry
under that heading. Use this format:

```markdown
**[Primary / Secondary / Tertiary]:** `author_year.md`
One sentence on what this source adds that the primary (or higher-ranked) source does not.
Use it when [specific condition: the question being asked, the design situation, the
organisation type].
```

If any cross-cutting design rule from the new source appears independently in two or more
existing sources, add it to the **Cross-cutting design rules** section at the bottom of
`reading_guide.md`.

---

## Step 6 — Rebuild the embedding index

Run `pnpm ingest` from the `ai/` directory to re-embed all sources and update `ai/embeddings/index.json`. The new source file will not appear in RAG search results until this step is complete.

---

## Checklist before finalising

- [ ] Source file named `author_year.md` following the convention
- [ ] Every Q entry cites a specific chapter, section, or page
- [ ] Every claim is actionable: it changes a design choice, not just provides vocabulary
- [ ] Powers mandate names used in their exact form throughout
- [ ] "What to skip" section is present and honest
- [ ] Mandate implications checked against `institutionalDesign.md` Section 3
- [ ] Source table row added to `reading_guide.md`
- [ ] Routing entries added under the relevant Q headings in `reading_guide.md`
- [ ] Any cross-cutting rules added to the bottom section of `reading_guide.md`
- [ ] `pnpm ingest` run and `ai/embeddings/index.json` updated
