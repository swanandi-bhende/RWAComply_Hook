'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sepolia } from 'wagmi/chains';
import {
  useAccount,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';
import { parseUnits, type Address, type Hex } from 'viem';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';
import { WorldAppHandoff } from './WorldAppHandoff';
import { enrollProofOfHuman } from '@/lib/world/enrollClient';
import { runEnrollmentAction } from '@/lib/world/enrollmentAction';
import { runSecondWallet } from '@/lib/world/secondWallet';
import { REMAINING_BUDGET_MESSAGE, routerPhaseLabel, routerRejectionMessage } from '@/lib/product/purchaseFlow';
import { continueProofOfHuman } from '@/lib/world/continueClient';
import {
  getWalletConnectResult,
  isUserRejection,
  subscribeWalletConnect,
  walletStatusCopy,
} from '@/lib/product/walletConnection';
import { authorizeWalletLink, type WalletLinkClientResult } from '@/lib/world/walletLinkClient';
import {
  LEDGER_REGISTRATION_ABI,
  submitRegistration,
  type LedgerReceipt,
  type LedgerRegistrationClient,
} from '@/lib/world/ledgerRegistration';
import { formatUsdc, purchaseDecision } from '@/lib/product/money';
import { enrollmentButton, registrationPreflight, type EnrollmentPhase } from '@/lib/product/enrollmentGate';
import { infrastructureExplanation, infrastructureRole } from '@/lib/product/walletRole';
import { accessTierMessage, deploymentMessages } from '@/lib/product/readiness';
import { verificationFailure, walletLinkFailure } from '@/lib/product/copy';
import type { PublicProductStatus } from '@/lib/product/status';
import { ERC20_ABI, EXECUTOR_ABI, HOOK_ABI, POOL_FEE, TICK_SPACING } from '@/contracts';
import { parseAbi } from 'viem';

const ZERO_ALLOCATION = `0x${'0'.repeat(64)}` as Hex;
const LEDGER_VIEW_ABI = parseAbi([
  'function allocationIdByWallet(address wallet) view returns (bytes32)',
  'function policyByGroupPeriod(bytes32 groupId, uint256 periodId) view returns (uint256 cap, uint256 periodId, address usdc)',
  'function spentByAllocation(bytes32 allocationId, bytes32 groupId, uint256 periodId) view returns (uint256)',
  'function remaining(address wallet, bytes32 groupId, uint256 periodId) view returns (uint256)',
]);

type Notice = { tone: 'idle' | 'pending' | 'ok' | 'error'; text: string };

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function progressLabel(input: {
  confirmed?: boolean;
  failed?: boolean;
  signature?: boolean;
  transaction?: boolean;
  pending?: boolean;
  unavailable?: boolean;
  approval?: boolean;
}): { text: string; state: string } {
  if (input.unavailable) return { text: 'Unavailable', state: 'unavailable' };
  if (input.approval) return { text: 'Issuer approval required', state: 'approval' };
  if (input.failed) return { text: 'Failed', state: 'failed' };
  if (input.signature) return { text: 'Awaiting wallet signature', state: 'pending' };
  if (input.transaction) return { text: 'Awaiting transaction', state: 'pending' };
  if (input.pending) return { text: 'In progress', state: 'pending' };
  if (input.confirmed) return { text: 'Confirmed', state: 'confirmed' };
  return { text: 'Not started', state: 'idle' };
}

function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join('\n');
}

function purchaseError(error: unknown): string {
  const message = errorText(error);
  const mapped = routerRejectionMessage(message);
  if (mapped) return mapped;
  const lowered = message.toLowerCase();
  if (lowered.includes('user rejected')) return 'The purchase was cancelled.';
  if (message.includes('AccessDenied')) return 'This market is not open to this wallet yet.';
  if (lowered.includes('insufficient')) return 'The wallet does not have enough gas or USDC.';
  return 'The purchase could not be submitted.';
}

