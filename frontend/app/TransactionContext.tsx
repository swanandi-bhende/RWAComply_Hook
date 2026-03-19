'use client';

import React, { createContext, useContext, useState } from 'react';

export interface Transaction {
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

interface TransactionContextType {
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

// Mock initial transactions
const initialTransactions: Transaction[] = [
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

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: new Date().getTime().toString(),
    };
    setTransactions([newTransaction, ...transactions]);
  };

  return (
    <TransactionContext.Provider value={{ transactions, addTransaction }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransactions must be used within TransactionProvider');
  }
  return context;
}
