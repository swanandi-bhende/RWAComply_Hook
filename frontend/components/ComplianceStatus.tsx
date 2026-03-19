'use client';

import { useAccount, useReadContract } from 'wagmi';
import { HOOK_ADDRESS, HOOK_ABI, TIER_NAMES, TIER_COLORS } from '@/contracts';

export function ComplianceStatus() {
  const { address } = useAccount();

  const { data: userTier } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'userTier',
    args: [address!],
    query: { enabled: !!address, refetchInterval: 1000 },
  });

  if (!address) {
    return (
      <div className="bg-white border-3 border-black rounded-lg p-6">
        <p className="text-black font-bold text-lg">Connect wallet to view compliance status</p>
      </div>
    );
  }

  const tier = Number(userTier ?? BigInt(0));
  const safeTier = tier === 2 ? 2 : tier === 1 ? 1 : 0;

  return (
    <div className="bg-white border-3 border-black rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-black text-sm font-bold mb-2">YOUR VERIFICATION TIER</p>
          <h3 className="text-3xl font-bold text-black">
            {TIER_NAMES[safeTier]}
          </h3>
        </div>
        <div className="w-20 h-20 rounded border-3 border-black flex items-center justify-center text-3xl font-bold bg-black text-white">
          {safeTier}
        </div>
      </div>
      <div className="border-t-2 border-black mt-4 pt-4">
        <p className="text-sm font-semibold text-black">
          {safeTier === 0 && 'UNVERIFIED: Enhanced trading requires KYC verification.'}
          {safeTier === 1 && 'TIER 1: Basic KYC verification active. Upgrade to Tier 2 for higher limits.'}
          {safeTier === 2 && 'TIER 2: Enhanced verification active. Full trading benefits available.'}
        </p>
      </div>
    </div>
  );
}
