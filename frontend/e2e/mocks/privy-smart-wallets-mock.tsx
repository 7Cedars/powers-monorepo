'use client';

import React from 'react';

/**
 * Build-time stand-in for '@privy-io/react-auth/smart-wallets', swapped in
 * via the E2E_MOCK_AUTH webpack alias (see next.config.mjs). No test in
 * this suite exercises smart-wallet accounts, so this always reports "no
 * smart wallet" and falls through to the plain EOA path in
 * useEffectiveAddress.
 */

export function SmartWalletsProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useSmartWallets() {
  return { client: undefined };
}
