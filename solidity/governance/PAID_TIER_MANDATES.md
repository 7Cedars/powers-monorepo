# Paid Tier for Mandates — Design Proposal

> Status: proposal / plan only. No protocol code has been changed by this document.
>
> This supersedes an earlier draft that used a *separate* `PremiumMandateManager`
> subscription contract. The current design **unifies the paywall with the
> `MandateRegistry`** — one primitive — and charges a **one-time fee on adoption** rather
> than a recurring subscription.

## Goals

Powers wants to monetize advanced mandates **and** let third-party developers earn from
mandates they author, under four constraints:

1. **Not predefined / organically updatable** — nothing hardcodes *which* mandates are paid;
   pricing is per-mandate state that can change over time.
2. **Third-party devs get paid** — a mandate can have one or more developer payees.
3. **No ecosystem fragmentation** — a user (an org paying to use paid mandates) pays **one
   address, once**, and never has to pay each individual developer.
4. **Elegant** — few primitives that can be broken; the `MandateRegistry` and the paid tier
   are **one and the same system**.

## Key architectural findings

- **The whitelist is currently opt-in, not a security boundary.** The `MandateRegistry` is
  consulted exactly once — at adoption time, inside `PowersUtilities.storeMandate`
  (`src/libraries/PowersUtilities.sol:56-62`) via `isMandateAddressActive(targetMandate)`.
  But a Powers instance stores its registry as an **immutable** value set at construction
  (`src/Powers.sol:84`), and `address(0)` disables enforcement entirely. Anyone can deploy
  their own `Powers` pointing at `address(0)` and adopt any mandate. So a registry-level gate
  only paywalls the sanctioned deployment path (factory/frontend), not the protocol.
- **Mandates are singletons** shared across all DAOs; per-DAO state is keyed by
  `(powers, mandateId)` (`src/Mandate.sol:56-60`). There is no per-DAO mandate deployment to
  attach payment to.
- **The mandate contract is the only component that always runs**, regardless of which
  registry/Powers is used. Therefore the paywall must live *inside* the mandate to be
  tamper-proof.
- **Mandates are currently registry-blind.** `Mandate`/`AsyncMandate` never learn which
  registry (if any) whitelisted them; `initializeMandate` only records the calling org
  (`msg.sender`). Adding a paywall requires giving the mandate base a canonical registry
  reference.
- The reusable payment building blocks already in the repo are the ETH-transfer + percentage
  split patterns in `src/addons/helpers/Governed721.sol` and
  `src/addons/mandates/integrations/GovernedToken/GovernedToken_CollectSplitPayment.sol`
  (`amount = quantity * percentage / DENOMINATOR`, pull-based per-recipient collection).

## The core move: invert the check to **mandate → registry**

Today the check flows **Powers → registry** and is bypassable. We invert it so each mandate,
inside its own `initializeMandate`, calls back to the canonical registry to:

1. Confirm it is registered/active (the whitelist gate), and
2. If it is priced, charge the adopting org's prepaid credit balance and book the proceeds to
   its developers (minus a protocol fee).

Because `initializeMandate` always runs on adoption regardless of which Powers or registry is
used, this paywall is **tamper-proof** — there is no `address(0)` escape at the mandate level.

## Design decisions

| Decision | Choice | Consequence |
|---|---|---|
| **Charge cadence** | **One-time on adoption.** Check lives only in `initializeMandate` (the adoption/reform path). | Execution (`executeMandate` → `handleRequest`) never touches the registry. A broken/paused/deactivated registry blocks **new adoptions & new-org creation only**; already-adopted mandates keep executing and can still be revoked/paused. |
| **Enforcement** | **Mandatory.** Every mandate inheriting the base checks the registry on adoption; no sovereign bypass at the mandate level. | Acceptable *because* ongoing execution is unaffected — orgs keep running even if the registry is down. |
| **Credit representation** | **Internal, non-transferable balance denominated in wei.** No ERC20, no rate oracle. | Buying credits = prepaying ETH into a ledger; ETH stays in the registry to pay devs. Fewest primitives, no secondary market, no token to break. |
| **Registry owner** | **A Powers org.** Only that owning org can register/price mandates and set dev splits. | Governance *is* the trust vector — "registered" keeps meaning "vetted". Devs propose off-chain / via governance; the org ratifies by calling `registerMandate` with the dev list + price. Devs withdraw earnings permissionlessly. |

## Design

### 1. Extend `MandateRegistry` into the unified registry + credits contract
Path: `src/core/helpers/MandateRegistry.sol` — **the same contract** (that is the
unification). Stays `Ownable`; the owner is a Powers org.

**New per-mandate state** (keyed by mandate **address**, matching the existing `addressKey`
lookup that `isMandateAddressActive` already uses):
- `mapping(address mandate => uint256 price) public mandatePrice;` — `0` = free.
- `mapping(address mandate => address[] devs) public mandateDevs;` — 1+ payees; the paid
  portion is split equally, with any remainder wei going to the first dev.

