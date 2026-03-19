'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, ERC20_ABI } from '@/contracts';

export function AddLiquidity() {
  const { address } = useAccount();
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');

  const { data: balanceA } = useReadContract({
    address: TOKEN_A_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: balanceB } = useReadContract({
    address: TOKEN_B_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  const balanceAmountA = balanceA ? Number(balanceA) / 1e18 : 0;
  const balanceAmountB = balanceB ? Number(balanceB) / 1e18 : 0;

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
              Balance: {balanceAmountA.toFixed(4)}
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
              Balance: {balanceAmountB.toFixed(4)}
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
          <button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            disabled={!amountA || !amountB}
          >
            {amountA && amountB ? 'Add Liquidity' : 'Enter amounts'}
          </button>
          <button className="w-full bg-white border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition-colors">
            View Pool Stats
          </button>
        </div>
      </div>
    </div>
  );
}
