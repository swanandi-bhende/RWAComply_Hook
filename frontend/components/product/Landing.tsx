import Link from 'next/link';
import { Logo } from './Logo';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

export function Landing() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <section className="hero-layout" aria-labelledby="hero-title">
          <div>
            <Logo height={40} />
            <p className="kicker">Tokenized-asset purchase limits</p>
            <h1 id="hero-title" className="page-title">One human. Multiple wallets. One shared purchase limit.</h1>
            <p className="lede">
              RWAComply helps tokenized-asset issuers enforce one cumulative purchase limit across the wallets linked to the same verified investor.
            </p>
            <div className="actions">
              <Link href="/offerings" className="btn btn-primary">Explore offerings</Link>
              <Link href="/how" className="btn btn-secondary">How it works</Link>
            </div>
            <p className="quiet">
              Connect your wallet to view offerings, verify and register your wallet, check your purchase allocation, and purchase supported assets. A connected address is not an investor or an issuer until those steps are complete.
            </p>
          </div>
          <figure className="share-diagram">
            <div className="share-person">One verified person</div>
            <div className="share-wallets">
              <div className="share-wallet">Wallet A</div>
              <div className="share-wallet">Wallet B</div>
            </div>
            <figcaption className="share-budget">One offering allocation</figcaption>
          </figure>
        </section>

        <section className="stack-lg" aria-labelledby="problem-title">
          <h2 id="problem-title" className="section-title">A second wallet should not create a second budget</h2>
          <p className="lede">A limit on one address is easy to pass. The same person buys through another wallet and receives another full cap. RWAComply follows the person for purchases on a supported offering.</p>
        </section>

        <section className="stack-lg" aria-labelledby="example-title">
          <h2 id="example-title" className="section-title">Alice, one offering</h2>
          <p className="quiet">Illustrative example. These are not live balances.</p>
          <div className="grid-3">
            <article className="panel">
              <h3 className="card-title">700 USDC</h3>
              <p>Wallet A purchases 700 of Alice&apos;s 1,000 USDC cap.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">500 rejected</h3>
              <p>Wallet B asks for 500. Only 300 remains, so the purchase is rejected.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">100 left</h3>
              <p>Wallet B then purchases 200. Alice has 100 left. Bob keeps his own 1,000.</p>
            </article>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="steps-title">
          <h2 id="steps-title" className="section-title">Four steps</h2>
          <ol className="flow">
            <li><strong>Proof of human.</strong> World App checks the person. It is not KYC.</li>
            <li><strong>Wallet ownership.</strong> The browser wallet signs a separate message.</li>
            <li><strong>Onchain registration.</strong> Ethereum records the wallet after the transaction confirms.</li>
            <li><strong>Purchase enforcement.</strong> Supported USDC purchases share that offering&apos;s cap.</li>
          </ol>
        </section>

        <section className="grid-3 stack-lg" aria-labelledby="sides-title">
          <article className="panel">
            <h2 id="sides-title" className="card-title">Investors</h2>
            <p>Discover an offering, verify once, and link the wallets that should share its cap.</p>
            <p><Link className="btn btn-primary" href="/invest">Invest</Link></p>
          </article>
          <article className="panel">
            <h2 className="card-title">Issuers</h2>
            <p>Each offering gets its own allocation group and its own per-person purchase cap.</p>
            <p><Link className="btn btn-secondary" href="/issuer">Issue</Link></p>
          </article>
          <article className="panel">
            <h2 className="card-title">Sepolia today</h2>
            <p>The live market is one mock-token demo pool. Multi-offering creation is local only and is not deployed there.</p>
          </article>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
