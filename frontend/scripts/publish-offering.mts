import path from 'node:path';
import { createWalletClient } from '@arkiv-network/sdk';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { arkivAccessKey, arkivPublicClient, rabdiChain } from '../lib/arkiv/client.ts';
import {
  DEPLOYED_RWA,
  DEPLOYED_USDC,
  OfferingSchema,
  offeringFilter,
  offeringQueryText,
  publicOfferingFromRow,
} from '../lib/arkiv/offering.ts';
import { offeringDecision, publishOffering, publisherAddress, publisherKey } from '../lib/arkiv/publish.ts';
import { rpcTransport } from '../lib/product/rpc.ts';
import { loadRepositoryEnv } from '../lib/world/loadRootEnv.ts';

loadRepositoryEnv(path.resolve(process.cwd(), '..'));

function publicError(error: unknown): string {
  const secrets = [process.env.ARKIV_ACCESS_KEY, process.env.ARKIV_PUBLISHER_PRIVATE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value && value.length > 8);
  let message = error instanceof Error ? error.message : 'The offering publish failed';
  for (const secret of secrets) message = message.split(secret).join('[redacted]');
  return message.replace(/https?:\/\/\S+/g, '[url]').replace(/wss?:\/\/\S+/g, '[url]');
}

const EXECUTOR_ABI = [
  { type: 'function', name: 'usdc', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'rwa', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

try {
  const writer = publisherAddress(process.env);
  const chain = createPublicClient({ chain: sepolia, transport: rpcTransport(process.env.ALLOCATION_RPC_URL) });
  const executor = process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS as `0x${string}`;
  const [usdc, rwa] = await Promise.all([
    chain.readContract({ address: executor, abi: EXECUTOR_ABI, functionName: 'usdc' }),
    chain.readContract({ address: executor, abi: EXECUTOR_ABI, functionName: 'rwa' }),
  ]);
  if (usdc !== DEPLOYED_USDC || rwa !== DEPLOYED_RWA) {
    throw new Error('The deployed token pair does not match the offering payload');
  }

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
  const nowUnix = Math.floor(Date.now() / 1000);
  const decision = offeringDecision(
    page.entities.map((row) => publicOfferingFromRow(row as Record<string, unknown>)),
    nowUnix,
  );
  const query = offeringQueryText();
  if (decision.action === 'reuse') {
    process.stdout.write(`entityKey ${decision.offering.key}\nwriter ${decision.offering.owner}\nquery ${query}\n`);
    process.exit(0);
  }
  if (decision.action === 'conflict') {
    throw new Error(`More than one offering matches the query: ${decision.keys.join(', ')}`);
  }
  if (decision.action === 'stale') {
    throw new Error(`The existing offering ${decision.offering.key} is not current. It was left unchanged.`);
  }

  const balance = await arkiv.getBalance({ address: writer });
  if (balance === BigInt(0)) throw new Error('The publisher wallet has no tGLM. Fund it at the Rabdi faucet before publishing.');

  const created = await publishOffering({
    env: process.env,
    nowUnix,
    createEntity: async (write, publisher) => {
      const account = privateKeyToAccount(publisherKey(process.env));
      if (account.address !== publisher) throw new Error('The publisher address does not match the signing key');
      const client = createWalletClient({
        account,
        chain: rabdiChain(arkivAccessKey(process.env)),
        transport: http(),
      });
      const result = await client.createEntity(write.schema, write.values, { expiration: write.expiration });
      return { entityKey: result.entityKey, txHash: result.txHash };
    },
  });
  if (created.writer !== writer) throw new Error('The created offering has an unexpected writer');
  process.stdout.write(`entityKey ${created.entityKey}\nwriter ${created.writer}\nquery ${created.query}\n`);
  process.exit(0);
} catch (error) {
  process.stderr.write(`${publicError(error)}\n`);
  process.exit(1);
}
