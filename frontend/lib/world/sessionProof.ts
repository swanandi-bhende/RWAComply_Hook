import type { WorldEnvironment } from './config.ts';
import { canonicalNullifierBytes, type PortalCallResult } from './enrollmentProof.ts';

export const SESSION_ID_PATTERN = /^session_[0-9a-fA-F]{64}01[0-9a-fA-F]{62}$/;
const PROOF_OF_HUMAN = 'proof_of_human';

export type SessionProofFailure =
  | 'invalid_body'
  | 'invalid_proof'
  | 'expired_proof'
  | 'wrong_action'
  | 'wrong_credential'
  | 'wrong_environment'
  | 'missing_session'
  | 'uniqueness_proof'
  | 'world_unavailable'
  | 'world_timeout';

export class SessionProofRejected extends Error {
  readonly code: SessionProofFailure;

  constructor(code: SessionProofFailure) {
    super(code);
    this.name = 'SessionProofRejected';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function classifySessionProof(
  payload: unknown,
  environment: WorldEnvironment,
  nowSeconds: number,
): { sessionId: string } {
  if (!isRecord(payload)) throw new SessionProofRejected('invalid_body');
  if (payload.protocol_version !== '4.0') throw new SessionProofRejected('invalid_proof');
  if ('action' in payload) throw new SessionProofRejected('wrong_action');
  if (typeof payload.session_id !== 'string' || !SESSION_ID_PATTERN.test(payload.session_id)) {
    throw new SessionProofRejected('missing_session');
  }
  if (payload.environment !== environment) throw new SessionProofRejected('wrong_environment');
  if (!Array.isArray(payload.responses) || payload.responses.length !== 1 || !isRecord(payload.responses[0])) {
    throw new SessionProofRejected('invalid_proof');
  }

  const proof = payload.responses[0];
  if ('nullifier' in proof) throw new SessionProofRejected('uniqueness_proof');
  if (proof.identifier !== PROOF_OF_HUMAN || proof.issuer_schema_id !== 1) {
    throw new SessionProofRejected('wrong_credential');
  }
  if (!Array.isArray(proof.session_nullifier) || proof.session_nullifier.length !== 2) {
    throw new SessionProofRejected('invalid_proof');
  }
  if (
    proof.session_nullifier.some(
      (item) => typeof item !== 'string' || !canonicalNullifierBytes(item),
    )
  ) {
    throw new SessionProofRejected('invalid_proof');
  }
  if (
    !Array.isArray(proof.proof) ||
    proof.proof.length !== 5 ||
    proof.proof.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    throw new SessionProofRejected('invalid_proof');
  }
  if (typeof proof.expires_at_min !== 'number' || !Number.isInteger(proof.expires_at_min)) {
    throw new SessionProofRejected('invalid_proof');
  }
  if (proof.expires_at_min <= nowSeconds) throw new SessionProofRejected('expired_proof');
  return { sessionId: payload.session_id };
}

const EXPIRED_CODES = new Set([
  'rp_signature_expired',
  'timestamp_too_old',
  'timestamp_too_far_in_future',
  'invalid_timestamp',
  'expired',
]);

export function acceptSessionPortal(
  portal: PortalCallResult,
  sessionId: string,
  environment: WorldEnvironment,
): void {
  if (!portal.ok || !isRecord(portal.body)) {
    const code = isRecord(portal.body) && typeof portal.body.code === 'string' ? portal.body.code : '';
    if (EXPIRED_CODES.has(code)) throw new SessionProofRejected('expired_proof');
    if (code === 'environment_mismatch') throw new SessionProofRejected('wrong_environment');
    throw new SessionProofRejected('invalid_proof');
  }
  const body = portal.body;
  if (body.success !== true || body.protocol_version !== '4.0') {
    throw new SessionProofRejected('invalid_proof');
  }
  if (body.environment !== environment) throw new SessionProofRejected('wrong_environment');
  if (body.session_id !== sessionId) throw new SessionProofRejected('missing_session');
  if (!Array.isArray(body.results) || body.results.length !== 1 || !isRecord(body.results[0])) {
    throw new SessionProofRejected('invalid_proof');
  }
  const result = body.results[0];
  if (result.success !== true || result.identifier !== PROOF_OF_HUMAN) {
    throw new SessionProofRejected('invalid_proof');
  }
  if (typeof result.sessionId === 'string' && result.sessionId !== sessionId) {
    throw new SessionProofRejected('missing_session');
  }
}

export function sessionProofStatus(code: SessionProofFailure): number {
  if (code === 'invalid_body') return 400;
  if (code === 'world_unavailable' || code === 'world_timeout') return 503;
  return 422;
}

export function sessionProofMessage(code: SessionProofFailure): string {
  switch (code) {
    case 'invalid_body':
      return 'Invalid request body';
    case 'expired_proof':
      return 'The World ID proof is expired';
    case 'wrong_action':
      return 'The World ID proof has the wrong action';
    case 'wrong_credential':
      return 'The World ID credential is not accepted';
    case 'wrong_environment':
      return 'The World ID environment does not match';
    case 'missing_session':
      return 'The World ID session binding is missing';
    case 'uniqueness_proof':
      return 'A session proof is required';
    case 'world_timeout':
    case 'world_unavailable':
      return 'World ID verification is unavailable';
    default:
      return 'The World ID proof is invalid';
  }
}
