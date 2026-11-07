import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  encodeAbiParameters,
  getAddress,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem';

export const SEPOLIA_CHAIN_ID = 11155111;
export const DEMO_CAMPAIGN = 'rwa-sepolia-presentation';
export const DEMO_PURPOSE = 'Authorize this presentation wallet for one RWAComply demo allocation. This is not World ID.';
export const EXPECTED_CAP = BigInt(1000000000);
export const EXPECTED_PERIOD = BigInt(1);
export const LIQUIDITY_HELPER = getAddress('0x58F03D8e2B11014d24773eB32E467c9297634008');
export const CHALLENGE_TTL_SECONDS = 300;

const NOT_APPROVED = 'This wallet is not approved for the presentation demo.';
const WRONG_CHAIN = 'Switch to Ethereum Sepolia.';
const LEDGER_DOWN = 'The allocation ledger could not be reached.';
const SIGNER_MISMATCH = 'The backend signer does not match the deployed ledger.';
const OTHER_ALLOCATION = 'This wallet is already linked to another allocation.';
const INCOMPLETE = 'The demo registration configuration is incomplete.';
const INFRASTRUCTURE = 'This wallet is an infrastructure account and cannot use the presentation demo.';

export type DemoFacts = {
  chainId: number;
  ledgerCode: boolean;
  hookCode: boolean;
  executorCode: boolean;
  usdcCode: boolean;
  rwaCode: boolean;
  backendSigner: Address;
  owner: Address;
  authorizedHook: Address;
  hookGroupId: Hex;
  hookPeriodId: bigint;
  policyCap: bigint;
  policyPeriodId: bigint;
  policyUsdc: Address;
  currentAllocation: Hex;
};

export type DemoConfig = {
  signer: Address;
  ledger: Address;
  groupId: Hex;
  hook: Address;
  executor: Address;
  usdc: Address;
  rwa: Address;
  allowlist: Address[];
};

export function demoAllocationId(groupId: Hex, ledger: Address): Hex {
  return keccak256(encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'uint256' },
      { type: 'address' },
      { type: 'bytes32' },
      { type: 'string' },
    ],
    ['RWAComply.sepolia-demo-allocation.v1', BigInt(SEPOLIA_CHAIN_ID), getAddress(ledger), groupId, DEMO_CAMPAIGN],
  ));
}

export function readDemoConfig(env: Record<string, string | undefined>): DemoConfig | { error: string } {
  if (env.RWA_SEPOLIA_DEMO_BYPASS_ENABLED !== 'true') return { error: INCOMPLETE };
  const allowlist = parseAllowlist(env.RWA_SEPOLIA_DEMO_ALLOWED_WALLETS);
  if (!allowlist) return { error: INCOMPLETE };
  const signer = addressOf(env.ALLOCATION_AUTH_SIGNER_ADDRESS);
  const ledger = addressOf(env.ALLOCATION_LEDGER_ADDRESS);
  const hook = addressOf(env.NEXT_PUBLIC_HOOK_ADDRESS);
  const executor = addressOf(env.NEXT_PUBLIC_EXECUTOR_ADDRESS);
  const usdc = addressOf(env.NEXT_PUBLIC_TOKEN_A_ADDRESS);
  const rwa = addressOf(env.NEXT_PUBLIC_TOKEN_B_ADDRESS);
  const groupId = env.ALLOCATION_GROUP_ID?.trim() ?? '';
  if (!signer || !ledger || !hook || !executor || !usdc || !rwa || !/^0x[0-9a-fA-F]{64}$/.test(groupId)) {
    return { error: INCOMPLETE };
  }
  if (env.ALLOCATION_CHAIN_ID?.trim() !== String(SEPOLIA_CHAIN_ID)) return { error: INCOMPLETE };
  return {
    signer,
    ledger,
    groupId: groupId.toLowerCase() as Hex,
    hook,
    executor,
    usdc,
    rwa,
    allowlist,
  };
}

