import { test, expect, type Page } from '@playwright/test';
import { mockAuth } from './mocks/auth-fixture';
import { mockOnChainRpc } from './mocks/onchain-rpc';

const TEST_ADDRESS = '0x111111111111111111111111111111111111111A';

function parseAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const ORG_WITH_ACTIVITY = {
  contractAddress: '0x333333333333333333333333333333333333333C',
  chainId: '11155111',
  name: 'Org With Activity',
  metadatas: { icon: '', banner: '', description: '', attributes: [] },
  treasury: '0x0000000000000000000000000000000000000000',
  mandateCount: '1',
  mandates: [
    {
      powers: '0x333333333333333333333333333333333333333C',
      mandateAddress: '0x0',
      mandateHash: '0x0',
      index: '0',
      active: true,
      actions: [
        { actionId: '1', caller: TEST_ADDRESS, proposedAt: '100', fulfilledAt: '110' },
        { actionId: '2', caller: TEST_ADDRESS, proposedAt: '200', fulfilledAt: null },
        { actionId: '3', caller: '0x999999999999999999999999999999999999999D', proposedAt: '300', fulfilledAt: '310' },
      ],
    },
  ],
  roles: [],
  layout: {},
};

const ORG_WITH_ROLES = {
  contractAddress: '0x444444444444444444444444444444444444444d',
  chainId: '11155111',
  name: 'Org With Roles',
  metadatas: { icon: '', banner: '', description: '', attributes: [] },
  treasury: '0x0000000000000000000000000000000000000000',
  mandateCount: '0',
  mandates: [],
  roles: [
    { roleId: '0', label: 'Member', amountHolders: '1', members: [] },
    { roleId: '1', label: 'Admin', amountHolders: '1', members: [] },
    { roleId: '2', label: 'Reviewer', amountHolders: '1', members: [] },
  ],
  flows: [],
  layout: {},
};

const ORG_WITHOUT_ROLES = {
  contractAddress: '0x555555555555555555555555555555555555555e',
  chainId: '11155111',
  name: 'Org Without My Roles',
  metadatas: { icon: '', banner: '', description: '', attributes: [] },
  treasury: '0x0000000000000000000000000000000000000000',
  mandateCount: '0',
  mandates: [],
  roles: [{ roleId: '0', label: 'Member', amountHolders: '1', members: [] }],
  flows: [],
  layout: {},
};

async function seedSavedProtocols(page: Page, protocols: unknown[]) {
  await page.addInitScript((p) => {
    window.localStorage.setItem('powersProtocols', JSON.stringify(p));
  }, protocols);
}

function sectionLocator(page: Page, heading: string) {
  return page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::div[contains(@class, "border-border")][1]');
}

test.describe('forum profile', () => {
  test('shows "no wallet connected" state when no wallet is connected', async ({ page }) => {
    await mockOnChainRpc(page);
    await mockAuth(page);
    await page.goto('/forum/profile');

    await expect(
      page.locator('main section').first().getByText('No wallet connected', { exact: true })
    ).toBeVisible();
  });

  test('shows connected wallet address, ENS name, and proposal/execution/vote stats', async ({ page }) => {
    await mockOnChainRpc(page);
    await mockAuth(page, { address: TEST_ADDRESS });
    await seedSavedProtocols(page, [ORG_WITH_ACTIVITY]);
    await page.goto('/forum/profile');

    // No ENS configured for this address, so the page falls back to the
    // abbreviated address as the display name.
    await expect(page.getByRole('heading', { name: parseAddress(TEST_ADDRESS) })).toBeVisible();

    await expect(page.locator('span:text-is("Created") + span')).toHaveText('2');
    await expect(page.locator('span:text-is("Fulfilled") + span')).toHaveText('1');
    await expect(page.locator('span:text-is("Cast") + span')).toHaveText('0');
  });

  test('copy address button copies the connected wallet address to the clipboard', async ({ page, context }) => {
    await mockOnChainRpc(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockAuth(page, { address: TEST_ADDRESS });
    await page.goto('/forum/profile');

    await page.getByTitle('Copy address').click();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(TEST_ADDRESS);
  });

  test('shows Roles and Inbox sections', async ({ page }) => {
    await mockOnChainRpc(page);
    await mockAuth(page, { address: TEST_ADDRESS });
    await seedSavedProtocols(page, [ORG_WITH_ACTIVITY]);
    await page.goto('/forum/profile');

    await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  });

  test.describe('Roles section', () => {
    test('shows the correct organisations, without false positives or negatives', async ({ page }) => {
      await mockOnChainRpc(page, {
        roleGrants: [
          { contractAddress: ORG_WITH_ROLES.contractAddress, account: TEST_ADDRESS, roleId: '0', since: '100' },
        ],
      });
      await mockAuth(page, { address: TEST_ADDRESS });
      await seedSavedProtocols(page, [ORG_WITH_ROLES, ORG_WITHOUT_ROLES]);
      await page.goto('/forum/profile');

      const roles = sectionLocator(page, 'Roles');
      await expect(roles.getByText('Org With Roles', { exact: true })).toBeVisible();
      await expect(roles.getByText('Org Without My Roles', { exact: true })).not.toBeVisible();
    });

    test('shows the correct roles within an organisation, without false positives or negatives', async ({ page }) => {
      await mockOnChainRpc(page, {
        roleGrants: [
          { contractAddress: ORG_WITH_ROLES.contractAddress, account: TEST_ADDRESS, roleId: '0', since: '100' },
          { contractAddress: ORG_WITH_ROLES.contractAddress, account: TEST_ADDRESS, roleId: '2', since: '150' },
        ],
      });
      await mockAuth(page, { address: TEST_ADDRESS });
      await seedSavedProtocols(page, [ORG_WITH_ROLES]);
      await page.goto('/forum/profile');

      const roles = sectionLocator(page, 'Roles');
      // Holds "Member" (roleId 0) and "Reviewer" (roleId 2) but not "Admin"
      // (roleId 1) — both held roles should be listed, the unheld one not.
      await expect(roles.getByText('Member', { exact: true })).toBeVisible();
      await expect(roles.getByText('Reviewer', { exact: true })).toBeVisible();
      await expect(roles.getByText('Admin', { exact: true })).not.toBeVisible();
    });
  });
});
