import { test, expect } from '@playwright/test';

const SEPOLIA_CHAIN_ID = '11155111';
const POWERS_101_ADDRESS = '0x7EF3396E64BcdF5b58dE2A097BC5b72712059098';

test('forum org page renders without crashing', async ({ page }) => {
  await page.goto(`/forum/${SEPOLIA_CHAIN_ID}/${POWERS_101_ADDRESS}`);

  await expect(page.locator('body')).not.toContainText('Application error');
});
