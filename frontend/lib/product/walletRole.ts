import { getAddress, isAddress } from 'viem';

export type InfrastructureRole = 'allocation signer' | 'contract owner';

export function infrastructureRole(
  wallet: string | undefined,
  roles: { backendSigner?: string | null; owner?: string | null } | null | undefined,
): InfrastructureRole | null {
  if (!wallet || !roles || !isAddress(wallet, { strict: false })) return null;
  const connected = getAddress(wallet);
  if (roles.backendSigner && isAddress(roles.backendSigner, { strict: false }) && connected === getAddress(roles.backendSigner)) {
    return 'allocation signer';
  }
  if (roles.owner && isAddress(roles.owner, { strict: false }) && connected === getAddress(roles.owner)) {
    return 'contract owner';
  }
  return null;
}

export function infrastructureExplanation(role: InfrastructureRole): string {
  return `This wallet is the ${role}. It is an infrastructure account, not an ordinary investor wallet. Use a separate funded investor wallet on Ethereum Sepolia. The ledger contract does not reject this address; this page blocks registration so the attestor is not enrolled as an investor.`;
}
