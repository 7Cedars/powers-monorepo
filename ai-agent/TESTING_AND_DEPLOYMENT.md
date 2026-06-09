# AI Agent — Testing & Deployment Guide

## Prerequisites

- Node.js 20+, pnpm 10+
- Foundry (`forge`, `anvil`) installed
- A Claude API key (Anthropic Console)
- An Alchemy (or compatible) API key for testnet RPC endpoints
- A funded testnet wallet for the agent (Sepolia or Arbitrum Sepolia)
- Railway CLI (`npm i -g @railway/cli`) for deployment

---

## 1. Local Development Setup

### 1.1 Install dependencies

```bash
cd ai-agent
pnpm install
```

### 1.2 Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | What to set |
|---|---|
| `XMTP_WALLET_KEY` | A dedicated agent wallet key (generate a fresh one — not your dev wallet) |
| `XMTP_DB_ENCRYPTION_KEY` | 32-byte hex: `openssl rand -hex 32` → prepend `0x` |
| `XMTP_DB_DIRECTORY` | `./data` (auto-created) |
| `XMTP_ENV` | `dev` for local testing |
| `RPC_SEPOLIA` | Your Alchemy Sepolia WebSocket or HTTP URL |
| `AGENT_API_SECRET` | Leave blank for local dev; set a strong secret for production |
| `CONFIG_UI_ORIGIN` | `http://localhost:3002` for local dev |

### 1.3 Generate a fresh agent wallet key

```bash
node -e "import('viem/accounts').then(m => console.log(m.generatePrivateKey()))"
```

---

## 2. Local Integration Test (Anvil)

This is the recommended first test — everything runs locally, no real funds.

### 2.1 Start Anvil and deploy contracts

```bash
# Terminal 1
anvil

# Terminal 2
cd solidity
make fork-anvil
```

Take note of the deployed `Powers` contract address printed by `make initialise-anvil`.

### 2.2 Start the agent in dev mode

```bash
# Terminal 3
cd ai-agent
pnpm dev
```

Expected output:
```
[server] Listening on port 3002
[server] Config UI at http://localhost:3002
```

### 2.3 Start a session via the Config UI

1. Open `http://localhost:3002` in a browser.
2. Click **+ New Agent**.
3. Fill in:
   - **Wallet Private Key**: use one of the pre-funded Anvil keys (printed by `anvil` on startup, e.g. `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`)
   - **Claude API Key**: your real Anthropic key
   - **Session Duration**: 30 minutes (for testing)
   - **Organisation**: paste the `Powers` address from step 2.1, select `Anvil (local)` chain
   - **Agent Name** + **Strategy**: anything descriptive
4. Click **Start Agent** — copy the Session ID shown in the success box.

### 2.4 Verify XMTP group join

The agent automatically discovers XMTP groups for the mandates its wallet has roles in. To manually verify:

```bash
curl http://localhost:3002/api/sessions | jq '.[0].organisations'
```

### 2.5 Trigger on-chain events and watch the agent respond

From the `solidity/` directory, use Foundry's `cast` to simulate governance events:

```bash
# Propose an action on mandate 1
cast send <POWERS_ADDRESS> "propose(uint256,bytes,uint256,string)" \
  1 0x 12345 "test proposal" \
  --private-key <ANVIL_KEY_2> \
  --rpc-url http://localhost:8545

# Watch the agent log — it should detect ProposedActionCreated and consider voting
```

### 2.6 Test the heartbeat

The heartbeat fires every 15 minutes. To force an immediate trigger without waiting, temporarily reduce the interval in `src/events/heartbeat.ts` (change `15 * 60 * 1000` to `10 * 1000`), restart with `pnpm dev`, and watch for `[heartbeat]` log lines.

### 2.7 Test Config UI flows

While the session is running:

- **Fund Agent**: Connect MetaMask to Anvil (chainId 31337), open Manage → Fund Agent, send 0.01 ETH.
- **Add Skill**: Add a `coingecko_price` skill with `api.coingecko.com` as allowed domain.
- **End Session**: Confirm the session disappears from the list and the key is zeroed (check logs for `[session] zeroed keys`).

---

## 3. Testnet Smoke Test (Sepolia)

Before deploying to Railway, run a short live test against Sepolia.

### 3.1 Fund the agent wallet

