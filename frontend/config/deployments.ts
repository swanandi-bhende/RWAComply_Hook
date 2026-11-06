/**
 * Deployment config loader
 * Reads the local Anvil broadcast. It does not use Sepolia environment addresses.
 */

export interface DeploymentAddresses {
  poolManager: string;
  hook: string;
  oracle: string;
  tokenA: string;
  tokenB: string;
  executor: string;
  ledger: string;
}

let cachedAddresses: DeploymentAddresses | null = null;

/**
 * Load the verified local Anvil deployment.
 * The caller still has to read contract code on chain 31337.
 */
export async function loadDeploymentAddresses(): Promise<DeploymentAddresses> {
  if (cachedAddresses) return cachedAddresses;

  const broadcastResponse = await fetch('/api/deployment-addresses', { cache: 'no-store' });
  const data = await broadcastResponse.json() as Partial<DeploymentAddresses> & { error?: string; chainId?: number };
  if (!broadcastResponse.ok) {
    throw new Error(data.error || 'Local Anvil deployment is unavailable.');
  }
  if (data.chainId !== 31337) {
    throw new Error('The loaded deployment is not local Anvil.');
  }
  const addresses: DeploymentAddresses = {
    poolManager: data.poolManager || '',
    hook: data.hook || '',
    oracle: data.oracle || '',
    tokenA: data.tokenA || '',
    tokenB: data.tokenB || '',
    executor: data.executor || '',
    ledger: data.ledger || '',
  };
  validateAddresses(addresses);
  cachedAddresses = addresses;
  return addresses;
}

function validateAddresses(addresses: DeploymentAddresses) {
  const required = ['ledger', 'executor', 'tokenA', 'poolManager', 'hook', 'oracle', 'tokenB'] as const;
  for (const key of required) {
    const addr = addresses[key];
    if (!addr || !addr.startsWith('0x')) {
      const label = key === 'executor' ? 'router' : key === 'tokenA' ? 'USDC' : key;
      throw new Error(
        `The local deployment is missing the ${label} address. ` +
        `The ledger, router, and USDC addresses must come from the Anvil deploy log. ` +
        `Run: bash script/start_anvil_demo.sh`
      );
    }
  }
}

export function getAddressesOrNull(): DeploymentAddresses | null {
  return cachedAddresses;
}

export function clearCache() {
  cachedAddresses = null;
}
