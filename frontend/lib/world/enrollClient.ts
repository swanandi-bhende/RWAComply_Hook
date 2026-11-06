import {
  CredentialRequest,
  IDKit,
  type IDKitCompletionResult,
  type IDKitRequestConfig,
  type RpContext,
} from '@worldcoin/idkit-core';
import type { WorldEnvironment } from './config.ts';

export type EnrollmentClientSuccess = {
  ok: true;
  sessionId: string;
};

export type EnrollmentClientFailure = {
  ok: false;
  reason:
    | 'cancelled'
    | 'timeout'
    | 'world_app_unavailable'
    | 'proof_failed'
    | 'verification_rejected'
    | 'already_enrolled'
    | 'world_unavailable'
    | 'unexpected';
};

export type EnrollmentClientResult = EnrollmentClientSuccess | EnrollmentClientFailure;

type RpContextResponse = {
  app_id?: unknown;
  environment?: unknown;
  rp_context?: Partial<RpContext>;
};

export type ProofOfHumanRequest = {
  connectorURI: string;
  pollUntilCompletion: (options?: { timeout?: number; signal?: AbortSignal }) => Promise<IDKitCompletionResult>;
  getDebugReport?: () => { request_payload?: unknown };
};

export function enrollmentRequestConfig(input: {
  appId: `app_${string}`;
  rpContext: RpContext;
  environment: WorldEnvironment;
}): IDKitRequestConfig {
  return {
    app_id: input.appId,
    action: 'signup',
    session_id: 'create',
    rp_context: input.rpContext,
    allow_legacy_proofs: false,
    environment: input.environment,
  };
}

export function openProofOfHumanRequest(config: IDKitRequestConfig): Promise<ProofOfHumanRequest> {
  return IDKit.request(config).constraints(CredentialRequest('proof_of_human'));
}

function isRpContext(value: Partial<RpContext> | undefined): value is RpContext {
  return !!value &&
    typeof value.rp_id === 'string' &&
    typeof value.nonce === 'string' &&
    typeof value.created_at === 'number' &&
    typeof value.expires_at === 'number' &&
    typeof value.signature === 'string' &&
    value.expires_at > value.created_at;
}

function completionFailure(error: string): EnrollmentClientFailure {
  if (error === 'user_rejected') return { ok: false, reason: 'cancelled' };
  if (error === 'timeout') return { ok: false, reason: 'timeout' };
  if (
    error === 'connection_failed' ||
    error === 'world_id_4_not_available' ||
    error === 'feature_unavailable'
  ) {
    return { ok: false, reason: 'world_app_unavailable' };
  }
  return { ok: false, reason: 'proof_failed' };
}

export async function enrollProofOfHuman(options: {
  fetchImpl?: typeof fetch;
  openRequest?: (config: IDKitRequestConfig) => Promise<ProofOfHumanRequest>;
  signal?: AbortSignal;
  timeoutMs?: number;
} = {}): Promise<EnrollmentClientResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const openRequest = options.openRequest ?? openProofOfHumanRequest;

  let contextBody: RpContextResponse;
  try {
    const response = await fetchImpl('/api/world/rp-context', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intent: 'signup' }),
      signal: options.signal,
    });
    if (!response.ok) return { ok: false, reason: 'unexpected' };
    contextBody = (await response.json()) as RpContextResponse;
  } catch {
    return { ok: false, reason: 'unexpected' };
  }

  if (typeof contextBody.app_id !== 'string' || !contextBody.app_id.startsWith('app_')) {
    return { ok: false, reason: 'unexpected' };
  }
  if (contextBody.environment !== 'staging' && contextBody.environment !== 'production') {
    return { ok: false, reason: 'unexpected' };
  }
  if (!isRpContext(contextBody.rp_context)) return { ok: false, reason: 'unexpected' };

  const config = enrollmentRequestConfig({
    appId: contextBody.app_id as `app_${string}`,
    rpContext: contextBody.rp_context,
    environment: contextBody.environment,
  });

  let request: ProofOfHumanRequest;
  try {
    request = await openRequest(config);
  } catch {
    return { ok: false, reason: 'world_app_unavailable' };
  }

  const completion = await request.pollUntilCompletion({
    timeout: options.timeoutMs,
    signal: options.signal,
  });
  if (!completion.success) return completionFailure(String(completion.error));

  let enrollResponse: Response;
  try {
    enrollResponse = await fetchImpl('/api/world/enroll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(completion.result),
      signal: options.signal,
    });
  } catch {
    return { ok: false, reason: 'unexpected' };
  }

  if (enrollResponse.status === 409) return { ok: false, reason: 'already_enrolled' };
  if (enrollResponse.status === 503) return { ok: false, reason: 'world_unavailable' };
  if (enrollResponse.status === 422 || enrollResponse.status === 401) {
    return { ok: false, reason: 'verification_rejected' };
  }
  if (!enrollResponse.ok) return { ok: false, reason: 'unexpected' };

  const body = (await enrollResponse.json()) as { success?: unknown; session_id?: unknown };
  if (body.success !== true || typeof body.session_id !== 'string') {
    return { ok: false, reason: 'unexpected' };
  }
  return { ok: true, sessionId: body.session_id };
}
