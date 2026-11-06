import { BROWSER_RESUME_HASH_DOMAIN, decryptSessionId, domainHash } from './sessionCrypto.ts';
import { readEnrollmentConfig, WorldConfigError, type WorldEnv } from './config.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import { readResumeToken } from './browserResume.ts';

export type IdentityState = 'unverified' | 'verified' | 'expired';

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

type IdentityOptions = { env?: WorldEnv; store?: EnrollmentStore; now?: () => number };

function lookup(request: Request, options: IdentityOptions):
  | { ok: false; response: Response }
  | { ok: true; state: 'unverified' }
  | { ok: true; state: 'expired' }
  | { ok: true; state: 'verified'; store: EnrollmentStore; enrollmentId: number; sessionKey: Buffer } {
  let config: ReturnType<typeof readEnrollmentConfig>;
  try {
    config = readEnrollmentConfig(options.env ?? process.env);
  } catch (error) {
    const message = error instanceof WorldConfigError ? error.message : 'World ID configuration is unavailable';
    return { ok: false, response: json({ error: message }, 500) };
  }
  if (!options.store) return { ok: false, response: json({ error: 'Enrollment storage is unavailable' }, 500) };
  const token = readResumeToken(request.headers.get('cookie'));
  if (!token) return { ok: true, state: 'unverified' };
  const row = options.store.findResume(domainHash(BROWSER_RESUME_HASH_DOMAIN, token));
  if (!row) return { ok: true, state: 'unverified' };
  const nowSeconds = Math.floor((options.now ?? Date.now)() / 1000);
  if (row.expiresAt <= nowSeconds) return { ok: true, state: 'expired' };
  return {
    ok: true,
    state: 'verified',
    store: options.store,
    enrollmentId: row.enrollmentId,
    sessionKey: config.sessionEncryptionKey,
  };
}

export function handleIdentity(request: Request, options: IdentityOptions = {}): Response {
  const found = lookup(request, options);
  if (!found.ok) return found.response;
  if (found.state !== 'verified') return json({ state: found.state, linkedWallets: [] }, 200);
  return json({
    state: 'verified',
    linkedWallets: found.store.confirmedWallets(found.enrollmentId),
  }, 200);
}

export function handleResume(request: Request, options: IdentityOptions = {}): Response {
  const found = lookup(request, options);
  if (!found.ok) return found.response;
  if (found.state === 'unverified') return json({ error: 'No verified session is available in this browser.' }, 404);
  if (found.state === 'expired') {
    return json({ error: 'This verified session has expired. Verify with World App again if you choose to start again.' }, 410);
  }
  const enrollment = found.store.findById(found.enrollmentId);
  if (!enrollment) return json({ error: 'No verified session is available in this browser.' }, 404);
  try {
    const sessionId = decryptSessionId(enrollment.session, found.sessionKey);
    return json({ session_id: sessionId }, 200);
  } catch {
    return json({ error: 'No verified session is available in this browser.' }, 404);
  }
}
