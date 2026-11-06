import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { decryptSessionId, encryptSessionId } from './sessionCrypto.ts';

const sessionId = `session_${'ab'.repeat(32)}01${'cd'.repeat(31)}`;

test('session encryption round-trips with a fresh IV', () => {
  const key = randomBytes(32);
  const first = encryptSessionId(sessionId, key);
  const second = encryptSessionId(sessionId, key);
  assert.equal(decryptSessionId(first, key), sessionId);
  assert.equal(decryptSessionId(second, key), sessionId);
  assert.notEqual(first.iv, second.iv);
  assert.equal(Buffer.from(first.iv, 'base64').length, 12);
  assert.equal(first.ciphertext.includes(sessionId), false);
});

test('tampered ciphertext is rejected', () => {
  const key = randomBytes(32);
  const encrypted = encryptSessionId(sessionId, key);
  const bytes = Buffer.from(encrypted.ciphertext, 'base64');
  bytes[0] ^= 0xff;
  assert.throws(
    () => decryptSessionId({ ...encrypted, ciphertext: bytes.toString('base64') }, key),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Session decryption failed');
      assert.equal(error.message.includes(sessionId), false);
      return true;
    },
  );
});

test('a different encryption key cannot decrypt the session', () => {
  const encrypted = encryptSessionId(sessionId, randomBytes(32));
  const other = randomBytes(32);
  assert.throws(
    () => decryptSessionId(encrypted, other),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Session decryption failed');
      assert.equal(error.message.includes(other.toString('hex')), false);
      return true;
    },
  );
});
