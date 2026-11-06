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
import { EnrollmentStore, type LinkFailure } from './enrollmentStore.ts';
import { CONTINUATION_GRANT_HASH_DOMAIN, domainHash } from './sessionCrypto.ts';

const MAX_BODY_BYTES = 256 * 1024;
const FORBIDDEN_FIELDS = ['allocationId', 'allocation_id', 'groupId', 'group_id'] as const;

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function linkError(reason: LinkFailure): Response {
  switch (reason) {
    case 'unknown_grant':
      return json({ error: 'The continuation grant is not valid' }, 404);
    case 'grant_expired':
      return json({ error: 'The continuation grant is expired' }, 422);
    case 'grant_consumed':
      return json({ error: 'The continuation grant has already been used' }, 409);
    case 'challenge_expired':
      return json({ error: 'The wallet challenge is expired' }, 422);
    case 'allocation_conflict':
      return json({ error: 'This wallet is already linked to another allocation' }, 409);
    case 'nonce_used':
      return json({ error: 'This registration nonce is already used' }, 409);
    default:
      return json({ error: 'The wallet challenge is not valid' }, 422);
  }
}

async function readObject(request: Request): Promise<Record<string, unknown> | Response> {
  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json({ error: 'Request body is too large' }, 400);
  try {
    const payload = JSON.parse(raw) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({ error: 'Invalid request body' }, 400);
    }
    return payload as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
}

function configError(error: unknown): Response {
  const message = error instanceof WorldConfigError ? error.message : 'Allocation authorization is unavailable';
  return json({ error: message }, 500);
}

function walletAddress(value: unknown): Address | undefined {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) return undefined;
  const address = getAddress(value);
  if (address === '0x0000000000000000000000000000000000000000') return undefined;
  return address;
}

export async function handleWalletChallenge(
  request: Request,
  options: { env?: WorldEnv; store?: EnrollmentStore; now?: () => number } = {},
): Promise<Response> {
  const payload = await readObject(request);
  if (payload instanceof Response) return payload;
  if (FORBIDDEN_FIELDS.some((field) => field in payload)) {
    return json({ error: 'Unsupported request field' }, 400);
  }
  const token = payload.continuation_token;
  const wallet = walletAddress(payload.wallet);
  if (typeof token !== 'string' || !/^[0-9a-fA-F]{64}$/.test(token) || !wallet) {
    return json({ error: 'Invalid request body' }, 400);
  }

  let world: ReturnType<typeof readEnrollmentConfig>;
  let allocation: ReturnType<typeof readAllocationConfig>;
  try {
    const env = options.env ?? process.env;
    world = readEnrollmentConfig(env);
    allocation = readAllocationConfig(env);
  } catch (error) {
    return configError(error);
  }
  if (!options.store) return json({ error: 'Enrollment storage is unavailable' }, 500);

  const nowSeconds = Math.floor((options.now ?? Date.now)() / 1000);
  const nonce = `0x${randomBytes(32).toString('hex')}` as Hex;
  const issuedAt = nowSeconds;
  const expiresAt = nowSeconds + CHALLENGE_TTL_SECONDS;
  const opened = options.store.openChallenge({
    tokenHash: domainHash(CONTINUATION_GRANT_HASH_DOMAIN, token),
    challengeHash: domainHash('rwacomply.wallet-challenge.v1', nonce),
    wallet: wallet.toLowerCase(),
    chainId: allocation.chainId,
    ledgerAddress: allocation.ledgerAddress,
    nonce,
    issuedAt,
    expiresAt,
    createdAt: new Date(nowSeconds * 1000).toISOString(),
    now: nowSeconds,
  });
  if (!opened.ok) return linkError(opened.reason);

  const typed = walletLinkTypedData({
    chainId: allocation.chainId,
    ledgerAddress: getAddress(allocation.ledgerAddress),
    appId: world.appId,
    wallet,
    nonce,
    issuedAt: BigInt(issuedAt),
    expiry: BigInt(expiresAt),
  });
  return json({
    challenge: {
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: {
        ...typed.message,
        issuedAt,
        expiry: expiresAt,
      },
    },
    expires_at: expiresAt,
  }, 200);
}

