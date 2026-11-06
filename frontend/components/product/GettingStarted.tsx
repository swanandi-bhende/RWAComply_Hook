import Link from 'next/link';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

const DEVELOPER_DOC = 'https://github.com/swanandi-bhende/RWAComply_Hook/blob/v2/first-time-setup.md#part-b-running-the-repository';

export function GettingStarted() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">Getting started</p>
        <h1 className="page-title">Use RWAComply as an investor</h1>
        <p className="lede">
          World App checks that a person is present. The browser wallet checks that the investor controls
          an address. Both are required, and they are different steps. Creating a World ID application is
          not one of them.
        </p>

        <section className="stack" aria-labelledby="need-title">
          <h2 id="need-title" className="section-title">Before opening the investor page</h2>
          <div className="panel">
            <p>
              Open the RWAComply application. No production address is published yet, so the current
              Sepolia preview is <Link href="/invest" className="link">/invest</Link> on the running app.
              That preview is not a production deployment.
            </p>
            <p>
              Use a browser wallet the investor controls, with a little Ethereum Sepolia ETH for gas.
              Install World App and prepare a World ID on the phone. The operator has already configured
              the World ID application. The investor completes the proof World App requests.
            </p>
            <p className="quiet">
              A purchase also needs demo USDC in the wallet. It is mock USDC, not real USDC, and the page
              does not mint it. The token contract allows a public mint. The token received from a purchase
              is mock RWA, not a real-world asset.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="register-title">
          <h2 id="register-title" className="section-title">Connect, verify, and register</h2>
          <div className="panel">
            <p>
              On <Link href="/invest" className="link">/invest</Link>, connect the first wallet and switch
              to Ethereum Sepolia, chain id 11155111. Choose “Enroll and register this wallet”. World App
              asks for proof of human. The server checks that proof. It is not KYC, and it does not register
              the address by itself.
            </p>
            <p>
              The wallet then signs a separate ownership message. Confirm <code>registerWallet</code> on
              Sepolia. The page reports the wallet as linked only after that transaction is onchain.
              A cancelled World App prompt stops there. Nothing is registered.
            </p>
            <p className="quiet">
              The wallet still needs issuer approval before it can buy. Registration does not grant that
              tier, and the investor cannot set it. The page says “Issuer approval required” until the
              hook owner approves the address. No investor approval has been sent on Sepolia.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="second-title">
          <h2 id="second-title" className="section-title">Link a second wallet</h2>
          <div className="panel">
            <p>
              Disconnect the first wallet and connect the second. Choose “Continue and register this wallet”.
              That continues the same World ID session. A new enrollment is a different person and a different
              budget. The second wallet signs its own message and sends its own registration. The allocation
              id stays off the page. Both wallets then read the same remaining USDC budget.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="budget-title">
          <h2 id="budget-title" className="section-title">Shared allocation and purchase</h2>
          <div className="panel">
            <p>
              The budget is gross USDC spent through the supported purchase route. A request larger than
              the remainder is rejected, and selling does not restore the budget. The offering panel is
              public metadata. The cap and the spend are read from Ethereum.
            </p>
            <p className="quiet">
              A live World ID proof has not been completed on this deployment. The 700, rejected 500, and
              200 purchase was run on local Anvil, chain id 31337, through{' '}
              <Link href="/demo" className="link">/demo</Link>. It has not been sent as an investor
              purchase on Sepolia.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="operator-title">
          <h2 id="operator-title" className="section-title">Offering operator</h2>
          <div className="panel">
            <p>
              There is no retailer dashboard. Approving a tier, changing the allocation policy, and pausing
              the pool are owner transactions. On the local demo, those controls appear in Admin Observatory
              only when the connected wallet is the hook owner. They are not part of this investor page.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="help-title">
          <h2 id="help-title" className="section-title">When something fails</h2>
          <div className="panel">
            <p>
              The wrong network asks for Ethereum Sepolia. An unregistered wallet asks for World ID before
              purchasing. A cancelled prompt says no wallet was registered. A purchase above the shared
              remainder says the purchase exceeds the remaining allocation, and the spend does not increase.
              If the offering directory is down, trading rules are still checked on Ethereum.
            </p>
            <p className="quiet">
              Developers and judges running the repository use a separate setup. It is not required for this
              page.{' '}
              <a className="link" href={DEVELOPER_DOC}>Developer setup</a>.
            </p>
          </div>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
