'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SiteFooter } from '../product/SiteFooter';
import { SiteNav } from '../product/SiteNav';
import { formatUsdc } from '@/lib/product/money';

type Budget = { address: string; label: string; registered: boolean; cap: string; spent: string; remaining: string };
type Snapshot = {
  available?: true;
  chainId: number;
  network: string;
  offering: { name: string; token: string; cap: string; status: string };
  contracts: { ledger: string; executor: string; hook: string; usdc: string; rwa: string };
  alice: { a: Budget; b: Budget };
  bob: { a: Budget };
};
type Unavailable = { available: false; message: string };
type Outcome = { status: 'confirmed' | 'rejected' | 'failed'; message: string; hash?: string; requested: string; spent: string; remaining: string };

const money = (value?: string) => value ? formatUsdc(BigInt(value)) : 'Unavailable';

function isSnapshot(value: Snapshot | Unavailable | undefined): value is Snapshot {
  return Boolean(value && 'alice' in value);
}

export function GuidedDemo() {
  const [persona, setPersona] = useState<'alice' | 'bob'>('alice');
  const [wallet, setWallet] = useState<'a' | 'b'>('a');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['anvil-demo'],
    queryFn: async () => {
      const response = await fetch('/api/demo/sandbox', { cache: 'no-store' });
      const body = await response.json() as (Snapshot & { error?: string }) | Unavailable;
      if ('available' in body && body.available === false) return body;
      if (!response.ok) throw new Error('error' in body ? body.error ?? 'The local demo is not ready.' : 'The local demo is not ready.');
      return body;
    },
  });

  const unavailable = query.data && 'available' in query.data && query.data.available === false ? query.data : null;
  const snapshot = isSnapshot(query.data) ? query.data : undefined;
  const selectedWallet = persona === 'bob' ? 'a' : wallet;
  const budget = persona === 'alice' ? snapshot?.alice[selectedWallet] : snapshot?.bob.a;

  async function run(action: 'buy-700' | 'attempt-500' | 'buy-200' | 'reset') {
    setBusy(true);
    setError('');
    const response = await fetch('/api/demo/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(action === 'reset' ? { action } : { action, persona, wallet: selectedWallet }),
    });
    const body = await response.json() as { error?: string; result?: Outcome; status?: Snapshot };
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? 'The local demo action failed.');
      return;
    }
    if (body.result) setOutcome(body.result);
    if (action === 'reset') setOutcome(null);
    await query.refetch();
  }

  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">{unavailable ? 'Hosted demonstration' : 'Local demonstration — Anvil test network'}</p>
        <h1 className="page-title">RWAComply — Interactive Demo</h1>
        {unavailable ? (
          <section className="panel">
            <p className="lede">{unavailable.message}</p>
            <p>The local guided demo stays available on a presenter’s computer. It is not shown here, and this page does not invent balances or transaction hashes.</p>
            <p><a className="link" href="/how">How it works</a> explains the product. Genuine World ID onboarding stays on <a className="link" href="/invest">Invest</a>.</p>
          </section>
        ) : (
          <p className="lede">Local Anvil · Chain 31337. Simulated identity, test wallets, mock tokens, and local transactions. This is not World ID verification, not a real investor, and not Ethereum Sepolia.</p>
        )}

        {query.isError && <p className="notice" data-tone="error" role="alert">{query.error instanceof Error ? query.error.message : 'The local demo is not ready.'}</p>}
        {!unavailable && (
        <>
        <section className="panel">
          <h2 className="section-title">Persona and wallet</h2>
          <div className="actions">
            <button type="button" className="btn btn-secondary" aria-pressed={persona === 'alice'} onClick={() => { setPersona('alice'); setOutcome(null); }}>Alice</button>
            <button type="button" className="btn btn-secondary" aria-pressed={persona === 'bob'} onClick={() => { setPersona('bob'); setWallet('a'); setOutcome(null); }}>Bob</button>
            <button type="button" className="btn btn-secondary" aria-pressed={selectedWallet === 'a'} onClick={() => { setWallet('a'); setOutcome(null); }}>Wallet A</button>
            <button type="button" className="btn btn-secondary" aria-pressed={selectedWallet === 'b'} disabled={persona === 'bob'} onClick={() => { setWallet('b'); setOutcome(null); }}>Wallet B</button>
          </div>
          <p className="notice" role="status">{budget?.label ?? 'Select a persona'} · simulated identity · {budget?.address ?? 'wallet unavailable'}</p>
        </section>

        <section className="panel">
          <h2 className="section-title">Offering</h2>
          <dl className="metric-grid">
            <div className="metric"><dt>Offering</dt><dd>{snapshot?.offering.name ?? 'Demo RWA'}</dd></div>
            <div className="metric"><dt>Token</dt><dd>{snapshot?.offering.token ?? 'Mock RWA'}</dd></div>
            <div className="metric"><dt>Per-human cap</dt><dd>{money(snapshot?.offering.cap)}</dd></div>
            <div className="metric"><dt>Status</dt><dd>{snapshot?.offering.status ?? 'Waiting for Anvil'}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <h2 className="section-title">Allocation</h2>
          <p>Both of Alice’s wallets share one offering budget. Bob has a separate budget. These amounts are read from the local ledger.</p>
          <dl className="metric-grid">
            <div className="metric"><dt>Cap</dt><dd>{money(budget?.cap)}</dd></div>
            <div className="metric"><dt>Spent</dt><dd>{money(budget?.spent)}</dd></div>
            <div className="metric metric-emphasis"><dt>Remaining</dt><dd>{money(budget?.remaining)}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <h2 className="section-title">Presenter steps</h2>
          <ol>
            <li>Start on Alice — Wallet A and buy 700 USDC.</li>
            <li>Switch to Alice — Wallet B and attempt 500 USDC.</li>
            <li>Buy 200 USDC with Alice — Wallet B.</li>
            <li>Switch between Alice’s wallets and compare the remaining 100 USDC.</li>
            <li>Switch to Bob and show his separate 1,000 USDC budget.</li>
            <li>Reset the local chain snapshot before the next run.</li>
          </ol>
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy || persona !== 'alice' || selectedWallet !== 'a'} onClick={() => void run('buy-700')}>{busy ? 'Transaction submitted' : 'Buy 700 USDC'}</button>
            <button type="button" className="btn btn-primary" disabled={busy || persona !== 'alice' || selectedWallet !== 'b'} onClick={() => void run('attempt-500')}>Attempt 500 USDC</button>
            <button type="button" className="btn btn-primary" disabled={busy || persona !== 'alice' || selectedWallet !== 'b'} onClick={() => void run('buy-200')}>Buy 200 USDC</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run('reset')}>Restart demo</button>
          </div>
          {error && <p className="notice" data-tone="error" role="alert">{error}</p>}
          {outcome && (
            <div className="notice" role="status">
              <p>Transaction status: {outcome.status}.</p>
              <p>{outcome.status === 'rejected' ? 'Rejection reason' : 'Result'}: {outcome.message}.</p>
              <p>Requested {money(outcome.requested)}. Spent {money(outcome.spent)}. Remaining {money(outcome.remaining)}.</p>
              {outcome.hash && <p>Transaction hash: {outcome.hash}.</p>}
            </div>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title">Real World ID integration</h2>
          <p>This local demonstration does not verify a human. A genuine World ID proof has not been completed. The investor path on <a className="link" href="/invest">/invest</a> is separate and still requires World App.</p>
          <ol>
            <li>Implemented: World App request and IDKit connector QR in <code>frontend/lib/world/handoff.ts</code>.</li>
            <li>Implemented: server-side relying-party signing in <code>frontend/app/api/world/rp-context/route.ts</code>.</li>
            <li>Implemented and covered by automated tests: proof verification and encrypted session persistence.</li>
            <li>Implemented: another wallet continues with <code>IDKit.proveSession</code> through <code>frontend/lib/world/continue.ts</code>.</li>
            <li>Implemented: wallet ownership authorization and onchain <code>registerWallet</code> receipt checks.</li>
            <li>Not complete: a successful proof with a genuine World ID credential.</li>
          </ol>
        </section>

        <details className="tech">
          <summary>Technical details</summary>
          <p>Local Anvil chain 31337. Mock USDC and mock RWA. Transactions are sent by unlocked Anvil development accounts. No browser wallet and no World App are required.</p>
          {snapshot && (
            <>
              <p>Ledger {snapshot.contracts.ledger}</p>
              <p>Executor {snapshot.contracts.executor}</p>
              <p>Hook {snapshot.contracts.hook}</p>
            </>
          )}
        </details>
        </>
        )}
        <SiteFooter />
      </main>
    </>
  );
}
