'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseAbi } from 'viem';
import { useReadContract } from 'wagmi';
import { loadDeploymentAddresses } from '@/config/deployments';
import { calculateDynamicFeeForTier } from '@/lib/hookFee';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const LIVE_REFETCH_MS = 1000;

type FeePoint = {
  volatility: number;
  tier1: number;
  tier2: number;
};

export function DynamicFeeVisualizer() {
  const [selectedSimulatedVol, setSelectedSimulatedVol] = useState(5);
  const [addresses, setAddresses] = useState<{ hook: string; oracle: string } | null>(null);
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

  const hookAbi = parseAbi(['function volatilityThreshold() external view returns (uint256)']);
  const oracleAbi = parseAbi(['function getVolatility() external view returns (uint256)']);

  const { data: volThreshold, refetch: refetchThreshold } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: hookAbi,
    functionName: 'volatilityThreshold',
    query: { enabled: !!addresses?.hook, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: currentVol, refetch: refetchVolatility } = useReadContract({
    address: addresses?.oracle as `0x${string}`,
    abi: oracleAbi,
    functionName: 'getVolatility',
    query: { enabled: !!addresses?.oracle, refetchInterval: LIVE_REFETCH_MS },
  });

  const thresholdNum = Number(volThreshold ?? BigInt(5));
  const currentVolNum = Number(currentVol ?? BigInt(0));

  const chartData = useMemo<FeePoint[]>(() => {
    const data: FeePoint[] = [];

    for (let volatility = 0; volatility <= 100; volatility += 1) {
      data.push({
        volatility,
        tier1: calculateDynamicFeeForTier(1, volatility, thresholdNum),
        tier2: calculateDynamicFeeForTier(2, volatility, thresholdNum),
      });
    }

    return data;
  }, [thresholdNum]);

  const currentTier1Fee = calculateDynamicFeeForTier(1, currentVolNum, thresholdNum);
  const currentTier2Fee = calculateDynamicFeeForTier(2, currentVolNum, thresholdNum);
  const simulatedTier1Fee = calculateDynamicFeeForTier(1, selectedSimulatedVol, thresholdNum);
  const simulatedTier2Fee = calculateDynamicFeeForTier(2, selectedSimulatedVol, thresholdNum);
  const simulatedDelta = selectedSimulatedVol - thresholdNum;
  const simulatedRegime = selectedSimulatedVol > thresholdNum ? 'Stressed regime' : 'Default regime';

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
        <p className="text-gray-600 font-bold">Loading fee data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-black text-black mb-2">DYNAMIC FEE SYSTEM</h2>
        <p className="text-lg text-gray-700 font-semibold">
          Fee behavior is driven by on-chain volatility and compliance tier.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-gray-300 p-4 rounded">
          <p className="text-xs font-bold text-gray-600 mb-2">CURRENT VOLATILITY</p>
          <p className="text-3xl font-black text-black">{currentVolNum}%</p>
          <p className="text-xs text-gray-600 mt-2">
            {currentVolNum > thresholdNum ? 'Above threshold' : 'At or below threshold'}
          </p>
        </div>

        <div className="bg-white border-2 border-gray-300 p-4 rounded">
          <p className="text-xs font-bold text-gray-600 mb-2">THRESHOLD</p>
          <p className="text-3xl font-black text-black">{thresholdNum}%</p>
          <button
            onClick={() => {
              void refetchThreshold();
              void refetchVolatility();
            }}
            className="text-xs mt-2 font-bold underline"
            type="button"
          >
            refresh
          </button>
        </div>

        <div className="bg-white border-2 border-blue-300 p-4 rounded">
          <p className="text-xs font-bold text-blue-700 mb-2">TIER 1 EFFECTIVE FEE</p>
          <p className="text-3xl font-black text-blue-700">{currentTier1Fee}</p>
          <p className="text-xs text-blue-600 mt-2">bps</p>
        </div>

        <div className="bg-white border-2 border-green-300 p-4 rounded">
          <p className="text-xs font-bold text-green-700 mb-2">TIER 2 EFFECTIVE FEE</p>
          <p className="text-3xl font-black text-green-700">{currentTier2Fee}</p>
          <p className="text-xs text-green-600 mt-2">bps</p>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-300 p-6 rounded">
        <h3 className="text-2xl font-black text-black mb-4">FEE CURVES (ON-CHAIN RULES)</h3>
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              domain={[0, 100]}
              dataKey="volatility"
              label={{ value: 'Volatility (%)', position: 'insideBottomRight', offset: -10 }}
            />
            <YAxis label={{ value: 'Fee (bps)', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value) => `${value} bps`} />
            <Legend />

            <ReferenceLine
              x={thresholdNum}
              stroke="#666"
              strokeDasharray="5 5"
              label={{ value: `Threshold ${thresholdNum}%`, position: 'top' }}
            />
            <ReferenceLine
              x={currentVolNum}
              stroke="#d00"
              strokeWidth={2}
              label={{ value: `Current ${currentVolNum}%`, position: 'top' }}
            />
            <ReferenceLine
              x={selectedSimulatedVol}
              stroke="#111"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{ value: `Scenario ${selectedSimulatedVol}%`, position: 'insideTopRight' }}
            />

            <Line
              type="stepAfter"
              dataKey="tier1"
              stroke="#2563eb"
              strokeWidth={3}
              name="Tier 1"
              dot={false}
            />
            <Line
              type="stepAfter"
              dataKey="tier2"
              stroke="#059669"
              strokeWidth={3}
              name="Tier 2"
              dot={false}
            />
            <ReferenceDot x={selectedSimulatedVol} y={simulatedTier1Fee} r={6} fill="#2563eb" stroke="#1d4ed8" />
            <ReferenceDot x={selectedSimulatedVol} y={simulatedTier2Fee} r={6} fill="#059669" stroke="#047857" />
          </LineChart>
        </ResponsiveContainer>

        <p className="text-sm text-gray-600 mt-4">
          Tier 1 jumps to 5000 bps above threshold. Tier 2 drops to 500 bps above threshold.
        </p>
      </div>

      <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded space-y-5">
        <h3 className="text-2xl font-black text-black">Simulate Volatility Scenario</h3>
        <p className="text-sm text-black">
          Move the slider to change the scenario marker on the chart. On-chain fee is threshold-based,
          so the fee tier flips at the threshold while scenario context updates continuously.
        </p>

        <div>
          <label className="text-sm font-bold text-gray-700 mb-3 block">
            Adjust Volatility: {selectedSimulatedVol}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={selectedSimulatedVol}
            onChange={(event) => setSelectedSimulatedVol(Number(event.target.value))}
            className="w-full accent-black"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-gray-300 p-4 rounded">
            <p className="text-xs font-bold text-black mb-2">REGIME</p>
            <p className="text-xl font-black text-black">{simulatedRegime}</p>
          </div>
          <div className="bg-white border-2 border-gray-300 p-4 rounded">
            <p className="text-xs font-bold text-black mb-2">THRESHOLD DELTA</p>
            <p className="text-xl font-black text-black">{simulatedDelta >= 0 ? `+${simulatedDelta}` : simulatedDelta}%</p>
          </div>
          <div className="bg-white border-2 border-gray-300 p-4 rounded">
            <p className="text-xs font-bold text-black mb-2">SCENARIO VOL</p>
            <p className="text-xl font-black text-black">{selectedSimulatedVol}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-gray-300 p-4 rounded">
            <p className="text-xs font-bold text-black mb-2">SIM VOL</p>
            <p className="text-3xl font-black text-black">{selectedSimulatedVol}%</p>
          </div>
          <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded">
            <p className="text-xs font-bold text-blue-700 mb-2">TIER 1 WOULD PAY</p>
            <p className="text-3xl font-black text-blue-700">{simulatedTier1Fee}</p>
          </div>
          <div className="bg-green-50 border-2 border-green-300 p-4 rounded">
            <p className="text-xs font-bold text-green-700 mb-2">TIER 2 WOULD PAY</p>
            <p className="text-3xl font-black text-green-700">{simulatedTier2Fee}</p>
          </div>
        </div>
      </div>

      <div className="bg-black text-white border-2 border-black p-6 rounded">
        <p className="text-xs font-bold mb-2 text-gray-300">CONTRACT: getDynamicFee()</p>
        <pre className="text-xs font-mono overflow-x-auto">{`if (vol > volatilityThreshold) {
  if (tier == RETAIL) return 5000;
  if (tier == INSTITUTIONAL) return 500;
}
return 1000;`}</pre>
      </div>

      <div className="bg-blue-900 text-white border-2 border-blue-700 p-6 rounded">
        <p className="font-bold mb-2 text-blue-200">Why This Matters for Uniswap</p>
        <p className="text-sm leading-relaxed">
          Fee control is programmable at hook-time, not governance-time. The oracle and tier gates
          make pricing adaptive without replacing Uniswap v4 pool mechanics.
        </p>
      </div>
    </div>
  );
}
