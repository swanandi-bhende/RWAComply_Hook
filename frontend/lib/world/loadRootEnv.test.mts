import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadRepositoryEnv } from './loadRootEnv.ts';

test('repository env loading reads the given directory and does not print values', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-env-'));
  const probe = 'RWA_ENV_LOAD_PROBE';
  const secret = 'probe-value-not-for-logs';
  delete process.env[probe];
  writeFileSync(path.join(directory, '.env'), `${probe}=${secret}\n`);
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  try {
    loadRepositoryEnv(directory);
    assert.equal(process.env[probe], secret);
    assert.equal(logs.some((line) => line.includes(secret)), false);
  } finally {
    console.log = original;
    delete process.env[probe];
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a blank value is filled from the repository env file', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-env-'));
  const probe = 'RWA_ENV_LOAD_PROBE_BLANK';
  writeFileSync(path.join(directory, '.env'), `${probe}=from-file\n`);
  process.env[probe] = '';
  try {
    loadRepositoryEnv(directory);
    assert.equal(process.env[probe], 'from-file');
  } finally {
    delete process.env[probe];
    rmSync(directory, { recursive: true, force: true });
  }
});
