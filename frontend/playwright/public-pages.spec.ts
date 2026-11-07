import { expect, test } from '@playwright/test';

const pages = [
  ['/', 'One human. Multiple wallets. One shared purchase budget.'],
  ['/offerings', 'Explore tokenized assets'],
  ['/invest', 'Verify with World App'],
  ['/issuer', 'On Sepolia, the marketplace registry is not deployed.'],
  ['/how', 'The limit follows the person'],
] as const;

for (const [path, text] of pages) {
  test(`${path} renders without a local chain address`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const localCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('127.0.0.1:8545') || request.url().includes('localhost:8545')) localCalls.push(request.url());
    });
    await page.goto(path);
    await expect(page.getByText(text).first()).toBeVisible();
    expect(localCalls).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [360, 800]] as const) {
  test(`demo and invest fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/invest');
    await expect(page.getByRole('heading', { name: 'Verify identity' })).toBeVisible();
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'RWAComply — Interactive Demo' })).toBeVisible();
  });
}

test('a hosted demo reports that no demo chain is configured', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const localCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes(':8545')) localCalls.push(request.url());
  });
  await page.route('**/api/demo/sandbox', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Local demo is not enabled' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: false,
        message: 'The guided demonstration runs on a local Anvil chain during a live presentation. This deployment has no hosted demo chain, so it does not connect to a local RPC and does not show transaction results. See How it works for the product explanation.',
      }),
    });
  });
  await page.goto('/demo');
  await expect(page.getByText('no hosted demo chain')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy 700 USDC' })).toHaveCount(0);
  await expect(page.getByText('0x')).toHaveCount(0);
  expect(localCalls).toEqual([]);
  expect(errors).toEqual([]);
});
