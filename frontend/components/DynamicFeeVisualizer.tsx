'use client';

import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { loadDeploymentAddresses } from '@/config/deployments';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface FeeDataPoint {
  volatility: number;
  tier1: number;
  tier2: number;
}

export function DynamicFeeVisualizer() {
  const [selectedSimulatedVol, setSelectedSimulatedVol] = useState<number>(5);
  const [addresses, setAddresses] = useState<any>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  // Load addresses
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
    'function getBaseFeeForTier(uint8 tier) external view returns (uint24)',
    'function volatilityThreshold() external view returns (uint256)',
  ];

  const ORACLE_ABI = ['function getVolatility() external view returns (uint256)'];

  // Get base fees
  const { data: tier1BaseFee } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getBaseFeeForTier',
    args: [1],
    query: { enabled: !!addresses?.hook },
  });

  const { data: tier2BaseFee } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getBaseFeeForTier',
    args: [2],
    query: { enabled: !!addresses?.hook },
  });

  // Get volatility threshold
  const { data: volThreshold } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
    args: [],
    query: { enabled: !!addresses?.hook },
  });

  // Get current volatility
  const { data: currentVol } = useReadContract({
    address: addresses?.oracle as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getVolatility',
    args: [],
    query: { enabled: !!addresses?.oracle },
  });

  // Calculate fees based on volatility
  const calculateFee = (baseFee: number, volatility: number, threshold: number): number => {
    if (volatility <= threshold) {
      return baseFee;
    }
    // Dynamic fee increases 10 bps for every 1% above threshold, up to 2x base fee
    const excessVolatility = volatility - threshold;
    const increase = Math.min(excessVolatility * 10, baseFee);
    return baseFee + increase;
  };

  // Generate chart data points
  const generateChartData = (): FeeDataPoint[] => {
    const tier1Base = tier1BaseFee ? Number(tier1BaseFee) : 3000;
    const tier2Base = tier2BaseFee ? Number(tier2BaseFee) : 1000;
    const threshold = volThreshold ? Number(volThreshold) : 5;

    const data: FeeDataPoint[] = [];
    for (let vol = 0; vol <= 100; vol += 5) {
      data.push({
        volatility: vol,
        tier1: calculateFee(tier1Base, vol, threshold),
        tier2: calculateFee(tier2Base, vol, threshold),
      });
    }
    return data;
  };

  const chartData = generateChartData();
  const tier1BaseFeeNum = tier1BaseFee ? Number(tier1BaseFee) : 3000;
  const tier2BaseFeeNum = tier2BaseFee ? Number(tier2BaseFee) : 1000;
  const thresholdNum = volThreshold ? Number(volThreshold) : 5;
  const currentVolNum = currentVol ? Number(currentVol) : 0;

  // Calculate current fees
  const currentTier1Fee = calculateFee(tier1BaseFeeNum, currentVolNum, thresholdNum);
  const currentTier2Fee = calculateFee(tier2BaseFeeNum, currentVolNum, thresholdNum);

  // Calculate simulated fees
  const simulatedTier1Fee = calculateFee(tier1BaseFeeNum, selectedSimulatedVol, thresholdNum);
  const simulatedTier2Fee = calculateFee(tier2BaseFeeNum, selectedSimulatedVol, thresholdNum);

  if (deploymentError) {
    return (
      <div className="bg-red-50 border-2 border-red-600 p-6 rounded">
        <p className="text-red-600 font-bold mb-2">⚠️ Deployment Error</p>
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
      {/* Title */}
      <div className="mb-8">
        <h2 className="text-4xl font-black text-black mb-2">DYNAMIC FEE SYSTEM</h2>
        <p className="text-lg text-gray-700 font-semibold">
          See how fees adjust with market volatility for each compliance tier.
        </p>
      </div>

      {/* Live Metrics Top Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-gray-300 p-4 rounded">
          <p className="text-xs font-bold text-gray-600 mb-2">CURRENT VOLATILITY</p>
          <p className="text-3xl font-black text-black">{currentVolNum}%</p>
          <p className="text-xs text-gray-600 mt-2">
            {currentVolNum > thresholdNum ? '📈 Above threshold' : '📊 Below threshold'}
          </p>
        </div>

        <div className="bg-white border-2 border-gray-300 p-4 rounded">
          <p className="text-xs font-bold text-gray-600 mb-2">THRESHOLD</p>
          <p className="text-3xl font-black text-black">{thresholdNum}%</p>
          <p className="text-xs text-gray-600 mt-2">Dynamic fees above this</p>
        </div>

        <div className="bg-white border-2 border-blue-300 p-4 rounded">
          <p className="text-xs font-bold text-blue-700 mb-2">TIER 1 (RETAIL) NOW</p>
          <p className="text-3xl font-black text-blue-700">{currentTier1Fee}</p>
          <p className="text-xs text-blue-600 mt-2">bps</p>
        </div>

        <div className="bg-white border-2 border-green-300 p-4 rounded">
          <p className="text-xs font-bold text-green-700 mb-2">TIER 2 (INST.) NOW</p>
          <p className="text-3xl font-black text-green-700">{currentTier2Fee}</p>
          <p className="text-xs text-green-600 mt-2">bps</p>
        </div>
      </div>

      {/* Interactive Chart */}
      <div className="bg-white border-2 border-gray-300 p-6 rounded">
        <h3 className="text-2xl font-black text-black mb-4">FEE vs VOLATILITY CURVES</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="volatility"
              label={{ value: 'Volatility (%)', position: 'insideBottomRight', offset: -10 }}
            />
            <YAxis label={{ value: 'Fee (bps)', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value) => `${value} bps`} />
            <Legend />

            {/* Volatility threshold line */}
            <ReferenceLine
              x={thresholdNum}
              stroke="#888"
              strokeDasharray="5 5"
              label={{ value: `Threshold: ${thresholdNum}%`, position: 'top' }}
            />

            {/* Current volatility line */}
            <ReferenceLine
              x={currentVolNum}
              stroke="#ff0000"
              strokeWidth={2}
              label={{ value: `Current: ${currentVolNum}%`, position: 'top' as const }}
            />

            {/* Tier 1 curve */}
            <Line
              type="monotone"
              dataKey="tier1"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Tier 1 (Retail)"
              dot={false}
            />

            {/* Tier 2 curve */}
            <Line
              type="monotone"
              dataKey="tier2"
              stroke="#10b981"
              strokeWidth={3}
              name="Tier 2 (Institutional)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>

        <p className="text-sm text-gray-600 mt-4 font-semibold">
          📊 <span className="font-bold">Red line</span> shows current market volatility.{' '}
          <span className="font-bold">Dashed line</span> shows fee threshold.
        </p>
      </div>

      {/* Simulated Scenario */}
      <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded space-y-6">
        <h3 className="text-2xl font-black text-black">🎚️ SIMULATE VOLATILITY SCENARIO</h3>

        {/* Volatility Slider */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-3 block">
            Adjust Volatility: {selectedSimulatedVol}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={selectedSimulatedVol}
            onChange={(e) => setSelectedSimulatedVol(Number(e.target.value))}
            className="w-full accent-black"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            <span>Low (0%)</span>
            <span>High (100%)</span>
          </div>
        </div>

        {/* Simulated Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-2 border-gray-300 p-4 rounded">
            <p className="text-xs font-bold text-gray-600 mb-2">SIMULATED VOLATILITY</p>
            <p className="text-3xl font-black text-black">{selectedSimulatedVol}%</p>
            <p className="text-xs text-gray-600 mt-2">
              {selectedSimulatedVol > thresholdNum
                ? '🔴 Dynamic fees would apply'
                : '🟢 Base fees would apply'}
            </p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded">
            <p className="text-xs font-bold text-blue-700 mb-2">TIER 1 WOULD PAY</p>
            <p className="text-3xl font-black text-blue-700">{simulatedTier1Fee}</p>
            <p className="text-xs text-blue-600 mt-2">
              {simulatedTier1Fee > tier1BaseFeeNum
                ? `+${simulatedTier1Fee - tier1BaseFeeNum} bps extra`
                : 'Base rate'}
            </p>
          </div>

          <div className="bg-green-50 border-2 border-green-300 p-4 rounded">
            <p className="text-xs font-bold text-green-700 mb-2">TIER 2 WOULD PAY</p>
            <p className="text-3xl font-black text-green-700">{simulatedTier2Fee}</p>
            <p className="text-xs text-green-600 mt-2">
              {simulatedTier2Fee > tier2BaseFeeNum
                ? `+${simulatedTier2Fee - tier2BaseFeeNum} bps extra`
                : 'Base rate'}
            </p>
          </div>
        </div>

        {/* Fee Savings Display */}
        <div className="bg-white border-2 border-gray-300 p-4 rounded">
          <p className="text-sm font-bold text-gray-700 mb-3">TIER ADVANTAGE AT {selectedSimulatedVol}% VOL</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Fee Difference:</span>
              <span className="text-lg font-black text-green-700">
                {simulatedTier1Fee - simulatedTier2Fee} bps
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded h-3 overflow-hidden border border-gray-300">
              <div
                className="bg-green-500 h-full"
                style={{
                  width: `${((simulatedTier1Fee - simulatedTier2Fee) / simulatedTier1Fee) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-600">
              Tier 2 users save{' '}
              <span className="font-bold">
                {(
                  ((simulatedTier1Fee - simulatedTier2Fee) / simulatedTier1Fee) *
                  100
                ).toFixed(1)}
                %
              </span>{' '}
              on fees vs Tier 1
            </p>
          </div>
        </div>
      </div>

      {/* Static Fee Pool Comparison */}
      <div className="bg-black text-white border-2 border-black p-6 rounded">
        <h3 className="text-2xl font-black mb-4">📊 COMPARISON: DYNAMIC vs STATIC FEES</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Static Pool */}
          <div className="bg-gray-900 border border-gray-700 p-4 rounded">
            <h4 className="font-bold mb-3">Standard Uniswap v4 Pool</h4>
            <p className="text-sm text-gray-300 mb-4">
              <code className="bg-black px-1">fee: 3000 bps (0.30%)</code>
            </p>
            <div className="space-y-2 text-xs">
              <div>At low volatility: 3000 bps (waste of capital)</div>
              <div>At high volatility: 3000 bps (not enough protection)</div>
              <div>All fees equal: No tier advantage</div>
            </div>
          </div>

          {/* Dynamic Pool */}
          <div className="bg-green-900 border border-green-700 p-4 rounded">
            <h4 className="font-bold mb-3 text-green-300">RWA Compliance Hook</h4>
            <p className="text-sm text-green-300 mb-4">
              <code className="bg-black px-1">fee: Dynamic via beforeSwap()</code>
            </p>
            <div className="space-y-2 text-xs text-green-300">
              <div>✅ Low volatility: Base fees</div>
              <div>✅ High volatility: Higher fees (automatic)</div>
              <div>✅ Tiers benefit: Institutional saves {((tier1BaseFeeNum - tier2BaseFeeNum) / tier1BaseFeeNum * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Code Explanation */}
      <div className="bg-black text-white border-2 border-black p-6 rounded">
        <p className="text-xs font-bold mb-2 text-gray-300">CONTRACT: Fee Calculation Logic</p>
        <pre className="text-xs font-mono overflow-x-auto">{`if (volatility <= threshold) {
  // Use base fee
  fee = getBaseFeeForTier(userTier);
} else {
  // Apply dynamic fee
  uint256 excess = volatility - threshold;
  uint256 increase = min(excess * 10, baseFee); // 10 bps per 1%
  fee = baseFee + increase;
}

// Result: Fee responds to market conditions
// while respecting compliance tier benefits`}</pre>
      </div>

      {/* Why This Matters Callout */}
      <div className="bg-blue-900 text-white border-2 border-blue-700 p-6 rounded">
        <p className="font-bold mb-2 text-blue-200">💡 Why This Matters for Uniswap</p>
        <p className="text-sm leading-relaxed">
          Hooks enable <span className="font-bold">oracle-integrated</span> liquidity provision. Instead of static 
          fees set by governance, pools can respond to market conditions in real time. This page proves your hook can 
          read volatility from an oracle and automatically adjust fees — a capability that unlocks institutional 
          RWA trading at scale. Institutions don't want to overpay in calm markets or underpay in volatile ones.
        </p>
      </div>
    </div>
  );
}
