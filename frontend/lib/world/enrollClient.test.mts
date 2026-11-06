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
