import type { Page } from '@playwright/test';

/**
 * Seeds window.__E2E_PRIVY_STATE__ before navigation so the mocked
 * '@privy-io/react-auth' module (active when the app is built with
 * E2E_MOCK_AUTH=true) reports an authenticated/disconnected wallet without
 * going through the real Privy login flow.
 */
export async function mockAuth(page: Page, opts?: { address: string }) {
  await page.addInitScript((address) => {
    window.__E2E_PRIVY_STATE__ = address
      ? { ready: true, authenticated: true, wallets: [{ address }] }
      : { ready: true, authenticated: false, wallets: [] };
  }, opts?.address);
}
