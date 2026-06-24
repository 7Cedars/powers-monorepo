import { test, expect, type Page } from '@playwright/test';
import { mockAuth } from './mocks/auth-fixture';
import { mockPowersRpc, type MockPowersConfig, type MockMandate } from './mocks/powers-rpc';

const SEPOLIA_CHAIN_ID = '11155111';
const POWERS_101_ADDRESS = '0x7EF3396E64BcdF5b58dE2A097BC5b72712059098';
const ORG_PATH = `/forum/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}`;

// Same desktop breakpoint as overview-org.spec.ts. The forum header (title,
// connect button, theme toggle, navigation dropdown) is only rendered at
// `sm:` and above - below that it's replaced by a hamburger + slide-out menu
// with different markup, which is out of scope for this batch of tests.
const LARGE_VIEWPORT = { width: 1280, height: 900 };

// Below Tailwind's `sm` breakpoint (640px) - matches the iPhone entry in
// e2e/viewports.ts. Triggers the hamburger + slide-out menu instead of the
// desktop header.
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const ORG_BASIC: MockPowersConfig = {
  contractAddress: POWERS_101_ADDRESS,
  name: 'Powers 101',
  mandates: [],
};

const ORG_METADATA_URI = 'https://example.com/forum-org-101-metadata.json';
const ORG_DESCRIPTION = 'A description of the test organisation.';
const ORG_BANNER_URL = 'https://example.com/forum-org-101-banner.png';

const ORG_WITH_METADATA: MockPowersConfig = {
  ...ORG_BASIC,
  uri: ORG_METADATA_URI,
};

// parseMetadata() (utils/parsers.ts) requires every one of these keys to be
// present or it throws and drops the metadata entirely - mirrors the fixture
// in overview-org.spec.ts's mockOrgMetadata.
async function mockOrgMetadata(
  page: Page,
  overrides: { description?: string; banner?: string; website?: string } = {}
) {
  await page.route(ORG_METADATA_URI, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        icon: '',
        banner: ORG_BANNER_URL,
        website: '',
        codeOfConduct: '',
        disputeResolution: '',
        xmtpAgentAddress: null,
        communicationChannels: {},
        attributes: [],
        description: ORG_DESCRIPTION,
        ...overrides,
      }),
    });
  });
}

const SAVED_PROTOCOL = {
  contractAddress: '0x9999999999999999999999999999999999999999',
  chainId: SEPOLIA_CHAIN_ID,
  name: 'Saved Org',
  metadatas: { icon: '', banner: '', description: '', attributes: [] },
  treasury: '0x0000000000000000000000000000000000000000',
  mandateCount: '0',
  mandates: [
    { powers: '0x9999999999999999999999999999999999999999', mandateAddress: '0x0', mandateHash: '0x0', index: '0', active: true },
  ],
  roles: [],
  layout: {},
};

async function seedSavedProtocols(page: Page, protocols: unknown[]) {
  await page.addInitScript((protocols) => {
    window.localStorage.setItem('powersProtocols', JSON.stringify(protocols));
  }, protocols);
}

const TEST_ADDRESS = '0x3333333333333333333333333333333333333333';
const MINT_MANDATE_ADDRESS = '0x1111111111111111111111111111111111111111';
const MEMBER_ROLE = 1n;

// A mandate gated behind MEMBER_ROLE - exercises the mandate-select modal's
// "accessible" vs "no access" branches and the actions list's role gating.
// `roles` must be present for ActionsList to even check `hasRoleSince` for
// MEMBER_ROLE (see app/forum/[chainId]/[powers]/ActionsList.tsx roleIdsToCheck).
const ORG_WITH_MANDATE: MockPowersConfig = {
  ...ORG_BASIC,
  mandates: [
    {
      index: 1n,
      mandateAddress: MINT_MANDATE_ADDRESS,
      active: true,
      nameDescription: 'Mint Tokens: Mint new governance tokens',
      conditions: { allowedRole: MEMBER_ROLE },
    },
  ],
  roles: [{ roleId: MEMBER_ROLE, label: 'member' }],
};

const MINT_ACTION: MockMandate['actions'] = [
  { actionId: '1', state: 7, proposedAt: 100n, fulfilledAt: 110n, description: 'Mint 100 tokens to treasury' },
];

