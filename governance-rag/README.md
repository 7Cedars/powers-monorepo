# `governance-rag` — MCP server for governance design

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) HTTP server that provides semantic search over a curated library of governance theory papers (Ostrom, Carlisle, OECD, and others). It exposes a single tool — `search_governance_sources` — used by the [`/design-org`](../.claude/commands/design-org.md) Claude Code skill to ground governance design conversations in published research.

---

## Quick start (hosted server)

A public instance is deployed on Railway. Connect it to Claude Code with one command:

```bash
claude mcp add --transport http governance-rag https://selfless-optimism-production-b92b.up.railway.app/mcp
```

Then restart your Claude Code session and run `/design-org`. No local setup required.

---

## How the `/design-org` skill uses this MCP

The [`/design-org`](../.claude/commands/design-org.md) slash command guides non-technical users through designing an on-chain organisation on the Powers protocol. It calls `search_governance_sources` at two specific points during Phase 2 (the elicitation dialogue):

1. **Contextual query** — after the user describes their organisation's purpose and stakeholders, Claude searches for theory relevant to that specific governance challenge (e.g. `"polycentric commons electoral design legitimacy"`).

The MCP tool returns scored excerpts from the source corpus. Claude cites these in the spec it writes to `solidity/governance/<org-name>/Spec.md`.

If the MCP is unreachable, the skill warns the user and prints the `claude mcp add` command shown above before falling back to locally-loaded reference files.

---

## The `search_governance_sources` tool

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | Free-text semantic search query |
| `k` | `number` (optional, default 5) | Number of results to return |

Each result contains:
- `source` — filename of the paper or summary the excerpt came from
- `sourceType` — `"pdf"` or `"markdown"`
- `text` — the retrieved passage
- `relevanceScore` — cosine similarity (0–1)

---

## Self-hosting

Run your own instance if you want to extend the corpus or keep everything local.

**1. Install dependencies**

```bash
cd governance-rag
pnpm install
```

**2. Build the embedding index**

```bash
pnpm ingest
```

This reads every PDF in `sources/` and every Markdown file in `references/`, splits them into chunks, and computes embeddings using `nomic-ai/nomic-embed-text-v1.5` via `@huggingface/transformers`. The model (~275 MB) is downloaded on first run into `~/.cache/huggingface/hub/` and cached for subsequent runs. The index is written to `embeddings/index.json`, which is committed to git and deployed as a pre-built artifact — ingestion always runs locally, never on the server.

Re-run `pnpm ingest` any time you add PDFs to `sources/` or update summaries in `references/`, then commit the updated `embeddings/index.json` before deploying.

**3. Start the server**

```bash
pnpm serve          # development (tsx, hot-reload)
pnpm start          # production (compiled JS)
```

The server listens on `PORT` (default `3000`). It exposes a single MCP endpoint at `/mcp` using the Streamable HTTP transport.

**4. Register with Claude Code**

```bash
claude mcp add --transport http governance-rag http://localhost:3000/mcp
```

Restart Claude Code, then run `/design-org` as normal.

---

## Adding sources

| What to add | Where to put it |
|-------------|-----------------|
| New governance theory paper | `sources/*.pdf` |
| Per-paper summary or annotated notes | `references/*.md` |
| Annotated guide to the whole corpus | `references/reading_guide.md` |

After adding files, re-run `pnpm ingest` to rebuild the index.

---

## Deploying

```bash
cd governance-rag
pnpm ingest   # regenerate embeddings/index.json locally, only needed when sources/ or references/ change
railway up
```

The Railway build only installs dependencies, copies `src/` and the pre-built `embeddings/`, and compiles TypeScript — it never re-runs ingestion or downloads the embedding model. `sources/` (the raw PDFs) is excluded from the upload via `.railwayignore` and never reaches the server.

---

## Directory layout

```
governance-rag/
├── prompts/
│   └── institutionalDesign.md   # Mandate catalogue, design heuristics, condition encoding
├── references/
│   ├── reading_guide.md         # Annotated guide to the governance theory papers
│   └── *.md                     # Per-paper summaries (also ingested into the RAG index)
├── sources/
│   └── *.pdf                    # Governance theory papers (Ostrom, Carlisle, OECD…)
├── templates/
│   ├── orgSpec.md               # MDX template for the governance specification
│   └── deployScript.md          # Annotated Solidity deploy script template
├── embeddings/                  # Generated vector index (committed — run pnpm ingest locally to update)
└── src/
    ├── types.ts                 # Shared types
    ├── ingest.ts                # Parses sources/ and references/, writes embeddings/index.json
    └── server.ts                # Express + MCP HTTP server exposing search_governance_sources
```

---

## Using `/design-org` in a different project

**Option A — Copy the command file (project-scoped)**

1. Create `.claude/commands/` in the target project root if it does not exist.
2. Copy `.claude/commands/design-org.md` into it.
3. Copy the `governance-rag/prompts/`, `governance-rag/templates/`, and `governance-rag/references/` directories into an `governance-rag/` folder in the target project.
4. Register the hosted MCP (or your self-hosted instance) via `claude mcp add` as shown above.
5. Open a Claude Code session in the target project and run `/design-org`.

**Option B — Install globally (machine-scoped)**

1. Copy `design-org.md` to `~/.claude/commands/design-org.md`.
2. Edit the file-path references inside `design-org.md` (the Phase 1 load list) to use absolute paths pointing to wherever you placed the `governance-rag/` directory.
3. The command will now be available in every Claude Code project on your machine.

---

## Updating the skill

The skill has three layers that can be changed independently:

| Layer | File | What to change |
|-------|------|----------------|
| Conversation logic | `.claude/commands/design-org.md` | Phases, questions, output rules |
| Mandate knowledge | `governance-rag/prompts/institutionalDesign.md` | New mandates, updated config encodings, condition heuristics |
| Templates | `governance-rag/templates/orgSpec.md`, `governance-rag/templates/deployScript.md` | Output format for generated files |

When a new mandate version ships, update the `MAJOR`/`MINOR`/`PATCH` constants at the top of `deployScript.md` and in the Phase 4 instructions inside `design-org.md`.

---

## Prerequisites for Phase 5 (compilation check)

The `/design-org` skill runs `forge build` after generating code. For this to work, Foundry must be installed:

```bash
forge --version
```

To run the generated fork tests:

```bash
export SEPOLIA_RPC_URL=<your-url>
forge test --match-contract <OrgName>_test -vvv
```
