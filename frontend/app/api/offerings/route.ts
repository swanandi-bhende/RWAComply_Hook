import path from 'node:path';
import { NextResponse } from 'next/server';
import { createPublicClient as createViemClient, getAddress, isAddress, parseAbi, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { OfferingSchema, demoPoolId, describeOfferingDirectory, offeringFilter, publicOfferingFromRow, type PublicOffering } from '@/lib/arkiv/offering';
import { arkivAccessKey, arkivClientStopped, arkivPublicClient } from '@/lib/arkiv/client';
import { rpcTransport } from '@/lib/product/rpc';
import { assembleProductStatus, type ProductProbe } from '@/lib/product/status';
import { readAllocationConfig } from '@/lib/world/config';
import { loadRepositoryEnv } from '@/lib/world/loadRootEnv';

const LEDGER_ABI = parseAbi([
  'function backendSigner() view returns (address)',
  'function policyByGroupPeriod(bytes32 groupId, uint256 periodId) view returns (uint256 cap, uint256 periodId, address usdc)',
  'function remaining(address wallet, bytes32 groupId, uint256 periodId) view returns (uint256)',
]);
const HOOK_ABI = parseAbi([
  'function allocationGroupId() view returns (bytes32)',
  'function allocationPeriodId() view returns (uint256)',
]);
const EXECUTOR_ABI = parseAbi([
  'function usdc() view returns (address)',
  'function rwa() view returns (address)',
]);

function publicArkivError(message: string): string {
  if (message.includes('ARKIV_ACCESS_KEY') || message.includes('browser')) {
    return 'The Arkiv directory is not configured';
  }
  return message;
}

function probe(rpcUrl: string | undefined): ProductProbe {
  const client = createViemClient({ chain: sepolia, transport: rpcTransport(rpcUrl) });
  return {
    chainId: () => client.getChainId(),
    hasCode: async (address) => {
      const code = await client.getBytecode({ address });
      return !!code && code !== '0x';
    },
    backendSigner: (ledger) => client.readContract({ address: ledger, abi: LEDGER_ABI, functionName: 'backendSigner' }),
    policy: async (ledger, groupId, periodId) => {
      const policy = await client.readContract({
        address: ledger,
        abi: LEDGER_ABI,
        functionName: 'policyByGroupPeriod',
        args: [groupId, periodId],
      });
      return { cap: policy[0], periodId: policy[1], usdc: getAddress(policy[2]) };
    },
    hookAllocation: async (hook) => {
      const [groupId, periodId] = await Promise.all([
        client.readContract({ address: hook, abi: HOOK_ABI, functionName: 'allocationGroupId' }),
        client.readContract({ address: hook, abi: HOOK_ABI, functionName: 'allocationPeriodId' }),
      ]);
      return { groupId, periodId };
    },
    executorTokens: async (executor) => {
      const [usdc, rwa] = await Promise.all([
        client.readContract({ address: executor, abi: EXECUTOR_ABI, functionName: 'usdc' }),
        client.readContract({ address: executor, abi: EXECUTOR_ABI, functionName: 'rwa' }),
      ]);
      return { usdc: getAddress(usdc), rwa: getAddress(rwa) };
    },
  };
}

export async function GET(request: Request) {
  loadRepositoryEnv(path.resolve(process.cwd(), '..'));
  const walletParam = new URL(request.url).searchParams.get('wallet');
  const wallet = walletParam && isAddress(walletParam) ? getAddress(walletParam) : null;
  const client = createViemClient({ chain: sepolia, transport: rpcTransport(process.env.ALLOCATION_RPC_URL) });
  let chain = {
    cap: null as string | null,
    periodId: null as string | null,
    remaining: null as string | null,
    usdc: null as Address | null,
    rwa: null as Address | null,
  };
  try {
    const status = await assembleProductStatus({
      env: process.env,
      readConfig: () => {
        const config = readAllocationConfig();
        return {
          signerAddress: getAddress(config.signerAddress),
          ledgerAddress: getAddress(config.ledgerAddress),
          chainId: config.chainId,
          groupId: config.groupId as Hex,
        };
      },
      probe: probe(process.env.ALLOCATION_RPC_URL),
    });
    chain = {
      cap: status.policy?.cap ?? null,
      periodId: status.policy?.periodId ?? status.periodId,
      remaining: null,
      usdc: status.execution.usdc,
      rwa: status.execution.rwa,
    };
    if (wallet && status.ledger?.address && status.groupId && chain.periodId) {
      try {
        const remaining = await client.readContract({
          address: status.ledger.address,
          abi: LEDGER_ABI,
          functionName: 'remaining',
          args: [wallet, status.groupId, BigInt(chain.periodId)],
        });
        chain.remaining = remaining.toString();
      } catch {
        chain.remaining = null;
      }
    }
  } catch {
    chain = { cap: null, periodId: null, remaining: null, usdc: null, rwa: null };
  }

  let offering: PublicOffering | null = null;
  let arkivError: string | null = null;
  if (arkivClientStopped(process.env)) {
    arkivError = 'The Arkiv client is stopped';
  } else try {
    const accessKey = arkivAccessKey(process.env);
    const arkiv = arkivPublicClient(process.env);
    const page = await arkiv.select({
      $key: true,
      $owner: true,
      projectTag: true,
      offeringId: true,
      rwaSymbol: true,
      usdcAddress: true,
      rwaAddress: true,
      poolId: true,
      expiresAt: true,
    }).from(OfferingSchema).where(offeringFilter()).fetch();
    if (page.entities.length > 1) {
      arkivError = 'More than one Arkiv offering matches this query';
    } else {
      const row = page.entities[0];
      offering = row ? publicOfferingFromRow(row as Record<string, unknown>) : null;
    }
    if (accessKey && JSON.stringify({ offering, arkivError }).includes(accessKey)) {
      arkivError = 'The Arkiv query failed';
      offering = null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Arkiv query failed';
    const secret = process.env.ARKIV_ACCESS_KEY?.trim() ?? '';
    arkivError = secret && message.includes(secret) ? 'The Arkiv query failed' : publicArkivError(message);
  }

  const directory = describeOfferingDirectory({
    nowUnix: Math.floor(Date.now() / 1000),
    chain,
    offering,
    arkivError,
  });
  return NextResponse.json({ ...directory, poolId: demoPoolId() }, {
    headers: { 'cache-control': 'no-store' },
  });
}
