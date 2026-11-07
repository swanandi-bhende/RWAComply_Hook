import { expect, test } from '@playwright/test';

test('the guided demo page stays separate from World ID', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/demo/sandbox', async (route) => {
    const snapshot = {
      chainId: 31337,
      network: 'Local Anvil',
      simulatedIdentity: true,
      offering: { name: 'Demo RWA', token: 'Mock RWA', cap: '1000000000', status: 'Local test market' },
      contracts: {
        ledger: '0x0000000000000000000000000000000000000001',
        executor: '0x0000000000000000000000000000000000000002',
        hook: '0x0000000000000000000000000000000000000003',
        usdc: '0x0000000000000000000000000000000000000004',
        rwa: '0x0000000000000000000000000000000000000005',
      },
      alice: {
        a: { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', label: 'Alice — Wallet A', registered: true, cap: '1000000000', spent: '0', remaining: '1000000000' },
        b: { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', label: 'Alice — Wallet B', registered: true, cap: '1000000000', spent: '0', remaining: '1000000000' },
      },
      bob: {
        a: { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', label: 'Bob — Wallet A', registered: true, cap: '1000000000', spent: '0', remaining: '1000000000' },
      },
    };
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { action?: string };
      if (body.action === 'buy-700') {
        snapshot.alice.a.spent = '700000000';
        snapshot.alice.a.remaining = '300000000';
        snapshot.alice.b.spent = '700000000';
        snapshot.alice.b.remaining = '300000000';
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            result: { status: 'confirmed', message: 'Confirmed', hash: `0x${'ab'.repeat(32)}`, requested: '700000000', spent: '700000000', remaining: '300000000' },
            status: snapshot,
          }),
        });
        return;
      }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot) });
  });
  await page.goto('/demo');
  await expect(page.getByText('Local demonstration — Anvil test network')).toBeVisible();
  await expect(page.getByText('Local Anvil · Chain 31337')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Proof of human verified' })).toHaveCount(0);
  await expect(page.getByText('not Ethereum Sepolia')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy 700 USDC' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Attempt 500 USDC' })).toBeDisabled();
  await page.getByRole('button', { name: 'Buy 700 USDC' }).click();
  await expect(page.getByText('Result: Confirmed.')).toBeVisible();
  await expect(page.getByText('$300').first()).toBeVisible();
  await page.getByRole('button', { name: 'Bob' }).click();
  await expect(page.getByRole('button', { name: 'Wallet B' })).toBeDisabled();
  await expect(page.getByText('Bob — Wallet A')).toBeVisible();
  expect(errors).toEqual([]);
});