export default function InvestorExperience() {
  const { address, isConnected, chainId, status: accountStatus } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const connectResult = useSyncExternalStore(subscribeWalletConnect, getWalletConnectResult, () => 'idle' as const);
  const [switchRejected, setSwitchRejected] = useState(false);
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient();
  const { signTypedDataAsync } = useSignTypedData();
  const offeringsQuery = useQuery({
    queryKey: ['offerings', address ?? 'none'],
    queryFn: async () => {
      const url = address ? `/api/offerings?wallet=${address}` : '/api/offerings';
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Offering information could not be refreshed. Trading rules are still checked onchain.');
      return response.json() as Promise<{
        arkivStatus: 'ready' | 'missing' | 'expired' | 'mismatch' | 'unavailable';
        warning: string | null;
        offering: {
          key: string;
          owner: string;
          projectTag: string;
          offeringId: string;
          rwaSymbol: string;
          usdcAddress: string;
          rwaAddress: string;
          poolId: string;
          expiresAt: string;
        } | null;
        chain: { cap: string | null; periodId: string | null; remaining: string | null; usdc: string | null; rwa: string | null };
      }>;
    },
  });
  const purchasesQuery = useQuery({
    queryKey: ['purchases', address ?? 'none'],
    enabled: !!address,
    queryFn: async () => {
      const response = await fetch(`/api/product/purchases?wallet=${address}`, { cache: 'no-store' });
      const body = await response.json() as {
        purchases?: Array<{ transactionHash: string; amount: string; newSpent: string }>;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? 'Purchase history could not be read from Ethereum.');
      return body.purchases ?? [];
    },
  });
  const statusQuery = useQuery({
    queryKey: ['product-status'],
    queryFn: async (): Promise<PublicProductStatus & { anvil?: 'running' | 'stopped' | 'not-local' }> => {
      const response = await fetch('/api/product/status', { cache: 'no-store' });
      if (!response.ok) throw new Error('Allocation status is unavailable');
      return response.json() as Promise<PublicProductStatus & { anvil?: 'running' | 'stopped' | 'not-local' }>;
    },
  });

  const status = statusQuery.data;
  const ledger = status?.ledger?.address;
  const groupId = status?.groupId ?? undefined;
  const periodId = status?.periodId ? BigInt(status.periodId) : undefined;
  const canRead = !!status?.registrationReady && !!ledger && !!groupId && periodId !== undefined;
  const canReadBudget = canRead && !!status?.policyReady;
  const onSepolia = chainId === sepolia.id;

  const allocation = useReadContract({
    chainId: sepolia.id,
    address: ledger,
    abi: LEDGER_VIEW_ABI,
    functionName: 'allocationIdByWallet',
    args: address ? [address] : undefined,
    query: { enabled: canRead && !!address, refetchInterval: 4000 },
  });
  const linked = typeof allocation.data === 'string' && allocation.data.toLowerCase() !== ZERO_ALLOCATION;
  const policy = useReadContract({
    chainId: sepolia.id,
    address: ledger,
    abi: LEDGER_VIEW_ABI,
    functionName: 'policyByGroupPeriod',
    args: groupId && periodId !== undefined ? [groupId, periodId] : undefined,
    query: { enabled: canReadBudget, refetchInterval: 4000 },
  });
  const spent = useReadContract({
    chainId: sepolia.id,
    address: ledger,
    abi: LEDGER_VIEW_ABI,
    functionName: 'spentByAllocation',
    args: linked && groupId && periodId !== undefined && allocation.data ? [allocation.data, groupId, periodId] : undefined,
    query: { enabled: canReadBudget && linked, refetchInterval: 4000 },
  });
  const remaining = useReadContract({
    chainId: sepolia.id,
    address: ledger,
    abi: LEDGER_VIEW_ABI,
    functionName: 'remaining',
    args: address && groupId && periodId !== undefined ? [address, groupId, periodId] : undefined,
    query: { enabled: canReadBudget && linked && !!address, refetchInterval: 4000 },
  });
  const execution = status?.execution;
  const tier = useReadContract({
    chainId: sepolia.id,
    address: execution?.hook ?? undefined,
    abi: HOOK_ABI,
    functionName: 'userTier',
    args: address ? [address] : undefined,
    query: { enabled: !!status?.marketReady && !!execution?.hook && !!address, refetchInterval: 4000 },
  });
  const allowance = useReadContract({
    chainId: sepolia.id,
    address: execution?.usdc ?? undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && execution?.executor ? [address, execution.executor] : undefined,
    query: { enabled: !!execution?.available && !!address && !!execution.executor, refetchInterval: 4000 },
  });
  const usdcBalance = useReadContract({
    chainId: sepolia.id,
    address: execution?.usdc ?? undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!execution?.available && !!address && !!execution?.usdc, refetchInterval: 4000 },
  });

  const [verify, setVerify] = useState<Notice>({ tone: 'idle', text: '' });
  const [enrollmentPhase, setEnrollmentPhase] = useState<EnrollmentPhase>('idle');
  const [prompt, setPrompt] = useState<'creating' | 'qr_ready' | 'retrieved' | 'checking' | undefined>(undefined);
  const [handoff, setHandoff] = useState<{ connectorURI: string; expiresAt: number; environment: 'staging' | 'production' | 'sandbox' } | null>(null);
  const [demoConfirm, setDemoConfirm] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [demoChallenge, setDemoChallenge] = useState<{ wallet: string; token: string; typedData: Record<string, unknown> } | null>(null);
  const [demoLinked, setDemoLinked] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [showAddresses, setShowAddresses] = useState(false);
  const identityQuery = useQuery({
    queryKey: ['world-identity'],
    queryFn: async () => {
      const response = await fetch('/api/world/identity', { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? 'Verification status could not be read.');
      }
      return response.json() as Promise<{ state: 'unverified' | 'verified' | 'expired'; linkedWallets: string[] }>;
    },
  });
  const identityState = identityQuery.data?.state ?? 'unverified';
  const [link, setLink] = useState<Notice>({ tone: 'idle', text: 'Link this wallet after verification.' });
  const [purchaseNotice, setPurchaseNotice] = useState<Notice>({ tone: 'idle', text: '' });
  const [amount, setAmount] = useState('');
  const [approving, setApproving] = useState(false);
  const [buying, setBuying] = useState(false);
  const [linking, setLinking] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const requested = (() => {
    try {
      if (!amount.trim()) return null;
      return parseUnits(amount, 6);
    } catch {
      return null;
    }
  })();
  const decision = purchaseDecision({
    remaining: typeof remaining.data === 'bigint' ? remaining.data : null,
    requested,
  });

  function registrationClient(ledgerAddress: Address): LedgerRegistrationClient | null {
    if (!address || !publicClient || !walletClient?.account) return null;
    const account = walletClient.account;
    return {
      getAllocationId: (wallet) => publicClient.readContract({
        address: ledgerAddress,
        abi: LEDGER_REGISTRATION_ABI,
        functionName: 'allocationIdByWallet',
        args: [wallet],
      }),
      getNonceUsed: (nonce) => publicClient.readContract({
        address: ledgerAddress,
        abi: LEDGER_REGISTRATION_ABI,
        functionName: 'usedNonce',
        args: [nonce],
      }),
      getBackendSigner: () => publicClient.readContract({
        address: ledgerAddress,
        abi: LEDGER_REGISTRATION_ABI,
        functionName: 'backendSigner',
      }),
      simulateRegister: async (args) => {
        await publicClient.simulateContract({
          account,
          address: ledgerAddress,
          abi: LEDGER_REGISTRATION_ABI,
          functionName: 'registerWallet',
          args: [args.wallet, args.allocationId, args.groupId, args.expiry, args.nonce, args.signature],
        });
      },
      sendRegister: (args) => walletClient.writeContract({
        account,
        chain: sepolia,
        address: ledgerAddress,
        abi: LEDGER_REGISTRATION_ABI,
        functionName: 'registerWallet',
        args: [args.wallet, args.allocationId, args.groupId, args.expiry, args.nonce, args.signature],
      }),
      waitForReceipt: async (hash) => {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const logs = receipt.logs.flatMap((log) => {
          if (!log.address) return [];
          const topics = log.topics.filter((topic): topic is Hex => typeof topic === 'string');
          return [{ address: log.address, topics, data: log.data }];
        });
        const receiptStatus: LedgerReceipt['status'] = receipt.status === 'success' ? 'success' : 'reverted';
        return { status: receiptStatus, to: receipt.to, logs };
      },
    };
  }

  async function registerAuthorized(
    authorization: Extract<WalletLinkClientResult, { ok: true }>,
    snapshot: PublicProductStatus | undefined = status,
  ) {
    const ledgerAddress = snapshot?.ledger?.address;
    const snapshotGroup = snapshot?.groupId ?? undefined;
    const gate = registrationPreflight({
      registrationReady: snapshot?.registrationReady === true,
      ledgerKnown: Boolean(ledgerAddress && snapshotGroup),
    });
    const wallet = address;
    if (!gate.ok || !wallet || !ledgerAddress || !snapshotGroup) {
      return { ok: false, state: 'unavailable', message: gate.ok ? 'Wallet registration could not be started.' : gate.message };
    }
    const client = registrationClient(ledgerAddress);
    if (!client) return { ok: false, state: 'unavailable', message: 'Wallet registration could not be started.' };
    const submitted = await submitRegistration({
      authorization,
      connectedWallet: wallet,
      chainId,
      ledgerAddress,
      groupId: snapshotGroup,
      client,
      onUpdate: (progress) => {
        if (progress.state === 'ready' || progress.state === 'pending') setEnrollmentPhase('awaiting_transaction');
        setVerify({ tone: 'pending', text: progress.message });
      },
    });
    if (submitted.state === 'confirmed' && submitted.transactionHash) {
      await fetch('/api/world/registration-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nonce: authorization.nonce, txHash: submitted.transactionHash }),
      });
      await allocation.refetch();
    }
    return { ok: submitted.ok, state: submitted.state, message: submitted.message, pending: submitted.state === 'pending' };
  }

  function worldRequest() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return {
      signal: controller.signal,
      returnTo: `${window.location.origin}/invest`,
      onHandoff: (next: { connectorURI: string; expiresAt: number; environment: 'staging' | 'production' | 'sandbox' }) => {
        setPrompt('qr_ready');
        setHandoff(next);
        setVerify({ tone: 'pending', text: `Request created for ${next.environment}. Scan the QR code. Opening the app is not the request.` });
      },
      onStatus: (status: 'waiting_for_connection' | 'awaiting_confirmation') => {
        if (status === 'awaiting_confirmation') {
          setPrompt('retrieved');
          setVerify({ tone: 'pending', text: 'World App has the RWAComply request. Approve proof of human there.' });
          return;
        }
        setPrompt('qr_ready');
      },
      onProofReceived: () => {
        setPrompt('checking');
        setHandoff(null);
        setVerify({ tone: 'pending', text: 'Proof received. RWAComply is verifying it with World.' });
      },
    };
  }

  async function verifyIdentity() {
    if (!address || !walletClient || !isConnected || !onSepolia || linked) return;
    setVerifying(true);
    setEnrollmentPhase('verifying');
    setPrompt('creating');
    setHandoff(null);
    setVerify({ tone: 'pending', text: 'Creating the World App request.' });
    const result = await runEnrollmentAction({
      enroll: () => enrollProofOfHuman(worldRequest()),
      authorize: async (continuationToken) => {
        const identity = await identityQuery.refetch();
        setHandoff(null);
        setPrompt(undefined);
        setEnrollmentPhase('awaiting_signature');
        setVerify({
          tone: identity.data?.state === 'verified' ? 'ok' : 'pending',
          text: identity.data?.state === 'verified'
            ? 'Proof of human verified. Sign the wallet ownership message. This signature is separate from World ID.'
            : 'Sign the wallet ownership message. This signature is separate from World ID.',
        });
        return authorizeWalletLink({
          continuationToken,
          wallet: address,
          signTypedData: (typedData) => signTypedDataAsync(typedData as never),
        });
      },
      register: async (authorization) => {
        setEnrollmentPhase('awaiting_transaction');
        const fresh = (await statusQuery.refetch()).data;
        return registerAuthorized(authorization, fresh);
      },
    });
    setVerifying(false);
    setPrompt(undefined);
    setHandoff(null);
    if (result.registered) {
      setEnrollmentPhase('idle');
      setVerify({
        tone: 'ok',
        text: 'Wallet linked. It shares this offering’s purchase allocation with the other wallets of this verified person.',
      });
      await identityQuery.refetch();
      return;
    }
    setEnrollmentPhase('failed');
    const detail = result.message
      ?? (result.stage === 'enrollment'
        ? verificationFailure(result.reason ?? 'unexpected')
        : result.stage === 'authorization'
          ? walletLinkFailure(result.reason ?? 'unexpected')
          : 'Registration was not confirmed.');
    setVerify({ tone: 'error', text: `${detail} This wallet was not registered.` });
  }

  const demoForWallet = Boolean(address && demoChallenge?.wallet === address);
  async function startDemoCheck() {
    if (!address || !onSepolia || role) return;
    setDemoError('');
    setDemoConfirm(false);
    const response = await fetch('/api/invest/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'preflight', wallet: address, chainId }),
    });
    const body = await response.json() as { error?: string; status?: string; challenge?: string; typedData?: Record<string, unknown> };
    if (!response.ok) {
      setDemoChallenge(null);
      setDemoError(body.error ?? 'The demo registration configuration is incomplete.');
      return;
    }
    if (body.status === 'already_linked') {
      setDemoLinked(true);
      setDemoChallenge(null);
      setLink({ tone: 'ok', text: 'Wallet linked to this demo allocation.' });
      return;
    }
    if (!body.challenge || !body.typedData) {
      setDemoError('The demo registration configuration is incomplete.');
      return;
    }
    setDemoLinked(false);
    setDemoChallenge({ wallet: address, token: body.challenge, typedData: body.typedData });
  }

  async function registerDemoWallet() {
    if (!address || !demoForWallet || !demoChallenge || !onSepolia || role) return;
    setLinking(true);
    setDemoError('');
    setLink({ tone: 'pending', text: 'Sign the wallet ownership message. This is not World ID.' });
    const typed = demoChallenge.typedData as {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown> & { issuedAt: string; expiry: string };
    };
    let signature: Hex;
    try {
      signature = await signTypedDataAsync({
        ...typed,
        message: { ...typed.message, issuedAt: BigInt(typed.message.issuedAt), expiry: BigInt(typed.message.expiry) },
      } as never);
    } catch (error) {
      setLinking(false);
      setLink({
        tone: 'error',
        text: isUserRejection(error) ? 'Your wallet signature was declined.' : 'The wallet signature could not be created.',
      });
      return;
    }
    const response = await fetch('/api/invest/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'authorize', wallet: address, chainId, challenge: demoChallenge.token, signature }),
    });
    const body = await response.json() as { error?: string; status?: string; wallet?: Address; allocationId?: Hex; groupId?: Hex; expiry?: number; nonce?: string; signature?: Hex; chainId?: number; verifyingContract?: Address };
    if (!response.ok) {
      setLinking(false);
      setLink({ tone: 'error', text: body.error ?? 'Allocation authorization is unavailable' });
      return;
    }
    if (body.status === 'already_linked') {
      setLinking(false);
      setDemoLinked(true);
      setLink({ tone: 'ok', text: 'Wallet linked to this demo allocation.' });
      return;
    }
    if (!body.wallet || !body.allocationId || !body.groupId || !body.signature || !body.verifyingContract || !body.nonce || !body.expiry || body.chainId !== sepolia.id) {
      setLinking(false);
      setLink({ tone: 'error', text: 'Allocation authorization is unavailable' });
      return;
    }
    const submitted = await registerAuthorized({
      ok: true,
      wallet: body.wallet,
      allocationId: body.allocationId,
      groupId: body.groupId,
      expiry: body.expiry,
      nonce: body.nonce,
      signature: body.signature,
      chainId: body.chainId,
      verifyingContract: body.verifyingContract,
    });
    setLinking(false);
    if (submitted.ok) {
      setDemoLinked(true);
      setDemoChallenge(null);
      setLink({ tone: 'ok', text: 'Wallet linked to this demo allocation.' });
      return;
    }
    setLink({ tone: 'error', text: submitted.message });
  }

  async function linkWallet() {
    if (!address || !walletClient?.account || !onSepolia) return;
    setLinking(true);
    setLink({ tone: 'pending', text: routerPhaseLabel('registering') });
    const account = walletClient.account;
    setEnrollmentPhase('verifying');
    setPrompt('creating');
    setHandoff(null);
    setVerify({ tone: 'pending', text: 'Creating the World App request for this wallet.' });
    const result = await runSecondWallet({
      continueSession: () => continueProofOfHuman(worldRequest()),
      authorize: (continuationToken) => {
        setHandoff(null);
        setPrompt(undefined);
        setEnrollmentPhase('awaiting_signature');
        setVerify({ tone: 'ok', text: 'Proof of human verified. Sign the wallet ownership message for this wallet.' });
        return authorizeWalletLink({
          continuationToken,
          wallet: address,
          signTypedData: (typedData) => signTypedDataAsync(typedData as never),
        });
      },
      register: async (authorization) => {
    const fresh = (await statusQuery.refetch()).data;
    const ledgerAddress = fresh?.ledger?.address;
    const snapshotGroup = fresh?.groupId;
    const gate = registrationPreflight({
      registrationReady: fresh?.registrationReady === true,
      ledgerKnown: Boolean(publicClient && ledgerAddress && snapshotGroup),
    });
    if (!gate.ok || !publicClient || !ledgerAddress || !snapshotGroup) {
      return { ok: false, message: gate.ok ? 'Wallet registration could not be started.' : gate.message };
    }
    const ledger = ledgerAddress;
    const groupId = snapshotGroup;
    const client: LedgerRegistrationClient = {
      getAllocationId: (wallet) => publicClient.readContract({
        address: ledger,
        abi: LEDGER_REGISTRATION_ABI,
        functionName: 'allocationIdByWallet',
        args: [wallet],
      }),
      getNonceUsed: (nonce) => publicClient.readContract({
        address: ledger,
        abi: LEDGER_REGISTRATION_ABI,
        functionName: 'usedNonce',
        args: [nonce],
      }),
      getBackendSigner: () => publicClient.readContract({
        address: ledger,
        abi: LEDGER_REGISTRATION_ABI,
        functionName: 'backendSigner',
      }),
      simulateRegister: async (args) => {
        await publicClient.simulateContract({
          account,
          address: ledger,
          abi: LEDGER_REGISTRATION_ABI,
          functionName: 'registerWallet',
          args: [args.wallet, args.allocationId, args.groupId, args.expiry, args.nonce, args.signature],
        });
      },
      sendRegister: (args) => walletClient.writeContract({
        account,
        chain: sepolia,
        address: ledger,
        abi: LEDGER_REGISTRATION_ABI,
        functionName: 'registerWallet',
        args: [args.wallet, args.allocationId, args.groupId, args.expiry, args.nonce, args.signature],
      }),
      waitForReceipt: async (hash) => {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const logs = receipt.logs.flatMap((log) => {
          if (!log.address) return [];
          const topics = log.topics.filter((topic): topic is Hex => typeof topic === 'string');
          return [{ address: log.address, topics, data: log.data }];
        });
        const receiptStatus: LedgerReceipt['status'] = receipt.status === 'success' ? 'success' : 'reverted';
        return { status: receiptStatus, to: receipt.to, logs };
      },
    };
    const submitted = await submitRegistration({
      authorization,
      connectedWallet: address,
      chainId,
      ledgerAddress: ledger,
      groupId,
      client,
      onUpdate: (progress) => setLink({ tone: 'pending', text: progress.message }),
    });
    if (submitted.state === 'confirmed' && submitted.transactionHash) {
      await fetch('/api/world/registration-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nonce: authorization.nonce, txHash: submitted.transactionHash }),
      });
      await allocation.refetch();
    }
    return { ok: submitted.ok, message: submitted.message };
      },
      readRemaining: () => {
        if (!publicClient || !ledger || !groupId || periodId === undefined) {
          return Promise.reject(new Error('remaining unavailable'));
        }
        return publicClient.readContract({
          address: ledger,
          abi: LEDGER_VIEW_ABI,
          functionName: 'remaining',
          args: [address, groupId, periodId],
        });
      },
    });
    setLinking(false);
    setPrompt(undefined);
    setHandoff(null);
    setEnrollmentPhase(result.registered ? 'idle' : 'failed');
    if (!result.registered) {
      const detail = result.stage === 'continuation'
        ? verificationFailure(result.reason ?? 'unexpected')
        : result.stage === 'authorization'
          ? walletLinkFailure(result.reason ?? 'unexpected')
          : (result.message ?? 'Registration was not confirmed.');
      setLink({ tone: 'error', text: `${detail} This wallet was not registered.` });
      return;
    }
    await remaining.refetch();
    const shown = result.remaining === undefined
      ? 'The shared remaining budget could not be read.'
      : `Remaining shared budget: ${formatUsdc(result.remaining)}.`;
    setLink({
      tone: 'ok',
      text: `This wallet is registered to the same person. ${shown} This is the budget left for every wallet linked to this verified person. Selling does not restore it.`,
    });
    await identityQuery.refetch();
  }

  async function approveUsdc(value: bigint) {
    if (!walletClient || !execution?.usdc || !execution.executor) return;
    setApproving(true);
    setPurchaseNotice({ tone: 'pending', text: routerPhaseLabel('approving') });
    try {
      const hash = await walletClient.writeContract({
        account: walletClient.account,
        chain: sepolia,
        address: execution.usdc,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [execution.executor, value],
      });
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status !== 'success') {
        setPurchaseNotice({ tone: 'error', text: 'USDC approval failed.' });
      } else {
        await allowance.refetch();
        setPurchaseNotice({ tone: 'ok', text: 'USDC approval confirmed.' });
      }
    } catch (error) {
      setPurchaseNotice({ tone: 'error', text: purchaseError(error) });
    } finally {
      setApproving(false);
    }
  }

  async function buy(value: bigint) {
    if (!walletClient || !publicClient || !execution?.available || !execution.executor || !execution.hook || !execution.usdc || !execution.rwa) {
      return;
    }
    setBuying(true);
    setPurchaseNotice({ tone: 'pending', text: routerPhaseLabel('swapping') });
    const [currency0, currency1] = execution.usdc.toLowerCase() < execution.rwa.toLowerCase()
      ? [execution.usdc, execution.rwa]
      : [execution.rwa, execution.usdc];
    const poolKey = {
      currency0,
      currency1,
      fee: POOL_FEE,
      tickSpacing: TICK_SPACING,
      hooks: execution.hook,
    };
    try {
      await publicClient.simulateContract({
        account: walletClient.account,
        address: execution.executor,
        abi: EXECUTOR_ABI,
        functionName: 'swapExactInput',
        args: [poolKey, value],
      });
      setPurchaseNotice({ tone: 'pending', text: routerPhaseLabel('swapping') });
      const hash = await walletClient.writeContract({
        account: walletClient.account,
        chain: sepolia,
        address: execution.executor,
        abi: EXECUTOR_ABI,
        functionName: 'swapExactInput',
        args: [poolKey, value],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        setPurchaseNotice({ tone: 'error', text: 'The transaction reverted. Your allocation was not consumed.' });
        return;
      }
      await Promise.all([spent.refetch(), remaining.refetch()]);
      setPurchaseNotice({ tone: 'ok', text: `${routerPhaseLabel('success')}. The remaining allocation was read again from Ethereum.` });
    } catch (error) {
      setPurchaseNotice({ tone: 'error', text: `${routerPhaseLabel('rejected')}. ${purchaseError(error)}` });
    } finally {
      setBuying(false);
    }
  }

  const cap = policy.data ? policy.data[0] : null;
  const spentValue = typeof spent.data === 'bigint' ? spent.data : null;
  const remainingValue = typeof remaining.data === 'bigint' ? remaining.data : null;
  const needsApproval = decision.allowed && typeof allowance.data === 'bigint' && requested !== null && allowance.data < requested;
  const marketClosed = !!status?.marketReady && tier.data === 0;

  const balanceValue = typeof usdcBalance.data === 'bigint' ? usdcBalance.data : null;
  const purchaseSucceeded = purchaseNotice.tone === 'ok' && purchaseNotice.text.startsWith(routerPhaseLabel('success'));
  const signaturePending = (verifying || linking) && /sign|confirm wallet registration/i.test(`${verify.text} ${link.text}`);
  const transactionPending = approving || buying || /registration pending|approving|swapping/i.test(`${verify.text} ${link.text} ${purchaseNotice.text}`);
  const identity = progressLabel({
    confirmed: verify.tone === 'ok',
    failed: verify.tone === 'error',
    signature: verifying && signaturePending,
    pending: verifying,
  });
  const registration = progressLabel({
    confirmed: linked,
    failed: link.tone === 'error' && !linked,
    signature: linking && signaturePending,
    transaction: linking && transactionPending,
    pending: linking,
  });
  const approval = progressLabel({
    unavailable: !!address && status?.marketReady === false,
    approval: marketClosed,
    confirmed: typeof tier.data === 'number' && tier.data > 0,
  });
  const purchase = progressLabel({
    unavailable: status?.marketReady === false,
    approval: marketClosed,
    failed: purchaseNotice.tone === 'error',
    transaction: approving || buying,
    confirmed: purchaseSucceeded,
  });

  async function switchToSepolia() {
    setSwitchRejected(false);
    try {
      await switchChainAsync({ chainId: sepolia.id });
    } catch (error) {
      if (isUserRejection(error)) setSwitchRejected(true);
    }
  }

  const symbol = offeringsQuery.data?.offering?.rwaSymbol ?? 'Demo RWA';
  const chainCap = offeringsQuery.data?.chain.cap ? formatUsdc(BigInt(offeringsQuery.data.chain.cap)) : 'Unavailable';
  const shownLinked = linked;
  const walletView = accountStatus === 'connecting' || accountStatus === 'reconnecting'
    ? 'connecting'
    : isConnected
      ? 'connected'
      : connectResult === 'idle'
        ? 'disconnected'
        : connectResult;
  const networkView = !isConnected
    ? 'unknown'
    : switching
      ? 'switching'
      : switchRejected
        ? 'switch_rejected'
        : onSepolia
          ? 'sepolia'
          : 'wrong';
  const walletCopy = walletStatusCopy({
    wallet: walletView,
    network: networkView,
    demo: 'off',
    address,
    linked: shownLinked,
  });
  const journey = [
    { label: 'Connect wallet', done: isConnected && onSepolia },
    { label: 'Verify identity', done: identityState === 'verified' },
    { label: 'Register wallet', done: shownLinked },
    { label: 'Obtain issuer approval', done: typeof tier.data === 'number' && tier.data > 0 },
    { label: 'Review allocation', done: shownLinked && remainingValue !== null },
    { label: 'Purchase', done: purchaseSucceeded },
  ];
  const currentStep = journey.findIndex((item) => !item.done);
  const role = infrastructureRole(address, status?.roles);
  const enrollment = enrollmentButton({
    connected: isConnected,
    onSupportedNetwork: onSepolia,
    walletReady: !!walletClient,
    alreadyRegistered: linked,
    phase: enrollmentPhase === 'failed' ? 'idle' : enrollmentPhase,
    prompt,
    identity: identityState,
    infrastructure: role,
  });

  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">Sepolia demo market — test tokens</p>
        <h1 className="page-title">{symbol} / USDC</h1>
        <p className="lede">
          This is the mock-token demo pool. Connect your wallet to verify, register, check the shared purchase allocation, and buy through the supported route. A connected address is not an approved investor.
        </p>
        <dl className="metric-grid">
          <div className="metric"><dt>Quote asset</dt><dd>Mock USDC</dd></div>
          <div className="metric"><dt>Issuer-defined cap</dt><dd>{offeringsQuery.isLoading ? 'Reading the ledger' : chainCap}</dd></div>
          <div className="metric"><dt>Offering status</dt><dd>{statusQuery.isLoading ? 'Checking market' : status?.marketReady ? 'Market readable' : 'Market unavailable'}</dd></div>
          <div className="metric"><dt>This wallet</dt><dd>{address ? shortAddress(address) : 'Not connected'}</dd></div>
        </dl>

        <ol className="wizard" aria-label="Investor progress">
          {journey.map((item, index) => (
            <li key={item.label} aria-current={index === currentStep ? 'step' : undefined} data-state={item.done ? 'confirmed' : identity.state}>
              {item.label}
            </li>
          ))}
        </ol>

        <div className="stack-lg">
          <section className="panel" id="connect">
            <h2 className="section-title">Connect wallet</h2>
            <p>Use the wallet button in the header. Connecting a wallet does not register it. Ethereum Sepolia registration can follow World App proof of human, or the presentation demo for a pre-approved wallet. The presentation demo is not World ID.</p>
            {role && <p className="notice" data-tone="error" role="alert">{infrastructureExplanation(role)}</p>}
            {walletCopy.wallet && <p className="notice" role="status">{walletCopy.wallet}</p>}
            {walletCopy.network && <p className="notice" role="status">{walletCopy.network}</p>}
            {switchRejected && <p className="notice" role="status">The network switch was cancelled.</p>}
            {isConnected && !onSepolia && (
              <button type="button" className="btn btn-primary" disabled={switching} onClick={() => void switchToSepolia()}>
                {switching ? 'Switching network…' : 'Switch to Ethereum Sepolia'}
              </button>
            )}
          </section>

          <section id="verify" className="panel">
            <h2 className="section-title">Verify identity</h2>
            {identityQuery.isError && (
              <p className="notice" data-tone="error" role="alert">
                {identityQuery.error instanceof Error ? identityQuery.error.message : 'Verification status could not be read.'}
              </p>
            )}
            <p>
              {identityState === 'verified'
                ? 'World ID Proof of Human verified. This verification belongs to the person, not to one wallet, and it can be reused while the saved session is valid.'
                : 'Verify with World App is genuine World ID proof of human and requires an Orb-verified World ID. This staging app cannot use Selfie Check, and an NFC passport is a different credential.'}
            </p>
            {(demoForWallet || demoLinked) && <p className="notice" role="status">Demo authorization active — not World ID</p>}
            <ol>
              <li>Open World App.</li>
              <li>Complete proof of human.</li>
              <li>Return to RWAComply.</li>
              <li>Sign a message with this wallet.</li>
              <li>Register the wallet on Ethereum Sepolia.</li>
            </ol>
            <p className="quiet">Proof of human is not KYC and does not grant issuer approval. <a className="link" href="/how">How it works</a></p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={enrollment.disabled || demoForWallet}
                onClick={() => void (identityState === 'verified' && !linked ? linkWallet() : verifyIdentity())}
              >
                {enrollment.label}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!isConnected || !onSepolia || !walletClient || Boolean(role) || demoForWallet || demoLinked}
                onClick={() => { setDemoError(''); setDemoConfirm(true); }}
              >
                Use demo verification for this presentation
              </button>
            </div>
            <p>This option is available only to pre-approved presentation wallets. It does not verify a unique human and is not World ID. Wallet ownership and Ethereum registration are still required.</p>
            {demoConfirm && !demoForWallet && (
              <button type="button" className="btn btn-primary" onClick={() => void startDemoCheck()}>Confirm demo verification</button>
            )}
            {demoError && <p className="notice" data-tone="error" role="alert">{demoError}</p>}
            {demoForWallet && !linked && !demoLinked && (
              <button type="button" className="btn btn-primary" disabled={linking} onClick={() => void registerDemoWallet()}>
                {linking ? 'Registering' : 'Sign and register this wallet'}
              </button>
            )}
            {handoff && (
              <WorldAppHandoff
                connectorURI={handoff.connectorURI}
                expiresAt={handoff.expiresAt}
                environment={handoff.environment}
                phase={prompt === 'retrieved' ? 'awaiting_confirmation' : 'waiting_for_connection'}
                onCancel={() => abortRef.current?.abort()}
              />
            )}
            {enrollment.explanation && <p className="notice" role="status">{enrollment.explanation}</p>}
            {verify.text && <p className="notice" data-tone={verify.tone} role="status">{verify.text}</p>}
          </section>

          <section id="link" className="panel">
            <h2 className="section-title">Register wallet</h2>
            <p>Verify once. Link multiple wallets. Share one purchase limit.</p>
            <p>Already registered another wallet? Connect the next wallet and continue the same identity session. Both wallets share the allocation for this offering. Connecting a wallet does not register it.</p>
            <div className="actions">
              <button type="button" className="btn btn-secondary" disabled={!isConnected} onClick={() => disconnect()}>Disconnect current wallet</button>
              {!demoForWallet && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!isConnected || !onSepolia || linking || !walletClient || identityState !== 'verified' || Boolean(role)}
                  onClick={() => void linkWallet()}
                >
                  {linking ? 'Registering' : 'Continue and register this wallet'}
                </button>
              )}
            </div>
            <p className="quiet">{address ? `Connected wallet ${shortAddress(address)}. ${demoLinked || (demoForWallet && linked) ? 'Wallet linked to this demo allocation.' : `Status: ${registration.text}.`}` : 'Connect another wallet to continue the existing session.'}</p>
            {link.text && <p className="notice" data-tone={link.tone} role="status">{link.text}</p>}
          </section>

          <section className="panel" id="approval">
            <h2 className="section-title">Issuer approval</h2>
            {marketClosed && <p className="notice" data-tone="pending" role="status">{accessTierMessage(0)}</p>}
            {typeof tier.data === 'number' && tier.data > 0 && <p className="notice" data-tone="ok" role="status">{accessTierMessage(tier.data)}</p>}
            {currentStep < 3 && <p className="quiet">Approval is checked after this wallet is registered. Proof of human does not grant it.</p>}
          </section>

          <section id="allocation" className="panel">
            <h2 className="section-title">Allocation</h2>
            {!canRead && <p>Allocation amounts stay hidden until the ledger can be read.</p>}
            {canRead && !shownLinked && <p>This wallet is not registered, so its remaining allocation is not shown as zero.</p>}
            {shownLinked && (
              <>
                <p>Verify once. Link multiple wallets. Share one purchase limit. All linked wallets consume the same offering budget. Selling does not restore it. The remaining amount below is read from Ethereum.</p>
                {(identityQuery.data?.linkedWallets ?? []).length > 0 && (
                  <>
                    <p>Linked wallets</p>
                    <ul>
                      {identityQuery.data?.linkedWallets.map((wallet) => (
                        <li key={wallet}>{showAddresses ? wallet : shortAddress(wallet)}</li>
                      ))}
                    </ul>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddresses((current) => !current)}>
                      {showAddresses ? 'Hide full addresses' : 'Show full addresses'}
                    </button>
                  </>
                )}
                <dl className="metric-grid">
                  <div className="metric metric-emphasis"><dt>Remaining</dt><dd>{remainingValue === null ? 'Unavailable' : formatUsdc(remainingValue)}</dd></div>
                  <div className="metric"><dt>Offering cap</dt><dd>{cap === null ? 'Unavailable' : formatUsdc(cap)}</dd></div>
                  <div className="metric"><dt>Total gross purchases</dt><dd>{spentValue === null ? 'Unavailable' : formatUsdc(spentValue)}</dd></div>
                  <div className="metric"><dt>Period</dt><dd>{offeringsQuery.data?.chain.periodId ?? 'Unavailable'}</dd></div>
                  <div className="metric"><dt>Connected wallet</dt><dd>{address ? shortAddress(address) : 'None'}</dd></div>
                </dl>
              </>
            )}
            {shownLinked && (remaining.isError || spent.isError || policy.isError) && (
              <p className="notice" data-tone="error" role="alert">Part of the allocation could not be read from Ethereum Sepolia.</p>
            )}
            {address && purchasesQuery.data && purchasesQuery.data.length > 0 && (
              <ul>
                {purchasesQuery.data.map((item) => (
                  <li key={item.transactionHash}>{formatUsdc(BigInt(item.amount))} USDC · shared total {formatUsdc(BigInt(item.newSpent))}</li>
                ))}
              </ul>
            )}
          </section>

          <section id="purchase" className="panel">
            <h2 className="section-title">Purchase</h2>
            {role ? (
              <p>{infrastructureExplanation(role)}</p>
            ) : !shownLinked || marketClosed ? (
              <p>{marketClosed ? accessTierMessage(0) : 'Register this wallet and obtain issuer approval before purchasing. The purchase action stays disabled until the contract can accept it.'}</p>
            ) : status?.marketReady && execution ? (
              <>
                <p>The purchase is executed through the supported RWAComply route. This screen does not estimate token output because this route has no separate quote.</p>
                <p>Available USDC balance: {balanceValue === null ? 'Unavailable' : formatUsdc(balanceValue)}. Remaining allocation: {remainingValue === null ? 'Unavailable' : formatUsdc(remainingValue)}.</p>
                <label className="field" htmlFor="usdc-amount">
                  USDC amount
                  <input id="usdc-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </label>
                {decision.reason === 'exceeds' && remainingValue !== null && requested !== null && (
                  <div className="alert" role="alert">
                    <p>{REMAINING_BUDGET_MESSAGE}</p>
                    <p>Remaining allocation: {formatUsdc(remainingValue)}. Requested: {formatUsdc(requested)}.</p>
                  </div>
                )}
                <p className="quiet">{needsApproval ? 'USDC allowance is below this amount.' : 'Allowance covers this amount, or no amount is entered yet.'}</p>
                {needsApproval && requested !== null && (
                  <button type="button" className="btn btn-primary" disabled={approving || buying || !onSepolia || !shownLinked || marketClosed} onClick={() => void approveUsdc(requested)}>
                    {approving ? 'Approving' : 'Approve USDC'}
                  </button>
                )}
                {!needsApproval && (
                  <button type="button" className="btn btn-primary" disabled={!decision.allowed || buying || approving || !onSepolia || !shownLinked || marketClosed || !execution.available} onClick={() => requested && void buy(requested)}>
                    {buying ? 'Purchasing' : 'Purchase'}
                  </button>
                )}
                {purchaseNotice.text && <p className="notice" data-tone={purchaseNotice.tone} role="status">{purchaseNotice.text}</p>}
              </>
            ) : (
              <p>{execution?.reason ?? 'The supported purchase market is unavailable.'}</p>
            )}
          </section>

          <details className="tech">
            <summary>Technical details</summary>
            {statusQuery.isError && <p role="alert">The allocation status could not be loaded.</p>}
            {status && deploymentMessages(status).map((item) => <p key={item.code}>{item.text}</p>)}
            <p>Configuration: {status?.missing.length ? `missing ${status.missing.join(', ')}` : status ? 'present' : 'not loaded'}.</p>
            <p>RPC: {status?.rpcReady ? 'reachable' : 'unreachable'}. Chain id: {status?.rpcChainId ?? 'unread'}.</p>
            <p>Ledger code: {status?.ledger?.hasCode ? 'present' : 'missing'}. Signer: {status?.ledger?.signerMatches ? 'matches' : 'unavailable'}.</p>
            <p>Policy: {status?.policyReady ? 'readable' : 'unavailable'}. Purchase route: {status?.execution.available ? 'matches' : 'unavailable'}.</p>
            <p>Local Anvil: {status?.anvil ?? 'unread'}.</p>
            {status?.missing && status.missing.length > 0 && <p>Missing configuration: {status.missing.join(', ')}.</p>}
            {offeringsQuery.data?.offering && (
              <p>
                Offering {offeringsQuery.data.offering.offeringId}. Directory {offeringsQuery.data.arkivStatus}. Entity {offeringsQuery.data.offering.key}. Pool {offeringsQuery.data.offering.poolId}.
              </p>
            )}
            {offeringsQuery.data?.warning && <p>{offeringsQuery.data.warning}</p>}
            <p>{`Identity: ${identity.text}. Registration: ${registration.text}. Approval: ${approval.text}. Purchase: ${purchase.text}.`}</p>
          </details>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
