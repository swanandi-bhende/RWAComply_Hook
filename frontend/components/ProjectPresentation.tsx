'use client';

import { useState } from 'react';

type PresentationSection = 'overview' | 'problem' | 'solution' | 'architecture' | 'impact';

export function ProjectPresentation() {
  const [activeSection, setActiveSection] = useState<PresentationSection>('overview');

  const sections: { id: PresentationSection; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'problem', label: 'The Problem' },
    { id: 'solution', label: 'Our Solution' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'impact', label: 'Impact' },
  ];

  return (
    <div className="space-y-12">
      {/* Section Navigator */}
      <div className="bg-white border-3 border-black overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-6">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-4 py-3 font-bold text-sm border-2 transition-colors ${
                activeSection === section.id
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-black hover:bg-gray-100'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-10">
          <div className="bg-black text-white border-3 border-black p-12">
            <h1 className="text-6xl font-black mb-6">RWAComplyHook</h1>
            <p className="text-2xl font-semibold mb-10 leading-relaxed">
              A production-ready compliance layer for Uniswap v4 that enables regulated trading of Real World Assets.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="border-2 border-white p-8">
                <h3 className="text-2xl font-bold mb-4">Tier-Based Access</h3>
                <p className="text-lg text-gray-300">Tier 0 (blocked), Tier 1 (retail), Tier 2 (institutional)</p>
              </div>
              <div className="border-2 border-white p-8">
                <h3 className="text-2xl font-bold mb-4">Dynamic Fees</h3>
                <p className="text-lg text-gray-300">Fees adjust based on real-time market volatility</p>
              </div>
              <div className="border-2 border-white p-8">
                <h3 className="text-2xl font-bold mb-4">Admin Controls</h3>
                <p className="text-lg text-gray-300">Pause pools, set caps, manage oracles</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border-3 border-black p-10 bg-blue-50">
              <h3 className="text-3xl font-black mb-6 text-black">The Stats</h3>
              <ul className="space-y-4 text-black font-bold text-lg">
                <li>5 Smart Contracts</li>
                <li>5 Frontend Pages (Live & Interactive)</li>
                <li>22/22 Tests Passing</li>
                <li>Real On-Chain Swaps</li>
                <li>Transaction History with Etherscan Links</li>
                <li>Production Build Ready</li>
              </ul>
            </div>

            <div className="border-3 border-black p-10 bg-green-50">
              <h3 className="text-3xl font-black mb-6 text-black">Key Innovation</h3>
              <p className="text-black font-bold text-lg mb-6 leading-relaxed">
                Proves decentralized finance and regulatory compliance are not mutually exclusive.
              </p>
              <p className="text-lg text-black leading-relaxed">
                By leveraging Uniswap v4's hook architecture, we've built a system that enables tier-based access control, enforces trading limits, implements risk-responsive fees, and maintains admin safeguards—all while preserving decentralization.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* THE PROBLEM */}
      {activeSection === 'problem' && (
        <div className="space-y-10">
          <div className="text-5xl font-black mb-8">The Problem</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-red-50 border-3 border-black p-10">
              <h3 className="text-3xl font-black mb-6 text-black">DeFi Today</h3>
              <ul className="space-y-5 text-black font-bold text-lg">
                <li>Completely anonymous</li>
                <li>No trading limits</li>
                <li>Same fees for all</li>
                <li>No risk controls</li>
                <li>No way to pause</li>
                <li>No user verification</li>
              </ul>
            </div>

            <div className="bg-green-50 border-3 border-black p-10">
              <h3 className="text-3xl font-black mb-6 text-black">Traditional Finance</h3>
              <ul className="space-y-5 text-black font-bold text-lg">
                <li>KYC/AML verification</li>
                <li>Tier-based trading limits</li>
                <li>Risk-adjusted fees</li>
                <li>Risk parameter controls</li>
                <li>Can halt trading</li>
                <li>Compliance audit trails</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border-3 border-black p-10">
            <h3 className="text-3xl font-black mb-6 text-black">The Gap</h3>
            <p className="text-black font-bold text-xl mb-6 leading-relaxed">
              Regulators want to enable DeFi. Institutions won't enter without:
            </p>
            <ul className="space-y-3 text-black text-lg ml-6">
              <li>Proof of customer verification</li>
              <li>Tier-based trading rules</li>
              <li>Dynamic risk management</li>
              <li>Administrator safeguards</li>
              <li>Compliance audit capability</li>
            </ul>
          </div>
        </div>
      )}

      {/* OUR SOLUTION */}
      {activeSection === 'solution' && (
        <div className="space-y-10">
          <div className="text-5xl font-black mb-8">Our Solution</div>

          <div className="bg-black text-white border-3 border-black p-10">
            <h2 className="text-3xl font-black mb-8">How RWAComplyHook Works</h2>

            <div className="space-y-6 mb-10">
              <div className="border-2 border-white p-6 bg-gray-900">
                <div className="text-2xl font-black mb-4">Tier System</div>
                <div className="grid grid-cols-3 gap-4 text-sm font-bold">
                  <div className="border border-white p-3">
                    <p className="font-bold text-lg">Tier 0</p>
                    <p className="text-gray-300">Unverified</p>
                    <p className="text-red-400 font-bold">BLOCKED</p>
                  </div>
                  <div className="border border-white p-3">
                    <p className="font-bold text-lg">Tier 1</p>
                    <p className="text-gray-300">Retail</p>
                    <p className="text-yellow-400 font-bold">CAPPED</p>
                  </div>
                  <div className="border border-white p-3">
                    <p className="font-bold text-lg">Tier 2</p>
                    <p className="text-gray-300">Institutional</p>
                    <p className="text-green-400 font-bold">UNLIMITED</p>
                  </div>
                </div>
              </div>

              <div className="border-2 border-white p-6 bg-gray-900">
                <div className="text-2xl font-black mb-4">Dynamic Fees</div>
                <p className="text-gray-300 text-base mb-4 font-bold">
                  Reads real-time market volatility from oracle. Fees adjust automatically:
                </p>
                <div className="space-y-3 text-base font-bold">
                  <p>
                    <span className="font-black">Low Volatility:</span> Tier 1 = 25 bps, Tier 2 = 5 bps
                  </p>
                  <p>
                    <span className="font-black">High Volatility:</span> Tier 1 = 100+ bps, Tier 2 = 50+ bps
                  </p>
                </div>
              </div>

              <div className="border-2 border-white p-6 bg-gray-900">
                <div className="text-2xl font-black mb-4">Admin Controls</div>
                <ul className="text-base text-gray-300 space-y-2 font-bold">
                  <li>Pause/unpause trading</li>
                  <li>Set retail trade caps</li>
                  <li>Adjust volatility threshold</li>
                  <li>Swap oracle provider</li>
                </ul>
              </div>
            </div>

            <div className="bg-gray-800 p-6 border border-gray-600 text-base font-mono font-bold leading-relaxed">
              <p className="text-green-400 text-lg mb-4">Swap Flow:</p>
              <p className="text-gray-300">1. User → SwapDemo page</p>
              <p className="text-gray-300">2. Enter amount → Click "Run Real Swap Flow"</p>
              <p className="text-gray-300">3. Hook checks: Is user tier 1+? Under cap? Not paused?</p>
              <p className="text-gray-300">4. If all pass: Approve + Execute swaps on-chain</p>
              <p className="text-gray-300">5. Transaction recorded in TRANSACTION HISTORY</p>
            </div>
          </div>
        </div>
      )}

      {/* ARCHITECTURE */}
      {activeSection === 'architecture' && (
        <div className="space-y-10">
          <div className="text-5xl font-black mb-8">Architecture</div>

          <div className="bg-white border-3 border-black overflow-hidden">
            <div className="bg-black text-white p-6 font-bold text-2xl">Smart Contracts</div>
            <div className="p-8 space-y-6">
              <div className="border-2 border-black p-6">
                <h3 className="font-black text-black text-2xl mb-4">RWAComplyHook.sol</h3>
                <p className="text-black text-lg mb-4 font-bold">
                  Main contract implementing Uniswap v4 IHooks interface
                </p>
                <ul className="text-lg text-black space-y-2 ml-6 font-bold">
                  <li>User tier mapping</li>
                  <li>beforeSwap: Validates access, caps, and calculates fees</li>
                  <li>afterSwap: Emits compliance events</li>
                  <li>Admin functions: setTier, setRetailCap, setOracle, pausePool</li>
                </ul>
              </div>

              <div className="border-2 border-black p-6">
                <h3 className="font-black text-black text-2xl mb-4">MockRWAOracle.sol</h3>
                <p className="text-black text-lg mb-4 font-bold">
                  Volatility oracle that hook reads during swaps
                </p>
                <ul className="text-lg text-black space-y-2 ml-6 font-bold">
                  <li>Current volatility percentage (0-100%)</li>
                  <li>Owner-only setVolatility function</li>
                  <li>Production: Chainlink TWAP, Uniswap Flash Loans, etc.</li>
                </ul>
              </div>

              <div className="border-2 border-black p-6">
                <h3 className="font-black text-black text-2xl mb-4">PoolExecutor.sol</h3>
                <p className="text-black text-lg mb-4 font-bold">
                  Executes swaps on behalf of users (like a relayer)
                </p>
                <ul className="text-lg text-black space-y-2 ml-6 font-bold">
                  <li>Handles token approvals</li>
                  <li>Calls PoolManager.swap()</li>
                  <li>Settles token balances</li>
                  <li>Tier verified before execution</li>
                </ul>
              </div>

              <div className="border-2 border-black p-6">
                <h3 className="font-black text-black text-2xl mb-4">MockERC20.sol</h3>
                <p className="text-black text-lg font-bold">
                  Test tokens (Token A and Token B) for demo purposes
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border-3 border-black p-8">
            <h3 className="text-3xl font-black text-black mb-6">Flow: How a Swap Executes</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="bg-black text-white font-black w-10 h-10 flex items-center justify-center rounded-full text-lg">1</div>
                <div className="text-black font-bold text-lg">Frontend: User enters amount and clicks "Run Real Swap Flow"</div>
              </div>
              <div className="flex gap-4">
                <div className="bg-black text-white font-black w-10 h-10 flex items-center justify-center rounded-full text-lg">2</div>
                <div className="text-black font-bold text-lg">Wagmi: Sends ERC20.approve() to poolManager with amount</div>
              </div>
              <div className="flex gap-4">
                <div className="bg-black text-white font-black w-10 h-10 flex items-center justify-center rounded-full text-lg">3</div>
                <div className="text-black font-bold text-lg">Wagmi: Sends PoolExecutor.execute() call</div>
              </div>
              <div className="flex gap-4">
                <div className="bg-black text-white font-black w-10 h-10 flex items-center justify-center rounded-full text-lg">4</div>
                <div className="text-black font-bold text-lg">PoolExecutor: Calls PoolManager.swap()</div>
              </div>
              <div className="flex gap-4">
                <div className="bg-black text-white font-black w-10 h-10 flex items-center justify-center rounded-full text-lg">5</div>
                <div className="text-black font-bold text-lg">Hook beforeSwap fires: Checks user tier, oracle volatility, retail cap</div>
              </div>
              <div className="flex gap-4">
                <div className="bg-black text-white font-black w-10 h-10 flex items-center justify-center rounded-full text-lg">6</div>
                <div className="text-black font-bold text-lg">Pool executes swap at calculated fee</div>
              </div>
              <div className="flex gap-4">
                <div className="bg-black text-white font-black w-10 h-10 flex items-center justify-center rounded-full text-lg">7</div>
                <div className="text-black font-bold text-lg">Hook afterSwap fires: Emits compliance event</div>
              </div>
              <div className="flex gap-4">
                <div className="bg-black text-white font-black w-10 h-10 flex items-center justify-center rounded-full text-lg">8</div>
                <div className="text-black font-bold text-lg">Frontend: Refetches balances, adds to transaction history</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPACT */}
      {activeSection === 'impact' && (
        <div className="space-y-10">
          <div className="text-5xl font-black mb-8">Impact & Use Cases</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-green-50 border-3 border-black p-8">
              <h3 className="text-3xl font-black text-black mb-6">For Regulators</h3>
              <p className="text-black font-bold text-lg leading-relaxed">
                This proves DeFi can be compliant. Users verified, trades auditable, risk is managed.
              </p>
            </div>

            <div className="bg-blue-50 border-3 border-black p-8">
              <h3 className="text-3xl font-black text-black mb-6">For Institutions</h3>
              <p className="text-black font-bold text-lg leading-relaxed">
                DeFi efficiency with traditional safeguards. Caps, volatility-based fees, pause capability.
              </p>
            </div>

            <div className="bg-yellow-50 border-3 border-black p-8">
              <h3 className="text-3xl font-black text-black mb-6">For Developers</h3>
              <p className="text-black font-bold text-lg leading-relaxed">
                Production code. Fork it, adapt it, extend it. Proven on Uniswap v4 with real swaps.
              </p>
            </div>
          </div>

          <div className="bg-black text-white border-3 border-black p-10">
            <h3 className="text-3xl font-black mb-8">How Uniswap Can Use This</h3>

            <div className="space-y-5">
              <div className="border-2 border-white p-6">
                <div className="font-black text-2xl mb-3">1. Ecosystem Expansion</div>
                <p className="text-white text-lg leading-relaxed">
                  Opens RWA market (tens of billions in assets) to Uniswap. Enables institutional adoption.
                </p>
              </div>

              <div className="border-2 border-white p-6">
                <div className="font-black text-2xl mb-3">2. Governance Integration</div>
                <p className="text-white text-lg leading-relaxed">
                  Hook parameters (caps, thresholds) can be DAO-governed. Different pools can have different profiles.
                </p>
              </div>

              <div className="border-2 border-white p-6">
                <div className="font-black text-2xl mb-3">3. Regulatory Credibility</div>
                <p className="text-white text-lg leading-relaxed">
                  Demonstrates Uniswap can coexist with compliance. Attracts enterprise liquidity.
                </p>
              </div>

              <div className="border-2 border-white p-6">
                <div className="font-black text-2xl mb-3">4. Composability</div>
                <p className="text-white text-lg leading-relaxed">
                  Other hooks can stack on top. Risk limits, circuit breakers, other compliance checks.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border-3 border-black p-10">
            <h3 className="text-3xl font-black text-black mb-8">Developer Integration Path</h3>

            <div className="space-y-5">
              <div className="border-2 border-black p-6 bg-gray-50">
                <div className="font-black text-black text-2xl mb-4">For Hook Developers</div>
                <p className="text-black text-lg mb-4 font-bold">
                  Start with RWAComplyHook as template. Extend it with:
                </p>
                <ul className="text-lg text-black ml-6 space-y-2 font-bold">
                  <li>Custom KYC/AML checks</li>
                  <li>Geographic restrictions</li>
                  <li>Counterparty limits</li>
                </ul>
              </div>

              <div className="border-2 border-black p-6 bg-gray-50">
                <div className="font-black text-black text-2xl mb-4">For Protocol Teams</div>
                <p className="text-black text-lg font-bold">
                  Deploy on your pool. Configure tiers and thresholds via admin panel.
                </p>
              </div>

              <div className="border-2 border-black p-6 bg-gray-50">
                <div className="font-black text-black text-2xl mb-4">For DeFi Aggregators</div>
                <p className="text-black text-lg font-bold">
                  Integrate into routing. Check beforeSwap reverts. Factor dynamic fees into slippage calculations.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-black text-white border-3 border-black p-10">
            <h3 className="text-3xl font-black mb-6">The Bottom Line</h3>
            <p className="text-xl font-bold mb-6 leading-relaxed">
              RWAComplyHook proves that decentralized finance and regulatory compliance are not mutually exclusive.
            </p>
            <p className="text-lg font-bold leading-relaxed">
              By leveraging Uniswap v4's hook architecture, we've created a production-ready compliance layer that enables tier-based access control, enforces trading limits, implements risk-responsive fees, and maintains admin safeguards—all while preserving the core decentralization that makes DeFi powerful.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
