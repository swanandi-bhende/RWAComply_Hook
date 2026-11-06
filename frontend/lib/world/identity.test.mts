import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { newResumeToken, RESUME_COOKIE } from './browserResume.ts';
import { encryptSessionId } from './sessionCrypto.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import { handleIdentity, handleResume } from './identity.ts';

const SIGNING_KEY = `0x${'ab'.repeat(32)}` as const;
const ENCRYPTION_KEY = `0x${'cd'.repeat(32)}`;
const SESSION = `session_${'ab'.padStart(64, '0')}01${'0'.repeat(62)}`;

function env() {
  return {
    WORLD_APP_ID: 'app_test_fixture',
    WORLD_RP_ID: 'rp_a11ce',
    WORLD_PRIVATE_KEY: SIGNING_KEY,
    WORLD_RP_SIGNER_ADDRESS: privateKeyToAccount(SIGNING_KEY).address,
    WORLD_SESSION_ENCRYPTION_KEY: ENCRYPTION_KEY,
    WORLD_ID_ENVIRONMENT: 'staging',
  };
}

function request(cookie?: string): Request {
  return new Request('http://localhost/api/world/identity', {
    headers: cookie ? { cookie } : {},
  });
}

test('a verified session survives refresh and is not readable by another browser', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-identity-'));
  const store = new EnrollmentStore(path.join(directory, 'enroll.sqlite'));
  try {
    const inserted = store.insert({
      appId: 'app_test_fixture',
      rpId: 'rp_a11ce',
      environment: 'staging',
      action: 'signup',
      credential: 'proof_of_human',
      nullifierHash: '1',
      session: encryptSessionId(SESSION, Buffer.from(ENCRYPTION_KEY.slice(2), 'hex')),
      allocationId: `0x${'11'.repeat(32)}`,
      enrolledAt: new Date(0).toISOString(),
      sessionIdHash: 'hash',
    });
    assert.equal(inserted.ok, true);
    const enrollment = store.records()[0];
    const resume = newResumeToken();
    store.saveResume({
      enrollmentId: enrollment.id,
      tokenHash: resume.tokenHash,
      expiresAt: 2_000,
      createdAt: new Date(0).toISOString(),
    });
    const cookie = `${RESUME_COOKIE}=${resume.token}`;
    const parsed = await handleIdentity(request(cookie), { env: env(), store, now: () => 1_000_000 }).json() as {
      state: string;
      linkedWallets: string[];
      session_id?: string;
    };
    assert.equal(parsed.state, 'verified');
    assert.equal(parsed.session_id, undefined);
    assert.deepEqual(parsed.linkedWallets, []);
    const stranger = await handleIdentity(request(`${RESUME_COOKIE}=${'ab'.repeat(32)}`), {
      env: env(),
      store,
      now: () => 1_000_000,
    }).json() as { state: string };
    assert.equal(stranger.state, 'unverified');
    const resumed = await handleResume(new Request('http://localhost/api/world/resume', { method: 'POST', headers: { cookie } }), {
      env: env(),
      store,
      now: () => 1_000_000,
    }).json() as { session_id?: string; allocationId?: string };
    assert.equal(resumed.session_id, SESSION);
    assert.equal(resumed.allocationId, undefined);
    const expired = await handleIdentity(request(cookie), { env: env(), store, now: () => 3_000_000 }).json() as { state: string };
    assert.equal(expired.state, 'expired');
    const blocked = await handleResume(new Request('http://localhost/api/world/resume', { method: 'POST', headers: { cookie } }), {
      env: env(),
      store,
      now: () => 3_000_000,
    });
    assert.equal(blocked.status, 410);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an absent session is unverified and a failed proof is not stored as verified', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-identity-'));
  const store = new EnrollmentStore(path.join(directory, 'enroll.sqlite'));
  try {
    const body = await handleIdentity(request(), { env: env(), store, now: () => 1 }).json() as { state: string };
    assert.equal(body.state, 'unverified');
    assert.equal(store.records().length, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
