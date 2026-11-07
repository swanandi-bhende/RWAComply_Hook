import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { decryptSessionId } from './sessionCrypto.ts';
import { handleEnroll } from './enroll.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import type { PortalCallResult } from './enrollmentProof.ts';

const APP_ID = 'app_test_fixture';
const RP_ID = 'rp_a11ce';
const SIGNING_KEY = `0x${'ab'.repeat(32)}` as const;
const ENCRYPTION_KEY = `0x${'cd'.repeat(32)}`;
const NULLIFIER = '123456789012345678901234567890';
const OTHER_NULLIFIER = '987654321098765432109876543210';
const PROOF_MARKER = 'proof-marker-do-not-store';

function sessionId(tag: string): string {
  return `session_${tag.padStart(64, '0')}01${'0'.repeat(62)}`;
}

function env() {
  return {
    WORLD_APP_ID: APP_ID,
    WORLD_RP_ID: RP_ID,
    WORLD_PRIVATE_KEY: SIGNING_KEY,
    WORLD_RP_SIGNER_ADDRESS: privateKeyToAccount(SIGNING_KEY).address,
    WORLD_SESSION_ENCRYPTION_KEY: ENCRYPTION_KEY,
    WORLD_ID_ENVIRONMENT: 'staging',
  };
}

function proof(overrides: Record<string, unknown> = {}) {
  return {
    protocol_version: '4.0',
    nonce: `0x${'11'.repeat(32)}`,
    action: 'signup',
    session_id: sessionId('ab'),
    environment: 'staging',
    responses: [
      {
        identifier: 'proof_of_human',
        issuer_schema_id: 1,
        nullifier: NULLIFIER,
        expires_at_min: 49012345,
        proof: [PROOF_MARKER, '0x2', '0x3', '0x4', '0x5'],
      },
    ],
    ...overrides,
  };
}

