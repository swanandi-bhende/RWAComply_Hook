export const REGISTRATION_LEDGER_UNAVAILABLE =
  'Wallet registration is unavailable because the allocation ledger could not be read.';

export type EnrollmentPhase =
  | 'idle'
  | 'verifying'
  | 'awaiting_signature'
  | 'awaiting_transaction'
  | 'failed';

export function registrationPreflight(input: {
  registrationReady: boolean;
  ledgerKnown: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (!input.registrationReady || !input.ledgerKnown) {
    return { ok: false, message: REGISTRATION_LEDGER_UNAVAILABLE };
  }
  return { ok: true };
}

export function enrollmentButton(input: {
  connected: boolean;
  onSupportedNetwork: boolean;
  walletReady: boolean;
  alreadyRegistered: boolean;
  phase: EnrollmentPhase;
  marketLoading?: boolean;
  arkivUnavailable?: boolean;
}): { disabled: boolean; label: string; explanation: string } {
  if (input.alreadyRegistered) {
    return { disabled: true, label: 'Wallet linked', explanation: 'This wallet is already registered.' };
  }
  if (!input.connected) {
    return { disabled: true, label: 'Verify with World App', explanation: 'Connect a wallet to continue.' };
  }
  if (!input.onSupportedNetwork) {
    return { disabled: true, label: 'Verify with World App', explanation: 'Switch to Ethereum Sepolia.' };
  }
  if (!input.walletReady) {
    return {
      disabled: true,
      label: 'Verify with World App',
      explanation: 'Waiting for the wallet connection to finish.',
    };
  }
  if (input.phase === 'verifying') {
    return { disabled: true, label: 'Waiting for World App', explanation: 'Complete the proof in World App.' };
  }
  if (input.phase === 'awaiting_signature') {
    return { disabled: true, label: 'Continue with wallet signature', explanation: 'Sign the wallet ownership message.' };
  }
  if (input.phase === 'awaiting_transaction') {
    return { disabled: true, label: 'Confirm wallet registration', explanation: 'Confirm the registration transaction in the wallet.' };
  }
  return {
    disabled: false,
    label: 'Verify with World App',
    explanation: '',
  };
}