Send at least **0.05 ETH Sepolia** to the agent wallet address (`XMTP_WALLET_KEY` account).

### 3.2 Set `XMTP_ENV=dev` for testnet

The XMTP `dev` environment works against Sepolia. Keep this as `dev` until you're ready for production.

### 3.3 Point to a live Powers deployment

Update your `.env` to point `RPC_SEPOLIA` at your Alchemy endpoint and use a real deployed `Powers` address from `frontend/context/constants.ts`.

### 3.4 Run the smoke test

```bash
pnpm dev
```

1. Open the Config UI, start a session with the Sepolia Powers address.
2. From a separate wallet, propose a governance action through the frontend at `localhost:3000`.
3. Confirm the agent logs show it detected `ProposedActionCreated` and (if configured to) cast a vote.

---

## 4. Production Build

```bash
cd ai-agent
pnpm build          # tsc → dist/
node dist/index.js  # verify it starts
```

If `pnpm build` fails, run `pnpm type-check` first to identify errors before the emit step.

---

## 5. Railway Deployment

### 5.1 Create the Railway project

```bash
railway login
railway init        # create a new project, or link to an existing one
railway link        # if linking to an existing project
```

### 5.2 Set environment variables

Set all variables from `.env.example` in Railway's dashboard or via CLI:

```bash
railway variables set XMTP_WALLET_KEY=0x...
railway variables set XMTP_DB_ENCRYPTION_KEY=0x...
railway variables set XMTP_ENV=production
railway variables set RPC_SEPOLIA=https://eth-sepolia.g.alchemy.com/v2/...
railway variables set RPC_ARBITRUM_SEPOLIA=https://arb-sepolia.g.alchemy.com/v2/...
railway variables set AGENT_API_SECRET=<strong-random-secret>
railway variables set CONFIG_UI_ORIGIN=https://<your-railway-domain>
```

Important:
- `XMTP_DB_DIRECTORY` is set to `/data` in `railway.toml` — leave it.
- `NODE_ENV=production` and `XMTP_ENV=production` are also set in `railway.toml` — no need to set them manually.

### 5.3 Add a persistent volume

The agent's XMTP SQLite DB must survive redeploys. In the Railway dashboard:

1. Go to your service → **Volumes** → **Add Volume**.
2. Mount path: `/data`
3. Name: `ai-agent-xmtp-db`

This is already configured in `railway.toml` but Railway may require manual confirmation in the UI the first time.

### 5.4 Deploy

```bash
# From the ai-agent/ directory (or monorepo root with --service flag)
railway up
```

Railway will detect `railway.toml`, build with Railpack, run `pnpm start` (`node dist/index.js`).

### 5.5 Verify deployment

```bash
curl https://<your-railway-domain>/health
# → { "status": "ok", "activeSessions": 0 }
```

Open `https://<your-railway-domain>` to access the Config UI over HTTPS (no warning banner).

---

## 6. Security Checklist Before Going Live

- [ ] `AGENT_API_SECRET` is set — all `/api/*` routes require `Authorization: Bearer <secret>`
- [ ] `CONFIG_UI_ORIGIN` matches the deployed URL exactly (used for CORS)
- [ ] `XMTP_WALLET_KEY` is a dedicated key, not reused anywhere else
- [ ] `XMTP_DB_ENCRYPTION_KEY` is a fresh 32-byte random value
- [ ] Railway volume is mounted at `/data` — confirm with `railway run ls /data`
- [ ] The agent wallet has enough ETH on each active chain for gas (~0.05 ETH per chain)
- [ ] RPC endpoints are WebSocket-capable for on-chain event watchers (`wss://` URLs preferred)
- [ ] `XMTP_ENV=production` — `dev` and `production` XMTP networks are isolated

---

## 7. Monitoring

Railway provides logs in the dashboard. Key log prefixes to watch:

| Prefix | Meaning |
|---|---|
| `[server]` | API server events |
| `[session]` | Session create/destroy/key-zero |
| `[xmtp]` | Group join/stream events |
| `[watcher]` | On-chain event detections |
| `[heartbeat]` | 15-min scheduled reasoning |
| `[tool]` | Governance write actions (propose/vote/execute) |
| `[reason]` | Claude reasoning loop rounds |

To tail logs live:

```bash
railway logs --tail
```
