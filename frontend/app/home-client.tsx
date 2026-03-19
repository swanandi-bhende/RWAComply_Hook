'use client';

import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { LiveComplianceStatus } from '@/components/LiveComplianceStatus';
import { QuickStats } from '@/components/QuickStats';
import { Providers } from './providers';

export default function Home() {
  return (
    <Providers>
      <Header />
      
      <main className="flex-1 bg-white">
        {/* Page 1: Hero Section */}
        <HeroSection />

        {/* Page 1: Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Compliance Status */}
            <div className="lg:col-span-2">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-black mb-6">YOUR COMPLIANCE STATUS</h2>
                <LiveComplianceStatus />
              </div>
            </div>

            {/* Right: Quick Stats */}
            <div>
              <QuickStats />
            </div>
          </div>
        </div>

        {/* Bottom Section: How It Works */}
        <div className="bg-black text-white border-t-2 border-black py-12 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black mb-8">HOW THE HOOK WORKS</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Step 1: Access Control */}
              <div className="border-2 border-white p-6">
                <div className="text-3xl font-black mb-3">1️⃣</div>
                <h3 className="text-lg font-bold mb-2">Access Control</h3>
                <p className="text-sm text-gray-300">
                  User connects wallet. Hook checks compliance tier against{' '}
                  <code className="bg-gray-800 px-1">userTier</code> mapping.
                </p>
              </div>

              {/* Step 2: Fee Calculation */}
              <div className="border-2 border-white p-6">
                <div className="text-3xl font-black mb-3">2️⃣</div>
                <h3 className="text-lg font-bold mb-2">Fee Calculation</h3>
                <p className="text-sm text-gray-300">
                  Oracle volatility is queried. If above threshold, dynamic fee applies. Otherwise, base fee.
                </p>
              </div>

              {/* Step 3: Swap Execution */}
              <div className="border-2 border-white p-6">
                <div className="text-3xl font-black mb-3">3️⃣</div>
                <h3 className="text-lg font-bold mb-2">Swap Execution</h3>
                <p className="text-sm text-gray-300">
                  PoolManager executes swap at calculated fee. Hook emits{' '}
                  <code className="bg-gray-800 px-1">BeforeSwapCalled</code> event.
                </p>
              </div>

              {/* Step 4: Compliance Logged */}
              <div className="border-2 border-white p-6">
                <div className="text-3xl font-black mb-3">4️⃣</div>
                <h3 className="text-lg font-bold mb-2">Compliance Logged</h3>
                <p className="text-sm text-gray-300">
                  All transactions are tied to verified user tiers, enabling regulatory audit trails.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Specs */}
        <div className="bg-white border-b-2 border-black py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black text-black mb-8">TECHNICAL SPECIFICATIONS</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left: Hook Permissions */}
              <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded">
                <h3 className="text-lg font-bold text-black mb-4">Hook Permissions</h3>
                <div className="space-y-2 text-sm font-mono text-gray-800">
                  <div>
                    <span className="text-green-600">✓</span> beforeAddLiquidity
                  </div>
                  <div>
                    <span className="text-green-600">✓</span> beforeSwap
                  </div>
                  <div>
                    <span className="text-green-600">✓</span> afterSwap
                  </div>
                  <div>
                    <span className="text-gray-400">✗</span> afterAddLiquidity
                  </div>
                  <div>
                    <span className="text-gray-400">✗</span> beforeRemoveLiquidity
                  </div>
                  <div>
                    <span className="text-gray-400">✗</span> afterRemoveLiquidity
                  </div>
                </div>
              </div>

              {/* Right: Key Features */}
              <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded">
                <h3 className="text-lg font-bold text-black mb-4">Key Features</h3>
                <div className="space-y-2 text-sm text-gray-800">
                  <div>
                    <span className="font-bold">Tier System:</span> 3-tier compliance model
                  </div>
                  <div>
                    <span className="font-bold">Oracle Integration:</span> Real-time volatility feeds
                  </div>
                  <div>
                    <span className="font-bold">Dynamic Fees:</span> Volatility-based pricing
                  </div>
                  <div>
                    <span className="font-bold">Retail Caps:</span> Risk management limits
                  </div>
                  <div>
                    <span className="font-bold">Owner Control:</span> Ownable pattern with events
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <footer className="bg-black border-t-2 border-black py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-white text-center text-sm font-semibold">
              🔬 Explore the hook in action: See how tiers affect fees and access on the next pages.
            </p>
            <p className="text-gray-400 text-center text-xs mt-4">
              Uniswap v4 Hookathon 2026 • RWA Compliance Hook
            </p>
          </div>
        </footer>
      </main>
    </Providers>
  );
}
