import type { DemoIdentityView, WalletConnectionState, WalletNetworkState } from './walletConnection.ts';

export type IdentityMode = 'demo' | 'world_id' | 'choice';
export type WorldIdentityState = 'unverified' | 'verified' | 'expired';
export type RegistrationAttempt =
  | 'idle'
  | 'signature_pending'
  | 'signature_rejected'
  | 'transaction_pending'
  | 'transaction_rejected'
  | 'receipt_failed'
  | 'conflict'
  | 'failed';

export const DEMO_READY = 'Demo identity active. Wallet connected. Sign the ownership message to register this wallet.';
export const DEMO_UNLINKED = 'Demo identity active. This wallet has not been linked yet.';
export const DEMO_LINKED_PRIMARY = 'Wallet linked to this demo allocation.';
export const DEMO_LINKED_STATUS = 'This wallet is linked to your demo allocation.';

export function identityMode(input: { demo: DemoIdentityView; world: WorldIdentityState }): IdentityMode {
  if (input.demo === 'active') return 'demo';
  if (input.demo === 'off' || input.world === 'verified' || input.world === 'expired') return 'world_id';
  return 'choice';
}

export function demoRegistrationCopy(input: {
  wallet: WalletConnectionState;
  network: WalletNetworkState;
  linked: boolean;
  attempt: RegistrationAttempt;
}): { demo: string; register: string } {
  if (input.linked) return { demo: DEMO_LINKED_PRIMARY, register: DEMO_LINKED_STATUS };
  if (input.attempt === 'signature_pending') {
    const text = 'Wallet ownership signature pending.';
    return { demo: text, register: text };
  }
  if (input.attempt === 'signature_rejected') {
    const text = 'The wallet ownership signature was rejected. This wallet was not registered.';
    return { demo: text, register: text };
  }
  if (input.attempt === 'transaction_pending') {
    const text = 'Registration transaction pending.';
    return { demo: text, register: text };
  }
  if (input.attempt === 'transaction_rejected') {
    const text = 'The registration transaction was rejected. This wallet was not registered.';
    return { demo: text, register: text };
  }
  if (input.attempt === 'receipt_failed') {
    const text = 'Receipt verification failed. This wallet was not registered.';
    return { demo: text, register: text };
  }
  if (input.attempt === 'conflict') {
    const text = 'This wallet is already associated with another allocation.';
    return { demo: text, register: text };
  }
  if (input.attempt === 'failed') {
    const text = 'The wallet was not registered.';
    return { demo: text, register: text };
  }
  if (input.wallet !== 'connected') {
    const text = 'Demo identity active. Connect a wallet to link it.';
    return { demo: text, register: 'Demo identity active. No wallet is connected.' };
  }
  if (input.network !== 'sepolia') {
    return {
      demo: 'Demo identity active. Wallet connected. Registration waits until the wallet is on Ethereum Sepolia.',
      register: 'Demo identity active. This wallet is connected. Registration is unavailable until it is on Ethereum Sepolia.',
    };
  }
  return { demo: DEMO_READY, register: DEMO_UNLINKED };
}

export function registrationAttemptFromAuthorization(reason: string): RegistrationAttempt {
  if (reason === 'signature_rejected') return 'signature_rejected';
  if (reason === 'conflict') return 'conflict';
  return 'failed';
}

export function registrationAttemptFromSubmission(state: string): RegistrationAttempt {
  if (state === 'rejected' || state === 'failed') return 'transaction_rejected';
  if (state === 'verification_error') return 'receipt_failed';
  if (state === 'conflict') return 'conflict';
  if (state === 'pending') return 'transaction_pending';
  return 'failed';
}
