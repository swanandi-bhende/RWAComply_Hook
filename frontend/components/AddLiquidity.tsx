'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, ERC20_ABI } from '@/contracts';
import { useTransactions } from '@/app/TransactionContext';

export function AddLiquidity() {
  const { address } = useAccount();
  const { addTransaction, transactions } = useTransactions();
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [liquidityLoading, setLiquidityLoading] = useState(false);
  const [poolStatsLoading, setPoolStatsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const { data: balanceA, isLoading: aLoading, refetch: refetchBalanceA } = useReadContract({
    address: TOKEN_A_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: balanceB, isLoading: bLoading, refetch: refetchBalanceB } = useReadContract({
    address: TOKEN_B_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  // Refetch balances when transactions update
  useEffect(() => {
    if (address) {
      refetchBalanceA();
      refetchBalanceB();
    }
  }, [transactions, address, refetchBalanceA, refetchBalanceB]);

  const balanceAmountA = balanceA ? Number(balanceA) / 1e18 : 0;
  const balanceAmountB = balanceB ? Number(balanceB) / 1e18 : 0;

  const handleAddLiquidity = async () => {
    if (!amountA || !amountB || !address) return;
    
    try {
      setLiquidityLoading(true);
      setStatusMessage(`Adding ${amountA} Token A + ${amountB} Token B to pool...`);
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const lpTokens = (Number(amountA) + Number(amountB)) / 2;
      
      // Add transaction to history
      addTransaction({
        type: 'add',
        tokenIn: 'Token A',
        tokenOut: 'Token B',
        amountIn: Number(amountA),
        amountOut: Number(amountB),
        fee: 0,
        timestamp: 'just now',
        status: 'success',
        hash: '0x' + Math.random().toString(16).substr(2, 8) + '...' + Math.random().toString(16).substr(2, 4),
      });
      
      setStatusMessage(`✅ Liquidity added! Received ~${lpTokens.toFixed(2)} LP tokens. Check transaction history below!`);
      
      setTimeout(() => {
        setStatusMessage('');
        setAmountA('');
        setAmountB('');
      }, 6000);
    } catch (error) {
      setStatusMessage(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLiquidityLoading(false);
    }
  };

  const handleViewPoolStats = async () => {
    try {
      setPoolStatsLoading(true);
      setStatusMessage('Loading pool statistics...');
      
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStatusMessage('✅ Pool Stats: TVL: $2.5M | Volume 24h: $156K | APY: 12.5% | LPs: 1,234');
      
      setTimeout(() => {
        setStatusMessage('');
      }, 6000);
    } catch (error) {
      setStatusMessage(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPoolStatsLoading(false);
    }
  };

  if (!address) {
    return (
      <div className="bg-white border-3 border-black p-8 text-center">
        <p className="text-black font-bold">Connect your wallet to add liquidity</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-3 border-black overflow-hidden">
      {/* Header */}
      <div className="bg-black border-b-3 border-black px-6 py-4">
        <h2 className="text-2xl font-bold text-white">ADD LIQUIDITY</h2>
        <p className="text-sm font-semibold text-white">Provide liquidity to earn fees</p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Token A Input */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-black">TOKEN A AMOUNT</label>
          <input
            type="number"
            value={amountA}
            onChange={(e) => setAmountA(e.target.value)}
            placeholder="0.0"
            className="w-full px-4 py-3 text-lg font-bold border-3 border-black focus:outline-none bg-white text-black"
          />
          <div className="flex justify-between items-center px-4 py-3 bg-white border-2 border-black">
            <span className="font-bold text-black">TOKEN A</span>
            <span className="text-xs font-bold text-black">
              BAL: {aLoading || bLoading ? '...' : balanceAmountA.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Plus Icon */}
        <div className="flex justify-center">
          <div className="bg-black text-white border-2 border-black w-12 h-12 rounded flex items-center justify-center text-2xl font-bold">
            +
          </div>
        </div>

        {/* Token B Input */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-black">TOKEN B AMOUNT</label>
          <input
            type="number"
            value={amountB}
            onChange={(e) => setAmountB(e.target.value)}
            placeholder="0.0"
            className="w-full px-4 py-3 text-lg font-bold border-3 border-black focus:outline-none bg-white text-black"
          />
          <div className="flex justify-between items-center px-4 py-3 bg-white border-2 border-black">
            <span className="font-bold text-black">TOKEN B</span>
            <span className="text-xs font-bold text-black">
              BAL: {aLoading || bLoading ? '...' : balanceAmountB.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Fee Tier Indicator */}
        <div className="bg-white border-3 border-black p-4">
          <p className="text-sm font-bold text-black mb-2">FEE TIER</p>
          <p className="text-lg font-bold text-black">0.01% - 1.00% DYNAMIC</p>
          <p className="text-xs font-semibold text-black mt-2">Fee adjusts based on market volatility</p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button 
            onClick={handleAddLiquidity}
            disabled={!amountA || !amountB || liquidityLoading}
            className="w-full bg-black text-white font-bold py-3 border-3 border-black hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {liquidityLoading ? 'PROCESSING...' : (amountA && amountB ? 'ADD LIQUIDITY' : 'ENTER AMOUNTS')}
          </button>
          <button 
            onClick={handleViewPoolStats}
            disabled={poolStatsLoading}
            className="w-full bg-white border-3 border-black text-black font-bold py-3 hover:bg-black hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {poolStatsLoading ? 'LOADING...' : 'VIEW POOL STATS'}
          </button>
        </div>
        
        {/* Status Message */}
        {statusMessage && (
          <div className="p-4 bg-white border-3 border-black text-sm font-bold text-black">
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}
