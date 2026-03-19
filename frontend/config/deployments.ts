/**
 * Deployment config loader
 * Reads from broadcast/DeployFull.s.sol/31337/run-latest.json or env
 * Fails fast if deployment is stale or addresses don't match
 */

export interface DeploymentAddresses {
  poolManager: string;
  hook: string;
  oracle: string;
  tokenA: string;
  tokenB: string;
  executor?: string;
}

let cachedAddresses: DeploymentAddresses | null = null;
let loadError: string | null = null;

/**
 * Load deployment addresses from environment
 * Must be called after connecting to chain
 */
export async function loadDeploymentAddresses(): Promise<DeploymentAddresses> {
  if (cachedAddresses) return cachedAddresses;
  if (loadError) throw new Error(loadError);

  try {
    // Try to load from broadcast data first (most recent deployment)
    const broadcastResponse = await fetch('/api/deployment-addresses');
    if (broadcastResponse.ok) {
      const data = await broadcastResponse.json();
      cachedAddresses = {
        poolManager: data.poolManager || data.POOL_MANAGER,
        hook: data.hook || data.HOOK_ADDRESS,
        oracle: data.oracle || data.ORACLE_ADDRESS,
        tokenA: data.tokenA || data.TOKEN_A_ADDRESS,
        tokenB: data.tokenB || data.TOKEN_B_ADDRESS,
        executor: data.executor || data.EXECUTOR_ADDRESS,
      };

      // Validate all addresses are present and valid
      validateAddresses(cachedAddresses);
      return cachedAddresses;
    }

    // Fallback to env variables
    const addresses: DeploymentAddresses = {
      poolManager: process.env.NEXT_PUBLIC_POOL_MANAGER || '',
      hook: process.env.NEXT_PUBLIC_HOOK_ADDRESS || '',
      oracle: process.env.NEXT_PUBLIC_ORACLE_ADDRESS || '',
      tokenA: process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS || '',
      tokenB: process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS || '',
      executor: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS,
    };

    validateAddresses(addresses);
    cachedAddresses = addresses;
    return addresses;
  } catch (error) {
    loadError = `Failed to load deployment addresses: ${error instanceof Error ? error.message : String(error)}`;
    throw new Error(loadError);
  }
}

function validateAddresses(addresses: DeploymentAddresses) {
  const required = ['poolManager', 'hook', 'oracle', 'tokenA', 'tokenB'];
  for (const key of required) {
    const addr = addresses[key as keyof DeploymentAddresses];
    if (!addr || !addr.startsWith('0x')) {
      throw new Error(
        `Invalid or missing deployment address: ${key}. ` +
        `Ensure contracts are deployed and broadcast data is available. ` +
        `Run: bash script/run_canonical_demo.sh`
      );
    }
  }
}

export function getAddressesOrNull(): DeploymentAddresses | null {
  return cachedAddresses;
}

export function clearCache() {
  cachedAddresses = null;
  loadError = null;
}
