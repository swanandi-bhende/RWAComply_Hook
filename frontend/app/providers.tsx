'use client';

import React, { ReactNode, useEffect } from 'react';
import { WagmiProvider, createConfig, createStorage, http, noopStorage, type Connector } from 'wagmi';
import { anvil, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, connectorsForWallets, lightTheme } from '@rainbow-me/rainbowkit';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { TransactionProvider } from './TransactionContext';
import { isUserRejection, reportWalletConnect } from '@/lib/product/walletConnection';
import '@rainbow-me/rainbowkit/styles.css';

const patched = new WeakSet<Connector>();

function keepCurrentChain(connector: Connector) {
  if (patched.has(connector)) return;
  patched.add(connector);
  const connect = connector.connect.bind(connector);
  connector.connect = async (parameters) => {
    const reconnecting = parameters?.isReconnecting === true;
    if (!reconnecting) reportWalletConnect('idle');
    try {
      return await connect({ ...parameters, chainId: undefined });
    } catch (error) {
      if (!reconnecting) reportWalletConnect(isUserRejection(error) ? 'rejected' : 'error');
      throw error;
    }
  };
}

const connectors = connectorsForWallets(
  [{ groupName: 'Installed', wallets: [injectedWallet] }],
  {
    appName: 'RWAComply',
    // WalletConnect is not configured. This value is not a project id and is unused by the injected wallet.
    projectId: 'rwacomply-injected-only',
  },
);

const includeAnvil = process.env.VERCEL !== '1';
const storage = createStorage({
  storage: typeof window === 'undefined' ? noopStorage : window.localStorage,
});

const config = includeAnvil
  ? createConfig({
      connectors,
      chains: [sepolia, anvil],
      multiInjectedProviderDiscovery: true,
      transports: { [sepolia.id]: http(), [anvil.id]: http('http://127.0.0.1:8545') },
      ssr: true,
      storage,
    })
  : createConfig({
      connectors,
      chains: [sepolia],
      multiInjectedProviderDiscovery: true,
      transports: { [sepolia.id]: http() },
      ssr: true,
      storage,
    });

function patchConnectors() {
  config.connectors.forEach(keepCurrentChain);
}

if (typeof window !== 'undefined') {
  patchConnectors();
  config._internal.connectors.subscribe((next) => {
    next.forEach(keepCurrentChain);
  });
}

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    patchConnectors();
  }, []);
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme({ accentColor: '#7192BE', accentColorForeground: '#000000', borderRadius: 'medium', overlayBlur: 'none' })}>
          <TransactionProvider>{children}</TransactionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
