import { test, expect, type Page } from '@playwright/test';
import { encodeAbiParameters, parseAbiParameters } from 'viem';
import { mockAuth } from './mocks/auth-fixture';
import { mockXmtp } from './mocks/xmtp-fixture';
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

const NEW_ACTION_PATH = `${ORG_PATH}/new?mandateId=1`;

// Same mandate as ORG_WITH_MANDATE plus a param, to exercise DynamicInput
// rendering in the "new action" page's INPUT section.
const ORG_WITH_MANDATE_PARAMS: MockPowersConfig = {
  ...ORG_WITH_MANDATE,
  mandates: [{ ...ORG_WITH_MANDATE.mandates[0], params: [{ varName: 'amount', dataType: 'uint256' }] }],
};

// Distinct values so each rendered condition can be asserted unambiguously
// against the Conditions tab's info grid (new/page.tsx).
const CONDITIONS_QUORUM = 51n;
const CONDITIONS_SUCCEED_AT = 60n;
const CONDITIONS_VOTING_PERIOD = 100n;
const CONDITIONS_TIMELOCK = 50n;

const ORG_WITH_CONDITIONS: MockPowersConfig = {
  ...ORG_WITH_MANDATE,
  mandates: [
    {
      ...ORG_WITH_MANDATE.mandates[0],
      conditions: {
        allowedRole: MEMBER_ROLE,
        quorum: CONDITIONS_QUORUM,
        succeedAt: CONDITIONS_SUCCEED_AT,
        votingPeriod: CONDITIONS_VOTING_PERIOD,
        timelock: CONDITIONS_TIMELOCK,
      },
    },
  ],
};

const FLOW_FIRST_NAME = 'First Mandate';
const FLOW_SECOND_NAME = 'Second Mandate';

