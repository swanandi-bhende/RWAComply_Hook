import Link from 'next/link';
import { SiteNav } from './SiteNav';

export function HowItWorks() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-12 text-black">
        <h1 className="text-4xl font-black">How it works</h1>
        <p className="mt-4 text-lg leading-relaxed">
          An issuer sets a purchase limit for each verified person. If that person connects multiple wallets,
          purchases through supported RWAComply markets share one allocation. Splitting purchases across wallets
          does not create a new budget.
        </p>

        <h2 className="mt-10 text-2xl font-black">Identity, wallet, registration, purchase</h2>
        <p className="mt-3 leading-relaxed">
          World ID proof of human establishes that this browser session belongs to one person. The server maps
          that verified session to a pseudonymous allocation. The session itself is never written onchain.
          A wallet signature then proves control of an address. Registration is a separate Ethereum transaction.
          Only after that transaction is confirmed can a supported purchase draw on the shared USDC budget.
        </p>
        <p className="mt-3 leading-relaxed">
          The backend can authorize a registration. It cannot decide that a purchase succeeded. The allocation
          contract and the trusted purchase route are the record of the budget.
        </p>

        <h2 className="mt-10 text-2xl font-black">Where a purchase is checked</h2>
        <p className="mt-3 leading-relaxed">
          A supported purchase is an exact-input USDC buy sent through the RWAComply executor. That executor is
          the only route the hook trusts. The hook rejects a buy that would exceed the remaining allocation, then
          records the USDC actually spent. A reverted purchase does not increase the budget used.
        </p>

        <h2 className="mt-10 text-2xl font-black">CCA</h2>
        <p className="mt-3 leading-relaxed">
          CCA helps an issuer discover a launch price and distribute tokens. RWAComply helps an issuer enforce
          how much a verified investor can cumulatively purchase across linked wallets in supported markets.
          CCA can include its own participation rules. RWAComply does not claim to process CCA bids or settlements.
        </p>

        <h2 className="mt-10 text-2xl font-black">Trust and limits</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
          <li>Supported RWAComply purchases share the budget. Other ways of obtaining the asset do not.</li>
          <li>Gross purchases count. Sales do not replenish the allocation.</li>
          <li>The quote asset in this version is USDC.</li>
          <li>World ID does not prove KYC, AML, accreditation, residency, nationality, or legal eligibility.</li>
          <li>The connected wallet must submit its own registration. A signature for one wallet cannot register another.</li>
          <li>If Sepolia contracts are not deployed, the app shows that the data is unavailable. It does not invent balances.</li>
          <li>
            The older local Anvil technical demo remains available and is separate from this Sepolia investor flow.{' '}
            <Link href="/demo" className="underline">Open the local demo</Link>
          </li>
        </ul>
      </main>
    </>
  );
}
