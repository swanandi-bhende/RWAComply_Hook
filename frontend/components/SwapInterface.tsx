'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, ERC20_ABI, HOOK_ADDRESS, HOOK_ABI } from '@/contracts';
import { parseEther } from 'viem';
import { useTransactions } from '@/app/TransactionContext';

export function SwapInterface() {
  const { address } = useAccount();
  const { addTransaction, transactions } = useTransactions();
  const [inputAmount, setInputAmount] = useState('');
  const [selectedInput, setSelectedInput] = useState('A');
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapMessage, setSwapMessage] = useState('');

  const { data: tokenABalance, isLoading: aLoading, refetch: refetchTokenA } = useReadContract({
    address: TOKEN_A_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: tokenBBalance, isLoading: bLoading, refetch: refetchTokenB } = useReadContract({
    address: TOKEN_B_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: tier, refetch: refetchTier } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'userTier',
    args: [address!],
    query: { enabled: !!address, refetchInterval: 1000 },
  });

  // Refetch balances and tier when transactions update
  useEffect(() => {
    if (address) {
      refetchTokenA();
      refetchTokenB();
      refetchTier();
    }
  }, [transactions, address, refetchTokenA, refetchTokenB, refetchTier]);

  const balanceA = tokenABalance ? Number(tokenABalance) / 1e18 : 0;
  const balanceB = tokenBBalance ? Number(tokenBBalance) / 1e18 : 0;
  const tierNumber = Number(tier ?? BigInt(0));

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
      <div className="bg-white border-3 border-black rounded p-8 text-center">
        <p className="text-black font-bold mb-4">Connect your wallet to swap</p>
        <button className="bg-black text-white px-6 py-3 font-bold rounded border-2 border-black hover:bg-white hover:text-black">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-3 border-black overflow-hidden">
      {/* Header */}
      <div className="bg-black border-b-3 border-black px-6 py-4">
        <h2 className="text-2xl font-bold text-white">SWAP</h2>
        <p className="text-sm font-semibold text-white">Trade between tokens</p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Input Token */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-black">YOU PAY</label>
          <div className="relative w-full">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-3 text-lg font-bold border-3 border-black focus:outline-none bg-white text-black"
            />
            <button
              onClick={handleMax}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold bg-black text-white px-2 py-1 border border-black hover:bg-white hover:text-black"
            >
              MAX
            </button>
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-white border-2 border-black">
            <button
              onClick={() => setSelectedInput(selectedInput === 'A' ? 'B' : 'A')}
              className="flex items-center space-x-2 font-bold text-black"
            >
              <div className="w-8 h-8 border-2 border-black flex items-center justify-center text-sm font-bold text-black bg-white">
                {selectedInput}
              </div>
              <span>TOKEN {selectedInput}</span>
            </button>
            <span className="text-xs font-bold text-black">
              BAL: {aLoading || bLoading ? '...' : (selectedInput === 'A' ? balanceA.toFixed(4) : balanceB.toFixed(4))}
            </span>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <button className="bg-black text-white border-2 border-black w-12 h-12 flex items-center justify-center font-bold hover:bg-white hover:text-black transition-colors">
            ⇅
          </button>
        </div>

        {/* Output Token */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-black">YOU RECEIVE</label>
          <div className="px-4 py-3 text-lg font-bold border-3 border-black bg-white text-gray-500">
            Enter amount to see estimate
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-white border-2 border-black">
            <div className="flex items-center space-x-2 font-bold text-black">
              <div className="w-8 h-8 border-2 border-black flex items-center justify-center text-sm font-bold text-black bg-white">
                {selectedInput === 'A' ? 'B' : 'A'}
              </div>
              <span>TOKEN {selectedInput === 'A' ? 'B' : 'A'}</span>
            </div>
            <span className="text-xs font-bold text-black">
              BAL: {aLoading || bLoading ? '...' : (selectedInput === 'A' ? balanceB.toFixed(4) : balanceA.toFixed(4))}
            </span>
          </div>
        </div>

        {/* Price Impact and Details */}
        <div className="bg-white border-3 border-black p-4 space-y-3">
          <div className="flex justify-between text-sm font-bold text-black border-b-2 border-black pb-2">
            <span>YOUR TIER</span>
            <span>{`TIER ${tierNumber}`}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-black">
            <span>DYNAMIC FEE</span>
            <span>Based on volatility</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSwap}
          disabled={!inputAmount || swapLoading}
          className="w-full bg-black text-white font-bold py-3 border-3 border-black hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {swapLoading ? 'PROCESSING...' : (inputAmount ? 'SWAP NOW' : 'ENTER AN AMOUNT')}
        </button>
        
        {/* Status Message */}
        {swapMessage && (
          <div className="p-4 bg-white border-3 border-black text-sm font-bold text-black">
            {swapMessage}
          </div>
        )}
      </div>
    </div>
  );
}
