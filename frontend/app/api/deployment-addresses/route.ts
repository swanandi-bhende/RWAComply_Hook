import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

type DeploymentAddresses = {
  poolManager: string;
  hook: string;
  oracle: string;
  tokenA: string;
  tokenB: string;
  executor?: string;
};

type PartialAddresses = Partial<DeploymentAddresses>;

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function isAddress(value: string | undefined): value is string {
  return !!value && ADDRESS_REGEX.test(value);
}

function normalizeAddress(value: string | undefined): string | undefined {
  if (!isAddress(value)) return undefined;
  return value;
}

function hasRequiredAddresses(addrs: PartialAddresses): addrs is DeploymentAddresses {
  return !!(
    isAddress(addrs.poolManager) &&
    isAddress(addrs.hook) &&
    isAddress(addrs.oracle) &&
    isAddress(addrs.tokenA) &&
    isAddress(addrs.tokenB)
  );
}

function addressesFromEnv(): PartialAddresses {
  return {
    poolManager: normalizeAddress(process.env.NEXT_PUBLIC_POOL_MANAGER),
    hook: normalizeAddress(process.env.NEXT_PUBLIC_HOOK_ADDRESS),
    oracle: normalizeAddress(process.env.NEXT_PUBLIC_ORACLE_ADDRESS),
    tokenA: normalizeAddress(process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS),
    tokenB: normalizeAddress(process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS),
    executor: normalizeAddress(process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS),
  };
}

async function addressesFromBroadcast(repoRoot: string): Promise<PartialAddresses | null> {
  try {
    const filePath = path.join(
      repoRoot,
      'broadcast',
      'DeployFull.s.sol',
      '31337',
      'run-latest.json'
    );

    const file = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(file) as {
      transactions?: Array<{
        contractName?: string;
        contractAddress?: string;
        arguments?: unknown[];
      }>;
    };

    const result: PartialAddresses = {};
    for (const tx of parsed.transactions ?? []) {
      if (tx.contractName && tx.contractAddress && isAddress(tx.contractAddress)) {
        if (tx.contractName === 'PoolManager') {
          result.poolManager = tx.contractAddress;
          continue;
        }

        if (tx.contractName === 'RWAComplyHook') {
          result.hook = tx.contractAddress;
          continue;
        }

        if (tx.contractName === 'MockRWAOracle') {
          result.oracle = tx.contractAddress;
          continue;
        }

        if (tx.contractName === 'PoolExecutor') {
          result.executor = tx.contractAddress;
          continue;
        }

        if (tx.contractName === 'MockERC20') {
          const maybeName = typeof tx.arguments?.[0] === 'string' ? tx.arguments[0] : '';
          if (maybeName === 'TokenA') result.tokenA = tx.contractAddress;
          if (maybeName === 'TokenB') result.tokenB = tx.contractAddress;
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}

async function addressesFromDemoLog(repoRoot: string): Promise<PartialAddresses | null> {
  try {
    const filePath = path.join(repoRoot, 'docs', 'demo_run_log.txt');
    const file = await fs.readFile(filePath, 'utf8');

    const lines = file.split(/\r?\n/);
    const map: Record<string, string> = {};

    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(0x[a-fA-F0-9]{40})$/);
      if (match) {
        map[match[1]] = match[2];
      }
    }

    return {
      poolManager: map.POOL_MANAGER,
      hook: map.HOOK_ADDRESS,
      oracle: map.ORACLE || map.ORACLE_ADDRESS,
      tokenA: map.TOKEN_A || map.TOKEN_A_ADDRESS,
      tokenB: map.TOKEN_B || map.TOKEN_B_ADDRESS,
      executor: map.EXECUTOR || map.EXECUTOR_ADDRESS,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), '..');

  const [broadcast, demoLog] = await Promise.all([
    addressesFromBroadcast(repoRoot),
    addressesFromDemoLog(repoRoot),
  ]);

  const env = addressesFromEnv();

  // Priority: broadcast > demo log > env fallback.
  const merged: PartialAddresses = {
    ...env,
    ...demoLog,
    ...broadcast,
  };

  if (!hasRequiredAddresses(merged)) {
    return NextResponse.json(
      {
        error:
          'Missing deployment addresses. Run: bash script/run_canonical_demo.sh or set NEXT_PUBLIC_* env vars.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(merged, { status: 200 });
}
