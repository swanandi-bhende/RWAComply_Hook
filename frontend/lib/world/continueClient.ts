import {
  CredentialRequest,
  IDKit,
  type IDKitCompletionResult,
  type IDKitSessionConfig,
  type RpContext,
} from '@worldcoin/idkit-core';
import type { WorldEnvironment } from './config.ts';
import { httpsReturnTo, idkitEnvironment } from './handoff.ts';
import { SESSION_ID_PATTERN } from './sessionProof.ts';
import type { SessionIdStore } from './sessionStore.ts';
import { waitForProof, type ProofOfHumanRequest, type WorldProofStatus } from './enrollClient.ts';

export type ContinuationClientResult =
  | { ok: true; continuationToken: string; expiresAt: number }
  | {
      ok: false;
      reason:
        | 'missing_session'
        | 'invalid_session'
        | 'expired'
        | 'cancelled'
        | 'timeout'
        | 'world_app_unavailable'
        | 'proof_failed'
        | 'verification_rejected'
        | 'world_unavailable'
        | 'unexpected';
    };

type RpContextResponse = {
  app_id?: unknown;
  environment?: unknown;
  rp_context?: Partial<RpContext>;
};

function isRpContext(value: Partial<RpContext> | undefined): value is RpContext {
  return !!value &&
    typeof value.rp_id === 'string' &&
    typeof value.nonce === 'string' &&
    typeof value.created_at === 'number' &&
    typeof value.expires_at === 'number' &&
    typeof value.signature === 'string' &&
    value.expires_at > value.created_at &&
    !('action' in value);
}

export function sessionProofConfig(input: {
  appId: `app_${string}`;
  rpContext: RpContext;
  environment: WorldEnvironment;
  returnTo?: string;
}): IDKitSessionConfig {
  return {
    app_id: input.appId,
    action_description: 'RWAComply proof of human',
    rp_context: input.rpContext,
    environment: input.environment,
    ...(input.returnTo ? { return_to: input.returnTo } : {}),
  };
}

export function openSessionProof(
  sessionId: `session_${string}`,
  config: IDKitSessionConfig,
): Promise<ProofOfHumanRequest> {
  return IDKit.proveSession(sessionId, config).constraints(CredentialRequest('proof_of_human'));
}

function completionFailure(error: string): ContinuationClientResult {
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

export async function continueProofOfHuman(options: {
  sessionId?: string;
  sessionStore?: SessionIdStore;
  fetchImpl?: typeof fetch;
  openRequest?: (sessionId: `session_${string}`, config: IDKitSessionConfig) => Promise<ProofOfHumanRequest>;
  signal?: AbortSignal;
  timeoutMs?: number;
  returnTo?: string;
  onHandoff?: (handoff: { connectorURI: string; expiresAt: number; requestId?: string; environment: WorldEnvironment }) => void;
  onStatus?: (status: WorldProofStatus) => void;
  onProofReceived?: () => void;
} = {}): Promise<ContinuationClientResult> {
  let sessionId = options.sessionId ?? options.sessionStore?.read() ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!sessionId) {
    try {
      const resume = await fetchImpl('/api/world/resume', { method: 'POST', signal: options.signal });
      if (resume.status === 410) return { ok: false, reason: 'expired' };
      if (!resume.ok) return { ok: false, reason: 'missing_session' };
      const body = (await resume.json()) as { session_id?: unknown };
      sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    } catch {
      return { ok: false, reason: 'missing_session' };
    }
  }
  if (!sessionId) return { ok: false, reason: 'missing_session' };
  if (!SESSION_ID_PATTERN.test(sessionId)) return { ok: false, reason: 'invalid_session' };

  const openRequest = options.openRequest ?? openSessionProof;
  let contextBody: RpContextResponse;
  try {
    const response = await fetchImpl('/api/world/rp-context', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intent: 'continue' }),
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
  const config = sessionProofConfig({
    appId: contextBody.app_id as `app_${string}`,
    rpContext: contextBody.rp_context,
    environment,
    returnTo: httpsReturnTo(options.returnTo),
  });
  let request: ProofOfHumanRequest;
  try {
    request = await openRequest(sessionId as `session_${string}`, config);
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

  let continueResponse: Response;
  try {
    continueResponse = await fetchImpl('/api/world/continue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(completion.result),
      signal: options.signal,
    });
  } catch {
    return { ok: false, reason: 'world_unavailable' };
  }
  if (continueResponse.status === 503) return { ok: false, reason: 'world_unavailable' };
  if (continueResponse.status === 422 || continueResponse.status === 404) {
    return { ok: false, reason: 'verification_rejected' };
  }
  if (!continueResponse.ok) return { ok: false, reason: 'unexpected' };
  const body = (await continueResponse.json()) as { continuation_token?: unknown; expires_at?: unknown };
  if (typeof body.continuation_token !== 'string' || typeof body.expires_at !== 'number') {
    return { ok: false, reason: 'unexpected' };
  }
  return { ok: true, continuationToken: body.continuation_token, expiresAt: body.expires_at };
}

export type { IDKitCompletionResult };
