import type { PublicProductStatus } from './status.ts';

export type DeploymentMessage = {
  code:
    | 'wrong_network'
    | 'rpc_unavailable'
    | 'registration_unavailable'
    | 'policy_unavailable'
    | 'market_unavailable'
    | 'market_ready';
  text: string;
};

export function deploymentMessages(status: PublicProductStatus): DeploymentMessage[] {
  if (status.missing.length > 0 || (status.configurationError && !status.configurationError.includes('Sepolia'))) {
    return [{
      code: 'registration_unavailable',
      text: 'Wallet registration is unavailable until the allocation contract is configured.',
    }];
  }
  if (status.configurationError?.includes('Sepolia')) {
    return [{ code: 'wrong_network', text: 'Wrong network. Allocation registration uses Ethereum Sepolia.' }];
  }
  if (!status.rpcReady) {
    return [{ code: 'rpc_unavailable', text: 'The allocation RPC is unavailable.' }];
  }
  const messages: DeploymentMessage[] = [];
  if (!status.registrationReady) {
    messages.push({
      code: 'registration_unavailable',
      text: status.ledger?.hasCode
        ? 'Wallet registration is unavailable because the ledger signer does not match.'
        : 'Wallet registration is unavailable because the ledger is not deployed.',
    });
  }
  if (status.registrationReady && !status.policyReady) {
    messages.push({
      code: 'policy_unavailable',
      text: 'The ledger is deployed, but the purchase policy is not configured.',
    });
  }
  if (!status.marketReady) {
    messages.push({
      code: 'market_unavailable',
      text: status.execution.reason ?? 'The supported purchase market is unavailable.',
    });
  } else {
    messages.push({
      code: 'market_ready',
      text: 'The supported purchase market is ready. A linked wallet still needs issuer approval before it can buy.',
    });
  }
  return messages;
}

export function accessTierMessage(tier: number | null): string {
  if (tier === null) return 'The access tier could not be read.';
  if (tier === 0) {
    return 'Issuer approval is required before this wallet can purchase. Proof of human does not grant an access tier.';
  }
  return 'The issuer has approved this wallet for the supported purchase route. This is not KYC or legal eligibility.';
}
