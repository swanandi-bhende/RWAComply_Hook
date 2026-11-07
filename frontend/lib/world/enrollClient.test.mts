import assert from 'node:assert/strict';
import test from 'node:test';
import { signRequest } from '@worldcoin/idkit-core/signing';
import type { IDKitCompletionResult, IDKitRequestConfig, IDKitResult } from '@worldcoin/idkit-core';
import { enrollProofOfHuman, openProofOfHumanRequest } from './enrollClient.ts';

const APP_ID = 'app_test_fixture';
const RP_ID = 'rp_a11ce';
const SIGNING_KEY = `0x${'ab'.repeat(32)}`;

function rpContext() {
  const signed = signRequest({
    signingKeyHex: SIGNING_KEY,
    action: 'signup',
    ttl: 300,
  });
  return {
    rp_id: RP_ID,
    nonce: signed.nonce,
    created_at: signed.createdAt,
    expires_at: signed.expiresAt,
    signature: signed.sig,
  };
}

function contextResponse() {
  return {
    app_id: APP_ID,
    environment: 'staging',
    rp_context: rpContext(),
  };
}

const verifiedSessionId = `session_${'ab'.padStart(64, '0')}01${'0'.repeat(62)}`;
const verifiedResult = {
  protocol_version: '4.0',
  action: 'signup',
  session_id: verifiedSessionId,
  environment: 'staging',
  responses: [{ identifier: 'proof_of_human', nullifier: '1' }],
} as IDKitResult;

test('IDKit builds a Proof of Human uniqueness request bound to a new session', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ request_id: 'reqtest123' }), { status: 200 });
  try {
    const context = rpContext();
    const request = await openProofOfHumanRequest({
      app_id: APP_ID,
      action: 'signup',
      session_id: 'create',
      rp_context: context,
      allow_legacy_proofs: false,
      environment: 'staging',
    });
    const report = request.getDebugReport?.();
    assert.ok(report);
    const payload = report.request_payload as {
      allow_legacy_proofs?: boolean;
      app_id?: string;
      action?: string;
      proof_request?: {
        proof_type?: string;
        session_id?: string;
        rp_id?: string;
        proof_requests?: unknown;
        constraints?: unknown;
      };
    };
    assert.equal(payload.app_id, APP_ID);
    assert.equal(payload.action, 'signup');
    assert.equal(payload.allow_legacy_proofs, false);
    assert.equal(payload.proof_request?.proof_type, 'uniqueness');
    assert.equal(payload.proof_request?.session_id, 'create');
    assert.equal(payload.proof_request?.rp_id, 'rp_00000000000a11ce');
    assert.match(request.connectorURI, /^https:\/\/staging\.world\.org\/verify\?t=wld&i=reqtest123&k=/);
    const serialized = JSON.stringify(payload.proof_request);
    assert.equal(serialized.includes('proof_of_human'), true);
    assert.equal(serialized.includes('orbLegacy'), false);
    assert.equal(serialized.includes('"selfie"'), false);
  } finally {
    globalThis.fetch = original;
  }
});

test('enrollment forwards the unchanged result and ignores cancellation or failure', async () => {
  const seen: unknown[] = [];
  const context = contextResponse();
  let receivedConfig: IDKitRequestConfig | undefined;

  const success = await enrollProofOfHuman({
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/world/rp-context')) {
        return Response.json(context);
      }
      seen.push(JSON.parse(String(init?.body)));
      return Response.json({ success: true, session_id: verifiedSessionId });
    },
    openRequest: async (config) => {
      receivedConfig = config;
      return {
        connectorURI: 'world://verify',
        pollUntilCompletion: async () => ({ success: true, result: verifiedResult }),
      };
    },
  });

  assert.equal(success.ok, true);
  if (success.ok) {
    assert.equal(success.sessionId, verifiedSessionId);
    assert.equal('allocationId' in success, false);
    assert.equal('nullifier' in success, false);
  }
  assert.equal(receivedConfig?.action, 'signup');
  assert.equal(receivedConfig?.session_id, 'create');
  assert.equal(receivedConfig?.allow_legacy_proofs, false);
  assert.equal(receivedConfig?.app_id, APP_ID);
  assert.equal(receivedConfig?.environment, 'staging');
  assert.equal(receivedConfig?.action_description, 'RWAComply proof of human');
  assert.equal(receivedConfig?.rp_context.rp_id, RP_ID);
  assert.deepEqual(seen, [verifiedResult]);

  for (const completion of [
    { success: false as const, error: 'user_rejected' as const },
    { success: false as const, error: 'verification_rejected' as const },
  ]) {
    let enrollCalls = 0;
    const result = await enrollProofOfHuman({
      fetchImpl: async (input) => {
        if (String(input).endsWith('/api/world/enroll')) enrollCalls += 1;
        return Response.json(context);
      },
      openRequest: async () => ({
        connectorURI: 'world://verify',
        pollUntilCompletion: async () => completion as IDKitCompletionResult,
      }),
    });
    assert.equal(result.ok, false);
    assert.equal(enrollCalls, 0);
  }
});

