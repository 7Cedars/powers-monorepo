'use client';

import React from 'react';

/**
 * Build-time stand-in for '@privy-io/react-auth', swapped in via the
 * E2E_MOCK_AUTH webpack alias (see next.config.mjs). Reads test-controlled
 * state from window.__E2E_PRIVY_STATE__, set per-test via page.addInitScript
 * before navigation (see e2e/mocks/auth-fixture.ts).
 */

export type ConnectedWallet = { address: string; walletClientType?: string };

type E2EPrivyState = {
  ready: boolean;
  authenticated: boolean;
  wallets: ConnectedWallet[];
};

declare global {
  interface Window {
    __E2E_PRIVY_STATE__?: E2EPrivyState;
  }
}

const DEFAULT_STATE: E2EPrivyState = { ready: true, authenticated: false, wallets: [] };

function getState(): E2EPrivyState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  return window.__E2E_PRIVY_STATE__ ?? DEFAULT_STATE;
}

export type PrivyClientConfig = Record<string, unknown>;

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function usePrivy() {
  const state = getState();
  return {
    ready: state.ready,
    authenticated: state.authenticated,
    user: state.authenticated && state.wallets[0]
      ? { linkedAccounts: [] as { type: string }[] }
      : null,
    login: () => {},
    logout: () => {},
    connectWallet: () => {},
  };
}

export function useWallets() {
  const state = getState();
  return { ready: state.ready, wallets: state.wallets };
}

export function useCreateWallet() {
  return { createWallet: async () => {} };
}

// Used internally by @privy-io/wagmi's WagmiProvider (useSyncPrivyWallets)
// to react to live wallet-connect events. The mocked usePrivy/useWallets
// above never authenticate through a real flow, so these callbacks are
// never invoked — they only need to exist so that import doesn't fail.
export function useConnectWallet(_opts?: { onSuccess?: (...args: any[]) => void }) {
  return { connectWallet: () => {} };
}

export function useConnectOrCreateWallet(_opts?: { onSuccess?: (...args: any[]) => void }) {
  return { connectOrCreateWallet: () => {} };
}

export function useLogin(_opts?: { onComplete?: (...args: any[]) => void }) {
  return { login: () => {} };
}
