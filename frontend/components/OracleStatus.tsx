'use client';

import { useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { ORACLE_ADDRESS, ORACLE_ABI, HOOK_ADDRESS, HOOK_ABI } from '@/contracts';
import { formatEther, parseEther } from 'viem';
import { useTransactions } from '@/app/TransactionContext';

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-300 rounded w-24"></div>
    </div>
  );
}

export function OracleStatus() {
  const { transactions } = useTransactions();

  const { data: volatility, isLoading: volatilityLoading, refetch: refetchVolatility } = useReadContract({
    address: ORACLE_ADDRESS as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getVolatility',
  });

  const { data: volatilityThreshold, isLoading: thresholdLoading, refetch: refetchThreshold } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
  });

  const { data: retailSwapCap, isLoading: capLoading, refetch: refetchCap } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
  });

  // Refetch when transactions update
  useEffect(() => {
    refetchVolatility();
    refetchThreshold();
    refetchCap();
  }, [transactions, refetchVolatility, refetchThreshold, refetchCap]);

  const volatilityPercent = volatility ? Number(volatility) / 100 : 0;
  const isHighVolatility = volatility && volatilityThreshold 
    ? volatility > volatilityThreshold 
    : false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Volatility Card */}
      <div className="bg-white border-3 border-black rounded-lg p-6">
        <p className="text-black text-sm font-bold mb-2">CURRENT VOLATILITY</p>
        <div className="flex items-end space-x-2 mb-3">
          {volatilityLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <h3 className="text-4xl font-bold text-black">
                {volatilityPercent.toFixed(2)}%
              </h3>
              <span className={`text-sm font-bold px-3 py-1 rounded border-2 border-black ${
                isHighVolatility
                  ? 'bg-black text-white'
                  : 'bg-white text-black'
              }`}>
                {isHighVolatility ? 'HIGH' : 'STABLE'}
              </span>
            </>
          )}
        </div>
        <p className="text-xs font-semibold text-black">
          Updated by on-chain oracle
        </p>
      </div>

      {/* Volatility Threshold Card */}
      <div className="bg-white border-3 border-black rounded-lg p-6">
        <p className="text-black text-sm font-bold mb-2">FEE TRIGGER LEVEL</p>
        <h3 className="text-4xl font-bold text-black mb-3">
          {thresholdLoading ? <LoadingSkeleton /> : volatilityThreshold ? `${Number(volatilityThreshold) / 100}%` : 'N/A'}
        </h3>
        <p className="text-xs font-semibold text-black">
          Volatility above this triggers dynamic fees
        </p>
      </div>

      {/* Retail Cap Card */}
      <div className="bg-white border-3 border-black rounded-lg p-6">
        <p className="text-black text-sm font-bold mb-2">TIER 0 SWAP CAP</p>
        <h3 className="text-4xl font-bold text-black mb-3">
          {capLoading ? <LoadingSkeleton /> : retailSwapCap ? `${Number(retailSwapCap) / 1e18}` : 'N/A'}
        </h3>
        <p className="text-xs font-semibold text-black">
          Maximum per unverified user swap
        </p>
      </div>
    </div>
  );
}
