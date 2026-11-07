import { getAddress, isAddress, recoverTypedDataAddress, type Address, type Hex } from 'viem';
import { createPublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { rpcTransport } from '@/lib/product/rpc';
import {
  assessDemoWallet,
  demoAllocationId,
  demoRequestAllowed,
  demoTypedData,
  issueChallenge,
  openChallenge,
  readDemoConfig,
  type DemoFacts,
} from '@/lib/product/sepoliaDemo';
import { registrationNonceUsed, signRegistration } from '@/lib/world/allocationAuth';
import { readAllocationConfig } from '@/lib/world/config';
import { loadRepositoryEnv } from '@/lib/world/loadRootEnv';
import path from 'node:path';

export const runtime = 'nodejs';

const LEDGER_ABI = [
  { type: 'function', name: 'backendSigner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'authorizedHook', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'allocationIdByWallet', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'policyByGroupPeriod', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'address' }] },
] as const;
const HOOK_ABI = [
  { type: 'function', name: 'allocationGroupId', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'allocationPeriodId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

const ALLOWED = new Set(['action', 'wallet', 'chainId', 'challenge', 'signature']);

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

async function hasCode(client: ReturnType<typeof createPublicClient>, address: Address): Promise<boolean> {
  const code = await client.getBytecode({ address });
  return Boolean(code && code !== '0x');
}

export async function POST(request: Request): Promise<Response> {
  loadRepositoryEnv(path.resolve(process.cwd(), '..'));
  const blocked = demoRequestAllowed(request, process.env);
  if (blocked) return json({ error: blocked }, 403);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (Object.keys(payload).some((key) => !ALLOWED.has(key))) return json({ error: 'Unsupported request field' }, 400);
  if (payload.action !== 'preflight' && payload.action !== 'authorize') return json({ error: 'Unsupported request field' }, 400);
  const config = readDemoConfig(process.env);
  if ('error' in config) return json({ error: config.error }, 503);
  let allocation;
  try {
    allocation = readAllocationConfig();
  } catch {
    return json({ error: 'The demo registration configuration is incomplete.' }, 503);
  }
  if (getAddress(allocation.signerAddress) !== config.signer) {
    return json({ error: 'The demo registration configuration is incomplete.' }, 503);
  }
  if (typeof payload.wallet !== 'string' || !isAddress(payload.wallet, { strict: false })) {
    return json({ error: 'This wallet is not approved for the presentation demo.' }, 400);
  }
  const wallet = getAddress(payload.wallet);
  const chainId = payload.chainId === 11155111 ? 11155111 : 0;
  const client = createPublicClient({ chain: sepolia, transport: rpcTransport(process.env.ALLOCATION_RPC_URL) });
  let facts: DemoFacts | null = null;
  try {
    const rpcChainId = await client.getChainId();
    const [ledgerCode, hookCode, executorCode, usdcCode, rwaCode, signer, owner, hook, groupId, periodId, policy, current] = await Promise.all([
      hasCode(client, config.ledger),
      hasCode(client, config.hook),
      hasCode(client, config.executor),
      hasCode(client, config.usdc),
      hasCode(client, config.rwa),
      client.readContract({ address: config.ledger, abi: LEDGER_ABI, functionName: 'backendSigner' }),
      client.readContract({ address: config.ledger, abi: LEDGER_ABI, functionName: 'owner' }),
      client.readContract({ address: config.ledger, abi: LEDGER_ABI, functionName: 'authorizedHook' }),
      client.readContract({ address: config.hook, abi: HOOK_ABI, functionName: 'allocationGroupId' }),
      client.readContract({ address: config.hook, abi: HOOK_ABI, functionName: 'allocationPeriodId' }),
      client.readContract({ address: config.ledger, abi: LEDGER_ABI, functionName: 'policyByGroupPeriod', args: [config.groupId, BigInt(1)] }),
      client.readContract({ address: config.ledger, abi: LEDGER_ABI, functionName: 'allocationIdByWallet', args: [wallet] }),
    ]);
    facts = {
      chainId: rpcChainId,
      ledgerCode,
      hookCode,
      executorCode,
      usdcCode,
      rwaCode,
      backendSigner: getAddress(signer),
      owner: getAddress(owner),
      authorizedHook: getAddress(hook),
      hookGroupId: groupId,
      hookPeriodId: periodId,
      policyCap: policy[0],
      policyPeriodId: policy[1],
      policyUsdc: getAddress(policy[2]),
      currentAllocation: current,
    };
  } catch {
    facts = null;
  }
  const decision = assessDemoWallet({ wallet, chainId, config, facts });
  if (!decision.ok) return json({ error: decision.error }, decision.error.includes('Sepolia') ? 400 : 403);
  if (payload.action === 'preflight') {
    if (decision.alreadyLinked) return json({ status: 'already_linked' }, 200);
    const issued = issueChallenge({
      signingKey: allocation.signingKeyHex,
      wallet,
      ledger: config.ledger,
      groupId: config.groupId,
      now: Math.floor(Date.now() / 1000),
    });
    const typed = demoTypedData(issued.challenge);
    return json({
      status: 'ready',
      challenge: issued.token,
      typedData: {
        domain: typed.domain,
        types: typed.types,
        primaryType: typed.primaryType,
        message: {
          ...typed.message,
          issuedAt: typed.message.issuedAt.toString(),
          expiry: typed.message.expiry.toString(),
        },
      },
    }, 200);
  }
  if (typeof payload.challenge !== 'string' || typeof payload.signature !== 'string') {
    return json({ error: 'The wallet signature is invalid' }, 422);
  }
  const challenge = openChallenge(payload.challenge, allocation.signingKeyHex, Math.floor(Date.now() / 1000));
  if (!challenge || challenge.wallet !== wallet) return json({ error: 'Your registration request expired. Please try again.' }, 422);
  const typed = demoTypedData(challenge);
  let recovered: Address;
  try {
    recovered = await recoverTypedDataAddress({ ...typed, signature: payload.signature as Hex });
  } catch {
    return json({ error: 'The wallet signature is invalid' }, 422);
  }
  if (recovered !== wallet) return json({ error: 'The wallet signature is invalid' }, 422);
  const allocationId = demoAllocationId(config.groupId, config.ledger);
  if (decision.alreadyLinked) {
    return json({ status: 'already_linked' }, 200);
  }
  try {
    if (await registrationNonceUsed({ rpcUrl: process.env.ALLOCATION_RPC_URL ?? '', ledgerAddress: config.ledger, nonce: BigInt(challenge.registrationNonce) })) {
      return json({ error: 'This wallet link was already used. Start the presentation check again.' }, 409);
    }
  } catch {
    return json({ error: 'The allocation ledger could not be reached.' }, 503);
  }
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 600);
  let signature: Hex;
  try {
    signature = await signRegistration(allocation.signingKeyHex, {
      chainId: 11155111,
      ledgerAddress: config.ledger,
      wallet,
      allocationId,
      groupId: config.groupId,
      expiry,
      nonce: BigInt(challenge.registrationNonce),
    });
  } catch {
    return json({ error: 'Allocation authorization is unavailable' }, 500);
  }
  return json({
    wallet,
    allocationId,
    groupId: config.groupId,
    expiry: Number(expiry),
    nonce: challenge.registrationNonce,
    signature,
    chainId: 11155111,
    verifyingContract: config.ledger,
  }, 200);
}
