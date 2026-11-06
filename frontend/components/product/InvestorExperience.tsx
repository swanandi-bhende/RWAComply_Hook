'use client';

import { useState } from 'react';
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
import { parseUnits, type Hex } from 'viem';
import { SiteNav } from './SiteNav';
import { browserSessionStore } from '@/lib/world/sessionStore';
import { enrollProofOfHuman } from '@/lib/world/enrollClient';
import { runEnrollmentAction } from '@/lib/world/enrollmentAction';
import { runSecondWallet } from '@/lib/world/secondWallet';
import { REMAINING_BUDGET_MESSAGE, routerPhaseLabel, routerRejectionMessage } from '@/lib/product/purchaseFlow';
import { continueProofOfHuman } from '@/lib/world/continueClient';
import { authorizeWalletLink, type WalletLinkClientResult } from '@/lib/world/walletLinkClient';
import {
  LEDGER_REGISTRATION_ABI,
  submitRegistration,
  type LedgerReceipt,
  type LedgerRegistrationClient,
} from '@/lib/world/ledgerRegistration';
import { formatUsdc, purchaseDecision } from '@/lib/product/money';
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

  const [verify, setVerify] = useState<Notice>({ tone: 'idle', text: 'Verify your identity before linking a wallet.' });
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

  function registrationClient(): LedgerRegistrationClient | null {
    if (!address || !publicClient || !walletClient?.account || !ledger) return null;
    const account = walletClient.account;
    return {
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
  }

  async function registerAuthorized(authorization: Extract<WalletLinkClientResult, { ok: true }>) {
    if (!address || !groupId || !ledger) return { ok: false };
    const client = registrationClient();
    if (!client) return { ok: false };
    const submitted = await submitRegistration({
      authorization,
      connectedWallet: address,
      chainId,
      ledgerAddress: ledger,
      groupId,
      client,
      onUpdate: (progress) => setVerify({ tone: 'pending', text: progress.message }),
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

  async function verifyIdentity() {
    if (!address || !walletClient) return;
    setVerifying(true);
    setVerify({ tone: 'pending', text: 'Waiting for identity verification.' });
    const result = await runEnrollmentAction({
      enroll: () => enrollProofOfHuman({ sessionStore: browserSessionStore() }),
      authorize: (continuationToken) => authorizeWalletLink({
        continuationToken,
        wallet: address,
        signTypedData: (typedData) => signTypedDataAsync(typedData as never),
      }),
      register: (authorization) => registerAuthorized(authorization),
    });
    setVerifying(false);
    if (result.registered) {
      setVerify({
        tone: 'ok',
        text: 'This wallet is registered. Proof of human is not KYC, AML, accreditation, residency, or nationality.',
      });
      return;
    }
    const detail = result.stage === 'enrollment'
      ? verificationFailure(result.reason ?? 'unexpected')
      : result.stage === 'authorization'
        ? walletLinkFailure(result.reason ?? 'unexpected')
        : 'Registration was not confirmed.';
    setVerify({ tone: 'error', text: `${detail} This wallet was not registered.` });
  }

  async function linkWallet() {
    if (!address || !publicClient || !walletClient?.account || !ledger || !groupId || !periodId || !status) return;
    setLinking(true);
    setLink({ tone: 'pending', text: routerPhaseLabel('registering') });
    const account = walletClient.account;
    const result = await runSecondWallet({
      continueSession: () => continueProofOfHuman({ sessionStore: browserSessionStore() }),
      authorize: (continuationToken) => authorizeWalletLink({
        continuationToken,
        wallet: address,
        signTypedData: (typedData) => signTypedDataAsync(typedData as never),
      }),
      register: async (authorization) => {
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
    return { ok: submitted.ok };
      },
      readRemaining: () => publicClient.readContract({
        address: ledger,
        abi: LEDGER_VIEW_ABI,
        functionName: 'remaining',
        args: [address, groupId, periodId],
      }),
    });
    setLinking(false);
    if (!result.registered) {
      const detail = result.stage === 'continuation'
        ? verificationFailure(result.reason ?? 'unexpected')
        : result.stage === 'authorization'
          ? walletLinkFailure(result.reason ?? 'unexpected')
          : 'Registration was not confirmed.';
      setLink({ tone: 'error', text: `${detail} This wallet was not registered.` });
      return;
    }
    await remaining.refetch();
    const shown = result.remaining === undefined
      ? 'The shared remaining budget could not be read.'
      : `Remaining shared budget: ${formatUsdc(result.remaining)}.`;
    setLink({
      tone: 'ok',
      text: `This wallet is registered to the same person. ${shown} This is the budget left by the previously linked wallet. Selling does not restore it.`,
    });
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
        setPurchaseNotice({ tone: 'error', text: 'The purchase failed. Your allocation was not increased by a reverted purchase.' });
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

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-10 text-black">
        <h1 className="text-4xl font-black">Investor allocation</h1>
        <p className="mt-3 max-w-3xl leading-relaxed">
          Verify your identity, link this wallet, and see the shared USDC budget. A wallet is linked only after
          Ethereum confirms the registration.
        </p>

        <section className="mt-8 border border-black p-5" aria-labelledby="network-title">
          <h2 id="network-title" className="text-xl font-black">Network and contract status</h2>
          {statusQuery.isLoading && <p className="mt-3">Checking Ethereum Sepolia.</p>}
          {statusQuery.isError && <p className="mt-3" role="alert">The allocation status could not be loaded.</p>}
          {status && (
            <div className="mt-3 space-y-2" role="status">
              {deploymentMessages(status).map((item) => <p key={item.code}>{item.text}</p>)}
              {status.missing.length > 0 && <p>Missing configuration: {status.missing.join(', ')}.</p>}
              <p>Balances stay hidden until the ledger can be read. Sample amounts are not shown as live.</p>
            </div>
          )}
          {isConnected && !onSepolia && (
            <button
              type="button"
              className="mt-4 rounded bg-black px-4 py-2 font-bold text-white disabled:opacity-50"
              disabled={switching}
              onClick={() => switchChain({ chainId: sepolia.id })}
            >
              {switching ? 'Switching network…' : 'Switch to Ethereum Sepolia'}
            </button>
          )}
        </section>

        <section id="verify" className="mt-8 border border-black p-5">
          <h2 className="text-xl font-black">Verify your identity</h2>
          <p className="mt-2 leading-relaxed">
            World ID proof of human checks uniqueness for this session. It does not prove KYC, AML, accreditation,
            residency, nationality, or legal eligibility.
          </p>
          <button
            type="button"
            className="mt-4 rounded bg-black px-4 py-2 font-bold text-white disabled:opacity-50"
            disabled={!isConnected || !onSepolia || !status?.registrationReady || verifying || !walletClient}
            onClick={() => void verifyIdentity()}
          >
            {verifying ? 'Enrollment pending' : 'Enroll and register this wallet'}
          </button>
          <p className="mt-3" role="status">{verify.text}</p>
        </section>

        <section id="second-wallet" className="mt-8 border border-black p-5">
          <h2 className="text-xl font-black">Second wallet</h2>
          <p className="mt-2 leading-relaxed">
            Disconnect the wallet that already purchased, connect the next wallet, and continue the same proof of
            human. This does not start a new enrollment. The remaining amount is the shared budget the first wallet
            left behind.
          </p>
          <button
            type="button"
            className="mt-4 rounded border border-black px-4 py-2 font-bold disabled:opacity-50"
            disabled={!isConnected}
            onClick={() => disconnect()}
          >
            Disconnect this wallet
          </button>
          <p className="mt-2">
            {address ? `Connected wallet ${shortAddress(address)}` : 'Connect a wallet to continue.'}
            {address && (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void navigator.clipboard.writeText(address)}
              >
                Copy
              </button>
            )}
          </p>
          {onSepolia && address && (
            <a className="mt-1 inline-block underline" href={`https://sepolia.etherscan.io/address/${address}`}>
              View on Etherscan
            </a>
          )}
          <p className="mt-2 leading-relaxed">
            Linking adds this wallet to the pseudonymous allocation created for the verified person. It does not
            show that allocation identifier. A wallet already used by someone else cannot be moved.
          </p>
          {status?.groupId && (
            <p className="mt-2">Allocation group {shortAddress(status.groupId)} on Ethereum Sepolia.</p>
          )}
          <button
            type="button"
            className="mt-4 rounded bg-black px-4 py-2 font-bold text-white disabled:opacity-50"
            disabled={!isConnected || !onSepolia || !status?.registrationReady || linking || !walletClient}
            onClick={() => void linkWallet()}
          >
            {linking ? 'Registering' : 'Continue and register this wallet'}
          </button>
          <p className="mt-3" role="status">{link.text}</p>
        </section>

        <section id="allocation" className="mt-8 border border-black p-5">
          <h2 className="text-xl font-black">Shared allocation</h2>
          {!canRead && <p className="mt-3">Allocation amounts are unavailable until the ledger can be read.</p>}
          {canRead && allocation.isLoading && <p className="mt-3">Reading this wallet from Ethereum Sepolia.</p>}
          {canRead && allocation.isError && <p className="mt-3" role="alert">The wallet link could not be read.</p>}
          {canRead && allocation.isSuccess && !linked && <p className="mt-3">This wallet is not linked yet.</p>}
          {linked && !status?.policyReady && (
            <p className="mt-3">The ledger is deployed, but the purchase policy is not configured.</p>
          )}
          {linked && (
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm font-semibold text-gray-600">Link status</dt>
                <dd className="text-lg font-black">Wallet linked to your shared allocation</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-600">Cap</dt>
                <dd className="text-lg font-black">{cap === null ? 'Unavailable' : formatUsdc(cap)}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-600">Cumulative purchases</dt>
                <dd className="text-lg font-black">{spentValue === null ? 'Unavailable' : formatUsdc(spentValue)}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-gray-600">Remaining</dt>
                <dd className="text-lg font-black">{remainingValue === null ? 'Unavailable' : formatUsdc(remainingValue)}</dd>
              </div>
            </dl>
          )}
          {linked && (remaining.isError || spent.isError || policy.isError) && (
            <p className="mt-3" role="alert">Part of the allocation could not be read from Ethereum Sepolia.</p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            Other linked wallets are not listed here. Any wallet linked to the same person shares this remaining
            amount. Selling does not restore it.
          </p>
        </section>

        <section id="purchase" className="mt-8 border border-black p-5">
          <h2 className="text-xl font-black">Purchase</h2>
          {!status?.marketReady && (
            <p className="mt-3">{execution?.reason ?? 'The supported purchase market is unavailable.'}</p>
          )}
          {status?.marketReady && execution && (
            <>
              <p className="mt-3 leading-relaxed">
                This spends an exact amount of USDC through the trusted RWAComply route. The contract rejects a
                purchase above the remaining allocation. This screen does not estimate price impact because this
                route has no separate quote.
              </p>
              {marketClosed && <p className="mt-3" role="status">{accessTierMessage(0)}</p>}
              {typeof tier.data === 'number' && tier.data > 0 && (
                <p className="mt-3" role="status">{accessTierMessage(tier.data)}</p>
              )}
              <label className="mt-4 block font-semibold" htmlFor="usdc-amount">USDC to spend</label>
              <input
                id="usdc-amount"
                inputMode="decimal"
                className="mt-2 w-full max-w-xs border border-black px-3 py-2"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              {decision.reason === 'exceeds' && remainingValue !== null && requested !== null && (
                <div className="mt-4 border border-black p-4" role="alert">
                  <p className="font-black">Hook rejection</p>
                  <p>{REMAINING_BUDGET_MESSAGE}</p>
                  <p>Maximum allocation: {cap === null ? 'Unavailable' : formatUsdc(cap)}</p>
                  <p>Previous purchases: {spentValue === null ? 'Unavailable' : formatUsdc(spentValue)}</p>
                  <p>Available allocation: {formatUsdc(remainingValue)}</p>
                  <p>Requested purchase: {formatUsdc(requested)}</p>
                </div>
              )}
              {decision.reason === 'within' && decision.remainingAfter !== null && (
                <p className="mt-3">Remaining after this purchase: {formatUsdc(decision.remainingAfter)}</p>
              )}
              {needsApproval && requested !== null && (
                <button
                  type="button"
                  className="mt-4 rounded bg-black px-4 py-2 font-bold text-white disabled:opacity-50"
                  disabled={approving || buying || !onSepolia || !linked || marketClosed}
                  onClick={() => void approveUsdc(requested)}
                >
                  {approving ? 'Approving' : 'Approve USDC'}
                </button>
              )}
              {!needsApproval && (
                <button
                  type="button"
                  className="mt-4 rounded bg-black px-4 py-2 font-bold text-white disabled:opacity-50"
                  disabled={!decision.allowed || buying || approving || !onSepolia || !linked || marketClosed || !execution.available}
                  onClick={() => requested && void buy(requested)}
                >
                  {buying ? 'Swapping' : 'Buy with USDC'}
                </button>
              )}
              {purchaseNotice.text && <p className="mt-3" role="status">{purchaseNotice.text}</p>}
            </>
          )}
        </section>
      </main>
    </>
  );
}
