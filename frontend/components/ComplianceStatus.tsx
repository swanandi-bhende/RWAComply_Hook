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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <p className="text-gray-700 font-medium">Connect wallet to view compliance status</p>
      </div>
    );
  }

  let tier = 0;
  if (isTier2) tier = 2;
  else if (isTier1) tier = 1;

  return (
    <div className={`rounded-lg p-6 border-2 ${
      tier === 2
        ? 'bg-purple-50 border-purple-200'
        : tier === 1
        ? 'bg-blue-50 border-blue-200'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium mb-1">Your Verification Tier</p>
          <h3 className={`text-2xl font-bold ${
            tier === 2
              ? 'text-purple-600'
              : tier === 1
              ? 'text-blue-600'
              : 'text-gray-600'
          }`}>
            {TIER_NAMES[tier as 0 | 1 | 2]}
          </h3>
        </div>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
          tier === 2
            ? 'bg-purple-200 text-purple-700'
            : tier === 1
            ? 'bg-blue-200 text-blue-700'
            : 'bg-gray-200 text-gray-700'
        }`}>
          {tier}
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-4">
        {tier === 0 && 'You are unverified. Enhanced trading requires KYC verification.'}
        {tier === 1 && 'You have basic KYC verification. Upgrade to Tier 2 for higher limits.'}
        {tier === 2 && 'You have enhanced verification. Enjoy maximum trading benefits.'}
      </p>
    </div>
  );
}
