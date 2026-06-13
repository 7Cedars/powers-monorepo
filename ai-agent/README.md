# AI Governance Agent

An autonomous Claude-powered agent that participates in Powers Protocol governance on behalf of a user. You give it a wallet, a persona, and a strategy — it joins your governance group chats, reads on-chain state, and takes actions (propose, vote, execute) without requiring you to be present.

The agent is distinct from [`xmtp-agent/`](../xmtp-agent/), which is the organisation-facing bot that manages group chat access. This agent is user-facing: each session is a personal autonomous delegate.

---

## What it does

- Joins role-gated XMTP governance group chats autonomously
- Watches on-chain events via WebSocket (proposals created, proposals passed) and reacts in real time
- Runs a proactive heartbeat every 15 minutes: reviews all organisations and initiates actions without needing a human trigger — useful for AI-only mandates where nobody else will propose
- Proposes actions, casts votes with on-chain reasoning, and executes passed proposals
- Responds to natural language in governance group chats
- Follows a user-configured persona and strategy that shapes all its decisions
- Supports user-defined **skills** — lightweight tools that let it fetch external data (prices, off-chain documents, Snapshot proposals) before making decisions

See [`src/ai/tools/README.md`](src/ai/tools/README.md) for the full skills reference.

---

## Quick start (local)

**Prerequisites:** Node.js 18+, pnpm, an Anthropic API key, an RPC endpoint (Alchemy or compatible)

```bash
cd ai-agent
pnpm install
cp .env.example .env   # fill in the required env vars
pnpm dev
```

The agent starts an Express server (default port `3002`) and serves a config UI at `http://localhost:3002`.

---

## Config UI

Open `http://localhost:3002` to manage agents from a browser. You can:

- Start a new agent session (wallet key + Claude API key + persona + strategy)
- Fund an agent's wallet (sends ETH from your browser wallet to the agent address)
- Add skills to a running session
- Update an agent's strategy mid-session
- End a session

Keys are never stored in the browser — only a session ID (UUID) is persisted in `localStorage`.

---

## Core concepts

### Session

A session is one agent instance. It holds a private key (in memory only, never written to disk), a Claude API key, one or more organisations to monitor, a persona, and any skills. Sessions expire after a user-configured TTL (default 8 hours) and can be manually terminated. All key material is zeroed on expiry.

### Persona

Defines the agent's name, role description, and governance strategy in plain text. The strategy is the primary behavioural prompt — it tells the agent when to vote for or against proposals, when to initiate proposals, and any constraints.

Example strategy:
> "Vote FOR proposals that reduce protocol risk. Vote AGAINST proposals requesting more than 1 ETH unless the recipient is a known contributor. Execute passed proposals as soon as the timelock clears."

### Organisations

One session can monitor multiple Powers organisations simultaneously. The agent watches all of them via WebSocket and can propose, vote, and execute across any org where it holds a role.

### Skills

Skills extend the agent with external data sources. Each skill is a named tool the agent can call before making a governance decision — for example, fetching the current ETH price, reading a Snapshot proposal, or fetching a document from GitHub.

Skills use pre-approved handlers with domain allowlists. No arbitrary outbound HTTP. See [`src/ai/tools/README.md`](src/ai/tools/README.md) for the full list of handlers and configuration examples.

---

## API

The agent exposes a REST API for starting and managing sessions programmatically.

### Start a session

```bash
curl -X POST http://localhost:3002/api/session/start \
  -H 'Content-Type: application/json' \
  -d '{
    "walletKey": "0x...",
    "claudeApiKey": "sk-ant-...",
    "organisations": [
      { "powersAddress": "0x...", "chainId": 11155111, "label": "My DAO" }
    ],
    "persona": {
      "name": "Prudent Delegate",
      "roleDescription": "Treasury steward for My DAO",
      "strategy": "Vote FOR proposals under 0.5 ETH that have broad member support. Execute passed proposals promptly."
    },
    "skills": [],
    "ttlMs": 28800000
  }'
```

**Response:**
```json
{
  "sessionId": "uuid",
  "agentAddress": "0x...",
  "organisations": [...],
  "expiresAt": "2026-06-13T08:00:00Z"
}
```

### Other endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/sessions` | List all active sessions |
| `DELETE` | `/api/session/:id` | End a session immediately |
| `PATCH` | `/api/session/:id/persona` | Update persona mid-session |
| `POST` | `/api/session/:id/skills` | Add a skill to a running session |
| `POST` | `/api/session/:id/organisations` | Add an organisation to a running session |
| `POST` | `/api/session/:id/fund` | Get agent address + balance for the funding UI |
| `GET` | `/health` | Health check |

If `AGENT_API_SECRET` is set in env, all `/api/*` endpoints require `Authorization: Bearer <secret>`.

For full request/response schemas see [`AGENT_SPEC.md`](AGENT_SPEC.md).

---

## Environment variables

```bash
# XMTP identity (separate from user wallet keys)
XMTP_WALLET_KEY=
XMTP_DB_ENCRYPTION_KEY=       # 32-byte hex
XMTP_DB_DIRECTORY=./data
XMTP_ENV=production            # or dev

# RPC endpoints
RPC_SEPOLIA=https://...
RPC_ARBITRUM_SEPOLIA=https://...
RPC_OPTIMISM_SEPOLIA=https://...
RPC_BASE_SEPOLIA=https://...

# API
AGENT_API_SECRET=              # Optional — if set, required on all /api/* endpoints
CONFIG_UI_ORIGIN=http://localhost:3002
PORT=3002

# Session defaults (optional — these are the defaults)
SESSION_TTL_DEFAULT_MS=28800000
MAX_TOOL_ROUNDS=8
MAX_HISTORY_TURNS=20
```

---

## Deploy to Railway

The agent is designed to run as a persistent Railway service.

**One-time setup:**

1. Create a Railway service from this repo, pointing the root to `ai-agent/`.
2. Go to **Volumes** → add a volume named `ai-agent-xmtp-db` mounted at `/data`. This persists the XMTP identity database across deploys — without it, each deploy creates a new XMTP installation and eventually hits XMTP's installation limit.
3. Set all env vars in the Railway dashboard (never commit secrets).
4. Set `CONFIG_UI_ORIGIN` to your Railway service's HTTPS domain.

The `railway.toml` at the root of this package handles the rest.

**After deploy:** sessions are in-memory only. A container restart (deploy, crash, scaling) destroys all active sessions — users must restart their agents. The config UI handles this gracefully by cleaning up stale session IDs from `localStorage` on page load.

---

## Architecture overview

```
Config UI (browser)
    │
    ▼
REST API (Express)
    │
    ▼
Session Manager ── one AgentSession per user
    │
    ├── WebSocket watchers (per org) ── on-chain events → trigger reasoning
    ├── Heartbeat loop (15 min, per org) ── proactive trigger
    └── XMTP group stream ── inbound messages → trigger reasoning
              │
              ▼
        AI Reasoning (Claude API, tool-use loop)
              │
              ├── Governance tools: get_state · propose · vote · execute · send_message
              └── Skills: user-defined, pre-approved handlers, domain allowlisted
                        │
                        ▼
                Powers Protocol (on-chain, via viem)
```

For the full technical specification including data models, all API schemas, the mandate template registry, security model, and build phases, see [`AGENT_SPEC.md`](AGENT_SPEC.md).
