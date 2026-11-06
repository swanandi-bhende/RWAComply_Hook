import { createPublicClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { loadRepositoryEnv } from '../world/loadRootEnv.ts';

export const RABDI_CHAIN_ID = 7794095;

export function arkivAccessKey(env: Record<string, string | undefined>): string {
  const key = env.ARKIV_ACCESS_KEY?.trim() ?? '';
  if (!key) throw new Error('ARKIV_ACCESS_KEY is not configured');
  return key;
}

export function rabdiChain(accessKey: string) {
  const chain = rabdi({ accessKey });
  if (chain.id !== RABDI_CHAIN_ID) throw new Error('Arkiv chain is not Rabdi');
  return chain;
}

export function arkivPublicClient(env: Record<string, string | undefined> = process.env) {
  if (typeof window !== 'undefined') throw new Error('The Arkiv client stays on the server');
  loadRepositoryEnv();
  const accessKey = arkivAccessKey(env);
  return createPublicClient({
    chain: rabdiChain(accessKey),
    transport: http(),
  });
}
