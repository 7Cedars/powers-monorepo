# Implementation Plan: Gasless Transactions for Classic EOAs via EIP-7702

**Status:** Not started — planning document only
**Author context:** Written after a research pass over the current codebase (2026-07). Verify all facts marked "confirmed in repo" still hold before implementing, since the code will have moved on.
**Goal:** Let a plain externally-owned account (EOA) with zero ETH transact against Powers without the user ever needing to hold gas — today this only works for Privy Smart Wallet (ERC-4337) users.

---

## 1. Why this is needed (recap of the problem)

- `PowersPaymaster.sol` (`solidity/src/helpers/PowersPaymaster.sol`) is an ERC-4337 `BasePaymaster`. It only sponsors gas inside the `EntryPoint.handleOps` / `UserOperation` flow.
- ERC-4337 requires the `sender` of a `UserOperation` to be a **smart contract account** (deployed, or deployable via `initCode`/factory). A plain EOA cannot be the sender of a `UserOperation` — this is a protocol-level constraint, not a config gap.
- Confirmed in repo: `frontend/hooks/useMandate.ts` branches on `isSmartWallet` (derived in `useEffectiveAddress.ts` and `useMandate.ts:26-34`). Smart-wallet users get routed through `sendSmartWalletTx` (paymaster-sponsored `UserOperation`s via a ZeroDev bundler). Everyone else falls through to plain `writeContract`/`simulateContract` (`useMandate.ts:206-215`, `246-255`, etc.), which requires the connected EOA to pay its own gas. There is no gasless branch for EOAs today.
- Confirmed in repo: `Powers.sol` has no ERC-2771 (`_msgSender()` override) or signature-based "execute on behalf of" mechanism — so a classic relayer/meta-tx approach would require protocol-level Solidity changes, plus a new relayer service to operate and fund.

## 2. Chosen approach: EIP-7702

EIP-7702 (live since the Pectra upgrade, ~May 2025) lets an EOA sign an "authorization" that temporarily sets its on-chain `code` to point at a smart contract implementation. For the duration of that delegation, the EOA:

- Keeps its existing address (no new account, no migration, no funds to move).
- Can be the target of an ERC-4337 `UserOperation` (it now looks like a smart account to the `EntryPoint`).
- Can use the *existing* `PowersPaymaster` contract for sponsorship, if the delegated implementation is a Kernel version that uses the same `EntryPoint` version the paymaster already targets.

This is why it's the recommended path over building a custom relayer/ERC-2771 system: it reuses almost all of the existing ERC-4337 + ZeroDev + `PowersPaymaster` infrastructure that smart-wallet users already benefit from, rather than building a second, parallel gas-sponsorship system.

### Compatibility check (already verified — good news)

