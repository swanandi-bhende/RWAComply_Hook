export function verificationFailure(reason: string): string {
  if (reason === 'cancelled') return 'Verification was cancelled. No wallet was registered.';
  if (reason === 'timeout') return 'This World App request expired. Start verification again.';
  if (reason === 'world_app_unavailable') return 'The World App request could not be created. Check the connection and try again.';
  if (reason === 'environment_mismatch') return 'The World ID environment does not match this server.';
  if (reason === 'configuration') return 'World ID app or relying party configuration is missing.';
  if (reason === 'proof_failed' || reason === 'verification_rejected') {
    return 'Verification could not be completed. Please try again.';
  }
  if (reason === 'already_enrolled') {
    return 'This identity is already verified. Continue the saved session to link a wallet.';
  }
  if (reason === 'expired') {
    return 'This verified session has expired. Verify with World App again only if you intend to start a new proof. The previous allocation is not reset.';
  }
  if (reason === 'missing_session' || reason === 'invalid_session') {
    return 'Your RWAComply session could not be found.';
  }
  if (reason === 'world_unavailable') return 'Verification services are temporarily unavailable.';
  return 'Verification could not be completed. Please try again.';
}

export function walletLinkFailure(reason: string): string {
  if (reason === 'signature_rejected') return 'Your wallet signature was declined.';
  if (reason === 'conflict') return 'This wallet is already associated with another allocation.';
  if (reason === 'expired') return 'Your registration request expired. Please try again.';
  if (reason === 'challenge_rejected') return 'This wallet could not be linked to your existing allocation.';
  return 'This wallet could not be linked to your existing allocation.';
}
