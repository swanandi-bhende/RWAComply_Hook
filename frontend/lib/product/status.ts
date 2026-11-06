import { getAddress, isAddress, type Address, type Hex } from 'viem';

export const SEPOLIA_CHAIN_ID = 11155111;
export const INITIAL_ALLOCATION_PERIOD = BigInt(1);

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export const ALLOCATION_ENV_NAMES = [
  'ALLOCATION_AUTH_SIGNING_KEY',
  'ALLOCATION_AUTH_SIGNER_ADDRESS',
  'ALLOCATION_LEDGER_ADDRESS',
  'ALLOCATION_CHAIN_ID',
  'ALLOCATION_GROUP_ID',
] as const;

export type AllocationEnvName = (typeof ALLOCATION_ENV_NAMES)[number];

export type ConfiguredAllocation = {
  signerAddress: Address;
  ledgerAddress: Address;
  chainId: number;
  groupId: Hex;
};

export type PolicyRead = {
  cap: bigint;
  periodId: bigint;
  usdc: Address;
};

export type ExecutionAddresses = {
  executor: Address;
  hook: Address;
  usdc: Address;
  rwa: Address;
};

export type ProductProbe = {
  chainId: () => Promise<number>;
  hasCode: (address: Address) => Promise<boolean>;
  backendSigner: (ledger: Address) => Promise<Address>;
  policy: (ledger: Address, groupId: Hex, periodId: bigint) => Promise<PolicyRead>;
  hookAllocation: (hook: Address) => Promise<{ groupId: Hex; periodId: bigint }>;
  executorTokens: (executor: Address) => Promise<{ usdc: Address; rwa: Address }>;
};

export type PublicProductStatus = {
  networkName: 'Ethereum Sepolia';
  expectedChainId: typeof SEPOLIA_CHAIN_ID;
  configuredChainId: number | null;
  missing: AllocationEnvName[];
  configurationError: string | null;
  rpcReady: boolean;
  ledger: { address: Address; hasCode: boolean; signerMatches: boolean } | null;
  groupId: Hex | null;
  periodId: string | null;
  policy: { cap: string; periodId: string; usdc: Address } | null;
  execution: {
    available: boolean;
    reason: string | null;
    executor: Address | null;
    hook: Address | null;
    usdc: Address | null;
    rwa: Address | null;
  };
  live: boolean;
};

const SECRET_FIELDS = ['"signingKeyHex"', '"rpcUrl"', '"privateKey"'];

export function missingAllocationEnv(env: Record<string, string | undefined>): AllocationEnvName[] {
  return ALLOCATION_ENV_NAMES.filter((name) => !(env[name]?.trim()));
}

export function parseExecutionAddresses(env: Record<string, string | undefined>): ExecutionAddresses | null {
  const executor = publicAddress(env.NEXT_PUBLIC_EXECUTOR_ADDRESS);
  const hook = publicAddress(env.NEXT_PUBLIC_HOOK_ADDRESS);
  const usdc = publicAddress(env.NEXT_PUBLIC_TOKEN_A_ADDRESS);
  const rwa = publicAddress(env.NEXT_PUBLIC_TOKEN_B_ADDRESS);
  if (!executor || !hook || !usdc || !rwa) return null;
  return { executor, hook, usdc, rwa };
}

function publicAddress(value: string | undefined): Address | null {
  const trimmed = value?.trim() ?? '';
  if (!ADDRESS_PATTERN.test(trimmed) || BigInt(trimmed) === BigInt(0) || !isAddress(trimmed)) return null;
  return getAddress(trimmed);
}