// `mandates` is deliberately listed in the *reverse* of the flow's
// mandateIds order, and neither mandate sets needFulfilled/needNotFulfilled
// - SingleFlow.tsx's layout (createSingleFlowLayout) positions nodes purely
// by the Flow struct's mandateIds order, so this fixture proves the Flow
// tab follows that struct rather than mandate insertion order or
// need(Not)Fulfilled conditions.
const ORG_WITH_FLOW: MockPowersConfig = {
  ...ORG_BASIC,
  mandates: [
    { index: 2n, mandateAddress: '0x7777777777777777777777777777777777777777', active: true, nameDescription: `${FLOW_SECOND_NAME}: runs second` },
    { index: 1n, mandateAddress: MINT_MANDATE_ADDRESS, active: true, nameDescription: `${FLOW_FIRST_NAME}: runs first` },
  ],
  flows: [{ nameDescription: 'Mint Flow', mandateIds: [1n, 2n] }],
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

// Chatroom's own Mandate/Flow context switcher (only rendered when the
// mandate is part of a flow) - scoped to this wrapper so its "Flow" button
// isn't confused with the info-tab-nav's "Flow" tab button (tabBar above).
function chatTabSwitcher(page: Page) {
  return page.locator('div.ml-auto.flex.items-center.gap-1.text-xs.font-mono.uppercase.tracking-wider');
}

// Votes tab renders <Vote> and <PastVotes> side by side (page.tsx); both can
// render a "FOR" label (the vote bar vs. a past-vote row), so assertions need
// to be scoped to one or the other rather than the page as a whole.
function voteSection(page: Page) {
  return page.locator('div.lg\\:w-80.flex-shrink-0');
}

function pastVotesSection(page: Page) {
  return page.locator('div.flex-1.min-w-0');
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

  test.describe('new action page', () => {
    test.describe('info tabs', () => {
      test('shows Conditions, Flow and Chat tabs', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        const bar = tabBar(page);
        await expect(bar.getByText('Conditions', { exact: true })).toBeVisible();
        await expect(bar.getByText('Flow', { exact: true })).toBeVisible();
        await expect(bar.getByText('Chat', { exact: true })).toBeVisible();
      });

      test('Conditions tab is selected by default', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        const bar = tabBar(page);
        await expect(bar.getByRole('button', { name: 'Conditions' })).toHaveClass(/border-foreground/);
        await expect(bar.getByRole('button', { name: 'Flow' })).not.toHaveClass(/border-foreground/);
        await expect(bar.getByRole('button', { name: 'Chat' })).not.toHaveClass(/border-foreground/);
      });

      test.describe('on small screens', () => {
        test.use({ viewport: MOBILE_VIEWPORT });

        test('hides tab labels, leaving only icons', async ({ page }) => {
          await mockAuth(page, { address: TEST_ADDRESS });
          await mockPowersRpc(page, ORG_WITH_MANDATE);
          await page.goto(NEW_ACTION_PATH);

          const bar = tabBar(page);
          await expect(bar.getByText('Conditions', { exact: true })).not.toBeVisible();
          await expect(bar.locator('button').first()).toBeVisible();
        });
      });
    });

    test.describe('navigation dropdown', () => {
      test('shows "BACK TO ORGANISATION" instead of the dropdown trigger', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        await expect(page.getByRole('button', { name: 'BACK TO ORGANISATION' })).toBeVisible();
        await expect(page.getByText('Main', { exact: true })).not.toBeVisible();
      });

      test('clicking "BACK TO ORGANISATION" navigates back to the org page', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        await page.getByRole('button', { name: 'BACK TO ORGANISATION' }).click();

        await expect(page).toHaveURL(ORG_PATH);
      });
    });

    test.describe('INPUT section', () => {
      test('shows a Description input on every info tab', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        const bar = tabBar(page);
        await expect(page.getByPlaceholder('Enter description of action (or uri) here.')).toBeVisible();

        await bar.getByText('Flow', { exact: true }).click();
        await expect(page.getByPlaceholder('Enter description of action (or uri) here.')).toBeVisible();

        await bar.getByText('Chat', { exact: true }).click();
        await expect(page.getByPlaceholder('Enter description of action (or uri) here.')).toBeVisible();
      });

      test('shows a Nonce input with a randomize button', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        await expect(page.getByPlaceholder('Enter random number...')).toBeVisible();
      });

      test('shows an input field for each mandate param', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE_PARAMS);
        await page.goto(NEW_ACTION_PATH);

        await expect(page.getByText('amount', { exact: true })).toBeVisible();
        await expect(page.getByPlaceholder('Enter uint256 value here.')).toBeVisible();
      });

      test('shows a "Run Checks" button before checks have been run', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        await expect(page.getByRole('button', { name: 'Run Checks' })).toBeVisible();
      });
    });

    test.describe('running checks', () => {
      test('shows an enabled "Execute Action" button when checks pass', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE, {
          roleGrants: [
            { contractAddress: POWERS_101_ADDRESS, account: TEST_ADDRESS, roleId: MEMBER_ROLE, since: 100n },
          ],
        });
        await page.goto(NEW_ACTION_PATH);

        await page.getByRole('button', { name: 'Run Checks' }).click();

        await expect(page.getByRole('button', { name: 'Run Checks' })).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Execute Action' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Execute Action' })).toBeEnabled();
      });

      test('shows "Cannot submit" with the failed-check reason when checks fail', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        await page.getByRole('button', { name: 'Run Checks' }).click();

        await expect(
          page.getByText('Cannot submit: You are not authorised to perform this action', { exact: true })
        ).toBeVisible();
      });
    });

    test.describe('Conditions tab', () => {
      test("shows the mandate's role, quorum, succeed-at, voting period and timelock", async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_CONDITIONS);
        await page.goto(NEW_ACTION_PATH);

        await expect(page.getByText('Member', { exact: true })).toBeVisible();
        await expect(page.getByText(`${CONDITIONS_QUORUM}%`, { exact: true })).toBeVisible();
        await expect(page.getByText(`${CONDITIONS_SUCCEED_AT}%`, { exact: true })).toBeVisible();
        await expect(page.getByText(`${CONDITIONS_VOTING_PERIOD} blocks`, { exact: true })).toBeVisible();
        await expect(page.getByText(`${CONDITIONS_TIMELOCK} blocks`, { exact: true })).toBeVisible();
      });
    });

    test.describe('Flow tab', () => {
      test("renders the flow's mandates positioned in the Flow struct's mandateIds order", async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_FLOW);
        await page.goto(NEW_ACTION_PATH);

        await tabBar(page).getByText('Flow', { exact: true }).click();

        const flowPane = page.locator('.react-flow');
        await expect(flowPane.locator('.react-flow__node')).toHaveCount(2);

        const firstNode = flowPane.getByText(FLOW_FIRST_NAME, { exact: true });
        const secondNode = flowPane.getByText(FLOW_SECOND_NAME, { exact: true });
        await expect(firstNode).toBeVisible();
        await expect(secondNode).toBeVisible();

        const firstBox = await firstNode.boundingBox();
        const secondBox = await secondNode.boundingBox();
        expect(firstBox).not.toBeNull();
        expect(secondBox).not.toBeNull();
        // mandateIds: [1n, 2n] puts mandate #1 (First Mandate) to the left
        // of mandate #2 (Second Mandate), even though `mandates` above lists
        // them in the opposite order.
        expect(firstBox!.x).toBeLessThan(secondBox!.x);
      });

      test('does not render an overview-style flow group box around the mandates', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_FLOW);
        await page.goto(NEW_ACTION_PATH);

        await tabBar(page).getByText('Flow', { exact: true }).click();

        // The overview's AllFlows/FlowNodes "flowGroup" node wraps mandates
        // in a dashed-border box (div.border-dashed) - SingleFlow.tsx (used
        // here) registers no such node type, so this must be absent.
        await expect(page.locator('.react-flow div.border-dashed')).toHaveCount(0);
      });

      test('clicking a node does not select it or navigate away', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_FLOW);
        await page.goto(NEW_ACTION_PATH);

        await tabBar(page).getByText('Flow', { exact: true }).click();
        await page.locator('.react-flow').getByText(FLOW_FIRST_NAME, { exact: true }).click();

        await expect(page).toHaveURL(NEW_ACTION_PATH);
        await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
      });

      // SingleFlow.tsx sets nodesDraggable={true} alongside
      // elementsSelectable={false} - nodes can be repositioned by dragging
      // even though a plain click (tested above) does nothing.
      test('a node can be dragged to a new position', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_FLOW);
        await page.goto(NEW_ACTION_PATH);

        await tabBar(page).getByText('Flow', { exact: true }).click();

        const node = page.locator('.react-flow').getByText(FLOW_FIRST_NAME, { exact: true });
        const before = await node.boundingBox();
        expect(before).not.toBeNull();

        await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
        await page.mouse.down();
        await page.mouse.move(before!.x + before!.width / 2 + 150, before!.y + before!.height / 2 + 100, { steps: 10 });
        await page.mouse.up();

        const after = await node.boundingBox();
        expect(after).not.toBeNull();
        expect(after!.x).not.toBe(before!.x);
        expect(after!.y).not.toBe(before!.y);
      });
    });

    test.describe('Chat tab', () => {
      test('shows no Mandate/Flow toggle when the mandate is not part of a flow', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_WITH_MANDATE);
        await page.goto(NEW_ACTION_PATH);

        await tabBar(page).getByText('Chat', { exact: true }).click();

        await expect(chatTabSwitcher(page)).toHaveCount(0);
      });

      test('shows a Mandate/Flow toggle when the mandate is part of a flow, and switching tabs changes the chat context', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockXmtp(page, { isConnected: true });
        await mockPowersRpc(page, ORG_WITH_FLOW);
        await page.goto(NEW_ACTION_PATH);

        await tabBar(page).getByText('Chat', { exact: true }).click();

        const switcher = chatTabSwitcher(page);
        await expect(switcher.getByRole('button', { name: 'Mandate' })).toBeVisible();
        await expect(switcher.getByRole('button', { name: 'Flow' })).toBeVisible();

        await expect(
          page.getByText('Join the conversation to start discussing this mandate.', { exact: true })
        ).toBeVisible();

        await switcher.getByRole('button', { name: 'Flow' }).click();

        await expect(
          page.getByText('Join the conversation to start discussing this flow.', { exact: true })
        ).toBeVisible();
      });
    });
  });
});

