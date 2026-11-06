import { randomBytes } from 'node:crypto';
import { getAddress, isAddress, recoverTypedDataAddress, type Address, type Hex } from 'viem';
import {
  AUTHORIZATION_TTL_SECONDS,
  CHALLENGE_TTL_SECONDS,
  registrationNonceUsed,
  signRegistration,
  walletLinkTypedData,
} from './allocationAuth.ts';
import { readAllocationConfig, readEnrollmentConfig, WorldConfigError, type WorldEnv } from './config.ts';
import { demoMode } from './demoMode.ts';
import { DemoStore } from './demoStore.ts';
import { newAllocationId } from './enrollmentProof.ts';
import { DEMO_BROWSER_HASH_DOMAIN, domainHash } from './sessionCrypto.ts';

export const DEMO_COOKIE = 'rwacomply_demo';
const DEMO_TTL_SECONDS = 7 * 24 * 60 * 60;
const FORBIDDEN = ['allocationId', 'allocation_id', 'groupId', 'group_id', 'verified', 'state'] as const;

function json(body: Record<string, unknown>, status: number, cookie?: string): Response {
  const headers = new Headers({ 'cache-control': 'no-store' });
  if (cookie) headers.set('set-cookie', cookie);
  return Response.json(body, { status, headers });
}

function cookieValue(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === DEMO_COOKIE && /^[0-9a-f]{64}$/.test(rest.join('='))) return rest.join('=');
  }
  return null;
}

function demoCookie(token: string): string {
  return `${DEMO_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DEMO_TTL_SECONDS}`;
}

function walletAddress(value: unknown): Address | undefined {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) return undefined;
  const address = getAddress(value);
  if (address === '0x0000000000000000000000000000000000000000') return undefined;
  return address;
}

async function bodyOf(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const payload = JSON.parse(await request.text()) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ error: 'Invalid request body' }, 400);
    return payload as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
}

type Options = { env?: WorldEnv; store?: DemoStore; now?: () => number; nonceUsed?: (nonce: bigint) => Promise<boolean> };

function ready(request: Request, options: Options):
  | { ok: false; response: Response }
  | { ok: true; store: DemoStore; env: WorldEnv } {
  const env = options.env ?? process.env;
  if (demoMode(env, request.headers.get('host')) === 'off') return { ok: false, response: json({ enabled: false }, 404) };
  if (!options.store) return { ok: false, response: json({ error: 'Demo storage is unavailable' }, 500) };
  return { ok: true, store: options.store, env };
}

function activeIdentity(request: Request, store: DemoStore, now: number) {
  const token = cookieValue(request.headers.get('cookie'));
  if (!token) return undefined;
  const found = store.find(domainHash(DEMO_BROWSER_HASH_DOMAIN, token));
  if (!found || found.expiresAt <= now) return undefined;
  return found;
}

export function handleDemoIdentity(request: Request, options: Options = {}): Response {
  const env = options.env ?? process.env;
  if (demoMode(env, request.headers.get('host')) === 'off') return json({ enabled: false }, 200);
  if (!options.store) return json({ error: 'Demo storage is unavailable' }, 500);
  const now = Math.floor((options.now ?? Date.now)() / 1000);
  const identity = activeIdentity(request, options.store, now);
  if (!identity) return json({ enabled: true, state: 'none', linkedWallets: [] }, 200);
  return json({
    enabled: true,
    state: 'active',
    linkedWallets: options.store.confirmedWallets(identity.id),
  }, 200);
}

export function handleDemoStart(request: Request, options: Options = {}): Response {
  const readyState = ready(request, options);
  if (!readyState.ok) return readyState.response;
  const now = Math.floor((options.now ?? Date.now)() / 1000);
  const existing = activeIdentity(request, readyState.store, now);
  if (existing) {
    return json({ enabled: true, state: 'active', kind: 'demo' }, 200);
  }
  const token = randomBytes(32).toString('hex');
  readyState.store.create({
    allocationId: newAllocationId(),
    tokenHash: domainHash(DEMO_BROWSER_HASH_DOMAIN, token),
    expiresAt: now + DEMO_TTL_SECONDS,
    createdAt: new Date(now * 1000).toISOString(),
  });
  return json({ enabled: true, state: 'active', kind: 'demo' }, 200, demoCookie(token));
}

