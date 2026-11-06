import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { encodeAbiParameters, encodeEventTopics, getAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { handleContinue } from './continue.ts';
import { handleEnroll } from './enroll.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import {
  LEDGER_REGISTRATION_ABI,
  inspectRegistration,
  submitRegistration,
  type LedgerReceipt,
  type LedgerRegistrationClient,
  type RegisterWalletArgs,
} from './ledgerRegistration.ts';
import { handleRegistrationReceipt } from './registrationReceipt.ts';
import { handleWalletAuthorization, handleWalletChallenge } from './walletLink.ts';

const WALLET = getAddress(`0x${'11'.repeat(20)}`);
const LEDGER = getAddress(`0x${'22'.repeat(20)}`);
const OTHER = getAddress(`0x${'33'.repeat(20)}`);
const ALLOCATION = `0x${'ab'.repeat(32)}` as Hex;
const OTHER_ALLOCATION = `0x${'cd'.repeat(32)}` as Hex;
const GROUP = `0x${'44'.repeat(32)}` as Hex;
const ZERO = `0x${'0'.repeat(64)}` as Hex;
const SIGNATURE = `0x${'aa'.repeat(65)}` as Hex;
const SECRET = `0x${'ef'.repeat(32)}`;
const NOW = 1_800_000_000;

function authorization(overrides: Record<string, unknown> = {}) {
  return {
    wallet: WALLET,
    allocationId: ALLOCATION,
    groupId: GROUP,
    expiry: NOW + 600,
    nonce: '99',
    signature: SIGNATURE,
    chainId: 31337,
    verifyingContract: LEDGER,
    ...overrides,
  };
}

function registeredLog(nonce = BigInt(99), expiry = BigInt(NOW + 600)): LedgerReceipt['logs'][number] {
  const topics = encodeEventTopics({
    abi: LEDGER_REGISTRATION_ABI,
    eventName: 'WalletRegistered',
    args: { wallet: WALLET, allocationId: ALLOCATION, groupId: GROUP },
  }).filter((topic): topic is Hex => typeof topic === 'string');
  return {
    address: LEDGER,
    topics,
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }],
      [expiry, nonce],
    ),
  };
}

function client(overrides: Partial<LedgerRegistrationClient> = {}): LedgerRegistrationClient & { calls: RegisterWalletArgs[] } {
  const calls: RegisterWalletArgs[] = [];
  let sent = false;
  return {
    calls,
    getAllocationId: async () => (sent ? ALLOCATION : ZERO),
    getNonceUsed: async () => true,
    getBackendSigner: async () => OTHER,
    simulateRegister: async (args) => {
      calls.push(args);
    },
    sendRegister: async (args) => {
      sent = true;
      calls.push(args);
      return `0x${'ab'.repeat(32)}`;
    },
    waitForReceipt: async () => ({
      status: 'success',
      to: LEDGER,
      logs: [registeredLog()],
    }),
    ...overrides,
  };
}

const context = {
  connectedWallet: WALLET,
  chainId: 31337,
  ledgerAddress: LEDGER,
  groupId: GROUP,
  nowSeconds: NOW,
};

test('registration submits the authorized arguments and confirms chain state', async () => {
  const chain = client();
  const ready = await inspectRegistration({ ...context, authorization: authorization(), client: chain });
  assert.equal(ready.state, 'ready');
  assert.equal(ready.message, 'Confirm wallet registration');

  const result = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: chain,
  });
  assert.equal(result.ok, true);
  assert.equal(result.state, 'confirmed');
  assert.equal(result.message, 'Wallet linked to your shared allocation');
  assert.deepEqual(chain.calls[1], {
    wallet: WALLET,
    allocationId: ALLOCATION,
    groupId: GROUP,
    expiry: BigInt(NOW + 600),
    nonce: BigInt(99),
    signature: SIGNATURE,
  });
});

test('registration is blocked before a transaction for invalid or conflicting wallets', async () => {
  const cases: Array<{ input: Parameters<typeof inspectRegistration>[0]; state: string; sends: boolean }> = [
    { input: { ...context, authorization: undefined, client: client() }, state: 'invalid', sends: false },
    { input: { ...context, authorization: authorization({ signature: '0x1234' }), client: client() }, state: 'invalid', sends: false },
    { input: { ...context, authorization: authorization(), chainId: 1, client: client() }, state: 'wrong_network', sends: false },
    { input: { ...context, authorization: authorization(), connectedWallet: OTHER, client: client() }, state: 'invalid', sends: false },
    { input: { ...context, authorization: authorization(), ledgerAddress: undefined, client: client() }, state: 'unavailable', sends: false },
    { input: { ...context, authorization: authorization({ expiry: NOW - 1 }), client: client() }, state: 'expired', sends: false },
    {
      input: {
        ...context,
        authorization: authorization(),
        client: client({ getAllocationId: async () => ALLOCATION }),
      },
      state: 'already_linked',
      sends: false,
    },
    {
      input: {
        ...context,
        authorization: authorization(),
        client: client({ getAllocationId: async () => OTHER_ALLOCATION }),
      },
      state: 'conflict',
      sends: false,
    },
  ];
  for (const item of cases) {
    const chain = item.input.client as LedgerRegistrationClient & { calls?: RegisterWalletArgs[] };
    const inspected = await inspectRegistration(item.input);
    assert.equal(inspected.state, item.state);
    if (item.input.ledgerAddress === undefined) continue;
    const submitted = await submitRegistration({
      ...item.input,
      client: chain,
    });
    assert.equal(submitted.state, item.state);
    assert.equal(chain.calls?.length ?? 0, 0);
  }
});

