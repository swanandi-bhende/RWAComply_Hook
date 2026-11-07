import { createHash, randomBytes } from 'node:crypto';
import type { WorldEnvironment } from './config.ts';

const SESSION_ID_PATTERN = /^session_[0-9a-fA-F]{64}01[0-9a-fA-F]{62}$/;
const PROOF_OF_HUMAN = 'proof_of_human';

export type EnrollmentFailureCode =
  | 'invalid_body'
  | 'invalid_proof'
  | 'expired_proof'
  | 'wrong_action'
  | 'wrong_credential'
  | 'wrong_environment'
  | 'missing_session'
  | 'standalone_session'
  | 'missing_nullifier'
  | 'world_unavailable'
  | 'world_timeout';

export class EnrollmentRejected extends Error {
  readonly code: EnrollmentFailureCode;

  constructor(code: EnrollmentFailureCode) {
    super(code);
    this.name = 'EnrollmentRejected';
    this.code = code;
  }
}

export type BoundEnrollment = {
  sessionId: string;
  nullifierBytes: Buffer;
  nullifierHash: string;
  proofEnvironment: WorldEnvironment;
};

export function proofEnvironmentAccepted(configured: WorldEnvironment, actual: unknown): actual is WorldEnvironment {
  if (actual === configured) return true;
  return configured === 'staging' && actual === 'sandbox';
}

type ProofItem = {
  identifier?: unknown;
  issuer_schema_id?: unknown;
  nullifier?: unknown;
  session_nullifier?: unknown;
  success?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function canonicalNullifierBytes(value: string): Buffer | undefined {
  const trimmed = value.trim();
  let hex: string;
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    hex = trimmed.slice(2);
  } else if (/^[0-9]+$/.test(trimmed)) {
    try {
      hex = BigInt(trimmed).toString(16);
    } catch {
      return undefined;
    }
  } else {
    return undefined;
  }
  if (hex.length > 64) return undefined;
  return Buffer.from(hex.padStart(64, '0'), 'hex');
}

export function nullifierReplayHash(nullifier: Buffer): string {
  return createHash('sha256').update(nullifier).digest('hex');
}

function issuerAllowed(environment: WorldEnvironment, issuer: unknown): boolean {
  if (issuer === 1) return true;
  return environment === 'staging' && issuer === 128;
}

function proofItems(value: unknown): ProofItem[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  if (!value.every(isRecord)) return undefined;
  return value;
}

export function classifyBoundEnrollment(
  payload: unknown,
  environment: WorldEnvironment,
): BoundEnrollment {
  if (!isRecord(payload)) throw new EnrollmentRejected('invalid_body');
  if (payload.protocol_version !== '4.0') throw new EnrollmentRejected('invalid_proof');

  const responses = proofItems(payload.responses);
  if (!responses) throw new EnrollmentRejected('invalid_proof');
  if (responses.some((item) => item.session_nullifier !== undefined)) {
    throw new EnrollmentRejected('standalone_session');
  }

  const sessionId = payload.session_id;
  const action = payload.action;
  if (typeof sessionId !== 'string') throw new EnrollmentRejected('missing_session');
  if (action === undefined) throw new EnrollmentRejected('standalone_session');
  if (action !== 'signup') throw new EnrollmentRejected('wrong_action');
  if (!SESSION_ID_PATTERN.test(sessionId)) throw new EnrollmentRejected('missing_session');
  const proofEnvironment = proofEnvironmentAccepted(environment, payload.environment) ? payload.environment : undefined;
  if (!proofEnvironment) throw new EnrollmentRejected('wrong_environment');

  const humanProofs = responses.filter((item) => item.identifier === PROOF_OF_HUMAN);
  if (humanProofs.length !== 1) throw new EnrollmentRejected('wrong_credential');
  const proof = humanProofs[0];
  if (!issuerAllowed(environment, proof.issuer_schema_id)) {
    throw new EnrollmentRejected('wrong_credential');
  }
  if (typeof proof.nullifier !== 'string') throw new EnrollmentRejected('missing_nullifier');
  const nullifierBytes = canonicalNullifierBytes(proof.nullifier);
  if (!nullifierBytes) throw new EnrollmentRejected('missing_nullifier');

  return {
    sessionId,
    nullifierBytes,
    nullifierHash: nullifierReplayHash(nullifierBytes),
    proofEnvironment,
  };
}

