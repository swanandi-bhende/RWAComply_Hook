import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getAddress, recoverTypedDataAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { registrationTypedData } from './allocationAuth.ts';
import { handleContinue } from './continue.ts';
import { handleEnroll } from './enroll.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import { handleWalletAuthorization, handleWalletChallenge } from './walletLink.ts';

const APP_ID = 'app_test_fixture';
const RP_ID = 'rp_a11ce';
const WORLD_KEY = `0x${'ab'.repeat(32)}` as const;
const ALLOCATION_KEY = `0x${'cd'.repeat(32)}` as const;
const WALLET_KEY = `0x${'11'.repeat(32)}` as const;
const OTHER_WALLET_KEY = `0x${'22'.repeat(32)}` as const;
const ENCRYPTION_KEY = `0x${'ef'.repeat(32)}`;
const LEDGER = getAddress(`0x${'33'.repeat(20)}`);
const GROUP = `0x${'44'.repeat(32)}` as Hex;
const NOW_MS = 1_800_000_000_000;
const NOW_SECONDS = NOW_MS / 1000;
const ALLOCATION_SIGNER = privateKeyToAccount(ALLOCATION_KEY).address;

function sessionId(tag: string): string {
  return `session_${tag.padStart(64, '0')}01${'0'.repeat(62)}`;
}

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    WORLD_APP_ID: APP_ID,
    WORLD_RP_ID: RP_ID,
    WORLD_PRIVATE_KEY: WORLD_KEY,
    WORLD_RP_SIGNER_ADDRESS: privateKeyToAccount(WORLD_KEY).address,
    WORLD_SESSION_ENCRYPTION_KEY: ENCRYPTION_KEY,
    WORLD_ID_ENVIRONMENT: 'staging',
    ALLOCATION_AUTH_SIGNING_KEY: ALLOCATION_KEY,
    ALLOCATION_AUTH_SIGNER_ADDRESS: ALLOCATION_SIGNER,
    ALLOCATION_LEDGER_ADDRESS: LEDGER,
    ALLOCATION_CHAIN_ID: '31337',
    ALLOCATION_GROUP_ID: GROUP,
    ...overrides,
  };
}

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function enroll(store: EnrollmentStore, id: string, nullifier: string) {
  const response = await handleEnroll(post('http://localhost/api/world/enroll', {
    protocol_version: '4.0',
    action: 'signup',
    session_id: id,
    environment: 'staging',
    responses: [{
      identifier: 'proof_of_human',
      issuer_schema_id: 1,
      nullifier,
      proof: ['1', '2', '3', '4', '5'],
      expires_at_min: NOW_SECONDS + 1000,
    }],
  }), {
    env: env(),
    store,
    verify: async () => ({
      ok: true,
      status: 200,
      body: {
        success: true,
        protocol_version: '4.0',
        action: 'signup',
        environment: 'staging',
        nullifier,
        results: [{ identifier: 'proof_of_human', success: true, nullifier }],
      },
    }),
  });
  assert.equal(response.status, 200);
}

async function grantFor(store: EnrollmentStore, id: string): Promise<string> {
  const response = await handleContinue(post('http://localhost/api/world/continue', {
    protocol_version: '4.0',
    session_id: id,
    environment: 'staging',
    responses: [{
      identifier: 'proof_of_human',
      issuer_schema_id: 1,
      session_nullifier: ['12345', '67890'],
      proof: ['1', '2', '3', '4', '5'],
      expires_at_min: NOW_SECONDS + 1000,
    }],
  }), {
    env: env(),
    store,
    now: () => NOW_MS,
    verify: async () => ({
      ok: true,
      status: 200,
      body: {
        success: true,
        protocol_version: '4.0',
        environment: 'staging',
        session_id: id,
        results: [{ identifier: 'proof_of_human', success: true, sessionId: id }],
      },
    }),
  });
  const body = (await response.json()) as { continuation_token: string };
  assert.equal(response.status, 200);
  return body.continuation_token;
}

