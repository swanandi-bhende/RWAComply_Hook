import assert from 'node:assert/strict';
import test from 'node:test';
import { isUserRejection, walletStatusCopy, type WalletStatusInput } from './walletConnection.ts';

const base: WalletStatusInput = {
  wallet: 'disconnected',
  network: 'unknown',
  demo: 'active',
  linked: false,
};

test('wallet status stays separate from demo identity and network', () => {
  assert.equal(walletStatusCopy(base).wallet, 'Connect your wallet to register it with this demo identity.');
  assert.equal(walletStatusCopy(base).demo, 'Demo identity active. Connect a wallet to link it.');
  assert.equal(walletStatusCopy({ ...base, wallet: 'rejected' }).wallet, 'The wallet connection was cancelled.');
  assert.equal(walletStatusCopy({ ...base, wallet: 'error' }).wallet, 'The wallet could not be connected. Try again.');
  assert.equal(walletStatusCopy({ ...base, wallet: 'connecting' }).wallet, 'Connecting wallet…');

  const wrong = walletStatusCopy({
    ...base,
    wallet: 'connected',
    network: 'wrong',
    address: '0x1111111111111111111111111111111111111111',
  });
  assert.equal(wrong.wallet, 'Wallet connected: 0x1111111111111111111111111111111111111111');
  assert.equal(wrong.network, 'Wallet connected. Switch to Ethereum Sepolia to continue.');
  assert.equal(wrong.demo, '');

  const ready = walletStatusCopy({
    ...base,
    wallet: 'connected',
    network: 'sepolia',
    address: '0x1111111111111111111111111111111111111111',
  });
  assert.equal(ready.wallet, 'Wallet connected: 0x1111111111111111111111111111111111111111');
  assert.equal(ready.demo, 'Demo identity active. Wallet connected. Sign the ownership message to register this wallet.');

  const linked = walletStatusCopy({
    wallet: 'connected',
    network: 'sepolia',
    demo: 'active',
    address: '0x1111111111111111111111111111111111111111',
    linked: true,
  });
  assert.equal(linked.demo, 'Wallet linked to this demo allocation.');
  assert.equal(walletStatusCopy({
    wallet: 'connected',
    network: 'sepolia',
    demo: 'off',
    address: '0x2222222222222222222222222222222222222222',
    linked: true,
  }).demo, '');
  assert.match(walletStatusCopy({
    wallet: 'disconnected',
    network: 'unknown',
    demo: 'expired',
    linked: false,
  }).demo, /expired/);
  assert.equal(walletStatusCopy({
    wallet: 'disconnected',
    network: 'unknown',
    demo: 'unavailable',
    linked: false,
  }).demo, 'Demo identity is unavailable.');
});

test('a rejected wallet request is not a network failure', () => {
  const error = new Error('User rejected the request.');
  Object.assign(error, { code: 4001 });
  assert.equal(isUserRejection(error), true);
  assert.equal(isUserRejection(new Error('missing provider')), false);
  assert.equal(isUserRejection({ cause: { name: 'UserRejectedRequestError' } }), true);
});
