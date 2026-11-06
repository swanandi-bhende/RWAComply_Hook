export const ANVIL_CHAIN_ID = 31337;

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export type AnvilMarket = {
  chainId: typeof ANVIL_CHAIN_ID;
  poolManager: string;
  hook: string;
  oracle: string;
  tokenA: string;
  tokenB: string;
  executor: string;
  ledger: string;
};

type Creation = {
  contractName?: string;
  contractAddress?: string;
  arguments?: unknown[];
};

function address(value: string | undefined): string | undefined {
  return value && ADDRESS.test(value) ? value : undefined;
}

export function marketFromCreations(transactions: Creation[]): AnvilMarket | null {
  const market: Partial<AnvilMarket> = { chainId: ANVIL_CHAIN_ID };
  for (const tx of transactions) {
    const deployed = address(tx.contractAddress);
    if (!deployed) continue;
    if (tx.contractName === 'PoolManager') market.poolManager = deployed;
    if (tx.contractName === 'RWAComplyHook') market.hook = deployed;
    if (tx.contractName === 'MockRWAOracle') market.oracle = deployed;
    if (tx.contractName === 'PoolExecutor') market.executor = deployed;
    if (tx.contractName === 'AllocationLedger') market.ledger = deployed;
    if (tx.contractName === 'MockUSDC') market.tokenA = deployed;
    if (tx.contractName === 'MockERC20') {
      const name = typeof tx.arguments?.[0] === 'string' ? tx.arguments[0] : '';
      if (name === 'RWA' || name === 'TokenB') market.tokenB = deployed;
    }
  }
  if (!market.poolManager || !market.hook || !market.oracle || !market.tokenA || !market.tokenB || !market.executor || !market.ledger) {
    return null;
  }
  return market as AnvilMarket;
}

export function marketFromDemoLog(text: string): Partial<AnvilMarket> | null {
  const map: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(0x[a-fA-F0-9]{40})$/);
    if (match) map[match[1]] = match[2];
  }
  if (Object.keys(map).length === 0) return null;
  return {
    chainId: ANVIL_CHAIN_ID,
    poolManager: map.POOL_MANAGER,
    hook: map.HOOK_ADDRESS,
    oracle: map.ORACLE || map.ORACLE_ADDRESS,
    tokenA: map.TOKEN_A || map.TOKEN_A_ADDRESS,
    tokenB: map.TOKEN_B || map.TOKEN_B_ADDRESS,
    executor: map.EXECUTOR || map.EXECUTOR_ADDRESS,
    ledger: map.LEDGER,
  };
}

export function selectAnvilMarket(
  broadcast: AnvilMarket | null,
  demoLog: Partial<AnvilMarket> | null,
): AnvilMarket | null {
  const merged: Partial<AnvilMarket> = { chainId: ANVIL_CHAIN_ID, ...demoLog, ...broadcast };
  if (merged.chainId !== ANVIL_CHAIN_ID) return null;
  if (!merged.poolManager || !merged.hook || !merged.oracle || !merged.tokenA || !merged.tokenB || !merged.executor || !merged.ledger) {
    return null;
  }
  return merged as AnvilMarket;
}
