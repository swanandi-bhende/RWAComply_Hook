import { createPublicClient, getAddress, type Address, type Hex } from 'viem';
import { rpcTransport } from '../product/rpc.ts';
import { readAllocationConfig, WorldConfigError, type WorldEnv } from './config.ts';
import { EnrollmentStore } from './enrollmentStore.ts';
import {
  chainRegistrationVerdict,
  LEDGER_REGISTRATION_ABI,
  parseRegistrationAuthorization,
  type LedgerReceipt,
} from './ledgerRegistration.ts';

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export type RegistrationObservation = {
  receipt: LedgerReceipt | null;
  seen: boolean;
  allocationId: Hex;
  nonceUsed: boolean;
};

export async function handleRegistrationReceipt(
  request: Request,
  options: {
    env?: WorldEnv;
    store?: EnrollmentStore;
    observe?: (input: {
      txHash: Hex;
      ledger: Address;
      wallet: Address;
      nonce: bigint;
    }) => Promise<RegistrationObservation>;
  } = {},
): Promise<Response> {
  let payload: unknown;
  try {
    payload = JSON.parse(await request.text()) as unknown;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid request body' }, 400);
  }
  const body = payload as Record<string, unknown>;
  if (typeof body.nonce !== 'string' || typeof body.txHash !== 'string' || !TX_HASH.test(body.txHash)) {
    return json({ error: 'Invalid request body' }, 400);
  }
  const store = options.store;
  if (!store) return json({ error: 'Enrollment storage is unavailable' }, 500);
  const record = store.registrationByNonce(body.nonce);
  if (!record) return json({ error: 'This wallet link was not issued' }, 404);
  if (record.chainStatus === 'confirmed' && record.txHash === body.txHash) {
    return json({ status: 'confirmed', message: 'Wallet linked to your shared allocation' }, 200);
  }

  let allocation: ReturnType<typeof readAllocationConfig>;
  try {
    allocation = readAllocationConfig(options.env ?? process.env);
  } catch (error) {
    const message = error instanceof WorldConfigError ? error.message : 'Allocation authorization is unavailable';
    return json({ error: message }, 500);
  }
  if (getAddress(record.ledgerAddress) !== getAddress(allocation.ledgerAddress)) {
    return json({ error: 'Wallet registration could not be verified' }, 422);
  }
  const observe = options.observe ?? (allocation.rpcUrl ? rpcRegistrationReader(allocation.rpcUrl) : undefined);
  if (!observe) return json({ error: 'Allocation ledger is unavailable' }, 503);

  let observation: RegistrationObservation;
  try {
    observation = await observe({
      txHash: body.txHash as Hex,
      ledger: getAddress(record.ledgerAddress),
      wallet: getAddress(record.walletAddress),
      nonce: BigInt(record.nonce),
    });
  } catch {
    return json({ error: 'Allocation ledger is unavailable' }, 503);
  }

  if (!observation.receipt) {
    if (!observation.seen) return json({ error: 'The registration transaction was not found' }, 404);
    const submitted = store.advanceRegistration(body.nonce, 'submitted', body.txHash);
    if (!submitted.ok) return json({ error: 'Wallet registration could not be verified' }, 409);
    return json({ status: 'submitted', message: 'Registration pending' }, 202);
  }

  const authorization = parseRegistrationAuthorization({
    wallet: record.walletAddress,
    allocationId: record.allocationId,
    groupId: record.groupId,
    expiry: record.expiry,
    nonce: record.nonce,
    signature: record.signature,
    chainId: record.chainId,
    verifyingContract: record.ledgerAddress,
  });
  if (!authorization) return json({ error: 'This wallet link is incomplete' }, 422);
  const verdict = chainRegistrationVerdict({
    authorization,
    receipt: observation.receipt,
    allocationId: observation.allocationId,
    nonceUsed: observation.nonceUsed,
  });
  if (verdict === 'confirmed') {
    const updated = store.advanceRegistration(body.nonce, 'confirmed', body.txHash);
    if (!updated.ok) return json({ error: 'Wallet registration could not be verified' }, 409);
    return json({ status: 'confirmed', message: 'Wallet linked to your shared allocation' }, 200);
  }
  const failed = store.advanceRegistration(
    body.nonce,
    verdict === 'reverted' ? 'failed' : 'verification_failed',
    body.txHash,
  );
  if (!failed.ok) return json({ error: 'Wallet registration could not be verified' }, 409);
  return json({
    status: verdict === 'reverted' ? 'failed' : 'verification_failed',
    message: verdict === 'reverted' ? 'Wallet registration failed' : 'Wallet registration could not be verified',
  }, 422);
}

export function rpcRegistrationReader(rpcUrl: string) {
  const client = createPublicClient({ transport: rpcTransport(rpcUrl) });
  return async (input: {
    txHash: Hex;
    ledger: Address;
    wallet: Address;
    nonce: bigint;
  }): Promise<RegistrationObservation> => {
    let receipt: LedgerReceipt | null = null;
    try {
      const found = await client.getTransactionReceipt({ hash: input.txHash });
      receipt = {
        status: found.status === 'success' ? 'success' : 'reverted',
        to: found.to,
        logs: found.logs.map((log) => ({
          address: log.address,
          topics: [...log.topics],
          data: log.data,
        })),
      };
    } catch {
      receipt = null;
    }
    let seen = receipt !== null;
    if (!seen) {
      try {
        await client.getTransaction({ hash: input.txHash });
        seen = true;
      } catch {
        seen = false;
      }
    }
    const allocationId = await client.readContract({
      address: input.ledger,
      abi: LEDGER_REGISTRATION_ABI,
      functionName: 'allocationIdByWallet',
      args: [input.wallet],
    });
    const nonceUsed = await client.readContract({
      address: input.ledger,
      abi: LEDGER_REGISTRATION_ABI,
      functionName: 'usedNonce',
      args: [input.nonce],
    });
    return { receipt, seen, allocationId, nonceUsed };
  };
}
