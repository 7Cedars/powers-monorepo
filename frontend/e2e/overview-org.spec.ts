import { test, expect } from '@playwright/test';

const SEPOLIA_CHAIN_ID = '11155111';
const POWERS_101_ADDRESS = '0x7EF3396E64BcdF5b58dE2A097BC5b72712059098';

test('overview dashboard shell renders nav tabs', async ({ page }) => {
  await page.goto(`/overview/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}/organisation`);

  for (const label of ['Actions', 'Mandates', 'Flows', 'Roles', 'Treasury', 'Organisation']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
});