function portal(overrides: Record<string, unknown> = {}): PortalCallResult {
  const nullifier = `0x${BigInt(NULLIFIER).toString(16).padStart(64, '0')}`;
  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      action: 'signup',
      nullifier,
      environment: 'staging',
      protocol_version: '4.0',
      results: [{ identifier: 'proof_of_human', success: true, nullifier }],
      ...overrides,
    },
  };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/world/enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function withStore<T>(run: (store: EnrollmentStore, file: string) => Promise<T>): Promise<T> {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-enroll-'));
  const file = path.join(directory, 'enroll.sqlite');
  const store = new EnrollmentStore(file);
  try {
    return await run(store, file);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test('a verified Proof of Human enrollment stores an encrypted session and returns only the session id', async () => {
  await withStore(async (store, file) => {
    let verifyCalls = 0;
    const response = await handleEnroll(post(proof()), {
      env: env(),
      store,
      verify: async ({ rpId, rawBody }) => {
        verifyCalls += 1;
        assert.equal(rpId, RP_ID);
        assert.equal(rawBody, JSON.stringify(proof()));
        return portal();
      },
    });
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const cookie = response.headers.get('set-cookie') ?? '';
    assert.match(cookie, /^rwacomply_resume=[0-9a-f]{64}; HttpOnly; SameSite=Lax; Path=\/; Max-Age=\d+$/);
    const resumeToken = cookie.split('=')[1]?.split(';')[0] ?? '';
    assert.equal(text.includes(resumeToken), false);
    const body = JSON.parse(text) as {
      success: boolean;
      session_id: string;
      continuation_token: string;
      expires_at: number;
    };
    assert.deepEqual(Object.keys(body).sort(), ['continuation_token', 'expires_at', 'session_id', 'success']);
    assert.equal(body.success, true);
    assert.equal(body.session_id, sessionId('ab'));
    assert.match(body.continuation_token, /^[0-9a-f]{64}$/);
    assert.equal(body.continuation_token.includes(sessionId('ab')), false);
    assert.equal(verifyCalls, 1);
    assert.equal(text.includes(NULLIFIER), false);
    assert.equal(text.includes(SIGNING_KEY), false);
    assert.equal(text.includes(ENCRYPTION_KEY), false);
    assert.equal(text.includes(PROOF_MARKER), false);

    const records = store.records();
    assert.equal(records.length, 1);
    assert.equal(records[0].credential, 'proof_of_human');
    assert.equal(records[0].action, 'signup');
    assert.match(records[0].allocationId, /^0x[0-9a-f]{64}$/);
    assert.equal(decryptSessionId(records[0].session, Buffer.from(ENCRYPTION_KEY.slice(2), 'hex')), sessionId('ab'));

    const stored = readFileSync(file).toString('utf8');
    assert.equal(stored.includes(NULLIFIER), false);
    assert.equal(stored.includes(sessionId('ab')), false);
    assert.equal(stored.includes(PROOF_MARKER), false);
    assert.equal(stored.includes(ENCRYPTION_KEY.slice(2)), false);
    assert.equal(stored.includes(body.continuation_token), false);
    assert.equal(stored.includes(SIGNING_KEY.slice(2)), false);
    assert.equal(stored.includes(resumeToken), false);
  });
});

test('a sandbox proof is accepted when the server is configured for staging', async () => {
  await withStore(async (store) => {
    const body = proof({ environment: 'sandbox' });
    const response = await handleEnroll(post(body), {
      env: env(),
      store,
      verify: async () => portal({ environment: 'sandbox' }),
    });
    assert.equal(response.status, 200);
    assert.equal(store.records()[0]?.environment, 'sandbox');
    const rejected = await handleEnroll(post(body), {
      env: env(),
      store,
      verify: async () => portal({ environment: 'staging' }),
    });
    assert.equal(rejected.status, 422);
  });
});

test('enrollment rejects the wrong action, environment, credential, nullifier, and session binding', async () => {
  await withStore(async (store) => {
    const cases: Array<{ body: unknown; status: number; error: string }> = [
      { body: proof({ action: 'login' }), status: 422, error: 'The World ID action is not signup' },
      { body: proof({ environment: 'production' }), status: 422, error: 'The World ID environment does not match this server' },
      {
        body: proof({
          responses: [{ identifier: 'selfie', issuer_schema_id: 11, nullifier: NULLIFIER, proof: [PROOF_MARKER] }],
        }),
        status: 422,
        error: 'The World ID credential is not Proof of Human',
      },
      {
        body: proof({
          responses: [{ identifier: 'proof_of_human', issuer_schema_id: 1, proof: [PROOF_MARKER] }],
        }),
        status: 422,
        error: 'The uniqueness nullifier is missing',
      },
      {
        body: proof({ session_id: undefined }),
        status: 422,
        error: 'The proof is not bound to a new session',
      },
      {
        body: {
          protocol_version: '4.0',
          nonce: `0x${'11'.repeat(32)}`,
          session_id: sessionId('ab'),
          environment: 'staging',
          responses: [
            {
              identifier: 'proof_of_human',
              issuer_schema_id: 1,
              session_nullifier: [NULLIFIER, '1'],
              proof: [PROOF_MARKER],
            },
          ],
        },
        status: 422,
        error: 'A session proof without Proof of Human uniqueness cannot enroll',
      },
    ];

    for (const item of cases) {
      const response = await handleEnroll(post(item.body), {
        env: env(),
        store,
        verify: async () => {
          throw new Error('verification must not run');
        },
      });
      const body = (await response.json()) as { error: string; session_id?: string };
      assert.equal(response.status, item.status);
      assert.equal(body.error, item.error);
      assert.equal(body.session_id, undefined);
      assert.equal(JSON.stringify(body).includes(NULLIFIER), false);
      assert.equal(JSON.stringify(body).includes(PROOF_MARKER), false);
    }
    assert.equal(store.records().length, 0);
  });
});

test('portal failures do not create an enrollment', async () => {
  await withStore(async (store) => {
    const calls: Array<{ label: string; portal: PortalCallResult; status: number; error: string }> = [
      {
        label: 'unsuccessful human result',
        portal: portal({
          results: [{ identifier: 'proof_of_human', success: false, code: 'verification_error' }],
        }),
        status: 422,
        error: 'The World ID proof is invalid',
      },
      {
        label: 'missing result',
        portal: portal({ results: [{ identifier: 'selfie', success: true, nullifier: '0x1' }] }),
        status: 422,
        error: 'The World ID credential is not Proof of Human',
      },
      {
        label: 'missing portal nullifier',
        portal: portal({ nullifier: undefined, results: [{ identifier: 'proof_of_human', success: true }] }),
        status: 422,
        error: 'The uniqueness nullifier is missing',
      },
      {
        label: 'wrong action',
        portal: portal({ action: 'other' }),
        status: 422,
        error: 'The World ID action is not signup',
      },
      {
        label: 'wrong environment',
        portal: portal({ environment: 'production' }),
        status: 422,
        error: 'The World ID environment does not match this server',
      },
      {
        label: 'mismatched session',
        portal: portal({ session_id: sessionId('cd') }),
        status: 422,
        error: 'The proof is not bound to a new session',
      },
      {
        label: 'invalid proof',
        portal: { ok: false, status: 400, body: { success: false, code: 'all_verifications_failed', detail: PROOF_MARKER } },
        status: 422,
        error: 'The World ID proof is invalid',
      },
      {
        label: 'expired proof',
        portal: { ok: false, status: 400, body: { success: false, code: 'rp_signature_expired', detail: 'secret-detail' } },
        status: 422,
        error: 'The World ID proof is expired',
      },
    ];

    for (const item of calls) {
      const response = await handleEnroll(post(proof()), {
        env: env(),
        store,
        verify: async () => item.portal,
      });
      const body = (await response.json()) as { error: string };
      assert.equal(response.status, item.status, item.label);
      assert.equal(body.error, item.error, item.label);
      assert.equal(JSON.stringify(body).includes(PROOF_MARKER), false);
      assert.equal(JSON.stringify(body).includes('secret-detail'), false);
    }
    assert.equal(store.records().length, 0);
  });
});

test('a wrong RP id is rejected before verification', async () => {
  await withStore(async (store) => {
    const response = await handleEnroll(post(proof({ rp_id: 'rp_other_fixture' })), {
      env: env(),
      store,
      verify: async () => {
        throw new Error('verification must not run');
      },
    });
    assert.equal(response.status, 422);
    assert.equal(store.records().length, 0);
  });
});

test('duplicate and distinct nullifiers are enforced by the database', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-enroll-'));
  const file = path.join(directory, 'enroll.sqlite');
  const first = new EnrollmentStore(file);
  const second = new EnrollmentStore(file);
  try {
    const ok = await handleEnroll(post(proof()), {
      env: env(),
      store: first,
      verify: async () => portal(),
    });
    assert.equal(ok.status, 200);

    const duplicate = await handleEnroll(post(proof()), {
      env: env(),
      store: second,
      verify: async () => portal(),
    });
    const duplicateBody = (await duplicate.json()) as { error: string; session_id?: string };
    assert.equal(duplicate.status, 409);
    assert.equal(duplicateBody.error, 'This Proof of Human enrollment already exists');
    assert.equal(duplicateBody.session_id, undefined);

    const [raced, racedAgain] = await Promise.all([
      handleEnroll(post(proof({ session_id: sessionId('cd'), responses: [human(OTHER_NULLIFIER)] })), {
        env: env(),
        store: first,
        verify: async () => portalFor(OTHER_NULLIFIER),
      }),
      handleEnroll(post(proof({ session_id: sessionId('ef'), responses: [human(OTHER_NULLIFIER)] })), {
        env: env(),
        store: second,
        verify: async () => portalFor(OTHER_NULLIFIER),
      }),
    ]);
    const statuses = [raced.status, racedAgain.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    const thirdNullifier = '555555555555555555555555555555';
    const distinct = await handleEnroll(
      post(proof({ session_id: sessionId('12'), responses: [human(thirdNullifier)] })),
      { env: env(), store: first, verify: async () => portalFor(thirdNullifier) },
    );
    assert.equal(distinct.status, 200);

    const records = first.records();
    assert.equal(records.length, 3);
    const allocationIds = records.map((record) => record.allocationId);
    assert.equal(new Set(allocationIds).size, 3);
    for (const allocationId of allocationIds) {
      assert.match(allocationId, /^0x[0-9a-f]{64}$/);
    }
  } finally {
    first.close();
    second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a rejected duplicate rolls back and leaves the stored enrollment unchanged', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-enroll-'));
  const file = path.join(directory, 'enroll.sqlite');
  const store = new EnrollmentStore(file);
  try {
    const ok = await handleEnroll(post(proof()), {
      env: env(),
      store,
      verify: async () => portal(),
    });
    assert.equal(ok.status, 200);
    const before = store.records();

    const duplicate = await handleEnroll(post(proof({ session_id: sessionId('cd') })), {
      env: env(),
      store,
      verify: async () => portal(),
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(store.records(), before);
    assert.equal(store.records().length, 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

function human(nullifier: string) {
  return {
    identifier: 'proof_of_human',
    issuer_schema_id: 1,
    nullifier,
    expires_at_min: 49012345,
    proof: [PROOF_MARKER, '0x2', '0x3', '0x4', '0x5'],
  };
}

function portalFor(nullifier: string): PortalCallResult {
  const hex = `0x${BigInt(nullifier).toString(16).padStart(64, '0')}`;
  return portal({
    nullifier: hex,
    results: [{ identifier: 'proof_of_human', success: true, nullifier: hex }],
  });
}

test('missing configuration and an unavailable World service stay controlled', async () => {
  await withStore(async (store) => {
    const missing = await handleEnroll(post(proof()), {
      env: { ...env(), WORLD_SESSION_ENCRYPTION_KEY: undefined },
      store,
      verify: async () => portal(),
    });
    const missingBody = (await missing.json()) as { error: string };
    assert.equal(missing.status, 500);
    assert.equal(missingBody.error, 'WORLD_SESSION_ENCRYPTION_KEY is not configured');
    assert.equal(missingBody.error.includes(SIGNING_KEY), false);

    const reused = await handleEnroll(post(proof()), {
      env: { ...env(), WORLD_SESSION_ENCRYPTION_KEY: SIGNING_KEY },
      store,
      verify: async () => portal(),
    });
    const reusedBody = (await reused.json()) as { error: string };
    assert.equal(reused.status, 500);
    assert.equal(reusedBody.error, 'WORLD_SESSION_ENCRYPTION_KEY must not reuse the RP signing key');
    assert.equal(reusedBody.error.includes(SIGNING_KEY), false);

    const unavailable = await handleEnroll(post(proof()), {
      env: env(),
      store,
      verify: async () => {
        throw new (await import('./enrollmentProof.ts')).EnrollmentRejected('world_unavailable');
      },
    });
    assert.equal(unavailable.status, 503);
    assert.equal(store.records().length, 0);
  });
});

test('malformed and oversized bodies are rejected', async () => {
  await withStore(async (store) => {
    const malformed = await handleEnroll(
      new Request('http://localhost/api/world/enroll', { method: 'POST', body: '{' }),
      { env: env(), store, verify: async () => portal() },
    );
    assert.equal(malformed.status, 400);

    const oversized = await handleEnroll(
      new Request('http://localhost/api/world/enroll', {
        method: 'POST',
        body: `{"padding":"${'a'.repeat(300_000)}"}`,
      }),
      { env: env(), store, verify: async () => portal() },
    );
    assert.equal(oversized.status, 400);
    assert.equal(store.records().length, 0);
  });
});