test('registration handles rejection, revert, and chain mismatches without confirming', async () => {
  const rejected = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: client({
      sendRegister: async () => {
        const error = new Error(SECRET);
        error.name = 'UserRejectedRequestError';
        throw error;
      },
    }),
  });
  assert.equal(rejected.state, 'rejected');
  assert.equal(rejected.message.includes(SECRET), false);

  const simulated = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: client({
      simulateRegister: async () => {
        throw new Error(`reverted ${SECRET}`);
      },
    }),
  });
  assert.equal(simulated.state, 'failed');
  assert.equal(simulated.message.includes(SECRET), false);

  const reused = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: client({
      simulateRegister: async () => {
        throw new Error('NonceAlreadyUsed');
      },
    }),
  });
  assert.equal(reused.state, 'failed');
  assert.match(reused.message, /already used/);

  const reverted = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: client({
      waitForReceipt: async () => ({ status: 'reverted', to: LEDGER, logs: [] }),
    }),
  });
  assert.equal(reverted.state, 'failed');
  assert.equal(reverted.ok, false);

  const wrongContract = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: client({
      waitForReceipt: async () => ({ status: 'success', to: OTHER, logs: [registeredLog()] }),
    }),
  });
  assert.equal(wrongContract.state, 'verification_error');

  const missingEvent = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: client({
      waitForReceipt: async () => ({ status: 'success', to: LEDGER, logs: [] }),
    }),
  });
  assert.equal(missingEvent.state, 'verification_error');

  let sentMismatch = false;
  const mismatched = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: client({
      getAllocationId: async () => (sentMismatch ? OTHER_ALLOCATION : ZERO),
      sendRegister: async () => {
        sentMismatch = true;
        return `0x${'ab'.repeat(32)}`;
      },
      waitForReceipt: async () => ({ status: 'success', to: LEDGER, logs: [registeredLog()] }),
    }),
  });
  assert.equal(mismatched.state, 'verification_error');

  const unusedNonce = await submitRegistration({
    ...context,
    authorization: authorization(),
    client: client({ getNonceUsed: async () => false }),
  });
  assert.equal(unusedNonce.state, 'verification_error');
  assert.equal(unusedNonce.message, 'Wallet registration could not be verified');
});

const WORLD_KEY = `0x${'ab'.repeat(32)}` as const;
const ALLOCATION_KEY = `0x${'cd'.repeat(32)}` as const;

function sessionId(tag: string): string {
  return `session_${tag.padStart(64, '0')}01${'0'.repeat(62)}`;
}

function env() {
  return {
    WORLD_APP_ID: 'app_test_fixture',
    WORLD_RP_ID: 'rp_a11ce',
    WORLD_PRIVATE_KEY: WORLD_KEY,
    WORLD_RP_SIGNER_ADDRESS: privateKeyToAccount(WORLD_KEY).address,
    WORLD_SESSION_ENCRYPTION_KEY: `0x${'12'.repeat(32)}`,
    WORLD_ID_ENVIRONMENT: 'staging',
    ALLOCATION_AUTH_SIGNING_KEY: ALLOCATION_KEY,
    ALLOCATION_AUTH_SIGNER_ADDRESS: privateKeyToAccount(ALLOCATION_KEY).address,
    ALLOCATION_LEDGER_ADDRESS: LEDGER,
    ALLOCATION_CHAIN_ID: '31337',
    ALLOCATION_GROUP_ID: GROUP,
  };
}

