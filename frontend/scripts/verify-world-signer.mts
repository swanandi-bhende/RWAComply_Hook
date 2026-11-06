import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRepositoryEnv } from '../lib/world/loadRootEnv.ts';
import { readWorldConfig } from '../lib/world/config.ts';

try {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  loadRepositoryEnv(repoRoot);
  readWorldConfig();
  console.log('WORLD_PRIVATE_KEY matches WORLD_RP_SIGNER_ADDRESS');
} catch (error) {
  const message = error instanceof Error ? error.message : 'World ID configuration is unavailable';
  console.error(message);
  process.exitCode = 1;
}
