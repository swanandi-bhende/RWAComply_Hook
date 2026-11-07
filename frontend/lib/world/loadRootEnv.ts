import { existsSync, readFileSync } from 'node:fs';
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

function applyBlankEnvFile(directory: string): void {
  let text = '';
  try {
    text = readFileSync(path.join(directory, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

export function loadRepositoryEnv(directory = repositoryRoot()): void {
  if (existsSync(/*turbopackIgnore: true*/ directory)) {
    try {
      const { loadEnvConfig } = require('@next/env') as { loadEnvConfig: LoadEnvConfig };
      const dev = process.env.NODE_ENV !== 'production';
      loadEnvConfig(directory, dev, silentLog, true);
    } catch {
      // A host that injects variables, such as Vercel, has no repository .env file.
    }
  }
  applyBlankEnvFile(directory);
}
