'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OfferingDirectory } from '@/lib/arkiv/offering';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

function usdc(raw: string | null): string {
  if (!raw) return 'Unavailable';
  const whole = BigInt(raw) / BigInt(1_000_000);
  return `${whole.toString()} USDC`;
}

export function OfferingMarket() {
  const [directory, setDirectory] = useState<OfferingDirectory | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/offerings')
      .then((response) => response.json())
      .then((body: OfferingDirectory) => {
        if (!cancelled) setDirectory(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const offering = directory?.offering;

  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">Offerings</p>
        <h1 className="page-title">Explore tokenized assets</h1>
        <p className="lede">Each offering has its own purchase cap. Wallets linked to one person share that cap and do not spend another offering&apos;s budget. Connect your wallet when you are ready to verify, register, and purchase a supported asset.</p>

        <section className="panel offering-card stack-lg" aria-labelledby="live-title">
          <p className="kicker">Sepolia demo market — test tokens</p>
          <h2 id="live-title" className="section-title">{offering?.rwaSymbol ?? 'Demo RWA'} / USDC</h2>
          <p>The RWA token is a mock token. It does not represent a verified asset, a yield, or a financial entitlement. The cap below is read from the deployed allocation ledger. Arkiv only supplies the public description.</p>
          {failed && <p role="alert">The offering directory could not be read. The Ethereum rules for this market are unchanged.</p>}
          {!failed && !directory && <p>Reading the offering directory.</p>}
          {directory && (
            <dl>
              <div><dt>Network</dt><dd>Ethereum Sepolia</dd></div>
              <div><dt>Purchase currency</dt><dd>Mock USDC</dd></div>
              <div><dt>Per-human allocation</dt><dd>{usdc(directory.chain.cap)}</dd></div>
              <div><dt>Status</dt><dd>{directory.arkivStatus === 'ready' ? 'Deployed demo market' : directory.arkivStatus}</dd></div>
              <div><dt>Issuer</dt><dd>{offering?.owner ? 'Published by the offering owner' : 'Unavailable'}</dd></div>
              <div><dt>Directory</dt><dd>{directory.arkivStatus}</dd></div>
            </dl>
          )}
          <p><Link className="btn btn-primary" href="/invest">Review and invest</Link></p>
          {offering && (
            <details className="tech">
              <summary>Technical details</summary>
              <p>Offering id {offering.offeringId}. Publisher {offering.owner}. Arkiv entity {offering.key}. Pool {offering.poolId}. Metadata expiry {offering.expiresAt}.</p>
            </details>
          )}
        </section>

        <section className="stack-lg" aria-labelledby="examples-title">
          <h2 id="examples-title" className="section-title">Example offering configurations</h2>
          <p className="quiet">Not deployed. Not available for purchase. These numbers are illustrations from the local tests.</p>
          <div className="grid-3">
            <article className="panel">
              <h3 className="card-title">SPRT</h3>
              <p>Solar Revenue Participation Token. Example cap 1,000 USDC. Example reserve ratio 100 USDC per token. Mock only. No solar project is claimed.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">PCPT</h3>
              <p>Private Credit Participation Token. Example cap 5,000 USDC, in a separate allocation group. Mock only. No credit asset is claimed.</p>
            </article>
          </div>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
