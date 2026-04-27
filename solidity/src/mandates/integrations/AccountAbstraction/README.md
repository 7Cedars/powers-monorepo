# ERC-4337 Account Abstraction Integration

This folder contains components to natively support ERC-4337 Account Abstraction (AA) with the Powers protocol, specifically focusing on gas sponsorship (Paymasters).

## Architecture

Standard ERC-4337 transactions flow as follows:
`User` -> `Bundler` -> `EntryPoint` -> `AA Wallet` -> `Target Contract`

Because the `AA Wallet` calls the `Target Contract` (e.g. `Powers.sol`), the `msg.sender` inside `Powers.sol` is the AA Wallet address itself. This means **no modifications to `Powers.sol` are required** to support ERC-4337. The existing role system will simply assign roles to the user's AA Wallet instead of their EOA (Externally Owned Account).

## Components

### 1. PowersPaymaster.sol
An ERC-4337 compatible Paymaster that explicitly sponsors `UserOperations` **only if the target contract is the DAO's Powers deployment**.
- It decodes the `callData` of standard AA wallet executions (`execute` and `executeBatch`).
- It verifies the target is the configured `POWERS_CONTRACT`.
- This ensures the DAO treasury only pays for governance actions, not arbitrary external transactions.

### 2. FundPaymaster.sol (Mandate)
Allows the Powers DAO to send ETH from its treasury directly to the EntryPoint to fund the Paymaster's deposit.

### 3. WithdrawFromPaymaster.sol (Mandate)
Allows the Powers DAO to withdraw unused funds from the Paymaster's deposit back to the Powers treasury.

## Frontend / Privy.io Integration

When using Privy.io with Account Abstraction:
1. **Wallet Creation**: Privy automatically provisions an AA wallet for the user upon login.
2. **Role Assignment**: Ensure that when assigning roles in Powers, you use the user's AA Wallet address (which Privy returns as the Smart Account address), not their EOA signer address.
3. **Sponsorship**:
   When configuring your bundler/paymaster provider (e.g., Pimlico, ZeroDev, Biconomy) in the Wagmi/Privy setup:
   - Provide the address of the deployed `PowersPaymaster` contract.
   - When the user executes a `request` or `propose` action on `Powers.sol`, the provider will route the `UserOperation` to your custom paymaster.
   - The paymaster will validate the target and sponsor the gas.

## Setup Instructions

1. Deploy the `PowersPaymaster` contract:
   - `_entryPoint`: The official ERC-4337 EntryPoint (e.g., `0x0000000071727De22E5E9d8BAf0edAc6f37da032`)
   - `_powersContract`: Your DAO's `Powers.sol` address
   - `_owner`: Your DAO's `Powers.sol` address (so it can manage the Paymaster)

2. Adopt `FundPaymaster` and `WithdrawFromPaymaster` mandates in your DAO.
3. Fund the Paymaster by proposing/requesting the `FundPaymaster` mandate with the Paymaster address and amount of ETH.