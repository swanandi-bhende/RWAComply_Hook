export function verificationFailure(reason: string): string {
  if (reason === 'cancelled') return 'Verification was cancelled. No wallet was registered.';
  if (reason === 'timeout') return 'Verification timed out. You can try again.';
  if (reason === 'world_app_unavailable') return 'World App is not available on this device.';
  if (reason === 'proof_failed' || reason === 'verification_rejected') {
    return 'Verification could not be completed. Please try again.';
  }
  if (reason === 'already_enrolled') {
    return 'This identity is already verified. Continue the saved session to link a wallet.';
  }
  if (reason === 'missing_session' || reason === 'invalid_session') {
    return 'Your RWAComply session could not be found.';
  }
  if (reason === 'world_unavailable') return 'Verification services are temporarily unavailable.';
  return 'Verification could not be completed. Please try again.';
}

export function walletLinkFailure(reason: string): string {
  if (reason === 'signature_rejected') return 'The wallet signature was cancelled.';
  if (reason === 'conflict') return 'This wallet is already associated with another allocation.';
  if (reason === 'expired') return 'Your registration request expired. Please try again.';
  if (reason === 'challenge_rejected') return 'This wallet could not be linked to your existing allocation.';
  return 'This wallet could not be linked to your existing allocation.';
}
