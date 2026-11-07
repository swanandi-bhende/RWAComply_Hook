import assert from 'node:assert/strict';
import test from 'node:test';
import { getAddress, type Hex } from 'viem';
import { formatUsdc, purchaseDecision } from './money.ts';
import { rpcHttpUrl } from './rpc.ts';
import {
  assembleProductStatus,
  missingAllocationEnv,
  parseExecutionAddresses,
  SEPOLIA_CHAIN_ID,
  statusContainsSecrets,
  type ConfiguredAllocation,
  type ProductProbe,
} from './status.ts';
import { verificationFailure, walletLinkFailure } from './copy.ts';
import { accessTierMessage, deploymentMessages } from './readiness.ts';

const LEDGER = getAddress('0x0000000000000000000000000000000000000001');
const SIGNER = getAddress('0x0000000000000000000000000000000000000002');
const USDC = getAddress('0x0000000000000000000000000000000000000003');
const RWA = getAddress('0x0000000000000000000000000000000000000004');
const HOOK = getAddress('0x0000000000000000000000000000000000000005');
const EXECUTOR = getAddress('0x0000000000000000000000000000000000000006');
const GROUP = `0x${'ab'.repeat(32)}` as Hex;
const SECRET = '0x' + '11'.repeat(32);

const env = {
  ALLOCATION_AUTH_SIGNING_KEY: SECRET,
  ALLOCATION_AUTH_SIGNER_ADDRESS: SIGNER,
  ALLOCATION_LEDGER_ADDRESS: LEDGER,
  ALLOCATION_CHAIN_ID: String(SEPOLIA_CHAIN_ID),
  ALLOCATION_GROUP_ID: GROUP,
  NEXT_PUBLIC_EXECUTOR_ADDRESS: EXECUTOR,
  NEXT_PUBLIC_HOOK_ADDRESS: HOOK,
  NEXT_PUBLIC_TOKEN_A_ADDRESS: USDC,
  NEXT_PUBLIC_TOKEN_B_ADDRESS: RWA,
};

function config(): ConfiguredAllocation {
  return { signerAddress: SIGNER, ledgerAddress: LEDGER, chainId: SEPOLIA_CHAIN_ID, groupId: GROUP };
}

function probe(overrides: Partial<ProductProbe> = {}): ProductProbe {
  return {
    chainId: async () => SEPOLIA_CHAIN_ID,
    hasCode: async () => true,
    backendSigner: async () => SIGNER,
    policy: async () => ({ cap: BigInt(1_000_000_000), periodId: BigInt(1), usdc: USDC }),
    hookAllocation: async () => ({ groupId: GROUP, periodId: BigInt(1) }),
    executorTokens: async () => ({ usdc: USDC, rwa: RWA }),
    ...overrides,
  };
}

test('USDC amounts format from six-decimal raw values', () => {
  assert.equal(formatUsdc(BigInt(1_000_000_000)), '$1,000');
  assert.equal(formatUsdc(BigInt(700_000_000)), '$700');
  assert.equal(formatUsdc(BigInt(300_000_000)), '$300');
  assert.equal(formatUsdc(BigInt(1_500_000)), '$1.5');
});

test('a purchase above the remaining allocation is rejected before submission', () => {
  const over = purchaseDecision({ remaining: BigInt(300_000_000), requested: BigInt(500_000_000) });
  assert.equal(over.allowed, false);
  assert.equal(over.reason, 'exceeds');
  const within = purchaseDecision({ remaining: BigInt(300_000_000), requested: BigInt(200_000_000) });
  assert.equal(within.allowed, true);
  assert.equal(within.remainingAfter, BigInt(100_000_000));
  assert.equal(purchaseDecision({ remaining: null, requested: BigInt(1) }).reason, 'unavailable');
});

test('missing configuration does not become a live Sepolia deployment', async () => {
  const status = await assembleProductStatus({
    env: { ALLOCATION_CHAIN_ID: String(SEPOLIA_CHAIN_ID) },
    readConfig: () => {
      throw new Error('should not read config');
    },
    probe: probe(),
  });
  assert.equal(status.live, false);
  assert.deepEqual(missingAllocationEnv({}), [
    'ALLOCATION_AUTH_SIGNING_KEY',
    'ALLOCATION_AUTH_SIGNER_ADDRESS',
    'ALLOCATION_LEDGER_ADDRESS',
    'ALLOCATION_CHAIN_ID',
    'ALLOCATION_GROUP_ID',
  ]);
  assert.equal(status.policy, null);
  assert.equal(statusContainsSecrets(status), false);
});

