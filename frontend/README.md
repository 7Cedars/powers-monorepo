# Powers — Frontend

The Next.js 14 dApp for interacting with Powers Protocol organisations. Connect a wallet, deploy an organisation, browse mandates, propose and vote on actions, and manage your governance roles.

- Live demo: [powers-protocol.vercel.app](https://powers-protocol.vercel.app/11155420/0x1c1ebea2840980ec3b45785c4b5672857b0dfdb9)
- [Full monorepo](../README.md)

---

## Quick start

```bash
cd frontend
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

For a full local setup with contracts deployed, start Anvil and deploy contracts first — see the [monorepo README](../README.md#run-locally).

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=        # Privy app ID for wallet connection
NEXT_PUBLIC_ALCHEMY_API_KEY=     # Alchemy API key for RPC + WebSocket
```

---

## App routes

| Route | What it is |
|---|---|
| `/` | Landing page — hero, feature sections, deploy-a-demo flow |
| `/overview/[chainId]/[powers]/home` | DAO dashboard — overview, active mandates, recent actions |
| `/overview/[chainId]/[powers]/mandates/[mandateId]` | Individual mandate — propose and vote on actions |
| `/overview/[chainId]/[powers]/actions` | Full action history |
| `/overview/[chainId]/[powers]/roles` | Role holders across the organisation |
| `/overview/[chainId]/[powers]/treasury` | Treasury balances |
| `/forum/[chainId]` | Governance forum — browse and discuss proposals |

---

## Directory structure

```
frontend/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing page
│   ├── overview/[chainId]/[powers]/  # DAO dashboard and sub-routes
│   └── forum/[chainId]/        # Governance forum
│
├── components/                 # Shared UI components
├── hooks/                      # Data-fetching hooks (see below)
├── context/
│   ├── store.ts                # Zustand state stores
│   ├── constants.ts            # Per-chain config (RPC, token addresses, Safe, Chainlink)
│   ├── types.ts                # Shared TypeScript types
│   ├── builds/                 # Contract ABIs (copied from solidity/out/ via make update-builds)
│   └── wagmiConfig.ts          # Wagmi + Privy chain config
├── public/
│   └── organisations/          # Organisation definition files for the deploy-demo flow
└── utils/                      # Address formatting, calldata parsing, date helpers
```

---

## Key hooks

| Hook | What it fetches |
|---|---|
| `usePowers` | Full DAO state — mandates, roles, metadata |
| `useMandate` | Single mandate data and action list |
| `useLatestActions` | Recent action history for an organisation |
| `useBlocks` | Current block number and block timestamps |
| `useAssets` | Treasury token balances |
| `useChecks` | Pre-flight checks before proposing or executing |

---

## State management

Zustand stores in `context/store.ts`:

| Store | What it holds |
|---|---|
| `usePowersStore` | Active Powers protocol state (mandates, roles, metadata) |
| `useActionStore` | Currently-staged governance action |
| `useSavedProtocolsStore` | Persisted list of visited organisations (localStorage) |
| `useUIStateStore` | UI toggle state |

---

## Supported networks

| Network | Chain ID |
|---|---|
| Ethereum Sepolia | 11155111 |
| Arbitrum Sepolia | 421614 |
| Optimism Sepolia | 11155420 |
| Local Anvil | 31337 |

Chain-specific config (token addresses, Safe addresses, Chainlink subscription IDs) lives in `context/constants.ts`.

---

## Keeping ABIs in sync

After deploying or modifying contracts, run from `solidity/`:

```bash
make update-builds
```

This copies compiled ABIs from `solidity/out/` into `frontend/context/builds/`. The frontend will break with stale ABIs if you skip this step.

---

## Commands

```bash
pnpm dev      # Dev server (localhost:3000)
pnpm build    # Production build
pnpm lint     # ESLint
```
