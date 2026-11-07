import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress, type Address, type Hex } from 'viem';
import {
  assessDemoWallet,
  demoAllocationId,
  demoRequestAllowed,
  demoTypedData,
  EXPECTED_CAP,
  EXPECTED_PERIOD,
  issueChallenge,
  LIQUIDITY_HELPER,
  openChallenge,
  readDemoConfig,
  SEPOLIA_CHAIN_ID,
  type DemoConfig,
  type DemoFacts,
} from './sepoliaDemo.ts';

const KEY = generatePrivateKey();
const SIGNER = privateKeyToAccount(KEY).address;
const LEDGER = '0x0000000000000000000000000000000000000002' as Address;
const OWNER = '0x0000000000000000000000000000000000000003' as Address;
const HOOK = '0x0000000000000000000000000000000000000004' as Address;
const EXECUTOR = '0x0000000000000000000000000000000000000005' as Address;
const USDC = '0x0000000000000000000000000000000000000006' as Address;
const RWA = '0x0000000000000000000000000000000000000007' as Address;
const WALLET_A = '0x00000000000000000000000000000000000000A1' as Address;
const WALLET_B = '0x00000000000000000000000000000000000000b2' as Address;
const GROUP = `0x${'ab'.repeat(32)}` as Hex;
const ZERO = `0x${'0'.repeat(64)}` as Hex;

function config(): DemoConfig {
  return { signer: SIGNER, ledger: LEDGER, groupId: GROUP, hook: HOOK, executor: EXECUTOR, usdc: USDC, rwa: RWA, allowlist: [WALLET_A, WALLET_B] };
}

function facts(overrides: Partial<DemoFacts> = {}): DemoFacts {
  return {
    chainId: SEPOLIA_CHAIN_ID,
    ledgerCode: true,
    hookCode: true,
    executorCode: true,
    usdcCode: true,
    rwaCode: true,
    backendSigner: SIGNER,
    owner: OWNER,
    authorizedHook: HOOK,
    hookGroupId: GROUP,
    hookPeriodId: EXPECTED_PERIOD,
    policyCap: EXPECTED_CAP,
    policyPeriodId: EXPECTED_PERIOD,
    policyUsdc: USDC,
    currentAllocation: ZERO,
    ...overrides,
  };
}

const env = {
  RWA_SEPOLIA_DEMO_BYPASS_ENABLED: 'true',
  RWA_SEPOLIA_DEMO_ALLOWED_WALLETS: `${WALLET_A},${WALLET_B.toLowerCase()}`,
  ALLOCATION_AUTH_SIGNER_ADDRESS: SIGNER,
  ALLOCATION_LEDGER_ADDRESS: LEDGER,
  ALLOCATION_CHAIN_ID: '11155111',
  ALLOCATION_GROUP_ID: GROUP,
  NEXT_PUBLIC_HOOK_ADDRESS: HOOK,
  NEXT_PUBLIC_EXECUTOR_ADDRESS: EXECUTOR,
  NEXT_PUBLIC_TOKEN_A_ADDRESS: USDC,
  NEXT_PUBLIC_TOKEN_B_ADDRESS: RWA,
};

test('the presentation bypass is disabled until an explicit allowlist is configured', () => {
  assert.equal('error' in readDemoConfig({}), true);
  assert.equal('error' in readDemoConfig({ RWA_SEPOLIA_DEMO_BYPASS_ENABLED: 'true' }), true);
  assert.equal('error' in readDemoConfig({ ...env, RWA_SEPOLIA_DEMO_ALLOWED_WALLETS: '*' }), true);
  const ready = readDemoConfig(env);
  assert.equal('error' in ready, false);
});

function denial(result: ReturnType<typeof assessDemoWallet>): string {
  return result.ok ? '' : result.error;
}

