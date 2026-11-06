import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PAUSED_POOL_MESSAGE,
  REMAINING_BUDGET_MESSAGE,
  UNREGISTERED_WALLET_MESSAGE,
  routerPhaseLabel,
  routerRejectionMessage,
} from './purchaseFlow.ts';

test('retail and allocation rejections say the remaining budget is not enough', () => {
  assert.equal(routerRejectionMessage('RetailLimitExceeded()'), REMAINING_BUDGET_MESSAGE);
  assert.equal(routerRejectionMessage('AllocationExceeded(100, 20)'), REMAINING_BUDGET_MESSAGE);
  assert.equal(routerRejectionMessage('CapExceeded(1, 2, 3)'), REMAINING_BUDGET_MESSAGE);
});

test('an unregistered wallet and a paused pool keep their own messages', () => {
  assert.equal(routerRejectionMessage('WalletNotRegistered(0x1)'), UNREGISTERED_WALLET_MESSAGE);
  assert.equal(routerRejectionMessage('PoolPaused()'), PAUSED_POOL_MESSAGE);
  assert.equal(routerRejectionMessage('user rejected the request'), null);
});

test('router phases use the approved labels', () => {
  assert.equal(routerPhaseLabel('approving'), 'Approving');
  assert.equal(routerPhaseLabel('registering'), 'Registering');
  assert.equal(routerPhaseLabel('swapping'), 'Swapping');
  assert.equal(routerPhaseLabel('success'), 'Success');
  assert.equal(routerPhaseLabel('rejected'), 'Hook rejection');
});