export async function handleDemoChallenge(request: Request, options: Options = {}): Promise<Response> {
  const readyState = ready(request, options);
  if (!readyState.ok) return readyState.response;
  const payload = await bodyOf(request);
  if (payload instanceof Response) return payload;
  if (FORBIDDEN.some((field) => field in payload)) return json({ error: 'Unsupported request field' }, 400);
  const wallet = walletAddress(payload.wallet);
  if (!wallet) return json({ error: 'Invalid request body' }, 400);
  const now = Math.floor((options.now ?? Date.now)() / 1000);
  const identity = activeIdentity(request, readyState.store, now);
  if (!identity) return json({ error: 'Start a demo identity in this browser first.' }, 404);
  let world: ReturnType<typeof readEnrollmentConfig>;
  let allocation: ReturnType<typeof readAllocationConfig>;
  try {
    world = readEnrollmentConfig(readyState.env);
    allocation = readAllocationConfig(readyState.env);
  } catch (error) {
    const message = error instanceof WorldConfigError ? error.message : 'Allocation authorization is unavailable';
    return json({ error: message }, 500);
  }
  const nonce = `0x${randomBytes(32).toString('hex')}` as Hex;
  const expiresAt = now + CHALLENGE_TTL_SECONDS;
  readyState.store.saveChallenge({
    identityId: identity.id,
    challengeHash: domainHash('rwacomply.demo-challenge.v1', nonce),
    wallet: wallet.toLowerCase(),
    nonce,
    chainId: allocation.chainId,
    ledgerAddress: allocation.ledgerAddress,
    issuedAt: now,
    expiresAt,
    createdAt: new Date(now * 1000).toISOString(),
  });
  const typed = walletLinkTypedData({
    chainId: allocation.chainId,
    ledgerAddress: getAddress(allocation.ledgerAddress),
    appId: world.appId,
    wallet,
    nonce,
    issuedAt: BigInt(now),
    expiry: BigInt(expiresAt),
  });
  return json({
    challenge: {
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: { ...typed.message, issuedAt: now, expiry: expiresAt },
    },
    expires_at: expiresAt,
  }, 200);
}

export async function handleDemoAuthorization(request: Request, options: Options = {}): Promise<Response> {
  const readyState = ready(request, options);
  if (!readyState.ok) return readyState.response;
  const payload = await bodyOf(request);
  if (payload instanceof Response) return payload;
  if (FORBIDDEN.some((field) => field in payload)) return json({ error: 'Unsupported request field' }, 400);
  const wallet = walletAddress(payload.wallet);
  const signature = payload.signature;
  if (!wallet || typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    return json({ error: 'Invalid request body' }, 400);
  }
  const now = Math.floor((options.now ?? Date.now)() / 1000);
  const identity = activeIdentity(request, readyState.store, now);
  if (!identity) return json({ error: 'Start a demo identity in this browser first.' }, 404);
  let world: ReturnType<typeof readEnrollmentConfig>;
  let allocation: ReturnType<typeof readAllocationConfig>;
  try {
    world = readEnrollmentConfig(readyState.env);
    allocation = readAllocationConfig(readyState.env);
  } catch (error) {
    const message = error instanceof WorldConfigError ? error.message : 'Allocation authorization is unavailable';
    return json({ error: message }, 500);
  }
  const challenge = readyState.store.openChallenge(wallet.toLowerCase(), now);
  if (!challenge || challenge.identityId !== identity.id) return json({ error: 'The wallet challenge is not valid' }, 422);
  const typed = walletLinkTypedData({
    chainId: challenge.chainId,
    ledgerAddress: getAddress(challenge.ledgerAddress),
    appId: world.appId,
    wallet,
    nonce: challenge.nonce as Hex,
    issuedAt: BigInt(challenge.issuedAt),
    expiry: BigInt(challenge.expiresAt),
  });
  let recovered: Address;
  try {
    recovered = await recoverTypedDataAddress({ ...typed, signature: signature as Hex });
  } catch {
    return json({ error: 'The wallet signature is invalid' }, 422);
  }
  if (recovered.toLowerCase() !== wallet.toLowerCase()) return json({ error: 'The wallet signature is invalid' }, 422);
  const registrationNonce = BigInt(`0x${randomBytes(32).toString('hex')}`);
  try {
    const used = options.nonceUsed
      ? await options.nonceUsed(registrationNonce)
      : allocation.rpcUrl
        ? await registrationNonceUsed({
            rpcUrl: allocation.rpcUrl,
            ledgerAddress: getAddress(allocation.ledgerAddress),
            nonce: registrationNonce,
          })
        : false;
    if (used) return json({ error: 'This registration nonce is already used' }, 409);
  } catch {
    return json({ error: 'Allocation ledger is unavailable' }, 503);
  }
  const expiry = BigInt(now + AUTHORIZATION_TTL_SECONDS);
  let registrationSignature: Hex;
  try {
    registrationSignature = await signRegistration(allocation.signingKeyHex, {
      chainId: allocation.chainId,
      ledgerAddress: getAddress(allocation.ledgerAddress),
      wallet,
      allocationId: identity.allocationId as Hex,
      groupId: allocation.groupId,
      expiry,
      nonce: registrationNonce,
    });
  } catch {
    return json({ error: 'Allocation authorization is unavailable' }, 500);
  }
  const consumed = readyState.store.consumeChallenge({
    wallet: wallet.toLowerCase(),
    identityId: identity.id,
    allocationId: identity.allocationId,
    now,
    createdAt: new Date(now * 1000).toISOString(),
    authorization: {
      nonce: registrationNonce.toString(),
      groupId: allocation.groupId,
      expiry: Number(expiry),
      chainId: allocation.chainId,
      ledgerAddress: allocation.ledgerAddress,
      signature: registrationSignature,
    },
  });
  if (consumed === 'conflict') return json({ error: 'This wallet is already linked to another allocation' }, 409);
  if (consumed !== 'ok') return json({ error: 'The wallet challenge is not valid' }, 422);
  return json({
    wallet,
    allocationId: identity.allocationId,
    groupId: allocation.groupId,
    expiry: Number(expiry),
    nonce: registrationNonce.toString(),
    signature: registrationSignature,
    chainId: allocation.chainId,
    verifyingContract: getAddress(allocation.ledgerAddress),
    kind: 'demo',
  }, 200);
}
