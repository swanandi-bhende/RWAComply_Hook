'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseAbi } from 'viem';
import { useReadContract } from 'wagmi';
import { loadDeploymentAddresses } from '@/config/deployments';
import { calculateDynamicFeeForTier, type ComplianceTier } from '@/lib/hookFee';

const LIVE_REFETCH_MS = 1000;

type TierOption = ComplianceTier;

const TIER_INFO: Record<TierOption, { name: string; icon: string; description: string }> = {
  0: {
    name: 'Tier 0 (Unverified)',
    icon: '🚫',
    description: 'beforeSwap reverts with AccessDenied().',
  },
  1: {
    name: 'Tier 1 (Retail)',
    icon: '✅',
    description: 'Allowed, but retail cap and higher stressed-market fee apply.',
  },
  2: {
    name: 'Tier 2 (Institutional)',
    icon: '💎',
    description: 'Allowed with preferential fee under high volatility.',
  },
};

export function TierTester() {
  const [selectedTier, setSelectedTier] = useState<TierOption>(1);
  const [simulatedVolatility, setSimulatedVolatility] = useState(5);
  const [addresses, setAddresses] = useState<{
    hook: string;
    oracle: string;
  } | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const addr = await loadDeploymentAddresses();
        setAddresses({ hook: addr.hook, oracle: addr.oracle });
      } catch (error) {
        setDeploymentError(error instanceof Error ? error.message : 'Failed to load deployment');
      }
    };

    load();
  }, []);

  const hookAbi = parseAbi([
    'function volatilityThreshold() external view returns (uint256)',
    'function retailSwapCap() external view returns (uint256)',
  ]);

  const oracleAbi = parseAbi(['function getVolatility() external view returns (uint256)']);

  const { data: threshold } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: hookAbi,
    functionName: 'volatilityThreshold',
    query: { enabled: !!addresses?.hook, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: retailCap } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: hookAbi,
    functionName: 'retailSwapCap',
    query: { enabled: !!addresses?.hook, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: liveVolatility } = useReadContract({
    address: addresses?.oracle as `0x${string}`,
    abi: oracleAbi,
    functionName: 'getVolatility',
    query: { enabled: !!addresses?.oracle, refetchInterval: LIVE_REFETCH_MS },
  });

  const thresholdNum = Number(threshold ?? BigInt(5));
  const liveVolNum = Number(liveVolatility ?? BigInt(0));
  const retailCapNum = Number(retailCap ?? BigInt(0)) / 1e18;

  const liveFees = useMemo(
    () => ({
      0: calculateDynamicFeeForTier(0, liveVolNum, thresholdNum),
      1: calculateDynamicFeeForTier(1, liveVolNum, thresholdNum),
      2: calculateDynamicFeeForTier(2, liveVolNum, thresholdNum),
    }),
    [liveVolNum, thresholdNum]
  );

  const simulatedFees = useMemo(
    () => ({
      0: calculateDynamicFeeForTier(0, simulatedVolatility, thresholdNum),
      1: calculateDynamicFeeForTier(1, simulatedVolatility, thresholdNum),
      2: calculateDynamicFeeForTier(2, simulatedVolatility, thresholdNum),
    }),
    [simulatedVolatility, thresholdNum]
  );

  const isStressedRegime = simulatedVolatility > thresholdNum;
  const thresholdDelta = simulatedVolatility - thresholdNum;
  const normalizedStress = Math.max(0, Math.min(100, Math.round((simulatedVolatility / 100) * 100)));

  if (deploymentError) {
    return (
      <div className="bg-red-50 border-2 border-red-600 p-6 rounded">
        <p className="text-red-600 font-bold mb-2">Deployment Error</p>
        <p className="text-red-600 text-sm">{deploymentError}</p>
      </div>
    );
  }

  if (!addresses) {
    return (
      <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded text-center">
        <p className="text-gray-600 font-bold">Loading tier data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-4xl font-black text-black mb-2">TIER ACCESS CONTROL</h2>
        <p className="text-lg text-gray-700 font-semibold">
          Pick a tier to see exactly what the hook does before a swap.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([0, 1, 2] as TierOption[]).map((tier) => {
          const isSelected = selectedTier === tier;
          const info = TIER_INFO[tier];
          const fee = liveFees[tier];

          return (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`p-6 rounded border-2 text-left transition-all ${
                isSelected
                  ? 'border-black ring-2 ring-black bg-gray-50'
                  : 'border-gray-300 bg-white hover:border-gray-500'
              }`}
            >
              <p className="text-3xl mb-2">{info.icon}</p>
              <p className="font-bold text-lg text-black mb-1">{info.name}</p>
              <p className="text-sm text-gray-700 mb-2">{info.description}</p>
              <p className="text-xs font-bold text-gray-500">LIVE EFFECTIVE FEE</p>
              <p className="text-2xl font-black text-black">
                {tier === 0 ? 'Blocked' : `${fee} bps`}
              </p>
            </button>
          );
        })}
      </div>

      <div className="border-2 border-gray-300 rounded p-6 bg-white">
        <p className="text-sm font-bold text-gray-600 mb-3">LIVE MARKET CONTEXT</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs font-bold text-gray-500">ORACLE VOLATILITY</p>
            <p className="text-2xl font-black">{liveVolNum}%</p>
          </div>
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs font-bold text-gray-500">THRESHOLD</p>
            <p className="text-2xl font-black">{thresholdNum}%</p>
          </div>
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs font-bold text-gray-500">RETAIL CAP</p>
            <p className="text-2xl font-black">{retailCapNum.toFixed(2)}</p>
            <p className="text-xs text-gray-500">tokens/swap</p>
          </div>
        </div>
      </div>

      <div className="border-2 border-black rounded p-6 bg-gray-50">
        <p className="text-sm font-bold text-gray-600 mb-2">OUTCOME FOR SELECTED TIER</p>
        {selectedTier === 0 ? (
          <div className="bg-red-100 border-2 border-red-400 rounded p-4">
            <p className="font-bold text-red-700">Transaction Fails</p>
            <p className="text-xs font-mono text-red-700 mt-2">AccessDenied()</p>
          </div>
        ) : (
          <div className="bg-green-100 border-2 border-green-400 rounded p-4 space-y-2">
            <p className="font-bold text-green-700">Swap Allowed</p>
            <p className="text-sm text-green-800">Effective fee now: {liveFees[selectedTier]} bps</p>
            {selectedTier === 1 && (
              <p className="text-sm text-green-800">Retail cap enforced: {retailCapNum.toFixed(2)} tokens</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border-2 border-gray-300 p-6 rounded space-y-4">
        <h3 className="text-2xl font-black text-black">Simulate Volatility Impact</h3>
        <p className="text-sm text-black">
          The fee rule is threshold-based on-chain. The regime flips when volatility crosses the threshold,
          while the metrics below provide continuous context as you move the slider.
        </p>
        <label className="text-sm font-bold text-gray-700 block">
          Simulated Volatility: {simulatedVolatility}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={simulatedVolatility}
          onChange={(event) => setSimulatedVolatility(Number(event.target.value))}
          className="w-full accent-black"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs font-bold text-black">REGIME</p>
            <p className="text-lg font-black text-black">{isStressedRegime ? 'Stressed' : 'Default'}</p>
          </div>
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs font-bold text-black">THRESHOLD DELTA</p>
            <p className="text-lg font-black text-black">{thresholdDelta >= 0 ? `+${thresholdDelta}` : thresholdDelta}%</p>
          </div>
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs font-bold text-black">VOLATILITY INDEX</p>
            <p className="text-lg font-black text-black">{normalizedStress}/100</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs font-bold text-black">TIER 0</p>
            <p className="text-lg font-black text-black">Blocked</p>
          </div>
          <div className="border border-blue-300 bg-blue-50 rounded p-3">
            <p className="text-xs font-bold text-blue-600">TIER 1</p>
            <p className="text-lg font-black text-blue-700">{simulatedFees[1]} bps</p>
          </div>
          <div className="border border-green-300 bg-green-50 rounded p-3">
            <p className="text-xs font-bold text-green-600">TIER 2</p>
            <p className="text-lg font-black text-green-700">{simulatedFees[2]} bps</p>
          </div>
        </div>
      </div>

      <div className="bg-black text-white border-2 border-black p-6 rounded">
        <p className="text-xs font-bold mb-2 text-gray-300">CONTRACT REALITY CHECK</p>
        <pre className="text-xs font-mono overflow-x-auto">{`function beforeSwap(...) external returns (...) {
  uint8 tier = userTier[sender];
  if (tier == 0) revert AccessDenied();

  if (tier == RETAIL && amount > retailSwapCap) {
    revert RetailLimitExceeded();
  }

  uint24 fee = getDynamicFee(sender);
  emit BeforeSwapCalled(sender, tier, fee);
}`}</pre>
      </div>
    </div>
  );
}
