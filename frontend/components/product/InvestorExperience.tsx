'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sepolia } from 'wagmi/chains';
import {
  useAccount,
  useChainId,
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
import { authorizeDemoWallet } from '@/lib/world/demoClient';
import { authorizeWalletLink, type WalletLinkClientResult } from '@/lib/world/walletLinkClient';
import {
  LEDGER_REGISTRATION_ABI,
  submitRegistration,
  type LedgerReceipt,
  type LedgerRegistrationClient,
} from '@/lib/world/ledgerRegistration';
import { formatUsdc, purchaseDecision } from '@/lib/product/money';
import { enrollmentButton, registrationPreflight, type EnrollmentPhase } from '@/lib/product/enrollmentGate';
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
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
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
    queryFn: async (): Promise<PublicProductStatus> => {
      const response = await fetch('/api/product/status', { cache: 'no-store' });
      if (!response.ok) throw new Error('Allocation status is unavailable');
      return response.json() as Promise<PublicProductStatus>;
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
  const [prompt, setPrompt] = useState<'creating' | 'qr_ready' | 'checking' | undefined>(undefined);
  const [handoff, setHandoff] = useState<{ connectorURI: string; expiresAt: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [showAddresses, setShowAddresses] = useState(false);
  const identityQuery = useQuery({
    queryKey: ['world-identity'],
    queryFn: async () => {
      const response = await fetch('/api/world/identity', { cache: 'no-store' });
      if (!response.ok) throw new Error('Verification status could not be read.');
      return response.json() as Promise<{ state: 'unverified' | 'verified' | 'expired'; linkedWallets: string[] }>;
    },
  });
  const identityState = identityQuery.data?.state ?? 'unverified';
  const demoQuery = useQuery({
    queryKey: ['demo-identity'],
    queryFn: async () => {
      const response = await fetch('/api/demo/identity', { cache: 'no-store' });
      if (!response.ok) return { enabled: false as const, state: 'none' as const, linkedWallets: [] as string[] };
      return response.json() as Promise<{ enabled: boolean; state?: 'none' | 'active'; linkedWallets?: string[] }>;
    },
  });
  const [demoNotice, setDemoNotice] = useState<Notice>({ tone: 'idle', text: '' });
  const [demoBusy, setDemoBusy] = useState(false);
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
    if (!gate.ok || !address || !ledgerAddress || !snapshotGroup) {
      return { ok: false, message: gate.ok ? 'Wallet registration could not be started.' : gate.message };
    }
    const client = registrationClient(ledgerAddress);
    if (!client) return { ok: false, message: 'Wallet registration could not be started.' };
    const submitted = await submitRegistration({
      authorization,
      connectedWallet: address,
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
    return { ok: submitted.ok, message: submitted.message, pending: submitted.state === 'pending' };
  }

  function worldRequest() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return {
      signal: controller.signal,
      returnTo: `${window.location.origin}/invest`,
      onHandoff: (next: { connectorURI: string; expiresAt: number }) => {
        setPrompt('qr_ready');
        setHandoff(next);
        setVerify({ tone: 'pending', text: 'Scan the QR code with World App, or open the World App link.' });
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
        setPurchaseNotice({ tone: 'error', text: 'The transaction failed. Your allocation was not used.' });
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

  async function startDemo() {
    setDemoBusy(true);
    setDemoNotice({ tone: 'pending', text: 'Starting a demo identity for this browser.' });
    const response = await fetch('/api/demo/start', { method: 'POST' });
    setDemoBusy(false);
    if (!response.ok) {
      setDemoNotice({ tone: 'error', text: 'Demo identity is not enabled.' });
      return;
    }
    setDemoNotice({
      tone: 'ok',
      text: 'Demo identity active — not World ID. Register a wallet next. This does not prove that you are a unique human.',
    });
    await demoQuery.refetch();
  }

  async function registerDemo() {
    if (!address || !walletClient) return;
    setDemoBusy(true);
    setDemoNotice({ tone: 'pending', text: 'Sign the wallet ownership message. This signature is not World ID.' });
    const authorized = await authorizeDemoWallet({
      wallet: address,
      signTypedData: (typedData) => signTypedDataAsync(typedData as never),
    });
    if (!authorized.ok) {
      setDemoBusy(false);
      setDemoNotice({
        tone: 'error',
        text: authorized.reason === 'conflict'
          ? 'This wallet is already associated with another allocation.'
          : 'The demo wallet was not registered.',
      });
      return;
    }
    const fresh = (await statusQuery.refetch()).data;
    const registered = await registerAuthorized(authorized, fresh);
    setDemoBusy(false);
    if (!registered.ok) {
      setDemoNotice({
        tone: 'error',
        text: `${registered.message ?? 'Registration was not confirmed.'} The demo identity was not treated as World ID.`,
      });
      return;
    }
    setDemoNotice({
      tone: 'ok',
      text: 'This wallet is linked to the demo identity. It is not World ID verification. Wallets linked this way share one purchase limit.',
    });
    await demoQuery.refetch();
  }

  const journey = [
    { label: 'Connect wallet', done: isConnected && onSepolia },
    { label: 'Verify identity', done: identityState === 'verified' },
    { label: 'Register wallet', done: linked },
    { label: 'Obtain issuer approval', done: typeof tier.data === 'number' && tier.data > 0 },
    { label: 'Review allocation', done: linked && remainingValue !== null },
    { label: 'Purchase', done: purchaseSucceeded },
  ];
  const currentStep = journey.findIndex((item) => !item.done);
  const enrollment = enrollmentButton({
    connected: isConnected,
    onSupportedNetwork: onSepolia,
    walletReady: !!walletClient,
    alreadyRegistered: linked,
    phase: enrollmentPhase === 'failed' ? 'idle' : enrollmentPhase,
    prompt,
    identity: identityState,
  });
  const symbol = offeringsQuery.data?.offering?.rwaSymbol ?? 'Demo RWA';
  const chainCap = offeringsQuery.data?.chain.cap ? formatUsdc(BigInt(offeringsQuery.data.chain.cap)) : 'Unavailable';

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
          <div className="metric"><dt>This wallet</dt><dd>{address ? (onSepolia ? shortAddress(address) : 'Wrong network') : 'Not connected'}</dd></div>
        </dl>

        <ol className="wizard" aria-label="Investor progress">
          {journey.map((item, index) => (
            <li key={item.label} aria-current={index === currentStep ? 'step' : undefined} data-state={item.done ? 'confirmed' : identity.state}>
              {item.label}
            </li>
          ))}
        </ol>

        <div className="stack-lg">
          {(currentStep === 0 || !isConnected || !onSepolia) && (
            <section className="panel" id="connect">
              <h2 className="section-title">Connect wallet</h2>
              <p>Use the wallet button in the header. The purchase, registration, and allocation reads use that address on Ethereum Sepolia.</p>
              {isConnected && !onSepolia && (
                <button type="button" className="btn btn-primary" disabled={switching} onClick={() => switchChain({ chainId: sepolia.id })}>
                  {switching ? 'Switching network…' : 'Switch to Ethereum Sepolia'}
                </button>
              )}
            </section>
          )}

          <section id="verify" className="panel">
            <h2 className="section-title">Verify identity</h2>
            <p>
              {identityState === 'verified'
                ? 'Proof of human verified. This verification belongs to the person, not to one wallet, and it can be reused while the saved session is valid.'
                : 'World App proof of human requires an Orb-verified World ID. This staging app cannot use Selfie Check, and an NFC passport is a different credential. The wallet signature and the Ethereum registration are separate steps.'}
            </p>
            <ol>
              <li>Open World App.</li>
              <li>Complete proof of human.</li>
              <li>Return to RWAComply.</li>
              <li>Sign a message with this wallet.</li>
              <li>Register the wallet on Ethereum Sepolia.</li>
            </ol>
            <p className="quiet">Proof of human is not KYC and does not grant issuer approval. <a className="link" href="/how">How it works</a></p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={enrollment.disabled}
              onClick={() => void (identityState === 'verified' && !linked ? linkWallet() : verifyIdentity())}
            >
              {enrollment.label}
            </button>
            {handoff && (
              <WorldAppHandoff
                connectorURI={handoff.connectorURI}
                expiresAt={handoff.expiresAt}
                onCancel={() => abortRef.current?.abort()}
              />
            )}
            {enrollment.explanation && <p className="notice" role="status">{enrollment.explanation}</p>}
            {verify.text && <p className="notice" data-tone={verify.tone} role="status">{verify.text}</p>}
          </section>

          {demoQuery.data?.enabled && (
            <section className="panel" id="demo-identity">
              <h2 className="section-title">Demo identity verification — not World ID</h2>
              <p>This hackathon mode creates a server-side demo identity for this browser. It does not establish a unique human, and it is not Orb, Selfie Check, or World ID verification.</p>
              <p>Wallet ownership, onchain registration, and issuer approval stay separate. Linked demo wallets share one purchase limit. Selling does not restore it.</p>
              {demoQuery.data.state === 'active' && <p className="notice" data-tone="pending" role="status">Demo identity active — not World ID. Connecting a wallet does not link it.</p>}
              <div className="actions">
                {demoQuery.data.state !== 'active'
                  ? <button type="button" className="btn btn-secondary" disabled={demoBusy} onClick={() => void startDemo()}>Start demo identity</button>
                  : <button type="button" className="btn btn-secondary" disabled={demoBusy || !isConnected || !onSepolia || !walletClient || linked} onClick={() => void registerDemo()}>{linked ? 'Wallet linked' : 'Sign and register this wallet'}</button>}
              </div>
              {demoQuery.data.linkedWallets && demoQuery.data.linkedWallets.length > 0 && (
                <ul>
                  {demoQuery.data.linkedWallets.map((wallet) => <li key={wallet}>{shortAddress(wallet)}</li>)}
                </ul>
              )}
              {demoNotice.text && <p className="notice" data-tone={demoNotice.tone} role="status">{demoNotice.text}</p>}
            </section>
          )}

          <section id="link" className="panel">
            <h2 className="section-title">Register wallet</h2>
            <p>Verify once. Link multiple wallets. Share one purchase limit.</p>
            <p>Already registered another wallet? Connect the next wallet and continue the same identity session. Both wallets share the allocation for this offering. Connecting a wallet does not register it.</p>
            <div className="actions">
              <button type="button" className="btn btn-secondary" disabled={!isConnected} onClick={() => disconnect()}>Disconnect current wallet</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!isConnected || !onSepolia || linking || !walletClient || identityState !== 'verified'}
                onClick={() => void linkWallet()}
              >
                {linking ? 'Registering' : 'Continue and register this wallet'}
              </button>
            </div>
            <p className="quiet">{address ? `Connected wallet ${shortAddress(address)}. Sign wallet ownership when the wallet asks. Status: ${registration.text}.` : 'Connect another wallet to continue the existing session.'}</p>
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
            {canRead && !linked && <p>This wallet is not registered, so its remaining allocation is not shown as zero.</p>}
            {linked && (
              <>
                <p>Verify once. Link multiple wallets. Share one purchase limit. All linked wallets consume the same offering budget. Selling does not restore it. The remaining amount below is read from Ethereum.</p>
                {identityQuery.data?.linkedWallets && identityQuery.data.linkedWallets.length > 0 && (
                  <>
                    <p>Linked wallets</p>
                    <ul>
                      {identityQuery.data.linkedWallets.map((wallet) => (
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
            {linked && (remaining.isError || spent.isError || policy.isError) && (
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
            {!linked || marketClosed ? (
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
                  <button type="button" className="btn btn-primary" disabled={approving || buying || !onSepolia || !linked || marketClosed} onClick={() => void approveUsdc(requested)}>
                    {approving ? 'Approving' : 'Approve USDC'}
                  </button>
                )}
                {!needsApproval && (
                  <button type="button" className="btn btn-primary" disabled={!decision.allowed || buying || approving || !onSepolia || !linked || marketClosed || !execution.available} onClick={() => requested && void buy(requested)}>
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
            {status?.missing && status.missing.length > 0 && <p>Missing configuration: {status.missing.join(', ')}.</p>}
            {offeringsQuery.data?.offering && (
              <p>
                Offering {offeringsQuery.data.offering.offeringId}. Directory {offeringsQuery.data.arkivStatus}. Entity {offeringsQuery.data.offering.key}. Pool {offeringsQuery.data.offering.poolId}.
              </p>
            )}
            {offeringsQuery.data?.warning && <p>{offeringsQuery.data.warning}</p>}
            <p>Identity: {identity.text}. Registration: {registration.text}. Approval: {approval.text}. Purchase: {purchase.text}.</p>
          </details>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
