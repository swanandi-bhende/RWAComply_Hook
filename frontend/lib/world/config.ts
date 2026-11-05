export class WorldConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorldConfigError';
  }
}

export type WorldEnv = {
  WORLD_APP_ID?: string;
  WORLD_RP_ID?: string;
  WORLD_RP_SIGNING_KEY?: string;
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
const RP_ID_PATTERN = /^rp_[A-Za-z0-9_]+$/;
const SIGNING_KEY_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;

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
    requiredValue(env.WORLD_RP_SIGNING_KEY, 'WORLD_RP_SIGNING_KEY is not configured'),
    SIGNING_KEY_PATTERN,
    'WORLD_RP_SIGNING_KEY is invalid',
  );

  return { appId, rpId, signingKeyHex };
}

export function publicWorldConfig(env: WorldEnv = process.env): WorldPublicConfig {
  const { appId, rpId } = readWorldConfig(env);
  return { appId, rpId };
}
