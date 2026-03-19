'use client';

import React, { ReactNode } from 'react';
import { WagmiProvider, createConfig, createStorage, http, injected, noopStorage } from 'wagmi';
import { anvil } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { TransactionProvider } from './TransactionContext';
import '@rainbow-me/rainbowkit/styles.css';

const config = createConfig({
  connectors: [injected()],
  chains: [anvil],
  transports: {
    [anvil.id]: http('http://localhost:8545'),
  },
  ssr: true,
  storage: createStorage({ storage: noopStorage }),
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <TransactionProvider>
            {children}
          </TransactionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