**New credit / earnings ledger** (all native ETH, internal):
- `mapping(address org => uint256) public credits;` — prepaid balance per org.
- `mapping(address dev => uint256) public earnings;` — withdrawable balance; the owning org
  is itself a payee for the protocol fee.
- `uint16 public feeBps;` — adjustable protocol fee in basis points (e.g. `1000` = 10%),
  owner-settable, capped (e.g. ≤ `3000`).

**New / extended functions:**
- Extend `registerMandate` (and `batchRegisterMandates`) to also take `address[] devs` and
  `uint256 price` — `onlyOwner`, reusing the existing validation + `addressKey` write path
  (`MandateRegistry.sol:142-179`). Add owner-only `setMandatePricing(address mandate,
  address[] devs, uint256 price)` and `setFeeBps(uint16)`.
- `buyCredits(address org) external payable` — anyone can top up any org's balance (a member
  funds their own org); `credits[org] += msg.value`. Emits `CreditsPurchased`. This is the
  single "pay one address, once" entry point.
- `onAdopt(address org) external` — **called by the mandate itself** during
  `initializeMandate`. Here `msg.sender` **is the mandate** being charged (trustless
  identity), and `org` is passed by the mandate (its own caller). Logic:
  - `require(isMandateAddressActive(msg.sender), NotRegistered)` — the mandatory whitelist
    gate.
  - if `mandatePrice[msg.sender] == 0` → return (free; no charge).
  - else: `credits[org] -= price` (reverts if insufficient); `fee = price * feeBps / 10000`;
    `earnings[owner()] += fee`; split `price - fee` equally across `mandateDevs[msg.sender]`
    into `earnings`. Emits `MandateCharged`.
- `withdrawEarnings() external` — pull pattern; sends `earnings[msg.sender]` in ETH after
  zeroing it (checks-effects-interactions), via `.call` with a success check (mirrors the ETH
  branch in `Governed721.sol`). Guard with `nonReentrant`.

`onAdopt` mutates only registry ledger state and never calls back into the mandate or Powers,
so the reentrancy surface is minimal; still apply checks-effects-interactions.

**Deactivation semantics fall out for free:** `deactivateMandate` makes `onAdopt` revert for
*new* adoptions, while orgs that already adopted are untouched (execution never calls the
registry). Paid orgs are grandfathered automatically.

### 2. Add the mandate-side check in the two base classes
Files: `src/Mandate.sol`, `src/AsyncMandate.sol` (independent bases).
- Add `address public immutable MANDATE_REGISTRY;` and
  `constructor(address registry_) { MANDATE_REGISTRY = registry_; }` to each base.
- At the **top of `initializeMandate`** (`src/Mandate.sol:50-64`,
  `src/AsyncMandate.sol:50-64`), before storing state:
  ```solidity
  IMandateRegistry(MANDATE_REGISTRY).onAdopt(msg.sender); // msg.sender == adopting Powers org
  ```
  This reverts (unregistered) or charges (priced) atomically with adoption.
- **`executeMandate` is deliberately NOT touched** and stays non-virtual. One-time cadence
  means there is no per-execution gate — and this is exactly what preserves "orgs keep running
  even if the registry is down."

**Registry-address strategy — immutable via constructor** (recommended): test-friendly and
chain-flexible. Every concrete mandate forwards the canonical registry address into the base
constructor. This is a mechanical constructor change across all mandates (bounded; it applies
to every mandate because enforcement is universal).

_Alternative considered:_ a hardcoded `address constant` pointing at a deterministic CREATE2
address (create2 is always enabled in `foundry.toml`) — a one-line base change with zero
constructor churn, but awkward for unit tests (needs `vm.etch` at the constant) and requires a
strict deploy order. We default to the immutable-constructor approach for testability.

### 3. `Powers.sol` / `PowersUtilities` — left unchanged
No edits to `Powers.sol` (not meant to be modified) or `PowersUtilities.storeMandate`. The
existing Powers-side `isMandateAddressActive` check (`PowersUtilities.sol:56-62`) becomes a
harmless belt-and-suspenders for the sanctioned path; the authoritative, non-bypassable check
now lives in the mandate base. (Removing the Powers-side check for strict single-source-of-
truth is possible later but is out of scope, to keep Powers untouched.)

### 4. Deployment & ownership
File: `script/DeployMandates.s.sol`.
- Deploy the registry, then assign ownership to the protocol's Powers org (the script today
  owns it as an EOA — switch to the Powers-org owner, matching the commented
  `IPowers(registry.owner())` intent already present near line 130).
- Thread the registry address into every mandate constructor.
- Register mandates via the extended `batchRegisterMandates` with dev lists + prices
  (free by default, so nothing becomes paid until the owning org prices it).

