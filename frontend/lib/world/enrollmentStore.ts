import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { EncryptedSession } from './sessionCrypto.ts';

export type EnrollmentInsert = {
  appId: string;
  rpId: string;
  environment: string;
  action: string;
  credential: string;
  nullifierHash: string;
  session: EncryptedSession;
  allocationId: string;
  enrolledAt: string;
  sessionIdHash: string;
};

export type StoredEnrollment = {
  id: number;
  appId: string;
  rpId: string;
  environment: string;
  action: string;
  credential: string;
  session: EncryptedSession;
  allocationId: string;
  enrolledAt: string;
  sessionIdHash: string;
};

export type InsertResult =
  | { ok: true }
  | { ok: false; reason: 'duplicate_nullifier' | 'duplicate_allocation' | 'duplicate_session' };

export type OpenChallenge = {
  nonce: `0x${string}`;
  chainId: number;
  ledgerAddress: `0x${string}`;
  issuedAt: number;
  expiresAt: number;
  appId: string;
  allocationId: `0x${string}`;
  enrollmentId: number;
};

export type LinkFailure =
  | 'unknown_grant'
  | 'grant_expired'
  | 'grant_consumed'
  | 'unknown_challenge'
  | 'challenge_expired'
  | 'challenge_reused'
  | 'wallet_mismatch'
  | 'allocation_conflict'
  | 'nonce_used';

