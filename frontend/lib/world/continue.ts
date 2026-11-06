import { randomBytes } from 'node:crypto';
import { WorldConfigError, readEnrollmentConfig, type WorldEnv } from './config.ts';
import { portalVerifyClient, type WorldVerifyClient } from './enroll.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import { decryptSessionId, domainHash, CONTINUATION_GRANT_HASH_DOMAIN, SESSION_ID_HASH_DOMAIN } from './sessionCrypto.ts';
import {
  acceptSessionPortal,
  classifySessionProof,
  SessionProofRejected,
  sessionProofMessage,
  sessionProofStatus,
} from './sessionProof.ts';

const MAX_BODY_BYTES = 256 * 1024;
export const CONTINUATION_GRANT_TTL_SECONDS = 300;

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function handleContinue(
  request: Request,
  options: {
    env?: WorldEnv;
    verify?: WorldVerifyClient;
    store?: EnrollmentStore;
    now?: () => number;
  } = {},
): Promise<Response> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: sessionProofMessage('invalid_body') }, 400);
  }
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return json({ error: 'Request body is too large' }, 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return json({ error: sessionProofMessage('invalid_body') }, 400);
  }

  let config: ReturnType<typeof readEnrollmentConfig>;
  try {
    config = readEnrollmentConfig(options.env ?? process.env);
  } catch (error) {
    const message = error instanceof WorldConfigError ? error.message : 'World ID configuration is unavailable';
    return json({ error: message }, 500);
  }
  const store = options.store;
  if (!store) return json({ error: 'Enrollment storage is unavailable' }, 500);

  const nowSeconds = Math.floor((options.now ?? Date.now)() / 1000);
  try {
    const bound = classifySessionProof(payload, config.environment, nowSeconds);
    if (
      payload &&
      typeof payload === 'object' &&
      typeof (payload as { rp_id?: unknown }).rp_id === 'string' &&
      (payload as { rp_id: string }).rp_id !== config.rpId
    ) {
      return json({ error: sessionProofMessage('invalid_proof') }, 422);
    }

    const enrollment = store.findBySessionHash(domainHash(SESSION_ID_HASH_DOMAIN, bound.sessionId));
    if (
      !enrollment ||
      enrollment.appId !== config.appId ||
      enrollment.rpId !== config.rpId ||
      enrollment.environment !== config.environment
    ) {
      return json({ error: 'This World ID session is not enrolled' }, 404);
    }
    let storedSession = '';
    try {
      storedSession = decryptSessionId(enrollment.session, config.sessionEncryptionKey);
    } catch {
      return json({ error: 'This World ID session is not enrolled' }, 404);
    }
    if (storedSession !== bound.sessionId) {
      return json({ error: 'This World ID session is not enrolled' }, 404);
    }

    const portal = await (options.verify ?? portalVerifyClient())({ rpId: config.rpId, rawBody });
    acceptSessionPortal(portal, bound.sessionId, config.environment);

    const token = randomBytes(32).toString('hex');
    const expiresAt = nowSeconds + CONTINUATION_GRANT_TTL_SECONDS;
    store.insertGrant({
      tokenHash: domainHash(CONTINUATION_GRANT_HASH_DOMAIN, token),
      enrollmentId: enrollment.id,
      expiresAt,
      createdAt: new Date(nowSeconds * 1000).toISOString(),
    });
    return json({ continuation_token: token, expires_at: expiresAt }, 200);
  } catch (error) {
    if (error instanceof SessionProofRejected) {
      return json({ error: sessionProofMessage(error.code) }, sessionProofStatus(error.code));
    }
    return json({ error: 'Session continuation could not be completed' }, 500);
  }
}
