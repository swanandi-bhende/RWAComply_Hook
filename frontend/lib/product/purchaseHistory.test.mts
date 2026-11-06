import assert from 'node:assert/strict';
import test from 'node:test';
import { getAddress, type Address, type Hex } from 'viem';
import { publicPurchasesFromLogs } from './purchaseHistory.ts';

const wallet = getAddress('0x00000000000000000000000000000000000000aa') as Address;
const allocationId = `0x${'ab'.repeat(32)}` as Hex;

test('purchase history keeps the wallet amounts and drops the allocation id', () => {
  const purchases = publicPurchasesFromLogs([
    {
      transactionHash: `0x${'11'.repeat(32)}`,
      blockNumber: BigInt(3),
      args: { wallet, allocationId, amount: BigInt(200), newSpent: BigInt(900) },
    },
    {
      transactionHash: `0x${'22'.repeat(32)}`,
      blockNumber: BigInt(2),
      removed: true,
      args: { wallet, allocationId, amount: BigInt(1), newSpent: BigInt(1) },
    },
    {
      transactionHash: `0x${'33'.repeat(32)}`,
      blockNumber: BigInt(4),
      args: { wallet, allocationId, amount: BigInt(700), newSpent: BigInt(700) },
    },
  ]);
  assert.deepEqual(purchases.map((item) => item.amount), ['700', '200']);
  assert.equal(JSON.stringify(purchases).includes(allocationId), false);
  assert.equal(purchases[0]?.newSpent, '700');
});
