import type { Page } from '@playwright/test';

// Sets window.__E2E_XMTP_STATE__, read by e2e/mocks/xmtp-client-mock.tsx
// (aliased in for useXmtpClient under E2E_MOCK_AUTH - see next.config.mjs).
// Defaults to isConnected: false, matching the real hook's initial zustand
// store state, so tests that don't call this are unaffected.
export async function mockXmtp(page: Page, opts?: { isConnected?: boolean }) {
  await page.addInitScript((isConnected) => {
    window.__E2E_XMTP_STATE__ = { isConnected };
  }, opts?.isConnected ?? false);
}
