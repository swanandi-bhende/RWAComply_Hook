'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';
import { anvil } from 'wagmi/chains';
import { formatUnits, parseAbi, type Hex } from 'viem';
import { loadDeploymentAddresses } from '@/config/deployments';
import { ERC20_ABI, EXECUTOR_ABI, HOOK_ABI, ORACLE_ABI, POOL_FEE, TICK_SPACING } from '@/contracts';
import { calculateDynamicFeeForTier } from '@/lib/hookFee';
import {
  PAUSED_POOL_MESSAGE,
  UNREGISTERED_WALLET_MESSAGE,
  routerPhaseLabel,
  routerRejectionMessage,
} from '@/lib/product/purchaseFlow';
import { usdcPurchasePlan } from '@/lib/product/usdcPurchase';
import { useTransactions } from '@/app/TransactionContext';
import { TransactionHistory } from './TransactionHistory';

type SwapPhase = 'idle' | 'approving' | 'registering' | 'swapping' | 'success' | 'rejected';

const ZERO_ALLOCATION = `0x${'0'.repeat(64)}` as Hex;
const LEDGER_READ_ABI = parseAbi([
  'function allocationIdByWallet(address wallet) view returns (bytes32)',
  'function remaining(address wallet, bytes32 groupId, uint256 periodId) view returns (uint256)',
]);
const HOOK_GROUP_ABI = parseAbi([
  'function allocationGroupId() view returns (bytes32)',
  'function allocationPeriodId() view returns (uint256)',
]);

const LIVE_REFETCH_MS = 1000;

function formatSwapError(raw: string): string {
  const lowered = raw.toLowerCase();

  if (lowered.includes('rpc endpoint returned too many errors') || lowered.includes('request not available')) {
    return 'Local RPC is not reachable. Start Anvil on http://127.0.0.1:8545, run bash script/run_canonical_demo.sh, then refresh the page.';
  }

  if (lowered.includes('accessdenied')) {
    return 'Swap blocked by compliance tier. Set the swap actor tier to 1 or 2, then retry.';
  }

  const rejection = routerRejectionMessage(raw);
  if (rejection) return rejection;

  if (lowered.includes('insufficient funds')) {
    return 'Insufficient gas balance in connected wallet. Fund the wallet with local ETH and retry.';
  }

  return raw;
}

