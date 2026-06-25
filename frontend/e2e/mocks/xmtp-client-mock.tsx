'use client';

/**
 * Build-time stand-in for '@/hooks/useXmtpClient', swapped in via the
 * E2E_MOCK_AUTH webpack alias (see next.config.mjs). Reads test-controlled
 * state from window.__E2E_XMTP_STATE__, set per-test via page.addInitScript
 * before navigation (see e2e/mocks/xmtp-fixture.ts).
 *
 * `client` always stays null here - every real network call in
 * Chatroom.tsx is guarded by `if (!client ...) return`, so leaving it null
 * keeps those call sites inert while still letting `isConnected` flip to
 * exercise the "connected but not yet in the group" UI branch.
 */

type E2EXmtpState = {
  isConnected: boolean;
};

declare global {
  interface Window {
    __E2E_XMTP_STATE__?: E2EXmtpState;
  }
}

const DEFAULT_STATE: E2EXmtpState = { isConnected: false };

function getState(): E2EXmtpState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  return window.__E2E_XMTP_STATE__ ?? DEFAULT_STATE;
}

export function useXmtpClient() {
  const state = getState();
  return {
    client: null,
    isLoading: false,
    error: null,
    isConnected: state.isConnected,
    initializeClient: async () => {},
    disconnect: () => {},
    removeAllInstallations: async () => {},
  };
}
