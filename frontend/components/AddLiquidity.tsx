'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, ERC20_ABI } from '@/contracts';
import { useTransactions } from '@/app/TransactionContext';

export function AddLiquidity() {
  const { address } = useAccount();
  const { addTransaction } = useTransactions();
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [liquidityLoading, setLiquidityLoading] = useState(false);
  const [poolStatsLoading, setPoolStatsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const { data: balanceA, isLoading: aLoading } = useReadContract({
    address: TOKEN_A_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: balanceB, isLoading: bLoading } = useReadContract({
    address: TOKEN_B_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

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
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center">
        <p className="text-gray-600 mb-4">Connect your wallet to add liquidity</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-bold text-gray-900">Add Liquidity</h2>
        <p className="text-sm text-gray-600">Provide liquidity to earn fees</p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Token A Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Token A Amount</label>
          <input
            type="number"
            value={amountA}
            onChange={(e) => setAmountA(e.target.value)}
            placeholder="0.0"
            className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none bg-gray-50"
          />
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-900">Token A</span>
            <span className="text-xs text-gray-600">
              Balance: {aLoading || bLoading ? '...' : balanceAmountA.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Plus Icon */}
        <div className="flex justify-center">
          <div className="bg-gray-100 text-gray-700 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
            +
          </div>
        </div>

        {/* Token B Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Token B Amount</label>
          <input
            type="number"
            value={amountB}
            onChange={(e) => setAmountB(e.target.value)}
            placeholder="0.0"
            className="w-full px-4 py-3 text-lg font-semibold border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none bg-gray-50"
          />
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-900">Token B</span>
            <span className="text-xs text-gray-600">
              Balance: {aLoading || bLoading ? '...' : balanceAmountB.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Fee Tier Indicator */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Fee Tier</p>
          <p className="text-lg font-bold text-green-600">0.01% - 1.00% Dynamic</p>
          <p className="text-xs text-gray-600 mt-2">Fee adjusts based on market volatility</p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button 
            onClick={handleAddLiquidity}
            disabled={!amountA || !amountB || liquidityLoading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {liquidityLoading ? 'Processing...' : (amountA && amountB ? 'Add Liquidity' : 'Enter amounts')}
          </button>
          <button 
            onClick={handleViewPoolStats}
            disabled={poolStatsLoading}
            className="w-full bg-white border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {poolStatsLoading ? 'Loading...' : 'View Pool Stats'}
          </button>
        </div>
        
        {/* Status Message */}
        {statusMessage && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            statusMessage.includes('✅')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}
