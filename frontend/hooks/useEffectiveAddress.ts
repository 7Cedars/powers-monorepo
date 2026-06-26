import { useWallets, usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";

/**
 * Returns the address that the Powers contract will see as msg.sender.
 *
 * For smart-wallet (abstract) accounts the on-chain sender is the smart
 * contract wallet address (client.account.address), NOT the embedded EOA
 * that signed the UserOperation. Using the wrong address causes
 * Powers_cannotCallMandate when the role was registered against the EOA.
 */
export const useEffectiveAddress = (): `0x${string}` | undefined => {
  const { wallets, ready: walletsReady } = useWallets();
  const { user, authenticated } = usePrivy();
  const { client } = useSmartWallets();

  if (!authenticated) return undefined;

  const hasSmartWalletAccount = user?.linkedAccounts.find((a) => a.type === 'smart_wallet') !== undefined;
  const isSmartWallet = hasSmartWalletAccount && !!client?.account;

  if (isSmartWallet) {
    return client!.account.address as `0x${string}`;
  }

  return walletsReady && wallets[0] ? wallets[0].address as `0x${string}` : undefined;
};
