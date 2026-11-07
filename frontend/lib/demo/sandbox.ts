import { keccak256, toBytes, type Hex } from 'viem';
import { demoMode, type DemoMode } from '../world/demoMode.ts';

export const ANVIL_RPC = 'http://127.0.0.1:8545';
export const ANVIL_CHAIN_ID = 31337;
export const DEMO_GROUP_ID = keccak256(toBytes('rwa-comply-demo'));
export const DEMO_PERIOD_ID = BigInt(1);
export const DEMO_CAP = BigInt(1000000000);
export const STATE_FILE = 'rwacomply-anvil-demo-state.json';

export const PERSONAS = {
  alice: {
    label: 'Alice',
    allocationId: keccak256(toBytes('rwa-comply-demo-alice')),
    wallets: {
      a: { label: 'Wallet A', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
      b: { label: 'Wallet B', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
    },
  },
  bob: {
    label: 'Bob',
    allocationId: keccak256(toBytes('rwa-comply-demo-bob')),
    wallets: {
      a: { label: 'Wallet A', address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' },
    },
  },
} as const;

export const LOCAL_SIGNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

export const SANDBOX_ACTIONS = {
  'buy-700': { persona: 'alice', wallet: 'a', amount: BigInt(700000000) },
  'attempt-500': { persona: 'alice', wallet: 'b', amount: BigInt(500000000) },
  'buy-200': { persona: 'alice', wallet: 'b', amount: BigInt(200000000) },
} as const;

export type PersonaId = keyof typeof PERSONAS;
export type WalletId = 'a' | 'b';
export type BuyAction = keyof typeof SANDBOX_ACTIONS;
export type SandboxAction = 'status' | 'reset' | BuyAction;

const ALLOWED_FIELDS = new Set(['action', 'persona', 'wallet']);

export const HOSTED_DEMO_UNAVAILABLE = 'The guided demonstration runs on a local Anvil chain during a live presentation. This deployment has no hosted demo chain, so it does not connect to a local RPC and does not show transaction results. See How it works for the product explanation.';

export function localDemoAllowed(env: { [key: string]: string | undefined }, hostHeader: string | null): boolean {
  return demoMode(env, hostHeader) === 'local';
}

export function sandboxAvailability(env: { [key: string]: string | undefined }, hostHeader: string | null): { available: true } | { available: false; message: string } {
  if (localDemoAllowed(env, hostHeader)) return { available: true };
  return { available: false, message: HOSTED_DEMO_UNAVAILABLE };
}

export function demoModeLabel(mode: DemoMode): string {
  return mode;
}

export type ParsedSandbox =
  | { ok: true; action: 'status' | 'reset' }
  | { ok: true; action: BuyAction; persona: PersonaId; wallet: WalletId }
  | { ok: false; error: string };

export function parseSandboxRequest(value: unknown): ParsedSandbox {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Invalid request body' };
  const body = value as Record<string, unknown>;
  const unexpected = Object.keys(body).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unexpected.length > 0) return { ok: false, error: 'Unsupported request field' };
  const action = body.action;
  if (action === 'status' || action === 'reset') {
    if ('persona' in body || 'wallet' in body) return { ok: false, error: 'Unsupported request field' };
    return { ok: true, action };
  }
  if (action !== 'buy-700' && action !== 'attempt-500' && action !== 'buy-200') {
    return { ok: false, error: 'Unknown demo action' };
  }
  const expected = SANDBOX_ACTIONS[action];
  if (body.persona !== expected.persona || body.wallet !== expected.wallet) {
    return { ok: false, error: 'This action is not available for the selected persona and wallet' };
  }
  return { ok: true, action, persona: expected.persona, wallet: expected.wallet };
}

export function personaWallet(persona: PersonaId, wallet: WalletId): { label: string; address: `0x${string}`; allocationId: Hex } | null {
  const selected = PERSONAS[persona];
  const entry = wallet === 'a' ? selected.wallets.a : 'b' in selected.wallets ? selected.wallets.b : undefined;
  if (!entry) return null;
  return { label: entry.label, address: entry.address, allocationId: selected.allocationId };
}
