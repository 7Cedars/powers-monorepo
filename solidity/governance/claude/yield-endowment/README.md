# Yield Endowment

A yield-distributing endowment governed on-chain via the Powers Protocol. The corpus is untouchable; incoming yield is allocated through competitive slate voting every six months. Past grantees form the Member body and drive allocation decisions, while a permanent group of five Founding Members holds institutional safeguards (veto, emergency pause, mission statement, and reform initiation).

---

## Overview

**What the organisation governs:**
- Distributing incoming yield to projects through competitive funding slates (every 6 months)
- Admitting and revoking past grantees as Members
- Maintaining the organisation's mission statement (the URI stored on-chain)
- Proposing and ratifying structural governance reforms

**Role structure:**
| Role | Who | How to join |
|------|-----|-------------|
| Founding Members | Five permanent stewards | Assigned at deployment, never change |
| Members | Past grantees | Granted by Founding Members; lapses if inactive |

See `Spec.md` for the full governance specification including flows, checks and balances, and design rationale.

---

## Prerequisites

Set the following environment variables before deploying to a live network:

```bash
export SEPOLIA_RPC_URL=<your-alchemy-or-infura-url>
export PRIVATE_KEY=<deployer-private-key>
export ETHERSCAN_API_KEY=<your-etherscan-api-key>
```

**Before deploying:**
1. Replace the `FOUNDER_1` through `FOUNDER_5` address constants in `Deploy.s.sol` with the real founding member addresses.
2. Set the metadata URI in the Powers constructor (see **Metadata URI** section below).

---

## Deployment

```bash
# Local Anvil (for testing)
make deploy-anvil

# Ethereum Sepolia
make deploy-sepolia

# Arbitrum Sepolia
make deploy-arb-sepolia

# Optimism Sepolia
make deploy-opt-sepolia
```

After deploying, note the two deployed contract addresses printed by the script:
- The **Powers** contract address — the main governance hub
- The **SlateRegistry** contract address — manages elections and slate voting

---

## Actions Script

`Actions.s.sol` contains individual action functions that a human or bot calls directly to trigger a specific governance step — for example, creating an election, adding a slate, or casting a veto.

Use it when you want to trigger a single step manually during a flow.

Example:
```bash
# Create an election
forge script governance/claude/yield-endowment/Actions.s.sol:YieldEndowmentActions \
  --sig "createElection(address,address,string,uint8,uint8,uint8,uint256,uint256)" \
  <powers-address> <slate-registry-address> "H1 2026 Yield" 10 5 3 $PRIVATE_KEY 1 \
  --rpc-url $SEPOLIA_RPC_URL --broadcast

# Cast a vote
forge script governance/claude/yield-endowment/Actions.s.sol:YieldEndowmentActions \
  --sig "castVote(address,uint256,uint16[],uint256,uint256)" \
  <powers-address> <election-id> "[0,1]" $PRIVATE_KEY 1 \
  --rpc-url $SEPOLIA_RPC_URL --broadcast
```

---

## Runners Script

`Runners.s.sol` contains stateless checkpoint runners — each `run*()` function reads current on-chain state and advances a governance flow as far as conditions allow, then stops and logs what it is waiting for (a voting window, a timelock, a missing prerequisite).

Use it for automated execution or to catch up a flow without manually tracking which step you're on.

Example:
```bash
# Advance the slate election flow (call repeatedly until complete)
forge script governance/claude/yield-endowment/Runners.s.sol:YieldEndowmentRunners \
  --sig "runSlateElectionFlow(address,address,string,uint8,uint8,uint8,uint256,uint256)" \
  <powers-address> <slate-registry-address> "H1 2026 Yield" 10 5 3 $PRIVATE_KEY 1 \
  --rpc-url $SEPOLIA_RPC_URL --broadcast

# Advance the mission statement update flow
forge script governance/claude/yield-endowment/Runners.s.sol:YieldEndowmentRunners \
  --sig "runMissionStatementFlow(address,string,uint256[],uint256)" \
  <powers-address> "https://ipfs.example.com/endowment.json" "[<key1>,<key2>,<key3>]" 1 \
  --rpc-url $SEPOLIA_RPC_URL --broadcast
```

---

## Metadata URI

The Powers contract stores a URI pointing to a JSON file with human-readable metadata (`name`, `description`, `image`) for the organisation. This is displayed in frontends and block explorers.

The deploy script contains a `// TODO` comment where the URI should go:
```solidity
new Powers(
    "Yield Endowment",
    "",  // TODO: set metadata URI before deploying
    ...
```

**To set your metadata URI:**
1. Create a JSON file:
   ```json
   {
     "name": "Yield Endowment",
     "description": "A yield-distributing endowment for ...",
     "image": "https://..."
   }
   ```
2. Upload it to [Pinata](https://pinata.cloud) (free tier available).
3. Copy the resulting gateway URL (e.g., `https://gateway.pinata.cloud/ipfs/Qm...`).
4. Paste the URL into `Deploy.s.sol` in place of the empty string.

---

## Testing

Run the test suite against the local forge environment (no fork needed):

```bash
# From the solidity/ directory
forge test --match-contract YieldEndowment_test -vvv

# Or using the Makefile shortcut
make test
```

The tests cover:
- Deployment and initial setup (role assignment, label assignment)
- Membership grant, revoke, and voluntary leave
- Slate election happy path (create → add slate → vote → execute)
- Founding Member veto blocking execution
- Mission statement update
- Governance reform proposal and ratification
- Emergency pause and restart

---

## File Reference

| File | Purpose |
|------|---------|
| `Spec.md` | Full governance specification with design rationale |
| `Deploy.s.sol` | Forge deployment script — creates Powers, SlateRegistry, and all mandates |
| `Actions.s.sol` | Individual action functions for each governance step |
| `Runners.s.sol` | Stateless checkpoint runners that advance flows automatically |
| `Test.t.sol` | Forge test suite covering all governance flows |
| `Makefile` | Shortcuts for `deploy-anvil`, `deploy-sepolia`, and `test` |
