import Link from 'next/link';
import { SiteNav } from './SiteNav';

export function Landing() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-12 text-black">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">Tokenized real-world assets</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
          One human. Multiple wallets. One shared purchase budget.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed">
          An issuer sets a purchase limit for each verified person. If that person connects multiple wallets,
          purchases through supported RWAComply markets share one allocation. Splitting purchases across wallets
          does not create a new budget.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/invest" className="rounded bg-black px-5 py-3 font-bold text-white">
            Enter the investor experience
          </Link>
          <Link href="/how" className="rounded border border-black px-5 py-3 font-bold">
            How it works
          </Link>
        </div>

        <section className="mt-16" aria-labelledby="problem-title">
          <h2 id="problem-title" className="text-2xl font-black">A wallet is not an investor</h2>
          <p className="mt-3 max-w-3xl leading-relaxed">
            A limit on one address is easy to get around. The same person can buy through a second wallet and
            receive another full budget. Issuers of tokenized treasuries, real estate, private credit, and
            fund-like assets need the limit to follow the person, not the address.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="example-title">
          <h2 id="example-title" className="text-2xl font-black">Example, not a live balance</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <article className="border border-black p-5">
              <h3 className="font-black">Alice, Wallet A</h3>
              <p className="mt-2">The issuer cap is $1,000. Alice buys $700. $300 remains on her shared allocation.</p>
            </article>
            <article className="border border-black p-5">
              <h3 className="font-black">Alice, Wallet B</h3>
              <p className="mt-2">A $500 purchase is rejected. It would take her cumulative purchases to $1,200. She can still buy up to $300.</p>
            </article>
            <article className="border border-black p-5">
              <h3 className="font-black">Bob</h3>
              <p className="mt-2">Bob is a different verified person. His purchases do not use Alice&apos;s remaining budget.</p>
            </article>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="workflow-title">
          <h2 id="workflow-title" className="text-2xl font-black">Four separate steps</h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-4">
            <li className="border border-black p-4"><span className="font-black">1. Verify your identity.</span> World ID checks that a person is unique. It is not KYC or legal eligibility.</li>
            <li className="border border-black p-4"><span className="font-black">2. Prove wallet ownership.</span> The connected wallet signs a message. That signature does not register it yet.</li>
            <li className="border border-black p-4"><span className="font-black">3. Confirm wallet registration.</span> The wallet submits the link. It is registered only after Ethereum confirms it.</li>
            <li className="border border-black p-4"><span className="font-black">4. Purchase against one budget.</span> Supported buys consume the same remaining USDC allocation.</li>
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="cca-title">
          <h2 id="cca-title" className="text-2xl font-black">CCA and RWAComply do different jobs</h2>
          <p className="mt-3 max-w-3xl leading-relaxed">
            CCA helps an issuer discover a launch price and distribute tokens. RWAComply helps an issuer enforce
            how much a verified investor can cumulatively purchase across linked wallets in supported markets.
            The two can be used together. RWAComply does not set auction prices, control CCA bids, or settle an auction.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="limits-title">
          <h2 id="limits-title" className="text-2xl font-black">What this does not do</h2>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 leading-relaxed">
            <li>Limits apply only to purchases through supported RWAComply markets.</li>
            <li>Transfers, unsupported routers, other chains, and unrelated pools are outside this check.</li>
            <li>Selling does not restore the budget. Purchases are cumulative.</li>
            <li>The budget is denominated in USDC, and the supported buy spends an exact USDC amount.</li>
            <li>World ID is not KYC, AML, accreditation, residency, nationality, or legal eligibility.</li>
            <li>An institutional allowlist is a separate control.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
