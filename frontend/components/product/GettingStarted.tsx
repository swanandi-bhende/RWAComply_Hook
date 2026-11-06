import Link from 'next/link';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';

const SETUP_DOC = 'https://github.com/swanandi-bhende/RWAComply_Hook/blob/v2/first-time-setup.md';

export function GettingStarted() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="kicker">Getting started</p>
        <h1 className="page-title">What you need before you try this</h1>
        <p className="lede">
          Two different things get confused here. World App checks that a person is at the keyboard.
          The browser wallet checks that you control an address. You need both, and they are not the same step.
        </p>

        <section className="stack" aria-labelledby="need-title">
          <h2 id="need-title" className="section-title">Before you open the investor page</h2>
          <div className="panel">
            <p>
              Install World App and create a World ID on your phone. In the browser, use a wallet you control
              and switch it to Ethereum Sepolia, chain id 11155111. The wallet needs a little Sepolia ETH from
              a faucet so it can pay for registration. The mock USDC on this market is not a real asset, and
              the page will not pretend that it is.
            </p>
            <p className="quiet">
              For the shared-budget walk, prepare two addresses, Wallet A and Wallet B. Leave the deployer,
              the allocation signer, and the liquidity helper out of that pair.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="human-title">
          <h2 id="human-title" className="section-title">Human verification, then the wallet</h2>
          <div className="panel">
            <p>
              On <Link href="/invest" className="link">/invest</Link>, connect Wallet A and choose
              “Enroll and register this wallet”. World App asks for a proof of human. That proof is checked
              by the server. It is not KYC, and it does not by itself register the address.
            </p>
            <p>
              After World accepts the proof, the wallet signs a separate message. That signature is how we
              know this address belongs with that session. You then confirm <code>registerWallet</code> on
              Sepolia. The page says the wallet is linked only after that transaction is onchain.
            </p>
            <p className="quiet">
              A cancelled World App prompt stops there. Nothing is registered.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="second-title">
          <h2 id="second-title" className="section-title">The second wallet</h2>
          <div className="panel">
            <p>
              Disconnect Wallet A and connect Wallet B. Choose “Continue and register this wallet”.
              That continues the same World ID session. Do not start a new enrollment if both wallets
              should share one budget. Wallet B signs its own message and sends its own registration.
              The allocation id stays off the page. Both wallets then read the same remaining USDC budget.
            </p>
            <p className="quiet">
              A second person, with their own World ID, gets a separate budget. I have not completed a live
              World ID session on this deployment yet, so this Sepolia path is ready for you to run. It is
              not a recording of a finished enrollment.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="budget-title">
          <h2 id="budget-title" className="section-title">The shared allocation</h2>
          <div className="panel">
            <p>
              The budget is gross USDC spent through the trusted purchase route. Alice can buy 700 with
              Wallet A. Wallet B’s request for 500 is too much and is rejected. Wallet B can buy the
              remaining room, for example 200, and both wallets then show what is left. Selling does not
              put the budget back. The issuer still has to approve the wallet’s access tier before a
              purchase. World ID does not grant that tier.
            </p>
            <p className="quiet">
              Those purchase numbers were run on local Anvil, chain id 31337, through{' '}
              <Link href="/demo" className="link">/demo</Link>. They have not been sent as an investor
              purchase on Sepolia.
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="demo-title">
          <h2 id="demo-title" className="section-title">Follow the demo</h2>
          <div className="panel">
            <p>
              Developers: the key setup, Anvil, and the test commands are in{' '}
              <a className="link" href={SETUP_DOC}>first-time-setup.md</a> on the <code>v2</code> branch.
              Local Anvil and Sepolia are different markets. Do not treat one as the other.
            </p>
            <p className="quiet">
              If the wallet is on the wrong network, the page asks you to switch to Ethereum Sepolia.
              If the wallet is not registered, it tells you to verify with World ID before purchasing.
              If World App is cancelled, it says no wallet was registered. If the purchase is larger than
              the shared remainder, it says the purchase exceeds the remaining allocation and the spend
              does not increase. If the offering directory is down, trading rules are still checked on Ethereum.
            </p>
          </div>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
