export type RouterPhase = 'idle' | 'approving' | 'registering' | 'swapping' | 'success' | 'rejected';

export const REMAINING_BUDGET_MESSAGE = 'remaining budget is not enough.';
export const UNREGISTERED_WALLET_MESSAGE = 'This wallet is not registered.';
export const PAUSED_POOL_MESSAGE = 'The pool is paused.';

const REMAINING_BUDGET_SELECTORS = ['2a1c7c8f', 'cbfc2b28', '0cf95ce5'];
const UNREGISTERED_SELECTOR = '239a7cdf';
const PAUSED_SELECTOR = '51bd770c';

export function routerRejectionMessage(raw: string): string | null {
  const lowered = raw.toLowerCase();
  if (
    lowered.includes('retaillimitexceeded')
    || lowered.includes('allocationexceeded')
    || lowered.includes('capexceeded')
    || REMAINING_BUDGET_SELECTORS.some((selector) => lowered.includes(selector))
  ) {
    return REMAINING_BUDGET_MESSAGE;
  }
  if (lowered.includes('walletnotregistered') || lowered.includes(UNREGISTERED_SELECTOR)) {
    return UNREGISTERED_WALLET_MESSAGE;
  }
  if (lowered.includes('poolpaused') || lowered.includes(PAUSED_SELECTOR)) return PAUSED_POOL_MESSAGE;
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
