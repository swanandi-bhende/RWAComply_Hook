import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { demoMode } from './demoMode.ts';
import {
  DEMO_COOKIE,
  handleDemoAuthorization,
  handleDemoChallenge,
  handleDemoIdentity,
  handleDemoStart,
} from './demoIdentity.ts';
import { DemoStore } from './demoStore.ts';
import { EnrollmentStore } from './enrollmentStore.ts';

const WORLD_KEY = `0x${'ab'.repeat(32)}` as const;
const ALLOCATION_KEY = `0x${'cd'.repeat(32)}` as const;
const WALLET_A = `0x${'11'.repeat(32)}` as const;
const WALLET_B = `0x${'22'.repeat(32)}` as const;
const LEDGER = getAddress(`0x${'33'.repeat(20)}`);
const GROUP = `0x${'44'.repeat(32)}` as Hex;

function env(flag?: string) {
  return {
    WORLD_APP_ID: 'app_test_fixture',
    WORLD_RP_ID: 'rp_a11ce',
    WORLD_PRIVATE_KEY: WORLD_KEY,
    WORLD_RP_SIGNER_ADDRESS: privateKeyToAccount(WORLD_KEY).address,
    WORLD_SESSION_ENCRYPTION_KEY: `0x${'ef'.repeat(32)}`,
    WORLD_ID_ENVIRONMENT: 'staging',
    ALLOCATION_AUTH_SIGNING_KEY: ALLOCATION_KEY,
    ALLOCATION_AUTH_SIGNER_ADDRESS: privateKeyToAccount(ALLOCATION_KEY).address,
    ALLOCATION_LEDGER_ADDRESS: LEDGER,
    ALLOCATION_CHAIN_ID: '31337',
    ALLOCATION_GROUP_ID: GROUP,
    ...(flag ? { RWA_DEMO_IDENTITY: flag } : {}),
  };
}