test('polling stays on one request and reports retrieval, cancellation, and expiry', async () => {
  const statuses = ['waiting_for_connection', 'awaiting_confirmation', 'confirmed'];
  const seen: string[] = [];
  let polls = 0;
  const result = await enrollProofOfHuman({
    fetchImpl: async (input) => {
      if (String(input).endsWith('/api/world/enroll')) {
        return Response.json({ success: true, session_id: verifiedSessionId });
      }
      return Response.json(contextResponse());
    },
    onStatus: (status) => seen.push(status),
    openRequest: async () => ({
      connectorURI: 'https://sandbox.world.org/verify?t=wld&i=reqsandbox1&k=abc',
      requestId: 'reqsandbox1',
      pollOnce: async () => {
        polls += 1;
        const type = statuses[polls - 1];
        if (type === 'confirmed') return { type, result: verifiedResult };
        return { type };
      },
      pollUntilCompletion: async () => {
        throw new Error('pollUntilCompletion should not run when pollOnce exists');
      },
    }),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(seen, ['waiting_for_connection', 'awaiting_confirmation']);

  const cancelled = await enrollProofOfHuman({
    fetchImpl: async () => Response.json(contextResponse()),
    openRequest: async () => ({
      connectorURI: 'https://sandbox.world.org/verify?t=wld&i=same&k=abc',
      requestId: 'same',
      pollOnce: async () => ({ type: 'failed', error: 'user_rejected' }),
      pollUntilCompletion: async () => ({ success: false, error: 'timeout' }) as IDKitCompletionResult,
    }),
  });
  assert.deepEqual(cancelled, { ok: false, reason: 'cancelled' });

  const expired = await enrollProofOfHuman({
    timeoutMs: 1,
    fetchImpl: async () => Response.json(contextResponse()),
    openRequest: async () => ({
      connectorURI: 'https://sandbox.world.org/verify?t=wld&i=same&k=abc',
      requestId: 'same',
      pollOnce: async () => ({ type: 'waiting_for_connection' }),
      pollUntilCompletion: async () => ({ success: true, result: verifiedResult }),
    }),
  });
  assert.deepEqual(expired, { ok: false, reason: 'timeout' });
});

test('the connector is presented before polling and a client flag cannot verify the person', async () => {
  const connectorURI = 'https://staging.world.org/verify?t=wld&i=reqtest123&k=abc';
  let handedOff = false;
  let polling = false;
  const events: string[] = [];
  const success = await enrollProofOfHuman({
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/world/rp-context')) return Response.json(contextResponse());
      events.push('enroll');
      const body = JSON.parse(String(init?.body)) as { verified?: boolean; protocol_version?: string };
      assert.equal(body.verified, undefined);
      assert.equal(body.protocol_version, '4.0');
      return Response.json({ success: true, session_id: verifiedSessionId, continuation_token: 'grant' });
    },
    onHandoff: (handoff) => {
      handedOff = !polling;
      events.push(handoff.connectorURI);
    },
    onProofReceived: () => events.push('proof'),
    openRequest: async () => ({
      connectorURI,
      pollUntilCompletion: async () => {
        polling = true;
        return { success: true, result: verifiedResult };
      },
    }),
  });
  assert.equal(handedOff, true);
  assert.equal(success.ok, true);
  assert.deepEqual(events, [connectorURI, 'proof', 'enroll']);

  const flagged = await enrollProofOfHuman({
    fetchImpl: async (input) => {
      if (String(input).endsWith('/api/world/enroll')) return Response.json({ verified: true });
      return Response.json(contextResponse());
    },
    openRequest: async () => ({
      connectorURI,
      pollUntilCompletion: async () => ({ success: true, result: verifiedResult }),
    }),
  });
  assert.equal(flagged.ok, false);

  const expired = await enrollProofOfHuman({
    fetchImpl: async (input) => {
      if (String(input).endsWith('/api/world/enroll')) throw new Error('should not enroll');
      return Response.json(contextResponse());
    },
    openRequest: async () => ({
      connectorURI,
      pollUntilCompletion: async () => ({ success: false, error: 'timeout' }) as IDKitCompletionResult,
    }),
  });
  assert.deepEqual(expired, { ok: false, reason: 'timeout' });

  const offline = await enrollProofOfHuman({
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  assert.deepEqual(offline, { ok: false, reason: 'world_unavailable' });
});

test('sandbox configuration is passed through and a rejected proof is not verified', async () => {
  let received: IDKitRequestConfig | undefined;
  const accepted = await enrollProofOfHuman({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith('/api/world/rp-context')) {
        return Response.json({ ...contextResponse(), environment: 'sandbox' });
      }
      return Response.json({ success: true, session_id: verifiedSessionId });
    },
    openRequest: async (config) => {
      received = config;
      return {
        connectorURI: 'https://sandbox.world.org/verify?t=wld&i=reqsandbox1&k=abc',
        requestId: 'reqsandbox1',
        pollUntilCompletion: async () => ({ success: true, result: verifiedResult }),
      };
    },
  });
  assert.equal(accepted.ok, true);
  assert.equal(received?.environment, 'sandbox');

  const rejected = await enrollProofOfHuman({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith('/api/world/rp-context')) {
        return Response.json({ ...contextResponse(), environment: 'sandbox' });
      }
      return Response.json({ error: 'The World ID environment does not match this server' }, { status: 422 });
    },
    openRequest: async () => ({
      connectorURI: 'https://sandbox.world.org/verify?t=wld&i=reqsandbox1&k=abc',
      requestId: 'reqsandbox1',
      pollUntilCompletion: async () => ({ success: true, result: verifiedResult }),
    }),
  });
  assert.deepEqual(rejected, { ok: false, reason: 'environment_mismatch' });

  const missing = await enrollProofOfHuman({
    fetchImpl: async () => Response.json({ app_id: APP_ID, rp_context: rpContext() }),
  });
  assert.deepEqual(missing, { ok: false, reason: 'environment_mismatch' });
});
