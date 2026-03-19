'use client';

import { useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { HOOK_ADDRESS, HOOK_ABI, TIER_NAMES, TIER_COLORS } from '@/contracts';
import { useTransactions } from '@/app/TransactionContext';

export function ComplianceStatus() {
  const { address } = useAccount();
  const { transactions } = useTransactions();

  const { data: isTier1, refetch: refetchTier1 } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'isVerifiedTier1',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: isTier2, refetch: refetchTier2 } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'isVerifiedTier2',
    args: [address!],
    query: { enabled: !!address },
  });

  // Refetch when transactions update
  useEffect(() => {
    if (address) {
      refetchTier1();
      refetchTier2();
    }
  }, [transactions, address, refetchTier1, refetchTier2]);

  if (!address) {
    return (
      <div className="bg-white border-3 border-black rounded-lg p-6">
        <p className="text-black font-bold text-lg">Connect wallet to view compliance status</p>
      </div>
    );
  }

  let tier = 0;
  if (isTier2) tier = 2;
  else if (isTier1) tier = 1;

  return (
    <div className="bg-white border-3 border-black rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-black text-sm font-bold mb-2">YOUR VERIFICATION TIER</p>
          <h3 className="text-3xl font-bold text-black">
            {TIER_NAMES[tier as 0 | 1 | 2]}
          </h3>
        </div>
        <div className="w-20 h-20 rounded border-3 border-black flex items-center justify-center text-3xl font-bold bg-black text-white">
          {tier}
        </div>
      </div>
      <div className="border-t-2 border-black mt-4 pt-4">
        <p className="text-sm font-semibold text-black">
          {tier === 0 && '⚠️ UNVERIFIED: Enhanced trading requires KYC verification.'}
          {tier === 1 && '✓ TIER 1: Basic KYC verification active. Upgrade to Tier 2 for higher limits.'}
          {tier === 2 && '✓ TIER 2: Enhanced verification active. Full trading benefits available.'}
        </p>
      </div>
    </div>
  );
}
