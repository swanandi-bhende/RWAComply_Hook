'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { loadDeploymentAddresses } from '@/config/deployments';

export function LiveComplianceStatus() {
  const { address } = useAccount();
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<any>(null);

  // Load deployment addresses
  useEffect(() => {
    const load = async () => {
      try {
        const addr = await loadDeploymentAddresses();
        setAddresses(addr);
      } catch (error) {
        setDeploymentError(
          error instanceof Error ? error.message : 'Failed to load deployment addresses'
        );
      }
    };
    load();
  }, []);

  // Hook ABI
  const HOOK_ABI = [
    'function userTier(address user) external view returns (uint8)',
    'function volatilityThreshold() external view returns (uint256)',
    'function retailSwapCap() external view returns (uint256)',
  ];

  const ORACLE_ABI = [
    'function getVolatility() external view returns (uint256)',
  ];

  // User tier
  const { data: userTier, isLoading: tierLoading } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'userTier',
    args: [address!],
    query: { enabled: !!address && !!addresses?.hook },
  });

  // Volatility threshold
  const { data: volThreshold } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
    args: [],
    query: { enabled: !!addresses?.hook },
  });

  // Current volatility
  const { data: currentVol } = useReadContract({
    address: addresses?.oracle as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getVolatility',
    args: [],
    query: { enabled: !!addresses?.oracle },
  });

  // Retail swap cap
  const { data: retailCap } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
    args: [],
    query: { enabled: !!addresses?.hook },
  });

  if (deploymentError) {
    return (
      <div className="bg-red-50 border-2 border-red-600 p-6 rounded">
        <p className="text-red-600 font-bold mb-2">⚠️ Deployment Error</p>
        <p className="text-red-600 text-sm font-mono">{deploymentError}</p>
        <p className="text-red-600 text-xs mt-2">
          Run: <code className="bg-red-100 px-2 py-1">bash script/run_canonical_demo.sh</code>
        </p>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded">
        <p className="text-gray-600 font-bold">Connect wallet to view compliance status</p>
      </div>
    );
  }

  if (!addresses || tierLoading) {
    return (
      <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded">
        <p className="text-gray-600 font-bold">Loading compliance data...</p>
      </div>
    );
  }

  const tier = Number(userTier) || 0;
  const tierNames = ['Unverified (Tier 0)', 'Retail (Tier 1)', 'Institutional (Tier 2)'];
  const tierColors = [
    'bg-red-50 border-red-300',
    'bg-blue-50 border-blue-300',
    'bg-green-50 border-green-300',
  ];
  const tierTextColors = ['text-red-700', 'text-blue-700', 'text-green-700'];

  // Fee mapping based on tier
  const baseFees: { [key: number]: number } = {
    0: 0,      // Blocked
    1: 30,     // Tier 1 retail
    2: 10,     // Tier 2 institutional
  };

  const currentFee = baseFees[tier] || 0;
  const currentVolatility = Number(currentVol) || 0;
  const volatilityThresholdVal = Number(volThreshold) || 5;

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <div className={`border-2 p-6 rounded ${tierColors[tier]}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-gray-600 mb-1">YOUR COMPLIANCE TIER</p>
            <h3 className={`text-2xl font-black ${tierTextColors[tier]}`}>
              {tierNames[tier]}
            </h3>
          </div>
          <div className="text-4xl">{['🚫', '✅', '💎'][tier]}</div>
        </div>

        {tier === 0 && (
          <p className="text-sm font-semibold text-red-700">
            Unverified users cannot trade. Complete KYC to access Tier 1.
          </p>
        )}
        {tier === 1 && (
          <p className="text-sm font-semibold text-blue-700">
            You can trade at retail rates. Upgrades to Tier 2 available through enhanced verification.
          </p>
        )}
        {tier === 2 && (
          <p className="text-sm font-semibold text-green-700">
            Institutional tier unlocked. You benefit from lower fees and higher caps.
          </p>
        )}
      </div>

      {/* Live Market Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Volatility Status */}
        <div className="bg-white border-2 border-gray-300 p-4 rounded">
          <p className="text-xs font-bold text-gray-600 mb-2">MARKET VOLATILITY</p>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-3xl font-black text-black">{currentVolatility}%</p>
            <p className="text-sm font-bold text-gray-600">
              {currentVolatility > volatilityThresholdVal ? '(High - Dynamic Fees Active)' : '(Low - Default Fees)'}
            </p>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded overflow-hidden border border-gray-300">
            <div
              className={`h-full ${
                currentVolatility > volatilityThresholdVal
                  ? 'bg-red-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(currentVolatility * 2, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Threshold: {volatilityThresholdVal}%
          </p>
        </div>

        {/* Your Fee Rate */}
        <div className="bg-white border-2 border-gray-300 p-4 rounded">
          <p className="text-xs font-bold text-gray-600 mb-2">YOUR SWAP FEE</p>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-3xl font-black text-black">{currentFee}</p>
            <p className="text-lg font-bold text-gray-600">bps</p>
          </div>
          {tier === 0 ? (
            <p className="text-xs text-red-700 font-semibold">
              🔒 Tier 0 users cannot trade
            </p>
          ) : (
            <p className="text-xs text-gray-600">
              {currentVolatility > volatilityThresholdVal
                ? `Dynamic fee tier for Tier ${tier}`
                : `Base fee for Tier ${tier}`}
            </p>
          )}
        </div>
      </div>

      {/* Swap Cap Info */}
      {tier === 1 && (
        <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded">
          <p className="text-xs font-bold text-blue-700 mb-1">RETAIL SWAP CAP</p>
          <p className="text-lg font-black text-blue-700">
            {retailCap ? `${Number(retailCap) / 1e18} tokens per swap` : 'Loading...'}
          </p>
          <p className="text-xs text-blue-600 mt-2">
            Tier 1 users have a maximum swap size limit to manage risk.
          </p>
        </div>
      )}

      {/* Contract Reality Check Code Snippet */}
      <div className="bg-black text-white border-2 border-black p-4 rounded">
        <p className="text-xs font-bold mb-2 text-gray-300">CONTRACT: beforeSwap() Tier Check</p>
        <pre className="text-xs font-mono overflow-x-auto">
{`if (userTier[msg.sender] == 0) 
  revert AccessDenied();
  
uint24 fee = getBaseFeeForTier(
  userTier[msg.sender]
);`}
        </pre>
      </div>
    </div>
  );
}