test('wallet checks reject strangers and infrastructure accounts', () => {
  const base = { chainId: SEPOLIA_CHAIN_ID, config: config(), facts: facts() };
  assert.equal(assessDemoWallet({ ...base, wallet: WALLET_A }).ok, true);
  assert.equal(assessDemoWallet({ ...base, wallet: '0x0000000000000000000000000000000000000099' }).ok, false);
  assert.match(denial(assessDemoWallet({ ...base, wallet: OWNER })), /infrastructure/);
  assert.match(denial(assessDemoWallet({ ...base, wallet: SIGNER })), /infrastructure/);
  assert.match(denial(assessDemoWallet({ ...base, wallet: LIQUIDITY_HELPER })), /infrastructure/);
  assert.match(denial(assessDemoWallet({ ...base, chainId: 1, wallet: WALLET_A })), /Sepolia/);
  assert.match(denial(assessDemoWallet({ ...base, wallet: WALLET_A, facts: facts({ ledgerCode: false }) })), /ledger/);
  assert.match(denial(assessDemoWallet({ ...base, wallet: WALLET_A, facts: facts({ backendSigner: OWNER }) })), /signer/);
  assert.match(denial(assessDemoWallet({ ...base, wallet: WALLET_A, facts: facts({ policyCap: BigInt(1) }) })), /incomplete/);
});

test('both presentation wallets share one server-derived allocation', async () => {
  const first = demoAllocationId(GROUP, LEDGER);
  const second = demoAllocationId(GROUP, LEDGER);
  assert.equal(first, second);
  assert.notEqual(first, ZERO);
  const now = 1_700_000_000;
  const a = issueChallenge({ signingKey: KEY, wallet: WALLET_A, ledger: LEDGER, groupId: GROUP, now });
  const b = issueChallenge({ signingKey: KEY, wallet: WALLET_B, ledger: LEDGER, groupId: GROUP, now });
  assert.notEqual(a.challenge.registrationNonce, b.challenge.registrationNonce);
  assert.equal(openChallenge(a.token, KEY, now)?.wallet, WALLET_A);
  assert.equal(openChallenge(a.token, KEY, now)?.registrationNonce, a.challenge.registrationNonce);
  assert.equal(openChallenge(a.token, KEY, now + 301), null);
  assert.equal(openChallenge(`${a.token}x`, KEY, now), null);
  const owned = await privateKeyToAccount(generatePrivateKey());
  const challenge = issueChallenge({ signingKey: KEY, wallet: owned.address, ledger: LEDGER, groupId: GROUP, now });
  const signed = await owned.signTypedData(demoTypedData(challenge.challenge));
  assert.equal(await recoverTypedDataAddress({ ...demoTypedData(challenge.challenge), signature: signed }), owned.address);
  const wrong = await privateKeyToAccount(generatePrivateKey()).signTypedData(demoTypedData(challenge.challenge));
  assert.notEqual(await recoverTypedDataAddress({ ...demoTypedData(challenge.challenge), signature: wrong }), owned.address);
});

test('a conflicting allocation is rejected and the same allocation is idempotent', () => {
  const derived = demoAllocationId(GROUP, LEDGER);
  const base = { chainId: SEPOLIA_CHAIN_ID, config: config(), wallet: WALLET_A };
  const same = assessDemoWallet({ ...base, facts: facts({ currentAllocation: derived }) });
  assert.equal(same.ok && same.alreadyLinked, true);
  const other = assessDemoWallet({ ...base, facts: facts({ currentAllocation: `0x${'12'.repeat(32)}` as Hex }) });
  assert.equal(other.ok, false);
});

test('hosted requests require https and the demo route does not use World ID storage', () => {
  const local = demoRequestAllowed(new Request('http://127.0.0.1/api/invest/demo'), {});
  assert.equal(local, null);
  const hosted = demoRequestAllowed(new Request('http://example.vercel.app/api/invest/demo', {
    headers: { 'x-forwarded-proto': 'http', host: 'example.vercel.app' },
  }), { VERCEL: '1' });
  assert.match(hosted ?? '', /HTTPS/);
  const source = readFileSync(new URL('../../app/api/invest/demo/route.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('enrollmentStore'), false);
  assert.equal(source.includes('node:sqlite'), false);
  assert.equal(source.includes('127.0.0.1'), false);
  assert.equal(source.includes('Proof of human'), false);
});
