import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:3333',
    trace: 'on-first-retry',
    navigationTimeout: 60_000,
  },
  timeout: 60_000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Production build instead of `pnpm dev`: dev mode compiles routes
    // on-demand, and with fullyParallel workers hammering a single dev
    // server concurrently, navigations and RSC fetches can queue behind
    // unrelated compile jobs and blow past assertion timeouts. A prebuilt
    // server removes that contention entirely.
    command: 'pnpm build && pnpm start -p 3333',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Swaps Privy's auth hooks for a test-controlled mock (see
    // e2e/mocks/) so tests can simulate a connected wallet without going
    // through the real login flow.
    //
    // The WSS vars are blanked out so wagmiConfig falls back to plain HTTP
    // transports for every chain: viem's websocket transport doesn't fail
    // over to the http() fallback quickly when Playwright's routeWebSocket
    // closes the socket, which left vote-count fetches hung indefinitely
    // instead of hitting the page.route HTTP mock.
    env: {
      E2E_MOCK_AUTH: 'true',
      NEXT_PUBLIC_ALCHEMY_SEPOLIA_WSS: '',
      NEXT_PUBLIC_ALCHEMY_ARB_SEPOLIA_WSS: '',
      NEXT_PUBLIC_ALCHEMY_OPT_SEPOLIA_WSS: '',
      NEXT_PUBLIC_ALCHEMY_BASE_SEPOLIA_WSS: '',
    },
  },
});
