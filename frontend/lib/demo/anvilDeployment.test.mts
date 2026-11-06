import assert from 'node:assert/strict';
import test from 'node:test';
import { marketFromCreations, selectAnvilMarket } from './anvilDeployment.ts';

const creations = [
  { contractName: 'PoolManager', contractAddress: '0x0000000000000000000000000000000000000001' },
  { contractName: 'MockRWAOracle', contractAddress: '0x0000000000000000000000000000000000000002' },
  { contractName: 'RWAComplyHook', contractAddress: '0x0000000000000000000000000000000000000003' },
  { contractName: 'MockUSDC', contractAddress: '0x0000000000000000000000000000000000000004' },
  { contractName: 'MockERC20', contractAddress: '0x0000000000000000000000000000000000000005', arguments: ['RWA', 'RWA', '0'] },
  { contractName: 'AllocationLedger', contractAddress: '0x0000000000000000000000000000000000000006' },
  { contractName: 'PoolExecutor', contractAddress: '0x0000000000000000000000000000000000000007' },
];

test('an Anvil broadcast supplies the local market and ignores unrelated addresses', () => {
  const market = marketFromCreations(creations);
  assert.ok(market);
  assert.equal(market.chainId, 31337);
  assert.equal(market.tokenA, '0x0000000000000000000000000000000000000004');
  assert.equal(market.tokenB, '0x0000000000000000000000000000000000000005');
  assert.equal(market.ledger, '0x0000000000000000000000000000000000000006');
  assert.equal(market.executor, '0x0000000000000000000000000000000000000007');
});

test('a partial broadcast does not become a market by borrowing other addresses', () => {
  const partial = marketFromCreations(creations.slice(0, 2));
  assert.equal(partial, null);
  assert.equal(selectAnvilMarket(null, { chainId: 31337, poolManager: '0x0000000000000000000000000000000000000001' }), null);
});
