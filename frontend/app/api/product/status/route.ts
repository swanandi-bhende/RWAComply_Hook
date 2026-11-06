import path from 'node:path';
import { createPublicClient, getAddress, parseAbi, type Hex } from 'viem';
import { rpcTransport } from '@/lib/product/rpc';
import { sepolia } from 'viem/chains';
import { NextResponse } from 'next/server';
import { readAllocationConfig } from '@/lib/world/config';
import { loadRepositoryEnv } from '@/lib/world/loadRootEnv';
import { assembleProductStatus, type ProductProbe } from '@/lib/product/status';

const LEDGER_ABI = parseAbi([
  'function backendSigner() view returns (address)',
  'function policyByGroupPeriod(bytes32 groupId, uint256 periodId) view returns (uint256 cap, uint256 periodId, address usdc)',
]);

const HOOK_ABI = parseAbi([
  'function allocationGroupId() view returns (bytes32)',
  'function allocationPeriodId() view returns (uint256)',
]);

const EXECUTOR_ABI = parseAbi([
  'function usdc() view returns (address)',
  'function rwa() view returns (address)',
]);

function probeFor(rpcUrl: string | undefined): ProductProbe {
  const client = createPublicClient({
    chain: sepolia,
    transport: rpcTransport(rpcUrl),
  });
  return {
    chainId: () => client.getChainId(),
    hasCode: async (address) => {
      const code = await client.getBytecode({ address });
      return !!code && code !== '0x';
    },
    backendSigner: (ledger) => client.readContract({
      address: ledger,
      abi: LEDGER_ABI,
      functionName: 'backendSigner',
    }),
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

export async function GET() {
  loadRepositoryEnv(path.resolve(process.cwd(), '..'));
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
    probe: probeFor(process.env.ALLOCATION_RPC_URL),
  });
  return NextResponse.json(status, {
    headers: { 'cache-control': 'no-store' },
  });
}
