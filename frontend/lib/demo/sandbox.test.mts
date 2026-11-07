import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DEMO_GROUP_ID, HOSTED_DEMO_UNAVAILABLE, localDemoAllowed, parseSandboxRequest, PERSONAS, sandboxAvailability, SANDBOX_ACTIONS } from './sandbox.ts';
import { authorizationFailure } from '../world/walletLinkClient.ts';

test('the guided demo accepts only the scripted local actions', () => {
  assert.equal(parseSandboxRequest({ action: 'buy-700', persona: 'alice', wallet: 'a' }).ok, true);
  assert.equal(parseSandboxRequest({ action: 'attempt-500', persona: 'alice', wallet: 'b' }).ok, true);
  assert.equal(parseSandboxRequest({ action: 'buy-200', persona: 'alice', wallet: 'b' }).ok, true);
  assert.equal(parseSandboxRequest({ action: 'buy-700', persona: 'bob', wallet: 'a' }).ok, false);
  assert.equal(parseSandboxRequest({ action: 'buy-700', persona: 'alice', wallet: 'a', amount: '1' }).ok, false);
  assert.equal(parseSandboxRequest({ action: 'transfer', to: PERSONAS.bob.wallets.a.address }).ok, false);
  assert.equal(parseSandboxRequest({ action: 'status', persona: 'alice' }).ok, false);
  assert.equal(SANDBOX_ACTIONS['buy-700'].amount, BigInt(700000000));
  assert.equal(SANDBOX_ACTIONS['attempt-500'].amount, BigInt(500000000));
  assert.equal(SANDBOX_ACTIONS['buy-200'].amount, BigInt(200000000));
  assert.notEqual(PERSONAS.alice.wallets.a.address, PERSONAS.alice.wallets.b.address);
  assert.equal(PERSONAS.alice.allocationId === PERSONAS.bob.allocationId, false);
});

test('the guided demo is local-only and does not enter World ID storage', () => {
  assert.equal(localDemoAllowed({ RWA_DEMO_IDENTITY: 'local' }, '127.0.0.1:3463'), true);
  assert.equal(localDemoAllowed({ RWA_DEMO_IDENTITY: 'local' }, 'localhost:3463'), true);
  assert.equal(localDemoAllowed({ RWA_DEMO_IDENTITY: 'local' }, 'example.com'), false);
  assert.equal(localDemoAllowed({ RWA_DEMO_IDENTITY: 'hackathon' }, '127.0.0.1:3463'), false);
  assert.equal(localDemoAllowed({}, '127.0.0.1:3463'), false);
  const source = readFileSync(new URL('./sandbox.ts', import.meta.url), 'utf8');
  const chain = readFileSync(new URL('./sandboxChain.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('enrollmentStore'), false);
  assert.equal(chain.includes('WORLD_PRIVATE_KEY'), false);
  assert.equal(chain.includes('ALLOCATION_AUTH_SIGNING_KEY'), false);
  assert.equal(DEMO_GROUP_ID, '0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677');
  const hosted = sandboxAvailability({ RWA_DEMO_IDENTITY: 'local' }, 'example.com');
  assert.equal(hosted.available, false);
  if (!hosted.available) {
    assert.equal(hosted.message.includes('127.0.0.1'), false);
    assert.equal(hosted.message, HOSTED_DEMO_UNAVAILABLE);
  }
  assert.equal(sandboxAvailability({ RWA_DEMO_IDENTITY: 'local' }, '127.0.0.1:3463').available, true);
});

test('a ledger failure is not reported as a rejected wallet signature', async () => {
  const result = await authorizationFailure(Response.json({ error: 'Allocation ledger is unavailable' }, { status: 503 }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unexpected');
  assert.equal(result.message, 'Allocation ledger is unavailable');
  const invalid = await authorizationFailure(Response.json({ error: 'The wallet signature is invalid' }, { status: 422 }));
  assert.equal(invalid.reason, 'signature_rejected');
  assert.equal(invalid.message, 'The wallet signature is invalid');
});