export function assessDemoWallet(input: {
  wallet: string;
  chainId: number;
  config: DemoConfig;
  facts: DemoFacts | null;
}): { ok: true; alreadyLinked: boolean } | { ok: false; error: string } {
  if (!isAddress(input.wallet, { strict: false })) return { ok: false, error: NOT_APPROVED };
  const wallet = getAddress(input.wallet);
  if (input.chainId !== SEPOLIA_CHAIN_ID) return { ok: false, error: WRONG_CHAIN };
  if (wallet === input.config.signer || wallet === LIQUIDITY_HELPER || (input.facts && wallet === input.facts.owner)) {
    return { ok: false, error: INFRASTRUCTURE };
  }
  if (!input.config.allowlist.some((item) => item === wallet)) return { ok: false, error: NOT_APPROVED };
  if (!input.facts) return { ok: false, error: LEDGER_DOWN };
  if (input.facts.chainId !== SEPOLIA_CHAIN_ID) return { ok: false, error: WRONG_CHAIN };
  if (!input.facts.ledgerCode || !input.facts.hookCode || !input.facts.executorCode || !input.facts.usdcCode || !input.facts.rwaCode) {
    return { ok: false, error: LEDGER_DOWN };
  }
  if (input.facts.backendSigner !== input.config.signer) return { ok: false, error: SIGNER_MISMATCH };
  if (wallet === input.facts.backendSigner) return { ok: false, error: INFRASTRUCTURE };
  if (input.facts.authorizedHook !== input.config.hook || input.facts.hookGroupId.toLowerCase() !== input.config.groupId) {
    return { ok: false, error: INCOMPLETE };
  }
  if (
    input.facts.hookPeriodId !== EXPECTED_PERIOD ||
    input.facts.policyCap !== EXPECTED_CAP ||
    input.facts.policyPeriodId !== EXPECTED_PERIOD ||
    input.facts.policyUsdc !== input.config.usdc
  ) {
    return { ok: false, error: INCOMPLETE };
  }
  const derived = demoAllocationId(input.config.groupId, input.config.ledger);
  const current = input.facts.currentAllocation.toLowerCase();
  if (current === `0x${'0'.repeat(64)}`) return { ok: true, alreadyLinked: false };
  if (current === derived.toLowerCase()) return { ok: true, alreadyLinked: true };
  return { ok: false, error: OTHER_ALLOCATION };
}

export type DemoChallenge = {
  wallet: Address;
  chainId: number;
  ledger: Address;
  groupId: Hex;
  linkNonce: Hex;
  registrationNonce: string;
  issuedAt: number;
  expiry: number;
};

export function demoTypedData(challenge: DemoChallenge) {
  return {
    domain: {
      name: 'RWAComplyWalletLink',
      version: '1',
      chainId: challenge.chainId,
      verifyingContract: challenge.ledger,
    },
    types: {
      WalletLink: [
        { name: 'purpose', type: 'string' },
        { name: 'appId', type: 'string' },
        { name: 'wallet', type: 'address' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    },
    primaryType: 'WalletLink' as const,
    message: {
      purpose: DEMO_PURPOSE,
      appId: DEMO_CAMPAIGN,
      wallet: challenge.wallet,
      nonce: challenge.linkNonce,
      issuedAt: BigInt(challenge.issuedAt),
      expiry: BigInt(challenge.expiry),
    },
  };
}

export function issueChallenge(input: {
  signingKey: Hex;
  wallet: Address;
  ledger: Address;
  groupId: Hex;
  now: number;
}): { token: string; challenge: DemoChallenge } {
  const linkNonce = `0x${randomBytes(32).toString('hex')}` as Hex;
  const registrationNonce = BigInt(keccak256(encodeAbiParameters(
    [{ type: 'string' }, { type: 'address' }, { type: 'bytes32' }],
    [DEMO_CAMPAIGN, input.wallet, linkNonce],
  ))).toString();
  const challenge: DemoChallenge = {
    wallet: input.wallet,
    chainId: SEPOLIA_CHAIN_ID,
    ledger: input.ledger,
    groupId: input.groupId,
    linkNonce,
    registrationNonce,
    issuedAt: input.now,
    expiry: input.now + CHALLENGE_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(challenge)).toString('base64url');
  return { token: `${body}.${mac(input.signingKey, body)}`, challenge };
}

export function openChallenge(token: string, signingKey: Hex, now: number): DemoChallenge | null {
  const split = token.split('.');
  if (split.length !== 2) return null;
  const [body, signature] = split;
  const expected = mac(signingKey, body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DemoChallenge;
    if (parsed.expiry < now || parsed.chainId !== SEPOLIA_CHAIN_ID) return null;
    if (!isAddress(parsed.wallet) || !isAddress(parsed.ledger)) return null;
    if (parsed.wallet !== getAddress(parsed.wallet)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function demoRequestAllowed(request: Request, env: Record<string, string | undefined>): string | null {
  if (env.VERCEL !== '1') return null;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (proto !== 'https') return 'The presentation demo requires HTTPS.';
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  if (!host || !origin) return 'The presentation demo request origin is missing.';
  try {
    if (new URL(origin).host !== host) return 'The presentation demo request origin is not allowed.';
  } catch {
    return 'The presentation demo request origin is invalid.';
  }
  return null;
}

function parseAllowlist(value: string | undefined): Address[] | null {
  const raw = value?.trim() ?? '';
  if (!raw || raw.includes('*')) return null;
  const items = raw.split(',').map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return null;
  const wallets: Address[] = [];
  for (const item of items) {
    if (!isAddress(item, { strict: false })) return null;
    const wallet = getAddress(item);
    if (!wallets.includes(wallet)) wallets.push(wallet);
  }
  return wallets;
}

function addressOf(value: string | undefined): Address | null {
  const raw = value?.trim() ?? '';
  if (!isAddress(raw, { strict: false })) return null;
  return getAddress(raw);
}

function mac(key: Hex, body: string): string {
  return createHmac('sha256', key).update(`rwa-sepolia-demo-challenge.v1:${body}`).digest('base64url');
}
