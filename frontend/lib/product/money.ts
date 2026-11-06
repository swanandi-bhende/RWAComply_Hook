const USDC_SCALE = BigInt(1_000_000);

export function formatUsdc(raw: bigint): string {
  const negative = raw < BigInt(0);
  const value = negative ? -raw : raw;
  const whole = (value / USDC_SCALE).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (value % USDC_SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  const amount = fraction ? `${whole}.${fraction}` : whole;
  return `${negative ? '-' : ''}$${amount}`;
}

export type PurchaseDecision = {
  allowed: boolean;
  reason: 'enter_amount' | 'within' | 'exceeds' | 'unavailable';
  remainingAfter: bigint | null;
};

export function purchaseDecision(input: {
  remaining: bigint | null;
  requested: bigint | null;
}): PurchaseDecision {
  if (input.remaining === null || input.requested === null) {
    return { allowed: false, reason: 'unavailable', remainingAfter: null };
  }
  if (input.requested <= BigInt(0)) {
    return { allowed: false, reason: 'enter_amount', remainingAfter: input.remaining };
  }
  if (input.requested > input.remaining) {
    return { allowed: false, reason: 'exceeds', remainingAfter: input.remaining };
  }
  return {
    allowed: true,
    reason: 'within',
    remainingAfter: input.remaining - input.requested,
  };
}
