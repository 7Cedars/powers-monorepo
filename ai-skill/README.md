# AI Governance Design — How to use `/design-org`

This directory contains the assets that power the `/design-org` skill for Claude Code.
The skill guides a non-technical governance designer through specifying an on-chain
organisation for the Powers protocol, then generates all four implementation files needed
to deploy it.

---

## What the skill produces

One conversation produces four Solidity files and one specification document:

| File | Purpose |
|------|---------|
| `documentation/src/content/docs/organisations/<name>.mdx` | Human-readable governance spec |
| `solidity/governance/examples/<Name>.s.sol` | Foundry deploy script |
| `solidity/governance/examples/actions/<Name>Actions.s.sol` | Propose/execute helpers |
| `solidity/governance/examples/actions/<Name>Runners.s.sol` | Stateless runners that advance governance flows |
| `solidity/test/governance/<Name>.t.sol` | Fork-based end-to-end tests |

---

## Directory layout

```
ai/
├── prompts/
│   └── institutionalDesign.md   # Mandate catalogue, design heuristics, condition encoding
├── references/
│   ├── reading_guide.md         # Annotated guide to the reference papers
│   └── *.md                     # Per-paper summaries used as fallback and for ingest
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

## RAG setup (required once before using `/design-org`)

The MCP server needs a pre-built embedding index. No API key required — embeddings are computed locally using `nomic-ai/nomic-embed-text-v1.5` via `@huggingface/transformers`.

**1. Install dependencies**

```bash
cd ai/
pnpm install
```

**2. Build the index**

```bash
pnpm ingest
```

On first run this downloads the `nomic-embed-text-v1.5` model (~275 MB) from Hugging Face into your system cache (`~/.cache/huggingface/hub/`). Subsequent runs load from cache and are fast. The script parses all PDFs in `sources/` and markdown files in `references/`, embeds each chunk, and writes `embeddings/index.json`.

**3. Restart Claude Code**

The MCP server (`pnpm serve`) is registered in `.claude/settings.json` and starts automatically when you open a Claude Code session. On startup it loads the model from cache (~2–5 s) and then stays ready. No network access is required after the initial download.

**Re-run ingestion** any time you add new PDFs to `sources/` or update summaries in `references/`.

---

## How Claude Code custom commands work

Claude Code looks for slash commands in two places:

| Location | Scope |
|----------|-------|
| `~/.claude/commands/<name>.md` | Available in every project on your machine |
| `<project-root>/.claude/commands/<name>.md` | Available only inside this project |

The `design-org` command lives at `.claude/commands/design-org.md` in this repository
(project-scoped). It is version-controlled alongside the code it generates.

When a user types `/design-org` in a Claude Code session opened inside this repository,
Claude reads that file and follows the five-phase workflow defined in it.

---

## Adding the skill to a different project or machine

**Option A — Copy the command file (project-scoped)**

1. Create a `.claude/commands/` directory in the target project root if it does not exist.
2. Copy `.claude/commands/design-org.md` into that directory.
3. Copy the entire `ai/` directory into the target project root (the skill loads files
   from `ai/prompts/`, `ai/templates/`, and `ai/references/` using relative paths).
4. Open a Claude Code session in the target project and run `/design-org`.

**Option B — Install globally (machine-scoped)**

1. Copy `design-org.md` to `~/.claude/commands/design-org.md`.
2. Put the `ai/` directory somewhere stable on your machine (e.g., `~/.claude/powers-ai/`).
3. Edit the file-path references inside `design-org.md` (the Phase 1 load list) to use
   the absolute path where you placed the `ai/` directory.
4. The command will now be available in every Claude Code project on your machine.

---

## Updating the skill

The skill has three layers that can be changed independently:

| Layer | File | What to change |
|-------|------|----------------|
| Conversation logic | `.claude/commands/design-org.md` | Phases, questions, output rules |
| Mandate knowledge | `ai/prompts/institutionalDesign.md` | New mandates, updated config encodings, condition heuristics |
| Templates | `ai/templates/orgSpec.md`, `ai/templates/deployScript.md` | Output format for generated files |
| Theory | `ai/references/` | Add PDFs; update `reading_guide.md` with annotations |

When a new mandate version ships (e.g., `PATCH` bumps from 7 to 8), update the
`MAJOR`/`MINOR`/`PATCH` constants at the top of `deployScript.md` and in the Phase 4
instructions inside `design-org.md`.

---

## Prerequistes for Phase 5 (compilation and tests)

The skill runs `forge build` at the end of a session. For this to work:

- Foundry must be installed (`forge --version`).
- The project must be configured (see `solidity/Makefile` for network RPC setup).
- For fork tests, set `SEPOLIA_RPC_URL` in your environment before running
  `forge test --match-contract <OrgName>_test -vvv`.
