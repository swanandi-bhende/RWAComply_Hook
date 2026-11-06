import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateKeyToAccount } from 'viem/accounts';

export class WorldConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorldConfigError';
  }
}

export type WorldEnv = {
  WORLD_APP_ID?: string;
  WORLD_RP_ID?: string;
  WORLD_PRIVATE_KEY?: string;
  WORLD_RP_SIGNER_ADDRESS?: string;
  WORLD_SESSION_ENCRYPTION_KEY?: string;
  WORLD_ID_ENVIRONMENT?: string;
  WORLD_ENROLLMENT_DB_PATH?: string;
  [key: string]: string | undefined;
};

export type WorldServerConfig = {
  appId: string;
  rpId: string;
  signingKeyHex: string;
};

export type WorldPublicConfig = {
  appId: string;
  rpId: string;
};

const APP_ID_PATTERN = /^app_[A-Za-z0-9_]+$/;
const RP_ID_PATTERN = /^rp_[0-9a-fA-F]{1,16}$/;
const SIGNING_KEY_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function requiredValue(value: string | undefined, missingMessage: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new WorldConfigError(missingMessage);
  }
  return trimmed;
}

function requireFormat(value: string, pattern: RegExp, invalidMessage: string): string {
  if (!pattern.test(value)) {
    throw new WorldConfigError(invalidMessage);
  }
  return value;
}

function normalizedSigningKey(value: string): `0x${string}` {
  const hex = value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
  return `0x${hex.toLowerCase()}`;
}

function assertPortalSigner(signingKeyHex: string, signerAddress: string): void {
  let derived = '';
  try {
    derived = privateKeyToAccount(normalizedSigningKey(signingKeyHex)).address;
  } catch {
    throw new WorldConfigError('WORLD_PRIVATE_KEY is invalid');
  }
  if (derived.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new WorldConfigError('WORLD_PRIVATE_KEY does not match WORLD_RP_SIGNER_ADDRESS');
  }
}

export function readWorldConfig(env: WorldEnv = process.env): WorldServerConfig {
  const appId = requireFormat(
    requiredValue(env.WORLD_APP_ID, 'WORLD_APP_ID is not configured'),
    APP_ID_PATTERN,
    'WORLD_APP_ID is invalid',
  );
  const rpId = requireFormat(
    requiredValue(env.WORLD_RP_ID, 'WORLD_RP_ID is not configured'),
    RP_ID_PATTERN,
    'WORLD_RP_ID is invalid',
  );
  const signingKeyHex = requireFormat(
    requiredValue(env.WORLD_PRIVATE_KEY, 'WORLD_PRIVATE_KEY is not configured'),
    SIGNING_KEY_PATTERN,
    'WORLD_PRIVATE_KEY is invalid',
  );
  const signerAddress = requireFormat(
    requiredValue(env.WORLD_RP_SIGNER_ADDRESS, 'WORLD_RP_SIGNER_ADDRESS is not configured'),
    ADDRESS_PATTERN,
    'WORLD_RP_SIGNER_ADDRESS is invalid',
  );
  assertPortalSigner(signingKeyHex, signerAddress);

  return { appId, rpId, signingKeyHex };
}

export function publicWorldConfig(env: WorldEnv = process.env): WorldPublicConfig {
  const { appId, rpId } = readWorldConfig(env);
  return { appId, rpId };
}

export type WorldEnvironment = 'staging' | 'production';

const ENCRYPTION_KEY_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;

export function readWorldEnvironment(env: WorldEnv = process.env): WorldEnvironment | undefined {
  const value = env.WORLD_ID_ENVIRONMENT?.trim() ?? '';
  if (!value) return undefined;
  if (value === 'staging' || value === 'production') return value;
  throw new WorldConfigError('WORLD_ID_ENVIRONMENT is invalid');
}

function keyBytes(value: string): Buffer {
  const hex = value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
  return Buffer.from(hex, 'hex');
}

export type EnrollmentServerConfig = {
  appId: string;
  rpId: string;
  environment: WorldEnvironment;
  sessionEncryptionKey: Buffer;
  databasePath: string;
};

export function readEnrollmentConfig(env: WorldEnv = process.env): EnrollmentServerConfig {
  const world = readWorldConfig(env);
  const environment = readWorldEnvironment(env);
  if (!environment) {
    throw new WorldConfigError('WORLD_ID_ENVIRONMENT is not configured');
  }

  const encryptionKey = requireFormat(
    requiredValue(env.WORLD_SESSION_ENCRYPTION_KEY, 'WORLD_SESSION_ENCRYPTION_KEY is not configured'),
    ENCRYPTION_KEY_PATTERN,
    'WORLD_SESSION_ENCRYPTION_KEY is invalid',
  );
  const sessionEncryptionKey = keyBytes(encryptionKey);
  const signingKey = keyBytes(world.signingKeyHex);
  if (
    sessionEncryptionKey.length === signingKey.length &&
    sessionEncryptionKey.equals(signingKey)
  ) {
    throw new WorldConfigError('WORLD_SESSION_ENCRYPTION_KEY must not reuse the RP signing key');
  }

  const configuredPath = env.WORLD_ENROLLMENT_DB_PATH?.trim() ?? '';
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const databasePath = configuredPath
    ? path.resolve(repositoryRoot, configuredPath)
    : path.join(repositoryRoot, 'frontend', 'data', 'world-enrollments.sqlite');

  return {
    appId: world.appId,
    rpId: world.rpId,
    environment,
    sessionEncryptionKey,
    databasePath,
  };
}
