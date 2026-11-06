import { parseUnits } from 'viem';

export const USDC_DECIMALS = 6;

export type UsdcPurchasePlan = {
  amountIn: bigint;
  approval: { token: string; spender: string; amount: bigint };
  swap: {
    router: string;
    amountIn: bigint;
    poolKey: {
      currency0: string;
      currency1: string;
      fee: number;
      tickSpacing: number;
      hooks: string;
    };
  };
};

export function usdcPurchasePlan(input: {
  typedAmount: string;
  usdc: string;
  rwa: string;
  executor: string;
  poolManager: string;
  hook: string;
  fee: number;
  tickSpacing: number;
}): { ok: true; plan: UsdcPurchasePlan } | { ok: false; reason: 'amount' | 'tokens' | 'router' } {
  let amountIn: bigint;
  try {
    amountIn = parseUnits(input.typedAmount.trim(), USDC_DECIMALS);
  } catch {
    return { ok: false, reason: 'amount' };
  }
  if (amountIn <= BigInt(0)) return { ok: false, reason: 'amount' };
  if (!input.usdc || !input.rwa || !input.executor || !input.hook) return { ok: false, reason: 'tokens' };
  if (input.usdc.toLowerCase() === input.rwa.toLowerCase()) return { ok: false, reason: 'tokens' };
  if (input.executor.toLowerCase() === input.poolManager.toLowerCase()) return { ok: false, reason: 'router' };
  const [currency0, currency1] = input.usdc.toLowerCase() < input.rwa.toLowerCase()
    ? [input.usdc, input.rwa]
    : [input.rwa, input.usdc];
  return {
    ok: true,
    plan: {
      amountIn,
      approval: { token: input.usdc, spender: input.executor, amount: amountIn },
      swap: {
        router: input.executor,
        amountIn,
        poolKey: {
          currency0,
          currency1,
          fee: input.fee,
          tickSpacing: input.tickSpacing,
          hooks: input.hook,
        },
      },
    },
  };
}
