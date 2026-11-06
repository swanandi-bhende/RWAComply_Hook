import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeAbiParameters, getAddress, keccak256 } from 'viem';
import { describeColumns } from '@arkiv-network/sdk/schema';
import { arkivPublicClient } from './client.ts';
import {
  DEPLOYED_HOOK,
  DEPLOYED_RWA,
  DEPLOYED_USDC,
  OFFERING_FIELDS,
  OFFERING_ID,
  OFFERING_LIFETIME_SECONDS,
  POOL_FEE,
  PROJECT_TAG,
  TICK_SPACING,
  demoPoolId,
  describeOfferingDirectory,
  offeringExpiresAt,
  offeringQueryText,
  offeringWrite,
  type PublicOffering,
} from './offering.ts';
import { offeringDecision, publisherAddress, publishOffering } from './publish.ts';

const NOW = 1_762_000_000;
const PUBLISHER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

function offering(overrides: Partial<PublicOffering> = {}): PublicOffering {
  return {
    key: `0x${'ab'.repeat(32)}`,
    owner: getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'),
    projectTag: PROJECT_TAG,
    offeringId: OFFERING_ID,
    rwaSymbol: 'RWA',
    usdcAddress: DEPLOYED_USDC,
    rwaAddress: DEPLOYED_RWA,
    poolId: demoPoolId(),
    expiresAt: offeringExpiresAt(NOW).toString(),
    ...overrides,
  };
}

const chain = {
  cap: '1000000000',
  periodId: '1',
  remaining: '1000000000',
  usdc: DEPLOYED_USDC,
  rwa: DEPLOYED_RWA,
};

test('the offering schema stores the directory fields and not the allocation counters', () => {
  const names = describeColumns(offeringWrite(NOW).schema);
  assert.equal(names, OFFERING_FIELDS.join(', '));
  assert.equal(names.includes('cap'), false);
  assert.equal(names.includes('spent'), false);
  const write = offeringWrite(NOW);
  assert.equal(Object.hasOwn(write.values, 'cap'), false);
  assert.equal(Object.hasOwn(write.values, 'spent'), false);
  assert.equal(write.expiresAt, BigInt(NOW) + BigInt(OFFERING_LIFETIME_SECONDS));
});

test('the pool id is the deployed mock USDC and RWA pair', () => {
  const expected = keccak256(encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' },
    ],
    [DEPLOYED_USDC, DEPLOYED_RWA, POOL_FEE, TICK_SPACING, DEPLOYED_HOOK],
  ));
  assert.equal(demoPoolId(), expected);
});

test('the published query filters on the project tag and offering id', () => {
  const query = offeringQueryText();
  assert.match(query, new RegExp(PROJECT_TAG));
  assert.match(query, new RegExp(OFFERING_ID));
  assert.doesNotMatch(query, /cap|spent/i);
});

test('a missing, expired, or mismatched Arkiv record keeps the chain policy', () => {
  const missing = describeOfferingDirectory({ nowUnix: NOW, chain, offering: null, arkivError: null });
  assert.equal(missing.arkivStatus, 'missing');
  assert.equal(missing.chain.cap, '1000000000');
  assert.match(missing.warning ?? '', /missing/);
  assert.match(missing.warning ?? '', /Ethereum allocation contract/);

  const expired = describeOfferingDirectory({
    nowUnix: NOW,
    chain,
    offering: offering({ expiresAt: String(NOW) }),
    arkivError: null,
  });
  assert.equal(expired.arkivStatus, 'expired');
  assert.equal(expired.chain.remaining, '1000000000');

  const mismatch = describeOfferingDirectory({
    nowUnix: NOW,
    chain,
    offering: offering({ rwaAddress: getAddress('0x0000000000000000000000000000000000000001') }),
    arkivError: null,
  });
  assert.equal(mismatch.arkivStatus, 'mismatch');
  assert.equal(mismatch.chain.usdc, DEPLOYED_USDC);

  const ready = describeOfferingDirectory({ nowUnix: NOW, chain, offering: offering(), arkivError: null });
  assert.equal(ready.arkivStatus, 'ready');
  assert.equal(ready.warning, null);

  const down = describeOfferingDirectory({
    nowUnix: NOW,
    chain,
    offering: null,
    arkivError: 'ARKIV_ACCESS_KEY is not configured',
  });
  assert.equal(down.arkivStatus, 'unavailable');
  assert.equal(down.chain.periodId, '1');
});

test('the publisher key accepts a bare 32-byte hex value and rejects a malformed one', () => {
  assert.equal(
    publisherAddress({ ARKIV_PUBLISHER_PRIVATE_KEY: PUBLISHER.slice(2) }),
    getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
  );
  assert.throws(
    () => publisherAddress({ ARKIV_PUBLISHER_PRIVATE_KEY: '0x1234' }),
    /32-byte hex key/,
  );
  assert.throws(() => publisherAddress({}), /ARKIV_PUBLISHER_PRIVATE_KEY is not configured/);
});

test('an existing current offering is reused and a conflict is not written again', () => {
  assert.equal(offeringDecision([], NOW).action, 'create');
  const current = offering();
  const reuse = offeringDecision([current], NOW);
  assert.equal(reuse.action, 'reuse');
  const stale = offeringDecision([offering({ expiresAt: String(NOW) })], NOW);
  assert.equal(stale.action, 'stale');
  const conflict = offeringDecision([current, offering()], NOW);
  assert.equal(conflict.action, 'conflict');
});

test('publishing refuses a missing key and does not write cap or spent', async () => {
  let calls = 0;
  await assert.rejects(
    () => publishOffering({
      env: {},
      nowUnix: NOW,
      createEntity: async () => {
        calls += 1;
        return { entityKey: `0x${'11'.repeat(32)}`, txHash: `0x${'22'.repeat(32)}` };
      },
    }),
    /ARKIV_ACCESS_KEY is not configured/,
  );
  assert.equal(calls, 0);

  const published = await publishOffering({
    env: { ARKIV_ACCESS_KEY: 'fixture-access-key', ARKIV_PUBLISHER_PRIVATE_KEY: PUBLISHER },
    nowUnix: NOW,
    createEntity: async (write, writer) => {
      calls += 1;
      assert.equal(Object.hasOwn(write.values, 'cap'), false);
      assert.equal(Object.hasOwn(write.values, 'spent'), false);
      assert.equal(write.values.projectTag, PROJECT_TAG);
      assert.equal(writer, getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'));
      return { entityKey: `0x${'11'.repeat(32)}`, txHash: `0x${'22'.repeat(32)}` };
    },
  });
  assert.equal(calls, 1);
  assert.equal(published.writer, getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'));
  assert.match(published.query, new RegExp(OFFERING_ID));
  assert.match(published.entityKey, /^0x[0-9a-f]{64}$/);
});

test('the Arkiv client still refuses to run in a browser', () => {
  const globalWithWindow = globalThis as { window?: object };
  globalWithWindow.window = {};
  try {
    assert.throws(() => arkivPublicClient({ ARKIV_ACCESS_KEY: 'fixture-access-key' }), /server/);
  } finally {
    delete globalWithWindow.window;
  }
});