async function signChallenge(walletKey: Hex, challenge: {
  domain: { chainId: number; verifyingContract: Hex };
  types: { WalletLink: readonly { name: string; type: string }[] };
  primaryType: 'WalletLink';
  message: { purpose: string; appId: string; wallet: Hex; nonce: Hex; issuedAt: number; expiry: number };
}, overrides: { chainId?: number; verifyingContract?: Hex; wallet?: Hex } = {}) {
  return privateKeyToAccount(walletKey).signTypedData({
    domain: {
      name: 'RWAComplyWalletLink',
      version: '1',
      chainId: overrides.chainId ?? challenge.domain.chainId,
      verifyingContract: overrides.verifyingContract ?? challenge.domain.verifyingContract,
    },
    types: challenge.types,
    primaryType: 'WalletLink',
    message: {
      ...challenge.message,
      wallet: overrides.wallet ?? challenge.message.wallet,
      issuedAt: BigInt(challenge.message.issuedAt),
      expiry: BigInt(challenge.message.expiry),
    },
  });
}

test('a wallet signature authorizes the existing allocation and a second wallet keeps it', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-wallet-'));
  const store = new EnrollmentStore(path.join(directory, 'enroll.sqlite'));
  const first = sessionId('ab');
  const wallet = privateKeyToAccount(WALLET_KEY).address;
  const secondWallet = privateKeyToAccount(OTHER_WALLET_KEY).address;
  try {
    await enroll(store, first, '12345678901234567890');
    const token = await grantFor(store, first);
    const challengeResponse = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: token, wallet }),
      { env: env(), store, now: () => NOW_MS },
    );
    const challengeBody = (await challengeResponse.json()) as {
      challenge: {
        domain: { name: string; version: string; chainId: number; verifyingContract: Hex };
        types: { WalletLink: { name: string; type: string }[] };
        primaryType: 'WalletLink';
        message: { purpose: string; appId: string; wallet: Hex; nonce: Hex; issuedAt: number; expiry: number };
      };
      allocationId?: string;
    };
    assert.equal(challengeResponse.status, 200);
    assert.equal(challengeBody.allocationId, undefined);
    assert.equal(challengeBody.challenge.message.wallet, wallet);
    assert.equal(challengeBody.challenge.domain.chainId, 31337);
    assert.equal(challengeBody.challenge.domain.verifyingContract, LEDGER);
    assert.deepEqual(
      challengeBody.challenge.types.WalletLink.map((field) => field.name),
      ['purpose', 'appId', 'wallet', 'nonce', 'issuedAt', 'expiry'],
    );

    const signature = await signChallenge(WALLET_KEY, challengeBody.challenge);
    const authorized = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', {
        continuation_token: token,
        wallet,
        signature,
      }),
      { env: env(), store, now: () => NOW_MS },
    );
    const authorization = (await authorized.json()) as {
      wallet: Hex;
      allocationId: Hex;
      groupId: Hex;
      expiry: number;
      nonce: string;
      signature: Hex;
      chainId: number;
      verifyingContract: Hex;
    };
    assert.equal(authorized.status, 200);
    assert.equal(authorization.wallet, wallet);
    assert.equal(authorization.groupId, GROUP);
    assert.equal(authorization.chainId, 31337);
    assert.equal(authorization.verifyingContract, LEDGER);
    assert.equal(authorization.expiry, NOW_SECONDS + 600);
    const recovered = await recoverTypedDataAddress({
      ...registrationTypedData({
        chainId: authorization.chainId,
        ledgerAddress: authorization.verifyingContract,
        wallet: authorization.wallet,
        allocationId: authorization.allocationId,
        groupId: authorization.groupId,
        expiry: BigInt(authorization.expiry),
        nonce: BigInt(authorization.nonce),
      }),
      signature: authorization.signature,
    });
    assert.equal(recovered, ALLOCATION_SIGNER);
    const otherWalletDigest = await recoverTypedDataAddress({
      ...registrationTypedData({
        chainId: authorization.chainId,
        ledgerAddress: authorization.verifyingContract,
        wallet: secondWallet,
        allocationId: authorization.allocationId,
        groupId: authorization.groupId,
        expiry: BigInt(authorization.expiry),
        nonce: BigInt(authorization.nonce),
      }),
      signature: authorization.signature,
    });
    assert.notEqual(otherWalletDigest, ALLOCATION_SIGNER);

    const replay = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', { continuation_token: token, wallet, signature }),
      { env: env(), store, now: () => NOW_MS },
    );
    assert.equal(replay.status, 409);

    const sameToken = await grantFor(store, first);
    const sameChallenge = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: sameToken, wallet }),
      { env: env(), store, now: () => NOW_MS },
    );
    const sameBody = (await sameChallenge.json()) as { challenge: Parameters<typeof signChallenge>[1] };
    const sameSignature = await signChallenge(WALLET_KEY, sameBody.challenge);
    const sameAuthorization = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', {
        continuation_token: sameToken,
        wallet,
        signature: sameSignature,
      }),
      { env: env(), store, now: () => NOW_MS },
    );
    const same = (await sameAuthorization.json()) as { allocationId: string; nonce: string };
    assert.equal(sameAuthorization.status, 200);
    assert.equal(same.allocationId, authorization.allocationId);
    assert.notEqual(same.nonce, authorization.nonce);

    const secondToken = await grantFor(store, first);
    const secondChallenge = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: secondToken, wallet: secondWallet }),
      { env: env(), store, now: () => NOW_MS },
    );
    const secondBody = (await secondChallenge.json()) as { challenge: Parameters<typeof signChallenge>[1] };
    const secondSignature = await signChallenge(OTHER_WALLET_KEY, secondBody.challenge);
    const secondAuthorization = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', {
        continuation_token: secondToken,
        wallet: secondWallet,
        signature: secondSignature,
      }),
      { env: env(), store, now: () => NOW_MS },
    );
    const second = (await secondAuthorization.json()) as { allocationId: string; nonce: string };
    assert.equal(secondAuthorization.status, 200);
    assert.equal(second.allocationId, authorization.allocationId);
    assert.notEqual(second.nonce, authorization.nonce);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('wallet challenges reject bad signatures, expiry, reuse, and conflicting allocations', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-wallet-'));
  const store = new EnrollmentStore(path.join(directory, 'enroll.sqlite'));
  const wallet = privateKeyToAccount(WALLET_KEY).address;
  const other = privateKeyToAccount(OTHER_WALLET_KEY).address;
  try {
    await enroll(store, sessionId('ab'), '111');
    await enroll(store, sessionId('cd'), '222');
    const token = await grantFor(store, sessionId('ab'));
    const unknown = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: 'ab'.repeat(32), wallet }),
      { env: env(), store, now: () => NOW_MS },
    );
    assert.equal(unknown.status, 404);

    const missingKey = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: token, wallet }),
      { env: env({ ALLOCATION_AUTH_SIGNING_KEY: undefined }), store, now: () => NOW_MS },
    );
    const missingBody = (await missingKey.json()) as { error: string };
    assert.equal(missingKey.status, 500);
    assert.equal(missingBody.error, 'ALLOCATION_AUTH_SIGNING_KEY is not configured');
    assert.equal(missingBody.error.includes(WORLD_KEY), false);

    const reusedWorldKey = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: token, wallet }),
      {
        env: env({
          ALLOCATION_AUTH_SIGNING_KEY: WORLD_KEY,
          ALLOCATION_AUTH_SIGNER_ADDRESS: privateKeyToAccount(WORLD_KEY).address,
        }),
        store,
        now: () => NOW_MS,
      },
    );
    assert.equal(reusedWorldKey.status, 500);

    const challengeResponse = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: token, wallet }),
      { env: env(), store, now: () => NOW_MS },
    );
    const challenge = (await challengeResponse.json()) as { challenge: Parameters<typeof signChallenge>[1] };
    const signature = await signChallenge(WALLET_KEY, challenge.challenge);
    const wrongSigner = await signChallenge(OTHER_WALLET_KEY, challenge.challenge);
    const wrongChain = await signChallenge(WALLET_KEY, challenge.challenge, { chainId: 1 });
    const wrongContract = await signChallenge(WALLET_KEY, challenge.challenge, {
      verifyingContract: getAddress(`0x${'55'.repeat(20)}`),
    });
    for (const bad of [wrongSigner, wrongChain, wrongContract]) {
      const response = await handleWalletAuthorization(
        post('http://localhost/api/world/wallet-authorization', { continuation_token: token, wallet, signature: bad }),
        { env: env(), store, now: () => NOW_MS },
      );
      assert.equal(response.status, 422);
    }
    const transferred = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', { continuation_token: token, wallet: other, signature }),
      { env: env(), store, now: () => NOW_MS },
    );
    assert.equal(transferred.status, 422);

    const expired = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', { continuation_token: token, wallet, signature }),
      { env: env(), store, now: () => NOW_MS + 301_000 },
    );
    assert.equal(expired.status, 422);

    const freshChallenge = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: token, wallet }),
      { env: env(), store, now: () => NOW_MS },
    );
    const fresh = (await freshChallenge.json()) as { challenge: Parameters<typeof signChallenge>[1] };
    const freshSignature = await signChallenge(WALLET_KEY, fresh.challenge);
    const ok = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', {
        continuation_token: token,
        wallet,
        signature: freshSignature,
      }),
      { env: env(), store, now: () => NOW_MS, nonceUsed: async () => false },
    );
    assert.equal(ok.status, 200);
    const again = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', {
        continuation_token: token,
        wallet,
        signature: freshSignature,
      }),
      { env: env(), store, now: () => NOW_MS },
    );
    assert.equal(again.status, 409);

    const otherToken = await grantFor(store, sessionId('cd'));
    const conflictChallenge = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: otherToken, wallet }),
      { env: env(), store, now: () => NOW_MS },
    );
    const conflictBody = (await conflictChallenge.json()) as { challenge: Parameters<typeof signChallenge>[1] };
    const conflictSignature = await signChallenge(WALLET_KEY, conflictBody.challenge);
    const conflict = await handleWalletAuthorization(
      post('http://localhost/api/world/wallet-authorization', {
        continuation_token: otherToken,
        wallet,
        signature: conflictSignature,
      }),
      { env: env(), store, now: () => NOW_MS },
    );
    assert.equal(conflict.status, 409);
    assert.equal(store.associationFor(wallet.toLowerCase())?.allocationId, (await ok.json()).allocationId);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('concurrent authorization of one grant has one winner', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-wallet-'));
  const file = path.join(directory, 'enroll.sqlite');
  const first = new EnrollmentStore(file);
  const second = new EnrollmentStore(file);
  const wallet = privateKeyToAccount(WALLET_KEY).address;
  try {
    await enroll(first, sessionId('ab'), '333');
    const token = await grantFor(first, sessionId('ab'));
    const challengeResponse = await handleWalletChallenge(
      post('http://localhost/api/world/wallet-challenge', { continuation_token: token, wallet }),
      { env: env(), store: first, now: () => NOW_MS },
    );
    const challenge = (await challengeResponse.json()) as { challenge: Parameters<typeof signChallenge>[1] };
    const signature = await signChallenge(WALLET_KEY, challenge.challenge);
    const [left, right] = await Promise.all([
      handleWalletAuthorization(
        post('http://localhost/api/world/wallet-authorization', { continuation_token: token, wallet, signature }),
        { env: env(), store: first, now: () => NOW_MS },
      ),
      handleWalletAuthorization(
        post('http://localhost/api/world/wallet-authorization', { continuation_token: token, wallet, signature }),
        { env: env(), store: second, now: () => NOW_MS },
      ),
    ]);
    const statuses = [left.status, right.status].sort();
    assert.equal(statuses[0], 200);
    assert.equal(statuses[1] === 409 || statuses[1] === 422, true);
  } finally {
    first.close();
    second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
