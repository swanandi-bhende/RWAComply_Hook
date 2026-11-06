export const MAX_OFFERING_CAP = BigInt('1000000000000000');

export type OfferingDraft = {
  name: string;
  symbol: string;
  category: string;
  description: string;
  cap: string;
  startTime: string;
  endTime: string;
  tokenReserve: string;
  usdcReserve: string;
};

export function offeringErrors(draft: OfferingDraft, now = 0): string[] {
  const errors: string[] = [];
  if (draft.name.trim().length === 0 || draft.name.trim().length > 64) errors.push('Enter an offering name of 1 to 64 characters.');
  if (draft.symbol.trim().length === 0 || draft.symbol.trim().length > 12) errors.push('Enter a token symbol of 1 to 12 characters.');
  if (draft.category.trim().length === 0) errors.push('Enter an asset category.');
  if (draft.description.trim().length === 0) errors.push('Describe the asset. RWAComply does not certify that description.');
  let cap: bigint;
  try {
    cap = BigInt(draft.cap);
  } catch {
    cap = BigInt(0);
  }
  if (cap <= BigInt(0) || cap > MAX_OFFERING_CAP) errors.push('Enter a USDC cap greater than zero and at most 1,000,000,000 USDC.');
  const start = Number(draft.startTime);
  const end = Number(draft.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end <= now) {
    errors.push('The offering end must be after the start and after the current time.');
  }
  return errors;
}

export function indicativePrice(tokenReserve: string, usdcReserve: string): string | null {
  const tokens = Number(tokenReserve);
  const usdc = Number(usdcReserve);
  if (!Number.isFinite(tokens) || !Number.isFinite(usdc) || tokens <= 0 || usdc <= 0) return null;
  return (usdc / tokens).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
