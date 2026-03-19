'use client';

import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { loadDeploymentAddresses } from '@/config/deployments';

type TierOption = 0 | 1 | 2;

const TIER_INFO = {
  0: {
    name: 'Tier 0 (Unverified)',
    icon: '🚫',
    color: 'bg-red-50 border-red-300',
    textColor: 'text-red-700',
    status: 'Access Denied',
    description: 'Unverified users cannot participate in swaps.',
    explanation: 'The hook checks userTier and reverts with AccessDenied()',
  },
  1: {
    name: 'Tier 1 (Retail KYC)',
    icon: '✅',
    color: 'bg-blue-50 border-blue-300',
    textColor: 'text-blue-700',
    status: 'Allowed',
    description: 'Retail users can trade at standard rates.',
    explanation: 'Fee is fetched from getBaseFeeForTier(1)',
  },
  2: {
    name: 'Tier 2 (Institutional)',
    icon: '💎',
    color: 'bg-green-50 border-green-300',
    textColor: 'text-green-700',
    status: 'Allowed',
    description: 'Institutional users get premium rates.',
    explanation: 'Fee is fetched from getBaseFeeForTier(2)',
  },
};

export function TierTester() {
  const [selectedTier, setSelectedTier] = useState<TierOption>(1);
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
  ];

  // Get fees for all tiers
  const { data: tier0Fee } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getBaseFeeForTier',
    args: [0],
    query: { enabled: !!addresses?.hook },
  });

  const { data: tier1Fee } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getBaseFeeForTier',
    args: [1],
    query: { enabled: !!addresses?.hook },
  });

  const { data: tier2Fee } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getBaseFeeForTier',
    args: [2],
    query: { enabled: !!addresses?.hook },
  });

  const tierFees = {
    0: tier0Fee ? Number(tier0Fee) : 0,
    1: tier1Fee ? Number(tier1Fee) : 30,
    2: tier2Fee ? Number(tier2Fee) : 10,
  };

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
        <p className="text-gray-600 font-bold">Loading tier data...</p>
      </div>
    );
  }

  const selectedInfo = TIER_INFO[selectedTier];
  const selectedFee = tierFees[selectedTier];

  return (
    <div className="space-y-6">
      {/* Hero Title */}
      <div className="mb-8">
        <h2 className="text-4xl font-black text-black mb-2">TIER ACCESS CONTROL</h2>
        <p className="text-lg text-gray-700 font-semibold">
          Pick a tier to see what happens when that user tries to swap.
        </p>
      </div>

      {/* Tier Selection Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([0, 1, 2] as TierOption[]).map((tier) => {
          const info = TIER_INFO[tier];
          const fee = tierFees[tier];
          const isSelected = selectedTier === tier;

          return (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`p-6 rounded border-2 transition-all transform hover:scale-105 ${
                isSelected
                  ? `${info.color} border-2 border-black ring-2 ring-black`
                  : 'bg-white border-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="text-4xl mb-2">{info.icon}</div>
              <h3 className="text-lg font-bold text-black mb-2">{info.name}</h3>
              <div className={`text-2xl font-black ${info.textColor} mb-2`}>
                {fee} bps
              </div>
              <p className="text-sm text-gray-600">{info.description}</p>
            </button>
          );
        })}
      </div>

      {/* Outcome Display */}
      <div className={`border-2 p-8 rounded ${selectedInfo.color}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Outcome */}
          <div>
            <p className="text-sm font-bold text-gray-600 mb-2">OUTCOME FOR THIS TIER</p>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-5xl">{selectedInfo.icon}</div>
              <div>
                <h3 className={`text-3xl font-black ${selectedInfo.textColor}`}>
                  {selectedInfo.status}
                </h3>
                <p className={`text-sm font-semibold ${selectedInfo.textColor}`}>
                  {selectedInfo.explanation}
                </p>
              </div>
            </div>

            {selectedTier === 0 && (
              <div className="bg-red-100 border-2 border-red-400 p-4 rounded">
                <p className="text-sm font-bold text-red-700 mb-2">❌ Transaction Fails</p>
                <p className="text-xs font-mono text-red-700 bg-white p-2 rounded">
                  Error: AccessDenied()
                </p>
              </div>
            )}

            {selectedTier === 1 && (
              <div className="bg-blue-100 border-2 border-blue-400 p-4 rounded">
                <p className="text-sm font-bold text-blue-700 mb-2">✅ Swap Executes</p>
                <div className="space-y-2 text-xs font-semibold text-blue-700">
                  <div>
                    <span className="text-gray-700">Swap Fee:</span> {selectedFee} bps
                  </div>
                  <div>
                    <span className="text-gray-700">Retail Cap:</span> ~1,000 tokens
                  </div>
                  <div>
                    <span className="text-gray-700">Status:</span> Standard rate applied
                  </div>
                </div>
              </div>
            )}

            {selectedTier === 2 && (
              <div className="bg-green-100 border-2 border-green-400 p-4 rounded">
                <p className="text-sm font-bold text-green-700 mb-2">💎 Premium Swap</p>
                <div className="space-y-2 text-xs font-semibold text-green-700">
                  <div>
                    <span className="text-gray-700">Swap Fee:</span> {selectedFee} bps
                    <span className="ml-2 bg-green-200 px-2 py-1 rounded text-xs">
                      Lowest rate
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-700">Cap:</span> Unlimited
                  </div>
                  <div>
                    <span className="text-gray-700">Status:</span> Premium rate applied
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Contract Reality */}
          <div>
            <p className="text-sm font-bold text-gray-600 mb-2">CONTRACT: getBaseFeeForTier()</p>
            <div className="bg-black text-white border-2 border-black p-4 rounded font-mono text-xs mb-4">
              <pre>{`function getBaseFeeForTier(
  uint8 tier
) external view returns (uint24) {
  if (tier == 0) return 0;
  if (tier == 1) return 3000;  // 30 bps
  if (tier == 2) return 1000;  // 10 bps
  revert InvalidTier();
}`}</pre>
            </div>

            <p className="text-sm font-bold text-gray-600 mb-2">LIVE FEES FROM CONTRACT</p>
            <div className="space-y-2 bg-white border-2 border-gray-300 p-4 rounded">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Tier 0 (Blocked):</span>
                <span className="font-mono font-bold text-red-700">{tierFees[0]} bps</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Tier 1 (Retail):</span>
                <span className="font-mono font-bold text-blue-700">{tierFees[1]} bps</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Tier 2 (Institutional):</span>
                <span className="font-mono font-bold text-green-700">{tierFees[2]} bps</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Educational Callout */}
      <div className="bg-black text-white border-2 border-black p-6 rounded">
        <p className="font-bold mb-2">📋 Why This Matters</p>
        <p className="text-sm leading-relaxed">
          The hook calls <code className="bg-gray-800 px-1">beforeSwap()</code> for every swap
          attempt. It checks the user's compliance tier and either allows the swap (with
          appropriate fees) or reverts with{' '}
          <code className="bg-gray-800 px-1">AccessDenied()</code>. This is how Uniswap v4
          hooks can embed regulatory requirements directly into the protocol.
        </p>
      </div>

      {/* Tier Modifier Simulation */}
      <TierModifierSimulation tierFees={tierFees} />
    </div>
  );
}

function TierModifierSimulation({ tierFees }: { tierFees: { 0: number; 1: number; 2: number } }) {
  const [simulatedTier, setSimulatedTier] = useState<TierOption>(0);

  return (
    <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded">
      <h3 className="text-2xl font-black text-black mb-4">🔄 TRY IT YOURSELF</h3>
      <p className="text-sm font-semibold text-gray-700 mb-6">
        Simulate upgrading a user's tier and see how their fee changes in real time.
      </p>

      <div className="space-y-4">
        {/* Slider */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-3 block">
            Simulated User Tier:
          </label>
          <div className="flex gap-2 items-center">
            {([0, 1, 2] as TierOption[]).map((tier) => (
              <button
                key={tier}
                onClick={() => setSimulatedTier(tier)}
                className={`px-4 py-2 rounded font-bold text-sm transition-all ${
                  simulatedTier === tier
                    ? 'bg-black text-white border-2 border-black'
                    : 'bg-white text-black border-2 border-gray-300 hover:border-black'
                }`}
              >
                Tier {tier}
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="bg-white border-2 border-gray-300 p-4 rounded">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">SIMULATED TIER</p>
              <p className="text-2xl font-black text-black">{simulatedTier}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">FEE APPLIED</p>
              <p className="text-2xl font-black text-black">{tierFees[simulatedTier]} bps</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">INTERPRETATION</p>
              <p className="text-sm font-semibold text-gray-700">
                {simulatedTier === 0 && '❌ Blocked'}
                {simulatedTier === 1 && '✅ Retail (30bps)'}
                {simulatedTier === 2 && '💎 Institutional (10bps)'}
              </p>
            </div>
          </div>
        </div>

        {/* Code Snippet */}
        <div className="bg-black text-white border-2 border-black p-3 rounded font-mono text-xs">
          <pre>{`// Hook checks tier and applies fee
uint8 userTier = userTier[msg.sender];
if (userTier == 0) revert AccessDenied();

uint24 fee = getBaseFeeForTier(userTier);
// fee is now ${tierFees[simulatedTier]} for tier ${simulatedTier}`}</pre>
        </div>
      </div>
    </div>
  );
}
