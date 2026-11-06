import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_CAP,
  DEMO_FIRST_PURCHASE,
  DEMO_REJECTED_PURCHASE,
  DEMO_SECOND_PURCHASE,
  applyPurchase,
} from './allocationJourney.ts';

test('700 succeeds, 500 is rejected, 200 leaves 100, and another person keeps the full cap', () => {
  const first = applyPurchase(BigInt(0), DEMO_FIRST_PURCHASE);
  assert.equal(first.accepted, true);
  assert.equal(first.remaining, BigInt(300_000_000));

  const rejected = applyPurchase(first.spent, DEMO_REJECTED_PURCHASE);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.spent, first.spent);
  assert.equal(rejected.remaining, BigInt(300_000_000));

  const second = applyPurchase(rejected.spent, DEMO_SECOND_PURCHASE);
  assert.equal(second.accepted, true);
  assert.equal(second.remaining, BigInt(100_000_000));

  const bob = applyPurchase(BigInt(0), BigInt(0));
  assert.equal(bob.remaining, DEMO_CAP);
});