| Requirement | Status |
|---|---|
| Chain support (Sepolia, Arbitrum Sepolia, Optimism Sepolia — the project's testnets from `frontend/context/constants.ts`) | ✅ All three support EIP-7702 post-Pectra. |
| Local Anvil (chainId 31337) | ⚠️ Needs Anvil started with a Prague/Pectra-enabled hardfork (recent Foundry versions support this via a `--hardfork prague` style flag — confirm exact flag name against the Foundry version pinned in this repo before relying on it). |
| `PowersPaymaster.sol`'s `EntryPoint` version | Confirmed: `solidity/lib/account-abstraction` is pinned at tag `v0.7.0` (EntryPoint v0.7). |
| ZeroDev Kernel version needed for 7702 | **Kernel v3.3** (`KERNEL_V3_3` constant in `@zerodev/sdk/constants`) — confirmed via ZeroDev docs to target **EntryPoint v0.7**, matching what `PowersPaymaster` already uses. **No Solidity changes to `PowersPaymaster.sol` should be needed.** |
| Existing selector support in `PowersPaymaster._validatePaymasterUserOp` | Confirmed: it already has a branch for `EXECUTE_SELECTOR_KERNEL` (`execute(bytes32,bytes)` — Kernel v3 / ERC-7579 calldata layout), `PowersPaymaster.sol:18-19,90-101`. A 7702-delegated Kernel v3.3 account uses this same execute format, so the paymaster's target-allowlist check should work unmodified. **This must still be verified with a live test (§6) before assuming it's free** — 7702 execution paths sometimes wrap calldata slightly differently (e.g. via `initcode`-less validation), so don't skip the integration test. |
| Project's existing dependencies | `@zerodev/sdk: ^5.4.0`, `permissionless: ^0.3.5`, `viem: ^2.47.1` (`frontend/package.json`) — likely need a minor bump to get 7702-aware helpers (`createKernelAccount` with `eip7702Account`), but probably not a major version jump. Check `@zerodev/sdk` changelog for the version that introduced `KERNEL_V3_3` + 7702 support. |

### Important limitation to flag to users/product before building

Privy's `useSignAuthorization()` hook (the piece that signs the EIP-7702 authorization) is documented against **Privy embedded wallets**. Confirmed in repo: `frontend/context/Providers.tsx:42-46` currently sets `embeddedWallets.ethereum.createOnLogin: 'users-without-wallets'` — meaning a user who connects an external wallet (MetaMask, Rainbow, WalletConnect — see `walletList` at `Providers.tsx:40`) does **not** get a Privy-managed embedded EOA, and thus has no simple path to sign a 7702 authorization through Privy's hook. External-wallet 7702 signing is possible in principle (some wallets like recent MetaMask versions support `wallet_sendTransaction` with type-4/authorization lists), but it is inconsistent across wallets and not covered by Privy's documented flow.

**Practical implication:** this plan, as scoped, delivers gasless EOAs for **Privy-managed embedded wallets** cleanly. Extending it to arbitrary externally-connected EOAs is a separate, higher-risk follow-up (depends on each wallet's own 7702 support) — scope it out explicitly as "not in v1" unless product wants to invest in wallet-by-wallet detection/fallback.

---

## 3. Target architecture (after this change)

```
User has:
  (a) Privy Smart Wallet (existing)      → sendSmartWalletTx()          [unchanged]
  (b) Privy embedded EOA, no smart wallet → NEW: send7702Tx()            [this plan]
  (c) External EOA (MetaMask etc.)        → plain writeContract()        [unchanged, still needs gas]
```

`useEffectiveAddress.ts` and `useMandate.ts` gain a third branch. The "effective address" for a 7702-delegated EOA is unchanged — it's still the EOA's own address (unlike smart wallets, where `msg.sender` becomes the smart-contract wallet's address). This is actually simpler than the smart-wallet case for role-check purposes.

---

## 4. Step-by-step implementation

### Step 4.1 — Dependency bump

```bash
cd frontend
pnpm add @zerodev/sdk@latest permissionless@latest viem@latest
```
Check the `@zerodev/sdk` changelog (https://github.com/zerodevapp/sdk / npm page) for the first version exposing `KERNEL_V3_3` from `@zerodev/sdk/constants` and `eip7702Account` support in `createKernelAccount`. Re-run `pnpm test:e2e` compatibility checks manually (per this repo's rule, the user runs e2e themselves) after the bump — viem major bumps have previously broken things here (see `.nvmrc`/Node version notes in root `CLAUDE.md`).

### Step 4.2 — Privy config (`frontend/context/Providers.tsx`)

Currently (`Providers.tsx:42-46`):
```ts
embeddedWallets: {
  ethereum: {
    createOnLogin: 'users-without-wallets',
  },
},
```
No changes strictly required here — `users-without-wallets` already creates embedded EOAs for users who don't bring their own wallet, which is the population this plan targets. (Privy's own 7702 recipe suggests `createOnLogin: 'all-users'`, but that's a broader product decision — forcing an embedded wallet even for users who bring MetaMask — and is **not required** for this plan. Don't change this without a separate product decision.)

Add the `useSignAuthorization` import where needed (it's exported from `@privy-io/react-auth` directly, no provider change needed — confirm on `@privy-io/react-auth@^3.16.0`, the version pinned in `package.json`, since the hook's availability/name could differ across major versions).

### Step 4.3 — New hook or extension: `use7702SmartWallet.ts`

Recommend a **new file** `frontend/hooks/use7702SmartWallet.ts` (parallel to how `useMandate.ts` currently owns `sendSmartWalletTx`) rather than overloading `useMandate.ts` further — that file is already dense with three near-duplicate action functions per call type.

Responsibilities:
1. Detect eligibility: user has a Privy embedded wallet (`wallets.find(w => w.walletClientType === 'privy')`) and does **not** already have a smart wallet (`hasSmartWalletAccount` from `useMandate.ts:26` — reuse/export that check).
2. Lazily create (and cache, e.g. in a `useRef`) a `KernelAccount` per target chain, mirroring the existing per-chain bundler client pattern already in `sendSmartWalletTx` (`useMandate.ts:81-147`) — the DAO's chain can differ from Privy's `defaultChain` (Sepolia), and the existing code already has hard-won fixes for that mismatch (AA10/AA24/AA25 issues, see comments at `useMandate.ts:103-124`, `153-160`). Any new 7702 path needs the same chain-targeting care, since those bugs are inherent to using Privy defaults + non-default target chains, not specific to the Kernel version.
3. Sign the 7702 authorization once per (EOA, chain, Kernel-implementation-address) tuple, not per-transaction — authorizations can typically be reused/replayed within the same delegation, and the `EntryPoint` nonce still advances normally after the first delegating transaction. Confirm exact replay/no-replay semantics against ZeroDev's 7702 docs/examples before assuming this (see §7 open question).
4. Build and send the sponsored `UserOperation`, then wait for the receipt exactly like `sendSmartWalletTx` does today (`useMandate.ts:171-181`).

Skeleton (fill in exact ZeroDev API surface against whatever SDK version lands in step 4.1 — API names below are current as of this research, but verify against `node_modules/@zerodev/sdk` after the bump):

```ts
import { useSignAuthorization, useWallets } from "@privy-io/react-auth";
import { createKernelAccount, createKernelAccountClient } from "@zerodev/sdk";
import { KERNEL_V3_3 } from "@zerodev/sdk/constants";
import { createPublicClient, http, createWalletClient, custom } from "viem";
import { createBundlerClient } from "viem/account-abstraction";

// Pseudocode — not final. Verify signatures against installed @zerodev/sdk version.
async function build7702KernelAccount(chain, publicClient, embeddedWallet, signAuthorization) {
  const provider = await embeddedWallet.getEthereumProvider();
  const walletClient = createWalletClient({
    account: embeddedWallet.address as `0x${string}`,
    chain,
    transport: custom(provider),
  });

  // Kernel v3.3's canonical implementation address for 7702 — get this from
  // ZeroDev's docs/constants for the target chain, do NOT hardcode a guess.
  const authorization = await signAuthorization({
    contractAddress: KERNEL_V3_3_IMPLEMENTATION_ADDRESS,
    chainId: chain.id,
  });

  const account = await createKernelAccount(publicClient, {
    eip7702Account: walletClient,
    entryPoint: { address: ENTRYPOINT_V07_ADDRESS, version: "0.7" },
    kernelVersion: KERNEL_V3_3,
  });

  return { account, authorization };
}
```

Then send via a `bundlerClient` following the same paymaster-wiring pattern already present in `useMandate.ts:128-147` (the `hasPaymaster` check against `powers.paymaster`), passing `authorization` through on the first `UserOperation` per delegation (exact param name — `authorization` vs `factory: '0x7702'` — varies between permissionless.js and ZeroDev SDK call styles; confirm against installed version).

### Step 4.4 — Wire into `useMandate.ts` and `useEffectiveAddress.ts`

- `useEffectiveAddress.ts`: add a branch — if the user is 7702-eligible/delegated, the effective address is still `wallets[0].address` (the EOA itself), so this file may need **no logic change**, just confirm the existing fallback (`walletsReady && wallets[0] ...`, line 26) already returns the right value. Good — likely zero changes needed here.
- `useMandate.ts`: extend the `isSmartWalletRef.current && clientRef.current` checks (lines 196, 236, 275, 316, 426) to a three-way branch: smart-wallet path (unchanged) → new 7702 path (new) → plain EOA path (unchanged, still gas-paying, for external wallets). Keep the existing refs pattern (`clientRef`, `isSmartWalletRef`) for the new eligibility flag to avoid stale-closure bugs the current code already works around (see the comment at `useMandate.ts:29-30`).

### Step 4.5 — Solidity side

No changes expected to `PowersPaymaster.sol` (see compatibility table, §2) or to `Powers.sol`. **Do not skip verifying this assumption** — add a Foundry test (or extend `test/unit/helpers/PowersPaymaster.t.sol`) that constructs a `PackedUserOperation` with calldata shaped exactly like what a 7702-delegated Kernel v3.3 account produces, and confirms `_validatePaymasterUserOp` accepts it via the existing `EXECUTE_SELECTOR_KERNEL` branch (`PowersPaymaster.sol:90-101`). If Kernel v3.3's 7702 mode produces different calldata framing than non-7702 Kernel v3, this is where it would surface, and it's cheap to test in isolation before touching the frontend.

### Step 4.6 — Env vars / config

- Confirm whether the existing `NEXT_PUBLIC_ZERODEV_BUNDLER_URL` (used in `useMandate.ts:94`) can serve 7702 UserOperations as-is, or whether ZeroDev requires a distinct project/RPC URL for 7702-enabled bundling (their quickstart docs reference enabling "Gas Policies" in the ZeroDev dashboard per-project — check whether this is a toggle on the existing project or requires a new one).
- No new addresses need to go into `frontend/context/constants.ts` — `PowersPaymaster` addresses are already read per-org from the deployed `Powers` contract (`powers.paymaster`, `frontend/hooks/usePowers.ts:65,76`), not hardcoded per chain.

---

## 5. UI/UX considerations

- Need a way to detect and surface "this account is running gasless via 7702" vs "smart wallet" vs "you need ETH for gas" in the UI, likely near wherever `isSmartWallet` currently drives copy/behavior — grep for `isSmartWallet` usage in `frontend/components/` and `frontend/app/` (not audited in this research pass; do that scan as the first implementation step).
- First-time delegation (the actual 7702 authorization signature + the first transaction that lands the delegation on-chain) may have a different latency/confirmation profile than a "steady-state" already-delegated tx — worth a distinct loading-state message the first time, and worth handling the case where authorization signing is rejected/fails gracefully (fall back to the plain EOA gas-paying path, don't dead-end the user).

---

## 6. Testing plan

1. **Foundry (solidity/):** extend `test/unit/helpers/PowersPaymaster.t.sol` with a case simulating Kernel v3.3 7702-shaped calldata (§4.5). Run via `forge test --match-contract PowersPaymasterTest -vvv`.
2. **Manual/local integration:** stand up Anvil with Pectra hardfork enabled, deploy via `make initialise-anvil`, and manually exercise the new `use7702SmartWallet` hook against a local `Powers` instance with a `PowersPaymaster` registered, before touching testnets.
3. **Testnet dry run:** pick one testnet (suggest Arbitrum Sepolia, given `PowersPaymaster` and org addresses already exist there per `frontend/context/constants.ts:52-72`) and validate an actual sponsored 7702 transaction end-to-end with a fresh, zero-ETH Privy embedded wallet.
4. **E2E (Playwright):** per this repo's standing rule, do **not** run `pnpm test:e2e` yourself — write/update the relevant spec under `frontend/e2e/` and have the user run it manually.

---

## 7. Open questions to resolve before/during implementation

- **Exact ZeroDev API surface** for `createKernelAccount`'s 7702 mode — verify against the actual installed SDK version post-bump; the ZeroDev docs move fast and the pseudocode in §4.3 is illustrative, not copy-paste-ready.
- **Authorization replay semantics** — does the signed 7702 authorization need to be attached to every `UserOperation`, or only the first one that lands the delegation on-chain? This affects whether `use7702SmartWallet` needs to track "have we delegated on this chain yet" state (e.g. by checking `getCode` on the EOA, similar to the existing `isDeployedOnTargetChain` check pattern at `useMandate.ts:107-108`).
- **ZeroDev dashboard/project config** — whether 7702 sponsorship needs a separate Gas Policy / project setup from the one already backing `NEXT_PUBLIC_ZERODEV_BUNDLER_URL`.
- **Anvil Pectra flag** — exact CLI flag for the Foundry version pinned in this repo; confirm via `anvil --help` rather than assuming `--hardfork prague`.
- **Product scope decision** — whether external (non-Privy-embedded) EOA wallets are in scope at all for v1 (recommendation: no, see §2 limitation).

---

## 8. Sources

- [Privy Docs — Integrating with EIP-7702](https://docs.privy.io/recipes/react/eip-7702)
- [Privy Blog — EIP-7702: what it is, why it matters, and how Privy helps you upgrade](https://privy.io/blog/eip7702-support-with-privy)
- [ZeroDev Docs — Quickstart: EIP-7702](https://docs.zerodev.app/sdk/getting-started/quickstart-7702)
- [ZeroDev Docs — Upgrading Kernel](https://docs.zerodev.app/sdk/advanced/upgrade-kernel)
- [ZeroDev — 7702 Examples site](https://7702.zerodev.app/)
- [ZeroDev examples repo — 7702.ts](https://github.com/zerodevapp/zerodev-examples/blob/main/7702/7702.ts)
- [Viem Docs — Kernel (ZeroDev) Smart Account (`toEcdsaKernelSmartAccount`)](https://viem.sh/account-abstraction/accounts/smart/toEcdsaKernelSmartAccount)
- [Pimlico / permissionless-privy-7702 — integration guide](https://github.com/pimlicolabs/permissionless-privy-7702/blob/main/GUIDE.md)
- [ERC-7579 tooling docs — ZeroDev module SDK](https://erc7579.com/tooling/module-sdk/account-sdks/zerodev)
- [Arbitrum Docs — ZeroDev Smart Account Integration Guide](https://docs.arbitrum.io/for-devs/third-party-docs/ZeroDev/zero-dev)
- [Optimism Docs — Preparing for Pectra breaking changes](https://docs.optimism.io/notices/pectra-changes)
- [Safe Docs — What is EIP-7702?](https://docs.safe.global/advanced/eip-7702/overview)
- In-repo references verified during this research: `solidity/src/helpers/PowersPaymaster.sol`, `solidity/lib/account-abstraction` (tag `v0.7.0`), `frontend/context/Providers.tsx`, `frontend/hooks/useMandate.ts`, `frontend/hooks/useEffectiveAddress.ts`, `frontend/hooks/usePowers.ts`, `frontend/context/constants.ts`, `frontend/package.json`.
