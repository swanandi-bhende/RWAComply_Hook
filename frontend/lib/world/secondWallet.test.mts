import assert from 'node:assert/strict';
import test from 'node:test';
import { runSecondWallet } from './secondWallet.ts';

test('a failed continuation does not authorize or register the second wallet', async () => {
  let authorized = false;
  let registered = false;
  const result = await runSecondWallet({
    continueSession: async () => ({ ok: false as const, reason: 'cancelled' }),
    authorize: async () => {
      authorized = true;
      return { ok: false as const, reason: 'unused' };
    },
    register: async () => {
      registered = true;
      return { ok: true };
    },
    readRemaining: async () => BigInt(1),
  });
  assert.equal(result.registered, false);
  assert.equal(result.stage, 'continuation');
  assert.equal(authorized, false);
  assert.equal(registered, false);
});

test('the second wallet reads the remaining budget left by the shared allocation', async () => {
  const calls: string[] = [];
  const result = await runSecondWallet({
    continueSession: async () => {
      calls.push('continue');
      return { ok: true as const, continuationToken: 'grant' };
    },
    authorize: async (token) => {
      calls.push(`authorize:${token}`);
      return { ok: true as const };
    },
    register: async () => {
      calls.push('register');
      return { ok: true };
    },
    readRemaining: async () => {
      calls.push('remaining');
      return BigInt(300_000_000);
    },
  });
  assert.deepEqual(calls, ['continue', 'authorize:grant', 'register', 'remaining']);
  assert.equal(result.registered, true);
  assert.equal(result.remaining, BigInt(300_000_000));
});
