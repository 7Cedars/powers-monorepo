# Powers v0.7

Institutional governance for on-chain organisations.

Powers lets you build DAOs where every action flows through a single hub contract (`Powers.sol`) and all governance logic lives in swappable external **mandate** contracts. One account, one vote — no token-weighted voting in the core.

- [Litepaper]( ) · [Demo](https://powers-protocol.vercel.app/11155420/0x1c1ebea2840980ec3b45785c4b5672857b0dfdb9) · [Documentation](https://powers-docs.vercel.app/welcome)

---

## What's in this repo

| Package | Tech | Purpose |
|---|---|---|
| [`solidity/`](solidity/) | Foundry | Core protocol + mandate contracts |
| [`frontend/`](frontend/) | Next.js 14, Wagmi/Viem, Privy | dApp interface |
| [`governance-rag/`](governance-rag/) | Claude Code skill, RAG (MCP) | `/design-org` — AI-assisted org design |
| [`ai-agent/`](ai-agent/) | TypeScript, Claude API | Autonomous governance agent |
| [`xmtp-agent/`](xmtp-agent/) | TypeScript, XMTP Agent SDK | Governance group chat management |
| [`documentation/`](documentation/) | Astro + Starlight | Documentation site |

---

## New: AI-powered governance tooling

Two new tools ship alongside the core protocol.

### `/design-org` — design an organisation in a single conversation

A Claude Code slash command that guides any developer (or non-technical governance designer) through specifying an on-chain organisation. One conversation produces a full deployment package:

- A human-readable governance spec (`Spec.md`)
- A Foundry deploy script
- Propose/execute action helpers
- An end-to-end fork test

**Quick start:**

```bash
# 1. Build the RAG index (one-time, ~2–5 min on first run)
cd governance-rag && pnpm install && pnpm ingest

# 2. Restart Claude Code — the MCP server registers automatically

# 3. In any Claude Code session inside this repo, type:
/design-org
```

See [`governance-rag/README.md`](governance-rag/README.md) for the full setup guide and how to port the skill to another project.

---

### AI governance agent — deploy an agent into your organisation

An autonomous Claude-powered agent that lives inside your governance group chats. It watches on-chain events, reads proposals, votes, and executes passed actions. You define its behaviour by giving it **skills** — lightweight tools that let it fetch external data (prices, proposals, off-chain documents) before making decisions.

The agent exposes a REST API so you can start sessions, add skills, and configure organisations programmatically.

See [`ai-agent/README.md`](ai-agent/README.md) for setup and deployment, and [`ai-agent/src/ai/tools/README.md`](ai-agent/src/ai/tools/README.md) for the full skills reference.

---

## Run locally

### Prerequisites

- [Foundry](https://getfoundry.sh) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Node.js 18+ and [pnpm](https://pnpm.io) — `npm install -g pnpm`

### Setup

```bash
git clone https://github.com/publius-projects/powers-monorepo.git
cd powers-monorepo
```

```bash
# Terminal 1 — local chain
anvil

# Terminal 2 — deploy contracts
cd solidity && make initialise-anvil

# Terminal 3 — frontend
cd frontend && pnpm install && pnpm dev
```

Open `http://localhost:3000`, scroll to **Deploy a Demo**, select a demo organisation and the **Anvil** chain.

---

## Core concepts

**Separation of powers** — governance logic is split across roles. One role proposes, another vetos, a third executes. All flows are auditable on-chain.

**Mandates** — the governance modules. Each mandate encodes a single rule (who can propose, vote thresholds, time locks, external conditions). Compose them to build any governance structure.

**One account, one vote** — token-weighted influence can only appear in *how* role holders are selected (e.g. token delegation), never in the vote itself.

See the [documentation](https://powers-docs.vercel.app/welcome) for the full protocol guide and mandate catalogue.

---

## Supported networks

| Network | Chain ID |
|---|---|
| Ethereum Sepolia | 11155111 |
| Arbitrum Sepolia | 421614 |
| Optimism Sepolia | 11155420 |
| Local Anvil | 31337 |

---

## Built with

- Solidity 0.8.30 · Foundry · OpenZeppelin 5
- Next.js 14 · Wagmi / Viem · Privy
- Claude API (Anthropic) · XMTP Agent SDK

---

## Acknowledgements

Invcbull Audit Group · Arnold Almeida · James M · Paulo Fonseca · Andrei V · Arbitrum DAO · RnDAO

---

## License

MIT — see [`LICENSE.txt`](LICENSE.txt).

## Contact

Seven Cedars — [GitHub](https://github.com/7Cedars) — cedars7@proton.me