// `[actionId]/page.tsx` (the action detail page reached by clicking an item
// in the org page's "previous actions" list) - distinct from the org page
// above and the "new action" page covered earlier in this file.
test.describe('forum action detail page', () => {
  test.use({ viewport: LARGE_VIEWPORT, timezoneId: 'UTC' });

  test.beforeEach(async ({ page }) => {
    await mockAlchemyRpc(page);
  });

  // Real Powers actionIds are large hashes, not small ints - long enough to
  // trip ActionOverview's abbreviateActionId() truncation (length > 10).
  const ACTION_ID = '123456789012345678901234567890123456789012345678901234567890';
  const ACTION_ID_TRUNCATED = `${ACTION_ID.slice(0, 8)}...${ACTION_ID.slice(-8)}`;
  const ACTION_DESCRIPTION = 'Mint 250 tokens to treasury';
  const ACTION_NONCE = 42n;

  const AMOUNT_PARAM = { varName: 'amount', dataType: 'uint256' };
  const AMOUNT_VALUE = 250n;
  // Real ABI-encoded callData for the param above - ActionOverview decodes
  // this with decodeAbiParameters, it isn't satisfied by a description string.
  const AMOUNT_CALLDATA = encodeAbiParameters(parseAbiParameters('uint256'), [AMOUNT_VALUE]);

  const ACTION_PATH = `${ORG_PATH}/${ACTION_ID}`;

  const BASE_ACTION: MockMandate['actions'] = [
    { actionId: ACTION_ID, state: 7, description: ACTION_DESCRIPTION, callData: AMOUNT_CALLDATA, nonce: ACTION_NONCE },
  ];

  const ORG_FOR_ACTION_PAGE: MockPowersConfig = {
    ...ORG_WITH_MANDATE,
    mandates: [{ ...ORG_WITH_MANDATE.mandates[0], actions: BASE_ACTION }],
  };

  const ORG_WITH_PARAMS_AND_ACTION: MockPowersConfig = {
    ...ORG_WITH_MANDATE,
    mandates: [{ ...ORG_WITH_MANDATE.mandates[0], params: [AMOUNT_PARAM], actions: BASE_ACTION }],
  };

  const ORG_WITH_QUORUM: MockPowersConfig = {
    ...ORG_WITH_MANDATE,
    mandates: [{
      ...ORG_WITH_MANDATE.mandates[0],
      conditions: { allowedRole: MEMBER_ROLE, quorum: 51n },
      actions: BASE_ACTION,
    }],
  };

  const ORG_WITH_TIMELOCK_ONLY: MockPowersConfig = {
    ...ORG_WITH_MANDATE,
    mandates: [{
      ...ORG_WITH_MANDATE.mandates[0],
      conditions: { allowedRole: MEMBER_ROLE, timelock: 50n },
      actions: BASE_ACTION,
    }],
  };

  const ORG_FOR_CONDITIONS_TAB: MockPowersConfig = {
    ...ORG_WITH_MANDATE,
    mandates: [{
      ...ORG_WITH_MANDATE.mandates[0],
      conditions: {
        allowedRole: MEMBER_ROLE,
        quorum: CONDITIONS_QUORUM,
        succeedAt: CONDITIONS_SUCCEED_AT,
        votingPeriod: CONDITIONS_VOTING_PERIOD,
        timelock: CONDITIONS_TIMELOCK,
      },
      actions: BASE_ACTION,
    }],
  };

  // Mirrors ORG_WITH_FLOW (above, used by the "new action page" Flow tab
  // tests) but attaches BASE_ACTION to mandate #1 so /forum/.../[actionId]
  // can resolve this action - [actionId]/page.tsx's lookup (mandates[].actions)
  // requires this to render anything at all.
  const ORG_FOR_ACTION_FLOW_PAGE: MockPowersConfig = {
    ...ORG_BASIC,
    mandates: [
      { index: 2n, mandateAddress: '0x7777777777777777777777777777777777777777', active: true, nameDescription: `${FLOW_SECOND_NAME}: runs second` },
      { index: 1n, mandateAddress: MINT_MANDATE_ADDRESS, active: true, nameDescription: `${FLOW_FIRST_NAME}: runs first`, actions: BASE_ACTION },
    ],
    flows: [{ nameDescription: 'Mint Flow', mandateIds: [1n, 2n] }],
  };

  // blockNumber is pinned to 0x64 (100) by mockPowersRpc (frontend/e2e/mocks/powers-rpc.ts)
  // - chosen so proposedAt + votingPeriod/timelock both resolve to *past*
  // blocks, which Timeline.tsx formats directly via formatBlockNumberOrTimestamp
  // rather than the separate (approximate) "future date" estimator.
  const TIMELINE_PROPOSED_AT = 50n;
  const TIMELINE_VOTING_PERIOD = 30n; // voteEndBlock = 80, still <= 100
  const TIMELINE_TIMELOCK = 20n; // delayEndBlock = 70, still <= 100
  const TIMELINE_REQUESTED_AT = 85n;
  const TIMELINE_FULFILLED_AT = 95n;

  const ORG_FOR_TIMELINE_TAB: MockPowersConfig = {
    ...ORG_WITH_MANDATE,
    mandates: [{
      ...ORG_WITH_MANDATE.mandates[0],
      conditions: {
        allowedRole: MEMBER_ROLE,
        quorum: 51n,
        votingPeriod: TIMELINE_VOTING_PERIOD,
        timelock: TIMELINE_TIMELOCK,
      },
      actions: [{
        actionId: ACTION_ID,
        state: 7,
        description: ACTION_DESCRIPTION,
        proposedAt: TIMELINE_PROPOSED_AT,
        requestedAt: TIMELINE_REQUESTED_AT,
        fulfilledAt: TIMELINE_FULFILLED_AT,
      }],
    }],
  };

  // Mirrors mockPowersRpc's deterministic fake block timestamps
  // (1700000000n + blockNumber * 60n) and Timeline.tsx's formatting
  // (toFullDateFormat + toEurTimeFormat) - computed with UTC getters so it
  // matches the browser regardless of the host machine's local timezone
  // (the describe block above pins the browser itself to timezoneId: 'UTC').
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function expectedTimelineValue(blockNumber: bigint): string {
    const timestamp = 1700000000n + blockNumber * 60n;
    const date = new Date(Number(timestamp) * 1000);
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ${date.getUTCHours()}:${minutes}`;
  }

  test.describe('tabs', () => {
    test('shows Action, Conditions, Timeline, Execution, Flow and Chat tabs', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      const bar = tabBar(page);
      await expect(bar.getByText('Action', { exact: true })).toBeVisible();
      await expect(bar.getByText('Conditions', { exact: true })).toBeVisible();
      await expect(bar.getByText('Timeline', { exact: true })).toBeVisible();
      await expect(bar.getByText('Execution', { exact: true })).toBeVisible();
      await expect(bar.getByText('Flow', { exact: true })).toBeVisible();
      await expect(bar.getByText('Chat', { exact: true })).toBeVisible();
      await expect(bar.getByText('Votes', { exact: true })).not.toBeVisible();
      await expect(bar.getByText('Timelock', { exact: true })).not.toBeVisible();
    });

    test('shows an optional Votes tab when the mandate has quorum conditions', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_WITH_QUORUM);
      await page.goto(ACTION_PATH);

      await expect(tabBar(page).getByText('Votes', { exact: true })).toBeVisible();
    });

    test('shows an optional Timelock tab when the mandate has a timelock and no quorum', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_WITH_TIMELOCK_ONLY);
      await page.goto(ACTION_PATH);

      await expect(tabBar(page).getByText('Timelock', { exact: true })).toBeVisible();
    });

    test('Action tab is selected by default', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      const bar = tabBar(page);
      await expect(bar.getByRole('button', { name: 'Action' })).toHaveClass(/border-foreground/);
      await expect(page.getByText('Action ID', { exact: true })).toBeVisible();
    });

    test.describe('on small screens', () => {
      test.use({ viewport: MOBILE_VIEWPORT });

      test('hides tab labels, leaving only icons', async ({ page }) => {
        await mockAuth(page, { address: TEST_ADDRESS });
        await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
        await page.goto(ACTION_PATH);

        const bar = tabBar(page);
        await expect(bar.getByText('Action', { exact: true })).not.toBeVisible();
        await expect(bar.locator('button').first()).toBeVisible();
      });
    });
  });

  test.describe('navigation dropdown', () => {
    test('shows "BACK TO ORGANISATION" instead of the dropdown trigger', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      await expect(page.getByRole('button', { name: 'BACK TO ORGANISATION' })).toBeVisible();
      await expect(page.getByText('Main', { exact: true })).not.toBeVisible();
    });

    test('clicking "BACK TO ORGANISATION" navigates back to the org page', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      await page.getByRole('button', { name: 'BACK TO ORGANISATION' }).click();

      await expect(page).toHaveURL(ORG_PATH);
    });
  });

  test.describe('Action tab', () => {
    test('shows Description, Action ID and Input Data sections', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      await expect(page.getByText('Description', { exact: true })).toBeVisible();
      await expect(page.getByText('Action ID', { exact: true })).toBeVisible();
      await expect(page.getByText('Input Data', { exact: true })).toBeVisible();
    });

    test('shows the action description', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      await expect(page.getByText(ACTION_DESCRIPTION, { exact: true })).toBeVisible();
    });

    test('shows the action ID truncated', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      const idText = page.getByText(ACTION_ID_TRUNCATED, { exact: true });
      await expect(idText).toBeVisible();
      await expect(idText).toHaveAttribute('title', ACTION_ID);
    });

    test('shows a nonce field in Input Data', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      await expect(page.getByText('nonce', { exact: true })).toBeVisible();
      await expect(page.getByText('(uint256)', { exact: true })).toBeVisible();
      await expect(page.getByText(ACTION_NONCE.toString(), { exact: true })).toBeVisible();
    });

    test('shows a decoded field for each mandate param', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_WITH_PARAMS_AND_ACTION);
      await page.goto(ACTION_PATH);

      await expect(page.getByText('amount', { exact: true })).toBeVisible();
      await expect(page.getByText(AMOUNT_VALUE.toString(), { exact: true })).toBeVisible();
    });
  });

  test.describe('Conditions tab', () => {
    test("shows the mandate's role, quorum, succeed-at, voting period and timelock", async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_CONDITIONS_TAB);
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Conditions', { exact: true }).click();

      await expect(page.getByText('Member', { exact: true })).toBeVisible();
      await expect(page.getByText(`${CONDITIONS_QUORUM}%`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${CONDITIONS_SUCCEED_AT}%`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${CONDITIONS_VOTING_PERIOD} blocks`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${CONDITIONS_TIMELOCK} blocks`, { exact: true })).toBeVisible();
    });
  });

  test.describe('Timeline tab', () => {
    test('shows the dates and times of each state change', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_TIMELINE_TAB);
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Timeline', { exact: true }).click();

      await expect(page.getByText('Proposed', { exact: true })).toBeVisible();
      await expect(page.getByText(expectedTimelineValue(TIMELINE_PROPOSED_AT), { exact: true })).toBeVisible();

      await expect(page.getByText('Vote End', { exact: true })).toBeVisible();
      await expect(
        page.getByText(expectedTimelineValue(TIMELINE_PROPOSED_AT + TIMELINE_VOTING_PERIOD), { exact: true })
      ).toBeVisible();

      await expect(page.getByText('Delay End', { exact: true })).toBeVisible();
      await expect(
        page.getByText(expectedTimelineValue(TIMELINE_PROPOSED_AT + TIMELINE_TIMELOCK), { exact: true })
      ).toBeVisible();

      await expect(page.getByText('Requested', { exact: true })).toBeVisible();
      await expect(page.getByText(expectedTimelineValue(TIMELINE_REQUESTED_AT), { exact: true })).toBeVisible();

      await expect(page.getByText('Fulfilled', { exact: true })).toBeVisible();
      await expect(page.getByText(expectedTimelineValue(TIMELINE_FULFILLED_AT), { exact: true })).toBeVisible();
    });
  });

  test.describe('Votes tab', () => {
    // Mirrors Vote.tsx's own quorum/threshold math: roleHolders comes from
    // roles[].holders.length, not a literal "amount" field.
    const VOTE_ROLE_HOLDERS = [
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '0xcccccccccccccccccccccccccccccccccccccccc',
      '0xdddddddddddddddddddddddddddddddddddddddd',
    ];

    const VOTE_CONDITIONS = { allowedRole: MEMBER_ROLE, quorum: 50n, succeedAt: 50n, votingPeriod: 30n };

    test('shows the correct vote stats', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, {
        ...ORG_WITH_MANDATE,
        mandates: [{
          ...ORG_WITH_MANDATE.mandates[0],
          conditions: VOTE_CONDITIONS,
          // state: 5 (Succeeded) - voting has ended, so Vote.tsx renders the
          // results breakdown rather than the active-voting status display.
          actions: [{ actionId: ACTION_ID, state: 5, description: ACTION_DESCRIPTION, proposedAt: 50n, forVotes: 3n, againstVotes: 1n, abstainVotes: 0n }],
        }],
        roles: [{ roleId: MEMBER_ROLE, label: 'member', holders: VOTE_ROLE_HOLDERS }],
      });
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Votes', { exact: true }).click();

      const section = voteSection(page);
      await expect(section.getByText('Vote Results', { exact: true })).toBeVisible();
      // 3 for + 1 against + 0 abstain cast out of 4 role holders.
      await expect(section.getByText('4/4 votes cast', { exact: true })).toBeVisible();
      // Quorum Reached: (forVotes + abstainVotes) / quorum, where quorum = ceil(4 * 50%) = 2.
      await expect(section.getByText('3 / 2', { exact: true })).toBeVisible();
      await expect(section.getByText('PASSED', { exact: true })).toBeVisible();
    });

    test('shows vote buttons when the user has not voted yet', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, {
        ...ORG_WITH_MANDATE,
        mandates: [{
          ...ORG_WITH_MANDATE.mandates[0],
          conditions: VOTE_CONDITIONS,
          // state: 3 (Active); proposedAt + votingPeriod (120) is still ahead
          // of the mock's pinned block (100), so voting hasn't ended yet.
          actions: [{ actionId: ACTION_ID, state: 3, description: ACTION_DESCRIPTION, proposedAt: 90n, hasVoted: false }],
        }],
        roles: [{ roleId: MEMBER_ROLE, label: 'member', holders: VOTE_ROLE_HOLDERS }],
      });
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Votes', { exact: true }).click();

      const section = voteSection(page);
      await expect(section.getByRole('button', { name: 'FOR' })).toBeVisible();
      await expect(section.getByRole('button', { name: 'AGAINST' })).toBeVisible();
      await expect(section.getByRole('button', { name: 'ABSTAIN' })).toBeVisible();
    });

    test('shows an "already voted" message instead of vote buttons once the user has voted', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, {
        ...ORG_WITH_MANDATE,
        mandates: [{
          ...ORG_WITH_MANDATE.mandates[0],
          conditions: VOTE_CONDITIONS,
          // callData/nonce present so Vote.tsx's checks-fetch effect (gated on
          // action.callData) actually runs and populates checks.hasVoted.
          actions: [{ actionId: ACTION_ID, state: 3, description: ACTION_DESCRIPTION, proposedAt: 90n, hasVoted: true, callData: AMOUNT_CALLDATA, nonce: ACTION_NONCE }],
        }],
        roles: [{ roleId: MEMBER_ROLE, label: 'member', holders: VOTE_ROLE_HOLDERS }],
      });
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Votes', { exact: true }).click();

      const section = voteSection(page);
      await expect(section.getByText('You have already voted on this action', { exact: true })).toBeVisible();
      await expect(section.getByRole('button', { name: 'FOR' })).not.toBeVisible();
    });

    test('shows an execute button once the vote has succeeded', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, {
        ...ORG_WITH_MANDATE,
        mandates: [{
          ...ORG_WITH_MANDATE.mandates[0],
          conditions: VOTE_CONDITIONS,
          // callData/nonce present so the page's automatic checks-fetch has
          // something to run against and can flip "Run checks" to "Execute".
          actions: [{ actionId: ACTION_ID, state: 5, description: ACTION_DESCRIPTION, proposedAt: 50n, callData: AMOUNT_CALLDATA, nonce: ACTION_NONCE, forVotes: 3n, againstVotes: 1n }],
        }],
        roles: [{ roleId: MEMBER_ROLE, label: 'member', holders: VOTE_ROLE_HOLDERS }],
      });
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Votes', { exact: true }).click();

      await expect(voteSection(page).getByRole('button', { name: /Execute/ })).toBeVisible();
    });

    test('shows past votes with the voter, choice and reason', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, {
        ...ORG_WITH_MANDATE,
        mandates: [{
          ...ORG_WITH_MANDATE.mandates[0],
          conditions: VOTE_CONDITIONS,
          actions: [{
            actionId: ACTION_ID,
            state: 5,
            description: ACTION_DESCRIPTION,
            proposedAt: 50n,
            votes: [{ account: TEST_ADDRESS, support: 1, reason: 'Looks good to me', blockNumber: 55n }],
          }],
        }],
      });
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Votes', { exact: true }).click();

      const section = pastVotesSection(page);
      await expect(section.getByText('Past Votes (1)', { exact: true })).toBeVisible();
      await expect(section.getByText('FOR', { exact: true })).toBeVisible();
      await expect(section.getByText('"Looks good to me"', { exact: true })).toBeVisible();
    });
  });

  test.describe('Timelock tab', () => {
    // Mirrors calculateTimelockRemaining (public/organisations/helpers.ts)
    // using Sepolia's BLOCKS_PER_HOUR (context/constants.ts) - same pattern
    // as expectedTimelineValue above, computed independently of the
    // component rather than asserting a hardcoded guess.
    function expectedTimelockRemaining(blocksRemaining: number): string {
      const BLOCKS_PER_HOUR = 300;
      const minutesRemaining = (blocksRemaining * 60) / BLOCKS_PER_HOUR;
      const days = Math.floor(minutesRemaining / (60 * 24));
      const hours = Math.floor((minutesRemaining % (60 * 24)) / 60);
      const minutes = Math.floor(minutesRemaining % 60);
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
      return parts.join(' ');
    }

    test('shows the time remaining until execution is allowed', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, {
        ...ORG_WITH_MANDATE,
        mandates: [{
          ...ORG_WITH_MANDATE.mandates[0],
          conditions: { allowedRole: MEMBER_ROLE, timelock: 50n },
          // proposedAt + timelock (130) is still ahead of the pinned mock
          // block (100) - 30 blocks remaining.
          actions: [{ actionId: ACTION_ID, state: 3, description: ACTION_DESCRIPTION, proposedAt: 80n }],
        }],
      });
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Timelock', { exact: true }).click();

      await expect(page.getByText('Ready to Execute', { exact: true })).not.toBeVisible();
      await expect(page.getByText(`${expectedTimelockRemaining(30)} remaining`, { exact: true })).toBeVisible();
    });

    test('shows an execute button once the timelock has passed', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, {
        ...ORG_WITH_MANDATE,
        mandates: [{
          ...ORG_WITH_MANDATE.mandates[0],
          conditions: { allowedRole: MEMBER_ROLE, timelock: 20n },
          // proposedAt + timelock (50) is behind the pinned mock block (100).
          actions: [{ actionId: ACTION_ID, state: 5, description: ACTION_DESCRIPTION, proposedAt: 30n, callData: AMOUNT_CALLDATA, nonce: ACTION_NONCE }],
        }],
      });
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Timelock', { exact: true }).click();

      await expect(page.getByText('Ready to Execute', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Execute/ })).toBeVisible();
    });
  });

  test.describe('Flow tab', () => {
    test("renders the flow's mandates positioned in the Flow struct's mandateIds order", async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_FLOW_PAGE);
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Flow', { exact: true }).click();

      const flowPane = page.locator('.react-flow');
      await expect(flowPane.locator('.react-flow__node')).toHaveCount(2);

      const firstNode = flowPane.getByText(FLOW_FIRST_NAME, { exact: true });
      const secondNode = flowPane.getByText(FLOW_SECOND_NAME, { exact: true });
      await expect(firstNode).toBeVisible();
      await expect(secondNode).toBeVisible();

      const firstBox = await firstNode.boundingBox();
      const secondBox = await secondNode.boundingBox();
      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      // mandateIds: [1n, 2n] puts mandate #1 (First Mandate) to the left
      // of mandate #2 (Second Mandate), regardless of `mandates` order.
      expect(firstBox!.x).toBeLessThan(secondBox!.x);
    });

    test('does not render an overview-style flow group box around the mandates', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_FLOW_PAGE);
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Flow', { exact: true }).click();

      // SingleFlow.tsx (used here) registers no "flowGroup" node type, so
      // the overview's dashed-border wrapper box must be absent.
      await expect(page.locator('.react-flow div.border-dashed')).toHaveCount(0);
    });

    test('a node can be dragged to a new position but clicking it does not select it or navigate away', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_FLOW_PAGE);
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Flow', { exact: true }).click();

      const node = page.locator('.react-flow').getByText(FLOW_FIRST_NAME, { exact: true });

      await node.click();
      await expect(page).toHaveURL(ACTION_PATH);
      await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);

      const before = await node.boundingBox();
      expect(before).not.toBeNull();

      await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
      await page.mouse.down();
      await page.mouse.move(before!.x + before!.width / 2 + 150, before!.y + before!.height / 2 + 100, { steps: 10 });
      await page.mouse.up();

      const after = await node.boundingBox();
      expect(after).not.toBeNull();
      expect(after!.x).not.toBe(before!.x);
      expect(after!.y).not.toBe(before!.y);
    });
  });

  // Chatroom's mandate/flow context switcher (chatTabSwitcher, defined near
  // the top of this file) - same component as the "new action page" Chat
  // tab tests above. Note: message content/send/receive is NOT exercised
  // here - e2e/mocks/xmtp-client-mock.tsx always returns `client: null`, and
  // every send/receive call site in Chatroom.tsx is guarded by `if (!client)
  // return`, so actual conversation exchange would require a live XMTP
  // network rather than this mock.
  test.describe('Chat tab', () => {
    test('shows no Mandate/Flow toggle when the mandate is not part of a flow', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockPowersRpc(page, ORG_FOR_ACTION_PAGE);
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Chat', { exact: true }).click();

      await expect(chatTabSwitcher(page)).toHaveCount(0);
    });

    test('shows a Mandate/Flow toggle when the mandate is part of a flow, and switching tabs changes the chat context', async ({ page }) => {
      await mockAuth(page, { address: TEST_ADDRESS });
      await mockXmtp(page, { isConnected: true });
      await mockPowersRpc(page, ORG_FOR_ACTION_FLOW_PAGE);
      await page.goto(ACTION_PATH);

      await tabBar(page).getByText('Chat', { exact: true }).click();

      const switcher = chatTabSwitcher(page);
      await expect(switcher.getByRole('button', { name: 'Mandate' })).toBeVisible();
      await expect(switcher.getByRole('button', { name: 'Flow' })).toBeVisible();

      await expect(
        page.getByText('Join the conversation to start discussing this mandate.', { exact: true })
      ).toBeVisible();

      await switcher.getByRole('button', { name: 'Flow' }).click();

      await expect(
        page.getByText('Join the conversation to start discussing this flow.', { exact: true })
      ).toBeVisible();
    });
  });
});
