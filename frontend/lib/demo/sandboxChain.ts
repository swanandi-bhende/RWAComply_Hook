import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import { anvil } from 'viem/chains';
import { marketFromCreations, type AnvilMarket } from './anvilDeployment.ts';
import {
  ANVIL_CHAIN_ID,
  ANVIL_RPC,
  DEMO_CAP,
  DEMO_GROUP_ID,
  DEMO_PERIOD_ID,
  LOCAL_SIGNER,
  PERSONAS,
  SANDBOX_ACTIONS,
  STATE_FILE,
  personaWallet,
  type BuyAction,
  type PersonaId,
  type WalletId,
} from './sandbox.ts';

const RPC = ANVIL_RPC;
const transport = http(RPC);
const publicClient = createPublicClient({ chain: anvil, transport });
const walletClient = createWalletClient({ chain: anvil, transport });

const ledgerAbi = [
  { type: 'function', name: 'backendSigner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'allocationIdByWallet', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'spentByAllocation', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'remaining', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'bytes32' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'registerWallet', stateMutability: 'nonpayable', inputs: [
    { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' },
  ], outputs: [] },
] as const;

const hookAbi = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'userTier', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'setTier', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint8' }], outputs: [] },
  { type: 'error', name: 'AllocationExceeded', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'remaining', type: 'uint256' }] },
] as const;

const usdcAbi = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const executorAbi = [
  { type: 'function', name: 'swapExactInput', stateMutability: 'nonpayable', inputs: [
    { type: 'tuple', components: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ] },
    { type: 'uint256' },
  ], outputs: [{ type: 'int256' }] },
] as const;

const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
const REGISTRATION_NONCE = { aliceA: BigInt(1101), aliceB: BigInt(1102), bobA: BigInt(1103) };

export type BudgetReading = {
  address: Address;
  label: string;
  registered: boolean;
  cap: string;
  spent: string;
  remaining: string;
};

export type SandboxSnapshot = {
  chainId: typeof ANVIL_CHAIN_ID;
  network: 'Local Anvil';
  simulatedIdentity: true;
  offering: { name: 'Demo RWA'; token: 'Mock RWA'; cap: string; status: 'Local test market' };
  contracts: { ledger: Address; executor: Address; hook: Address; usdc: Address; rwa: Address };
  alice: { a: BudgetReading; b: BudgetReading };
  bob: { a: BudgetReading };
};

export type PurchaseOutcome = {
  status: 'confirmed' | 'rejected' | 'failed';
  message: string;
  hash?: Hex;
  requested: string;
  spent: string;
  remaining: string;
};

function statePath(): string {
  return path.join(tmpdir(), STATE_FILE);
}

