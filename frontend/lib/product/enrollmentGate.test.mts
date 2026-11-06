import assert from 'node:assert/strict';
import test from 'node:test';
import { enrollmentButton, registrationPreflight } from './enrollmentGate.ts';

const ready = {
  connected: true,
  onSupportedNetwork: true,
  walletReady: true,
  alreadyRegistered: false,
  phase: 'idle' as const,
};

test('a connected wallet with no identity can start enrollment', () => {
  const button = enrollmentButton(ready);
  assert.equal(button.disabled, false);
  assert.equal(button.label, 'Verify with World App');
});

test('a disconnected wallet asks for a connection', () => {
  const button = enrollmentButton({ ...ready, connected: false, walletReady: false });
  assert.equal(button.disabled, true);
  assert.equal(button.explanation, 'Connect a wallet to continue.');
});

test('the wrong network asks for Ethereum Sepolia', () => {
  const button = enrollmentButton({ ...ready, onSupportedNetwork: false });
  assert.equal(button.disabled, true);
  assert.equal(button.explanation, 'Switch to Ethereum Sepolia.');
});

test('market loading does not block the identity action', () => {
  const button = enrollmentButton({ ...ready, marketLoading: true });
  assert.equal(button.disabled, false);
});

test('an unavailable Arkiv directory does not block the identity action', () => {
  const button = enrollmentButton({ ...ready, arkivUnavailable: true, marketLoading: true });
  assert.equal(button.disabled, false);
});

test('an already registered wallet does not start another registration', () => {
  const button = enrollmentButton({ ...ready, alreadyRegistered: true });
  assert.equal(button.disabled, true);
  assert.equal(button.label, 'Wallet linked');
});

test('a missing ledger stops registration without an identity error', () => {
  const blocked = registrationPreflight({ registrationReady: false, ledgerKnown: false });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.message, /allocation ledger/);
  assert.equal(registrationPreflight({ registrationReady: true, ledgerKnown: true }).ok, true);
});

test('wallet linked is reserved for a confirmed registration', () => {
  assert.equal(enrollmentButton(ready).label, 'Verify with World App');
  assert.equal(enrollmentButton({ ...ready, phase: 'awaiting_signature' }).label, 'Continue with wallet signature');
  assert.equal(enrollmentButton({ ...ready, phase: 'awaiting_transaction' }).label, 'Confirm wallet registration');
  assert.equal(enrollmentButton({ ...ready, alreadyRegistered: true }).label, 'Wallet linked');
});
