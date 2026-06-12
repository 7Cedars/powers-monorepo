# `/design-org` — AI governance design skill

A Claude Code slash command that guides you through designing and deploying an on-chain organisation on the Powers protocol. You describe your organisation in plain language; the skill produces a complete, ready-to-deploy Solidity package.

No Solidity knowledge required to use it. Foundry is only needed at the end to compile and run tests.

---

## Quick start

```bash
# 1. Build the RAG index (one-time setup, ~2–5 min on first run)
cd ai-skill
pnpm install
pnpm ingest

# 2. Restart Claude Code — the MCP server registers automatically via .claude/settings.json

# 3. Open a Claude Code session in the repo root and type:
/design-org
```

That's it. Claude will lead the conversation from there.

---

## What it produces

One conversation generates five files:

| File | What it is |
|------|------------|
| `documentation/src/content/docs/organisations/<name>.mdx` | Human-readable governance specification |
| `solidity/governance/claude/<name>/Deploy.s.sol` | Foundry deploy script |
| `solidity/governance/claude/<name>/Actions.s.sol` | Propose and execute helpers |
| `solidity/governance/claude/<name>/Runners.s.sol` | Stateless runners that advance governance flows |
| `solidity/governance/claude/<name>/Test.t.sol` | Fork-based end-to-end tests |

See [`solidity/governance/claude/`](../solidity/governance/claude/) for examples of what the output looks like.

---

## How the conversation works

The skill runs a five-phase workflow:

**Phase 1 — Load context** (silent). Claude reads the mandate catalogue, templates, and example constitutions.

**Phase 2 — Elicit**. Two rounds of questions about your organisation's purpose, stakeholders, decision types, trust structure, and any external integrations (Safe, NFTs, tokens, paymasters). Claude searches the governance theory library between rounds to inform its questions.

**Phase 3 — Specification**. Claude writes a human-readable `Spec.md` that you review and correct before any code is generated.

**Phase 4 — Code generation**. Claude generates the deploy script, action helpers, runners, and tests from the approved spec.

**Phase 5 — Build check**. Claude runs `forge build` and fixes any compilation errors before handing off.

---

## RAG setup (required once before first use)

The skill uses a local embedding index to retrieve relevant excerpts from governance theory papers (Ostrom, Carlisle, OECD, and others) during the design dialogue. No API key is needed — embeddings are computed locally using `nomic-ai/nomic-embed-text-v1.5` via `@huggingface/transformers`.

**1. Install dependencies**

```bash
cd ai-skill
pnpm install
```

**2. Build the index**

```bash
pnpm ingest
```

On first run this downloads the `nomic-embed-text-v1.5` model (~275 MB) from Hugging Face into your system cache (`~/.cache/huggingface/hub/`). Subsequent runs load from cache and are fast.

**3. Restart Claude Code**

The MCP server (`pnpm serve`) is registered in `.claude/settings.json` and starts automatically when you open a Claude Code session. It loads the model on startup (~2–5 s) and stays ready. No network access is needed after the initial download.

Re-run `pnpm ingest` any time you add new PDFs to `sources/` or update summaries in `references/`.

---

## Directory layout

```
ai-skill/
├── prompts/
│   └── institutionalDesign.md   # Mandate catalogue, design heuristics, condition encoding
├── references/
│   ├── reading_guide.md         # Annotated guide to the governance theory papers
│   └── *.md                     # Per-paper summaries used as fallback context
├── sources/
│   └── *.pdf                    # Governance theory papers (Ostrom, Carlisle, OECD…)
├── templates/
│   ├── orgSpec.md               # MDX template for the governance specification
│   └── deployScript.md          # Annotated Solidity deploy script template
├── embeddings/                  # Generated vector index (gitignored — run pnpm ingest)
└── src/
    ├── types.ts                 # Shared types for the RAG package
    ├── ingest.ts                # Parses sources/ and references/, builds embeddings/index.json
    └── server.ts                # MCP stdio server exposing search_governance_sources tool
```

The skill uses the `search_governance_sources` MCP tool (served from `src/server.ts`) to retrieve relevant excerpts during the design dialogue, rather than loading files directly.

---

## How Claude Code slash commands work

Claude Code looks for slash commands in two places:

| Location | Scope |
|----------|-------|
| `~/.claude/commands/<name>.md` | Available in every project on your machine |
| `<project-root>/.claude/commands/<name>.md` | Available only inside this project |

The `design-org` command lives at `.claude/commands/design-org.md` in this repository (project-scoped) and is version-controlled alongside the code it generates.

---

## Using this skill in a different project

**Option A — Copy the command file (project-scoped)**

1. Create `.claude/commands/` in the target project root if it does not exist.
2. Copy `.claude/commands/design-org.md` into it.
3. Copy the entire `ai-skill/` directory into the target project root.
4. Open a Claude Code session in the target project and run `/design-org`.

**Option B — Install globally (machine-scoped)**

1. Copy `design-org.md` to `~/.claude/commands/design-org.md`.
2. Put `ai-skill/` somewhere stable on your machine (e.g., `~/.claude/powers-ai/`).
3. Edit the file-path references inside `design-org.md` (the Phase 1 load list) to use the absolute path where you placed `ai-skill/`.
4. The command will now be available in every Claude Code project on your machine.

---

## Updating the skill

The skill has three layers that can be changed independently:

| Layer | File | What to change |
|-------|------|----------------|
| Conversation logic | `.claude/commands/design-org.md` | Phases, questions, output rules |
| Mandate knowledge | `ai-skill/prompts/institutionalDesign.md` | New mandates, updated config encodings, condition heuristics |
| Templates | `ai-skill/templates/orgSpec.md`, `ai-skill/templates/deployScript.md` | Output format for generated files |
| Theory | `ai-skill/references/` | Add PDFs to `sources/`; update `reading_guide.md` |

When a new mandate version ships, update the `MAJOR`/`MINOR`/`PATCH` constants at the top of `deployScript.md` and in the Phase 4 instructions inside `design-org.md`.

---

## Prerequisites for Phase 5 (compilation and tests)

The skill runs `forge build` at the end of a session. For this to work:

- Foundry must be installed: `forge --version`
- For fork tests, set `SEPOLIA_RPC_URL` in your environment before running:

```bash
forge test --match-contract <OrgName>_test -vvv
```
