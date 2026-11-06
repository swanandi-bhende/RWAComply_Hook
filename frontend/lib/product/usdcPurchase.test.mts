import assert from 'node:assert/strict';
import test from 'node:test';
import { usdcPurchasePlan } from './usdcPurchase.ts';

const usdc = '0x00000000000000000000000000000000000000aA';
const rwa = '0x00000000000000000000000000000000000000bB';
const executor = '0x00000000000000000000000000000000000000cc';
const poolManager = '0x00000000000000000000000000000000000000dd';
const hook = '0x00000000000000000000000000000000000000ee';

function plan(typedAmount = '1.5') {
  return usdcPurchasePlan({
    typedAmount,
    usdc,
    rwa,
    executor,
    poolManager,
    hook,
    fee: 0x800000,
    tickSpacing: 60,
  });
}

test('the typed amount is the USDC amount approved for the router and sent to it', () => {
  const result = plan();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.amountIn, BigInt(1_500_000));
  assert.equal(result.plan.approval.token, usdc);
  const spender: string = result.plan.approval.spender;
  const manager: string = poolManager;
  assert.equal(spender, executor);
  assert.equal(spender.toLowerCase() === manager.toLowerCase(), false);
  assert.equal(result.plan.approval.amount, result.plan.amountIn);
  assert.equal(result.plan.swap.router, executor);
  assert.equal(result.plan.swap.amountIn, result.plan.amountIn);
  assert.equal(result.plan.swap.poolKey.hooks, hook);
});

test('an empty or zero amount is not sent to the router', () => {
  assert.equal(plan('').ok, false);
  assert.equal(plan('0').ok, false);
  assert.equal(plan('-1').ok, false);
});
