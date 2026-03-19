'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { LiveComplianceStatus } from '@/components/LiveComplianceStatus';
import { QuickStats } from '@/components/QuickStats';
import { TierTester } from '@/components/TierTester';
import { DynamicFeeVisualizer } from '@/components/DynamicFeeVisualizer';
import { SwapDemo } from '@/components/SwapDemo';
import { Providers } from './providers';

type PageId = 'page1' | 'page2' | 'page3' | 'page4' | 'page5';

const PAGES: { id: PageId; label: string; number: number }[] = [
  { id: 'page1', label: 'Dashboard', number: 1 },
  { id: 'page2', label: 'Access Control', number: 2 },
  { id: 'page3', label: 'Fee Curves', number: 3 },
  { id: 'page4', label: 'Swap Demo', number: 4 },
  { id: 'page5', label: 'Admin', number: 5 },
];

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageId>('page1');

  return (
    <Providers>
      <Header />
      
      <main className="flex-1 bg-white">
        {/* Page Navigation */}
        <div className="border-b-2 border-black bg-white sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-2 overflow-x-auto">
              {PAGES.map((page) => (
                <button
                  key={page.id}
                  onClick={() => setCurrentPage(page.id)}
                  className={`px-4 py-3 border-b-4 font-bold text-sm transition-colors whitespace-nowrap ${
                    currentPage === page.id
                      ? 'border-black text-black bg-gray-100'
                      : 'border-transparent text-gray-600 hover:text-black hover:bg-gray-50'
                  }`}
                >
                  {page.number}. {page.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Page 1: Dashboard */}
          {currentPage === 'page1' && (
            <div>
              <HeroSection />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
                <div className="lg:col-span-2">
                  <div className="mb-8">
                    <h2 className="text-3xl font-black text-black mb-6">YOUR COMPLIANCE STATUS</h2>
                    <LiveComplianceStatus />
                  </div>
                </div>
                <div>
                  <QuickStats />
                </div>
              </div>

              <div className="bg-black text-white border-t-2 border-black py-12 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <h2 className="text-3xl font-black mb-8">HOW THE HOOK WORKS</h2>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="border-2 border-white p-6">
                      <div className="text-3xl font-black mb-3">1️⃣</div>
                      <h3 className="text-lg font-bold mb-2">Access Control</h3>
                      <p className="text-sm text-gray-300">
                        User connects wallet. Hook checks compliance tier against{' '}
                        <code className="bg-gray-800 px-1">userTier</code> mapping.
                      </p>
                    </div>

                    <div className="border-2 border-white p-6">
                      <div className="text-3xl font-black mb-3">2️⃣</div>
                      <h3 className="text-lg font-bold mb-2">Fee Calculation</h3>
                      <p className="text-sm text-gray-300">
                        Oracle volatility is queried. If above threshold, dynamic fee applies.
                        Otherwise, base fee.
                      </p>
                    </div>

                    <div className="border-2 border-white p-6">
                      <div className="text-3xl font-black mb-3">3️⃣</div>
                      <h3 className="text-lg font-bold mb-2">Swap Execution</h3>
                      <p className="text-sm text-gray-300">
                        PoolManager executes swap at calculated fee. Hook emits{' '}
                        <code className="bg-gray-800 px-1">BeforeSwapCalled</code> event.
                      </p>
                    </div>

                    <div className="border-2 border-white p-6">
                      <div className="text-3xl font-black mb-3">4️⃣</div>
                      <h3 className="text-lg font-bold mb-2">Compliance Logged</h3>
                      <p className="text-sm text-gray-300">
                        All transactions are tied to verified user tiers, enabling regulatory
                        audit trails.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Page 2: Tier Tester */}
          {currentPage === 'page2' && (
            <div>
              <TierTester />
            </div>
          )}

          {/* Page 3: Fee Curves */}
          {currentPage === 'page3' && (
            <div>
              <DynamicFeeVisualizer />
            </div>
          )}

          {/* Page 4: Swap Demo */}
          {currentPage === 'page4' && (
            <div>
              <SwapDemo />
            </div>
          )}

          {/* Page 5: Admin (Placeholder) */}
          {currentPage === 'page5' && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔑</div>
              <h2 className="text-3xl font-black text-black mb-4">Admin Observatory</h2>
              <p className="text-gray-600 font-semibold mb-8">Coming next...</p>
              <p className="text-sm text-gray-500">Owner controls and hook management</p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <footer className="bg-black border-t-2 border-black py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-white text-center text-sm font-semibold">
              🔬 Exploring RWA Compliance integration with Uniswap v4
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
