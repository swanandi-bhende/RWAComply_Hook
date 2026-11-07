export type WalletConnectResult = 'idle' | 'rejected' | 'error';

let connectResult: WalletConnectResult = 'idle';
const connectListeners = new Set<() => void>();

export function reportWalletConnect(result: WalletConnectResult) {
  connectResult = result;
  connectListeners.forEach((listener) => listener());
}

export function subscribeWalletConnect(listener: () => void) {
  connectListeners.add(listener);
  return () => {
    connectListeners.delete(listener);
  };
}

export function getWalletConnectResult(): WalletConnectResult {
  return connectResult;
}

export type WalletConnectionState = 'disconnected' | 'connecting' | 'connected' | 'rejected' | 'error';
export type WalletNetworkState = 'unknown' | 'sepolia' | 'wrong' | 'switching' | 'switch_rejected';
export type DemoIdentityView = 'off' | 'none' | 'creating' | 'active' | 'expired' | 'unavailable';

export type WalletStatusInput = {
  wallet: WalletConnectionState;
  network: WalletNetworkState;
  demo: DemoIdentityView;
  address?: string;
  linked: boolean;
};

const WRONG_NETWORK = 'Wallet connected. Switch to Ethereum Sepolia to continue.';

export function isUserRejection(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 4) return false;
  const value = error as { code?: unknown; name?: unknown; cause?: unknown };
  if (value.code === 4001 || value.name === 'UserRejectedRequestError') return true;
  return isUserRejection(value.cause, depth + 1);
}

export function walletStatusCopy(input: WalletStatusInput): { wallet: string; network: string; demo: string } {
  let wallet = '';
  let network = '';
  if (input.wallet === 'connecting') wallet = 'Connecting wallet…';
  else if (input.wallet === 'rejected') wallet = 'The wallet connection was cancelled.';
  else if (input.wallet === 'error') wallet = 'The wallet could not be connected. Try again.';
  else if (input.wallet === 'connected' && input.address) {
    wallet = `Wallet connected: ${input.address}`;
    if (input.network !== 'sepolia') network = WRONG_NETWORK;
  } else if (input.demo !== 'off') wallet = 'Connect your wallet to register it with this demo identity.';
  else wallet = 'Connect your wallet from the header. Connecting a wallet does not register it.';

  let demo = '';
  if (input.demo === 'unavailable') demo = 'Demo identity is unavailable.';
  else if (input.demo === 'creating') demo = 'Creating a demo identity for this browser.';
  else if (input.demo === 'expired') demo = 'This demo identity expired. Start a new demo identity. Wallets already registered stay registered.';
  else if (input.demo === 'active' && input.wallet === 'connected' && input.network === 'sepolia' && input.linked) {
    demo = 'Wallet linked to this demo allocation.';
  } else if (input.demo === 'active' && input.wallet === 'connected' && input.network === 'sepolia') {
    demo = 'Demo identity active. Wallet connected. Sign the ownership message to register this wallet.';
  } else if (input.demo === 'active' && input.wallet !== 'connected') {
    demo = 'Demo identity active. Connect a wallet to link it.';
  }
  return { wallet, network, demo };
}
