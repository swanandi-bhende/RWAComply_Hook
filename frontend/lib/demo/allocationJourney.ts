export const DEMO_CAP = BigInt(1_000_000_000);
export const DEMO_FIRST_PURCHASE = BigInt(700_000_000);
export const DEMO_REJECTED_PURCHASE = BigInt(500_000_000);
export const DEMO_SECOND_PURCHASE = BigInt(200_000_000);

export function applyPurchase(spent: bigint, purchase: bigint, cap = DEMO_CAP): { accepted: boolean; spent: bigint; remaining: bigint } {
  const remaining = cap - spent;
  if (purchase <= BigInt(0) || purchase > remaining) {
    return { accepted: false, spent, remaining };
  }
  const nextSpent = spent + purchase;
  return { accepted: true, spent: nextSpent, remaining: cap - nextSpent };
}