export type PortalCallResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

const EXPIRED_CODES = new Set([
  'rp_signature_expired',
  'timestamp_too_old',
  'timestamp_too_far_in_future',
  'invalid_timestamp',
  'expired',
]);

function portalCode(body: unknown): string | undefined {
  if (!isRecord(body) || typeof body.code !== 'string') return undefined;
  return body.code;
}

export function acceptPortalVerification(
  portal: PortalCallResult,
  bound: BoundEnrollment,
  environment: WorldEnvironment,
): void {
  if (!portal.ok) {
    const code = portalCode(portal.body);
    if (code && EXPIRED_CODES.has(code)) throw new EnrollmentRejected('expired_proof');
    if (code === 'environment_mismatch') throw new EnrollmentRejected('wrong_environment');
    throw new EnrollmentRejected('invalid_proof');
  }

  if (!isRecord(portal.body) || portal.body.success !== true) {
    throw new EnrollmentRejected('invalid_proof');
  }
  if (portal.body.protocol_version !== '4.0') throw new EnrollmentRejected('invalid_proof');
  if (portal.body.action !== 'signup') throw new EnrollmentRejected('wrong_action');
  if (!proofEnvironmentAccepted(environment, bound.proofEnvironment)) throw new EnrollmentRejected('wrong_environment');
  if (portal.body.environment !== bound.proofEnvironment) throw new EnrollmentRejected('wrong_environment');
  if (typeof portal.body.nullifier !== 'string') throw new EnrollmentRejected('missing_nullifier');
  if (typeof portal.body.session_id === 'string' && portal.body.session_id !== bound.sessionId) {
    throw new EnrollmentRejected('missing_session');
  }

  const results = proofItems(portal.body.results);
  if (!results) throw new EnrollmentRejected('invalid_proof');
  const humanResults = results.filter((item) => item.identifier === PROOF_OF_HUMAN);
  if (humanResults.length === 0) throw new EnrollmentRejected('wrong_credential');
  if (humanResults.some((item) => item.success !== true)) {
    throw new EnrollmentRejected('invalid_proof');
  }

  const portalNullifier = canonicalNullifierBytes(portal.body.nullifier);
  if (!portalNullifier || !portalNullifier.equals(bound.nullifierBytes)) {
    throw new EnrollmentRejected('missing_nullifier');
  }
  const resultNullifiers = humanResults.map((item) =>
    typeof item.nullifier === 'string' ? canonicalNullifierBytes(item.nullifier) : undefined,
  );
  if (
    resultNullifiers.some(
      (item) => !item || !item.equals(bound.nullifierBytes),
    )
  ) {
    throw new EnrollmentRejected('missing_nullifier');
  }
}

export function newAllocationId(): `0x${string}` {
  return `0x${randomBytes(32).toString('hex')}`;
}

export function enrollmentHttpStatus(code: EnrollmentFailureCode): number {
  if (code === 'invalid_body') return 400;
  if (code === 'world_unavailable' || code === 'world_timeout') return 503;
  return 422;
}

export function enrollmentErrorMessage(code: EnrollmentFailureCode): string {
  switch (code) {
    case 'invalid_body':
      return 'Invalid request body';
    case 'expired_proof':
      return 'The World ID proof is expired';
    case 'wrong_action':
      return 'The World ID action is not signup';
    case 'wrong_credential':
      return 'The World ID credential is not Proof of Human';
    case 'wrong_environment':
      return 'The World ID environment does not match this server';
    case 'missing_session':
      return 'The proof is not bound to a new session';
    case 'standalone_session':
      return 'A session proof without Proof of Human uniqueness cannot enroll';
    case 'missing_nullifier':
      return 'The uniqueness nullifier is missing';
    case 'world_timeout':
      return 'World ID verification timed out';
    case 'world_unavailable':
      return 'World ID verification is unavailable';
    default:
      return 'The World ID proof is invalid';
  }
}
