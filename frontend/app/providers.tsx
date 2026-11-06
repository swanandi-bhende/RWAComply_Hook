'use client';

import React, { ReactNode } from 'react';
import { WagmiProvider, createConfig, createStorage, http, injected, noopStorage } from 'wagmi';
import { anvil, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { TransactionProvider } from './TransactionContext';
import '@rainbow-me/rainbowkit/styles.css';

const config = createConfig({
  connectors: [injected()],
  chains: [sepolia, anvil],
  transports: {
    [sepolia.id]: http(),
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
        <RainbowKitProvider
          initialChain={sepolia}
          theme={lightTheme({
            accentColor: '#7192BE',
            accentColorForeground: '#000000',
            borderRadius: 'medium',
            overlayBlur: 'none',
          })}
        >
          <TransactionProvider>
            {children}
          </TransactionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
