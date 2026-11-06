'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OfferingDirectory } from '@/lib/arkiv/offering';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

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
  const cap = directory?.chain.cap;

  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">Offerings</p>
        <h1 className="page-title">Discover an offering</h1>
        <p className="lede">
          Each offering has its own allocation group and its own USDC purchase cap. Wallets linked to one person
          share that offering&apos;s cap. Spending in one offering does not reduce another.
        </p>

        <section className="panel stack">
          <h2 className="section-title">Live Sepolia offering</h2>
          {failed && <p>The offering directory could not be read. Trading rules for the existing market are still on Ethereum.</p>}
          {!failed && !directory && <p>Reading the offering directory.</p>}
          {directory && (
            <>
              <p>
                {offering ? `${offering.rwaSymbol} · ${offering.offeringId}` : 'No Arkiv offering row was returned.'}
                {directory.arkivStatus !== 'ready' ? ` Directory status: ${directory.arkivStatus}.` : ''}
              </p>
              <p>
                Onchain cap: {cap ? `${cap} USDC base units` : 'not read'}. Period: {directory.chain.periodId ?? 'not read'}.
                This is the historical single-offering market. Its hook stores one allocation group.
              </p>
              <p><Link className="link" href="/invest">Open the investor page</Link></p>
            </>
          )}
        </section>

        <section className="panel stack">
          <h2 className="section-title">Illustrative example, not a deployed offering</h2>
          <p>
            Solar Revenue Participation Token (SPRT) is an example configuration for the local marketplace tests.
            It is a mock token. It does not represent a real solar project, a contractual revenue right, or a return.
          </p>
          <p>
            Example initial reserve ratio: 100 USDC per token, from 10,000 tokens and 1,000,000 USDC. That ratio is
            the pool&apos;s starting price, not a valuation of an asset. Example per-human cap: 1,000 USDC. Example
            window: 90 days. A second example, private credit, uses a separate group and a 5,000 USDC cap in the
            local test. Neither example is published on Sepolia or Arkiv.
          </p>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
