import { test, expect, type Page } from '@playwright/test';
import { mockPowersRpc, type MockPowersConfig } from './mocks/powers-rpc';

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
      params: [
        { varName: 'to', dataType: 'address' },
        { varName: 'amount', dataType: 'uint256' },
      ],
      actions: [
        { actionId: '1', state: 7, proposedAt: 100n, fulfilledAt: 110n, description: 'Mint 100 tokens to treasury' },
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
  await page.route('**/g.alchemy.com/v2/**', async (route) => {
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
          await expect(page.locator('th', { hasText: header })).toBeVisible();
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
});