function request(pathname: string, init: { method?: string; body?: unknown; cookie?: string; host?: string } = {}): Request {
  const headers = new Headers({ host: init.host ?? 'localhost' });
  if (init.cookie) headers.set('cookie', init.cookie);
  return new Request(`http://localhost${pathname}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(new RegExp(`${DEMO_COOKIE}=([0-9a-f]{64})`));
  assert.ok(match);
  return `${DEMO_COOKIE}=${match[1]}`;
}

async function signChallenge(key: `0x${string}`, response: Response): Promise<Hex> {
  const body = await response.json() as {
    challenge: {
      domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
      types: { WalletLink: { name: string; type: string }[] };
      message: { purpose: string; appId: string; wallet: `0x${string}`; nonce: Hex; issuedAt: number; expiry: number };
    };
  };
  return privateKeyToAccount(key).signTypedData({
    domain: body.challenge.domain,
    types: body.challenge.types,
    primaryType: 'WalletLink',
    message: {
      ...body.challenge.message,
      issuedAt: BigInt(body.challenge.message.issuedAt),
      expiry: BigInt(body.challenge.message.expiry),
    },
  });
}

test('demo mode is off unless an explicit local or hackathon setting allows it', () => {
  assert.equal(demoMode({}, 'localhost'), 'off');
  assert.equal(demoMode({ RWA_DEMO_IDENTITY: 'yes' }, 'localhost'), 'off');
  assert.equal(demoMode({ RWA_DEMO_IDENTITY: 'local' }, 'example.com'), 'off');
  assert.equal(demoMode({ RWA_DEMO_IDENTITY: 'local' }, 'localhost:3463'), 'local');
  assert.equal(demoMode({ RWA_DEMO_IDENTITY: 'hackathon' }, 'example.com'), 'hackathon');
});

test('a demo identity stays in the browser and is never a World ID enrollment', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-demo-'));
  const file = path.join(directory, 'enroll.sqlite');
  new EnrollmentStore(file);
  const store = new DemoStore(file);
  const options = { env: env('local'), store, now: () => 1_800_000_000_000 };
  try {
    const hidden = handleDemoIdentity(request('/api/demo/identity', { host: 'example.com' }), options);
    assert.equal((await hidden.json()).enabled, false);
    const blocked = handleDemoStart(request('/api/demo/start', { method: 'POST', host: 'example.com' }), options);
    assert.equal(blocked.status, 404);

    const started = handleDemoStart(request('/api/demo/start', { method: 'POST' }), options);
    const cookie = cookieFrom(started);
    const again = handleDemoStart(request('/api/demo/start', { method: 'POST', cookie }), options);
    assert.equal(store.countIdentities(), 1);
    assert.equal(store.countWorldEnrollments(), 0);
    const status = await handleDemoIdentity(request('/api/demo/identity', { cookie }), options).json() as {
      state: string;
      allocationId?: string;
      linkedWallets: string[];
    };
    assert.equal(status.state, 'active');
    assert.equal(status.allocationId, undefined);
    assert.deepEqual(status.linkedWallets, []);
    assert.equal((await again.json() as { state: string }).state, 'active');

    const chosen = await handleDemoChallenge(request('/api/demo/wallet-challenge', {
      method: 'POST',
      cookie,
      body: { wallet: privateKeyToAccount(WALLET_A).address, allocationId: `0x${'ab'.repeat(32)}` },
    }), options);
    assert.equal(chosen.status, 400);

    const challengeA = await handleDemoChallenge(request('/api/demo/wallet-challenge', {
      method: 'POST',
      cookie,
      body: { wallet: privateKeyToAccount(WALLET_A).address },
    }), options);
    const bad = await handleDemoAuthorization(request('/api/demo/wallet-authorization', {
      method: 'POST',
      cookie,
      body: { wallet: privateKeyToAccount(WALLET_A).address, signature: `0x${'00'.repeat(65)}` },
    }), options);
    assert.equal(bad.status, 422);

    const signatureA = await signChallenge(WALLET_A, challengeA.clone());
    const authA = await handleDemoAuthorization(request('/api/demo/wallet-authorization', {
      method: 'POST',
      cookie,
      body: { wallet: privateKeyToAccount(WALLET_A).address, signature: signatureA },
    }), options);
    const bodyA = await authA.json() as { allocationId: string; kind: string; nonce: string };
    assert.equal(bodyA.kind, 'demo');

    const challengeB = await handleDemoChallenge(request('/api/demo/wallet-challenge', {
      method: 'POST',
      cookie,
      body: { wallet: privateKeyToAccount(WALLET_B).address },
    }), options);
    const signatureB = await signChallenge(WALLET_B, challengeB);
    const authB = await handleDemoAuthorization(request('/api/demo/wallet-authorization', {
      method: 'POST',
      cookie,
      body: { wallet: privateKeyToAccount(WALLET_B).address, signature: signatureB },
    }), options);
    const bodyB = await authB.json() as { allocationId: string; nonce: string };
    assert.equal(bodyB.allocationId, bodyA.allocationId);
    assert.notEqual(bodyB.nonce, bodyA.nonce);
    assert.equal(store.countWorldEnrollments(), 0);

    const off = handleDemoStart(request('/api/demo/start', { method: 'POST', cookie }), { ...options, env: env() });
    assert.equal(off.status, 404);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a wallet linked to another allocation cannot join the demo identity', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-demo-'));
  const file = path.join(directory, 'enroll.sqlite');
  new EnrollmentStore(file);
  const store = new DemoStore(file);
  const options = { env: env('local'), store, now: () => 1_800_000_000_000 };
  const wallet = privateKeyToAccount(WALLET_A).address.toLowerCase();
  try {
    const started = handleDemoStart(request('/api/demo/start', { method: 'POST' }), options);
    const cookie = cookieFrom(started);
    const db = new DatabaseSync(file);
    db.prepare(
      'INSERT INTO wallet_association (wallet_address, allocation_id, enrollment_id, created_at) VALUES (?, ?, ?, ?)',
    ).run(wallet, `0x${'99'.repeat(32)}`, 1, new Date(0).toISOString());
    db.close();
    const challenge = await handleDemoChallenge(request('/api/demo/wallet-challenge', {
      method: 'POST',
      cookie,
      body: { wallet: privateKeyToAccount(WALLET_A).address },
    }), options);
    const signature = await signChallenge(WALLET_A, challenge);
    const rejected = await handleDemoAuthorization(request('/api/demo/wallet-authorization', {
      method: 'POST',
      cookie,
      body: { wallet: privateKeyToAccount(WALLET_A).address, signature },
    }), options);
    assert.equal(rejected.status, 409);
    assert.equal(store.countWorldEnrollments(), 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
