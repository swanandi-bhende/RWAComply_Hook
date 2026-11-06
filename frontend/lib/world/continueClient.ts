import {
  CredentialRequest,
  IDKit,
  type IDKitCompletionResult,
  type IDKitSessionConfig,
  type RpContext,
} from '@worldcoin/idkit-core';
import type { WorldEnvironment } from './config.ts';
import { SESSION_ID_PATTERN } from './sessionProof.ts';
import type { SessionIdStore } from './sessionStore.ts';
import type { ProofOfHumanRequest } from './enrollClient.ts';

export type ContinuationClientResult =
  | { ok: true; continuationToken: string; expiresAt: number }
  | {
      ok: false;
      reason:
        | 'missing_session'
        | 'invalid_session'
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
}): IDKitSessionConfig {
  return {
    app_id: input.appId,
    rp_context: input.rpContext,
    environment: input.environment,
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
} = {}): Promise<ContinuationClientResult> {
  const sessionId = options.sessionId ?? options.sessionStore?.read() ?? '';
  if (!sessionId) return { ok: false, reason: 'missing_session' };
  if (!SESSION_ID_PATTERN.test(sessionId)) return { ok: false, reason: 'invalid_session' };

  const fetchImpl = options.fetchImpl ?? fetch;
  const openRequest = options.openRequest ?? openSessionProof;
  let contextBody: RpContextResponse;
  try {
    const response = await fetchImpl('/api/world/rp-context', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intent: 'continue' }),
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

  const config = sessionProofConfig({
    appId: contextBody.app_id as `app_${string}`,
    rpContext: contextBody.rp_context,
    environment: contextBody.environment,
  });
  let request: ProofOfHumanRequest;
  try {
    request = await openRequest(sessionId as `session_${string}`, config);
  } catch {
    return { ok: false, reason: 'world_app_unavailable' };
  }
  const completion = await request.pollUntilCompletion({
    timeout: options.timeoutMs,
    signal: options.signal,
  });
  if (!completion.success) return completionFailure(String(completion.error));

  let continueResponse: Response;
  try {
    continueResponse = await fetchImpl('/api/world/continue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(completion.result),
      signal: options.signal,
    });
  } catch {
    return { ok: false, reason: 'unexpected' };
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
