export type RouterPhase = 'idle' | 'approving' | 'registering' | 'swapping' | 'success' | 'rejected';

export const REMAINING_BUDGET_MESSAGE = 'The purchase exceeds your remaining allocation.';
export const UNREGISTERED_WALLET_MESSAGE = 'Verify with World ID before purchasing.';
export const PAUSED_POOL_MESSAGE = 'The pool is paused.';
export const EXACT_INPUT_MESSAGE = 'This offering supports exact-input purchases only.';
export const QUOTE_TOKEN_MESSAGE = 'This pool does not use the supported quote token.';
export const ROUTE_MESSAGE = 'This trading route is not supported.';
export const REVERTED_PURCHASE_MESSAGE = 'The transaction reverted. Your allocation was not consumed.';

const REMAINING_BUDGET_SELECTORS = ['2a1c7c8f', 'cbfc2b28', '0cf95ce5'];
const UNREGISTERED_SELECTOR = '239a7cdf';
const PAUSED_SELECTOR = '51bd770c';
const EXACT_INPUT_SELECTOR = '3674ff33';
const QUOTE_TOKEN_SELECTOR = '62e5a4d2';
const ROUTE_SELECTOR = '9e5aca9d';

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
  if (lowered.includes('exactinputrequired') || lowered.includes(EXACT_INPUT_SELECTOR)) return EXACT_INPUT_MESSAGE;
  if (lowered.includes('unsupportedinputcurrency') || lowered.includes(QUOTE_TOKEN_SELECTOR)) return QUOTE_TOKEN_MESSAGE;
  if (lowered.includes('untrustedrouter') || lowered.includes(ROUTE_SELECTOR)) return ROUTE_MESSAGE;
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
