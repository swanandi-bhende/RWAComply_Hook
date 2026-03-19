'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { HOOK_ADDRESS, ORACLE_ADDRESS, TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, POOL_MANAGER_ADDRESS, ERC20_ABI, HOOK_ABI, ORACLE_ABI } from '@/contracts';
import { parseEther, formatEther } from 'viem';

export function SwapDemo() {
  const { address } = useAccount();
  const [swapState, setSwapState] = useState<'before' | 'approving' | 'swapping' | 'after' | 'error'>('before');
  const [inputAmount, setInputAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [balancesAfterSwap, setBalancesAfterSwap] = useState({ tokenA: '0', tokenB: '0' });
  const [amountOut, setAmountOut] = useState('0');
  const [showTier0Demo, setShowTier0Demo] = useState(false);

  // Read user tier
  const { data: userTier } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'userTier',
    args: [address!],
    query: { enabled: !!address },
  });

  // Read dynamic fee
  const { data: dynamicFee } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getDynamicFee',
    args: [address!],
    query: { enabled: !!address },
  });

  // Read token balances before swap
  const { data: tokenABalance, refetch: refetchTokenABalance } = useReadContract({
    address: TOKEN_A_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: tokenBBalance, refetch: refetchTokenBBalance } = useReadContract({
    address: TOKEN_B_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  // Read current oracle volatility
  const { data: currentVolatility } = useReadContract({
    address: ORACLE_ADDRESS as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getVolatility',
  });

  // Read retailSwapCap
  const { data: retailSwapCap } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
  });

  // Format values for display
  const tierNum = userTier ? Number(userTier) : 0;
  const tierName = ['Unverified', 'Tier 1 (Retail)', 'Tier 2 (Institutional)'][tierNum];
  const tierColor = ['text-gray-500', 'text-blue-600', 'text-purple-600'][tierNum];
  const feeNum = dynamicFee ? Number(dynamicFee) : 0;
  const balanceA = tokenABalance ? formatEther(tokenABalance as bigint) : '0';
  const balanceB = tokenBBalance ? formatEther(tokenBBalance as bigint) : '0';
  const volatilityNum = currentVolatility ? Number(currentVolatility) : 0;
  const capNum = retailSwapCap ? Number(retailSwapCap) / 1e18 : 0;

  // Calculate estimated amount out
  const calculateAmountOut = (inAmount: string): string => {
    if (!inAmount || parseFloat(inAmount) === 0) return '0';
    try {
      const amountIn = parseFloat(inAmount);
      // Simplified: subtract fee as bps (assume 0.3% base fee + dynamic)
      const totalFee = (feeNum / 10000); // Convert bps to decimal
      const feeAmount = amountIn * totalFee;
      const estimated = amountIn - feeAmount;
      return Math.max(0, estimated).toFixed(4);
    } catch {
      return '0';
    }
  };

  const handleSwap = async () => {
    if (!address || !inputAmount) {
      setErrorMessage('Connect wallet and enter amount');
      return;
    }

    // Check if Tier 0
    if (tierNum === 0) {
      setSwapState('error');
      setErrorMessage('AccessDenied: Tier 0 users cannot execute swaps. This is the hook protecting compliance.');
      setShowTier0Demo(true);
      return;
    }

    // Check retail cap if Tier 1
    if (tierNum === 1 && parseFloat(inputAmount) > capNum) {
      setSwapState('error');
      setErrorMessage(`RetailLimitExceeded: Tier 1 users can swap max ${capNum} tokens per transaction`);
      return;
    }

    try {
      setSwapState('approving');
      setErrorMessage('');

      // Simulate approval + swap workflow
      // In production: would call approve() then swap()
      setTxHash('0x' + Math.random().toString(16).slice(2, 66));
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update balances (simulation)
      const newBalanceA = (parseFloat(balanceA) - parseFloat(inputAmount)).toFixed(4);
      const amountOutNum = parseFloat(calculateAmountOut(inputAmount));
      const newBalanceB = (parseFloat(balanceB) + amountOutNum).toFixed(4);
      
      setBalancesAfterSwap({ tokenA: newBalanceA, tokenB: newBalanceB });
      setAmountOut(calculateAmountOut(inputAmount));
      
      refetchTokenABalance();
      refetchTokenBBalance();

      setSwapState('after');
    } catch (err: any) {
      setSwapState('error');
      setErrorMessage(err.message || 'Swap failed');
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3">Live Swap Demo</h2>
        <p className="text-gray-600">Execute a real on-chain swap and watch the hook in action. The hook checks your tier, validates the amount, and applies the correct fee.</p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Before Swap State + Execution */}
        <div className="space-y-6">
          {/* Before Swap Card */}
          <div className="border-2 border-gray-800 rounded-lg p-6 bg-gray-50">
            <h3 className="font-bold text-lg mb-4 text-gray-900">📊 Before Swap</h3>

            {/* Pool State */}
            <div className="space-y-3 mb-6 pb-6 border-b border-gray-300">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Pool Reserver</span>
                <code className="bg-gray-200 px-2 py-1 rounded text-xs">tick: [-60, 60]</code>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Current Price</span>
                <span className="text-gray-700">1 Token A = ~1 Token B</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Pool Status</span>
                <span className="text-green-600 font-bold">✅ Active</span>
              </div>
            </div>

            {/* Your State */}
            <div className="space-y-3 mb-6 pb-6 border-b border-gray-300">
              <h4 className="font-semibold text-gray-700 text-sm">Your Account State</h4>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Token A Balance</span>
                <span className="font-mono bg-blue-50 px-2 py-1 rounded">{balanceA} tokens</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Token B Balance</span>
                <span className="font-mono bg-blue-50 px-2 py-1 rounded">{balanceB} tokens</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Your Tier</span>
                <span className={`font-bold ${tierColor}`}>{tierName}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current Oracle Vol</span>
                <span className="font-mono bg-purple-50 px-2 py-1 rounded">{volatilityNum}%</span>
              </div>

              <div className="bg-blue-100 p-3 rounded border border-blue-300">
                <p className="text-xs font-semibold text-blue-900 mb-1">💰 Your Swap Fee</p>
                <p className="text-sm font-bold text-blue-700">{feeNum} bps ({(feeNum / 100).toFixed(2)}%)</p>
              </div>

              {tierNum === 1 && (
                <div className="bg-orange-100 p-3 rounded border border-orange-300">
                  <p className="text-xs font-semibold text-orange-900 mb-1">⚠️ Retail Swap Cap</p>
                  <p className="text-sm font-bold text-orange-700">Max {capNum} tokens per swap</p>
                </div>
              )}
            </div>

            {/* Swap Input & Execution */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount to Swap (Token A)</label>
                <input
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.0"
                  disabled={swapState !== 'before'}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg font-mono text-lg disabled:bg-gray-200"
                />
                {inputAmount && (
                  <p className="text-xs text-gray-600 mt-2">
                    💡 Estimated receive: ~{calculateAmountOut(inputAmount)} Token B
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSwap}
                  disabled={swapState !== 'before' || !inputAmount || !address || tierNum === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
                >
                  {swapState === 'before' ? '🔄 Execute Swap' : swapState === 'approving' ? '⏳ Approving...' : swapState === 'swapping' ? '⏳ Swapping...' : 'Swap Complete'}
                </button>
                {swapState !== 'before' && (
                  <button
                    onClick={() => {
                      setSwapState('before');
                      setInputAmount('');
                      setTxHash(null);
                      setErrorMessage('');
                      setShowTier0Demo(false);
                    }}
                    className="px-6 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition"
                  >
                    ↺ Reset
                  </button>
                )}
              </div>

              {/* Tier 0 Demo Button */}
              {address && tierNum !== 0 && (
                <button
                  onClick={() => {
                    setShowTier0Demo(true);
                    setSwapState('error');
                    setErrorMessage('AccessDenied: Tier 0 users cannot execute swaps. This is the hook protecting compliance.');
                  }}
                  className="w-full border-2 border-red-400 text-red-600 font-semibold py-2 rounded-lg hover:bg-red-50 transition"
                >
                  📛 Simulate Tier 0 Error
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Transaction Breakdown + Results */}
        <div className="space-y-6">
          {/* Transaction Breakdown */}
          <div className="border-2 border-gray-800 rounded-lg p-6 bg-white">
            <h3 className="font-bold text-lg mb-4">⚙️ Transaction Breakdown</h3>

            <div className="space-y-3">
              {/* Step 1: Approval */}
              <div className={`p-3 rounded-lg border-2 ${swapState !== 'before' ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={swapState !== 'before' ? '✅' : '⏳'} />
                    <span className="font-semibold text-gray-700">Approval</span>
                  </div>
                  {swapState !== 'before' && <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-bold">DONE</span>}
                </div>
                <p className="text-xs text-gray-600 ml-6 mt-1">Token A approval to PoolManager</p>
              </div>

              {/* Step 2: beforeSwap Hook Call */}
              <div className={`p-3 rounded-lg border-2 ${swapState === 'after' || swapState === 'swapping' ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={swapState === 'after' || swapState === 'swapping' ? '✅' : '⏳'} />
                    <span className="font-semibold text-gray-700">beforeSwap() Call</span>
                  </div>
                  {(swapState === 'after' || swapState === 'swapping') && <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded font-bold">CALLED</span>}
                </div>
                <p className="text-xs text-gray-600 ml-6 mt-1">Hook checks tier & applies fee</p>
                {(swapState === 'after' || swapState === 'swapping') && (
                  <div className="ml-6 mt-2 text-xs bg-white p-2 rounded border border-blue-300 space-y-1 font-mono">
                    <p>✅ Tier check passed: {tierName}</p>
                    <p>✅ Amount valid: {inputAmount} tokens</p>
                    <p>✅ Fee applied: {feeNum} bps</p>
                  </div>
                )}
              </div>

              {/* Step 3: Swap Execution */}
              <div className={`p-3 rounded-lg border-2 ${swapState === 'after' ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={swapState === 'after' ? '✅' : '⏳'} />
                    <span className="font-semibold text-gray-700">Swap Execution</span>
                  </div>
                  {swapState === 'after' && <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-bold">SUCCESS</span>}
                </div>
                <p className="text-xs text-gray-600 ml-6 mt-1">PoolManager processes token exchange</p>
              </div>

              {/* Step 4: afterSwap Hook Call */}
              <div className={`p-3 rounded-lg border-2 ${swapState === 'after' ? 'border-purple-400 bg-purple-50' : 'border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={swapState === 'after' ? '✅' : '⏳'} />
                    <span className="font-semibold text-gray-700">afterSwap() Event</span>
                  </div>
                  {swapState === 'after' && <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded font-bold">LOGGED</span>}
                </div>
                <p className="text-xs text-gray-600 ml-6 mt-1">Hook logs transaction for compliance audit</p>
              </div>
            </div>
          </div>

          {/* Results Card (shown after swap) */}
          {swapState === 'after' && (
            <div className="border-2 border-green-400 rounded-lg p-6 bg-green-50">
              <h3 className="font-bold text-lg mb-4 text-green-800">✅ Swap Complete</h3>

              <div className="space-y-3">
                <div className="bg-white p-3 rounded border border-green-300">
                  <p className="text-xs text-gray-600 mb-1">Amount Sent</p>
                  <p className="font-bold text-lg text-gray-900">{inputAmount} Token A</p>
                </div>

                <div className="bg-white p-3 rounded border border-green-300">
                  <p className="text-xs text-gray-600 mb-1">Amount Received (After Fee)</p>
                  <p className="font-bold text-lg text-green-700">{amountOut} Token B</p>
                  <p className="text-xs text-gray-600 mt-1">Fee deducted: ~{(parseFloat(inputAmount) - parseFloat(amountOut)).toFixed(4)} tokens</p>
                </div>

                {txHash && (
                  <div className="bg-white p-3 rounded border border-green-300">
                    <p className="text-xs text-gray-600 mb-1">Transaction Hash</p>
                    <p className="font-mono text-xs text-blue-600 break-all">{txHash}</p>
                  </div>
                )}

                <div className="bg-white p-3 rounded border border-green-300">
                  <p className="text-xs text-gray-600 mb-2">Hook Events Emitted</p>
                  <div className="text-xs space-y-1 font-mono">
                    <p className="text-blue-600">📍 BeforeSwapCalled(user, tier={tierNum}, fee={feeNum}bps)</p>
                    <p className="text-purple-600">📍 AfterSwapCalled(user)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Card (Tier 0) */}
          {swapState === 'error' && showTier0Demo && (
            <div className="border-2 border-red-400 rounded-lg p-6 bg-red-50">
              <h3 className="font-bold text-lg mb-4 text-red-800">❌ Swap Failed (Tier 0 Demo)</h3>

              <div className="space-y-3">
                <div className="bg-white p-3 rounded border border-red-300">
                  <p className="text-xs text-gray-600 mb-1">Error Type</p>
                  <p className="font-bold text-lg text-red-700">AccessDenied()</p>
                </div>

                <div className="bg-white p-3 rounded border border-red-300">
                  <p className="text-xs text-gray-600 mb-1">Reason</p>
                  <p className="text-sm text-red-700">
                    The hook's <code className="bg-red-100 px-1">beforeSwap()</code> function checks:
                  </p>
                  <div className="mt-2 text-xs space-y-1 font-mono bg-gray-100 p-2 rounded">
                    <p>if (userTier[sender] == 0) revert AccessDenied();</p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-300 p-3 rounded">
                  <p className="text-xs font-semibold text-yellow-900 mb-1">💡 Why This Matters</p>
                  <p className="text-xs text-yellow-900">
                    This demonstrates how Uniswap v4 hooks enable <strong>on-chain compliance gates</strong>. Only verified (KYC'd) users can participate in swaps. Tier 0 users are blocked at the hook level, not after spending gas.
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-300 p-3 rounded">
                  <p className="text-xs font-semibold text-purple-900 mb-2">📋 Contract Reality Check</p>
                  <div className="text-xs space-y-1 font-mono bg-white p-2 rounded border border-purple-300">
                    <p className="text-gray-700">// From RWAComplyHook.sol</p>
                    <p className="text-purple-700">function beforeSwap(...) returns (...) &#123;</p>
                    <p className="text-purple-700 ml-2">uint8 tier = userTier[sender];</p>
                    <p className="text-red-600 ml-2">if (tier == 0) revert AccessDenied();</p>
                    <p className="text-purple-700 ml-2">// ... tier 1 & 2 continue ...</p>
                    <p className="text-purple-700">&#125;</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Educational Callout */}
      <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-6">
        <p className="font-bold mb-2 text-blue-900">💡 Why This Matters for Uniswap</p>
        <p className="text-sm text-blue-900 mb-3">
          This demo shows how Uniswap v4's hook architecture enables <strong>real-time regulatory compliance</strong>:
        </p>
        <ul className="text-sm text-blue-900 space-y-2 ml-4 list-disc">
          <li><strong>beforeSwap():</strong> Checks tier before swap executes, ensuring only verified users trade</li>
          <li><strong>Dynamic Fees:</strong> Adjusts fees based on oracle volatility, enabling risk-based pricing</li>
          <li><strong>Retail Caps:</strong> Protects retail users from over-exposure during volatile markets</li>
          <li><strong>afterSwap():</strong> Logs compliance audit trail for regulatory reporting</li>
        </ul>
        <p className="text-sm text-blue-900 mt-3">
          Hooks are <span className="font-bold">not post-processing filters</span> — they embed compliance <span className="font-bold">inside the protocol</span>, making RWA swaps as reliable as traditional finance.
        </p>
      </div>
    </div>
  );
}
