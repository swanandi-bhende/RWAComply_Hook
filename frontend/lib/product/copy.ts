export function verificationFailure(reason: string): string {
  if (reason === 'cancelled') return 'Verification was cancelled.';
  if (reason === 'timeout') return 'Verification timed out. You can try again.';
  if (reason === 'world_app_unavailable') return 'World App is not available on this device.';
  if (reason === 'proof_failed' || reason === 'verification_rejected') {
    return 'Identity verification was not accepted.';
  }
  if (reason === 'already_enrolled') {
    return 'This identity is already verified. Continue the saved session to link a wallet.';
  }
  if (reason === 'missing_session' || reason === 'invalid_session') {
    return 'Verify your identity before linking a wallet.';
  }
  if (reason === 'world_unavailable') return 'Identity verification is temporarily unavailable.';
  return 'Identity verification could not be completed.';
}

export function walletLinkFailure(reason: string): string {
  if (reason === 'signature_rejected') return 'The wallet signature was cancelled.';
  if (reason === 'conflict') return 'This wallet is already linked to a different allocation.';
  if (reason === 'challenge_rejected') return 'The wallet link could not be prepared.';
  return 'The wallet link could not be prepared.';
}
