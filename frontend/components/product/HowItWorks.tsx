import Link from 'next/link';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

export function HowItWorks() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">How it works</p>
        <h1 className="page-title">The limit follows the person</h1>
        <p className="lede">
          An offering cap is a cumulative USDC purchase limit for one verified person. Linked wallets share it. Another offering has a different cap.
        </p>

        <section className="stack-lg">
          <h2 className="section-title">The problem</h2>
          <p>A per-wallet limit treats a second address as a second investor. The person can buy the cap again.</p>
        </section>

        <section className="stack-lg">
          <h2 className="section-title">What RWAComply checks</h2>
          <p>Proof of human, wallet ownership, onchain registration, and the issuer&apos;s access tier are separate. Only a supported exact-input USDC purchase draws down the shared budget. Selling does not restore it.</p>
        </section>

        <section className="grid-3 stack-lg">
          <article className="panel">
            <h2 className="card-title">Investor</h2>
            <p>Connect a wallet, complete World App, sign ownership, register, wait for issuer approval, then purchase. A second wallet continues the same identity session.</p>
            <p><Link className="link" href="/invest">Open Invest</Link></p>
          </article>
          <article className="panel">
            <h2 className="card-title">Issuer</h2>
            <p>An authorized issuer sets the cap for one offering. On Sepolia that role is still the contract owner. The issuer page does not grant the role.</p>
            <p><Link className="link" href="/issuer">Open Issue</Link></p>
          </article>
          <article className="panel">
            <h2 className="card-title">Uniswap v4</h2>
            <p>The trusted executor pulls USDC from the buyer and swaps through the official PoolManager. The hook rejects an untrusted route and a purchase over the remaining cap.</p>
          </article>
        </section>

        <section className="band">
          <h2 className="section-title">Arkiv and the limits</h2>
          <p>Arkiv stores the public offering description. Ethereum stores the cap and the spend. Arkiv cannot reject a swap.</p>
          <p>World App is not KYC, AML, accreditation, residency, or legal eligibility. Direct transfers and other chains are outside this check. The Sepolia tokens are mocks, not a real-world asset.</p>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
