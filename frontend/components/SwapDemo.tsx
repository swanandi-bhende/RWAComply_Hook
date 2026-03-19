'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { loadDeploymentAddresses } from '@/config/deployments';
import { ERC20_ABI, EXECUTOR_ABI, HOOK_ABI, ORACLE_ABI } from '@/contracts';
import { calculateDynamicFeeForTier } from '@/lib/hookFee';

type SwapPhase = 'idle' | 'approving' | 'executing' | 'success' | 'error';

export function SwapDemo() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [addresses, setAddresses] = useState<{
    hook: string;
    oracle: string;
    tokenA: string;
    tokenB: string;
    poolManager: string;
    executor?: string;
  } | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const [inputAmount, setInputAmount] = useState('1.0');
  const [phase, setPhase] = useState<SwapPhase>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [swapTxHash, setSwapTxHash] = useState<string | null>(null);

  const [beforeExecutorA, setBeforeExecutorA] = useState<bigint>(BigInt(0));
  const [beforeExecutorB, setBeforeExecutorB] = useState<bigint>(BigInt(0));
  const [afterExecutorA, setAfterExecutorA] = useState<bigint>(BigInt(0));
  const [afterExecutorB, setAfterExecutorB] = useState<bigint>(BigInt(0));

  useEffect(() => {
    const load = async () => {
      try {
        const addr = await loadDeploymentAddresses();
        setAddresses({
          hook: addr.hook,
          oracle: addr.oracle,
          tokenA: addr.tokenA,
          tokenB: addr.tokenB,
          poolManager: addr.poolManager,
          executor: addr.executor,
        });
      } catch (error) {
        setDeploymentError(error instanceof Error ? error.message : 'Failed to load deployment');
      }
    };

    load();
  }, []);

  const { data: userTier } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'userTier',
    args: [address as `0x${string}`],
    query: { enabled: !!addresses?.hook && !!address, refetchInterval: 3000 },
  });

  const { data: volatility } = useReadContract({
    address: addresses?.oracle as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getVolatility',
    query: { enabled: !!addresses?.oracle, refetchInterval: 3000 },
  });

  const { data: threshold } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
    query: { enabled: !!addresses?.hook, refetchInterval: 3000 },
  });

  const { data: poolPaused } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'poolPaused',
    query: { enabled: !!addresses?.hook, refetchInterval: 3000 },
  });

  const { data: retailSwapCap } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
    query: { enabled: !!addresses?.hook, refetchInterval: 3000 },
  });

  const { data: executorTier } = useReadContract({
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'userTier',
    args: [addresses?.executor as `0x${string}`],
    query: { enabled: !!addresses?.hook && !!addresses?.executor, refetchInterval: 3000 },
  });

  const { data: userTokenABalance, refetch: refetchUserTokenABalance } = useReadContract({
    address: addresses?.tokenA as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!addresses?.tokenA && !!address, refetchInterval: 3000 },
  });

  const { data: userTokenBBalance, refetch: refetchUserTokenBBalance } = useReadContract({
    address: addresses?.tokenB as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!addresses?.tokenB && !!address, refetchInterval: 3000 },
  });

  const { data: executorTokenABalance, refetch: refetchExecutorTokenABalance } = useReadContract({
    address: addresses?.tokenA as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [addresses?.executor as `0x${string}`],
    query: { enabled: !!addresses?.tokenA && !!addresses?.executor, refetchInterval: 3000 },
  });

  const { data: executorTokenBBalance, refetch: refetchExecutorTokenBBalance } = useReadContract({
    address: addresses?.tokenB as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [addresses?.executor as `0x${string}`],
    query: { enabled: !!addresses?.tokenB && !!addresses?.executor, refetchInterval: 3000 },
  });

  const tier = Number(userTier ?? BigInt(0));
  const volNum = Number(volatility ?? BigInt(0));
  const thresholdNum = Number(threshold ?? BigInt(5));
  const userFee = calculateDynamicFeeForTier((tier === 1 ? 1 : tier === 2 ? 2 : 0) as 0 | 1 | 2, volNum, thresholdNum);

  const userABalanceNum = Number(formatEther((userTokenABalance as bigint) ?? BigInt(0)));
  const userBBalanceNum = Number(formatEther((userTokenBBalance as bigint) ?? BigInt(0)));
  const executorABalanceNum = Number(formatEther((executorTokenABalance as bigint) ?? BigInt(0)));
  const executorBBalanceNum = Number(formatEther((executorTokenBBalance as bigint) ?? BigInt(0)));
  const retailCapNum = Number(formatEther((retailSwapCap as bigint) ?? BigInt(0)));

  const estimatedOut = useMemo(() => {
    const amount = Number(inputAmount || '0');
    if (Number.isNaN(amount) || amount <= 0) return 0;
    const feeRate = userFee / 10000;
    return Math.max(amount * (1 - feeRate), 0);
  }, [inputAmount, userFee]);

  const captureBeforeBalances = () => {
    setBeforeExecutorA((executorTokenABalance as bigint) ?? BigInt(0));
    setBeforeExecutorB((executorTokenBBalance as bigint) ?? BigInt(0));
  };

  const captureAfterBalances = async () => {
    const [a, b] = await Promise.all([refetchExecutorTokenABalance(), refetchExecutorTokenBBalance()]);
    setAfterExecutorA((a.data as bigint) ?? BigInt(0));
    setAfterExecutorB((b.data as bigint) ?? BigInt(0));
  };

  const handleExecuteSwap = async () => {
    if (!address) {
      setErrorMessage('Connect wallet first.');
      setPhase('error');
      return;
    }

    if (!addresses?.executor) {
      setErrorMessage('Missing PoolExecutor address in deployment.');
      setPhase('error');
      return;
    }

    if (Boolean(poolPaused)) {
      setErrorMessage('Pool is paused. Swaps are disabled by admin control.');
      setPhase('error');
      return;
    }

    const amount = Number(inputAmount || '0');
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Enter a valid positive amount.');
      setPhase('error');
      return;
    }

    if (!publicClient) {
      setErrorMessage('Public client unavailable.');
      setPhase('error');
      return;
    }

    setErrorMessage('');
    setPhase('approving');

    try {
      captureBeforeBalances();

      const approveHash = await writeContractAsync({
        address: addresses.tokenA as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [addresses.poolManager as `0x${string}`, parseEther(inputAmount)],
      });
      setApprovalTxHash(approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setPhase('executing');

      const executeHash = await writeContractAsync({
        address: addresses.executor as `0x${string}`,
        abi: EXECUTOR_ABI,
        functionName: 'execute',
      });
      setSwapTxHash(executeHash);
      await publicClient.waitForTransactionReceipt({ hash: executeHash });

      await Promise.all([
        refetchUserTokenABalance(),
        refetchUserTokenBBalance(),
        captureAfterBalances(),
      ]);

      setPhase('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swap execution failed';
      setErrorMessage(message);
      setPhase('error');
    }
  };

  const reset = () => {
    setPhase('idle');
    setErrorMessage('');
    setApprovalTxHash(null);
    setSwapTxHash(null);
    setBeforeExecutorA(BigInt(0));
    setBeforeExecutorB(BigInt(0));
    setAfterExecutorA(BigInt(0));
    setAfterExecutorB(BigInt(0));
  };

  const tierLabel = tier === 2 ? 'Tier 2 (Institutional)' : tier === 1 ? 'Tier 1 (Retail)' : 'Tier 0 (Unverified)';
  const executorTierNum = Number(executorTier ?? BigInt(0));

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
        <p className="text-gray-600 font-bold">Loading swap context...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-3">Live Swap Demo</h2>
        <p className="text-gray-600">
          This flow runs real transactions: user approval + canonical executor swap. The hook is
          triggered during executor swap and emits compliance events.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="border-2 border-gray-800 rounded-lg p-6 bg-gray-50 space-y-5">
            <h3 className="font-bold text-lg text-gray-900">Before Swap</h3>

            <div className="space-y-2 text-sm border-b border-gray-300 pb-4">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Pool status</span>
                <span className={Boolean(poolPaused) ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>
                  {Boolean(poolPaused) ? 'Paused' : 'Active'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Current price</span>
                <span className="text-gray-700">~1 Token A : 1 Token B</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Hook swap actor</span>
                <span className="text-gray-700 font-mono">Executor tier {executorTierNum}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm border-b border-gray-300 pb-4">
              <p className="font-semibold text-gray-700">Your wallet (read-only context)</p>
              <div className="flex justify-between">
                <span className="text-gray-600">Tier</span>
                <span className="font-bold">{tierLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Volatility</span>
                <span className="font-mono">{volNum}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Applicable fee</span>
                <span className="font-mono">{userFee} bps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Token A</span>
                <span className="font-mono">{userABalanceNum.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Token B</span>
                <span className="font-mono">{userBBalanceNum.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Retail cap</span>
                <span className="font-mono">{retailCapNum.toFixed(4)} tokens</span>
              </div>
            </div>

            <div className="space-y-2 text-sm border-b border-gray-300 pb-4">
              <p className="font-semibold text-gray-700">Executor balances (actual swap actor)</p>
              <div className="flex justify-between">
                <span className="text-gray-600">Executor Token A</span>
                <span className="font-mono">{executorABalanceNum.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Executor Token B</span>
                <span className="font-mono">{executorBBalanceNum.toFixed(4)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Input amount (approval amount)</label>
                <input
                  type="number"
                  value={inputAmount}
                  min="0"
                  step="0.01"
                  onChange={(event) => setInputAmount(event.target.value)}
                  disabled={phase === 'approving' || phase === 'executing'}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg font-mono"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Estimated output at displayed fee: {estimatedOut.toFixed(4)} Token B
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleExecuteSwap}
                  disabled={phase === 'approving' || phase === 'executing' || !address}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
                >
                  {phase === 'approving'
                    ? 'Approving...'
                    : phase === 'executing'
                      ? 'Executing swap...'
                      : 'Run Real Swap Flow'}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="px-6 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border-2 border-gray-800 rounded-lg p-6 bg-white">
            <h3 className="font-bold text-lg mb-4">Transaction Breakdown</h3>
            <div className="space-y-3 text-sm">
              <StepRow
                title="1) Approval"
                description="approve(tokenA -> poolManager)"
                done={!!approvalTxHash}
                running={phase === 'approving'}
              />
              <StepRow
                title="2) beforeSwap hook"
                description="Triggered inside executor.swap()"
                done={phase === 'success' || phase === 'executing'}
                running={phase === 'executing'}
              />
              <StepRow
                title="3) Swap execution"
                description="executor.execute() calls PoolManager.swap"
                done={!!swapTxHash}
                running={phase === 'executing'}
              />
              <StepRow
                title="4) afterSwap hook"
                description="Compliance event emitted"
                done={phase === 'success'}
                running={false}
              />
            </div>
          </div>

          {phase === 'success' && (
            <div className="border-2 border-green-400 rounded-lg p-6 bg-green-50 space-y-3">
              <h3 className="font-bold text-lg text-green-800">Swap Flow Complete</h3>

              {approvalTxHash && (
                <div className="bg-white p-3 rounded border border-green-300">
                  <p className="text-xs text-gray-600 mb-1">Approval Tx Hash</p>
                  <p className="font-mono text-xs break-all text-blue-700">{approvalTxHash}</p>
                </div>
              )}

              {swapTxHash && (
                <div className="bg-white p-3 rounded border border-green-300">
                  <p className="text-xs text-gray-600 mb-1">Swap Tx Hash</p>
                  <p className="font-mono text-xs break-all text-blue-700">{swapTxHash}</p>
                </div>
              )}

              <div className="bg-white p-3 rounded border border-green-300">
                <p className="text-xs text-gray-600 mb-1">Executor Balance Delta</p>
                <div className="text-xs font-mono space-y-1">
                  <p>
                    Token A: {(Number(formatEther(beforeExecutorA)) - Number(formatEther(afterExecutorA))).toFixed(6)}
                  </p>
                  <p>
                    Token B: {(Number(formatEther(afterExecutorB)) - Number(formatEther(beforeExecutorB))).toFixed(6)}
                  </p>
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-green-300">
                <p className="text-xs text-gray-600 mb-1">Hook Events (expected)</p>
                <div className="text-xs font-mono space-y-1">
                  <p>BeforeSwapCalled(executor, tier={executorTierNum}, fee=...)</p>
                  <p>AfterSwapCalled(executor)</p>
                </div>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="border-2 border-red-400 rounded-lg p-6 bg-red-50">
              <h3 className="font-bold text-lg text-red-800 mb-2">Execution Error</h3>
              <p className="text-sm text-red-700 break-words">{errorMessage || 'Transaction failed'}</p>
              <p className="text-xs text-red-700 mt-3">
                Tier-0 failures are expected when swap actor tier is unverified, demonstrating
                hook-level compliance enforcement.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-6">
        <p className="font-bold mb-2 text-blue-900">Why This Matters for Uniswap</p>
        <p className="text-sm text-blue-900">
          This page now runs real on-chain transactions end-to-end. Admin updates from Page 5
          (pause state, caps, threshold, oracle volatility) immediately affect this flow through live
          reads.
        </p>
      </div>
    </div>
  );
}

function StepRow({
  title,
  description,
  done,
  running,
}: {
  title: string;
  description: string;
  done: boolean;
  running: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border-2 ${
        done ? 'border-green-400 bg-green-50' : running ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-800">{title}</p>
        <p className="text-xs font-bold">{done ? 'DONE' : running ? 'RUNNING' : 'PENDING'}</p>
      </div>
      <p className="text-xs text-gray-600 mt-1">{description}</p>
    </div>
  );
}
