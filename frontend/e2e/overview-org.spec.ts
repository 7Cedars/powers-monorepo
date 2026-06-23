import { test, expect, type Page } from '@playwright/test';
import { mockPowersRpc, type MockPowersConfig, type MockMandate } from './mocks/powers-rpc';

const PUBLIC_ROLE_ID = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

const SEPOLIA_CHAIN_ID = '11155111';
const POWERS_101_ADDRESS = '0x7EF3396E64BcdF5b58dE2A097BC5b72712059098';
const ORG_PATH = `/overview/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}`;
const NAV_LABELS = ['Actions', 'Mandates', 'Flows', 'Roles', 'Treasury', 'Organisation'];

const MINT_MANDATE_ADDRESS = '0x1111111111111111111111111111111111111111';
const MEMBER_MANDATE_ADDRESS = '0x2222222222222222222222222222222222222222';

// A small, synthetic org fixture (not a faithful Powers101 reproduction) —
// just enough mandates/actions to exercise every branch of the Actions tab.
const ORG_WITH_ACTIONS: MockPowersConfig = {
  contractAddress: POWERS_101_ADDRESS,
  name: 'Powers 101',
  mandates: [
    {
      index: 1n,
      mandateAddress: MINT_MANDATE_ADDRESS,
      active: true,
      nameDescription: 'Mint Tokens',
      conditions: { allowedRole: 1n },
      params: [
        { varName: 'to', dataType: 'address' },
        { varName: 'amount', dataType: 'uint256' },
      ],
      actions: [
        {
          actionId: '1',
          state: 7,
          proposedAt: 100n,
          fulfilledAt: 110n,
          description: 'Mint 100 tokens to treasury',
          caller: '0x3333333333333333333333333333333333333333',
        },
        { actionId: '2', state: 1, proposedAt: 200n },
        { actionId: '3', state: 2, proposedAt: 300n, cancelledAt: 310n },
      ],
    },
    {
      index: 2n,
      mandateAddress: MEMBER_MANDATE_ADDRESS,
      active: true,
      nameDescription: 'Assign Member Role',
    },
  ],
};

const FLOW_MANDATES: MockMandate[] = [
  {
    index: 1n,
    mandateAddress: MINT_MANDATE_ADDRESS,
    active: true,
    nameDescription: 'Mint Tokens',
    conditions: { allowedRole: 0n },
  },
  {
    index: 2n,
    mandateAddress: MEMBER_MANDATE_ADDRESS,
    active: true,
    nameDescription: 'Assign Member Role',
    conditions: { allowedRole: 0n },
  },
];

// A small, synthetic org fixture exercising the Flows tab: one flow grouping
// the two mandates above.
const ORG_WITH_FLOWS: MockPowersConfig = {
  contractAddress: POWERS_101_ADDRESS,
  name: 'Powers 101',
  mandates: FLOW_MANDATES,
  flows: [{ nameDescription: 'Onboarding: Mint and assign role', mandateIds: [1n, 2n] }],
};

// A small, synthetic org fixture exercising the Roles tab. Roles are derived
// by usePowers from active mandates' `conditions.allowedRole`, so each role
// below is backed by a mandate granting it.
const MEMBER_HOLDER_1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const MEMBER_HOLDER_2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const OPEN_ACTION_MANDATE_ADDRESS = '0x4444444444444444444444444444444444444444';

const ORG_WITH_ROLES: MockPowersConfig = {
  contractAddress: POWERS_101_ADDRESS,
  name: 'Powers 101',
  mandates: [
    {
      index: 1n,
      mandateAddress: MINT_MANDATE_ADDRESS,
      active: true,
      nameDescription: 'Mint Tokens',
      conditions: { allowedRole: 1n },
    },
    {
      index: 2n,
      mandateAddress: MEMBER_MANDATE_ADDRESS,
      active: true,
      nameDescription: 'Assign Member Role',
      conditions: { allowedRole: 2n },
    },
    {
      index: 3n,
      mandateAddress: OPEN_ACTION_MANDATE_ADDRESS,
      active: true,
      nameDescription: 'Open Action',
      conditions: { allowedRole: PUBLIC_ROLE_ID },
    },
  ],
  roles: [
    { roleId: 1n, label: 'member', holders: [MEMBER_HOLDER_1, MEMBER_HOLDER_2] },
    { roleId: 2n, label: 'auditor', holders: [] },
    { roleId: PUBLIC_ROLE_ID, label: 'public' },
  ],
};

