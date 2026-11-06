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
};

export type StoredEnrollment = {
  appId: string;
  rpId: string;
  environment: string;
  action: string;
  credential: string;
  session: EncryptedSession;
  allocationId: string;
  enrolledAt: string;
};

export type InsertResult =
  | { ok: true }
  | { ok: false; reason: 'duplicate_nullifier' | 'duplicate_allocation' };

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
  UNIQUE (app_id, environment, action, nullifier_hash),
  UNIQUE (allocation_id)
);
`;

type EnrollmentRow = {
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

export class EnrollmentStore {
  private readonly db: DatabaseSync;

  constructor(filePath: string) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec(SCHEMA);
  }

  insert(record: EnrollmentInsert): InsertResult {
    const statement = this.db.prepare(
      `INSERT INTO world_enrollment (
        app_id, rp_id, environment, action, credential, nullifier_hash,
        session_ciphertext, session_iv, session_tag, allocation_id, enrolled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        if (message.includes('allocation_id')) {
          return { ok: false, reason: 'duplicate_allocation' };
        }
        return { ok: false, reason: 'duplicate_nullifier' };
      }
    }
    throw new Error('Enrollment database is busy');
  }

  records(): StoredEnrollment[] {
    const rows = this.db
      .prepare(
        `SELECT app_id, rp_id, environment, action, credential,
                session_ciphertext, session_iv, session_tag, allocation_id, enrolled_at
         FROM world_enrollment
         ORDER BY id`,
      )
      .all() as EnrollmentRow[];
    return rows.map((row) => ({
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
    }));
  }

  close(): void {
    this.db.close();
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
