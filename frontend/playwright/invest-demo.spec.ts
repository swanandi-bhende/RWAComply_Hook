import { expect, test, type Page } from '@playwright/test';

const WALLET_A = '0x1111111111111111111111111111111111111111';

async function installMockWallet(page: Page) {
  await page.addInitScript(() => {
    const listeners: Record<string, Array<(value: unknown) => void>> = {};
    const stateKey = 'rwacomply.mock.wallet';
    const read = () => {
      const raw = localStorage.getItem(stateKey);
      return raw ? JSON.parse(raw) as { accounts: string[]; chainId: string } : { accounts: [] as string[], chainId: '0x1' };
    };
    const write = (value: { accounts: string[]; chainId: string }) => localStorage.setItem(stateKey, JSON.stringify(value));
    const emit = (event: string, value: unknown) => {
      for (const listener of listeners[event] ?? []) listener(value);
    };
    const target = window as unknown as { ethereum: unknown };
    target.ethereum = {
      isMetaMask: true,
      async request({ method, params }: { method: string; params?: unknown[] }) {
        const state = read();
        if (method === 'eth_chainId') return state.chainId;
        if (method === 'eth_accounts') return state.accounts;
        if (method === 'eth_requestAccounts') {
          const account = '0x1111111111111111111111111111111111111111';
          write({ accounts: [account], chainId: state.chainId });
          return [account];
        }
        if (method === 'wallet_switchEthereumChain') {
          const chainId = String((params?.[0] as { chainId?: string } | undefined)?.chainId ?? state.chainId);
          write({ accounts: state.accounts, chainId });
          emit('chainChanged', chainId);
          return null;
        }
        if (method === 'eth_signTypedData_v4') return `0x${'11'.repeat(65)}`;
        return null;
      },
      on(event: string, listener: (value: unknown) => void) {
        listeners[event] = [...(listeners[event] ?? []), listener];
      },
      removeListener() {},
    };
  });
}

test('the presentation demo stays on the investor page and is not World ID', async ({ page }) => {
  await installMockWallet(page);
  await page.route('**/api/world/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ state: 'unverified', linkedWallets: [] }),
  }));
  await page.route('**/api/invest/demo', async (route) => {
    const body = route.request().postDataJSON() as { action?: string; wallet?: string };
    if (body.wallet !== WALLET_A) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'This wallet is not approved for the presentation demo.' }) });
      return;
    }
    if (body.action === 'authorize') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'The allocation ledger could not be reached.' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        challenge: 'signed-challenge',
        typedData: {
          domain: { name: 'RWAComplyWalletLink', version: '1', chainId: 11155111, verifyingContract: '0x0000000000000000000000000000000000000002' },
          types: { WalletLink: [{ name: 'purpose', type: 'string' }, { name: 'appId', type: 'string' }, { name: 'wallet', type: 'address' }, { name: 'nonce', type: 'bytes32' }, { name: 'issuedAt', type: 'uint256' }, { name: 'expiry', type: 'uint256' }] },
          primaryType: 'WalletLink',
          message: { purpose: 'demo', appId: 'rwa-sepolia-presentation', wallet: WALLET_A, nonce: `0x${'11'.repeat(32)}`, issuedAt: '10', expiry: '20' },
        },
      }),
    });
  });
  await page.goto('/invest');
  await expect(page.getByRole('button', { name: 'Use demo verification for this presentation' })).toBeDisabled();
  await expect(page.getByText('does not verify a unique human')).toBeVisible();
  await page.getByRole('button', { name: 'Connect Wallet' }).click();
  await page.getByRole('button', { name: 'Browser Wallet' }).click();
  await expect(page.getByRole('button', { name: 'Use demo verification for this presentation' })).toBeDisabled();
  await page.getByRole('button', { name: 'Switch to Ethereum Sepolia' }).click();
  await expect(page.getByRole('button', { name: 'Use demo verification for this presentation' })).toBeEnabled();
  await page.getByRole('button', { name: 'Use demo verification for this presentation' }).click();
  await page.getByRole('button', { name: 'Confirm demo verification' }).click();
  await expect(page.getByText('Demo authorization active — not World ID')).toBeVisible();
  await expect(page.getByText('Proof of human verified')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign and register this wallet' }).click();
  await expect(page.getByText('The allocation ledger could not be reached.')).toBeVisible();
  await expect(page.getByText('Wallet linked to this demo allocation.')).toHaveCount(0);
});
