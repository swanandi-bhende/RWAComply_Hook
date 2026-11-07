import { createPublicClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rpcHttpUrl } from '../product/rpc.ts';

export const WALLET_LINK_PURPOSE = 'Associate this wallet with an RWAComply allocation identity';
export const CHALLENGE_TTL_SECONDS = 300;
export const AUTHORIZATION_TTL_SECONDS = 600;

const usedNonceAbi = [
  {
    type: 'function',
    name: 'usedNonce',
    stateMutability: 'view',
    inputs: [{ name: 'nonce', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

export function walletLinkTypedData(input: {
  chainId: number;
  ledgerAddress: Address;
  appId: string;
  wallet: Address;
  nonce: Hex;
  issuedAt: bigint;
  expiry: bigint;
}) {
  return {
    domain: {
      name: 'RWAComplyWalletLink',
      version: '1',
      chainId: input.chainId,
      verifyingContract: input.ledgerAddress,
    },
    types: {
      WalletLink: [
        { name: 'purpose', type: 'string' },
        { name: 'appId', type: 'string' },
        { name: 'wallet', type: 'address' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    },
    primaryType: 'WalletLink' as const,
    message: {
      purpose: WALLET_LINK_PURPOSE,
      appId: input.appId,
      wallet: input.wallet,
      nonce: input.nonce,
      issuedAt: input.issuedAt,
      expiry: input.expiry,
    },
  };
}

export function registrationTypedData(input: {
  chainId: number;
  ledgerAddress: Address;
  wallet: Address;
  allocationId: Hex;
  groupId: Hex;
  expiry: bigint;
  nonce: bigint;
}) {
  return {
    domain: {
      name: 'AllocationLedger',
      version: '1',
      chainId: input.chainId,
      verifyingContract: input.ledgerAddress,
    },
    types: {
      Registration: [
        { name: 'wallet', type: 'address' },
        { name: 'allocationId', type: 'bytes32' },
        { name: 'groupId', type: 'bytes32' },
        { name: 'expiry', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'Registration' as const,
    message: {
      wallet: input.wallet,
      allocationId: input.allocationId,
      groupId: input.groupId,
      expiry: input.expiry,
      nonce: input.nonce,
    },
  };
}

export async function signRegistration(
  signingKeyHex: Hex,
  input: Parameters<typeof registrationTypedData>[0],
): Promise<Hex> {
  return privateKeyToAccount(signingKeyHex).signTypedData(registrationTypedData(input));
}

export async function registrationNonceUsed(input: {
  rpcUrl: string;
  ledgerAddress: Address;
  nonce: bigint;
}): Promise<boolean> {
  const client = createPublicClient({
    transport: http(rpcHttpUrl(input.rpcUrl)),
  });
  return client.readContract({
    address: input.ledgerAddress,
    abi: usedNonceAbi,
    functionName: 'usedNonce',
    args: [input.nonce],
  });
}
