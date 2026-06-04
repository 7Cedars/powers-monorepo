# ZeroDev Migration — Remaining Steps

Code changes are done. Complete these steps before testing.

## 1. Privy dashboard
- Go to your Privy app settings
- Change the smart wallet type to **Kernel (ZeroDev)**

## 2. ZeroDev project setup
- Create a project at https://dashboard.zerodev.app
- Copy the bundler URL for Sepolia
- Add to `frontend/.env`:
  ```
  NEXT_PUBLIC_ZERODEV_PROJECT_ID=<your-project-id>
  NEXT_PUBLIC_ZERODEV_BUNDLER_URL=https://rpc.zerodev.app/api/v3/<your-project-id>/chain/11155111
  ```
- ZeroDev supports Arb Sepolia (421614), Opt Sepolia (11155420), Base Sepolia (84532) — the chain-swap logic in `useMandate.ts` handles these automatically

## 3. Redeploy PowersPaymaster
- `PowersPaymaster.sol` has a new public constant (`EXECUTE_SELECTOR_KERNEL`) — the ABI changed, so redeploy is required
- After deploying, call `setPaymaster(newPaymasterAddress)` on each Powers contract via the governance flow

## 4. Note on existing users
- Switching to Kernel gives users a **new smart account address**
- Any existing role assignments tied to old smart account addresses will need to be re-assigned

## 5. Local dev (Anvil)
- ZeroDev bundler does not support local Anvil (chainId 31337)
- The existing fallback path in `useMandate.ts` handles this: if no paymaster is set, it falls back to `currentClient.sendTransaction()` directly