async function anvilCall(method: 'evm_snapshot' | 'evm_revert', params: string[]): Promise<unknown> {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await response.json() as { result?: unknown; error?: { message?: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? 'The local Anvil snapshot request failed.');
  return body.result;
}

function repositoryRoot(): string {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
}

export function readBroadcastMarket(): AnvilMarket {
  const file = path.join(repositoryRoot(), 'broadcast/DeployFull.s.sol/31337/run-latest.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { transactions?: unknown[] };
  const market = marketFromCreations((parsed.transactions ?? []) as Parameters<typeof marketFromCreations>[0]);
  if (!market) throw new Error('The local Anvil deployment is missing a required contract.');
  return market;
}

async function assertLocalChain(): Promise<void> {
  const chainId = await publicClient.getChainId();
  if (chainId !== ANVIL_CHAIN_ID) throw new Error('Refusing to run: the RPC is not local Anvil.');
}

function poolKey(market: AnvilMarket) {
  const usdc = getAddress(market.tokenA);
  const rwa = getAddress(market.tokenB);
  const [currency0, currency1] = usdc.toLowerCase() < rwa.toLowerCase() ? [usdc, rwa] : [rwa, usdc];
  return {
    currency0,
    currency1,
    fee: 8388608,
    tickSpacing: 60,
    hooks: getAddress(market.hook),
  };
}

async function send(account: Address, to: Address, data: Hex): Promise<Hex> {
  return walletClient.sendTransaction({ account, to, data, chain: anvil });
}

async function readBudget(market: AnvilMarket, address: Address, label: string): Promise<BudgetReading> {
  const ledger = getAddress(market.ledger);
  const allocationId = await publicClient.readContract({
    address: ledger,
    abi: ledgerAbi,
    functionName: 'allocationIdByWallet',
    args: [address],
  });
  if (allocationId === ZERO) {
    return { address, label, registered: false, cap: DEMO_CAP.toString(), spent: '0', remaining: '0' };
  }
  const [spent, remaining] = await Promise.all([
    publicClient.readContract({
      address: ledger,
      abi: ledgerAbi,
      functionName: 'spentByAllocation',
      args: [allocationId, DEMO_GROUP_ID, DEMO_PERIOD_ID],
    }),
    publicClient.readContract({
      address: ledger,
      abi: ledgerAbi,
      functionName: 'remaining',
      args: [address, DEMO_GROUP_ID, DEMO_PERIOD_ID],
    }),
  ]);
  return { address, label, registered: true, cap: DEMO_CAP.toString(), spent: spent.toString(), remaining: remaining.toString() };
}

export async function readSandbox(): Promise<SandboxSnapshot> {
  await assertLocalChain();
  const market = readBroadcastMarket();
  const [aliceA, aliceB, bobA] = await Promise.all([
    readBudget(market, PERSONAS.alice.wallets.a.address, 'Alice — Wallet A'),
    readBudget(market, PERSONAS.alice.wallets.b.address, 'Alice — Wallet B'),
    readBudget(market, PERSONAS.bob.wallets.a.address, 'Bob — Wallet A'),
  ]);
  return {
    chainId: ANVIL_CHAIN_ID,
    network: 'Local Anvil',
    simulatedIdentity: true,
    offering: { name: 'Demo RWA', token: 'Mock RWA', cap: DEMO_CAP.toString(), status: 'Local test market' },
    contracts: {
      ledger: getAddress(market.ledger),
      executor: getAddress(market.executor),
      hook: getAddress(market.hook),
      usdc: getAddress(market.tokenA),
      rwa: getAddress(market.tokenB),
    },
    alice: { a: aliceA, b: aliceB },
    bob: { a: bobA },
  };
}

async function signerAccount(market: AnvilMarket): Promise<Address> {
  const signer = await publicClient.readContract({
    address: getAddress(market.ledger),
    abi: ledgerAbi,
    functionName: 'backendSigner',
  });
  const owner = await publicClient.readContract({
    address: getAddress(market.hook),
    abi: hookAbi,
    functionName: 'owner',
  });
  if (getAddress(signer) !== getAddress(LOCAL_SIGNER) || getAddress(owner) !== getAddress(LOCAL_SIGNER)) {
    throw new Error('The local ledger is not owned by the Anvil development account. Run bash script/start_anvil_demo.sh.');
  }
  return getAddress(LOCAL_SIGNER);
}

async function registerPersona(input: {
  market: AnvilMarket;
  signer: Address;
  wallet: Address;
  allocationId: Hex;
  nonce: bigint;
}): Promise<void> {
  const current = await publicClient.readContract({
    address: getAddress(input.market.ledger),
    abi: ledgerAbi,
    functionName: 'allocationIdByWallet',
    args: [input.wallet],
  });
  if (current !== ZERO) {
    if (current.toLowerCase() !== input.allocationId.toLowerCase()) {
      throw new Error('A demo wallet is already registered to a different allocation.');
    }
    return;
  }
  const expiry = BigInt((await publicClient.getBlock()).timestamp) + BigInt(30 * 24 * 60 * 60);
  const signature = await walletClient.signTypedData({
    account: input.signer,
    domain: { name: 'AllocationLedger', version: '1', chainId: ANVIL_CHAIN_ID, verifyingContract: getAddress(input.market.ledger) },
    types: { Registration: [
      { name: 'wallet', type: 'address' },
      { name: 'allocationId', type: 'bytes32' },
      { name: 'groupId', type: 'bytes32' },
      { name: 'expiry', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ] },
    primaryType: 'Registration',
    message: { wallet: input.wallet, allocationId: input.allocationId, groupId: DEMO_GROUP_ID, expiry, nonce: input.nonce },
  });
  const hash = await send(input.signer, getAddress(input.market.ledger), encodeFunctionData({
    abi: ledgerAbi,
    functionName: 'registerWallet',
    args: [input.wallet, input.allocationId, DEMO_GROUP_ID, expiry, input.nonce, signature],
  }));
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Demo wallet registration was not confirmed.');
}

async function prepareWallet(market: AnvilMarket, signer: Address, wallet: Address): Promise<void> {
  const hook = getAddress(market.hook);
  const tier = await publicClient.readContract({ address: hook, abi: hookAbi, functionName: 'userTier', args: [wallet] });
  if (tier === 0) {
    const hash = await send(signer, hook, encodeFunctionData({ abi: hookAbi, functionName: 'setTier', args: [wallet, 1] }));
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Demo tier setup was not confirmed.');
  }
  const usdc = getAddress(market.tokenA);
  const balance = await publicClient.readContract({ address: usdc, abi: usdcAbi, functionName: 'balanceOf', args: [wallet] });
  if (balance < BigInt(2000000000)) {
    const hash = await send(signer, usdc, encodeFunctionData({ abi: usdcAbi, functionName: 'mint', args: [wallet, BigInt(2000000000)] }));
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Demo token funding was not confirmed.');
  }
}

export async function seedSandbox(): Promise<void> {
  await assertLocalChain();
  const market = readBroadcastMarket();
  const signer = await signerAccount(market);
  const registrations = [
    { wallet: PERSONAS.alice.wallets.a.address, allocationId: PERSONAS.alice.allocationId, nonce: REGISTRATION_NONCE.aliceA },
    { wallet: PERSONAS.alice.wallets.b.address, allocationId: PERSONAS.alice.allocationId, nonce: REGISTRATION_NONCE.aliceB },
    { wallet: PERSONAS.bob.wallets.a.address, allocationId: PERSONAS.bob.allocationId, nonce: REGISTRATION_NONCE.bobA },
  ] as const;
  for (const item of registrations) {
    await registerPersona({ market, signer, ...item });
    await prepareWallet(market, signer, item.wallet);
  }
  const snapshot = await anvilCall('evm_snapshot', []);
  if (typeof snapshot !== 'string' || !snapshot.startsWith('0x')) throw new Error('Anvil did not return a demo snapshot.');
  writeFileSync(statePath(), `${snapshot}\n`);
}

export async function resetSandbox(): Promise<SandboxSnapshot> {
  await assertLocalChain();
  const snapshot = readFileSync(statePath(), 'utf8').trim();
  if (!/^0x[0-9a-fA-F]{1,16}$/.test(snapshot)) {
    throw new Error('The local demo snapshot is missing. Run bash script/start_anvil_demo.sh.');
  }
  const reverted = await anvilCall('evm_revert', [snapshot]);
  if (reverted !== true) throw new Error('The local demo snapshot could not be restored.');
  const next = await anvilCall('evm_snapshot', []);
  if (typeof next !== 'string') throw new Error('Anvil did not return a demo snapshot.');
  writeFileSync(statePath(), `${next}\n`);
  return readSandbox();
}

function allocationRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('AllocationExceeded') || message.toLowerCase().includes('cbfc2b28');
}

export async function runPurchase(action: BuyAction): Promise<PurchaseOutcome> {
  await assertLocalChain();
  const spec = SANDBOX_ACTIONS[action];
  const selected = personaWallet(spec.persona, spec.wallet);
  if (!selected) throw new Error('Unknown demo wallet.');
  const market = readBroadcastMarket();
  const before = await readBudget(market, selected.address, selected.label);
  if (!before.registered) throw new Error('This demo wallet is not registered on the local ledger.');
  const executor = getAddress(market.executor);
  const usdc = getAddress(market.tokenA);
  const approveHash = await send(selected.address, usdc, encodeFunctionData({
    abi: usdcAbi,
    functionName: 'approve',
    args: [executor, spec.amount],
  }));
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== 'success') {
    return { status: 'failed', message: 'Failed', hash: approveHash, requested: spec.amount.toString(), spent: before.spent, remaining: before.remaining };
  }
  const data = encodeFunctionData({ abi: executorAbi, functionName: 'swapExactInput', args: [poolKey(market), spec.amount] });
  const hash = await send(selected.address, executor, data);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const after = await readBudget(market, selected.address, selected.label);
  if (receipt.status === 'success') {
    return { status: 'confirmed', message: 'Confirmed', hash, requested: spec.amount.toString(), spent: after.spent, remaining: after.remaining };
  }
  let rejected = false;
  try {
    await publicClient.call({ account: selected.address, to: executor, data });
  } catch (error) {
    rejected = allocationRejection(error);
  }
  return {
    status: rejected ? 'rejected' : 'failed',
    message: rejected ? 'Rejected by allocation limit' : 'Failed',
    hash,
    requested: spec.amount.toString(),
    spent: after.spent,
    remaining: after.remaining,
  };
}

export function knownGroup(): Hex {
  return keccak256(toBytes('rwa-comply-demo'));
}

export type { PersonaId, WalletId };