### 5. Frontend / ABIs
- `make update-builds` from `solidity/` to sync ABIs to `frontend/context/builds/`.
- Ensure the registry address and any credits UI needs are reflected in
  `frontend/context/constants.ts`.

## Worked example

1. A dev writes `FancyMandate`, deploys the singleton, and proposes it to the protocol's
   governance org (the registry owner).
2. Governance calls `registerMandate("FancyMandate", addr, codeHash, [devA, devB], 0.01 ETH)`.
   The mandate is now whitelisted and priced at 0.01 ETH per adoption, split between `devA`
   and `devB`.
3. A DAO wants it. Any member calls `buyCredits{value: 0.05 ETH}(dao)` — the DAO now has a
   0.05 ETH credit balance. (One address, one payment — the member never touches `devA`/`devB`.)
4. The DAO adopts `FancyMandate`. During `initializeMandate`, the mandate calls
   `onAdopt(dao)`: it is registered ✓, price 0.01 ETH is deducted from `credits[dao]`
   (→ 0.04 left), a 10% fee (0.001 ETH) is booked to the owning org, and 0.0045 ETH each is
   booked to `devA` and `devB`.
5. `devA` and `devB` later call `withdrawEarnings()` and receive their ETH. The owning org
   withdraws its accumulated fees the same way.
6. If governance later `deactivateMandate`s `FancyMandate`, the DAO keeps using its already-
   adopted copy indefinitely; only *new* adoptions are blocked.

## Critical files (for the future implementation)
- **New / edit (core):** `src/core/helpers/MandateRegistry.sol` (credits + pricing + split +
  withdraw + `onAdopt`), plus its `IMandateRegistry` interface (`onAdopt`, `buyCredits`,
  `withdrawEarnings`, pricing getters/setters).
- **Edit (bases):** `src/Mandate.sol`, `src/AsyncMandate.sol` — add the registry immutable +
  the `onAdopt` call at the top of `initializeMandate`.
- **Edit (mechanical, all mandates):** thread `registry` into constructors under
  `src/core/mandates/**` and `src/addons/mandates/**` (e.g. `.../electoral/*.sol`,
  `.../executive/*.sol`, and the async
  `.../integrations/Chainlink/ChainlinkFunctions_Open.sol`).
- **Edit (deploy):** `script/DeployMandates.s.sol`.
- **Reuse:** ETH-transfer + percentage-split patterns in `src/addons/helpers/Governed721.sol`
  and `src/addons/mandates/integrations/GovernedToken/GovernedToken_CollectSplitPayment.sol`;
  vendored `SafeERC20` / `IERC20` under `lib/openzeppelin-contracts/...` (available but not yet
  used by first-party code — adopt it for the new money-handling paths).

## What is deliberately NOT changed
- `Powers.sol` — untouched (it is not meant to be modified).
- **No ERC20 credit token** — internal wei ledger only.
- **No per-execution / subscription logic** — a single one-time charge on adoption.

## Verification (for the future implementation)
1. `cd solidity && forge build` — confirm the base changes + registry compile, and Powers
   stays under the 24KB EIP-170 limit (Powers is untouched, so this should hold trivially).
2. New Foundry test `test/unit/MandateRegistryCredits.t.sol` (inherit `test/TestSetup.t.sol`):
   - **Free mandate** → owner registers with `price = 0`; adoption succeeds, no credits move.
   - **Priced, no credits** → adoption reverts (insufficient credits).
   - **Buy then adopt** → `buyCredits{value:X}(org)` raises `credits[org]`; adoption succeeds;
     assert the split: `feeBps` share to `earnings[ownerOrg]`, remainder split equally across
     multiple devs (assert exact wei, including remainder-to-first-dev rounding).
   - **Withdraw** → `withdrawEarnings()` pays each dev the correct ETH; balance zeroes; a
     second call pays 0.
   - **Unregistered / deactivated** → adoption reverts `NotRegistered`, proving the mandatory
     whitelist gate.
   - **Registry-down invariant** → after adopting a priced mandate, `deactivateMandate` it,
     then confirm the org can **still `executeMandate`** the already-adopted mandate (execution
     is independent of the registry) but **cannot adopt it again**.
3. `forge test --match-contract MandateRegistryCredits -vvv`.
4. `make update-builds`; smoke-check the frontend picks up the new ABI.

## Open design points to resolve at implementation time
- **Split weighting** — equal split assumed; switch to weighted (bps per dev) only if devs
  need unequal shares.
- **Post-registration price control** — owner-only assumed. If devs should self-update their
  own mandate's price, add a `mandateDevs`-gated `setMandatePricing` variant.
- **Credit refunds / org withdrawals** — not included (prepaid, non-refundable). Add an org
  `withdrawCredits` only if desired.
