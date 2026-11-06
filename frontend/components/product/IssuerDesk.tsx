'use client';

import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { indicativePrice, offeringErrors, type OfferingDraft } from '@/lib/marketplace/offeringDraft';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

const EMPTY: OfferingDraft = {
  name: '',
  symbol: '',
  category: '',
  description: '',
  cap: '1000000000',
  startTime: '',
  endTime: '',
  tokenReserve: '10000',
  usdcReserve: '1000000',
};

const STEPS = ['Asset', 'Token', 'Pricing and liquidity', 'Allocation policy', 'Review'] as const;

export function IssuerDesk() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OfferingDraft>(EMPTY);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewedAt, setReviewedAt] = useState(0);
  const errors = offeringErrors(draft, reviewedAt);
  const price = indicativePrice(draft.tokenReserve, draft.usdcReserve);
  const onSepolia = chainId === sepolia.id;

  function update(field: keyof OfferingDraft, value: string) {
    setConfirmed(false);
    setReviewedAt(Math.floor(Date.now() / 1000));
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">Issuer</p>
        <h1 className="page-title">Set one cap for one offering</h1>
        <p className="lede">
          An offering has its own allocation group and its own per-person purchase cap. Wallets linked to the same verified person share that cap. Another offering does not.
        </p>

        <ol className="flow">
          <li>Obtain issuer authorization.</li>
          <li>Register or validate the asset token.</li>
          <li>Configure price and liquidity.</li>
          <li>Set the per-human purchase cap.</li>
          <li>Review the offering.</li>
          <li>Create the offering and publish its metadata.</li>
        </ol>

        <section className="panel stack-lg" aria-labelledby="auth-title">
          <h2 id="auth-title" className="section-title">Issuer authorization</h2>
          <dl className="metric-grid">
            <div><dt>Current network</dt><dd>{isConnected ? (onSepolia ? 'Ethereum Sepolia' : `Chain ${chainId}`) : 'No wallet connected'}</dd></div>
            <div><dt>Connected wallet</dt><dd>{address ?? 'None'}</dd></div>
            <div><dt>Issuer authorization</dt><dd>Not authorized</dd></div>
            <div><dt>Offering creation</dt><dd>Unavailable</dd></div>
          </dl>
          <p>
            Connecting a wallet does not make it an issuer. On Sepolia, the marketplace registry is not deployed. The existing market is still controlled by the contract owner. This page does not grant that role and does not send a transaction.
          </p>
          <p className="quiet">
            Local Anvil tests can deploy OfferingRegistry, MarketplaceHook, and MarketplaceExecutor. Those contracts are not on Sepolia. The form below is a local development review. It cannot create a live offering.
          </p>
        </section>

        <section className="stack-lg" aria-labelledby="draft-title">
          <h2 id="draft-title" className="section-title">Local offering draft</h2>
          <ol className="wizard" aria-label="Draft steps">
            {STEPS.map((label, index) => (
              <li key={label} aria-current={index === step ? 'step' : undefined}>{label}</li>
            ))}
          </ol>

          {step === 0 && (
            <form className="panel form-grid" onSubmit={(event) => event.preventDefault()}>
              <h3 className="card-title">Asset</h3>
              <Field label="Offering name" value={draft.name} onChange={(value) => update('name', value)} />
              <Field label="Asset category" value={draft.category} onChange={(value) => update('category', value)} />
              <Field label="Short description" value={draft.description} onChange={(value) => update('description', value)} />
              <p className="quiet">The issuer writes this description. RWAComply does not certify the asset, the rights, or a return.</p>
            </form>
          )}

          {step === 1 && (
            <form className="panel form-grid" onSubmit={(event) => event.preventDefault()}>
              <h3 className="card-title">Token</h3>
              <Field label="Token symbol" value={draft.symbol} onChange={(value) => update('symbol', value)} />
              <p>A local marketplace checks that the token is an ERC-20 and reads its decimals. This page does not deploy a token and does not mint one.</p>
            </form>
          )}

          {step === 2 && (
            <form className="panel form-grid" onSubmit={(event) => event.preventDefault()}>
              <h3 className="card-title">Pricing and liquidity</h3>
              <Field label="Token reserve" value={draft.tokenReserve} onChange={(value) => update('tokenReserve', value)} />
              <Field label="USDC reserve" value={draft.usdcReserve} onChange={(value) => update('usdcReserve', value)} />
              <p>
                {price
                  ? `Indicative starting ratio: ${price} USDC per token. This is the reserve ratio entered here. It is not a valuation, and a later swap moves the execution price.`
                  : 'Enter both reserves to calculate the indicative starting ratio.'}
              </p>
            </form>
          )}

          {step === 3 && (
            <form className="panel form-grid" onSubmit={(event) => event.preventDefault()}>
              <h3 className="card-title">Allocation policy</h3>
              <p>Set the maximum cumulative USDC amount that one verified person can purchase from this offering. All wallets linked to that person share the same limit.</p>
              <Field label="Per-human cap, USDC base units" value={draft.cap} onChange={(value) => update('cap', value)} />
              <Field label="Start, unix seconds" value={draft.startTime} onChange={(value) => update('startTime', value)} />
              <Field label="End, unix seconds" value={draft.endTime} onChange={(value) => update('endTime', value)} />
              <p className="quiet">The local marketplace hook can enforce the start and end. The deployed Sepolia ledger has no end time, so the existing demo market does not.</p>
            </form>
          )}

          {step === 4 && (
            <section className="panel stack">
              <h3 className="card-title">Review</h3>
              <p className="section-title">{draft.cap || 'Unset'} USDC base units</p>
              <p>That cap is the shared purchase budget for one person on this offering only.</p>
              <p>{draft.name || 'Unnamed offering'} · {draft.symbol || 'No symbol'} · {draft.category || 'No category'}</p>
              <p>{draft.description || 'No description yet.'}</p>
              <p>{price ? `Indicative starting ratio: ${price} USDC per token.` : 'No indicative price yet.'}</p>
              {errors.length > 0 && (
                <ul>
                  {errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              )}
              <label>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                {' '}This draft matches the offering the issuer intends to create on a local deployment.
              </label>
              <button type="button" className="btn btn-primary" disabled>
                Create offering is unavailable on this network
              </button>
            </section>
          )}

          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Back</button>
            <button type="button" className="btn btn-primary" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} disabled={step === STEPS.length - 1}>Next</button>
          </div>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <label htmlFor={id}>
      {label}
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
