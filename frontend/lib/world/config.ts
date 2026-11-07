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
  ALLOCATION_AUTH_SIGNING_KEY?: string;
  ALLOCATION_AUTH_SIGNER_ADDRESS?: string;
  ALLOCATION_LEDGER_ADDRESS?: string;
  ALLOCATION_CHAIN_ID?: string;
  ALLOCATION_GROUP_ID?: string;
  ALLOCATION_RPC_URL?: string;
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

export type WorldEnvironment = 'staging' | 'production' | 'sandbox';

const ENCRYPTION_KEY_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;

export function readWorldEnvironment(env: WorldEnv = process.env): WorldEnvironment | undefined {
  const value = env.WORLD_ID_ENVIRONMENT?.trim() ?? '';
  if (!value) return undefined;
  if (value === 'staging' || value === 'production' || value === 'sandbox') return value;
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

export function publicConfigError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  if (
    message.startsWith('WORLD_') ||
    message.startsWith('ALLOCATION_') ||
    message.startsWith('Identity storage')
  ) return message;
  return fallback;
}

export function readEnrollmentConfig(env: WorldEnv = process.env): EnrollmentServerConfig {
  if (env.VERCEL === '1') {
    throw new WorldConfigError('Identity storage is not configured. This deployment does not persist verification sessions.');
  }
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

const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const HTTP_URL_PATTERN = /^(https?|wss?):\/\/\S+$/;

export type AllocationAuthConfig = {
  signingKeyHex: `0x${string}`;
  signerAddress: `0x${string}`;
  ledgerAddress: `0x${string}`;
  chainId: number;
  groupId: `0x${string}`;
  rpcUrl?: string;
};

export function readAllocationConfig(env: WorldEnv = process.env): AllocationAuthConfig {
  const world = readWorldConfig(env);
  const signingKeyHex = normalizedSigningKey(
    requireFormat(
      requiredValue(env.ALLOCATION_AUTH_SIGNING_KEY, 'ALLOCATION_AUTH_SIGNING_KEY is not configured'),
      SIGNING_KEY_PATTERN,
      'ALLOCATION_AUTH_SIGNING_KEY is invalid',
    ),
  );
  if (keyBytes(signingKeyHex).equals(keyBytes(world.signingKeyHex))) {
    throw new WorldConfigError('ALLOCATION_AUTH_SIGNING_KEY must not reuse the World ID signing key');
  }

  const signerAddress = requireFormat(
    requiredValue(env.ALLOCATION_AUTH_SIGNER_ADDRESS, 'ALLOCATION_AUTH_SIGNER_ADDRESS is not configured'),
    ADDRESS_PATTERN,
    'ALLOCATION_AUTH_SIGNER_ADDRESS is invalid',
  );
  let derived = '';
  try {
    derived = privateKeyToAccount(signingKeyHex).address;
  } catch {
    throw new WorldConfigError('ALLOCATION_AUTH_SIGNING_KEY is invalid');
  }
  if (derived.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new WorldConfigError('ALLOCATION_AUTH_SIGNING_KEY does not match ALLOCATION_AUTH_SIGNER_ADDRESS');
  }

  const ledgerAddress = requireFormat(
    requiredValue(env.ALLOCATION_LEDGER_ADDRESS, 'ALLOCATION_LEDGER_ADDRESS is not configured'),
    ADDRESS_PATTERN,
    'ALLOCATION_LEDGER_ADDRESS is invalid',
  );
  if (BigInt(ledgerAddress) === BigInt(0)) {
    throw new WorldConfigError('ALLOCATION_LEDGER_ADDRESS is invalid');
  }

  const chainText = requiredValue(env.ALLOCATION_CHAIN_ID, 'ALLOCATION_CHAIN_ID is not configured');
  if (!/^[1-9][0-9]*$/.test(chainText)) {
    throw new WorldConfigError('ALLOCATION_CHAIN_ID is invalid');
  }
  const chainId = Number(chainText);
  if (!Number.isSafeInteger(chainId)) {
    throw new WorldConfigError('ALLOCATION_CHAIN_ID is invalid');
  }

  const groupId = requireFormat(
    requiredValue(env.ALLOCATION_GROUP_ID, 'ALLOCATION_GROUP_ID is not configured'),
    BYTES32_PATTERN,
    'ALLOCATION_GROUP_ID is invalid',
  );
  if (BigInt(groupId) === BigInt(0)) {
    throw new WorldConfigError('ALLOCATION_GROUP_ID is invalid');
  }

  const rpcUrl = env.ALLOCATION_RPC_URL?.trim() ?? '';
  if (rpcUrl && !HTTP_URL_PATTERN.test(rpcUrl)) {
    throw new WorldConfigError('ALLOCATION_RPC_URL is invalid');
  }

  return {
    signingKeyHex,
    signerAddress: signerAddress.toLowerCase() as `0x${string}`,
    ledgerAddress: ledgerAddress.toLowerCase() as `0x${string}`,
    chainId,
    groupId: groupId.toLowerCase() as `0x${string}`,
    ...(rpcUrl ? { rpcUrl } : {}),
  };
}