export function SwapDemo() {
  const { address } = useAccount();
  const walletChainId = useChainId();
  const { switchChain, isPending: switchingChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: anvil.id });
  const { writeContractAsync } = useWriteContract();
  const { addTransaction } = useTransactions();

  const [addresses, setAddresses] = useState<{
    hook: string;
    oracle: string;
    tokenA: string;
    tokenB: string;
    poolManager: string;
    executor: string;
    ledger?: string;
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
        if (!publicClient) return;
        const rpcChainId = await publicClient.getChainId();
        if (rpcChainId !== anvil.id) {
          throw new Error('The configured RPC is not local Anvil chain 31337.');
        }
        const checks: Array<[string, string]> = [
          ['PoolManager', addr.poolManager],
          ['Hook', addr.hook],
          ['Oracle', addr.oracle],
          ['USDC', addr.tokenA],
          ['RWA', addr.tokenB],
          ['PoolExecutor', addr.executor],
        ];
        if (addr.ledger) checks.push(['AllocationLedger', addr.ledger]);
        for (const [label, deployed] of checks) {
          const code = await publicClient.getBytecode({ address: deployed as `0x${string}` });
          if (!code || code === '0x') {
            throw new Error(`${label} has no code on local Anvil. Run bash script/start_anvil_demo.sh and refresh.`);
          }
        }
        setAddresses({
          hook: addr.hook,
          oracle: addr.oracle,
          tokenA: addr.tokenA,
          tokenB: addr.tokenB,
          poolManager: addr.poolManager,
          executor: addr.executor,
          ledger: addr.ledger,
        });
        setDeploymentError(null);
      } catch (error) {
        setDeploymentError(error instanceof Error ? error.message : 'Failed to load deployment');
      }
    };

    void load();
  }, [publicClient]);

  const { data: userTier } = useReadContract({
    chainId: anvil.id,
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'userTier',
    args: [address as `0x${string}`],
    query: { enabled: !!addresses?.hook && !!address, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: userDynamicFee } = useReadContract({
    chainId: anvil.id,
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getDynamicFee',
    args: [address as `0x${string}`],
    query: { enabled: !!addresses?.hook && !!address, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: volatility } = useReadContract({
    chainId: anvil.id,
    address: addresses?.oracle as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getVolatility',
    query: { enabled: !!addresses?.oracle, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: threshold } = useReadContract({
    chainId: anvil.id,
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
    query: { enabled: !!addresses?.hook, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: poolPaused } = useReadContract({
    chainId: anvil.id,
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'poolPaused',
    query: { enabled: !!addresses?.hook, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: retailSwapCap } = useReadContract({
    chainId: anvil.id,
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
    query: { enabled: !!addresses?.hook, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: quoteToken } = useReadContract({
    chainId: anvil.id,
    address: addresses?.executor as `0x${string}`,
    abi: EXECUTOR_ABI,
    functionName: 'usdc',
    query: { enabled: !!addresses?.executor },
  });

  const { data: rwaToken } = useReadContract({
    chainId: anvil.id,
    address: addresses?.executor as `0x${string}`,
    abi: EXECUTOR_ABI,
    functionName: 'rwa',
    query: { enabled: !!addresses?.executor },
  });

  const { data: allocationId } = useReadContract({
    chainId: anvil.id,
    address: addresses?.ledger as `0x${string}`,
    abi: LEDGER_READ_ABI,
    functionName: 'allocationIdByWallet',
    args: [address as `0x${string}`],
    query: { enabled: !!addresses?.ledger && !!address },
  });
  const walletRegistered = typeof allocationId === 'string' && allocationId !== ZERO_ALLOCATION;

  const { data: allocationGroupId } = useReadContract({
    chainId: anvil.id,
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_GROUP_ABI,
    functionName: 'allocationGroupId',
    query: { enabled: !!addresses?.hook },
  });

  const { data: allocationPeriodId } = useReadContract({
    chainId: anvil.id,
    address: addresses?.hook as `0x${string}`,
    abi: HOOK_GROUP_ABI,
    functionName: 'allocationPeriodId',
    query: { enabled: !!addresses?.hook },
  });

  const { data: sharedRemaining, isError: remainingError, isLoading: remainingLoading } = useReadContract({
    chainId: anvil.id,
    address: addresses?.ledger as `0x${string}`,
    abi: LEDGER_READ_ABI,
    functionName: 'remaining',
    args: address && allocationGroupId && allocationPeriodId !== undefined
      ? [address, allocationGroupId, allocationPeriodId]
      : undefined,
    query: {
      enabled: walletRegistered && !!addresses?.ledger && !!address && !!allocationGroupId && allocationPeriodId !== undefined,
      refetchInterval: LIVE_REFETCH_MS,
    },
  });

  const { data: tokenADecimals } = useReadContract({
    chainId: anvil.id,
    address: addresses?.tokenA as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!addresses?.tokenA },
  });

  const { data: tokenBDecimals } = useReadContract({
    chainId: anvil.id,
    address: addresses?.tokenB as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!addresses?.tokenB },
  });

  const { data: userTokenABalance } = useReadContract({
    chainId: anvil.id,
    address: addresses?.tokenA as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!addresses?.tokenA && !!address, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: userTokenBBalance, refetch: refetchUserTokenBBalance } = useReadContract({
    chainId: anvil.id,
    address: addresses?.tokenB as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!addresses?.tokenB && !!address, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: executorTokenABalance } = useReadContract({
    chainId: anvil.id,
    address: addresses?.tokenA as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [addresses?.executor as `0x${string}`],
    query: { enabled: !!addresses?.tokenA && !!addresses?.executor, refetchInterval: LIVE_REFETCH_MS },
  });

  const { data: executorTokenBBalance } = useReadContract({
    chainId: anvil.id,
    address: addresses?.tokenB as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [addresses?.executor as `0x${string}`],
    query: { enabled: !!addresses?.tokenB && !!addresses?.executor, refetchInterval: LIVE_REFETCH_MS },
  });

  const tier = Number(userTier ?? BigInt(0));
  const volNum = Number(volatility ?? BigInt(0));
  const thresholdNum = Number(threshold ?? BigInt(5));
  const computedFee = calculateDynamicFeeForTier(
    (tier === 1 ? 1 : tier === 2 ? 2 : 0) as 0 | 1 | 2,
    volNum,
    thresholdNum
  );
  const userFee = tier === 0 ? 0 : Number((userDynamicFee as bigint | undefined) ?? BigInt(computedFee));

  const decimalsA = Number(tokenADecimals ?? 6);
  const decimalsB = Number(tokenBDecimals ?? 18);
  const userABalanceNum = Number(formatUnits((userTokenABalance as bigint) ?? BigInt(0), decimalsA));
  const userBBalanceNum = Number(formatUnits((userTokenBBalance as bigint) ?? BigInt(0), decimalsB));
  const executorABalanceNum = Number(formatUnits((executorTokenABalance as bigint) ?? BigInt(0), decimalsA));
  const executorBBalanceNum = Number(formatUnits((executorTokenBBalance as bigint) ?? BigInt(0), decimalsB));
  const retailCapNum = Number(formatUnits((retailSwapCap as bigint) ?? BigInt(0), decimalsA));

  const estimatedOut = useMemo(() => {
    const amount = Number(inputAmount || '0');
    if (Number.isNaN(amount) || amount <= 0) return 0;
    const feeRate = userFee / 10000;
    return Math.max(amount * (1 - feeRate), 0);
  }, [inputAmount, userFee]);

  const handleExecuteSwap = async () => {
    if (!address) {
      setErrorMessage('Connect wallet first.');
      setPhase('rejected');
      return;
    }

    if (walletChainId !== anvil.id) {
      setErrorMessage('Switch the wallet to local Anvil before sending a purchase.');
      setPhase('rejected');
      return;
    }

    if (!addresses?.executor) {
      setErrorMessage('Missing PoolExecutor address in deployment.');
      setPhase('rejected');
      return;
    }

    if (addresses.ledger && !walletRegistered) {
      setErrorMessage(UNREGISTERED_WALLET_MESSAGE);
      setPhase('registering');
      return;
    }

    if (Boolean(poolPaused)) {
      setErrorMessage(PAUSED_POOL_MESSAGE);
      setPhase('rejected');
      return;
    }

    const amount = Number(inputAmount || '0');
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Enter a valid positive amount.');
      setPhase('rejected');
      return;
    }

    if (!publicClient) {
      setErrorMessage('Public client unavailable.');
      setPhase('rejected');
      return;
    }

    const contractsToCheck: Array<[string, string]> = [
      ['Hook', addresses.hook],
      ['Oracle', addresses.oracle],
      ['TokenA', addresses.tokenA],
      ['TokenB', addresses.tokenB],
      ['PoolExecutor', addresses.executor],
    ];

    for (const [label, addr] of contractsToCheck) {
      const code = await publicClient.getBytecode({ address: addr as `0x${string}` });
      if (!code || code === '0x') {
        setErrorMessage(
          `${label} is not deployed on current chain. Start Anvil, run bash script/run_canonical_demo.sh, then refresh.`
        );
        setPhase('rejected');
        return;
      }
    }

    if (tier === 0) {
      setErrorMessage('Connected wallet is Tier 0, so beforeSwap will revert. Set this wallet to tier 1 or 2 from Admin.');
      setPhase('rejected');
      return;
    }

    if (!quoteToken || !rwaToken) {
      setErrorMessage('The router USDC token is not available. The purchase was not sent.');
      setPhase('rejected');
      return;
    }

    setErrorMessage('');
    setPhase('approving');

    const requireSuccessfulReceipt = async (hash: Hex) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') return;
      const tx = await publicClient.getTransaction({ hash });
      try {
        await publicClient.call({
          account: tx.from,
          to: tx.to,
          data: tx.input,
          value: tx.value,
        });
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Transaction reverted');
      }
      throw new Error('Transaction reverted');
    };

    try {
      const beforeA = await publicClient.readContract({
        address: quoteToken,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      const beforeB = (userTokenBBalance as bigint) ?? BigInt(0);
      setBeforeExecutorA(beforeA);
      setBeforeExecutorB(beforeB);
      const purchase = usdcPurchasePlan({
        typedAmount: inputAmount,
        usdc: quoteToken,
        rwa: rwaToken,
        executor: addresses.executor,
        poolManager: addresses.poolManager,
        hook: addresses.hook,
        fee: POOL_FEE,
        tickSpacing: TICK_SPACING,
      });
      if (!purchase.ok) {
        setErrorMessage('Enter a USDC amount. The purchase was not sent.');
        setPhase('rejected');
        return;
      }

      const approveHash = await writeContractAsync({
        address: purchase.plan.approval.token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [purchase.plan.approval.spender as `0x${string}`, purchase.plan.approval.amount],
      });
      setApprovalTxHash(approveHash);
      await requireSuccessfulReceipt(approveHash);

      setPhase('swapping');

      const swapHash = await writeContractAsync({
        address: purchase.plan.swap.router as `0x${string}`,
        abi: EXECUTOR_ABI,
        functionName: 'swapExactInput',
        args: [
          {
            currency0: purchase.plan.swap.poolKey.currency0 as `0x${string}`,
            currency1: purchase.plan.swap.poolKey.currency1 as `0x${string}`,
            fee: purchase.plan.swap.poolKey.fee,
            tickSpacing: purchase.plan.swap.poolKey.tickSpacing,
            hooks: purchase.plan.swap.poolKey.hooks as `0x${string}`,
          },
          purchase.plan.swap.amountIn,
        ],
      });
      setSwapTxHash(swapHash);
      await requireSuccessfulReceipt(swapHash);

      const [afterA, afterBResult] = await Promise.all([
        publicClient.readContract({
          address: quoteToken,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }),
        refetchUserTokenBBalance(),
      ]);
      const afterB = (afterBResult.data as bigint) ?? BigInt(0);
      setAfterExecutorA(afterA);
      setAfterExecutorB(afterB);

      const deltaA = Number(formatUnits(beforeA - afterA, decimalsA));
      const deltaB = Number(formatUnits(afterB - beforeB, decimalsB));
      const feeRate = userFee / 10000;
      const feePercent = feeRate * 100;

      addTransaction({
        type: 'swap',
        tokenIn: 'USDC',
        tokenOut: 'RWA',
        amountIn: Math.abs(deltaA),
        amountOut: deltaB,
        fee: feePercent,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        status: 'success',
        hash: swapHash,
      });

      setPhase('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swap execution failed';
      setErrorMessage(formatSwapError(message));
      setPhase('rejected');
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
        <p className="text-black">
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
                <span className="font-semibold text-black">Pool status</span>
                <span className={Boolean(poolPaused) ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>
                  {Boolean(poolPaused) ? 'Paused' : 'Active'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-black">Current price</span>
                <span className="text-black">~1 Token A : 1 Token B</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-black">Hook swap actor</span>
                <span className="text-black font-mono">{tierLabel}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm border-b border-gray-300 pb-4">
              <p className="font-semibold text-black">Your wallet (read-only context)</p>
              <div className="flex justify-between">
                <span className="text-black">Tier</span>
                <span className="font-bold text-black">{tierLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">Volatility</span>
                <span className="font-mono text-black">{volNum}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">Applicable fee</span>
                <span className="font-mono text-black">{userFee} bps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">Token A</span>
                <span className="font-mono text-black">{userABalanceNum.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">Token B</span>
                <span className="font-mono text-black">{userBBalanceNum.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">Retail cap</span>
                <span className="font-mono text-black">{retailCapNum.toFixed(4)} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">Shared remaining</span>
                <span className="font-mono text-black" data-testid="shared-remaining">
                  {!address && 'Connect a wallet'}
                  {address && !walletRegistered && UNREGISTERED_WALLET_MESSAGE}
                  {address && walletRegistered && remainingLoading && 'Reading the ledger'}
                  {address && walletRegistered && remainingError && 'The ledger could not be read'}
                  {address && walletRegistered && typeof sharedRemaining === 'bigint' && `${formatUnits(sharedRemaining, 6)} USDC`}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm border-b border-gray-300 pb-4">
              <p className="font-semibold text-black">Executor balances (actual swap actor)</p>
              <div className="flex justify-between">
                <span className="text-black">Executor Token A</span>
                <span className="font-mono text-black">{executorABalanceNum.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black">Executor Token B</span>
                <span className="font-mono text-black">{executorBBalanceNum.toFixed(4)}</span>
              </div>
            </div>

            <div className="space-y-4">
              {address && walletChainId !== anvil.id && (
                <div className="border-2 border-black p-3 text-sm" role="status">
                  <p>The connected wallet is not on local Anvil (chain 31337). The purchase form is showing the Anvil market, and no transaction will be sent on another network.</p>
                  <button
                    type="button"
                    className="mt-2 bg-black px-3 py-2 font-bold text-white disabled:opacity-50"
                    disabled={switchingChain}
                    onClick={() => switchChain({ chainId: anvil.id })}
                  >
                    {switchingChain ? 'Switching network' : 'Switch to Anvil'}
                  </button>
                </div>
              )}
              <p className="text-sm font-bold" role="status">Router state: {routerPhaseLabel(phase)}</p>
              <div>
                <label className="block text-sm font-semibold text-black mb-2" htmlFor="usdc-purchase-amount">USDC amount</label>
                <input
                  id="usdc-purchase-amount"
                  type="number"
                  value={inputAmount}
                  min="0"
                  step="0.01"
                  onChange={(event) => setInputAmount(event.target.value)}
                  disabled={phase === 'approving' || phase === 'swapping'}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg font-mono"
                />
                <p className="text-xs text-black mt-2">
                  Estimated output at displayed fee: {estimatedOut.toFixed(4)} Token B
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleExecuteSwap}
                  disabled={phase === 'approving' || phase === 'swapping' || !address || (!!address && walletChainId !== anvil.id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
                >
                  {phase === 'approving'
                    ? 'Approving'
                    : phase === 'registering'
                      ? 'Registering'
                      : phase === 'swapping'
                        ? 'Swapping'
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
                title="1) Registration"
                description={walletRegistered ? 'This wallet is already registered' : 'Registering is required before a purchase'}
                done={walletRegistered}
                running={phase === 'registering'}
              />
              <StepRow
                title="2) Approval"
                description="approve(USDC -> router)"
                done={!!approvalTxHash}
                running={phase === 'approving'}
              />
              <StepRow
                title="3) Swap execution"
                description="swapExactInput settles the purchase"
                done={!!swapTxHash}
                running={phase === 'swapping'}
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
                <p className="text-xs text-gray-600 mb-1">Wallet Balance Delta</p>
                <div className="text-xs font-mono space-y-1">
                  <p>
                    USDC: {(Number(formatUnits(beforeExecutorA - afterExecutorA, 6))).toFixed(6)}
                  </p>
                  <p>
                    RWA: {(Number(formatUnits(afterExecutorB - beforeExecutorB, decimalsB))).toFixed(6)}
                  </p>
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-green-300">
                <p className="text-xs text-gray-600 mb-1">Hook Events (expected)</p>
                <div className="text-xs font-mono space-y-1">
                  <p>BeforeSwapCalled(connected wallet, tier={tier}, fee=...)</p>
                  <p>AfterSwapCalled(connected wallet)</p>
                </div>
              </div>
            </div>
          )}

          {(phase === 'rejected' || phase === 'registering') && (
            <div className="border-2 border-red-400 rounded-lg p-6 bg-red-50">
              <h3 className="font-bold text-lg text-red-800 mb-2">{phase === 'registering' ? 'Registering' : 'Hook rejection'}</h3>
              <p className="text-sm text-red-700 wrap-break-word">{errorMessage || 'Transaction failed'}</p>
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

      <div className="mt-12">
        <TransactionHistory />
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
        <p className="text-xs font-bold text-black">{done ? 'DONE' : running ? 'RUNNING' : 'PENDING'}</p>
      </div>
      <p className="text-xs text-black mt-1">{description}</p>
    </div>
  );
}
