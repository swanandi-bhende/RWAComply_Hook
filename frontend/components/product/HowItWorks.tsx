import Link from 'next/link';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

export function HowItWorks() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">How it works</p>
        <h1 className="page-title">One person, one budget</h1>
        <p className="lede">
          An issuer sets a purchase limit for each verified person. If that person connects multiple wallets,
          purchases through supported RWAComply markets share one allocation. Splitting purchases across wallets
          does not create a new budget.
        </p>

        <section className="stack-lg" aria-labelledby="stages-title">
          <h2 id="stages-title" className="section-title">Identity, wallet, registration, purchase</h2>
          <ol className="flow">
            <li>
              <strong>Human verification.</strong> World ID proof of human establishes that this browser session belongs to one person. The session itself is never written onchain.
            </li>
            <li>
              <strong>Wallet ownership.</strong> The connected wallet signs a message. A signature for one wallet cannot register another.
            </li>
            <li>
              <strong>Shared registration.</strong> The server maps the verified session to a pseudonymous allocation. Registration is a separate Ethereum transaction.
            </li>
            <li>
              <strong>Purchase enforcement.</strong> Only after that transaction is confirmed can a supported purchase draw on the shared USDC budget.
            </li>
          </ol>
          <p className="quiet">
            The backend can authorize a registration. It cannot decide that a purchase succeeded. The allocation
            contract and the trusted purchase route are the record of the budget.
          </p>
        </section>

        <section className="stack-lg" aria-labelledby="route-title">
          <div className="panel">
            <h2 id="route-title" className="section-title">Where a purchase is checked</h2>
            <p className="lede">
              A supported purchase is an exact-input USDC buy sent through the RWAComply executor. That executor is
              the only route the hook trusts. The hook rejects a buy that would exceed the remaining allocation, then
              records the USDC actually spent. A reverted purchase does not increase the budget used.
            </p>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="cca-title">
          <h2 id="cca-title" className="section-title">CCA</h2>
          <p className="lede">
            CCA helps an issuer discover a launch price and distribute tokens. RWAComply helps an issuer enforce
            how much a verified investor can cumulatively purchase across linked wallets in supported markets.
          </p>
          <p className="quiet">CCA can include its own participation rules. RWAComply does not claim to process CCA bids or settlements.</p>
        </section>

        <section className="stack-lg" aria-labelledby="limits-title">
          <h2 id="limits-title" className="section-title">Trust and limits</h2>
          <div className="grid-3">
            <article className="panel">
              <h3 className="card-title">The budget</h3>
              <p className="quiet">Supported RWAComply purchases share it. Gross purchases count. Sales do not replenish it. The quote asset in this version is USDC.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">The proof</h3>
              <p className="quiet">World ID does not prove KYC, AML, accreditation, residency, nationality, or legal eligibility.</p>
            </article>
            <article className="panel">
              <h3 className="card-title">The local demo</h3>
              <p className="quiet">
                If Sepolia contracts are not deployed, the app shows that the data is unavailable. It does not invent balances.
                The older local Anvil technical demo remains separate.{' '}
                <Link href="/demo" className="link">Open the local demo</Link>
              </p>
            </article>
          </div>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
