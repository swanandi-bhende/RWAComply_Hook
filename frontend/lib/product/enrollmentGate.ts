export const REGISTRATION_LEDGER_UNAVAILABLE =
  'The allocation ledger could not be reached.';

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
  prompt?: 'creating' | 'qr_ready' | 'retrieved' | 'checking';
  identity?: 'unverified' | 'verified' | 'expired';
  marketLoading?: boolean;
  arkivUnavailable?: boolean;
  infrastructure?: 'allocation signer' | 'contract owner' | null;
}): { disabled: boolean; label: string; explanation: string } {
  if (input.infrastructure) {
    return {
      disabled: true,
      label: 'Use an investor wallet',
      explanation: `This wallet is the ${input.infrastructure}. Use a separate funded investor wallet. The ledger does not reject this address; registration stays disabled so an infrastructure account is not enrolled as an investor.`,
    };
  }
  if (input.alreadyRegistered) {
    return { disabled: true, label: 'Wallet linked', explanation: 'This wallet is already registered.' };
  }
  if (!input.connected) {
    if (input.identity === 'verified') {
      return {
        disabled: true,
        label: 'Continue and register this wallet',
        explanation: 'Proof of human is already verified. Connect the next wallet. Connecting it does not link it.',
      };
    }
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
    if (input.prompt === 'creating') {
      return { disabled: true, label: 'Creating verification request', explanation: 'RWAComply is creating the World App request.' };
    }
    if (input.prompt === 'checking') {
      return { disabled: true, label: 'Checking the proof', explanation: 'Proof received. RWAComply is verifying it with World.' };
    }
    if (input.prompt === 'qr_ready') {
      return {
        disabled: true,
        label: 'Waiting for World App',
        explanation: 'Scan the QR code with the Sandbox World App. The app must show the RWAComply request before you approve it.',
      };
    }
    if (input.prompt === 'retrieved') {
      return {
        disabled: true,
        label: 'Approve in World App',
        explanation: 'World App has the RWAComply request. Approve proof of human there. RWAComply still has to check the proof.',
      };
    }
    return { disabled: true, label: 'Waiting for World App', explanation: 'Complete the proof in World App.' };
  }
  if (input.phase === 'awaiting_signature') {
    return { disabled: true, label: 'Continue with wallet signature', explanation: 'Sign the wallet ownership message.' };
  }
  if (input.phase === 'awaiting_transaction') {
    return { disabled: true, label: 'Confirm wallet registration', explanation: 'Confirm the registration transaction in the wallet.' };
  }
  if (input.identity === 'verified') {
    return {
      disabled: false,
      label: 'Continue and register this wallet',
      explanation: 'Proof of human is already verified. This wallet still has to sign ownership and register on Ethereum. Connecting it does not link it.',
    };
  }
  if (input.identity === 'expired') {
    return {
      disabled: false,
      label: 'Verify with World App',
      explanation: 'The saved session expired. Verifying again is a new proof. It does not reset an allocation that is already onchain.',
    };
  }
  return {
    disabled: false,
    label: 'Verify with World App',
    explanation: 'World App checks proof of human once for this person. It is not KYC or legal eligibility.',
  };
}
