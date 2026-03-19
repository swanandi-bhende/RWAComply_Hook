'use client';

import { useAccount } from 'wagmi';
import { useTransactions } from '@/app/TransactionContext';

interface Transaction {
  id: string;
  type: 'swap' | 'add' | 'remove';
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  fee: number;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
  hash: string;
}

// Mock data - in real app, fetch from logs/events
const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'swap',
    tokenIn: 'Token A',
    tokenOut: 'Token B',
    amountIn: 10.5,
    amountOut: 9.8,
    fee: 0.05,
    timestamp: '2 min ago',
    status: 'success',
    hash: '0x1234...5678',
  },
  {
    id: '2',
    type: 'add',
    tokenIn: 'Token A',
    tokenOut: 'Token B',
    amountIn: 50,
    amountOut: 50,
    fee: 0,
    timestamp: '1 hour ago',
    status: 'success',
    hash: '0x9876...5432',
  },
  {
    id: '3',
    type: 'swap',
    tokenIn: 'Token B',
    tokenOut: 'Token A',
    amountIn: 5,
    amountOut: 5.1,
    fee: 0.08,
    timestamp: '3 hours ago',
    status: 'success',
    hash: '0x5555...6666',
  },
];

export function TransactionHistory() {
  const { address } = useAccount();
  const { transactions } = useTransactions();

  if (!address) {
    return (
      <div className="bg-white border-3 border-black p-8 text-center">
        <p className="text-black font-bold">Connect wallet to view transactions</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-3 border-black overflow-hidden">
      {/* Header */}
      <div className="bg-black border-b-3 border-black px-6 py-4">
        <h2 className="text-2xl font-bold text-white">TRANSACTION HISTORY</h2>
        <p className="text-sm font-semibold text-white">Your recent activity</p>
      </div>

      {/* Body */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white border-b-3 border-black">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">Type</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">Details</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">Fee</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">Time</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black">
            {transactions && transactions.length > 0 ? (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-100 transition-colors border-b-2 border-black">
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 border-2 border-black text-xs font-bold bg-black text-white">
                      {tx.type === 'swap' ? '⇄' : tx.type === 'add' ? '+' : '-'} {tx.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="font-bold text-black">
                        {tx.amountIn} {tx.tokenIn} → {tx.amountOut} {tx.tokenOut}
                      </p>
                      <p className="text-xs font-semibold text-black mt-1">{tx.hash}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-black">
                    {tx.fee > 0 ? `${tx.fee}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-black">{tx.timestamp}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 border-2 border-black text-xs font-bold bg-white text-black">
                      {tx.status === 'success' ? '✓' : tx.status === 'pending' ? '⏳' : '✕'} {tx.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-black font-bold">
                  No transactions yet. Perform a swap or add liquidity to see them here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
        <button className="text-sm font-bold text-blue-600 hover:text-blue-700">
          View all transactions →
        </button>
      </div>
    </div>
  );
}
