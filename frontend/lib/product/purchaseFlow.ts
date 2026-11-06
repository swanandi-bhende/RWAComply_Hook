export type RouterPhase = 'idle' | 'approving' | 'registering' | 'swapping' | 'success' | 'rejected';

export const REMAINING_BUDGET_MESSAGE = 'remaining budget is not enough.';
export const UNREGISTERED_WALLET_MESSAGE = 'This wallet is not registered.';
export const PAUSED_POOL_MESSAGE = 'The pool is paused.';

export function routerRejectionMessage(raw: string): string | null {
  const lowered = raw.toLowerCase();
  if (
    lowered.includes('retaillimitexceeded')
    || lowered.includes('allocationexceeded')
    || lowered.includes('capexceeded')
  ) {
    return REMAINING_BUDGET_MESSAGE;
  }
  if (lowered.includes('walletnotregistered')) return UNREGISTERED_WALLET_MESSAGE;
  if (lowered.includes('poolpaused')) return PAUSED_POOL_MESSAGE;
  return null;
}

export function routerPhaseLabel(phase: RouterPhase): string {
  if (phase === 'approving') return 'Approving';
  if (phase === 'registering') return 'Registering';
  if (phase === 'swapping') return 'Swapping';
  if (phase === 'success') return 'Success';
  if (phase === 'rejected') return 'Hook rejection';
  return 'Ready';
}