test('wrong chain, missing code, signer mismatch, and rpc failure stay unavailable', async () => {
  const wrongChain = await assembleProductStatus({
    env,
    readConfig: () => ({ ...config(), chainId: 1 }),
    probe: probe(),
  });
  assert.equal(wrongChain.live, false);
  assert.match(wrongChain.configurationError ?? '', /Sepolia/);

  const noCode = await assembleProductStatus({
    env,
    readConfig: config,
    probe: probe({ hasCode: async () => false }),
  });
  assert.equal(noCode.live, false);
  assert.equal(noCode.ledger?.hasCode, false);
  assert.equal(noCode.policy, null);

  const signer = await assembleProductStatus({
    env,
    readConfig: config,
    probe: probe({ backendSigner: async () => getAddress('0x0000000000000000000000000000000000000099') }),
  });
  assert.equal(signer.live, false);
  assert.equal(signer.ledger?.signerMatches, false);

  const rpc = await assembleProductStatus({
    env,
    readConfig: config,
    probe: probe({
      chainId: async () => {
        throw new Error('rpc down');
      },
    }),
  });
  assert.equal(rpc.live, false);
  assert.equal(rpc.rpcReady, false);
  assert.equal(statusContainsSecrets({ ...rpc, signingKeyHex: SECRET }), true);
  assert.equal(statusContainsSecrets(rpc), false);
});

test('a matching ledger and market can be live, and a token mismatch cannot', async () => {
  const live = await assembleProductStatus({ env, readConfig: config, probe: probe() });
  assert.equal(live.live, true);
  assert.equal(live.registrationReady, true);
  assert.equal(live.policyReady, true);
  assert.equal(live.marketReady, true);
  assert.equal(live.policy?.cap, '1000000000');
  assert.equal(live.execution.available, true);
  assert.equal(statusContainsSecrets(live), false);
  assert.equal(JSON.stringify(live).includes(SECRET), false);

  const mismatch = await assembleProductStatus({
    env,
    readConfig: config,
    probe: probe({
      executorTokens: async () => ({ usdc: USDC, rwa: getAddress('0x0000000000000000000000000000000000000008') }),
    }),
  });
  assert.equal(mismatch.live, true);
  assert.equal(mismatch.execution.available, false);
  assert.match(mismatch.execution.reason ?? '', /tokens/);
  assert.equal(parseExecutionAddresses({}), null);
});

test('verification and wallet-link failures do not claim success', () => {
  assert.match(verificationFailure('cancelled'), /cancelled/i);
  assert.match(verificationFailure('proof_failed'), /could not be completed/);
  assert.match(verificationFailure('unexpected'), /could not be completed/);
  assert.match(verificationFailure('cancelled'), /No wallet was registered/);
  assert.doesNotMatch(verificationFailure('cancelled'), /verified/i);
  assert.match(walletLinkFailure('conflict'), /another allocation/);
  assert.match(walletLinkFailure('expired'), /expired/);
  assert.match(walletLinkFailure('signature_rejected'), /declined/);
});

test('registration, policy, market, and access tier stay separate', async () => {
  const noPolicy = await assembleProductStatus({
    env,
    readConfig: config,
    probe: probe({ policy: async () => ({ cap: BigInt(0), periodId: BigInt(1), usdc: USDC }) }),
  });
  assert.equal(noPolicy.registrationReady, true);
  assert.equal(noPolicy.policyReady, false);
  assert.equal(noPolicy.marketReady, false);
  assert.equal(noPolicy.live, false);
  assert.match(deploymentMessages(noPolicy).map((item) => item.text).join(' '), /policy is not configured/);

  const signer = await assembleProductStatus({
    env,
    readConfig: config,
    probe: probe({ backendSigner: async () => getAddress('0x0000000000000000000000000000000000000099') }),
  });
  assert.equal(signer.registrationReady, false);
  assert.equal(signer.marketReady, false);
  assert.match(deploymentMessages(signer).map((item) => item.text).join(' '), /signer does not match/);
  assert.match(accessTierMessage(0), /Issuer approval/);
  assert.doesNotMatch(accessTierMessage(0), /KYC/);
});

test('server reads use HTTP even when the configured URL is a websocket', () => {
  assert.equal(rpcHttpUrl('wss://rpc.example/sepolia'), 'https://rpc.example/sepolia');
  assert.equal(rpcHttpUrl('https://rpc.example/sepolia'), 'https://rpc.example/sepolia');
  assert.equal(rpcHttpUrl(''), '');
});
