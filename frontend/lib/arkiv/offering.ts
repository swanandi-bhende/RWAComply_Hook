import { encodeAbiParameters, getAddress, keccak256, type Address, type Hex } from 'viem';
import { ExpirationTime } from '@arkiv-network/sdk';
import { and, eq, render } from '@arkiv-network/sdk/query';
import { addr, defineSchema, key, str, u64 } from '@arkiv-network/sdk/schema';

export const PROJECT_TAG = 'rwacomply';
export const OFFERING_ID = 'sepolia-demo-rwa';
export const RWA_SYMBOL = 'RWA';
export const OFFERING_LIFETIME_DAYS = 90;
export const OFFERING_LIFETIME_SECONDS = OFFERING_LIFETIME_DAYS * 24 * 60 * 60;

export const DEPLOYED_USDC = getAddress('0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe');
export const DEPLOYED_RWA = getAddress('0x73A9Aa42882931518bFDF23886f76F2580D5Ec27');
export const DEPLOYED_HOOK = getAddress('0xD092CbB8De7cCa60807Ca73213f12920Afd308c0');
export const POOL_FEE = 0x800000;
export const TICK_SPACING = 60;

export const OfferingSchema = defineSchema('rwacomply-offering', {
  projectTag: str().indexed(),
  offeringId: str().indexed(),
  rwaSymbol: str().indexed(),
  usdcAddress: addr().indexed(),
  rwaAddress: addr().indexed(),
  poolId: key().indexed(),
  expiresAt: u64().indexed(),
});

export const OFFERING_FIELDS = [
  'projectTag',
  'offeringId',
  'rwaSymbol',
  'usdcAddress',
  'rwaAddress',
  'poolId',
  'expiresAt',
] as const;

export function demoPoolId(): Hex {
  const [currency0, currency1] = DEPLOYED_USDC.toLowerCase() < DEPLOYED_RWA.toLowerCase()
    ? [DEPLOYED_USDC, DEPLOYED_RWA]
    : [DEPLOYED_RWA, DEPLOYED_USDC];
  return keccak256(encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' },
    ],
    [currency0, currency1, POOL_FEE, TICK_SPACING, DEPLOYED_HOOK],
  ));
}

export function offeringFilter() {
  return and(eq('projectTag', PROJECT_TAG), eq('offeringId', OFFERING_ID));
}

export function offeringQueryText(): string {
  return render(offeringFilter());
}

export function offeringExpiresAt(nowUnix: number): bigint {
  if (!Number.isInteger(nowUnix) || nowUnix <= 0) throw new Error('The offering clock is invalid');
  return BigInt(nowUnix) + BigInt(OFFERING_LIFETIME_SECONDS);
}

export function offeringWrite(nowUnix: number) {
  const expiresAt = offeringExpiresAt(nowUnix);
  const values = {
    projectTag: PROJECT_TAG,
    offeringId: OFFERING_ID,
    rwaSymbol: RWA_SYMBOL,
    usdcAddress: addr(DEPLOYED_USDC),
    rwaAddress: addr(DEPLOYED_RWA),
    poolId: key(demoPoolId()),
    expiresAt: u64(expiresAt),
  };
  return {
    schema: OfferingSchema,
    values,
    expiration: ExpirationTime.fromDays(OFFERING_LIFETIME_DAYS),
    expiresAt,
    query: offeringQueryText(),
  };
}

export type PublicOffering = {
  key: Hex;
  owner: Address;
  projectTag: string;
  offeringId: string;
  rwaSymbol: string;
  usdcAddress: Address;
  rwaAddress: Address;
  poolId: Hex;
  expiresAt: string;
};

export type ChainPolicyView = {
  cap: string | null;
  periodId: string | null;
  remaining: string | null;
  usdc: Address | null;
  rwa: Address | null;
};

export type OfferingDirectory = {
  arkivStatus: 'ready' | 'missing' | 'expired' | 'mismatch' | 'unavailable';
  warning: string | null;
  offering: PublicOffering | null;
  chain: ChainPolicyView;
};

const STALE_WARNING = 'This Arkiv record is not the current offering metadata. The cap, period, and remaining budget below are read from the Ethereum allocation contract. The purchase button uses that contract.';

function sameAddress(left: string | null, right: string): boolean {
  if (!left) return false;
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return false;
  }
}

export function publicOfferingFromRow(row: Record<string, unknown>): PublicOffering {
  const raw = (value: unknown): unknown => {
    if (value && typeof value === 'object' && 'value' in value) return (value as { value: unknown }).value;
    return value;
  };
  const text = (value: unknown, label: string): string => {
    const item = raw(value);
    if (typeof item === 'bigint' || typeof item === 'number') return item.toString();
    if (typeof item !== 'string' || !item) throw new Error(`The Arkiv ${label} field is missing`);
    return item;
  };
  return {
    key: text(row.$key, 'key') as Hex,
    owner: getAddress(text(row.$owner, 'owner')),
    projectTag: text(row.projectTag, 'project tag'),
    offeringId: text(row.offeringId, 'offering id'),
    rwaSymbol: text(row.rwaSymbol, 'RWA symbol'),
    usdcAddress: getAddress(text(row.usdcAddress, 'USDC address')),
    rwaAddress: getAddress(text(row.rwaAddress, 'RWA address')),
    poolId: text(row.poolId, 'pool id') as Hex,
    expiresAt: text(row.expiresAt, 'expiry'),
  };
}

export function describeOfferingDirectory(input: {
  nowUnix: number;
  chain: ChainPolicyView;
  offering: PublicOffering | null;
  arkivError: string | null;
}): OfferingDirectory {
  const chain = input.chain;
  if (input.arkivError) {
    return {
      arkivStatus: 'unavailable',
      warning: `${input.arkivError}. ${STALE_WARNING}`,
      offering: null,
      chain,
    };
  }
  const offering = input.offering;
  if (!offering) {
    return {
      arkivStatus: 'missing',
      warning: `The Arkiv offering record is missing. ${STALE_WARNING}`,
      offering: null,
      chain,
    };
  }
  const expiresAt = BigInt(offering.expiresAt);
  if (expiresAt <= BigInt(input.nowUnix)) {
    return {
      arkivStatus: 'expired',
      warning: `The Arkiv offering record has expired. ${STALE_WARNING}`,
      offering,
      chain,
    };
  }
  if (!chain.usdc || !chain.rwa) {
    return {
      arkivStatus: 'unavailable',
      warning: `The deployed token pair could not be read, so the Arkiv record is not treated as current. ${STALE_WARNING}`,
      offering,
      chain,
    };
  }
  if (
    !sameAddress(chain.usdc, offering.usdcAddress)
    || !sameAddress(chain.rwa, offering.rwaAddress)
    || offering.poolId.toLowerCase() !== demoPoolId().toLowerCase()
  ) {
    return {
      arkivStatus: 'mismatch',
      warning: `The Arkiv record does not match the deployed USDC, RWA, and pool. ${STALE_WARNING}`,
      offering,
      chain,
    };
  }
  return { arkivStatus: 'ready', warning: null, offering, chain };
}
