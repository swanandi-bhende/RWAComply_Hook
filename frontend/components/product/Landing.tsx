import Link from 'next/link';
import { SiteNav } from './SiteNav';

export function Landing() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <section className="hero-layout" aria-labelledby="hero-title">
          <div>
            <p className="kicker">Tokenized real-world assets</p>
            <h1 id="hero-title" className="page-title">One human. Multiple wallets. One shared purchase budget.</h1>
            <p className="lede">
              An issuer sets a purchase limit for each verified person. If that person connects multiple wallets,
              purchases through supported RWAComply markets share one allocation. Splitting purchases across wallets
              does not create a new budget.
            </p>
            <div className="actions">
              <Link href="/invest" className="btn btn-primary">Enter the investor experience</Link>
              <Link href="/how" className="btn btn-secondary">How it works</Link>
            </div>
          </div>
          <figure className="share-diagram">
            <div className="share-person">One verified person</div>
            <div className="share-wallets">
              <div className="share-wallet">Wallet A</div>
              <div className="share-wallet">Wallet B</div>
            </div>
            <figcaption className="share-budget">Both wallets draw on one shared purchase budget</figcaption>
          </figure>
        </section>

        <section className="stack-lg" aria-labelledby="problem-title">
          <div>
            <h2 id="problem-title" className="section-title">A wallet is not an investor</h2>
            <p className="lede">
              A limit on one address is easy to get around. The same person can buy through a second wallet and
              receive another full budget. Issuers of tokenized treasuries, real estate, private credit, and
              fund-like assets need the limit to follow the person, not the address.
            </p>
          </div>
          <div className="split grid-3">
            <article className="panel">
              <h3 className="card-title">The gap</h3>
              <p className="quiet">A wallet-by-wallet cap treats a second address as a second investor.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">The link</h3>
              <p className="quiet">RWAComply links the wallets that one verified person controls.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">The budget</h3>
              <p className="quiet">Supported purchases then share one remaining USDC allocation.</p>
            </article>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="example-title">
          <div>
            <h2 id="example-title" className="section-title">Alice and Bob</h2>
            <p className="lede">An illustrative example, not a live balance.</p>
          </div>
          <div className="grid-3">
            <article className="example-card">
              <h3 className="card-title">Alice, Wallet A</h3>
              <p className="quiet">700 USDC purchased. Her shared remaining budget is 300 USDC.</p>
            </article>
            <article className="example-card">
              <h3 className="card-title">Alice, Wallet B</h3>
              <p className="quiet">Another 500 USDC is requested. That purchase is rejected because 500 is more than the 300 USDC still remaining.</p>
              <p className="example-rejected">Rejected. The budget stays at 300 USDC.</p>
            </article>
            <article className="example-card">
              <h3 className="card-title">Bob</h3>
              <p className="quiet">Bob is a different verified person. He has a separate 1,000 USDC allocation.</p>
            </article>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="workflow-title">
          <h2 id="workflow-title" className="section-title">Four separate steps</h2>
          <ol className="flow">
            <li><strong>Proof of human.</strong> World ID checks that a person is unique. It is not KYC or legal eligibility.</li>
            <li><strong>Wallet ownership.</strong> The connected wallet signs a message. That signature does not register it yet.</li>
            <li><strong>Onchain registration.</strong> The wallet submits the link. It is registered only after Ethereum confirms it.</li>
            <li><strong>Purchase enforcement.</strong> Supported buys consume the same remaining USDC allocation.</li>
          </ol>
        </section>

        <section className="stack-lg" aria-labelledby="cca-title">
          <div className="panel">
            <h2 id="cca-title" className="section-title">CCA and RWAComply do different jobs</h2>
            <p className="lede">
              CCA helps an issuer discover a launch price and distribute tokens. RWAComply helps an issuer enforce
              how much a verified investor can cumulatively purchase across linked wallets in supported markets.
            </p>
            <p className="quiet">
              The two can be used together. RWAComply does not set auction prices, control CCA bids, or settle an auction.
            </p>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="limits-title">
          <h2 id="limits-title" className="section-title">Use and limits</h2>
          <div className="grid-3">
            <article className="panel">
              <h3 className="card-title">Where it applies</h3>
              <p className="quiet">Supported RWAComply markets, exact-input USDC purchases, and wallets linked to the same person.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">Where it does not</h3>
              <p className="quiet">Transfers, unsupported routers, other chains, and unrelated pools are outside this check.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">What it is not</h3>
              <p className="quiet">World ID is not KYC, AML, accreditation, residency, nationality, or legal eligibility. Selling does not restore the budget. An institutional allowlist is a separate control.</p>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
