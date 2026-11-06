import { isAddress, isHex, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  DEPLOYED_RWA,
  DEPLOYED_USDC,
  OFFERING_ID,
  PROJECT_TAG,
  RWA_SYMBOL,
  demoPoolId,
  offeringWrite,
  type PublicOffering,
} from './offering.ts';

export type OfferingCreateResult = {
  entityKey: Hex;
  txHash: Hex;
};

export type PublishedOffering = {
  entityKey: Hex;
  writer: Address;
  query: string;
  txHash: Hex;
};

type Env = Record<string, string | undefined>;

export function publisherKey(env: Env): Hex {
  const value = env.ARKIV_PUBLISHER_PRIVATE_KEY?.trim() ?? '';
  if (!value) throw new Error('ARKIV_PUBLISHER_PRIVATE_KEY is not configured');
  const normalized = value.startsWith('0x') || value.startsWith('0X') ? value : `0x${value}`;
  if (!isHex(normalized) || normalized.length !== 66) {
    throw new Error('ARKIV_PUBLISHER_PRIVATE_KEY is not a 32-byte hex key');
  }
  return normalized;
}

export function publisherAddress(env: Env): Address {
  return privateKeyToAccount(publisherKey(env)).address;
}

export type OfferingDecision =
  | { action: 'create' }
  | { action: 'reuse'; offering: PublicOffering }
  | { action: 'stale'; offering: PublicOffering }
  | { action: 'conflict'; keys: Hex[] };

function currentOffering(offering: PublicOffering, nowUnix: number): boolean {
  return offering.projectTag === PROJECT_TAG
    && offering.offeringId === OFFERING_ID
    && offering.rwaSymbol === RWA_SYMBOL
    && offering.usdcAddress === DEPLOYED_USDC
    && offering.rwaAddress === DEPLOYED_RWA
    && offering.poolId.toLowerCase() === demoPoolId().toLowerCase()
    && BigInt(offering.expiresAt) > BigInt(nowUnix);
}

export function offeringDecision(existing: PublicOffering[], nowUnix: number): OfferingDecision {
  if (existing.length > 1) return { action: 'conflict', keys: existing.map((offering) => offering.key) };
  if (existing.length === 0) return { action: 'create' };
  const offering = existing[0];
  return currentOffering(offering, nowUnix) ? { action: 'reuse', offering } : { action: 'stale', offering };
}

export async function publishOffering(input: {
  env: Env;
  nowUnix: number;
  createEntity: (write: ReturnType<typeof offeringWrite>, writer: Address) => Promise<OfferingCreateResult>;
}): Promise<PublishedOffering> {
  const accessKey = input.env.ARKIV_ACCESS_KEY?.trim() ?? '';
  if (!accessKey) throw new Error('ARKIV_ACCESS_KEY is not configured');
  const writer = publisherAddress(input.env);
  if (!isAddress(writer)) throw new Error('The publisher address is invalid');
  const write = offeringWrite(input.nowUnix);
  const forbidden = Object.keys(write.values).filter((name) => name === 'cap' || name === 'spent' || name === 'spentAmount');
  if (forbidden.length > 0) throw new Error('The offering write includes allocation state');
  const created = await input.createEntity(write, writer);
  return {
    entityKey: created.entityKey,
    writer,
    query: write.query,
    txHash: created.txHash,
  };
}
