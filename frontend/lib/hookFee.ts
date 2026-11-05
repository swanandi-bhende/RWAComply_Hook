export type ComplianceTier = 0 | 1 | 2;

const BASE_FEE = 1000;
const RETAIL_STRESS_FEE = 5000;
const INSTITUTIONAL_STRESS_FEE = 500;

export function calculateDynamicFeeForTier(
  tier: ComplianceTier,
  volatility: number,
  threshold: number,
): number {
  if (tier === 0) return 0;
  if (volatility > threshold) {
    if (tier === 1) return RETAIL_STRESS_FEE;
    return INSTITUTIONAL_STRESS_FEE;
  }
  return BASE_FEE;
}