// A small, synthetic org fixture exercising the Treasury tab.
const TREASURY_ADDRESS = '0x5555555555555555555555555555555555555555';
const PAYMASTER_ADDRESS = '0x6666666666666666666666666666666666666666';

const ORG_WITH_TREASURY: MockPowersConfig = {
  contractAddress: POWERS_101_ADDRESS,
  name: 'Powers 101',
  mandates: [],
  treasury: TREASURY_ADDRESS,
  paymaster: PAYMASTER_ADDRESS,
  nativeBalance: 1_000000000000000000n,
};

// A small, synthetic org fixture exercising the Organisation tab. `uri`
// points at a fake metadata endpoint that the test mocks via page.route;
// parseMetadata() (utils/parsers.ts) requires every one of these keys to be
// present or it throws and drops the metadata entirely.
const ORG_METADATA_URI = 'https://example.com/powers-101-metadata.json';
const ORG_DESCRIPTION = 'A description of the test organisation.';

// No `uri` set, so fetchMetaData() never attempts an outbound fetch — use
// this for tests that don't care about the About/description metadata.
const ORG_BASIC: MockPowersConfig = {
  contractAddress: POWERS_101_ADDRESS,
  name: 'Powers 101',
  mandates: [],
};

const ORG_WITH_METADATA: MockPowersConfig = {
  ...ORG_BASIC,
  uri: ORG_METADATA_URI,
};

async function mockOrgMetadata(page: Page) {
  await page.route(ORG_METADATA_URI, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        icon: '',
        banner: '',
        website: '',
        codeOfConduct: '',
        disputeResolution: '',
        xmtpAgentAddress: undefined,
        communicationChannels: {},
        attributes: [],
        description: ORG_DESCRIPTION,
      }),
    });
  });
}

// app/overview/layout.tsx switches between the "too small" warning and the
// full dashboard at Tailwind's `lg` breakpoint (1024px min-width, default
// config - no override in tailwind.config.ts).
const SMALL_VIEWPORT = { width: 800, height: 800 };
const LARGE_VIEWPORT = { width: 1280, height: 900 };

