import assert from 'node:assert/strict';
import test from 'node:test';
import { signRequest } from '@worldcoin/idkit-core/signing';
import type { IDKitResult, IDKitSessionConfig } from '@worldcoin/idkit-core';
import { continueProofOfHuman, openSessionProof } from './continueClient.ts';
import { sessionIdStore } from './sessionStore.ts';

const APP_ID = 'app_test_fixture';
const RP_ID = 'rp_a11ce';
const SIGNING_KEY = `0x${'ab'.repeat(32)}`;
const sessionId = `session_${'ab'.padStart(64, '0')}01${'0'.repeat(62)}` as `session_${string}`;

function rpContext() {
  const signed = signRequest({ signingKeyHex: SIGNING_KEY, ttl: 300 });
  return {
    rp_id: RP_ID,
    nonce: signed.nonce,
    created_at: signed.createdAt,
    expires_at: signed.expiresAt,
    signature: signed.sig,
  };
}

const sessionResult = {
  protocol_version: '4.0',
  session_id: sessionId,
  environment: 'staging',
  responses: [{
    identifier: 'proof_of_human',
    session_nullifier: ['1', '2'],
    issuer_schema_id: 1,
    proof: ['1', '2', '3', '4', '5'],
    expires_at_min: 1,
  }],
} as IDKitResult;

test('IDKit.proveSession requests Proof of Human for the existing session', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ request_id: 'reqtest123' }), { status: 200 });
  try {
    const request = await openSessionProof(sessionId, {
      app_id: APP_ID,
      rp_context: rpContext(),
      environment: 'staging',
    });
    const payload = request.getDebugReport?.().request_payload as {
      action?: string;
      proof_request?: { proof_type?: string; session_id?: string; action?: string | null };
    };
    assert.equal(payload.proof_request?.proof_type, 'session');
    assert.equal(payload.proof_request?.session_id, sessionId);
    assert.equal(payload.proof_request?.action, null);
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes('proof_of_human'), true);
    assert.equal(serialized.includes(SIGNING_KEY), false);
    assert.equal('action' in (payload.proof_request ?? {}), true);
  } finally {
    globalThis.fetch = original;
  }
});

test('continuation forwards the session proof and stores only the browser session id', async () => {
  const memory = new Map<string, string>();
  const store = sessionIdStore({
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    },
  });
  store.write(sessionId);
  const forwarded: unknown[] = [];
  let intent = '';
  let received: IDKitSessionConfig | undefined;
  const result = await continueProofOfHuman({
    sessionStore: store,
    fetchImpl: async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body));
      if (url.endsWith('/api/world/rp-context')) {
        intent = body.intent;
        return Response.json({ app_id: APP_ID, environment: 'staging', rp_context: rpContext() });
      }
      forwarded.push(body);
      return Response.json({ continuation_token: 'abc', expires_at: 10 });
    },
    openRequest: async (id, config) => {
      assert.equal(id, sessionId);
      received = config;
      return {
        connectorURI: 'world://verify',
        pollUntilCompletion: async () => ({ success: true, result: sessionResult }),
      };
    },
  });
  assert.equal(intent, 'continue');
  assert.equal(received?.app_id, APP_ID);
  assert.equal('action' in (received ?? {}), false);
  assert.deepEqual(forwarded, [sessionResult]);
  assert.equal(result.ok, true);
  assert.equal(memory.get('rwacomply.world.session'), sessionId);

  const cancelled = await continueProofOfHuman({
    sessionId,
    fetchImpl: async () => Response.json({ app_id: APP_ID, environment: 'staging', rp_context: rpContext() }),
    openRequest: async () => ({
      connectorURI: 'world://verify',
      pollUntilCompletion: async () => ({ success: false, error: 'user_rejected' }) as never,
    }),
  });
  assert.deepEqual(cancelled, { ok: false, reason: 'cancelled' });

  const rejected = await continueProofOfHuman({
    sessionId,
    fetchImpl: async (input) => {
      if (String(input).endsWith('/api/world/continue')) return Response.json({ error: 'no' }, { status: 422 });
      return Response.json({ app_id: APP_ID, environment: 'staging', rp_context: rpContext() });
    },
    openRequest: async () => ({
      connectorURI: 'world://verify',
      pollUntilCompletion: async () => ({ success: true, result: sessionResult }),
    }),
  });
  assert.deepEqual(rejected, { ok: false, reason: 'verification_rejected' });
});
