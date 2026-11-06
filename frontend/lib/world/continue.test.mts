import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { handleContinue } from './continue.ts';
import { handleEnroll } from './enroll.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import type { PortalCallResult } from './enrollmentProof.ts';

const APP_ID = 'app_test_fixture';
const RP_ID = 'rp_a11ce';
const SIGNING_KEY = `0x${'ab'.repeat(32)}` as const;
const ENCRYPTION_KEY = `0x${'cd'.repeat(32)}`;
const NOW_MS = 1_800_000_000_000;
const NOW_SECONDS = NOW_MS / 1000;
const SESSION_NULLIFIER = '123456789';

function sessionId(tag: string): string {
  return `session_${tag.padStart(64, '0')}01${'0'.repeat(62)}`;
}

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    WORLD_APP_ID: APP_ID,
    WORLD_RP_ID: RP_ID,
    WORLD_PRIVATE_KEY: SIGNING_KEY,
    WORLD_RP_SIGNER_ADDRESS: privateKeyToAccount(SIGNING_KEY).address,
    WORLD_SESSION_ENCRYPTION_KEY: ENCRYPTION_KEY,
    WORLD_ID_ENVIRONMENT: 'staging',
    ...overrides,
  };
}

function enrollmentProof(id = sessionId('ab')) {
  return {
    protocol_version: '4.0',
    nonce: `0x${'11'.repeat(32)}`,
    action: 'signup',
    session_id: id,
    environment: 'staging',
    responses: [{
      identifier: 'proof_of_human',
      issuer_schema_id: 1,
      nullifier: '12345678901234567890',
      proof: ['1', '2', '3', '4', '5'],
      expires_at_min: NOW_SECONDS + 1000,
    }],
  };
}

function sessionProof(id = sessionId('ab'), overrides: Record<string, unknown> = {}) {
  return {
    protocol_version: '4.0',
    nonce: `0x${'22'.repeat(32)}`,
    session_id: id,
    environment: 'staging',
    responses: [{
      identifier: 'proof_of_human',
      issuer_schema_id: 1,
      session_nullifier: [SESSION_NULLIFIER, '987654321'],
      proof: ['1', '2', '3', '4', '5'],
      expires_at_min: NOW_SECONDS + 1000,
    }],
    ...overrides,
  };
}

function portal(id = sessionId('ab'), bodyOverrides: Record<string, unknown> = {}): PortalCallResult {
  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      protocol_version: '4.0',
      environment: 'staging',
      session_id: id,
      results: [{ identifier: 'proof_of_human', success: true, sessionId: id, nullifier: SESSION_NULLIFIER }],
      ...bodyOverrides,
    },
  };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/world/continue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function enrolledStore(): Promise<{ directory: string; store: EnrollmentStore }> {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-continue-'));
  const store = new EnrollmentStore(path.join(directory, 'enroll.sqlite'));
  const response = await handleEnroll(post(enrollmentProof()), {
    env: env(),
    store,
    verify: async () => ({
      ok: true,
      status: 200,
      body: {
        success: true,
        protocol_version: '4.0',
        action: 'signup',
        environment: 'staging',
        nullifier: '12345678901234567890',
        results: [{
          identifier: 'proof_of_human',
          success: true,
          nullifier: '12345678901234567890',
        }],
      },
    }),
  });
  assert.equal(response.status, 200);
  return { directory, store };
}

