import assert from 'node:assert/strict';
import test from 'node:test';
import { readSandbox, resetSandbox, runPurchase, seedSandbox } from './sandboxChain.ts';

test('Alice, Alice’s second wallet, and Bob use the local ledger', async () => {
  try {
    await resetSandbox();
  } catch {
    await seedSandbox();
  }
  const bought = await runPurchase('buy-700');
  assert.equal(bought.status, 'confirmed');
  assert.equal(bought.spent, '700000000');
  assert.equal(bought.remaining, '300000000');
  assert.match(bought.hash ?? '', /^0x[0-9a-fA-F]{64}$/);

  const rejected = await runPurchase('attempt-500');
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.spent, '700000000');
  assert.equal(rejected.remaining, '300000000');

  const second = await runPurchase('buy-200');
  assert.equal(second.status, 'confirmed');
  assert.equal(second.spent, '900000000');
  assert.equal(second.remaining, '100000000');

  const shared = await readSandbox();
  assert.equal(shared.chainId, 31337);
  assert.equal(shared.alice.a.remaining, '100000000');
  assert.equal(shared.alice.b.remaining, '100000000');
  assert.equal(shared.alice.a.spent, '900000000');
  assert.equal(shared.bob.a.spent, '0');
  assert.equal(shared.bob.a.remaining, '1000000000');

  const reset = await resetSandbox();
  assert.equal(reset.alice.a.spent, '0');
  assert.equal(reset.alice.a.remaining, '1000000000');
  assert.equal(reset.bob.a.remaining, '1000000000');
});
