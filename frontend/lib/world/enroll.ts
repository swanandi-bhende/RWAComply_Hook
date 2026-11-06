import { WorldConfigError, readEnrollmentConfig, type WorldEnv } from './config.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import {
  acceptPortalVerification,
  classifyBoundEnrollment,
  EnrollmentRejected,
  enrollmentErrorMessage,
  enrollmentHttpStatus,
  newAllocationId,
  type PortalCallResult,
} from './enrollmentProof.ts';
import { encryptSessionId } from './sessionCrypto.ts';

const VERIFY_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 256 * 1024;

export type WorldVerifyClient = (input: {
  rpId: string;
  rawBody: string;
}) => Promise<PortalCallResult>;

export function portalVerifyClient(fetchImpl: typeof fetch = fetch): WorldVerifyClient {
  return async ({ rpId, rawBody }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
      const response = await fetchImpl(
        `https://developer.world.org/api/v4/verify/${encodeURIComponent(rpId)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: rawBody,
          signal: controller.signal,
        },
      );
      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = null;
        }
      }
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new EnrollmentRejected('world_timeout');
      }
      throw new EnrollmentRejected('world_unavailable');
    } finally {
      clearTimeout(timer);
    }
  };
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function failure(code: Parameters<typeof enrollmentHttpStatus>[0]): Response {
  return jsonResponse({ error: enrollmentErrorMessage(code) }, enrollmentHttpStatus(code));
}

export async function handleEnroll(
  request: Request,
  options: {
    env?: WorldEnv;
    verify?: WorldVerifyClient;
    store?: EnrollmentStore;
  } = {},
): Promise<Response> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return failure('invalid_body');
  }
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Request body is too large' }, 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return failure('invalid_body');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return failure('invalid_body');
  }

  let config: ReturnType<typeof readEnrollmentConfig>;
  try {
    config = readEnrollmentConfig(options.env ?? process.env);
  } catch (error) {
    if (error instanceof WorldConfigError) {
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ error: 'World ID configuration is unavailable' }, 500);
  }

  const store = options.store;
  if (!store) {
    return jsonResponse({ error: 'Enrollment storage is unavailable' }, 500);
  }

  if (
    typeof (payload as { rp_id?: unknown }).rp_id === 'string' &&
    (payload as { rp_id: string }).rp_id !== config.rpId
  ) {
    return failure('invalid_proof');
  }

  try {
    const bound = classifyBoundEnrollment(payload, config.environment);
    const portal = await (options.verify ?? portalVerifyClient())({
      rpId: config.rpId,
      rawBody,
    });
    acceptPortalVerification(portal, bound, config.environment);

    const encrypted = encryptSessionId(bound.sessionId, config.sessionEncryptionKey);
    const enrolledAt = new Date().toISOString();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const allocationId = newAllocationId();
      const inserted = store.insert({
        appId: config.appId,
        rpId: config.rpId,
        environment: config.environment,
        action: 'signup',
        credential: 'proof_of_human',
        nullifierHash: bound.nullifierHash,
        session: encrypted,
        allocationId,
        enrolledAt,
      });
      if (inserted.ok) {
        return jsonResponse({ success: true, session_id: bound.sessionId }, 200);
      }
      if (inserted.reason === 'duplicate_nullifier') {
        return jsonResponse({ error: 'This Proof of Human enrollment already exists' }, 409);
      }
    }
    return jsonResponse({ error: 'Enrollment could not be completed' }, 500);
  } catch (error) {
    if (error instanceof EnrollmentRejected) return failure(error.code);
    return jsonResponse({ error: 'Enrollment could not be completed' }, 500);
  }
}
