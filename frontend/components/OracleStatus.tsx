'use client';

import { useReadContract } from 'wagmi';
import { ORACLE_ADDRESS, ORACLE_ABI, HOOK_ADDRESS, HOOK_ABI } from '@/contracts';
import { formatEther, parseEther } from 'viem';

export function OracleStatus() {
  const { data: volatility } = useReadContract({
    address: ORACLE_ADDRESS as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getVolatility',
  });

  const { data: volatilityThreshold } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
  });

  const { data: retailSwapCap } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
  });

  const volatilityPercent = volatility ? Number(volatility) / 100 : 0;
  const isHighVolatility = volatility && volatilityThreshold 
    ? volatility > volatilityThreshold 
    : false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Volatility Card */}
      <div className={`rounded-lg p-6 border-2 ${
        isHighVolatility
          ? 'bg-red-50 border-red-200'
          : 'bg-green-50 border-green-200'
      }`}>
        <p className="text-gray-600 text-sm font-medium mb-2">Current Volatility</p>
        <div className="flex items-end space-x-2 mb-3">
          <h3 className={`text-3xl font-bold ${
            isHighVolatility ? 'text-red-600' : 'text-green-600'
          }`}>
            {volatilityPercent.toFixed(2)}%
          </h3>
          <span className={`text-sm font-semibold px-2 py-1 rounded ${
            isHighVolatility
              ? 'bg-red-200 text-red-800'
              : 'bg-green-200 text-green-800'
          }`}>
            {isHighVolatility ? 'High' : 'Stable'}
          </span>
        </div>
        <p className="text-xs text-gray-600">
          Updated by on-chain oracle
        </p>
      </div>

      {/* Volatility Threshold Card */}
      <div className="rounded-lg p-6 border-2 border-blue-200 bg-blue-50">
        <p className="text-gray-600 text-sm font-medium mb-2">Fee Trigger Level</p>
        <h3 className="text-3xl font-bold text-blue-600 mb-3">
          {volatilityThreshold ? `${Number(volatilityThreshold) / 100}%` : 'Loading...'}
        </h3>
        <p className="text-xs text-gray-600">
          Volatility above this triggers dynamic fees
        </p>
      </div>

      {/* Retail Cap Card */}
      <div className="rounded-lg p-6 border-2 border-purple-200 bg-purple-50">
        <p className="text-gray-600 text-sm font-medium mb-2">Tier 0 Swap Cap</p>
        <h3 className="text-3xl font-bold text-purple-600 mb-3">
          {retailSwapCap ? `${Number(retailSwapCap) / 1e18}` : 'Loading...'}
        </h3>
        <p className="text-xs text-gray-600">
          Maximum per unverified user swap
        </p>
      </div>
    </div>
  );
}