async function mockAlchemyRpc(page: Page) {
  // Same pattern as overview-index.spec.ts: navigating straight to an
  // org's page triggers a live fetchPowers() RPC call. Stub Alchemy so it
  // resolves instantly instead of racing test teardown.
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

function panelLocator(page: Page) {
  return page.locator('[help-nav-item="right-panel"]');
}

test.describe('overview org dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAlchemyRpc(page);
  });

  test('page loads correctly', async ({ page }) => {
    await page.goto(`${ORG_PATH}/organisation`);

    await expect(page.locator('main').first()).toBeVisible();
    for (const label of NAV_LABELS) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test.describe('small screens', () => {
    test.use({ viewport: SMALL_VIEWPORT });

    test('shows the "not optimized for small screens" warning', async ({ page }) => {
      await page.goto(`${ORG_PATH}/organisation`);

      await expect(page.getByText('Not optimized for small screens', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Organisation' })).not.toBeVisible();
    });

    test('the return button navigates back to the forum page for this org', async ({ page }) => {
      await page.goto(`${ORG_PATH}/organisation`);

      const backLink = page.getByRole('link', { name: /back to forum/i });
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute('href', `/forum/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}`);

      await backLink.click();
      await expect(page).toHaveURL(`/forum/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}`);
    });
  });

  test.describe('large screens', () => {
    test.use({ viewport: LARGE_VIEWPORT });

    test('the top-level org url redirects to the organisation tab', async ({ page }) => {
      await page.goto(ORG_PATH);

      await expect(page).toHaveURL(`${ORG_PATH}/organisation`);
    });

    test('the side panel is visible with all nav tabs', async ({ page }) => {
      await page.goto(`${ORG_PATH}/organisation`);

      await expect(panelLocator(page)).toBeVisible();
      for (const label of NAV_LABELS) {
        await expect(page.getByRole('button', { name: label })).toBeVisible();
      }
    });

    test('the collapse/expand button toggles the side panel', async ({ page }) => {
      await page.goto(`${ORG_PATH}/organisation`);

      const panel = panelLocator(page);
      const expandedWidth = await panel.evaluate((el) => el.getBoundingClientRect().width);

      await page.getByRole('button', { name: 'Collapse panel' }).click();
      await expect(panel).toHaveCSS('width', '36px');

      await page.getByRole('button', { name: 'Expand panel' }).click();
      await expect.poll(async () => panel.evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(expandedWidth, 0);
    });

    test('dragging the panel border resizes the panel', async ({ page }) => {
      await page.goto(`${ORG_PATH}/organisation`);

      const panel = panelLocator(page);
      const initialWidth = await panel.evaluate((el) => el.getBoundingClientRect().width);

      const handle = page.locator('[title="Drag to resize panel"]');
      const handleBox = await handle.boundingBox();
      expect(handleBox).not.toBeNull();

      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - 150, startY, { steps: 10 });
      await page.mouse.up();

      const resizedWidth = await panel.evaluate((el) => el.getBoundingClientRect().width);
      expect(resizedWidth).toBeGreaterThan(initialWidth + 100);
    });
  });

  test.describe('actions tab', () => {
    test.use({ viewport: LARGE_VIEWPORT });

    function bannerTitle(page: Page) {
      return page.locator('p', { hasText: /^Actions$/ });
    }

    test('shows the page title', async ({ page }) => {
      await page.goto(`${ORG_PATH}/actions`);

      await expect(bannerTitle(page)).toBeVisible();
    });

    test('shows "No actions found" when the org has no mandates/actions', async ({ page }) => {
      await page.goto(`${ORG_PATH}/actions`);

      await expect(page.getByText('No actions found', { exact: true })).toBeVisible();
    });

    test.describe('with actions present', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_ACTIONS);
        await page.goto(`${ORG_PATH}/actions`);
        // Date cells depend on a resolved block timestamp.
        await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 15_000 });
      });

      test('the table allows for horizontal scrolling', async ({ page }) => {
        const scrollContainer = page.locator('.overflow-x-auto').filter({ has: page.locator('table') });
        await expect(scrollContainer).toHaveCSS('overflow-x', 'auto');
      });

      test('renders all columns with data for each action', async ({ page }) => {
        for (const header of ['Date', 'Action ID', 'Mandate', 'Description', 'Status']) {
          await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
        }

        const fulfilledRow = page.locator('tbody tr').filter({ hasText: 'Mint 100' });
        await expect(fulfilledRow).toBeVisible();
        await expect(fulfilledRow.locator('td').nth(0)).not.toHaveText('—');
        await expect(fulfilledRow.locator('td').nth(1)).toContainText('...');
        await expect(fulfilledRow.locator('td').nth(2)).toHaveText('Mint Tokens');
        await expect(fulfilledRow.locator('td').nth(3)).toContainText('Mint 100');
        await expect(fulfilledRow.locator('td').nth(4)).toHaveText('Fulfilled');

        const proposedRow = page.locator('tbody tr').filter({ hasText: 'Proposed' });
        await expect(proposedRow.locator('td').nth(3)).toHaveText('—');
      });

      test('clicking a row navigates to the sub-level action page', async ({ page }) => {
        const fulfilledRow = page.locator('tbody tr').filter({ hasText: 'Mint 100' });
        await fulfilledRow.click();

        await expect(page).toHaveURL(`${ORG_PATH}/actions/1`);
      });
    });

    test.describe('sub-level action page', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_ACTIONS);
        await page.goto(`${ORG_PATH}/actions/1`);
      });

      test('shows the title and the back button', async ({ page }) => {
        const title = page.getByText('Action', { exact: true });
        await expect(title).toBeVisible();
        await expect(title.locator('xpath=following-sibling::p[1]')).toHaveText('1');

        const backButton = page.getByRole('button', { name: 'ALL ACTIONS' });
        await expect(backButton).toBeVisible();
        await backButton.click();
        await expect(page).toHaveURL(`${ORG_PATH}/actions`);
      });

      test('shows an Inputs component listing the mandate params', async ({ page }) => {
        await expect(page.getByText('Inputs', { exact: true })).toBeVisible();
        await expect(page.getByText('to', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('amount', { exact: true }).first()).toBeVisible();
      });

      test('shows an Action State component with state-change timestamps', async ({ page }) => {
        await expect(page.getByText('Action State', { exact: true })).toBeVisible();
        await expect(page.getByText('#1 Mint Tokens').first()).toBeVisible();
        await expect(page.getByText('Fulfilled', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Proposed', { exact: true }).first()).toBeVisible();
      });
    });
  });

  test.describe('mandates tab', () => {
    test.use({ viewport: LARGE_VIEWPORT });

    function bannerTitle(page: Page) {
      return page.locator('p', { hasText: /^Mandates$/ });
    }

    test('shows the page title', async ({ page }) => {
      await page.goto(`${ORG_PATH}/mandates`);

      await expect(bannerTitle(page)).toBeVisible();
    });

    test('shows "No active mandates found" when the org has no mandates', async ({ page }) => {
      await page.goto(`${ORG_PATH}/mandates`);

      await expect(page.getByRole('main').getByText('No active mandates found', { exact: true })).toBeVisible();
    });

    test.describe('with mandates present', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_ACTIONS);
        await page.goto(`${ORG_PATH}/mandates`);
      });

      test('renders all columns with data for each mandate', async ({ page }) => {
        for (const header of ['ID', 'Name', 'Description', 'Role', 'Contract Address']) {
          await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
        }

        const mintRow = page.locator('tbody tr').filter({ hasText: 'Mint Tokens' });
        await expect(mintRow).toBeVisible();
        await expect(mintRow.locator('td').nth(0)).toHaveText('1');
        await expect(mintRow.locator('td').nth(1)).toHaveText('Mint Tokens');
        await expect(mintRow.locator('td').nth(3)).toHaveText('Role 1');
        await expect(mintRow.locator('td').nth(4)).toContainText('...');
      });

      test('clicking a row navigates to the sub-level mandate page', async ({ page }) => {
        const mintRow = page.locator('tbody tr').filter({ hasText: 'Mint Tokens' });
        await mintRow.click();

        await expect(page).toHaveURL(`${ORG_PATH}/mandates/1`);
      });
    });

    test.describe('sub-level mandate page', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_ACTIONS);
        await page.goto(`${ORG_PATH}/mandates/1`);
        // Date cells depend on a resolved block timestamp.
        await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 15_000 });
      });

      test('shows the title and the back button', async ({ page }) => {
        await expect(page.getByText('#1 Mint Tokens').first()).toBeVisible();

        const backButton = page.getByRole('button', { name: 'ALL MANDATES' });
        await expect(backButton).toBeVisible();
        await backButton.click();
        await expect(page).toHaveURL(`${ORG_PATH}/mandates`);
      });

      test('shows a Conditions component with the mandate\'s role requirement', async ({ page }) => {
        await expect(page.getByText('Conditions', { exact: true })).toBeVisible();
        await expect(page.getByText('Role required', { exact: true })).toBeVisible();
        await expect(page.getByRole('main').getByText('Role 1', { exact: true })).toBeVisible();
      });

      test('shows an Input Types component listing the mandate params', async ({ page }) => {
        await expect(page.getByText('Input types', { exact: true })).toBeVisible();
        await expect(page.getByText('to', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('amount', { exact: true }).first()).toBeVisible();
      });

      test('shows a Latest Actions component with the mandate\'s action history', async ({ page }) => {
        await expect(page.getByText('LATEST ACTIONS', { exact: true })).toBeVisible();
        for (const header of ['Date', 'Executioner', 'Action ID']) {
          await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
        }

        const callerRow = page.locator('tbody tr').filter({ hasText: '0x3333...3333' });
        await expect(callerRow).toBeVisible();
      });

      test('the action date is rendered as a clickable link', async ({ page }) => {
        const callerRow = page.locator('tbody tr').filter({ hasText: '0x3333...3333' });
        const dateLink = callerRow.locator('a');
        await expect(dateLink).toBeVisible();
        await expect(dateLink).toHaveAttribute('href', '#');
      });
    });

    test('shows "No actions found" when the mandate has no actions', async ({ page }) => {
      await mockPowersRpc(page, ORG_WITH_ACTIONS);
      await page.goto(`${ORG_PATH}/mandates/2`);

      await expect(page.getByText('No actions found', { exact: true })).toBeVisible();
      await expect(page.getByText('Input types', { exact: true })).not.toBeVisible();
    });
  });

  test.describe('flows tab', () => {
    test.use({ viewport: LARGE_VIEWPORT });

    function bannerTitle(page: Page) {
      return page.locator('p', { hasText: /^Flows$/ });
    }

    test('shows the page title', async ({ page }) => {
      await page.goto(`${ORG_PATH}/flows`);

      await expect(bannerTitle(page)).toBeVisible();
    });

    test('shows "No flows defined" when the org has no flows', async ({ page }) => {
      await page.goto(`${ORG_PATH}/flows`);

      await expect(page.getByText('No flows defined', { exact: true })).toBeVisible();
    });

    test.describe('with flows present', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_FLOWS);
        await page.goto(`${ORG_PATH}/flows`);
      });

      test('the table allows for horizontal scrolling', async ({ page }) => {
        const scrollContainer = page.locator('.overflow-x-auto').filter({ has: page.locator('table') });
        await expect(scrollContainer).toHaveCSS('overflow-x', 'auto');
      });

      test('renders all columns with data for each flow', async ({ page }) => {
        for (const header of ['Name', 'Description', 'Mandates']) {
          await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
        }

        const flowRow = page.locator('tbody tr').filter({ hasText: 'Onboarding' });
        await expect(flowRow).toBeVisible();
        await expect(flowRow.locator('td').nth(1)).toHaveText('Onboarding');
        await expect(flowRow.locator('td').nth(2)).toContainText('Mint and assign role');
        await expect(flowRow.locator('td').nth(3)).toHaveText('2');
      });

      test('clicking a row navigates to the sub-level flow page', async ({ page }) => {
        const flowRow = page.locator('tbody tr').filter({ hasText: 'Onboarding' });
        await flowRow.click();

        await expect(page).toHaveURL(`${ORG_PATH}/flows/0`);
      });
    });

    test.describe('sub-level flow page', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_FLOWS);
        await page.goto(`${ORG_PATH}/flows/0`);
      });

      // The page also renders a React Flow graph (AllFlows.tsx) with nodes
      // labeled by mandate name, so locators must be scoped to the mandate
      // list panel to avoid colliding with the graph nodes.
      function mandateList(page: Page) {
        return page.locator('.border.border-border.divide-y.divide-border');
      }

      test('shows the title and the back button', async ({ page }) => {
        await expect(page.getByText('Onboarding', { exact: true }).first()).toBeVisible();

        const backButton = page.getByRole('button', { name: 'ALL FLOWS' });
        await expect(backButton).toBeVisible();
        await backButton.click();
        await expect(page).toHaveURL(`${ORG_PATH}/flows`);
      });

      test('shows a list of mandates in the flow', async ({ page }) => {
        await expect(mandateList(page).getByText('Mint Tokens', { exact: true })).toBeVisible();
        await expect(mandateList(page).getByText('Assign Member Role', { exact: true })).toBeVisible();
      });

      test('clicking a mandate navigates to the mandates tab', async ({ page }) => {
        const mandateItem = mandateList(page).getByRole('button').filter({ hasText: 'Mint Tokens' });
        await mandateItem.click();

        await expect(page).toHaveURL(`${ORG_PATH}/mandates/1`);
      });
    });
  });

  test.describe('roles tab', () => {
    test.use({ viewport: LARGE_VIEWPORT });

    function bannerTitle(page: Page) {
      return page.locator('p', { hasText: /^Roles$/ });
    }

    test('shows the page title', async ({ page }) => {
      await page.goto(`${ORG_PATH}/roles`);

      await expect(bannerTitle(page)).toBeVisible();
    });

    test.describe('with roles present', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_ROLES);
        await page.goto(`${ORG_PATH}/roles`);
        await expect(page.locator('tbody tr')).not.toHaveCount(0);
      });

      test('shows the correct role names in the left column', async ({ page }) => {
        const rows = page.locator('tbody tr');
        await expect(rows.filter({ hasText: 'Member' }).locator('td').nth(0)).toContainText('Member');
        await expect(rows.filter({ hasText: 'Auditor' }).locator('td').nth(0)).toContainText('Auditor');
        await expect(rows.filter({ hasText: 'Public' }).locator('td').nth(0)).toContainText('Public');
      });

      test('shows "Public" as the role ID for the public role', async ({ page }) => {
        const publicRow = page.locator('tbody tr').filter({ hasText: 'Public' });
        await expect(publicRow.locator('td').nth(1)).toHaveText('Public');
      });

      test('shows the holder count in the other cells', async ({ page }) => {
        const memberRow = page.locator('tbody tr').filter({ hasText: 'Member' });
        await expect(memberRow.locator('td').nth(2)).toHaveText('2');

        const auditorRow = page.locator('tbody tr').filter({ hasText: 'Auditor' });
        await expect(auditorRow.locator('td').nth(2)).toHaveText('0');
      });

      test('clicking a role navigates to the sub-level role page', async ({ page }) => {
        const memberRow = page.locator('tbody tr').filter({ hasText: 'Member' });
        await memberRow.click();

        await expect(page).toHaveURL(`${ORG_PATH}/roles/1`);
      });
    });

    test.describe('sub-level role page', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_ROLES);
      });

      test('shows the title and the back button', async ({ page }) => {
        await page.goto(`${ORG_PATH}/roles/1`);

        await expect(page.getByText('Role: Member', { exact: true })).toBeVisible();

        const backButton = page.getByRole('button', { name: 'ALL ROLES' });
        await expect(backButton).toBeVisible();
        await backButton.click();
        await expect(page).toHaveURL(`${ORG_PATH}/roles`);
      });

      test('shows a table of addresses when the role has members', async ({ page }) => {
        await page.goto(`${ORG_PATH}/roles/1`);

        for (const header of ['#', 'Address']) {
          await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
        }
        await expect(page.locator('tbody tr')).toHaveCount(2);
        await expect(page.getByText(MEMBER_HOLDER_1, { exact: true })).toBeVisible();
        await expect(page.getByText(MEMBER_HOLDER_2, { exact: true })).toBeVisible();
      });

      test('shows "No members found" when the role has no members', async ({ page }) => {
        await page.goto(`${ORG_PATH}/roles/2`);

        await expect(page.getByText('No members found', { exact: true })).toBeVisible();
      });
    });
  });

  test.describe('treasury tab', () => {
    test.use({ viewport: LARGE_VIEWPORT });

    function bannerTitle(page: Page) {
      return page.locator('p', { hasText: /^Treasury$/ });
    }

    test('shows the page title', async ({ page }) => {
      await page.goto(`${ORG_PATH}/treasury`);

      await expect(bannerTitle(page)).toBeVisible();
    });

    test('shows "No Treasury Address Set" when no treasury is configured', async ({ page }) => {
      await page.goto(`${ORG_PATH}/treasury`);

      await expect(page.getByText('No Treasury Address Set', { exact: true })).toBeVisible();
    });

    test.describe('with treasury and paymaster set', () => {
      test.beforeEach(async ({ page }) => {
        await mockPowersRpc(page, ORG_WITH_TREASURY);
        await page.goto(`${ORG_PATH}/treasury`);
      });

      test('shows the treasury address', async ({ page }) => {
        await expect(page.getByText(`Treasury: ${TREASURY_ADDRESS}`, { exact: true })).toBeVisible();
      });

      test('shows the paymaster address', async ({ page }) => {
        await expect(page.getByText(`Paymaster: ${PAYMASTER_ADDRESS}`, { exact: true })).toBeVisible();
      });

      test('shows assets when the treasury is set', async ({ page }) => {
        for (const header of ['Asset', 'Symbol', 'Address', 'Quantity', 'Value']) {
          await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
        }
        await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 15_000 });
      });
    });
  });

  test.describe('organisation tab', () => {
    test.use({ viewport: LARGE_VIEWPORT });

    function bannerTitle(page: Page) {
      return page.locator('p', { hasText: /^Powers 101$/ });
    }

    test('shows the page title', async ({ page }) => {
      await mockPowersRpc(page, ORG_BASIC);
      await page.goto(`${ORG_PATH}/organisation`);

      await expect(bannerTitle(page)).toBeVisible();
    });

    test.describe('with metadata present', () => {
      test.beforeEach(async ({ page }) => {
        await mockOrgMetadata(page);
        await mockPowersRpc(page, ORG_WITH_METADATA);
        await page.goto(`${ORG_PATH}/organisation`);
      });

      test('shows the contract address', async ({ page }) => {
        // The banner subtitle also renders the contract address, so scope to
        // the metadata row's label/value pair to avoid a strict-mode clash.
        const label = page.getByText('Contract Address', { exact: true });
        await expect(label).toBeVisible();
        await expect(label.locator('xpath=following-sibling::p[1]')).toHaveText(POWERS_101_ADDRESS);
      });

      test('shows the about text', async ({ page }) => {
        const label = page.getByText('About', { exact: true });
        await expect(label).toBeVisible();
        await expect(label.locator('xpath=following-sibling::p[1]')).toHaveText(ORG_DESCRIPTION);
      });
    });

    test('the "To Forum" button navigates to the forum page for this org', async ({ page }) => {
      await mockPowersRpc(page, ORG_BASIC);
      await page.goto(`${ORG_PATH}/organisation`);

      const toForumButton = page.getByRole('button', { name: 'To Forum' });
      await expect(toForumButton).toBeVisible();
      await toForumButton.click();

      await expect(page).toHaveURL(`/forum/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}`);
    });
  });
});
