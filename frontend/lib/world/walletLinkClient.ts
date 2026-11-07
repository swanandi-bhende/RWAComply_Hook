import { getAddress, type Address, type Hex } from 'viem';
import { WALLET_LINK_PURPOSE } from './allocationAuth.ts';

type ChallengeResponse = {
  challenge?: {
    domain?: { chainId?: unknown; verifyingContract?: unknown };
    primaryType?: unknown;
    message?: { purpose?: unknown; wallet?: unknown; appId?: unknown };
  };
  allocationId?: unknown;
};

export type WalletLinkClientResult =
  | {
      ok: true;
      wallet: Address;
      allocationId: Hex;
      groupId: Hex;
      expiry: number;
      nonce: string;
      signature: Hex;
      chainId: number;
      verifyingContract: Address;
    }
  | { ok: false; reason: 'challenge_rejected' | 'signature_rejected' | 'conflict' | 'unexpected'; message?: string };

export async function authorizationFailure(response: Response): Promise<Extract<WalletLinkClientResult, { ok: false }>> {
  let message: string | undefined;
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) message = body.error.trim();
  } catch {
    message = undefined;
  }
  if (response.status === 409) return { ok: false, reason: 'conflict', message };
  if (message === 'The wallet signature is invalid') return { ok: false, reason: 'signature_rejected', message };
  return { ok: false, reason: 'unexpected', message };
}

export async function authorizeWalletLink(options: {
  continuationToken: string;
  wallet: Address;
  signTypedData: (typedData: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<Hex>;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<WalletLinkClientResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const wallet = getAddress(options.wallet);
  let challengeResponse: Response;
  try {
    challengeResponse = await fetchImpl('/api/world/wallet-challenge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ continuation_token: options.continuationToken, wallet }),
      signal: options.signal,
    });
  } catch {
    return { ok: false, reason: 'unexpected' };
  }
  if (!challengeResponse.ok) return { ok: false, reason: 'challenge_rejected' };
  const challengeBody = (await challengeResponse.json()) as ChallengeResponse;
  const message = challengeBody.challenge?.message;
  if (
    challengeBody.allocationId !== undefined ||
    challengeBody.challenge?.primaryType !== 'WalletLink' ||
    message?.purpose !== WALLET_LINK_PURPOSE ||
    typeof message.wallet !== 'string' ||
    getAddress(message.wallet) !== wallet
  ) {
    return { ok: false, reason: 'challenge_rejected' };
  }

  let signature: Hex;
  try {
    signature = await options.signTypedData({
      domain: challengeBody.challenge?.domain as Record<string, unknown>,
      types: (challengeBody.challenge as { types: Record<string, unknown> }).types,
      primaryType: 'WalletLink',
      message: message as Record<string, unknown>,
    });
  } catch (error) {
    const rejected = error instanceof Error && (error.name === 'UserRejectedRequestError' || /user rejected/i.test(error.message));
    return rejected
      ? { ok: false, reason: 'signature_rejected', message: 'The wallet ownership signature was rejected. This wallet was not registered.' }
      : { ok: false, reason: 'unexpected', message: 'The wallet signature could not be created.' };
  }

  let authorization: Response;
  try {
    authorization = await fetchImpl('/api/world/wallet-authorization', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        continuation_token: options.continuationToken,
        wallet,
        signature,
      }),
      signal: options.signal,
    });
  } catch {
    return { ok: false, reason: 'unexpected' };
  }
  if (!authorization.ok) return authorizationFailure(authorization);
  const body = (await authorization.json()) as {
    wallet?: unknown;
    allocationId?: unknown;
    groupId?: unknown;
    expiry?: unknown;
    nonce?: unknown;
    signature?: unknown;
    chainId?: unknown;
    verifyingContract?: unknown;
  };
  if (
    body.wallet !== wallet ||
    typeof body.allocationId !== 'string' ||
    typeof body.groupId !== 'string' ||
    typeof body.expiry !== 'number' ||
    typeof body.nonce !== 'string' ||
    typeof body.signature !== 'string' ||
    typeof body.chainId !== 'number' ||
    typeof body.verifyingContract !== 'string'
  ) {
    return { ok: false, reason: 'unexpected' };
  }
  return {
    ok: true,
    wallet,
    allocationId: body.allocationId as Hex,
    groupId: body.groupId as Hex,
    expiry: body.expiry,
    nonce: body.nonce,
    signature: body.signature as Hex,
    chainId: body.chainId,
    verifyingContract: getAddress(body.verifyingContract),
  };
}