function emptyStatus(partial: Partial<PublicProductStatus> = {}): PublicProductStatus {
  return {
    networkName: 'Ethereum Sepolia',
    expectedChainId: SEPOLIA_CHAIN_ID,
    configuredChainId: null,
    missing: [],
    configurationError: null,
    rpcReady: false,
    ledger: null,
    groupId: null,
    periodId: null,
    policy: null,
    execution: {
      available: false,
      reason: 'The supported purchase market is not configured.',
      executor: null,
      hook: null,
      usdc: null,
      rwa: null,
    },
    live: false,
    ...partial,
  };
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export async function assembleProductStatus(input: {
  env: Record<string, string | undefined>;
  readConfig: () => ConfiguredAllocation;
  probe?: ProductProbe;
}): Promise<PublicProductStatus> {
  const missing = missingAllocationEnv(input.env);
  if (missing.length > 0) {
    return emptyStatus({ missing });
  }

  let config: ConfiguredAllocation;
  try {
    config = input.readConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Allocation configuration is invalid';
    return emptyStatus({ configurationError: message });
  }

  const base = emptyStatus({
    configuredChainId: config.chainId,
    groupId: config.groupId,
    ledger: { address: config.ledgerAddress, hasCode: false, signerMatches: false },
  });
  if (config.chainId !== SEPOLIA_CHAIN_ID) {
    return {
      ...base,
      configurationError: 'ALLOCATION_CHAIN_ID is not Ethereum Sepolia',
    };
  }
  if (!input.probe) return base;

  let rpcChainId: number;
  try {
    rpcChainId = await input.probe.chainId();
  } catch {
    return base;
  }
  if (rpcChainId !== SEPOLIA_CHAIN_ID) {
    return { ...base, configurationError: 'The allocation RPC is not Ethereum Sepolia' };
  }

  let hasCode = false;
  let signerMatches = false;
  try {
    hasCode = await input.probe.hasCode(config.ledgerAddress);
    if (hasCode) {
      const signer = await input.probe.backendSigner(config.ledgerAddress);
      signerMatches = sameAddress(signer, config.signerAddress);
    }
  } catch {
    return { ...base, rpcReady: true };
  }

  const ledger = { address: config.ledgerAddress, hasCode, signerMatches };
  const executionAddresses = parseExecutionAddresses(input.env);
  const execution = await executionStatus(input.probe, config, executionAddresses);
  let periodId = execution.periodId ?? INITIAL_ALLOCATION_PERIOD;
  let policy: PublicProductStatus['policy'] = null;
  if (hasCode) {
    try {
      const read = await input.probe.policy(config.ledgerAddress, config.groupId, periodId);
      if (read.cap > BigInt(0) && read.usdc !== '0x0000000000000000000000000000000000000000') {
        policy = { cap: read.cap.toString(), periodId: read.periodId.toString(), usdc: getAddress(read.usdc) };
        periodId = read.periodId;
      }
    } catch {
      policy = null;
    }
  }

  const live = hasCode && signerMatches && policy !== null;
  return {
    ...base,
    rpcReady: true,
    ledger,
    periodId: periodId.toString(),
    policy,
    execution: execution.status,
    live,
  };
}

async function executionStatus(
  probe: ProductProbe,
  config: ConfiguredAllocation,
  addresses: ExecutionAddresses | null,
): Promise<{ status: PublicProductStatus['execution']; periodId: bigint | null }> {
  if (!addresses) {
    return {
      periodId: null,
      status: {
        available: false,
        reason: 'The supported purchase market is not configured.',
        executor: null,
        hook: null,
        usdc: null,
        rwa: null,
      },
    };
  }
  const status: PublicProductStatus['execution'] = {
    available: false,
    reason: 'The purchase contracts are not deployed on Ethereum Sepolia.',
    ...addresses,
  };
  try {
    const [executorCode, hookCode, usdcCode, rwaCode] = await Promise.all([
      probe.hasCode(addresses.executor),
      probe.hasCode(addresses.hook),
      probe.hasCode(addresses.usdc),
      probe.hasCode(addresses.rwa),
    ]);
    if (!executorCode || !hookCode || !usdcCode || !rwaCode) return { status, periodId: null };
    const hookAllocation = await probe.hookAllocation(addresses.hook);
    if (!sameAddress(hookAllocation.groupId, config.groupId)) {
      return {
        periodId: hookAllocation.periodId,
        status: { ...status, reason: 'The hook is configured for a different allocation group.' },
      };
    }
    const tokens = await probe.executorTokens(addresses.executor);
    if (!sameAddress(tokens.usdc, addresses.usdc) || !sameAddress(tokens.rwa, addresses.rwa)) {
      return {
        periodId: hookAllocation.periodId,
        status: { ...status, reason: 'The executor tokens do not match the configured market.' },
      };
    }
    return {
      periodId: hookAllocation.periodId,
      status: { ...status, available: true, reason: null },
    };
  } catch {
    return { status, periodId: null };
  }
}

export function statusContainsSecrets(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return SECRET_FIELDS.some((field) => serialized.includes(field));
}

export function isBytes32(value: string | null | undefined): value is Hex {
  return !!value && BYTES32_PATTERN.test(value) && BigInt(value) !== BigInt(0);
}
