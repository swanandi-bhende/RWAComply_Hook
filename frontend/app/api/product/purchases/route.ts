import path from 'node:path';
import { createPublicClient, getAddress, isAddress, parseAbi, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { NextResponse } from 'next/server';
import { rpcTransport } from '@/lib/product/rpc';
import { publicPurchasesFromLogs } from '@/lib/product/purchaseHistory';
import { readAllocationConfig } from '@/lib/world/config';
import { loadRepositoryEnv } from '@/lib/world/loadRootEnv';

const SPEND_EVENT = parseAbi([
  'event SpendRecorded(address indexed wallet, bytes32 indexed allocationId, bytes32 indexed groupId, uint256 periodId, uint256 amount, uint256 newSpent)',
]);

const DEPLOYMENT_SEARCH_BLOCK = BigInt(12075637);

export async function GET(request: Request) {
  const walletText = new URL(request.url).searchParams.get('wallet') ?? '';
  if (!isAddress(walletText)) {
    return NextResponse.json({ purchases: [] }, { headers: { 'cache-control': 'no-store' } });
  }
  try {
    loadRepositoryEnv(path.resolve(process.cwd(), '..'));
    const config = readAllocationConfig();
    const client = createPublicClient({
      chain: sepolia,
      transport: rpcTransport(process.env.ALLOCATION_RPC_URL),
    });
    const logs = await client.getLogs({
      address: getAddress(config.ledgerAddress),
      event: SPEND_EVENT[0],
      args: { wallet: getAddress(walletText) as Address },
      fromBlock: DEPLOYMENT_SEARCH_BLOCK,
      toBlock: 'latest',
    });
    return NextResponse.json(
      { purchases: publicPurchasesFromLogs(logs) },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { purchases: [], error: 'Purchase history could not be read from Ethereum.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
