# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Powers v0.4 is a modular, role-based governance protocol for on-chain organizations. The core idea: all DAO actions flow through `Powers.sol`, with governance logic living in external **mandate** contracts. One-account-one-vote; no weighted voting in the core.

## Monorepo Structure

| Directory | Tech | Purpose |
|---|---|---|
| `solidity/` | Foundry | Core protocol + mandate contracts |
| `frontend/` | Next.js 14, Wagmi/Viem, Privy | dApp interface |
| `xmtp-agent/` | TypeScript, XMTP Agent SDK | Governance messaging agent |
| `documentation/` | Astro + Starlight | Documentation site |

All sub-packages use **pnpm**. The solidity workspace uses **Foundry**.

## Commands

### Solidity (`cd solidity/`)
```bash
forge build                          # Compile
forge test                           # Run all tests
forge test --match-test <name> -vvv  # Run a single test
forge test --match-contract <name> -vvv  # Run all tests in a contract
forge test --gas-report              # With gas report
make update-builds                   # Copy compiled ABIs to frontend/context/builds/ and xmtp-agent/src/powers/
make initialise-anvil                # Deploy all contracts to local Anvil
```

### Frontend (`cd frontend/`)
```bash
pnpm dev        # Start dev server (localhost:3000)
pnpm build      # Production build
pnpm lint       # ESLint
pnpm test:e2e   # Playwright e2e tests
```
Requires Node 20 or 22 (LTS) — see `frontend/.nvmrc`. Node 23 breaks Playwright's TS loader (`context.conditions` is a `Set` instead of an `Array` on that version).

**Never run the e2e test suite (`pnpm test:e2e` or any Playwright invocation) yourself — the user runs these manually.**

### xmtp-agent (`cd xmtp-agent/`)
```bash
pnpm dev        # tsx watch (hot reload)
pnpm build      # tsc compile to dist/
pnpm type-check # Type check without emit
```

### Documentation (`cd documentation/`)
```bash
pnpm dev        # Astro dev server
pnpm build      # Build static site
```

## Core Architecture

### Solidity Protocol

**`src/Powers.sol`** — The central hub. All governance actions (propose → vote → execute) flow through here. Not meant to be modified; all customization goes into mandates.

**`src/Mandate.sol`** — Abstract base for synchronous mandates. Implements `IMandate`. Override `handleRequest()` to encode custom governance logic.

**`src/AsyncMandate.sol`** — Base for mandates that require asynchronous checks (e.g., waiting on external oracle data).

**Mandate categories** under `src/mandates/`:
- `electoral/` — Role assignment logic (self-select, peer-select, nomination, token delegation, etc.)
- `executive/` — Execute external calls (simple preset, flexible, return-value-conditional, bespoke, open actions)
- `integrations/` — Protocol integrations (Chainlink, Safe, Governor, ZKPassport, ERC721, Snapshot, etc.)
- `reform/` — Governance self-modification (adopt/revoke/pause mandates, mandate packages)

**Libraries** under `src/libraries/`:
- `Checks.sol` — Precondition validation used in Powers.sol
- `MandateUtilities.sol` — Utilities for mandate encoding/decoding
- `PowersUtilities.sol` — Utilities for Powers.sol internals

**Helper contracts** under `src/helpers/`:
- `PowersFactory.sol` / `PowersDeployer.sol` — Deploy new Powers instances
- `PowersPaymaster.sol` — ERC-4337 paymaster
- `MandateRegistry.sol` — Registry of available mandates
- `ElectionRegistry.sol`, `SlateRegistry.sol`, `Nominees.sol` — Electoral support contracts
- `Governed721.sol` — NFT-governed DAO helper
- `ZKPassport_PowersRegistry.sol` — ZKPassport identity integration

**`test/TestConstitutions.sol`** — Reference implementations of example governance structures; read this to understand how mandates compose.

**`test/TestSetup.t.sol`** — Base test setup; inherit from this in new test files.

Foundry config: Solidity 0.8.30, optimizer 600 runs, `cancun` EVM, `create2` always enabled.

### Frontend

**App Router** routes under `frontend/app/`:
- `/` — Landing page with deploy demo
- `/overview/[chainId]/[powers]/` — Main DAO dashboard with sub-routes: `home`, `mandates/[mandateId]`, `actions`, `roles`, `treasury`
- `/forum/[chainId]/` — Governance forum

**State management** (`context/store.ts`) — Zustand stores:
- `usePowersStore` — Active Powers protocol state (mandates, roles, metadata)
- `useActionStore` — Currently-staged governance action
- `useSavedProtocolsStore` — Persisted protocol list (localStorage)
- `useUIStateStore` — UI toggle state

**Chain configuration** (`context/constants.ts`) — Per-chainId constants (token addresses, Safe addresses, Chainlink config). Supports Sepolia (11155111), Arb Sepolia (421614), Opt Sepolia (11155420), Anvil (31337).

**Contract ABIs** (`context/builds/`) — JSON files copied from `solidity/out/` via `make update-builds`. When deploying new contracts, run this command to keep frontend in sync.

**Key hooks** (`hooks/`): `usePowers.ts` (fetch DAO state), `useMandate.ts` (mandate data), `useLatestActions.ts` (action history), `useBlocks.ts`, `useAssets.ts`, `useXmtpClient.ts`.

### XMTP Agent

TypeScript agent (`xmtp-agent/src/`) built on `@xmtp/agent-sdk`. Deployed on Railway. Provides a messaging interface for Powers governance: users can interact with DAOs via XMTP messages. Has an Express API server alongside the agent.

## Key Development Workflows

### Creating a new mandate
1. Inherit from `Mandate.sol` (or `AsyncMandate.sol` for async) in the appropriate category directory.
2. Override `handleRequest()` to encode governance logic.
3. Add unit tests in `test/unit/mandates/`.
4. Use existing mandates in the same category as templates.

### Post-contract deployment
After deploying contracts to any network:
1. Run `make update-builds` from `solidity/` to copy ABIs.
2. Update `frontend/context/constants.ts` with new addresses if needed.
3. Update organisation metadata JSON files under `frontend/organisations/` if relevant.

### Local development setup
```bash
anvil                          # Terminal 1: start local chain
cd solidity && make initialise-anvil   # Terminal 2: deploy contracts
cd frontend && pnpm dev        # Terminal 3: start frontend
```

## Supported Networks

- Ethereum Sepolia (11155111)
- Arbitrum Sepolia (421614)  
- Optimism Sepolia (11155420)
- Local Anvil (31337)
