# Project Orange — Operator Guide

## Overview

Project Orange is an on-chain organisation devoted to all things orange — the colour, the fruit, the vibe. It holds an ETH treasury directly in the Powers contract and funds proposals submitted by anyone from the public. Three devoted Members must vote unanimously to approve any funding request. After approval, the Admin has a short emergency veto window before the funds are transferred.

There are four governance flows:
1. **Fund a Project** — public submits a proposal; Members vote unanimously; Admin may veto; Member executes after timelock
2. **Governance Reform** — Members vote unanimously to adopt new governance mandates
3. **Fund Paymaster** — Admin tops up the gasless paymaster with 0.05 ETH
4. **Withdraw from Paymaster** — Admin recovers ETH from the paymaster

---

## Prerequisites

Create a `.env.local` file (copy from `.env.example`) with:

| Variable | Purpose |
|---|---|
| `SEPOLIA_RPC_URL` | Ethereum Sepolia RPC endpoint |
| `ARB_SEPOLIA_RPC_URL` | Arbitrum Sepolia RPC endpoint |
| `OPT_SEPOLIA_RPC_URL` | Optimism Sepolia RPC endpoint |
| `ETHERSCAN_API_KEY` | For contract verification |
| `DEPLOYER_ACCOUNT` | Foundry encrypted keystore name (see below) |
| `DEPLOYER_ADDRESS` | Deployer wallet address |

**Wallet setup:** run `make setup-wallet` and follow the printed instructions to create a Foundry encrypted keystore. The deployer wallet must hold at least **0.05 ETH plus gas** at deploy time to seed the paymaster.

---

## Deployment

```bash
# 1. Copy and fill in environment variables
cp .env.example .env.local   # then edit .env.local

# 2. Create encrypted keystore (run once; you will be prompted for a password)
make setup-wallet

# 3. Deploy (choose the target network)
make deploy-anvil         # local Anvil (no wallet needed)
make deploy-arb-sepolia   # Arbitrum Sepolia (recommended for demo)
make deploy-sepolia       # Ethereum Sepolia
make deploy-opt-sepolia   # Optimism Sepolia
```

After deployment the script prints the `Powers` and `PowersPaymaster` addresses. Copy these into the frontend's `context/constants.ts` if you are running the frontend.

---

## Governance Flows (Actions script)

Use the Actions script to execute individual governance steps. Each function corresponds to one step in a flow. All steps in Flow 1 must use the **same calldata and nonce** so the on-chain actionId chain links correctly.

### Flow 1 — Fund a Project

```bash
# Step 1: Public submits a funding proposal (anyone)
forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
  --sig "submitFundingProposal(address[],uint256[],bytes[],string,uint256,address)" \
  "[0xRECIPIENT]" "[100000000000000000]" "['0x']" "Buy orange futures" 0 $POWERS_ADDRESS \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $DEPLOYER_ACCOUNT --broadcast

# Step 2a: A Member opens the vote
forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
  --sig "openVoteOnFunding(address[],uint256[],bytes[],string,uint256,address)" \
  "[0xRECIPIENT]" "[100000000000000000]" "['0x']" "Buy orange futures" 0 $POWERS_ADDRESS \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $MEMBER_ACCOUNT --broadcast

# Step 2b: Each Member casts their vote (run three times, once per Member wallet)
#   voteOption: 0=Against, 1=For, 2=Abstain — all three must vote FOR
forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
  --sig "castVoteOnFunding(uint256,uint8,address)" \
  $ACTION_ID 1 $POWERS_ADDRESS \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $MEMBER_ACCOUNT --broadcast

# Step 2c: Finalize the vote after the 5-minute voting window
forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
  --sig "finalizeVoteOnFunding(address[],uint256[],bytes[],string,uint256,address)" \
  "[0xRECIPIENT]" "[100000000000000000]" "['0x']" "Buy orange futures" 0 $POWERS_ADDRESS \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $MEMBER_ACCOUNT --broadcast

# (Optional) Step 3: Admin casts emergency veto within the timelock window
forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
  --sig "vetoFundingProposal(address[],uint256[],bytes[],string,uint256,address)" \
  "[0xRECIPIENT]" "[100000000000000000]" "['0x']" "Buy orange futures" 0 $POWERS_ADDRESS \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $ADMIN_ACCOUNT --broadcast

# Step 4: Execute the transfer (call twice: once to start timelock, once after 10-min timelock)
forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
  --sig "executeFundingProposal(address[],uint256[],bytes[],string,uint256,address)" \
  "[0xRECIPIENT]" "[100000000000000000]" "['0x']" "Buy orange futures" 0 $POWERS_ADDRESS \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $MEMBER_ACCOUNT --broadcast
```

---

## Automated Runner (Runners script)

The Runners script is stateless: each call inspects on-chain state and advances the flow to the next checkpoint. Useful for bot or cron-based automation.

```bash
# Advance Flow 1 as far as on-chain state allows
forge script governance/claude/project-orange/Runners.s.sol:ProjectOrangeRunners \
  --sig "runFundingFlow(address,address[],uint256[],bytes[],string,uint256)" \
  $POWERS_ADDRESS "[0xRECIPIENT]" "[100000000000000000]" "['0x']" "Buy orange futures" 0 \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $DEPLOYER_ACCOUNT --broadcast

# Top up the paymaster
forge script governance/claude/project-orange/Runners.s.sol:ProjectOrangeRunners \
  --sig "runFundPaymaster(address,uint256)" $POWERS_ADDRESS 0 \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $ADMIN_ACCOUNT --broadcast
```

**Note:** vote casting (Step 2b) is intentionally not automated — each Member must cast their vote individually using their own wallet.

---

## Gasless Transactions (Paymaster)

A `PowersPaymaster` (ERC-4337) is deployed alongside the organisation and pre-funded with **0.05 ETH** at deploy time. Members and the public can interact with Project Orange without paying gas from their own wallets.

**Check the paymaster balance:**
```bash
cast call $PAYMASTER_ADDRESS "getDeposit()(uint256)" --rpc-url $ARB_SEPOLIA_RPC_URL
```

**Top up the paymaster (Flow 3):**
```bash
# Step 1
forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
  --sig "proposeFundPaymaster(uint256,address)" 0 $POWERS_ADDRESS \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $ADMIN_ACCOUNT --broadcast

# Step 2
forge script governance/claude/project-orange/Actions.s.sol:ProjectOrangeActions \
  --sig "executeFundPaymaster(uint256,address)" 0 $POWERS_ADDRESS \
  --rpc-url $ARB_SEPOLIA_RPC_URL --account $ADMIN_ACCOUNT --broadcast
```

---

## Testing

```bash
make test
```

The test suite runs locally (no RPC endpoint needed). It covers:
- Deployment checks (roles, labels, inputParam chain integrity)
- Flow 1 happy path: full funding flow end-to-end
- Flow 1 negative: admin veto blocks execution
- Flow 1 negative: a single AGAINST vote kills the proposal

---

## Demo vs Production Timing

| Parameter | Demo (current) | Production (recommended) |
|---|---|---|
| Voting period | 5 minutes | 3 days |
| Execution timelock | 10 minutes | 4 days |

To switch to production timing, update the `minutesToBlocks()` calls in `Deploy.s.sol` from `5` / `10` to `4320` / `5760` (minutes in 3 / 4 days), then redeploy.