const ORG_WITH_ACTIONS: MockPowersConfig = {
  ...ORG_WITH_MANDATE,
  mandates: [{ ...ORG_WITH_MANDATE.mandates[0], actions: MINT_ACTION }],
};

// A plain EOA - not seeded into useSavedProtocolsStore and not a mandate/org
// address the mock RPC recognizes, so its `getMandateCounter` read resolves
// to nothing and AddressLink falls back to a block-explorer link.
const ROLE_HOLDER_PLAIN_ADDRESS = '0x4444444444444444444444444444444444444444';

// Reuses SAVED_PROTOCOL's address (seeded via seedSavedProtocols) so
// useAddressType/AddressLink recognizes it as a known Powers org and links
// into /forum instead of out to a block explorer.
const ROLE_HOLDER_KNOWN_POWERS_ADDRESS = SAVED_PROTOCOL.contractAddress;

// roles[].holders backs getAmountRoleHolders/getRoleHolderAtIndex in the mock
// RPC - the roleId itself still comes from the mandate's allowedRole condition.
const ORG_WITH_ROLE_HOLDERS: MockPowersConfig = {
  ...ORG_WITH_MANDATE,
  roles: [
    {
      roleId: MEMBER_ROLE,
      label: 'member',
      holders: [ROLE_HOLDER_PLAIN_ADDRESS, ROLE_HOLDER_KNOWN_POWERS_ADDRESS],
    },
  ],
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const TREASURY_ADDRESS = '0x5555555555555555555555555555555555555555';

// getTreasury falls back to the org's own address when `treasury` is
// unset (see e2e/mocks/powers-rpc.ts), so the "no treasury" fixture must set
// it to the zero address explicitly to hit OrgTreasury's empty-state branch.
const ORG_NO_TREASURY: MockPowersConfig = { ...ORG_BASIC, treasury: ZERO_ADDRESS };

const ORG_WITH_TREASURY: MockPowersConfig = {
  ...ORG_BASIC,
  treasury: TREASURY_ADDRESS,
  nativeBalance: 2_500000000000000000n,
};

const ORG_METADATA_WITH_WEBSITE = 'https://example.com';

function tabBar(page: Page) {
  return page.locator('div.flex.bg-muted\\/50.border-b.border-border.overflow-x-auto');
}

function mandateModal(page: Page) {
  return page.getByRole('dialog');
}

// ActionsList renders both a mobile and a desktop layout for every item
// (toggled with `sm:hidden`/`hidden sm:flex`, not conditionally mounted), so
// any text inside an action item exists twice in the DOM. Scope to the
// desktop block - visible at this spec's LARGE_VIEWPORT - to avoid tripping
// Playwright's strict-mode element-count check.
function desktopActionItem(page: Page) {
  return page.locator('div.hidden.sm\\:flex.items-start.gap-3');
}

// Navigating straight to an org's page triggers a live fetchPowers() RPC
// call (and, once authenticated, an ENS lookup against mainnet) - stub
// Alchemy so those resolve instantly instead of racing test teardown.
async function mockAlchemyRpc(page: Page) {
  await page.routeWebSocket(/g\.alchemy\.com/, (ws) => ws.close());
  await page.route(/g\.alchemy\.com\/v2\//, async (route) => {
    let body: unknown;
    try {
      body = JSON.parse(route.request().postData() ?? '{}');
    } catch {
      body = {};
    }
    const toResult = (entry: any) => ({ jsonrpc: '2.0', id: entry?.id, result: '0x' });
    const payload = Array.isArray(body) ? body.map(toResult) : toResult(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

test.describe('forum org page', () => {
  test.use({ viewport: LARGE_VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await mockAlchemyRpc(page);
  });

  test('page loads correctly', async ({ page }) => {
    await mockPowersRpc(page, ORG_BASIC);
    await page.goto(ORG_PATH);

    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test.describe('description', () => {
    test('renders the organisation description from metadata', async ({ page }) => {
      await mockOrgMetadata(page);
      await mockPowersRpc(page, ORG_WITH_METADATA);
      await page.goto(ORG_PATH);

      await expect(page.getByText(ORG_DESCRIPTION, { exact: true })).toBeVisible();
    });

    test('falls back to "No description available." when metadata has no description', async ({ page }) => {
      await mockOrgMetadata(page, { description: '' });
      await mockPowersRpc(page, ORG_WITH_METADATA);
      await page.goto(ORG_PATH);

      await expect(page.getByText('No description available.', { exact: true })).toBeVisible();
    });
  });

  test.describe('banner', () => {
    test('renders the organisation banner image', async ({ page }) => {
      await mockOrgMetadata(page);
      await mockPowersRpc(page, ORG_WITH_METADATA);
      await page.goto(ORG_PATH);

      const banner = page.locator('div.aspect-\\[2\\/1\\]');
      await expect(banner).toHaveCSS('background-image', `url("${ORG_BANNER_URL}")`);
    });
  });

  test.describe('header', () => {
    test.beforeEach(async ({ page }) => {
      await mockPowersRpc(page, ORG_BASIC);
    });

    test('shows the organisation name as the header title', async ({ page }) => {
      await mockAuth(page);
      await page.goto(ORG_PATH);

      await expect(page.getByRole('link', { name: 'Powers 101' })).toBeVisible();
    });

    test.describe('connect button', () => {
      test('shows "NOT CONNECTED" when not authenticated', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await expect(page.getByText('NOT CONNECTED', { exact: true })).toBeVisible();
      });

      // The mocked '@privy-io/react-auth' module's login()/connectWallet()
      // are no-ops (see e2e/mocks/privy-react-auth-mock.tsx) - no real Privy
      // modal mounts in this build, so the modal-appearance and
      // wallet/email login success-or-failure checks aren't exercisable
      // through this harness. This only verifies the click is wired up and
      // doesn't crash or navigate away.
      test('clicking "NOT CONNECTED" does not throw or navigate away', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await page.getByText('NOT CONNECTED', { exact: true }).click();

        await expect(page).toHaveURL(ORG_PATH);
        await expect(page.getByText('NOT CONNECTED', { exact: true })).toBeVisible();
      });

      test('shows "CONNECTED" and the wallet address when authenticated', async ({ page }) => {
        await mockAuth(page, { address: '0x3333333333333333333333333333333333333333' });
        await page.goto(ORG_PATH);

        // Scoped to the desktop header - the same "CONNECTED"/"DISCONNECT"
        // text also exists in the off-screen mobile slide-out menu, which
        // would otherwise trip Playwright's strict-mode element-count check.
        const header = page.getByRole('banner');
        await expect(header.getByText('CONNECTED', { exact: true })).toBeVisible();
        await expect(header.getByText('0x3333...3333', { exact: true })).toBeVisible();
        await expect(header.getByText('DISCONNECT', { exact: true })).toBeVisible();
      });
    });

    test.describe('theme toggle', () => {
      test('theme toggle button is visible', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await expect(page.getByRole('button', { name: /switch to (light|dark) mode/i })).toBeVisible();
      });

      test('clicking the theme toggle switches the theme', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        // Headless Chromium defaults to a light color-scheme preference, so
        // next-themes (attribute="class", system-default) starts on light.
        const lightToggle = page.getByRole('button', { name: 'Switch to dark mode' });
        await expect(lightToggle).toBeVisible();
        await expect(page.locator('html')).not.toHaveClass(/dark/);

        await lightToggle.click();

        await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
        await expect(page.locator('html')).toHaveClass(/dark/);
      });
    });

    test.describe('navigation dropdown', () => {
      test('dropdown trigger is visible', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await expect(page.getByText('Main', { exact: true })).toBeVisible();
      });

      test('clicking the trigger opens the dropdown with "All Organisations" and "Profile"', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await page.getByTestId('nav-dropdown-trigger').click();

        await expect(page.getByRole('button', { name: 'All Organisations' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();
      });

      test('clicking "All Organisations" navigates to /forum', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await page.getByTestId('nav-dropdown-trigger').click();
        await page.getByRole('button', { name: 'All Organisations' }).click();

        await expect(page).toHaveURL('/forum');
      });

      test('clicking "Profile" navigates to /forum/profile', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await page.getByTestId('nav-dropdown-trigger').click();
        await page.getByRole('button', { name: 'Profile' }).click();

        await expect(page).toHaveURL('/forum/profile');
      });

      test('lists saved protocols in the dropdown', async ({ page }) => {
        await seedSavedProtocols(page, [SAVED_PROTOCOL]);
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await page.getByTestId('nav-dropdown-trigger').click();

        await expect(page.getByRole('button', { name: SAVED_PROTOCOL.name })).toBeVisible();
      });
    });
  });

  test.describe('mobile header', () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await mockPowersRpc(page, ORG_BASIC);
    });

    // The mobile slide-out menu (app/forum/layout.tsx) is always mounted at
    // this viewport - open/closed is a `translate-x-full`/`translate-x-0`
    // class toggle, not a mount/unmount. Playwright's toBeVisible() only
    // checks display/visibility/opacity/box-size, not viewport intersection,
    // so it would report the (off-screen) drawer contents as visible even
    // while closed. Assert on the class instead for open/closed state.
    function mobileDrawer(page: Page) {
      return page.locator('div.fixed.inset-0.z-50');
    }

    test('collapses the desktop header at small screens', async ({ page }) => {
      await mockAuth(page);
      await page.goto(ORG_PATH);

      await expect(page.getByRole('banner')).not.toBeVisible();
    });

    test('shows the hamburger button at small screens', async ({ page }) => {
      await mockAuth(page);
      await page.goto(ORG_PATH);

      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await expect(mobileDrawer(page)).toHaveClass(/translate-x-full/);
    });

    test.describe('opening the hamburger', () => {
      test('reveals the drawer with "NOT CONNECTED" and the theme toggle when not authenticated', async ({ page }) => {
        await mockAuth(page);
        await page.goto(ORG_PATH);

        await page.getByRole('button', { name: 'Open menu' }).click();

        const drawer = mobileDrawer(page);
        await expect(drawer).toHaveClass(/translate-x-0/);
        await expect(drawer.getByText('NOT CONNECTED - TAP TO LOGIN', { exact: true })).toBeVisible();
        await expect(drawer.getByRole('button', { name: /switch to (light|dark) mode/i })).toBeVisible();
      });

      test('reveals the drawer with "CONNECTED" and "DISCONNECT" when authenticated', async ({ page }) => {
        await mockAuth(page, { address: '0x3333333333333333333333333333333333333333' });
        await page.goto(ORG_PATH);

        await page.getByRole('button', { name: 'Open menu' }).click();

        const drawer = mobileDrawer(page);
        await expect(drawer).toHaveClass(/translate-x-0/);
        await expect(drawer.getByText('CONNECTED', { exact: true })).toBeVisible();
        await expect(drawer.getByText('DISCONNECT', { exact: true })).toBeVisible();
      });
    });

    test('clicking the theme toggle inside the drawer switches the theme', async ({ page }) => {
      await mockAuth(page);
      await page.goto(ORG_PATH);

      await page.getByRole('button', { name: 'Open menu' }).click();

      const drawer = mobileDrawer(page);
      const lightToggle = drawer.getByRole('button', { name: 'Switch to dark mode' });
      await expect(lightToggle).toBeVisible();
      await expect(page.locator('html')).not.toHaveClass(/dark/);

      await lightToggle.click();

      await expect(drawer.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
      await expect(page.locator('html')).toHaveClass(/dark/);
    });
  });

  test.describe('home page', () => {
    test('Actions tab is selected by default', async ({ page }) => {
      await mockAuth(page);
      await mockPowersRpc(page, ORG_BASIC);
      await page.goto(ORG_PATH);

      await expect(page.getByRole('button', { name: 'New Action' })).toBeVisible();
    });

    test.describe('tabs', () => {
      test('shows Actions, Roles, Treasury and Organisation tabs with labels', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_BASIC);
        await page.goto(ORG_PATH);

        const bar = tabBar(page);
        await expect(bar.getByText('Actions', { exact: true })).toBeVisible();
        await expect(bar.getByText('Roles', { exact: true })).toBeVisible();
        await expect(bar.getByText('Treasury', { exact: true })).toBeVisible();
        await expect(bar.getByText('Organisation', { exact: true })).toBeVisible();
      });

      test('switching tabs shows the corresponding panel', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_BASIC);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Roles', { exact: true }).click();
        await expect(page.getByRole('button', { name: 'New Action' })).not.toBeVisible();
      });

      test.describe('on small screens', () => {
        test.use({ viewport: MOBILE_VIEWPORT });

        test('hides tab labels, leaving only icons', async ({ page }) => {
          await mockAuth(page);
          await mockPowersRpc(page, ORG_BASIC);
          await page.goto(ORG_PATH);

          // The label text still exists in the DOM (`hidden sm:inline`) but is
          // not visible - scoped to the tab bar to avoid the mobile-only
          // "current tab" indicator below it, which shows the same text.
          const bar = tabBar(page);
          await expect(bar.getByText('Actions', { exact: true })).not.toBeVisible();
          await expect(bar.locator('button').first()).toBeVisible();
        });
      });
    });

    test.describe('"Overview" link', () => {
      test('is visible and points to the overview/organisation page', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_BASIC);
        await page.goto(ORG_PATH);

        const overviewLink = page.getByRole('link', { name: 'Overview' });
        await expect(overviewLink).toBeVisible();
        await expect(overviewLink).toHaveAttribute(
          'href',
          `/overview/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}/organisation`
        );
      });

      test('navigates to the overview/organisation page when clicked', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_BASIC);
        await page.goto(ORG_PATH);

        await page.getByRole('link', { name: 'Overview' }).click();

        await expect(page).toHaveURL(`/overview/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}/organisation`);
      });

      test.describe('on small screens', () => {
        test.use({ viewport: MOBILE_VIEWPORT });

        test('is hidden', async ({ page }) => {
          await mockAuth(page);
          await mockPowersRpc(page, ORG_BASIC);
          await page.goto(ORG_PATH);

          await expect(page.getByRole('link', { name: 'Overview' })).not.toBeVisible();
        });
      });
    });

    test.describe('Actions tab', () => {
      test('shows a "New Action" button', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_BASIC);
        await page.goto(ORG_PATH);

        await expect(page.getByRole('button', { name: 'New Action' })).toBeVisible();
      });

      test('clicking "New Action" while logged out opens the mandate modal asking to connect a wallet', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(ORG_PATH);

        await page.getByRole('button', { name: 'New Action' }).click();

        const dialog = mandateModal(page);
        await expect(dialog.getByText('Select Mandate', { exact: true })).toBeVisible();
        await expect(dialog.getByText('Connect wallet to see accessible mandates', { exact: true })).toBeVisible();
      });

      test('clicking "New Action" while logged in opens a "Select Mandate" modal', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(ORG_PATH);

        await page.getByRole('button', { name: 'New Action' }).click();

        await expect(mandateModal(page).getByText('Select Mandate', { exact: true })).toBeVisible();
      });

      test.describe('mandate list inside the modal', () => {
        test('lists mandates the user has access to', async ({ page }) => {
          await mockAuth(page, { address: TEST_ADDRESS });
          await mockPowersRpc(page, ORG_WITH_MANDATE, {
            roleGrants: [
              { contractAddress: POWERS_101_ADDRESS, account: TEST_ADDRESS, roleId: MEMBER_ROLE, since: 100n },
            ],
          });
          await page.goto(ORG_PATH);

          await page.getByRole('button', { name: 'New Action' }).click();

          await expect(mandateModal(page).getByText('#1 Mint Tokens', { exact: true })).toBeVisible();
        });

        test('shows "No mandates found for your roles" when the user has no accessible mandates', async ({ page }) => {
          await mockAuth(page, { address: TEST_ADDRESS });
          await mockPowersRpc(page, ORG_WITH_MANDATE);
          await page.goto(ORG_PATH);

          await page.getByRole('button', { name: 'New Action' }).click();

          await expect(
            mandateModal(page).getByText('No mandates found for your roles', { exact: true })
          ).toBeVisible();
        });

        test('clicking a mandate navigates to the new-action page for that mandate', async ({ page }) => {
          await mockAuth(page, { address: TEST_ADDRESS });
          await mockPowersRpc(page, ORG_WITH_MANDATE, {
            roleGrants: [
              { contractAddress: POWERS_101_ADDRESS, account: TEST_ADDRESS, roleId: MEMBER_ROLE, since: 100n },
            ],
          });
          await page.goto(ORG_PATH);

          await page.getByRole('button', { name: 'New Action' }).click();
          await mandateModal(page).getByText('#1 Mint Tokens', { exact: true }).click();

          await expect(page).toHaveURL(`/forum/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}/new?mandateId=1`);
        });
      });

      test.describe('list of previous actions', () => {
        test('shows "No actions found" when the user has no visible actions', async ({ page }) => {
          await mockAuth(page, { address: TEST_ADDRESS });
          await mockPowersRpc(page, ORG_WITH_MANDATE);
          await page.goto(ORG_PATH);

          await expect(page.getByText('No actions found', { exact: true })).toBeVisible();
        });

        test('lists actions the user has access to', async ({ page }) => {
          await mockAuth(page, { address: TEST_ADDRESS });
          await mockPowersRpc(page, ORG_WITH_ACTIONS, {
            roleGrants: [
              { contractAddress: POWERS_101_ADDRESS, account: TEST_ADDRESS, roleId: MEMBER_ROLE, since: 100n },
            ],
          });
          await page.goto(ORG_PATH);

          await expect(desktopActionItem(page).getByText('Mint 100 tokens to treasury', { exact: true })).toBeVisible();
        });

        test('clicking an action navigates to its action page', async ({ page }) => {
          await mockAuth(page, { address: TEST_ADDRESS });
          await mockPowersRpc(page, ORG_WITH_ACTIONS, {
            roleGrants: [
              { contractAddress: POWERS_101_ADDRESS, account: TEST_ADDRESS, roleId: MEMBER_ROLE, since: 100n },
            ],
          });
          await page.goto(ORG_PATH);

          await desktopActionItem(page).getByText('Mint 100 tokens to treasury', { exact: true }).click();

          await expect(page).toHaveURL(`/forum/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}/1`);
        });
      });
    });

    test.describe('Roles tab', () => {
      test('shows a button for each role with its label and id', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(ORG_PATH);
        await tabBar(page).getByText('Roles', { exact: true }).click();

        await expect(page.getByRole('button', { name: /member\s*#1/i })).toBeVisible();
      });

      test('shows "No members found for this role" when the role has no holders', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(ORG_PATH);
        await tabBar(page).getByText('Roles', { exact: true }).click();

        await page.getByRole('button', { name: /member\s*#1/i }).click();

        await expect(page.getByText('No members found for this role', { exact: true })).toBeVisible();
      });

      test('shows a table of holder addresses for a role with members', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_ROLE_HOLDERS);
        await page.goto(ORG_PATH);
        await tabBar(page).getByText('Roles', { exact: true }).click();

        await page.getByRole('button', { name: /member\s*#1/i }).click();

        const table = page.locator('table.w-full.font-mono.text-xs');
        await expect(table.locator('th', { hasText: '#' })).toBeVisible();
        await expect(table.locator('th', { hasText: 'Address' })).toBeVisible();
        await expect(table.getByText(ROLE_HOLDER_PLAIN_ADDRESS, { exact: true })).toBeVisible();
        await expect(table.getByText(ROLE_HOLDER_KNOWN_POWERS_ADDRESS, { exact: true })).toBeVisible();
      });

      test('renders each holder address as a link', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_ROLE_HOLDERS);
        await page.goto(ORG_PATH);
        await tabBar(page).getByText('Roles', { exact: true }).click();

        await page.getByRole('button', { name: /member\s*#1/i }).click();

        await expect(page.getByRole('link', { name: ROLE_HOLDER_PLAIN_ADDRESS })).toBeVisible();
        await expect(page.getByRole('link', { name: ROLE_HOLDER_KNOWN_POWERS_ADDRESS })).toBeVisible();
      });

      test('a holder address matching a known Powers org navigates to that org', async ({ page }) => {
        await seedSavedProtocols(page, [SAVED_PROTOCOL]);
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_ROLE_HOLDERS);
        await page.goto(ORG_PATH);
        await tabBar(page).getByText('Roles', { exact: true }).click();

        await page.getByRole('button', { name: /member\s*#1/i }).click();
        await page.getByRole('link', { name: ROLE_HOLDER_KNOWN_POWERS_ADDRESS }).click();

        await expect(page).toHaveURL(`/forum/${SEPOLIA_CHAIN_ID}/${ROLE_HOLDER_KNOWN_POWERS_ADDRESS}`);
      });

      test('a holder address that is not a Powers org links to the block explorer', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_ROLE_HOLDERS);
        await page.goto(ORG_PATH);
        await tabBar(page).getByText('Roles', { exact: true }).click();

        await page.getByRole('button', { name: /member\s*#1/i }).click();

        const link = page.getByRole('link', { name: ROLE_HOLDER_PLAIN_ADDRESS });
        await expect(link).toHaveAttribute('href', `https://sepolia.etherscan.io/address/${ROLE_HOLDER_PLAIN_ADDRESS}`);
        await expect(link).toHaveAttribute('target', '_blank');
      });
    });

    test.describe('Treasury tab', () => {
      test('shows "No treasury configured" when no treasury is set', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_NO_TREASURY);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Treasury', { exact: true }).click();

        await expect(page.getByText('No treasury configured', { exact: true })).toBeVisible();
      });

      test('shows the treasury address as a link when a treasury is set', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_TREASURY);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Treasury', { exact: true }).click();

        await expect(page.getByText('Treasury Address', { exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: TREASURY_ADDRESS })).toBeVisible();
      });

      test('shows an asset table with the expected columns and the native balance row', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_TREASURY);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Treasury', { exact: true }).click();

        const table = page.locator('table.table-auto.font-mono.text-xs');
        await expect(table.locator('th', { hasText: 'Asset' })).toBeVisible();
        await expect(table.locator('th', { hasText: 'Symbol' })).toBeVisible();
        await expect(table.locator('th', { hasText: 'Address' })).toBeVisible();
        await expect(table.locator('th', { hasText: 'Quantity' })).toBeVisible();
        await expect(table.locator('th', { hasText: 'Value (ETH)' })).toBeVisible();
        await expect(table.locator('th', { hasText: 'Value' }).last()).toBeVisible();

        // viem's sepolia chain definition names the native currency
        // "Sepolia Ether", not "Ether".
        await expect(table.getByText('Sepolia Ether', { exact: true })).toBeVisible();
        await expect(table.getByText('ETH', { exact: true })).toBeVisible();
      });
    });

    test.describe('Organisation tab', () => {
      test('shows the organisation contract address', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_BASIC);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Organisation', { exact: true }).click();

        await expect(page.getByText(POWERS_101_ADDRESS, { exact: true })).toBeVisible();
      });

      test('shows the full organisation description from metadata', async ({ page }) => {
        await mockOrgMetadata(page);
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_METADATA);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Organisation', { exact: true }).click();

        // The truncated banner description above the tab bar is always
        // mounted (not gated by activeTab), so the exact description text
        // exists twice once the Organisation tab adds its own untruncated
        // copy. `.last()` targets the Organisation tab's version.
        await expect(page.getByText(ORG_DESCRIPTION, { exact: true }).last()).toBeVisible();
      });

      test('shows other metadata fields, e.g. the website link', async ({ page }) => {
        await mockOrgMetadata(page, { website: ORG_METADATA_WITH_WEBSITE });
        await mockAuth(page);
        await mockPowersRpc(page, ORG_WITH_METADATA);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Organisation', { exact: true }).click();

        await expect(page.getByRole('link', { name: ORG_METADATA_WITH_WEBSITE })).toBeVisible();
      });

      test('shows "Register XMTP Agent" only for an admin (role 0) user', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_BASIC, {
          roleGrants: [{ contractAddress: POWERS_101_ADDRESS, account: TEST_ADDRESS, roleId: 0n, since: 100n }],
        });
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Organisation', { exact: true }).click();

        await expect(page.getByRole('button', { name: 'Register XMTP Agent' })).toBeVisible();
      });

      test('does not show "Register XMTP Agent" for a non-admin user', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_BASIC);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Organisation', { exact: true }).click();

        await expect(page.getByRole('button', { name: 'Register XMTP Agent' })).not.toBeVisible();
      });

      test('does not show "Register XMTP Agent" when logged out', async ({ page }) => {
        await mockAuth(page);
        await mockPowersRpc(page, ORG_BASIC);
        await page.goto(ORG_PATH);

        await tabBar(page).getByText('Organisation', { exact: true }).click();

        await expect(page.getByRole('button', { name: 'Register XMTP Agent' })).not.toBeVisible();
      });
    });
  });
});