export async function handleWalletAuthorization(
  request: Request,
  options: {
    env?: WorldEnv;
    store?: EnrollmentStore;
    now?: () => number;
    nonceUsed?: (nonce: bigint) => Promise<boolean>;
  } = {},
): Promise<Response> {
  const payload = await readObject(request);
  if (payload instanceof Response) return payload;
  if (FORBIDDEN_FIELDS.some((field) => field in payload)) {
    return json({ error: 'Unsupported request field' }, 400);
  }
  const token = payload.continuation_token;
  const wallet = walletAddress(payload.wallet);
  const signature = payload.signature;
  if (
    typeof token !== 'string' ||
    !/^[0-9a-fA-F]{64}$/.test(token) ||
    !wallet ||
    typeof signature !== 'string' ||
    !/^0x[0-9a-fA-F]+$/.test(signature)
  ) {
    return json({ error: 'Invalid request body' }, 400);
  }

  let world: ReturnType<typeof readEnrollmentConfig>;
  let allocation: ReturnType<typeof readAllocationConfig>;
  try {
    const env = options.env ?? process.env;
    world = readEnrollmentConfig(env);
    allocation = readAllocationConfig(env);
  } catch (error) {
    return configError(error);
  }
  const store = options.store;
  if (!store) return json({ error: 'Enrollment storage is unavailable' }, 500);

  const nowSeconds = Math.floor((options.now ?? Date.now)() / 1000);
  const open = store.readOpenChallenge(
    domainHash(CONTINUATION_GRANT_HASH_DOMAIN, token),
    wallet.toLowerCase(),
    nowSeconds,
  );
  if (!open.ok) return linkError(open.reason);
  if (open.challenge.appId !== world.appId) return linkError('unknown_grant');
  if (
    open.challenge.chainId !== allocation.chainId ||
    open.challenge.ledgerAddress !== allocation.ledgerAddress
  ) {
    return json({ error: 'The wallet signature is invalid' }, 422);
  }

  const typed = walletLinkTypedData({
    chainId: open.challenge.chainId,
    ledgerAddress: getAddress(open.challenge.ledgerAddress),
    appId: open.challenge.appId,
    wallet,
    nonce: open.challenge.nonce,
    issuedAt: BigInt(open.challenge.issuedAt),
    expiry: BigInt(open.challenge.expiresAt),
  });
  let recovered: Address;
  try {
    recovered = await recoverTypedDataAddress({
      ...typed,
      signature: signature as Hex,
    });
  } catch {
    return json({ error: 'The wallet signature is invalid' }, 422);
  }
  if (recovered.toLowerCase() !== wallet.toLowerCase()) {
    return json({ error: 'The wallet signature is invalid' }, 422);
  }

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
    if (used) return linkError('nonce_used');
  } catch {
    return json({ error: 'Allocation ledger is unavailable' }, 503);
  }

  const expiry = BigInt(nowSeconds + AUTHORIZATION_TTL_SECONDS);
  let registrationSignature: Hex;
  try {
    registrationSignature = await signRegistration(allocation.signingKeyHex, {
      chainId: allocation.chainId,
      ledgerAddress: getAddress(allocation.ledgerAddress),
      wallet,
      allocationId: open.challenge.allocationId,
      groupId: allocation.groupId,
      expiry,
      nonce: registrationNonce,
    });
  } catch {
    return json({ error: 'Allocation authorization is unavailable' }, 500);
  }

  const consumed = store.consumeLink({
    tokenHash: domainHash(CONTINUATION_GRANT_HASH_DOMAIN, token),
    wallet: wallet.toLowerCase(),
    now: nowSeconds,
    createdAt: new Date(nowSeconds * 1000).toISOString(),
    authorization: {
      nonce: registrationNonce.toString(),
      walletAddress: wallet.toLowerCase(),
      allocationId: open.challenge.allocationId,
      groupId: allocation.groupId,
      expiry: Number(expiry),
      chainId: allocation.chainId,
      ledgerAddress: allocation.ledgerAddress,
      signature: registrationSignature,
    },
  });
  if (!consumed.ok) return linkError(consumed.reason);

  return json({
    wallet,
    allocationId: open.challenge.allocationId,
    groupId: allocation.groupId,
    expiry: Number(expiry),
    nonce: registrationNonce.toString(),
    signature: registrationSignature,
    chainId: allocation.chainId,
    verifyingContract: getAddress(allocation.ledgerAddress),
  }, 200);
}
