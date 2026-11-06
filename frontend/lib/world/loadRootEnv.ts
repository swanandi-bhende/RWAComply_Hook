import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

type EnvLogger = {
  error: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
};

type LoadEnvConfig = (
  directory: string,
  dev?: boolean,
  log?: EnvLogger,
  forceReload?: boolean,
) => unknown;

const silentLog: EnvLogger = {
  error() {},
  info() {},
  warn() {},
};

export function repositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

export function loadRepositoryEnv(directory = repositoryRoot()): void {
  const { loadEnvConfig } = require('@next/env') as { loadEnvConfig: LoadEnvConfig };
  const dev = process.env.NODE_ENV !== 'production';
  loadEnvConfig(directory, dev, silentLog, true);
}
