# Secured Slate Governance

A treasury management organisation in which any account can propose competitive *slates* of on-chain actions. A Security Council vets slates before voting opens. Members then vote, and winning slates execute automatically. The Security Council is pre-assigned and cannot vote on slates — it can only block or pause.

---

## Prerequisites

The following environment variables must be set before deploying or testing.

| Variable | Purpose |
|----------|---------|
| `SEPOLIA_RPC_URL` | Ethereum Sepolia RPC endpoint (required for Sepolia deploys and fork tests) |
| `ARB_SEPOLIA_RPC_URL` | Arbitrum Sepolia RPC endpoint (optional) |
| `OPT_SEPOLIA_RPC_URL` | Optimism Sepolia RPC endpoint (optional) |
| `PRIVATE_KEY` | Deployer private key (Anvil only; live networks use `--account dev_3`) |
| `ETHERSCAN_API_KEY` | Required for contract verification on Arb/Opt Sepolia |

---

## Deployment

**Step 1** — Make sure the `solidity/` Makefile variables (`SEPOLIA_RPC_URL`, `DEV2_ADDRESS`, etc.) are set in a `.env` file or your shell session.

**Step 2** — Deploy mandates first if this is a fresh environment:
```bash
cd solidity && make deploy-mandates-anvil
```

**Step 3** — Run the deploy target for your target network:

```bash
# Local Anvil (start anvil first: `anvil` in a separate terminal, then `make initialise-anvil`)
make -f governance/examples/SecuredSlate/Makefile deploy-anvil

# Ethereum Sepolia
make -f governance/examples/SecuredSlate/Makefile deploy-sepolia

# Arbitrum Sepolia
make -f governance/examples/SecuredSlate/Makefile deploy-arb-sepolia

# Optimism Sepolia
make -f governance/examples/SecuredSlate/Makefile deploy-opt-sepolia
```

The deploy script returns the addresses of the deployed `Powers` contract and the `SlateRegistry`. Note these — you will need them to run actions.

**Step 4** — Update `frontend/context/constants.ts` with the deployed addresses if you want the frontend to display this organisation.

---

## Actions Script

`actions/SecuredSlateActions.s.sol` provides one function per governance step. Use these when you want to manually trigger a specific step during development or debugging.

Each function uses the deployer's exact `nameDescription` strings to look up the correct mandate on-chain — so no manual mandate IDs are needed.

### Governance flows covered

| Function | Flow | What it does |
|----------|------|-------------|
| `createElection(...)` | A | Member opens a new slate election in the SlateRegistry |
| `castVote(...)` | A | Member casts votes for one or more slates |
| `executeResults(...)` | A | Anyone triggers on-chain execution of winning slates |
| `addSlate(...)` | B | Anyone submits a slate of actions during the submission window |
| `removeSlate(...)` | B | Security Council vetoes a slate (same calldata + nonce as addSlate) |
| `proposeMemberAddition(...)` | C | Members propose + vote to onboard a new member |
| `addMember(...)` | C | Execute an approved member onboarding |
| `renounceMembership(...)` | C | Member voluntarily gives up their role |
| `blacklistAccount(...)` | D | Security Council marks an account as Blacklisted |
| `revokeBlacklistedMembership(...)` | D | Security Council removes the Member role (requires same calldata + nonce as blacklistAccount) |
| `deBlacklistAccount(...)` | D | Security Council removes the Blacklisted mark |
| `pauseOrRestartCriticalMandates(...)` | E | Security Council pauses or restarts Cast Vote, Execute Results, Add Slate |

### Example invocation

```bash
# Create a new election
forge script governance/examples/SecuredSlate/actions/SecuredSlateActions.s.sol:SecuredSlateActions \
  --sig "createElection(address,address,string,uint8,uint8,uint8,uint256,uint256)" \
  <powers-address> <slate-registry-address> "Q1 Funding Round" 5 3 1 <private-key> 1 \
  --rpc-url $SEPOLIA_RPC_URL --broadcast
```

---

## Runners Script

`actions/SecuredSlateRunners.s.sol` provides stateless checkpoint runners. Each `run*()` function checks on-chain state and advances a flow as far as current conditions allow, stopping at the first phase that is still waiting on a time window. Call the same runner again after the window passes to advance to the next phase.

### Runner functions

| Function | What it does |
|----------|-------------|
| `runSetup(...)` | Runs the initial setup mandate once; no-ops if already complete |
| `runSlateElectionFlow(...)` | Advances: create election → (wait) → vote → (wait) → execute results |
| `runMemberAdditionFlow(...)` | Advances: propose + vote → (wait) → execute member addition |
| `runBlacklistFlow(...)` | Blacklists an account and optionally revokes membership in one call |

### Example invocation

```bash
# Advance a slate election flow
forge script governance/examples/SecuredSlate/actions/SecuredSlateRunners.s.sol:SecuredSlateRunners \
  --sig "runSlateElectionFlow(address,address,string,uint8,uint8,uint8,uint16[],uint256[],uint256)" \
  <powers> <slate-registry> "Q1 Funding Round" 5 3 1 "[0]" "[<alice-key>,<bob-key>]" 1 \
  --rpc-url $SEPOLIA_RPC_URL --broadcast
```

Run the same command again after each time window to advance to the next phase.

---

## Testing

Fork-based tests require a Sepolia RPC URL:

```bash
export SEPOLIA_RPC_URL=<your-rpc-url>
make -f governance/examples/SecuredSlate/Makefile test
```

Tests cover:
- **Deployment checks** — roles assigned, role labels, `needFulfilled` calldata compatibility
- **Flow A** (slate elections) — happy path end-to-end; blocked execution before vote ends
- **Flow B** (slate submission) — Security Council veto removes a slate
- **Flow C** (member management) — add member, renounce membership; blocked without vote
- **Flow D** (blacklist management) — two-step blacklist + de-blacklist; blocked revoke without prior blacklist
- **Flow E** (emergency controls) — pause blocks Cast Vote; restart restores it

---

## Timing parameters

The deployed contract uses shortened windows for testing:

| Window | Test value | Production equivalent |
|--------|-----------|----------------------|
| Submission window | 20 minutes | 2 days |
| Voting window | 30 minutes | 3 days |

To switch to production timing, update the `SlateRegistry` constructor arguments in `SecuredSlate.s.sol` from `minutesToBlocks(20, ...)` / `minutesToBlocks(30, ...)` to `minutesToBlocks(2 * 24 * 60, ...)` / `minutesToBlocks(3 * 24 * 60, ...)`.
