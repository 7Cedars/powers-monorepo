# AI Governance Agent

An autonomous Claude-powered agent that participates in Powers Protocol governance on behalf of a user. Give it a wallet, a persona, and a strategy — it joins governance group chats, watches on-chain events, and takes actions (propose, vote, execute) without requiring you to be present.

---

## Two ways to run an agent

### Option A — Use a hosted server

If someone is already running the agent server, you only need the Config UI URL they give you. Skip straight to [Starting an agent session](#starting-an-agent-session).

### Option B — Run your own server

Self-hosting gives you full control. Choose between running **locally** (for development or personal use) or deploying to **Railway** (for persistent, always-on operation).

---

## Running your own server

### Locally

**Prerequisites:** Node.js 20+, pnpm, an Anthropic API key, an RPC endpoint (Alchemy or compatible)

```bash
cd ai-agent
pnpm install
cp .env.example .env   # fill in the required env vars (see Environment variables below)
pnpm dev
```

The server starts on port `3002`. Open `http://localhost:3002` to access the Config UI.

### On Railway (persistent, always-on)

1. Create a Railway service from this repo with the root set to `ai-agent/`.
2. Go to **Volumes** → add a volume named `ai-agent-xmtp-db` mounted at `/data`. This persists the XMTP identity database across deploys — without it each deploy creates a new XMTP identity and will eventually hit XMTP's installation limit.
3. Set all env vars in the Railway dashboard (see [Environment variables](#environment-variables) below — never commit secrets).
4. Set `CONFIG_UI_ORIGIN` to your Railway service's HTTPS domain.
5. Deploy with `railway up`.

Verify it's running:
```bash
curl https://<your-railway-domain>/health
# → { "status": "ok", "activeSessions": 0 }
```

Then open `https://<your-railway-domain>` for the Config UI.

For a full step-by-step Railway walkthrough, security checklist, and monitoring guide see [`TESTING_AND_DEPLOYMENT.md`](TESTING_AND_DEPLOYMENT.md).

---

## Starting an agent session

Open the Config UI at your server's URL. Each **session** is one agent instance — it holds a private key in memory (never written to disk), monitors one or more organisations, and runs until the TTL expires or you end it manually.

### Step 1 — Click **+ New Agent**

### Step 2 — Fill in the session form

| Field | What to enter |
|---|---|
| **Wallet private key** | A dedicated agent wallet key with some ETH for gas. Generate one with `node -e "import('viem/accounts').then(m => console.log(m.generatePrivateKey()))"` |
| **Claude API key** | Your Anthropic API key (`sk-ant-...`) |
| **Session duration** | How long the agent should run (default 8 hours) |
| **Organisation** | The Powers contract address + chain you want the agent to join |
| **Agent name** | Any name — used in group chat messages |
| **Strategy** | Plain-text instructions that drive all decisions (see [Persona & strategy](#persona--strategy)) |

### Step 3 — Click **Start Agent**

Copy the Session ID shown in the confirmation box — it's how you manage or end the session later.

The agent will:
- Join the XMTP governance group chats for any mandates it holds a role in
- Begin watching on-chain events in real time
- Run a proactive heartbeat every 15 minutes to check for pending actions

### Managing a running session

From the Config UI you can:
- **Fund the agent**: send ETH from your browser wallet to the agent address
- **Add skills**: give the agent access to external data sources (prices, Snapshot proposals, documents)
- **Update strategy**: change the agent's behaviour mid-session
- **End session**: terminate immediately and zero all key material

Sessions are in-memory only. A server restart destroys all active sessions — you will need to start a new one. The Config UI detects stale session IDs on load and cleans them up automatically.

---

## Persona & strategy

The **strategy** is the primary behavioural prompt. It tells the agent when to vote for or against proposals, when to initiate proposals, and any constraints.

Example:
> "Vote FOR proposals that reduce protocol risk. Vote AGAINST proposals requesting more than 1 ETH unless the recipient is a known contributor. Execute passed proposals as soon as the timelock clears."

One session can monitor multiple Powers organisations simultaneously. The agent can propose, vote, and execute across any org where its wallet holds a role.

---

## Skills

Skills extend the agent with external data. Each skill is a named tool the agent can call before making a governance decision — for example, fetching the current ETH price, reading a Snapshot proposal, or fetching a document from GitHub.

Skills use pre-approved handlers with domain allowlists. No arbitrary outbound HTTP.

See [`src/ai/tools/README.md`](src/ai/tools/README.md) for the full skills reference and configuration examples.

---

## Environment variables

```bash
# XMTP identity (separate from user wallet keys — one per server)
XMTP_WALLET_KEY=
XMTP_DB_ENCRYPTION_KEY=       # 32-byte hex: openssl rand -hex 32 → prepend 0x
XMTP_DB_DIRECTORY=./data
XMTP_ENV=production            # or dev

# RPC endpoints (WebSocket URLs preferred for event watching)
RPC_SEPOLIA=https://...
RPC_ARBITRUM_SEPOLIA=https://...
RPC_OPTIMISM_SEPOLIA=https://...
RPC_BASE_SEPOLIA=https://...

# Server
AGENT_API_SECRET=              # If set, required as Bearer token on all /api/* endpoints
CONFIG_UI_ORIGIN=http://localhost:3002
PORT=3002

# Session defaults (optional)
SESSION_TTL_DEFAULT_MS=28800000
MAX_TOOL_ROUNDS=8
MAX_HISTORY_TURNS=20
```

---

## REST API

The server exposes an API for starting and managing sessions programmatically (useful if you want to integrate with your own UI or scripts).

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
      "strategy": "Vote FOR proposals under 0.5 ETH. Execute passed proposals promptly."
    },
    "skills": [],
    "ttlMs": 28800000
  }'
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

For full request/response schemas see [`AGENT_SPEC.md`](AGENT_SPEC.md).

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

This agent is distinct from [`xmtp-agent/`](../xmtp-agent/), which is the organisation-facing bot that manages group chat access. This agent is user-facing: each session is a personal autonomous delegate.

For the full technical specification — data models, all API schemas, the mandate template registry, security model, and build phases — see [`AGENT_SPEC.md`](AGENT_SPEC.md).
