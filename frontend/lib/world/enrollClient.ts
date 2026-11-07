import {
  CredentialRequest,
  IDKit,
  IDKitErrorCodes,
  type IDKitCompletionResult,
  type IDKitRequestConfig,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit-core';
import type { WorldEnvironment } from './config.ts';
import { httpsReturnTo } from './handoff.ts';
import type { SessionIdStore } from './sessionStore.ts';

export type EnrollmentClientSuccess = {
  ok: true;
  sessionId: string;
  continuationToken?: string;
};

export type EnrollmentClientFailure = {
  ok: false;
  reason:
    | 'cancelled'
    | 'timeout'
    | 'world_app_unavailable'
    | 'proof_failed'
    | 'verification_rejected'
    | 'environment_mismatch'
    | 'configuration'
    | 'already_enrolled'
    | 'world_unavailable'
    | 'unexpected';
  message?: string;
};

export type EnrollmentClientResult = EnrollmentClientSuccess | EnrollmentClientFailure;

type RpContextResponse = {
  app_id?: unknown;
  environment?: unknown;
  rp_context?: Partial<RpContext>;
};

export type WorldProofStatus = 'waiting_for_connection' | 'awaiting_confirmation';

export type ProofOfHumanRequest = {
  connectorURI: string;
  requestId?: string;
  pollUntilCompletion: (options?: { timeout?: number; signal?: AbortSignal }) => Promise<IDKitCompletionResult>;
  pollOnce?: () => Promise<{ type: string; result?: IDKitResult; error?: string }>;
  getDebugReport?: () => { request_payload?: unknown };
};

export function enrollmentRequestConfig(input: {
  appId: `app_${string}`;
  rpContext: RpContext;
  environment: WorldEnvironment;
  returnTo?: string;
}): IDKitRequestConfig {
  return {
    app_id: input.appId,
    action: 'signup',
    action_description: 'RWAComply proof of human',
    session_id: 'create',
    rp_context: input.rpContext,
    allow_legacy_proofs: false,
    environment: input.environment,
    ...(input.returnTo ? { return_to: input.returnTo } : {}),
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

export async function waitForProof(
  request: ProofOfHumanRequest,
  options: { timeout: number; signal?: AbortSignal; onStatus?: (status: WorldProofStatus) => void },
): Promise<IDKitCompletionResult> {
  if (!request.pollOnce) {
    return request.pollUntilCompletion({ timeout: options.timeout, signal: options.signal });
  }
  const deadline = Date.now() + options.timeout;
  const requestId = request.requestId;
  while (Date.now() < deadline) {
    if (options.signal?.aborted) return { success: false, error: IDKitErrorCodes.Cancelled };
    if (request.requestId && requestId && request.requestId !== requestId) {
      return { success: false, error: IDKitErrorCodes.GenericError };
    }
    let status: { type: string; result?: IDKitResult; error?: string };
    try {
      status = await request.pollOnce();
    } catch {
      if (options.signal?.aborted || Date.now() >= deadline) {
        return { success: false, error: options.signal?.aborted ? IDKitErrorCodes.Cancelled : IDKitErrorCodes.Timeout };
      }
      await delay(Math.min(1000, Math.max(0, deadline - Date.now())), options.signal);
      continue;
    }
    if (status.type === 'waiting_for_connection' || status.type === 'awaiting_confirmation') {
      options.onStatus?.(status.type);
    }
    if (status.type === 'confirmed' && status.result) return { success: true, result: status.result };
    if (status.type === 'failed') {
      const code = status.error ?? IDKitErrorCodes.GenericError;
      const known = (Object.values(IDKitErrorCodes) as string[]).includes(code);
      return {
        success: false,
        error: (known ? code : IDKitErrorCodes.GenericError) as Extract<IDKitCompletionResult, { success: false }>['error'],
      };
    }
    await delay(Math.min(1000, Math.max(0, deadline - Date.now())), options.signal);
  }
  return { success: false, error: IDKitErrorCodes.Timeout };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

const SAFE_ENROLLMENT_MESSAGES = new Set([
  'Invalid request body',
  'The World ID proof is expired',
  'The World ID action is not signup',
  'The World ID credential is not Proof of Human',
  'The World ID environment does not match this server',
  'The proof is not bound to a new session',
  'A session proof without Proof of Human uniqueness cannot enroll',
  'The uniqueness nullifier is missing',
  'World ID verification timed out',
  'World ID verification is unavailable',
  'The World ID proof is invalid',
  'This Proof of Human enrollment already exists',
  'Enrollment could not be completed',
]);

function devWorldLog(event: string, fields: Record<string, string | number | boolean>): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info(`[world] ${event} ${JSON.stringify(fields)}`);
}

function completionSummary(result: IDKitResult): Record<string, string | number | boolean> {
  const responses = Array.isArray(result.responses) ? result.responses : [];
  return {
    protocolVersion: result.protocol_version,
    sessionPresent: 'session_id' in result && typeof result.session_id === 'string',
    actionPresent: 'action' in result && typeof result.action === 'string',
    environment: typeof result.environment === 'string' ? result.environment : 'missing',
    responseCount: responses.length,
    nullifierPresent: responses.some((item) => 'nullifier' in item && typeof item.nullifier === 'string'),
    sessionNullifierPresent: responses.some((item) => 'session_nullifier' in item),
  };
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
  sessionStore?: SessionIdStore;
  signal?: AbortSignal;
  timeoutMs?: number;
  returnTo?: string;
  onHandoff?: (handoff: { connectorURI: string; expiresAt: number; requestId?: string; environment: WorldEnvironment }) => void;
  onStatus?: (status: WorldProofStatus) => void;
  onProofReceived?: () => void;
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
    if (!response.ok) return { ok: false, reason: 'world_unavailable' };
    contextBody = (await response.json()) as RpContextResponse;
  } catch {
    return { ok: false, reason: 'world_unavailable' };
  }

  if (typeof contextBody.app_id !== 'string' || !contextBody.app_id.startsWith('app_')) {
    return { ok: false, reason: 'configuration' };
  }
  if (
    contextBody.environment !== 'staging' &&
    contextBody.environment !== 'production' &&
    contextBody.environment !== 'sandbox'
  ) {
    return { ok: false, reason: 'environment_mismatch' };
  }
  if (!isRpContext(contextBody.rp_context)) return { ok: false, reason: 'configuration' };

  const environment = contextBody.environment;
  const config = enrollmentRequestConfig({
    appId: contextBody.app_id as `app_${string}`,
    rpContext: contextBody.rp_context,
    environment,
    returnTo: httpsReturnTo(options.returnTo),
  });

  let request: ProofOfHumanRequest;
  try {
    request = await openRequest(config);
  } catch {
    return { ok: false, reason: 'world_app_unavailable' };
  }

  options.onHandoff?.({
    connectorURI: request.connectorURI,
    expiresAt: contextBody.rp_context.expires_at,
    requestId: request.requestId,
    environment,
  });
  const completion = await waitForProof(request, {
    timeout: options.timeoutMs ?? Math.max(1000, contextBody.rp_context.expires_at * 1000 - Date.now()),
    signal: options.signal,
    onStatus: options.onStatus,
  });
  if (!completion.success) {
    devWorldLog('idkit_completion', { success: false, error: String(completion.error) });
    return completionFailure(String(completion.error));
  }
  devWorldLog('idkit_completion', { success: true, ...completionSummary(completion.result) });
  options.onProofReceived?.();

  let enrollResponse: Response;
  try {
    enrollResponse = await fetchImpl('/api/world/enroll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(completion.result),
      signal: options.signal,
    });
  } catch {
    return { ok: false, reason: 'world_unavailable' };
  }

  const failureBody = enrollResponse.ok
    ? null
    : (await enrollResponse.clone().json().catch(() => null)) as { error?: unknown } | null;
  const failureMessage = SAFE_ENROLLMENT_MESSAGES.has(String(failureBody?.error))
    ? String(failureBody?.error)
    : '';
  devWorldLog('enroll_response', {
    status: enrollResponse.status,
    safeMessage: failureMessage !== '',
  });
  if (enrollResponse.status === 409) return { ok: false, reason: 'already_enrolled', message: failureMessage || undefined };
  if (enrollResponse.status === 503) return { ok: false, reason: 'world_unavailable', message: failureMessage || undefined };
  if (enrollResponse.status === 422 || enrollResponse.status === 401) {
    if (failureMessage.includes('environment does not match')) {
      return { ok: false, reason: 'environment_mismatch', message: failureMessage };
    }
    return { ok: false, reason: 'verification_rejected', message: failureMessage || undefined };
  }
  if (!enrollResponse.ok) return { ok: false, reason: 'unexpected', message: failureMessage || undefined };

  const body = (await enrollResponse.json()) as {
    success?: unknown;
    session_id?: unknown;
    continuation_token?: unknown;
  };
  if (body.success !== true || typeof body.session_id !== 'string') {
    return { ok: false, reason: 'unexpected' };
  }
  options.sessionStore?.write(body.session_id);
  return {
    ok: true,
    sessionId: body.session_id,
    continuationToken: typeof body.continuation_token === 'string' ? body.continuation_token : undefined,
  };
}
