import { expect, test, type Page } from '@playwright/test';

/**
 * These tests install a mocked window.ethereum. They do not connect a real
 * browser extension or a phone wallet, and they do not send a transaction.
 */
const WALLET_A = '0x1111111111111111111111111111111111111111';
const WALLET_B = '0x2222222222222222222222222222222222222222';

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
    const target = window as unknown as {
      ethereum: unknown;
      __walletCalls: string[];
      __switchMockAccount: (account: string) => void;
    };
    target.__walletCalls = [];
    target.ethereum = {
      isMetaMask: true,
      async request({ method, params }: { method: string; params?: unknown[] }) {
        target.__walletCalls.push(method);
        const state = read();
        const rejected = () => {
          const error = new Error('User rejected the request.');
          (error as { code?: number }).code = 4001;
          throw error;
        };
        if (method === 'eth_chainId') return state.chainId;
        if (method === 'eth_accounts') return state.accounts;
        if (method === 'eth_requestAccounts' || method === 'wallet_requestPermissions') {
          if (localStorage.getItem('rwacomply.mock.rejectConnect') === '1') rejected();
          const account = localStorage.getItem('rwacomply.mock.nextAccount') ?? '0x1111111111111111111111111111111111111111';
          write({ accounts: [account], chainId: state.chainId });
          return method === 'eth_requestAccounts'
            ? [account]
            : [{ parentCapability: 'eth_accounts', caveats: [{ type: 'restrictReturnedAccounts', value: [account] }] }];
        }
        if (method === 'wallet_switchEthereumChain') {
          if (localStorage.getItem('rwacomply.mock.rejectSwitch') === '1') rejected();
          const chainId = String((params?.[0] as { chainId?: string } | undefined)?.chainId ?? state.chainId);
          write({ accounts: state.accounts, chainId });
          emit('chainChanged', chainId);
          return null;
        }
        if (method === 'eth_signTypedData_v4') {
          localStorage.setItem('rwacomply.mock.signed', '1');
          return `0x${'11'.repeat(65)}`;
        }
        return null;
      },
      on(event: string, listener: (value: unknown) => void) {
        listeners[event] = [...(listeners[event] ?? []), listener];
      },
      removeListener(event: string, listener: (value: unknown) => void) {
        listeners[event] = (listeners[event] ?? []).filter((item) => item !== listener);
      },
    };
    target.__switchMockAccount = (account: string) => {
      const state = read();
      write({ accounts: [account], chainId: state.chainId });
      localStorage.setItem('rwacomply.mock.nextAccount', account);
      emit('accountsChanged', [account]);
    };
  });
}

async function mockIdentity(page: Page, demo: { state: 'none' | 'active'; linkedWallets?: string[] }) {
  await page.route('**/api/world/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ state: 'unverified', linkedWallets: [] }),
  }));
  await page.route('**/api/demo/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ enabled: true, state: demo.state, linkedWallets: demo.linkedWallets ?? [] }),
  }));
}

async function connectBrowserWallet(page: Page) {
  await page.getByRole('button', { name: 'Connect Wallet' }).click();
  await page.getByRole('button', { name: 'Browser Wallet' }).click();
  await expect(page.getByText('Wallet connected. Switch to Ethereum Sepolia to continue.')).toBeVisible();
}

test('the connect dialog lists an injected wallet that did not announce EIP-6963', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'none' });
  await page.goto('/invest');
  await page.getByRole('button', { name: 'Connect Wallet' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Browser Wallet' })).toBeVisible();
});

test('a mocked injected wallet connects on its current chain without switching or registering', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'active' });
  await page.goto('/invest');
  await connectBrowserWallet(page);
  await expect(page.getByText(WALLET_A)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demo identity verification — not World ID' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue and register this wallet' })).toBeDisabled();
  const calls = await page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls);
  expect(calls).not.toContain('wallet_switchEthereumChain');
  expect(calls).not.toContain('eth_signTypedData_v4');
});

