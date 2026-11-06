'use client';

import { useState } from 'react';
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

const STEPS = ['Asset', 'Token', 'Price', 'Policy', 'Review'] as const;

export function IssuerDesk() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OfferingDraft>(EMPTY);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewedAt, setReviewedAt] = useState(0);
  const errors = offeringErrors(draft, reviewedAt);
  const price = indicativePrice(draft.tokenReserve, draft.usdcReserve);

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
        <h1 className="page-title">Create an offering</h1>
        <p className="lede">
          An issuer sets one purchase cap for one offering. Every wallet linked to the same person shares that cap.
          A different offering has its own cap. Investors cannot authorize themselves as issuers.
        </p>

        <section className="panel stack">
          <p>
            The connected wallet is not an authorized issuer on Ethereum Sepolia. The marketplace registry is not
            deployed there. The platform owner authorizes an issuer. That issuer can manage only its own offerings.
            This page does not send a transaction.
          </p>
          <p className="quiet">
            Local tests deploy <code>OfferingRegistry</code>, <code>MarketplaceHook</code>, and <code>MarketplaceExecutor</code>.
            The existing Sepolia pool, hook, and ledger stay as they are.
          </p>
        </section>

        <ol className="quiet">
          {STEPS.map((label, index) => (
            <li key={label}>{index === step ? `${label} — current` : label}</li>
          ))}
        </ol>

        {step === 0 && (
          <section className="panel stack">
            <h2 className="section-title">Asset details</h2>
            <Field label="Offering name" value={draft.name} onChange={(value) => update('name', value)} />
            <Field label="Asset category" value={draft.category} onChange={(value) => update('category', value)} />
            <Field label="Description" value={draft.description} onChange={(value) => update('description', value)} />
            <p className="quiet">
              The issuer supplies the description. RWAComply does not certify the underlying asset, the rights, or any return.
            </p>
          </section>
        )}

        {step === 1 && (
          <section className="panel stack">
            <h2 className="section-title">Token</h2>
            <Field label="Symbol" value={draft.symbol} onChange={(value) => update('symbol', value)} />
            <p>
              On the local marketplace, the issuer names an ERC-20 whose code and <code>decimals()</code> call succeed.
              The token is marked unreviewed until the platform owner reviews it. This page does not deploy a token and
              does not mint tokens to investors.
            </p>
          </section>
        )}

        {step === 2 && (
          <section className="panel stack">
            <h2 className="section-title">Initial reserves</h2>
            <Field label="Token reserve" value={draft.tokenReserve} onChange={(value) => update('tokenReserve', value)} />
            <Field label="USDC reserve" value={draft.usdcReserve} onChange={(value) => update('usdcReserve', value)} />
            <p>
              {price
                ? `Initial indicative pool price: ${price} USDC per token. This is the reserve ratio the issuer entered. It is not a guaranteed valuation, and later swaps move the execution price.`
                : 'Enter both reserves to see the initial indicative price.'}
            </p>
          </section>
        )}

        {step === 3 && (
          <section className="panel stack">
            <h2 className="section-title">Allocation policy</h2>
            <Field label="Per-human cap, USDC base units" value={draft.cap} onChange={(value) => update('cap', value)} />
            <Field label="Start, unix seconds" value={draft.startTime} onChange={(value) => update('startTime', value)} />
            <Field label="End, unix seconds" value={draft.endTime} onChange={(value) => update('endTime', value)} />
            <p className="quiet">
              The cap is cumulative USDC purchased through the supported route. It is not an ownership guarantee or a
              legal eligibility decision. The marketplace hook enforces the start and end. The deployed Sepolia ledger
              still has no end time, so the existing market does not.
            </p>
          </section>
        )}

        {step === 4 && (
          <section className="panel stack">
            <h2 className="section-title">Review</h2>
            <p>{draft.name || 'Unnamed offering'} · {draft.symbol || 'no symbol'} · cap {draft.cap || 'unset'}</p>
            <p>{draft.description || 'No description yet.'}</p>
            <p>{price ? `Indicative starting ratio: ${price} USDC per token.` : 'No indicative price yet.'}</p>
            {errors.length > 0 && (
              <ul>
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            )}
            <label>
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              {' '}The configuration above is the offering the issuer intends to create.
            </label>
            <p className="quiet">
              A local deployment would call <code>authorizeIssuer</code>, <code>createOffering</code>, initialize the
              pool, <code>registerPool</code>, add liquidity, then publish Arkiv metadata and read it back. None of
              those calls are sent from this page. An offering is not active until the pool, hook, and policy are configured.
            </p>
            <button type="button" disabled>
              Create offering is unavailable on this network
            </button>
          </section>
        )}

        <p>
          <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Back</button>
          {' '}
          <button type="button" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} disabled={step === STEPS.length - 1 || (step === 4 && (!confirmed || errors.length > 0))}>
            Continue
          </button>
        </p>
        <SiteFooter />
      </main>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="stack">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
