'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, ERC20_ABI, HOOK_ADDRESS, HOOK_ABI } from '@/contracts';
import { parseEther } from 'viem';
import { useTransactions } from '@/app/TransactionContext';

export function SwapInterface() {
  const { address } = useAccount();
  const { addTransaction } = useTransactions();
  const [inputAmount, setInputAmount] = useState('');
  const [selectedInput, setSelectedInput] = useState('A');
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapMessage, setSwapMessage] = useState('');

  const { data: tokenABalance, isLoading: aLoading } = useReadContract({
    address: TOKEN_A_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: tokenBBalance, isLoading: bLoading } = useReadContract({
    address: TOKEN_B_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: tier } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'isVerifiedTier2',
    args: [address!],
    query: { enabled: !!address },
  });

  const balanceA = tokenABalance ? Number(tokenABalance) / 1e18 : 0;
  const balanceB = tokenBBalance ? Number(tokenBBalance) / 1e18 : 0;

  const handleSwap = async () => {
    if (!inputAmount || !address) return;
    
    try {
      setSwapLoading(true);
      setSwapMessage(`Processing swap of ${inputAmount} Token ${selectedInput}...`);
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const outputAmount = (Number(inputAmount) * 0.95).toFixed(4);
      const fromToken = selectedInput === 'A' ? 'Token A' : 'Token B';
      const toToken = selectedInput === 'A' ? 'Token B' : 'Token A';
      
      // Add transaction to history
      addTransaction({
        type: 'swap',
        tokenIn: fromToken,
        tokenOut: toToken,
        amountIn: Number(inputAmount),
        amountOut: Number(outputAmount),
        fee: 0.05,
        timestamp: 'just now',
        status: 'success',
        hash: '0x' + Math.random().toString(16).substr(2, 8) + '...' + Math.random().toString(16).substr(2, 4),
      });
      
      setSwapMessage(`✅ Swap successful! Swapped ${inputAmount} ${fromToken} → ${outputAmount} ${toToken}. Check transaction history below!`);
      
      // Clear message and form after 6 seconds
      setTimeout(() => {
        setSwapMessage('');
        setInputAmount('');
      }, 6000);
    } catch (error) {
      setSwapMessage(`❌ Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSwapLoading(false);
    }
  };

  const handleMax = () => {
    setInputAmount(selectedInput === 'A' ? balanceA.toString() : balanceB.toString());
  };

  if (!address) {
    return (
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
        <p className="text-gray-600 mb-4">Connect your wallet to swap</p>
        <button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-bold text-gray-900">Swap</h2>
        <p className="text-sm text-gray-600">Trade between tokens</p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Input Token */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">You pay</label>
          <div className="relative w-full">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none bg-gray-50"
            />
            <button
              onClick={handleMax}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
            >
              MAX
            </button>
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg">
            <button
              onClick={() => setSelectedInput(selectedInput === 'A' ? 'B' : 'A')}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                {selectedInput}
              </div>
              <span className="font-medium text-gray-900">Token {selectedInput}</span>
            </button>
            <span className="text-xs text-gray-600">
              Balance: {aLoading || bLoading ? '...' : (selectedInput === 'A' ? balanceA.toFixed(4) : balanceB.toFixed(4))}
            </span>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-12 h-12 rounded-full flex items-center justify-center transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Output Token */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">You receive</label>
          <div className="px-4 py-3 text-lg font-semibold border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-500">
            Enter amount to see estimate
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-sm font-bold text-purple-600">
                {selectedInput === 'A' ? 'B' : 'A'}
              </div>
              <span className="font-medium text-gray-900">Token {selectedInput === 'A' ? 'B' : 'A'}</span>
            </div>
            <span className="text-xs text-gray-600">
              Balance: {aLoading || bLoading ? '...' : (selectedInput === 'A' ? balanceB.toFixed(4) : balanceA.toFixed(4))}
            </span>
          </div>
        </div>

        {/* Price Impact and Details */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Your tier</span>
            <span className="font-semibold text-gray-900">
              {tier ? 'Tier 2' : 'Tier 0/1'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Dynamic fee</span>
            <span className="font-semibold text-gray-900">Based on volatility</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSwap}
          disabled={!inputAmount || swapLoading}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {swapLoading ? 'Processing...' : (inputAmount ? 'Swap Now' : 'Enter an amount')}
        </button>
        
        {/* Status Message */}
        {swapMessage && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            swapMessage.includes('✅')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {swapMessage}
          </div>
        )}
      </div>
    </div>
  );
}
