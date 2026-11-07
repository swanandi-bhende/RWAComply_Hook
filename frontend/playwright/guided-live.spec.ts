import { expect, test } from '@playwright/test';

test('the rendered demo executes the Anvil journey', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser drives the shared Anvil chain.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demo');
  await expect(page.getByText('Local demonstration — Anvil test network')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Proof of human verified' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Restart demo' }).click();
  await expect(page.getByText('$1,000').first()).toBeVisible();
  await page.getByRole('button', { name: 'Buy 700 USDC' }).click();
  await expect(page.getByText('Result: Confirmed.')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Wallet B' }).click();
  await expect(page.getByText('$300').first()).toBeVisible();
  await page.getByRole('button', { name: 'Attempt 500 USDC' }).click();
  await expect(page.getByText('Rejected by allocation limit.')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Buy 200 USDC' }).click();
  await expect(page.getByText('Result: Confirmed.')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('$100').first()).toBeVisible();
  await page.getByRole('button', { name: 'Wallet A' }).click();
  await expect(page.getByText('$100').first()).toBeVisible();
  await page.getByRole('button', { name: 'Bob' }).click();
  await expect(page.getByText('$1,000').first()).toBeVisible();
  await page.getByRole('button', { name: 'Restart demo' }).click();
  await page.getByRole('button', { name: 'Alice' }).click();
  await expect(page.getByText('$1,000').first()).toBeVisible();
  expect(errors).toEqual([]);
});
