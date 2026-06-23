import { test, expect, type Page } from '@playwright/test';

// Mirrors frontend/utils/toDates.ts:toDDMMYYYY. Inlined rather than imported
// since e2e specs run outside the Next.js bundler.
function toDDMMYYYY(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Mirrors frontend/utils/addressUtils.ts:parseAddress.
function parseAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const CHAIN_ID = '11155111';
const FOUNDED_BLOCK = '12345';
const FOUNDED_TIMESTAMP = 1700000000; // fixed, cached so no live RPC call is needed

const ORG_A = {
  contractAddress: '0x111111111111111111111111111111111111111A',
  chainId: CHAIN_ID,
  name: 'Org A Full',
  metadatas: { icon: '', banner: '', description: 'A fully described organisation.', attributes: [] },
  foundedAt: FOUNDED_BLOCK,
  treasury: '0x222222222222222222222222222222222222222B',
  mandateCount: '3',
  mandates: [{ powers: '0x111111111111111111111111111111111111111A', mandateAddress: '0x0', mandateHash: '0x0', index: '0', active: true }],
  roles: [
    { roleId: '0', label: 'Member', amountHolders: '1', members: [] },
    { roleId: '1', label: 'Admin', amountHolders: '1', members: [] },
  ],
  layout: {},
};

const ORG_B = {
  contractAddress: '0x333333333333333333333333333333333333333C',
  chainId: CHAIN_ID,
  name: 'Org B Minimal',
  metadatas: { icon: '', banner: '', description: '', attributes: [] },
  treasury: '0x0000000000000000000000000000000000000000',
  mandateCount: '0',
  mandates: [{ powers: '0x333333333333333333333333333333333333333C', mandateAddress: '0x0', mandateHash: '0x0', index: '0', active: true }],
  roles: [],
  layout: {},
};

async function seedSavedProtocols(page: Page) {
  await page.addInitScript(
    ({ protocols, chainId, blockNumber, timestamp }) => {
      window.localStorage.setItem('powersProtocols', JSON.stringify(protocols));
      window.localStorage.setItem(
        'blockTimestamps',
        JSON.stringify([
          [`${chainId}:${blockNumber}`, { chainId, blockNumber, timestamp }],
        ])
      );
    },
    { protocols: [ORG_A, ORG_B], chainId: CHAIN_ID, blockNumber: FOUNDED_BLOCK, timestamp: String(FOUNDED_TIMESTAMP) }
  );
}

function orgBox(page: Page, orgName: string) {
  return page
    .getByRole('heading', { name: orgName, exact: true })
    .locator('xpath=ancestor::div[contains(@class, "border-border")][1]');
}

test.describe('overview index', () => {
  test.beforeEach(async ({ page }) => {
    // The store always injects two real default orgs (Powers 101,
    // Governed721) alongside whatever's in localStorage, and their empty
    // `mandates` trigger a live fetchPowers() RPC call. Mock Alchemy so
    // that call resolves instantly instead of racing test teardown - an
    // in-flight live request gets cut off when the page closes, which
    // Playwright surfaces as an unrelated `_wrapApiCall` stream error.
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

    await seedSavedProtocols(page);
    await page.goto('/overview');
  });

  test('page loads and lists saved organisations', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /saved organisations/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: ORG_A.name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: ORG_B.name, exact: true })).toBeVisible();
  });

  test('fully populated organisation box shows all fields', async ({ page }) => {
    const box = orgBox(page, ORG_A.name);

    await expect(box.getByText(ORG_A.metadatas.description, { exact: true })).toBeVisible();
    await expect(box.locator('span:text-is("Founded") + p')).toHaveText(toDDMMYYYY(FOUNDED_TIMESTAMP));
    await expect(box.locator('span:text-is("Mandates") + p')).toHaveText(ORG_A.mandateCount);
    await expect(box.locator('span:text-is("Roles") + p')).toHaveText(String(ORG_A.roles.length));
    await expect(box.locator('span:text-is("Powers") + p')).toContainText(parseAddress(ORG_A.contractAddress));
    await expect(box.locator('span:text-is("Network") + p')).toHaveText(ORG_A.chainId);
    await expect(box.locator('span:text-is("Treasury") + p')).toContainText(parseAddress(ORG_A.treasury));
  });

  test('minimal organisation box falls back to defaults / N-A', async ({ page }) => {
    const box = orgBox(page, ORG_B.name);

    await expect(box.getByText('No description available.', { exact: true })).toBeVisible();
    await expect(box.locator('span:text-is("Founded") + p')).toHaveText('N/A');
    await expect(box.locator('span:text-is("Treasury") + p')).toHaveText('N/A');
    await expect(box.locator('span:text-is("Mandates") + p')).toHaveText(ORG_B.mandateCount);
    await expect(box.locator('span:text-is("Roles") + p')).toHaveText('0');
  });

  test('footer is visible at the end of the page', async ({ page }) => {
    const footer = page.locator('#page-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
  });

  test('organisation box has a delete button', async ({ page }) => {
    const box = orgBox(page, ORG_A.name);
    await expect(box.getByRole('button')).toBeVisible();
  });

  test('delete button opens a confirmation dialog', async ({ page }) => {
    const box = orgBox(page, ORG_A.name);
    await box.getByRole('button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('ARCHIVE PROTOCOL', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Go back' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeVisible();
  });

  test('confirming removes the organisation from the list', async ({ page }) => {
    await orgBox(page, ORG_A.name).getByRole('button').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('heading', { name: ORG_A.name, exact: true })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: ORG_B.name, exact: true })).toBeVisible();
  });

  test('cancelling the dialog keeps the organisation in the list', async ({ page }) => {
    await orgBox(page, ORG_A.name).getByRole('button').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Go back' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: ORG_A.name, exact: true })).toBeVisible();
  });
});
