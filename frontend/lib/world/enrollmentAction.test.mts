import assert from 'node:assert/strict';
import test from 'node:test';
import { runEnrollmentAction } from './enrollmentAction.ts';
import type { EnrollmentClientResult } from './enrollClient.ts';

test('a cancelled, failed, timed out, or rejected proof does not authorize or register the wallet', async () => {
  for (const reason of ['cancelled', 'proof_failed', 'timeout', 'verification_rejected'] as const) {
    let authorizeCalls = 0;
    let registerCalls = 0;
    const result = await runEnrollmentAction({
      enroll: async (): Promise<EnrollmentClientResult> => ({ ok: false, reason }),
      authorize: async () => {
        authorizeCalls += 1;
        return { ok: true as const };
      },
      register: async () => {
        registerCalls += 1;
        return { ok: true };
      },
    });
    assert.equal(result.registered, false);
    assert.equal(result.stage, 'enrollment');
    assert.equal(result.reason, reason);
    assert.equal(authorizeCalls, 0);
    assert.equal(registerCalls, 0);
  }
});

test('enrollment requests authorization and registration only after World ID succeeds', async () => {
  const order: string[] = [];
  const result = await runEnrollmentAction({
    enroll: async () => {
      order.push('enroll');
      return { ok: true as const, sessionId: 'session_test', continuationToken: 'grant' };
    },
    authorize: async (token) => {
      order.push(`authorize:${token}`);
      return { ok: true as const, wallet: '0xabc' };
    },
    register: async (authorization) => {
      order.push(`register:${authorization.wallet}`);
      return { ok: true };
    },
  });
  assert.equal(result.registered, true);
  assert.deepEqual(order, ['enroll', 'authorize:grant', 'register:0xabc']);
});

test('a rejected wallet authorization does not call registerWallet', async () => {
  let registerCalls = 0;
  const result = await runEnrollmentAction({
    enroll: async () => ({ ok: true as const, sessionId: 'session_test', continuationToken: 'grant' }),
    authorize: async () => ({ ok: false as const, reason: 'signature_rejected' }),
    register: async () => {
      registerCalls += 1;
      return { ok: true };
    },
  });
  assert.equal(result.registered, false);
  assert.equal(result.stage, 'authorization');
  assert.equal(registerCalls, 0);
});

test('a missing ledger returns the registration error and does not mark the wallet linked', async () => {
  let authorizeCalls = 0;
  const result = await runEnrollmentAction({
    enroll: async () => ({ ok: true as const, sessionId: 'session_test', continuationToken: 'grant' }),
    authorize: async () => {
      authorizeCalls += 1;
      return { ok: true as const };
    },
    register: async () => ({ ok: false, message: 'Wallet registration is unavailable because the allocation ledger could not be read.' }),
  });
  assert.equal(authorizeCalls, 1);
  assert.equal(result.registered, false);
  assert.equal(result.stage, 'registration');
  assert.match(result.message ?? '', /allocation ledger/);
});
