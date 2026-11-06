'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

export function OfferingDetail() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = params.offeringId;

  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">Sepolia demo market — test tokens</p>
        <h1 className="page-title">{offeringId}</h1>
        <div className="panel stack">
          <p>
            Sepolia currently has one published offering, <code>sepolia-demo-rwa</code>. The token is a mock.
            Its cap and spend are read on the investor page from the allocation ledger. Arkiv supplies the public description only.
          </p>
          <p>
            A marketplace offering created through <code>OfferingRegistry</code> would show its own group, cap,
            window, and pool here. That registry is not deployed on Sepolia, so this page does not invent balances
            for <code>{offeringId}</code>.
          </p>
          <p><Link className="link" href="/offerings">Back to offerings</Link></p>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