test('an issued authorization stays unconfirmed until the chain receipt matches', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rwacomply-register-'));
  const store = new EnrollmentStore(path.join(directory, 'enroll.sqlite'));
  const wallet = privateKeyToAccount(`0x${'11'.repeat(32)}` as const).address;
  const id = sessionId('ab');
  try {
    const enrolled = await handleEnroll(new Request('http://localhost/api/world/enroll', {
      method: 'POST',
      body: JSON.stringify({
        protocol_version: '4.0',
        action: 'signup',
        session_id: id,
        environment: 'staging',
        responses: [{
          identifier: 'proof_of_human',
          issuer_schema_id: 1,
          nullifier: '111',
          proof: ['1', '2', '3', '4', '5'],
          expires_at_min: NOW + 1000,
        }],
      }),
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
          nullifier: '111',
          results: [{ identifier: 'proof_of_human', success: true, nullifier: '111' }],
        },
      }),
    });
    assert.equal(enrolled.status, 200);
    const continued = await handleContinue(new Request('http://localhost/api/world/continue', {
      method: 'POST',
      body: JSON.stringify({
        protocol_version: '4.0',
        session_id: id,
        environment: 'staging',
        responses: [{
          identifier: 'proof_of_human',
          issuer_schema_id: 1,
          session_nullifier: ['12345', '67890'],
          proof: ['1', '2', '3', '4', '5'],
          expires_at_min: NOW + 1000,
        }],
      }),
    }), {
      env: env(),
      store,
      now: () => NOW * 1000,
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
    const token = ((await continued.json()) as { continuation_token: string }).continuation_token;
    const challengeResponse = await handleWalletChallenge(
      new Request('http://localhost/api/world/wallet-challenge', {
        method: 'POST',
        body: JSON.stringify({ continuation_token: token, wallet }),
      }),
      { env: env(), store, now: () => NOW * 1000 },
    );
    const challenge = (await challengeResponse.json()) as {
      challenge: {
        domain: { chainId: number; verifyingContract: Address };
        types: { WalletLink: readonly { name: string; type: string }[] };
        primaryType: 'WalletLink';
        message: { purpose: string; appId: string; wallet: Address; nonce: Hex; issuedAt: number; expiry: number };
      };
    };
    const signature = await privateKeyToAccount(`0x${'11'.repeat(32)}` as const).signTypedData({
      domain: {
        name: 'RWAComplyWalletLink',
        version: '1',
        chainId: challenge.challenge.domain.chainId,
        verifyingContract: challenge.challenge.domain.verifyingContract,
      },
      types: challenge.challenge.types,
      primaryType: 'WalletLink',
      message: {
        ...challenge.challenge.message,
        issuedAt: BigInt(challenge.challenge.message.issuedAt),
        expiry: BigInt(challenge.challenge.message.expiry),
      },
    });
    const authorized = await handleWalletAuthorization(
      new Request('http://localhost/api/world/wallet-authorization', {
        method: 'POST',
        body: JSON.stringify({ continuation_token: token, wallet, signature }),
      }),
      { env: env(), store, now: () => NOW * 1000 },
    );
    const body = (await authorized.json()) as { nonce: string; allocationId: Hex; signature: Hex; expiry: number };
    assert.equal(authorized.status, 200);
    const issued = store.registrationByNonce(body.nonce);
    assert.equal(issued?.chainStatus, 'issued');
    assert.equal(issued?.txHash, null);

    const claimed = await handleRegistrationReceipt(new Request('http://localhost/api/world/registration-receipt', {
      method: 'POST',
      body: JSON.stringify({ nonce: body.nonce, success: true }),
    }), { env: env(), store });
    assert.equal(claimed.status, 400);
    assert.equal(store.registrationByNonce(body.nonce)?.chainStatus, 'issued');

    const txHash = `0x${'ab'.repeat(32)}` as Hex;
    const topics = encodeEventTopics({
      abi: LEDGER_REGISTRATION_ABI,
      eventName: 'WalletRegistered',
      args: { wallet, allocationId: body.allocationId, groupId: GROUP },
    }).filter((topic): topic is Hex => typeof topic === 'string');
    const confirmed = await handleRegistrationReceipt(new Request('http://localhost/api/world/registration-receipt', {
      method: 'POST',
      body: JSON.stringify({ nonce: body.nonce, txHash }),
    }), {
      env: env(),
      store,
      observe: async () => ({
        seen: true,
        allocationId: body.allocationId,
        nonceUsed: true,
        receipt: {
          status: 'success',
          to: LEDGER,
          logs: [{
            address: LEDGER,
            topics,
            data: encodeAbiParameters(
              [{ type: 'uint256' }, { type: 'uint256' }],
              [BigInt(body.expiry), BigInt(body.nonce)],
            ),
          }],
        },
      }),
    });
    assert.equal(confirmed.status, 200);
    assert.equal(store.registrationByNonce(body.nonce)?.chainStatus, 'confirmed');
    assert.equal(store.registrationByNonce(body.nonce)?.txHash, txHash);
    const echoed = JSON.stringify(confirmed);
    assert.equal(echoed.includes(SECRET), false);
    assert.equal(echoed.includes(ALLOCATION_KEY), false);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
