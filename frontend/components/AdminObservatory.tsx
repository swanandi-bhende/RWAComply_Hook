'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { parseEther } from 'viem';
import { loadDeploymentAddresses } from '@/config/deployments';
import { HOOK_ABI, ORACLE_ABI } from '@/contracts';
import { calculateDynamicFeeForTier } from '@/lib/hookFee';

type LogStatus = 'pending' | 'success' | 'failed';

type AdminLog = {
  id: string;
  action: string;
  value: string;
  status: LogStatus;
  hash?: string;
  error?: string;
  timestamp: number;
};

export function AdminObservatory() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const [addresses, setAddresses] = useState<{ hook: string; oracle: string } | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);

  const [newThreshold, setNewThreshold] = useState('5');
  const [newRetailCap, setNewRetailCap] = useState('1.0');
  const [newOracleAddress, setNewOracleAddress] = useState('');
  const [newVolatility, setNewVolatility] = useState('3');
  const [targetTierAddress, setTargetTierAddress] = useState('');
  const [targetTier, setTargetTier] = useState<'0' | '1' | '2'>('1');

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

  useEffect(() => {
    if (address && targetTierAddress === '') {
      setTargetTierAddress(address);
    }
  }, [address, targetTierAddress]);

  const { data: hookOwner, refetch: refetchOwner } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'owner',
    query: { enabled: !!addresses?.hook, refetchInterval: 3000 },
  });

  const { data: oracleAddress, refetch: refetchOracleAddress } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'oracle',
    query: { enabled: !!addresses?.hook, refetchInterval: 3000 },
  });

  const { data: threshold, refetch: refetchThreshold } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
    query: { enabled: !!addresses?.hook, refetchInterval: 3000 },
  });

  const { data: retailCap, refetch: refetchRetailCap } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
    query: { enabled: !!addresses?.hook, refetchInterval: 3000 },
  });

  const { data: poolPaused, refetch: refetchPoolPaused } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'poolPaused',
    query: { enabled: !!addresses?.hook, refetchInterval: 3000 },
  });

  const { data: volatility, refetch: refetchVolatility } = useReadContract({
    address: addresses?.oracle as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getVolatility',
    query: { enabled: !!addresses?.oracle, refetchInterval: 3000 },
  });

  const { data: oracleOwner, refetch: refetchOracleOwner } = useReadContract({
    address: addresses?.oracle as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'owner',
    query: { enabled: !!addresses?.oracle, refetchInterval: 3000 },
  });

  const thresholdNum = Number(threshold ?? BigInt(5));
  const retailCapNum = Number(retailCap ?? BigInt(0)) / 1e18;
  const poolPausedBool = Boolean(poolPaused);
  const volatilityNum = Number(volatility ?? BigInt(0));

  const tier1Fee = useMemo(
    () => calculateDynamicFeeForTier(1, volatilityNum, thresholdNum),
    [volatilityNum, thresholdNum]
  );
  const tier2Fee = useMemo(
    () => calculateDynamicFeeForTier(2, volatilityNum, thresholdNum),
    [volatilityNum, thresholdNum]
  );

  const isHookOwner =
    !!address && typeof hookOwner === 'string' && address.toLowerCase() === hookOwner.toLowerCase();
  const isOracleOwner =
    !!address && typeof oracleOwner === 'string' && address.toLowerCase() === oracleOwner.toLowerCase();

  const shortAddress = (value: unknown) => {
    if (!value || typeof value !== 'string') return 'Loading...';
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  const addLog = (entry: Omit<AdminLog, 'id' | 'timestamp'>) => {
    const item: AdminLog = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
    };
    setLogs((current) => [item, ...current]);
    return item.id;
  };

  const patchLog = (id: string, patch: Partial<AdminLog>) => {
    setLogs((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const refreshAll = async () => {
    await Promise.all([
      refetchOwner(),
      refetchOracleAddress(),
      refetchThreshold(),
      refetchRetailCap(),
      refetchPoolPaused(),
      refetchVolatility(),
      refetchOracleOwner(),
      queryClient.invalidateQueries({ queryKey: ['readContract'] }),
    ]);
  };

  const submitAction = async ({
    action,
    value,
    request,
  }: {
    action: string;
    value: string;
    request: Parameters<typeof writeContractAsync>[0];
  }) => {
    if (!publicClient) {
      addLog({ action, value, status: 'failed', error: 'Public client unavailable.' });
      return;
    }

    const logId = addLog({ action, value, status: 'pending' });

    try {
      const hash = await writeContractAsync(request);
      patchLog(logId, { hash });

      await publicClient.waitForTransactionReceipt({ hash });
      patchLog(logId, { status: 'success' });

      await refreshAll();
    } catch (error) {
      patchLog(logId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Transaction failed',
      });
    }
  };

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
        <p className="text-gray-600 font-bold">Loading admin state...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-3">Admin Observatory</h2>
        <p className="text-gray-600">
          {isHookOwner
            ? 'You are hook owner: full control enabled.'
            : 'View mode: connect with owner wallet for write controls.'}
        </p>
      </div>

      <div className={`border-2 rounded-lg p-6 ${isHookOwner ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-lg">Owner Controls</p>
          <span className={`text-xs font-bold px-3 py-1 rounded ${isHookOwner ? 'bg-green-700 text-white' : 'bg-gray-300 text-gray-700'}`}>
            {isHookOwner ? 'WRITE ENABLED' : 'READ ONLY'}
          </span>
        </div>
        <p className="text-sm text-gray-700">Hook owner: {shortAddress(hookOwner)}</p>
        <p className="text-sm text-gray-700">Oracle owner: {shortAddress(oracleOwner)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard label="HOOK OWNER" value={shortAddress(hookOwner)} />
        <StatCard label="ORACLE ADDRESS" value={shortAddress(oracleAddress)} />
        <StatCard label="VOL THRESHOLD" value={`${thresholdNum}%`} />
        <StatCard label="RETAIL CAP" value={`${retailCapNum.toFixed(4)} tokens`} />
        <StatCard label="POOL STATUS" value={poolPausedBool ? 'Paused' : 'Active'} />
        <StatCard
          label="EFFECTIVE FEES"
          value={`T1: ${tier1Fee} bps | T2: ${tier2Fee} bps`}
          subtext={`vol=${volatilityNum}%`}
        />
      </div>

      {isHookOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border-2 border-gray-300 rounded-lg p-6 bg-white space-y-4">
            <p className="font-bold text-lg">Hook Parameters</p>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Set volatility threshold (%)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newThreshold}
                  onChange={(event) => setNewThreshold(event.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded"
                />
                <button
                  type="button"
                  onClick={() => {
                    void submitAction({
                      action: 'setVolatilityThreshold',
                      value: newThreshold,
                      request: {
                        address: addresses.hook as `0x${string}`,
                        abi: HOOK_ABI,
                        functionName: 'setVolatilityThreshold',
                        args: [BigInt(Math.max(0, Math.floor(Number(newThreshold || '0'))))],
                      },
                    });
                  }}
                  className="px-4 py-2 bg-black text-white rounded font-bold"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Set retail cap (tokens)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newRetailCap}
                  onChange={(event) => setNewRetailCap(event.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded"
                />
                <button
                  type="button"
                  onClick={() => {
                    void submitAction({
                      action: 'setRetailSwapCap',
                      value: newRetailCap,
                      request: {
                        address: addresses.hook as `0x${string}`,
                        abi: HOOK_ABI,
                        functionName: 'setRetailSwapCap',
                        args: [parseEther(newRetailCap || '0')],
                      },
                    });
                  }}
                  className="px-4 py-2 bg-black text-white rounded font-bold"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Set hook oracle address</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOracleAddress}
                  onChange={(event) => setNewOracleAddress(event.target.value)}
                  placeholder="0x..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    void submitAction({
                      action: 'setOracle',
                      value: newOracleAddress,
                      request: {
                        address: addresses.hook as `0x${string}`,
                        abi: HOOK_ABI,
                        functionName: 'setOracle',
                        args: [newOracleAddress as `0x${string}`],
                      },
                    });
                  }}
                  className="px-4 py-2 bg-black text-white rounded font-bold"
                >
                  Apply
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void submitAction({
                  action: 'setPoolPaused',
                  value: poolPausedBool ? 'false' : 'true',
                  request: {
                    address: addresses.hook as `0x${string}`,
                    abi: HOOK_ABI,
                    functionName: 'setPoolPaused',
                    args: [!poolPausedBool],
                  },
                });
              }}
              className={`w-full px-4 py-2 rounded font-bold text-white ${
                poolPausedBool ? 'bg-green-700 hover:bg-green-800' : 'bg-red-700 hover:bg-red-800'
              }`}
            >
              {poolPausedBool ? 'Resume Pool' : 'Pause Pool'}
            </button>
          </div>

          <div className="border-2 border-gray-300 rounded-lg p-6 bg-white space-y-4">
            <p className="font-bold text-lg">Tier Management (Demo Utility)</p>
            <p className="text-sm text-gray-600">
              Use this to test cross-page behavior for a target wallet (Page 1 status, Page 2 tier
              outcomes, Page 4 context).
            </p>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Target address</label>
              <input
                type="text"
                value={targetTierAddress}
                onChange={(event) => setTargetTierAddress(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Target tier</label>
              <select
                value={targetTier}
                onChange={(event) => setTargetTier(event.target.value as '0' | '1' | '2')}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="0">Tier 0</option>
                <option value="1">Tier 1</option>
                <option value="2">Tier 2</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                void submitAction({
                  action: 'setTier',
                  value: `${targetTierAddress} => ${targetTier}`,
                  request: {
                    address: addresses.hook as `0x${string}`,
                    abi: HOOK_ABI,
                    functionName: 'setTier',
                    args: [targetTierAddress as `0x${string}`, Number(targetTier)],
                  },
                });
              }}
              className="w-full px-4 py-2 rounded font-bold text-white bg-black hover:bg-gray-800"
            >
              Apply Tier
            </button>
          </div>
        </div>
      )}

      {isOracleOwner && (
        <div className="border-2 border-indigo-300 rounded-lg p-6 bg-indigo-50 space-y-4">
          <p className="font-bold text-lg text-indigo-900">Oracle Control</p>
          <p className="text-sm text-indigo-800">
            Updating oracle volatility immediately changes effective fees on Pages 2, 3, and 4.
          </p>

          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              max="100"
              value={newVolatility}
              onChange={(event) => setNewVolatility(event.target.value)}
              className="flex-1 px-3 py-2 border border-indigo-300 rounded"
            />
            <button
              type="button"
              onClick={() => {
                void submitAction({
                  action: 'setVolatility',
                  value: newVolatility,
                  request: {
                    address: addresses.oracle as `0x${string}`,
                    abi: ORACLE_ABI,
                    functionName: 'setVolatility',
                    args: [BigInt(Math.max(0, Math.floor(Number(newVolatility || '0'))))],
                  },
                });
              }}
              className="px-4 py-2 bg-indigo-700 text-white rounded font-bold"
            >
              Set Volatility
            </button>
          </div>
        </div>
      )}

      <div className="bg-black text-white border-2 border-black rounded-lg p-6">
        <h3 className="text-2xl font-black mb-4">Security Highlights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <pre className="bg-gray-900 p-3 rounded overflow-x-auto">{`function setOracle(address newOracle) external onlyOwner {
  if (newOracle == address(0)) revert ZeroAddress();
  oracle = newOracle;
}`}</pre>
          <pre className="bg-gray-900 p-3 rounded overflow-x-auto">{`modifier onlyOwner() {
  require(msg.sender == owner());
  _;
}`}</pre>
        </div>
      </div>

      <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
        <h3 className="font-bold text-lg mb-4">Admin Transaction Log</h3>

        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No admin actions yet.</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {logs.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded border-l-4 ${
                  entry.status === 'success'
                    ? 'bg-green-50 border-green-500'
                    : entry.status === 'failed'
                      ? 'bg-red-50 border-red-500'
                      : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <p className="font-semibold text-sm text-gray-900">{entry.action}</p>
                <p className="text-xs text-gray-600 mt-1">value: {entry.value}</p>
                {entry.hash && <p className="text-xs text-blue-700 font-mono mt-1 break-all">{entry.hash}</p>}
                {entry.error && <p className="text-xs text-red-700 mt-1 wrap-break-word">{entry.error}</p>}
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(entry.timestamp).toLocaleTimeString()} • {entry.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-green-100 border-2 border-green-400 rounded-lg p-6">
        <p className="font-bold mb-2 text-green-900">Why This Matters for Uniswap</p>
        <p className="text-sm text-green-900">
          This page exercises actual governance hooks: owner-gated updates, oracle controls, and
          event-backed state transitions. Every successful write here propagates to pricing and
          access behavior across the other pages.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="border-2 border-gray-300 rounded-lg p-5 bg-white">
      <p className="text-xs font-bold text-gray-500 mb-2">{label}</p>
      <p className="text-2xl font-black text-gray-900 wrap-break-word">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-2">{subtext}</p>}
    </div>
  );
}
