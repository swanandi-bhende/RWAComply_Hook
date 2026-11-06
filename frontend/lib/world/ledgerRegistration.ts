import {
  decodeEventLog,
  getAddress,
  isAddress,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';

export const LEDGER_REGISTRATION_ABI = parseAbi([
  'function registerWallet(address wallet, bytes32 allocationId, bytes32 groupId, uint256 expiry, uint256 nonce, bytes signature)',
  'function allocationIdByWallet(address wallet) view returns (bytes32)',
  'function backendSigner() view returns (address)',
  'function usedNonce(uint256 nonce) view returns (bool)',
  'event WalletRegistered(address indexed wallet, bytes32 indexed allocationId, bytes32 indexed groupId, uint256 expiry, uint256 nonce)',
]);

const ZERO_ALLOCATION = `0x${'0'.repeat(64)}` as Hex;

export type RegisterWalletArgs = {
  wallet: Address;
  allocationId: Hex;
  groupId: Hex;
  expiry: bigint;
  nonce: bigint;
  signature: Hex;
};

export type ParsedRegistration = {
  wallet: Address;
  allocationId: Hex;
  groupId: Hex;
  expiry: number;
  nonce: bigint;
  signature: Hex;
  chainId: number;
  verifyingContract: Address;
};

export type LedgerLog = {
  address: Address;
  topics: Hex[];
  data: Hex;
};

export type LedgerReceipt = {
  status: 'success' | 'reverted';
  to: Address | null;
  logs: LedgerLog[];
};

export type LedgerRegistrationClient = {
  getAllocationId: (wallet: Address) => Promise<Hex>;
  getNonceUsed: (nonce: bigint) => Promise<boolean>;
  getBackendSigner: () => Promise<Address>;
  simulateRegister: (args: RegisterWalletArgs) => Promise<void>;
  sendRegister: (args: RegisterWalletArgs) => Promise<Hex>;
  waitForReceipt: (hash: Hex) => Promise<LedgerReceipt | null>;
};

export type RegistrationState =
  | 'ready'
  | 'already_linked'
  | 'confirmed'
  | 'conflict'
  | 'rejected'
  | 'wrong_network'
  | 'expired'
  | 'pending'
  | 'failed'
  | 'verification_error'
  | 'unavailable'
  | 'invalid';

export type RegistrationProgress = {
  ok: boolean;
  state: RegistrationState;
  message: string;
  transactionHash?: Hex;
};

const MESSAGES = {
  ready: 'Confirm wallet registration',
  linked: 'Wallet linked to your shared allocation',
  conflict: 'This wallet is already linked to a different allocation',
  pending: 'Registration pending',
  rejected: 'Wallet registration was cancelled',
  wrongNetwork: 'Switch to the network for this allocation before linking this wallet',
  expired: 'This wallet link has expired. Verify your identity again.',
  failed: 'Wallet registration failed',
  verification: 'Wallet registration could not be verified',
  unavailable: 'Wallet registration is not available yet',
  invalid: 'This wallet link is incomplete',
  wrongWallet: 'Link this wallet from the account that owns it',
  gas: 'The wallet does not have enough gas to register',
} as const;

function isBytes32(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function uint256(value: unknown): bigint | undefined {
  if (typeof value === 'bigint' && value >= BigInt(0)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) return undefined;
  try {
    const parsed = BigInt(value);
    if (parsed.toString(16).length > 64) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function parseRegistrationAuthorization(value: unknown): ParsedRegistration | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const body = value as Record<string, unknown>;
  const nonce = uint256(body.nonce);
  const expiry = uint256(body.expiry);
  if (
    !nonce ||
    expiry === undefined ||
    typeof body.wallet !== 'string' ||
    !isAddress(body.wallet) ||
    typeof body.verifyingContract !== 'string' ||
    !isAddress(body.verifyingContract) ||
    !isBytes32(body.allocationId) ||
    !isBytes32(body.groupId) ||
    BigInt(body.allocationId) === BigInt(0) ||
    BigInt(body.groupId) === BigInt(0) ||
    typeof body.signature !== 'string' ||
    !/^0x[0-9a-fA-F]{130}$/.test(body.signature) ||
    typeof body.chainId !== 'number' ||
    !Number.isSafeInteger(body.chainId) ||
    body.chainId <= 0
  ) {
    return undefined;
  }
  const wallet = getAddress(body.wallet);
  const ledger = getAddress(body.verifyingContract);
  if (wallet === '0x0000000000000000000000000000000000000000') return undefined;
  if (ledger === '0x0000000000000000000000000000000000000000') return undefined;
  return {
    wallet,
    allocationId: body.allocationId.toLowerCase() as Hex,
    groupId: body.groupId.toLowerCase() as Hex,
    expiry: Number(expiry),
    nonce,
    signature: body.signature as Hex,
    chainId: body.chainId,
    verifyingContract: ledger,
  };
}

function argsOf(authorization: ParsedRegistration): RegisterWalletArgs {
  return {
    wallet: authorization.wallet,
    allocationId: authorization.allocationId,
    groupId: authorization.groupId,
    expiry: BigInt(authorization.expiry),
    nonce: authorization.nonce,
    signature: authorization.signature,
  };
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function decodeWalletRegistered(log: LedgerLog): {
  wallet: Address;
  allocationId: Hex;
  groupId: Hex;
  expiry: bigint;
  nonce: bigint;
} | undefined {
  try {
    if (log.topics.length === 0) return undefined;
    const decoded = decodeEventLog({
      abi: LEDGER_REGISTRATION_ABI,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });
    if (decoded.eventName !== 'WalletRegistered') return undefined;
    const args = decoded.args as {
      wallet: Address;
      allocationId: Hex;
      groupId: Hex;
      expiry: bigint;
      nonce: bigint;
    };
    return args;
  } catch {
    return undefined;
  }
}

export function chainRegistrationVerdict(input: {
  authorization: ParsedRegistration;
  receipt: LedgerReceipt;
  allocationId: Hex;
  nonceUsed: boolean;
}): 'confirmed' | 'reverted' | 'wrong_contract' | 'event_mismatch' | 'allocation_mismatch' | 'nonce_unused' {
  if (input.receipt.status !== 'success') return 'reverted';
  if (!input.receipt.to || !sameHex(input.receipt.to, input.authorization.verifyingContract)) {
    return 'wrong_contract';
  }
  const event = input.receipt.logs
    .filter((log) => sameHex(log.address, input.authorization.verifyingContract))
    .map(decodeWalletRegistered)
    .find((item) => item !== undefined);
  if (
    !event ||
    !sameHex(event.wallet, input.authorization.wallet) ||
    !sameHex(event.allocationId, input.authorization.allocationId) ||
    !sameHex(event.groupId, input.authorization.groupId) ||
    event.expiry !== BigInt(input.authorization.expiry) ||
    event.nonce !== input.authorization.nonce
  ) {
    return 'event_mismatch';
  }
  if (!sameHex(input.allocationId, input.authorization.allocationId)) return 'allocation_mismatch';
  if (!input.nonceUsed) return 'nonce_unused';
  return 'confirmed';
}

function failureFrom(error: unknown): RegistrationProgress {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if (name === 'UserRejectedRequestError' || message.toLowerCase().includes('user rejected')) {
    return { ok: false, state: 'rejected', message: MESSAGES.rejected };
  }
  if (message.includes('AuthorizationExpired')) {
    return { ok: false, state: 'expired', message: MESSAGES.expired };
  }
  if (message.includes('NonceAlreadyUsed')) {
    return { ok: false, state: 'failed', message: 'This wallet link was already used. Verify your identity again.' };
  }
  if (message.includes('AllocationMismatch')) {
    return { ok: false, state: 'conflict', message: MESSAGES.conflict };
  }
  if (message.toLowerCase().includes('insufficient') || message.toLowerCase().includes('gas')) {
    return { ok: false, state: 'failed', message: MESSAGES.gas };
  }
  return { ok: false, state: 'failed', message: MESSAGES.failed };
}

export async function inspectRegistration(input: {
  authorization: unknown;
  connectedWallet?: string;
  chainId?: number;
  ledgerAddress?: string;
  groupId?: string;
  nowSeconds?: number;
  client?: Pick<LedgerRegistrationClient, 'getAllocationId'>;
}): Promise<RegistrationProgress> {
  if (!input.ledgerAddress) return { ok: false, state: 'unavailable', message: MESSAGES.unavailable };
  const authorization = parseRegistrationAuthorization(input.authorization);
  if (!authorization) return { ok: false, state: 'invalid', message: MESSAGES.invalid };
  if (!input.connectedWallet || !isAddress(input.connectedWallet)) {
    return { ok: false, state: 'invalid', message: MESSAGES.wrongWallet };
  }
  if (getAddress(input.connectedWallet) !== authorization.wallet) {
    return { ok: false, state: 'invalid', message: MESSAGES.wrongWallet };
  }
  if (input.chainId !== authorization.chainId) {
    return { ok: false, state: 'wrong_network', message: MESSAGES.wrongNetwork };
  }
  if (!isAddress(input.ledgerAddress) || getAddress(input.ledgerAddress) !== authorization.verifyingContract) {
    return { ok: false, state: 'unavailable', message: MESSAGES.unavailable };
  }
  if (!input.groupId || !isBytes32(input.groupId) || !sameHex(input.groupId, authorization.groupId)) {
    return { ok: false, state: 'invalid', message: MESSAGES.invalid };
  }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (authorization.expiry < now) return { ok: false, state: 'expired', message: MESSAGES.expired };
  if (!input.client) return { ok: true, state: 'ready', message: MESSAGES.ready };

  let current: Hex;
  try {
    current = await input.client.getAllocationId(authorization.wallet);
  } catch {
    return { ok: false, state: 'unavailable', message: MESSAGES.unavailable };
  }
  if (sameHex(current, ZERO_ALLOCATION)) return { ok: true, state: 'ready', message: MESSAGES.ready };
  if (sameHex(current, authorization.allocationId)) {
    return { ok: true, state: 'already_linked', message: MESSAGES.linked };
  }
  return { ok: false, state: 'conflict', message: MESSAGES.conflict };
}

export async function submitRegistration(input: {
  authorization: unknown;
  connectedWallet?: string;
  chainId?: number;
  ledgerAddress?: string;
  groupId?: string;
  nowSeconds?: number;
  client: LedgerRegistrationClient;
  onUpdate?: (progress: RegistrationProgress) => void;
}): Promise<RegistrationProgress> {
  const inspected = await inspectRegistration(input);
  if (!inspected.ok || inspected.state !== 'ready') return inspected;
  const authorization = parseRegistrationAuthorization(input.authorization);
  if (!authorization) return { ok: false, state: 'invalid', message: MESSAGES.invalid };
  const call = argsOf(authorization);

  try {
    await input.client.simulateRegister(call);
  } catch (error) {
    return failureFrom(error);
  }

  let hash: Hex;
  try {
    hash = await input.client.sendRegister(call);
  } catch (error) {
    return failureFrom(error);
  }
  const pending = { ok: false, state: 'pending' as const, message: MESSAGES.pending, transactionHash: hash };
  input.onUpdate?.(pending);

  let receipt: LedgerReceipt | null;
  try {
    receipt = await input.client.waitForReceipt(hash);
  } catch {
    return pending;
  }
  if (!receipt) return pending;
  if (receipt.status !== 'success') {
    return { ok: false, state: 'failed', message: MESSAGES.failed, transactionHash: hash };
  }

  let allocationId: Hex;
  let nonceUsed: boolean;
  try {
    allocationId = await input.client.getAllocationId(authorization.wallet);
    nonceUsed = await input.client.getNonceUsed(authorization.nonce);
  } catch {
    return { ok: false, state: 'verification_error', message: MESSAGES.verification, transactionHash: hash };
  }
  const verdict = chainRegistrationVerdict({ authorization, receipt, allocationId, nonceUsed });
  if (verdict === 'confirmed') {
    return { ok: true, state: 'confirmed', message: MESSAGES.linked, transactionHash: hash };
  }
  if (verdict === 'reverted') {
    return { ok: false, state: 'failed', message: MESSAGES.failed, transactionHash: hash };
  }
  return { ok: false, state: 'verification_error', message: MESSAGES.verification, transactionHash: hash };
}
