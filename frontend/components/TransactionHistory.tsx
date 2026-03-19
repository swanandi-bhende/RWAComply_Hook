'use client';

import { useAccount } from 'wagmi';
import { useTransactions } from '@/app/TransactionContext';

function truncateHash(hash: string): string {
  if (hash.length > 10) {
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  }
  return hash;
}

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
        <p className="text-sm font-semibold text-white">Live swap activity from your wallet</p>
      </div>

      {/* Body */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-3 border-black">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">
                Amount In
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">
                Amount Out
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">
                Fee
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase border-r-2 border-black">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase">Tx Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black">
            {transactions && transactions.length > 0 ? (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors border-b-2 border-black">
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 border-2 border-black text-xs font-bold bg-black text-white">
                      {tx.type === 'swap' ? '⇄' : tx.type === 'add' ? '+' : '-'} {tx.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <p className="font-bold text-black">
                      {tx.amountIn.toFixed(4)} {tx.tokenIn}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <p className="font-bold text-black">
                      {tx.amountOut.toFixed(4)} {tx.tokenOut}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-black">
                    {tx.fee > 0 ? `${tx.fee.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-black">{tx.timestamp}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 border-2 border-black text-xs font-bold ${
                        tx.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : tx.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {tx.status === 'success' ? '✓' : tx.status === 'pending' ? '⏳' : '✕'}{' '}
                      {tx.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-blue-600 hover:text-blue-800 cursor-pointer">
                    <a
                      href={`https://etherscan.io/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline break-all"
                    >
                      {truncateHash(tx.hash)}
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-black font-bold">
                  No transactions yet. Execute a swap to see your transaction history here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t-3 border-black px-6 py-4">
        <p className="text-xs text-black font-semibold">
          {transactions && transactions.length > 0
            ? `Total transactions: ${transactions.length}`
            : 'Transactions will appear here after execution.'}
        </p>
      </div>
    </div>
  );
}
