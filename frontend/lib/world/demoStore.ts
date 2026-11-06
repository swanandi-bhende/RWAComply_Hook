import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS demo_identity (
  id INTEGER PRIMARY KEY,
  allocation_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_resume (
  token_hash TEXT PRIMARY KEY,
  identity_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_challenge (
  id INTEGER PRIMARY KEY,
  identity_id INTEGER NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL,
  ledger_address TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_wallet (
  wallet_address TEXT PRIMARY KEY,
  identity_id INTEGER NOT NULL,
  allocation_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export type DemoIdentity = { id: number; allocationId: string; expiresAt: number };

export class DemoStore {
  private readonly db: DatabaseSync;

  constructor(filePath: string) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec(SCHEMA);
  }

  create(input: { allocationId: string; tokenHash: string; expiresAt: number; createdAt: string }): number {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(
        'INSERT INTO demo_identity (allocation_id, created_at) VALUES (?, ?)',
      ).run(input.allocationId, input.createdAt);
      const inserted = this.db.prepare(
        'SELECT id FROM demo_identity WHERE allocation_id = ?',
      ).get(input.allocationId) as { id: number };
      this.db.prepare(
        'INSERT INTO demo_resume (token_hash, identity_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      ).run(input.tokenHash, inserted.id, input.expiresAt, input.createdAt);
      this.db.exec('COMMIT');
      return inserted.id;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  find(tokenHash: string): DemoIdentity | undefined {
    const row = this.db.prepare(
      `SELECT i.id, i.allocation_id, r.expires_at
       FROM demo_resume r JOIN demo_identity i ON i.id = r.identity_id
       WHERE r.token_hash = ?`,
    ).get(tokenHash) as { id: number; allocation_id: string; expires_at: number } | undefined;
    return row ? { id: row.id, allocationId: row.allocation_id, expiresAt: row.expires_at } : undefined;
  }

  countIdentities(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM demo_identity').get() as { count: number };
    return row.count;
  }

  countWorldEnrollments(): number {
    const exists = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'world_enrollment'",
    ).get();
    if (!exists) return 0;
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM world_enrollment').get() as { count: number };
    return row.count;
  }

  confirmedWallets(identityId: number): string[] {
    const rows = this.db.prepare(
      `SELECT d.wallet_address AS wallet
       FROM demo_wallet d
       JOIN registration_authorization r
         ON r.wallet_address = d.wallet_address AND r.allocation_id = d.allocation_id
       WHERE d.identity_id = ? AND r.chain_status = 'confirmed'
       ORDER BY d.created_at`,
    ).all(identityId) as { wallet: string }[];
    return rows.map((row) => row.wallet);
  }

  worldAllocation(wallet: string): string | undefined {
    const exists = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'wallet_association'",
    ).get();
    if (!exists) return undefined;
    const row = this.db.prepare(
      'SELECT allocation_id FROM wallet_association WHERE wallet_address = ?',
    ).get(wallet) as { allocation_id: string } | undefined;
    return row?.allocation_id;
  }

  demoWallet(wallet: string): { identityId: number; allocationId: string } | undefined {
    const row = this.db.prepare(
      'SELECT identity_id, allocation_id FROM demo_wallet WHERE wallet_address = ?',
    ).get(wallet) as { identity_id: number; allocation_id: string } | undefined;
    return row ? { identityId: row.identity_id, allocationId: row.allocation_id } : undefined;
  }

  saveChallenge(input: {
    identityId: number;
    challengeHash: string;
    wallet: string;
    nonce: string;
    chainId: number;
    ledgerAddress: string;
    issuedAt: number;
    expiresAt: number;
    createdAt: string;
  }): void {
    this.db.prepare(
      `INSERT INTO demo_challenge (
        identity_id, challenge_hash, wallet_address, nonce, chain_id, ledger_address,
        issued_at, expires_at, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    ).run(
      input.identityId,
      input.challengeHash,
      input.wallet,
      input.nonce,
      input.chainId,
      input.ledgerAddress,
      input.issuedAt,
      input.expiresAt,
      input.createdAt,
    );
  }

  openChallenge(wallet: string, now: number): {
    identityId: number;
    allocationId: string;
    nonce: string;
    chainId: number;
    ledgerAddress: string;
    issuedAt: number;
    expiresAt: number;
  } | undefined {
    const row = this.db.prepare(
      `SELECT c.identity_id, i.allocation_id, c.nonce, c.chain_id, c.ledger_address, c.issued_at, c.expires_at
       FROM demo_challenge c JOIN demo_identity i ON i.id = c.identity_id
       WHERE c.wallet_address = ? AND c.status = 'open' AND c.expires_at > ?
       ORDER BY c.id DESC LIMIT 1`,
    ).get(wallet, now) as {
      identity_id: number;
      allocation_id: string;
      nonce: string;
      chain_id: number;
      ledger_address: string;
      issued_at: number;
      expires_at: number;
    } | undefined;
    if (!row) return undefined;
    return {
      identityId: row.identity_id,
      allocationId: row.allocation_id,
      nonce: row.nonce,
      chainId: row.chain_id,
      ledgerAddress: row.ledger_address,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
    };
  }

  consumeChallenge(input: {
    wallet: string;
    identityId: number;
    allocationId: string;
    now: number;
    createdAt: string;
    authorization: {
      nonce: string;
      groupId: string;
      expiry: number;
      chainId: number;
      ledgerAddress: string;
      signature: string;
    };
  }): 'ok' | 'conflict' | 'expired' {
    const challenge = this.openChallenge(input.wallet, input.now);
    if (!challenge || challenge.identityId !== input.identityId) return 'expired';
    const worldAllocation = this.worldAllocation(input.wallet);
    if (worldAllocation && worldAllocation !== input.allocationId) return 'conflict';
    const existing = this.demoWallet(input.wallet);
    if (existing && existing.allocationId !== input.allocationId) return 'conflict';
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(
        `UPDATE demo_challenge SET status = 'used'
         WHERE wallet_address = ? AND status = 'open' AND identity_id = ?`,
      ).run(input.wallet, input.identityId);
      if (!existing) {
        this.db.prepare(
          'INSERT INTO demo_wallet (wallet_address, identity_id, allocation_id, created_at) VALUES (?, ?, ?, ?)',
        ).run(input.wallet, input.identityId, input.allocationId, input.createdAt);
      }
      this.db.prepare(
        `INSERT INTO registration_authorization (
          nonce, wallet_address, allocation_id, group_id, expiry, chain_id, ledger_address, signature, created_at, chain_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued')`,
      ).run(
        input.authorization.nonce,
        input.wallet,
        input.allocationId,
        input.authorization.groupId,
        input.authorization.expiry,
        input.authorization.chainId,
        input.authorization.ledgerAddress,
        input.authorization.signature,
        input.createdAt,
      );
      this.db.exec('COMMIT');
      return 'ok';
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
