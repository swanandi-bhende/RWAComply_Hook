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
import { httpsReturnTo, idkitEnvironment } from './handoff.ts';
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
    return { ok: false, reason: 'unexpected' };
  }
  if (
    contextBody.environment !== 'staging' &&
    contextBody.environment !== 'production' &&
    contextBody.environment !== 'sandbox'
  ) {
    return { ok: false, reason: 'unexpected' };
  }
  if (!isRpContext(contextBody.rp_context)) return { ok: false, reason: 'unexpected' };

  const environment = idkitEnvironment(contextBody.environment);
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
  if (!completion.success) return completionFailure(String(completion.error));
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

  if (enrollResponse.status === 409) return { ok: false, reason: 'already_enrolled' };
  if (enrollResponse.status === 503) return { ok: false, reason: 'world_unavailable' };
  if (enrollResponse.status === 422 || enrollResponse.status === 401) {
    return { ok: false, reason: 'verification_rejected' };
  }
  if (!enrollResponse.ok) return { ok: false, reason: 'unexpected' };

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