export type IssuedAuthorization = {
  nonce: string;
  walletAddress: string;
  allocationId: string;
  groupId: string;
  expiry: number;
  chainId: number;
  ledgerAddress: string;
  signature: string;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS world_enrollment (
  id INTEGER PRIMARY KEY,
  app_id TEXT NOT NULL,
  rp_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  action TEXT NOT NULL,
  credential TEXT NOT NULL,
  nullifier_hash TEXT NOT NULL,
  session_ciphertext TEXT NOT NULL,
  session_iv TEXT NOT NULL,
  session_tag TEXT NOT NULL,
  allocation_id TEXT NOT NULL,
  enrolled_at TEXT NOT NULL,
  session_id_hash TEXT,
  UNIQUE (app_id, environment, action, nullifier_hash),
  UNIQUE (allocation_id)
);
CREATE TABLE IF NOT EXISTS continuation_grant (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  enrollment_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wallet_challenge (
  id INTEGER PRIMARY KEY,
  grant_id INTEGER NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  ledger_address TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wallet_association (
  wallet_address TEXT PRIMARY KEY,
  allocation_id TEXT NOT NULL,
  enrollment_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registration_authorization (
  nonce TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  allocation_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  expiry INTEGER NOT NULL,
  chain_id INTEGER NOT NULL,
  ledger_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

type EnrollmentRow = {
  id: number;
  app_id: string;
  rp_id: string;
  environment: string;
  action: string;
  credential: string;
  session_ciphertext: string;
  session_iv: string;
  session_tag: string;
  allocation_id: string;
  enrolled_at: string;
  session_id_hash: string | null;
};

type GrantJoinRow = {
  grant_id: number;
  grant_status: string;
  expires_at: number;
  enrollment_id: number;
  app_id: string;
  allocation_id: string;
};

type ChallengeRow = {
  id: number;
  nonce: string;
  chain_id: number;
  ledger_address: string;
  issued_at: number;
  expires_at: number;
  status: string;
  wallet_address: string;
};

function sqliteCode(error: unknown): number | undefined {
  if (!(error instanceof Error) || !('errcode' in error)) return undefined;
  return Number(error.errcode);
}

function isConstraint(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return sqliteCode(error) === 19 || /unique|constraint/i.test(error.message);
}

function isBusy(error: unknown): boolean {
  return sqliteCode(error) === 5;
}

function enrollmentFrom(row: EnrollmentRow): StoredEnrollment {
  return {
    id: row.id,
    appId: row.app_id,
    rpId: row.rp_id,
    environment: row.environment,
    action: row.action,
    credential: row.credential,
    session: {
      ciphertext: row.session_ciphertext,
      iv: row.session_iv,
      tag: row.session_tag,
    },
    allocationId: row.allocation_id,
    enrolledAt: row.enrolled_at,
    sessionIdHash: row.session_id_hash ?? '',
  };
}

export class EnrollmentStore {
  private readonly db: DatabaseSync;

  constructor(filePath: string) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec(SCHEMA);
    const columns = this.db.prepare('PRAGMA table_info(world_enrollment)').all() as { name: string }[];
    if (!columns.some((column) => column.name === 'session_id_hash')) {
      this.db.exec('ALTER TABLE world_enrollment ADD COLUMN session_id_hash TEXT');
    }
    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS world_enrollment_session_hash ON world_enrollment(session_id_hash)',
    );
  }

  insert(record: EnrollmentInsert): InsertResult {
    const statement = this.db.prepare(
      `INSERT INTO world_enrollment (
        app_id, rp_id, environment, action, credential, nullifier_hash,
        session_ciphertext, session_iv, session_tag, allocation_id, enrolled_at, session_id_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        this.db.exec('BEGIN IMMEDIATE');
      } catch (error) {
        if (isBusy(error)) continue;
        throw error;
      }
      try {
        statement.run(
          record.appId,
          record.rpId,
          record.environment,
          record.action,
          record.credential,
          record.nullifierHash,
          record.session.ciphertext,
          record.session.iv,
          record.session.tag,
          record.allocationId,
          record.enrolledAt,
          record.sessionIdHash,
        );
        this.db.exec('COMMIT');
        return { ok: true };
      } catch (error) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // The transaction is already closed.
        }
        if (isBusy(error)) continue;
        if (!isConstraint(error)) throw error;
        const message = error instanceof Error ? error.message : '';
        if (message.includes('allocation_id')) return { ok: false, reason: 'duplicate_allocation' };
        if (message.includes('session_id_hash')) return { ok: false, reason: 'duplicate_session' };
        return { ok: false, reason: 'duplicate_nullifier' };
      }
    }
    throw new Error('Enrollment database is busy');
  }

  records(): StoredEnrollment[] {
    const rows = this.db
      .prepare(
        `SELECT id, app_id, rp_id, environment, action, credential,
                session_ciphertext, session_iv, session_tag, allocation_id, enrolled_at, session_id_hash
         FROM world_enrollment
         ORDER BY id`,
      )
      .all() as EnrollmentRow[];
    return rows.map(enrollmentFrom);
  }

  findBySessionHash(sessionIdHash: string): StoredEnrollment | undefined {
    const row = this.db
      .prepare(
        `SELECT id, app_id, rp_id, environment, action, credential,
                session_ciphertext, session_iv, session_tag, allocation_id, enrolled_at, session_id_hash
         FROM world_enrollment
         WHERE session_id_hash = ?`,
      )
      .get(sessionIdHash) as EnrollmentRow | undefined;
    return row ? enrollmentFrom(row) : undefined;
  }

  insertGrant(input: {
    tokenHash: string;
    enrollmentId: number;
    expiresAt: number;
    createdAt: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO continuation_grant (token_hash, enrollment_id, expires_at, status, created_at)
         VALUES (?, ?, ?, 'open', ?)`,
      )
      .run(input.tokenHash, input.enrollmentId, input.expiresAt, input.createdAt);
  }

  openChallenge(input: {
    tokenHash: string;
    challengeHash: string;
    wallet: string;
    chainId: number;
    ledgerAddress: string;
    nonce: `0x${string}`;
    issuedAt: number;
    expiresAt: number;
    createdAt: string;
    now: number;
  }): { ok: true } | { ok: false; reason: LinkFailure } {
    return this.transaction(() => {
      const grant = this.grantRow(input.tokenHash);
      const blocked = this.grantFailure(grant, input.now);
      if (blocked || !grant) return blocked ?? { ok: false, reason: 'unknown_grant' };
      this.db
        .prepare(
          `UPDATE wallet_challenge SET status = 'superseded'
           WHERE grant_id = ? AND status = 'open'`,
        )
        .run(grant.grant_id);
      this.db
        .prepare(
          `INSERT INTO wallet_challenge (
             grant_id, challenge_hash, wallet_address, chain_id, ledger_address,
             nonce, issued_at, expires_at, status, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
        )
        .run(
          grant.grant_id,
          input.challengeHash,
          input.wallet,
          input.chainId,
          input.ledgerAddress,
          input.nonce,
          input.issuedAt,
          input.expiresAt,
          input.createdAt,
        );
      return { ok: true };
    });
  }

  readOpenChallenge(tokenHash: string, wallet: string, now: number):
    | { ok: true; challenge: OpenChallenge }
    | { ok: false; reason: LinkFailure } {
    const grant = this.grantRow(tokenHash);
    const blocked = this.grantFailure(grant, now);
    if (blocked || !grant) return blocked ?? { ok: false, reason: 'unknown_grant' };
    const challenge = this.challengeRow(grant.grant_id, wallet);
    const challengeFailure = this.challengeFailure(challenge, now);
    if (challengeFailure || !challenge) {
      return challengeFailure ?? { ok: false, reason: 'unknown_challenge' };
    }
    return {
      ok: true,
      challenge: {
        nonce: challenge.nonce as `0x${string}`,
        chainId: challenge.chain_id,
        ledgerAddress: challenge.ledger_address as `0x${string}`,
        issuedAt: challenge.issued_at,
        expiresAt: challenge.expires_at,
        appId: grant.app_id,
        allocationId: grant.allocation_id as `0x${string}`,
        enrollmentId: grant.enrollment_id,
      },
    };
  }

  consumeLink(input: {
    tokenHash: string;
    wallet: string;
    now: number;
    authorization: IssuedAuthorization;
    createdAt: string;
  }): { ok: true } | { ok: false; reason: LinkFailure } {
    return this.transaction(() => {
      const grant = this.grantRow(input.tokenHash);
      const blocked = this.grantFailure(grant, input.now);
      if (blocked || !grant) return blocked ?? { ok: false, reason: 'unknown_grant' };
      const challenge = this.challengeRow(grant.grant_id, input.wallet);
      const challengeFailure = this.challengeFailure(challenge, input.now);
      if (challengeFailure || !challenge) {
        return challengeFailure ?? { ok: false, reason: 'unknown_challenge' };
      }
      if (challenge.wallet_address !== input.wallet) return { ok: false, reason: 'wallet_mismatch' };

      const existing = this.db
        .prepare('SELECT allocation_id FROM wallet_association WHERE wallet_address = ?')
        .get(input.wallet) as { allocation_id: string } | undefined;
      if (existing && existing.allocation_id !== input.authorization.allocationId) {
        const retired = this.db
          .prepare(`UPDATE wallet_challenge SET status = 'consumed' WHERE id = ? AND status = 'open'`)
          .run(challenge.id) as { changes: number };
        if (retired.changes !== 1) return { ok: false, reason: 'challenge_reused' };
        return { ok: false, reason: 'allocation_conflict' };
      }

      try {
        this.db
          .prepare(
            `INSERT INTO registration_authorization (
               nonce, wallet_address, allocation_id, group_id, expiry, chain_id, ledger_address, signature, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            input.authorization.nonce,
            input.authorization.walletAddress,
            input.authorization.allocationId,
            input.authorization.groupId,
            input.authorization.expiry,
            input.authorization.chainId,
            input.authorization.ledgerAddress,
            input.authorization.signature,
            input.createdAt,
          );
      } catch (error) {
        if (isConstraint(error)) return { ok: false, reason: 'nonce_used' };
        throw error;
      }
      if (!existing) {
        this.db
          .prepare(
            `INSERT INTO wallet_association (wallet_address, allocation_id, enrollment_id, created_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(
            input.wallet,
            input.authorization.allocationId,
            grant.enrollment_id,
            input.createdAt,
          );
      }
      const grantUpdate = this.db
        .prepare(`UPDATE continuation_grant SET status = 'consumed' WHERE id = ? AND status = 'open'`)
        .run(grant.grant_id) as { changes: number };
      const challengeUpdate = this.db
        .prepare(`UPDATE wallet_challenge SET status = 'consumed' WHERE id = ? AND status = 'open'`)
        .run(challenge.id) as { changes: number };
      if (grantUpdate.changes !== 1 || challengeUpdate.changes !== 1) {
        throw new Error('continuation state changed');
      }
      return { ok: true };
    });
  }

  associationFor(wallet: string): { allocationId: string } | undefined {
    const row = this.db
      .prepare('SELECT allocation_id FROM wallet_association WHERE wallet_address = ?')
      .get(wallet) as { allocation_id: string } | undefined;
    return row ? { allocationId: row.allocation_id } : undefined;
  }

  close(): void {
    this.db.close();
  }

  private grantRow(tokenHash: string): GrantJoinRow | undefined {
    return this.db
      .prepare(
        `SELECT grant.id AS grant_id, grant.status AS grant_status, grant.expires_at,
                enrollment.id AS enrollment_id, enrollment.app_id, enrollment.allocation_id
         FROM continuation_grant AS grant
         JOIN world_enrollment AS enrollment ON enrollment.id = grant.enrollment_id
         WHERE grant.token_hash = ?`,
      )
      .get(tokenHash) as GrantJoinRow | undefined;
  }

  private challengeRow(grantId: number, wallet: string): ChallengeRow | undefined {
    return this.db
      .prepare(
        `SELECT id, nonce, chain_id, ledger_address, issued_at, expires_at, status, wallet_address
         FROM wallet_challenge
         WHERE grant_id = ? AND wallet_address = ? AND status = 'open'`,
      )
      .get(grantId, wallet) as ChallengeRow | undefined;
  }

  private grantFailure(
    grant: GrantJoinRow | undefined,
    now: number,
  ): { ok: false; reason: LinkFailure } | undefined {
    if (!grant) return { ok: false, reason: 'unknown_grant' };
    if (grant.grant_status !== 'open') return { ok: false, reason: 'grant_consumed' };
    if (grant.expires_at <= now) return { ok: false, reason: 'grant_expired' };
    return undefined;
  }

  private challengeFailure(
    challenge: ChallengeRow | undefined,
    now: number,
  ): { ok: false; reason: LinkFailure } | undefined {
    if (!challenge) return { ok: false, reason: 'unknown_challenge' };
    if (challenge.status !== 'open') return { ok: false, reason: 'challenge_reused' };
    if (challenge.expires_at <= now) return { ok: false, reason: 'challenge_expired' };
    return undefined;
  }

  private transaction<T>(fn: () => T): T {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        this.db.exec('BEGIN IMMEDIATE');
      } catch (error) {
        if (isBusy(error)) continue;
        throw error;
      }
      try {
        const result = fn();
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // The transaction is already closed.
        }
        if (isBusy(error)) continue;
        throw error;
      }
    }
    throw new Error('Enrollment database is busy');
  }
}

const openStores = new Map<string, EnrollmentStore>();

export function openEnrollmentStore(filePath: string): EnrollmentStore {
  return new EnrollmentStore(filePath);
}

export function sharedEnrollmentStore(filePath: string): EnrollmentStore {
  const existing = openStores.get(filePath);
  if (existing) return existing;
  const store = new EnrollmentStore(filePath);
  openStores.set(filePath, store);
  return store;
}