test('an enrolled session proof returns a one-time continuation grant', async () => {
  const { directory, store } = await enrolledStore();
  let verifiedRp = '';
  try {
    const response = await handleContinue(post(sessionProof()), {
      env: env(),
      store,
      now: () => NOW_MS,
      verify: async ({ rpId, rawBody }) => {
        verifiedRp = rpId;
        assert.equal(JSON.parse(rawBody).session_id, sessionId('ab'));
        return portal();
      },
    });
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(verifiedRp, RP_ID);
    assert.equal(typeof body.continuation_token, 'string');
    assert.equal(body.expires_at, NOW_SECONDS + 300);
    assert.deepEqual(Object.keys(body).sort(), ['continuation_token', 'expires_at']);
    const stored = readFileSync(path.join(directory, 'enroll.sqlite'));
    assert.equal(stored.includes(Buffer.from(String(body.continuation_token))), false);
    assert.equal(stored.includes(Buffer.from(SESSION_NULLIFIER)), false);
    assert.equal(stored.includes(Buffer.from(sessionId('ab'))), false);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('unknown, malformed, and mismatched sessions are rejected before World verification', async () => {
  const { directory, store } = await enrolledStore();
  let calls = 0;
  const verify = async () => {
    calls += 1;
    return portal();
  };
  try {
    const unknown = await handleContinue(post(sessionProof(sessionId('cd'))), {
      env: env(),
      store,
      now: () => NOW_MS,
      verify,
    });
    assert.equal(unknown.status, 404);

    const malformed = await handleContinue(post(sessionProof('session_not-valid')), {
      env: env(),
      store,
      now: () => NOW_MS,
      verify,
    });
    assert.equal(malformed.status, 422);

    const wrongApp = await handleContinue(post(sessionProof()), {
      env: env({ WORLD_APP_ID: 'app_other_fixture' }),
      store,
      now: () => NOW_MS,
      verify,
    });
    assert.equal(wrongApp.status, 404);

    const wrongRp = await handleContinue(post(sessionProof()), {
      env: env({ WORLD_RP_ID: 'rp_b0b' }),
      store,
      now: () => NOW_MS,
      verify,
    });
    assert.equal(wrongRp.status, 404);

    const wrongEnvironment = await handleContinue(
      post(sessionProof(sessionId('ab'), { environment: 'production' })),
      {
        env: env({ WORLD_ID_ENVIRONMENT: 'production' }),
        store,
        now: () => NOW_MS,
        verify,
      },
    );
    assert.equal(wrongEnvironment.status, 404);
    assert.equal(calls, 0);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('session proofs reject uniqueness proofs, bad credentials, and failed World responses', async () => {
  const { directory, store } = await enrolledStore();
  const cases: Array<{ body: unknown; portal?: PortalCallResult; status: number }> = [
    { body: sessionProof(sessionId('ab'), { protocol_version: '3.0' }), status: 422 },
    { body: sessionProof(sessionId('ab'), { action: 'signup' }), status: 422 },
    {
      body: sessionProof(sessionId('ab'), {
        responses: [{
          identifier: 'selfie',
          issuer_schema_id: 11,
          session_nullifier: [SESSION_NULLIFIER, '1'],
          proof: ['1', '2', '3', '4', '5'],
          expires_at_min: NOW_SECONDS + 1000,
        }],
      }),
      status: 422,
    },
    {
      body: sessionProof(sessionId('ab'), {
        responses: [{
          identifier: 'proof_of_human',
          issuer_schema_id: 1,
          session_nullifier: [SESSION_NULLIFIER],
          proof: ['1', '2', '3', '4', '5'],
          expires_at_min: NOW_SECONDS + 1000,
        }],
      }),
      status: 422,
    },
    {
      body: sessionProof(sessionId('ab'), {
        responses: [{
          identifier: 'proof_of_human',
          issuer_schema_id: 1,
          nullifier: SESSION_NULLIFIER,
          proof: ['1', '2', '3', '4', '5'],
          expires_at_min: NOW_SECONDS + 1000,
        }],
      }),
      status: 422,
    },
    {
      body: sessionProof(sessionId('ab'), {
        responses: [{
          identifier: 'proof_of_human',
          issuer_schema_id: 1,
          session_nullifier: [SESSION_NULLIFIER, '1'],
          proof: ['1', '2', '3', '4', '5'],
          expires_at_min: NOW_SECONDS - 1,
        }],
      }),
      status: 422,
    },
    { body: sessionProof(), portal: { ok: false, status: 400, body: { code: 'all_verifications_failed' } }, status: 422 },
    { body: sessionProof(), portal: portal(sessionId('cd')), status: 422 },
    {
      body: sessionProof(),
      portal: portal(sessionId('ab'), {
        results: [
          { identifier: 'proof_of_human', success: true, sessionId: sessionId('ab') },
          { identifier: 'proof_of_human', success: true, sessionId: sessionId('ab') },
        ],
      }),
      status: 422,
    },
    {
      body: sessionProof(),
      portal: portal(sessionId('ab'), {
        results: [{ identifier: 'proof_of_human', success: false, sessionId: sessionId('ab') }],
      }),
      status: 422,
    },
  ];
  try {
    for (const item of cases) {
      const response = await handleContinue(post(item.body), {
        env: env(),
        store,
        now: () => NOW_MS,
        verify: async () => item.portal ?? portal(),
      });
      const body = (await response.json()) as { continuation_token?: string };
      assert.equal(response.status, item.status);
      assert.equal(body.continuation_token, undefined);
    }
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
