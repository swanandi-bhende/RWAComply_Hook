import { expect, test } from '@playwright/test';

test('an unverified investor is asked to use World App', async ({ page }) => {
  await page.route('**/api/demo/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ enabled: false }),
  }));
  await page.route('**/api/world/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ state: 'unverified', linkedWallets: [] }),
  }));
  await page.goto('/invest');
  await expect(page.getByRole('button', { name: 'Verify with World App' })).toBeVisible();
  await expect(page.getByText('Orb-verified World ID')).toBeVisible();
  await expect(page.getByText('does not grant issuer approval')).toBeVisible();
  await expect(page.getByRole('img', { name: 'World App verification QR code' })).toHaveCount(0);
});

test('demo identity is labelled separately from World ID', async ({ page }) => {
  await page.route('**/api/demo/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ enabled: true, state: 'active', linkedWallets: [] }),
  }));
  await page.route('**/api/world/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ state: 'unverified', linkedWallets: [] }),
  }));
  await page.goto('/invest');
  await expect(page.getByRole('heading', { name: 'Demo identity verification — not World ID' })).toBeVisible();
  await expect(page.getByText('Demo identity active — not World ID. Connecting a wallet does not link it.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Proof of human verified' })).toHaveCount(0);
});

test('a saved verification offers wallet continuation without a new enrollment', async ({ page }) => {
  await page.route('**/api/demo/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ enabled: false }),
  }));
  await page.route('**/api/world/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ state: 'verified', linkedWallets: [] }),
  }));
  await page.goto('/invest');
  await expect(page.getByText('Proof of human verified.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue and register this wallet' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify with World App' })).toHaveCount(0);
});
