import assert from 'node:assert/strict';
import test from 'node:test';
import { RABDI_CHAIN_ID, arkivAccessKey, rabdiChain } from './client.ts';

test('a missing Arkiv key fails closed', () => {
  assert.throws(() => arkivAccessKey({}), /ARKIV_ACCESS_KEY is not configured/);
  assert.throws(() => arkivAccessKey({ ARKIV_ACCESS_KEY: '   ' }), /ARKIV_ACCESS_KEY is not configured/);
});

test('Rabdi is chain 7794095 and the key stays in the server RPC path', () => {
  const accessKey = 'fixture-access-key';
  const chain = rabdiChain(accessKey);
  assert.equal(chain.id, RABDI_CHAIN_ID);
  assert.equal(chain.id, 7794095);
  assert.equal(chain.network, 'rabdi');
  assert.equal(chain.rpcUrls.default.http[0].endsWith(`/${accessKey}`), true);
  assert.equal(chain.rpcUrls.default.http[0].includes('rpc.rabdi.db-chain.testnet.arkiv.network'), true);
});
