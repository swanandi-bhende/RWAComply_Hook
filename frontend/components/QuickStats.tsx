'use client';

import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { loadDeploymentAddresses } from '@/config/deployments';

export function QuickStats() {
  const [addresses, setAddresses] = useState<any>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const addr = await loadDeploymentAddresses();
        setAddresses(addr);
      } catch (error) {
        setDeploymentError(
          error instanceof Error ? error.message : 'Failed to load deployment'
        );
      }
    };
    load();
  }, []);

  const HOOK_ABI = [
    'function volatilityThreshold() external view returns (uint256)',
    'function retailSwapCap() external view returns (uint256)',
    'function owner() external view returns (address)',
    'function poolPaused() external view returns (bool)',
  ];

  // Volatility threshold
  const { data: volThreshold } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
    args: [],
    query: { enabled: !!addresses?.hook },
  });

  // Retail cap
  const { data: retailCap } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
    args: [],
    query: { enabled: !!addresses?.hook },
  });

  // Hook owner
  const { data: hookOwner } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'owner',
    args: [],
    query: { enabled: !!addresses?.hook },
  });

  // Pool paused
  const { data: isPaused } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'poolPaused',
    args: [],
    query: { enabled: !!addresses?.hook },
  });

  if (deploymentError) {
    return null;
  }

  if (!addresses) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 font-semibold">Loading contract data...</p>
      </div>
    );
  }

  const formatAddress = (addr: string) => {
    if (!addr) return '...';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-black text-black mb-4">HOOK CONFIGURATION</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Volatility Threshold */}
        <div className="bg-white border-2 border-gray-300 p-6 rounded">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">VOLATILITY THRESHOLD</p>
              <p className="text-3xl font-black text-black">
                {volThreshold ? Number(volThreshold) : '-'}%
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Dynamic fees activate when market volatility exceeds this level.
              </p>
            </div>
            <span className="text-3xl">📊</span>
          </div>
        </div>

        {/* Retail Swap Cap */}
        <div className="bg-white border-2 border-gray-300 p-6 rounded">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">RETAIL SWAP CAP</p>
              <p className="text-3xl font-black text-black">
                {retailCap ? `${(Number(retailCap) / 1e18).toFixed(0)}` : '-'}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Maximum tokens per swap for Tier 1 users.
              </p>
            </div>
            <span className="text-3xl">💰</span>
          </div>
        </div>

        {/* Hook Owner */}
        <div className="bg-white border-2 border-gray-300 p-6 rounded">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">HOOK OWNER</p>
              <p className="text-lg font-mono font-black text-black">
                {hookOwner ? formatAddress(hookOwner as string) : '-'}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Owner can manage hook configuration and oracle.
              </p>
            </div>
            <span className="text-3xl">🔑</span>
          </div>
        </div>

        {/* Pool Status */}
        <div className={`border-2 p-6 rounded ${
          isPaused
            ? 'bg-red-50 border-red-300'
            : 'bg-green-50 border-green-300'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">POOL STATUS</p>
              <p className={`text-lg font-bold ${
                isPaused ? 'text-red-700' : 'text-green-700'
              }`}>
                {isPaused ? '⏸️ PAUSED' : '▶️ ACTIVE'}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {isPaused
                  ? 'Pool is paused. No swaps or liquidity changes allowed.'
                  : 'Pool is active and accepting trades.'}
              </p>
            </div>
            <span className="text-3xl">{isPaused ? '🚫' : '✅'}</span>
          </div>
        </div>
      </div>

      {/* Deployment Info */}
      <div className="bg-black text-white border-2 border-black p-4 rounded">
        <p className="text-xs font-bold mb-3 text-gray-300">CONTRACT ADDRESSES</p>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-gray-400">Hook:</span>
            <span className="text-white">{formatAddress(addresses.hook)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Oracle:</span>
            <span className="text-white">{formatAddress(addresses.oracle)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">PoolManager:</span>
            <span className="text-white">{formatAddress(addresses.poolManager)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Token A:</span>
            <span className="text-white">{formatAddress(addresses.tokenA)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Token B:</span>
            <span className="text-white">{formatAddress(addresses.tokenB)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