test('rejecting the connection returns to the disconnected state', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'active' });
  await page.goto('/invest');
  await page.evaluate(() => localStorage.setItem('rwacomply.mock.rejectConnect', '1'));
  await page.getByRole('button', { name: 'Connect Wallet' }).click();
  await page.getByRole('button', { name: 'Browser Wallet' }).click();
  await expect(page.getByText('The wallet connection was cancelled.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
  await expect(page.getByText('Connecting wallet…')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Demo identity verification — not World ID' })).toHaveCount(0);
});

test('disconnecting the mocked wallet clears the connected address', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'active' });
  await page.goto('/invest');
  await connectBrowserWallet(page);
  await page.getByRole('button', { name: 'Disconnect current wallet' }).click();
  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
  await expect(page.getByText('Wallet connected. Switch to Ethereum Sepolia to continue.')).toHaveCount(0);
});

test('switching the mocked account updates the address and stays on World ID', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'active' });
  await page.goto('/invest');
  await connectBrowserWallet(page);
  await page.getByRole('button', { name: 'Switch to Ethereum Sepolia' }).click();
  await expect(page.getByText(`Wallet connected: ${WALLET_A}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue and register this wallet' })).toBeDisabled();
  await expect(page.getByText('Status: Not started.')).toBeVisible();
  await expect(page.getByText('Link this wallet after verification.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demo identity verification — not World ID' })).toHaveCount(0);
  await page.evaluate((account) => {
    (window as unknown as { __switchMockAccount: (value: string) => void }).__switchMockAccount(account);
  }, WALLET_B);
  await expect(page.getByText(`Wallet connected: ${WALLET_B}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue and register this wallet' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Demo identity verification — not World ID' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Verify with World App' })).toBeVisible();
});

test('a rejected network switch leaves the wallet connected', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'active' });
  await page.goto('/invest');
  await connectBrowserWallet(page);
  await page.evaluate(() => localStorage.setItem('rwacomply.mock.rejectSwitch', '1'));
  await page.getByRole('button', { name: 'Switch to Ethereum Sepolia' }).click();
  await expect(page.getByText('The network switch was cancelled.')).toBeVisible();
  await expect(page.getByText('Wallet connected. Switch to Ethereum Sepolia to continue.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to Ethereum Sepolia' })).toBeEnabled();
});

test('a demo identity response does not change the investor page or disconnect the wallet', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'active' });
  await page.goto('/invest');
  await connectBrowserWallet(page);
  await expect(page.getByText(WALLET_A)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start demo identity' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Verify with World App' })).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls);
  expect(calls).not.toContain('wallet_revokePermissions');
});

test('reload keeps the mocked wallet and the mocked demo identity', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'active' });
  await page.goto('/invest');
  await connectBrowserWallet(page);
  await page.reload();
  await expect(page.getByText(`Wallet connected: ${WALLET_A}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demo identity verification — not World ID' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Verify with World App' })).toBeVisible();
});

test('World ID mode still waits for verification when demo identity is off', async ({ page }) => {
  await installMockWallet(page);
  await page.route('**/api/demo/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ enabled: false }),
  }));
  await page.route('**/api/world/identity', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ state: 'unverified', linkedWallets: [] }),
  }));
  await page.goto('/invest');
  await connectBrowserWallet(page);
  await page.getByRole('button', { name: 'Switch to Ethereum Sepolia' }).click();
  await expect(page.getByRole('button', { name: 'Continue and register this wallet' })).toBeDisabled();
  await expect(page.getByText('Status: Not started.')).toBeVisible();
  await expect(page.getByText('Link this wallet after verification.')).toBeVisible();
  await expect(page.getByText('Demo identity active. This wallet has not been linked yet.')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Proof of human verified' })).toHaveCount(0);
});

test('the investor page does not sign a demo wallet challenge', async ({ page }) => {
  await installMockWallet(page);
  await mockIdentity(page, { state: 'active' });
  await page.goto('/invest');
  await connectBrowserWallet(page);
  await page.getByRole('button', { name: 'Switch to Ethereum Sepolia' }).click();
  await expect(page.getByRole('button', { name: 'Sign and register this wallet' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue and register this wallet' })).toBeDisabled();
  const calls = await page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls);
  expect(calls).not.toContain('eth_signTypedData_v4');
});
