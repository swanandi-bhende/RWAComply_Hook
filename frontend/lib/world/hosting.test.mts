import assert from 'node:assert/strict';
import test from 'node:test';
import { cookieIsSecure, resumeCookie } from './browserResume.ts';
import { readEnrollmentConfig } from './config.ts';
import { limitedResponse, tooManyRequests } from './requestLimit.ts';

test('resume cookies are Secure only on https', () => {
  const local = new Request('http://127.0.0.1:3463/api/world/enroll');
  const hosted = new Request('https://example.vercel.app/api/world/enroll', { headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(cookieIsSecure(local), false);
  assert.equal(cookieIsSecure(hosted), true);
  const plain = resumeCookie('ab'.repeat(32));
  const secure = resumeCookie('ab'.repeat(32), 60, true);
  assert.equal(plain.includes('Secure'), false);
  assert.match(secure, /HttpOnly; SameSite=Lax; Path=\/; Max-Age=60; Secure$/);
});

test('hosted identity storage fails before opening SQLite', () => {
  assert.throws(
    () => readEnrollmentConfig({ VERCEL: '1' }),
    /Identity storage is not configured/,
  );
});

test('identity endpoints can reject a burst from one address', () => {
  const request = new Request('http://127.0.0.1/api/world/enroll', { headers: { 'x-forwarded-for': '203.0.113.9' } });
  for (let i = 0; i < 20; i += 1) assert.equal(tooManyRequests(request, 'hosting-test', 20, 60_000), false);
  assert.equal(tooManyRequests(request, 'hosting-test', 20, 60_000), true);
  assert.equal(limitedResponse().status, 429);
});
