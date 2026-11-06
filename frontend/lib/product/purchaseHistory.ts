import type { Address, Hex } from 'viem';

export type PublicPurchase = {
  transactionHash: Hex;
  blockNumber: string;
  wallet: Address;
  amount: string;
  newSpent: string;
  groupId?: Hex;
  periodId?: string;
};

type SpendLog = {
  transactionHash: Hex | null;
  blockNumber: bigint | null;
  removed?: boolean;
  args: {
    wallet?: Address;
    allocationId?: Hex;
    groupId?: Hex;
    periodId?: bigint;
    amount?: bigint;
    newSpent?: bigint;
  };
};

export function publicPurchasesFromLogs(logs: SpendLog[], limit = 20, offset = 0): PublicPurchase[] {
  const purchases: PublicPurchase[] = [];
  for (const log of logs) {
    if (log.removed || log.transactionHash === null || log.blockNumber === null) continue;
    const { wallet, amount, newSpent, groupId, periodId } = log.args;
    if (!wallet || amount === undefined || newSpent === undefined) continue;
    purchases.push({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber.toString(),
      wallet,
      amount: amount.toString(),
      newSpent: newSpent.toString(),
      ...(groupId ? { groupId } : {}),
      ...(periodId !== undefined ? { periodId: periodId.toString() } : {}),
    });
  }
  purchases.sort((left, right) => {
    const blockDelta = BigInt(right.blockNumber) - BigInt(left.blockNumber);
    if (blockDelta !== BigInt(0)) return blockDelta > BigInt(0) ? 1 : -1;
    return right.transactionHash.localeCompare(left.transactionHash);
  });
  return purchases.slice(offset, offset + limit);
}
