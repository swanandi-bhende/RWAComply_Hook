'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { SiteNav } from '@/components/product/SiteNav';
import { HeroSection } from '@/components/HeroSection';
import { LiveComplianceStatus } from '@/components/LiveComplianceStatus';
import { QuickStats } from '@/components/QuickStats';
import { TierTester } from '@/components/TierTester';
import { DynamicFeeVisualizer } from '@/components/DynamicFeeVisualizer';
import { SwapDemo } from '@/components/SwapDemo';
import { AdminObservatory } from '@/components/AdminObservatory';
import { ProjectPresentation } from '@/components/ProjectPresentation';

type PageId = 'page1' | 'page2' | 'page3' | 'page4' | 'page5' | 'page6';

const PAGES: { id: PageId; label: string; number: number }[] = [
  { id: 'page1', label: 'Dashboard', number: 1 },
  { id: 'page2', label: 'Access Control', number: 2 },
  { id: 'page3', label: 'Fee Curves', number: 3 },
  { id: 'page4', label: 'Swap Demo', number: 4 },
  { id: 'page5', label: 'Admin', number: 5 },
  { id: 'page6', label: 'Presentation', number: 6 },
];

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageId>('page1');

  return (
    <>
      <SiteNav />
      <Header />
      <main className="demo page">
        <div className="demo-tabs" role="tablist" aria-label="Local demo">
          {PAGES.map((page) => (
            <button
              key={page.id}
              type="button"
              role="tab"
              aria-selected={currentPage === page.id}
              aria-current={currentPage === page.id ? 'page' : undefined}
              onClick={() => setCurrentPage(page.id)}
              className="demo-tab"
            >
              {page.number}. {page.label}
            </button>
          ))}
        </div>

        <div className="stack-lg">
          {/* Page 1: Dashboard */}
          {currentPage === 'page1' && (
            <div>
              <HeroSection />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
                <div className="lg:col-span-2">
                  <div className="mb-8">
                    <h2 className="section-title">Your compliance status</h2>
                    <LiveComplianceStatus />
                  </div>
                </div>
                <div>
                  <QuickStats />
                </div>
              </div>

              <section className="stack">
                <h2 className="section-title">How the hook works</h2>
                <div className="flow">
                    <div className="panel">
                      <h3 className="card-title">Access control</h3>
                      <p className="quiet">
                        User connects wallet. Hook checks compliance tier against{' '}
                        <code className="bg-gray-800 px-1">userTier</code> mapping.
                      </p>
                    </div>

                    <div className="panel">
                      <h3 className="card-title">Fee calculation</h3>
                      <p className="quiet">
                        Oracle volatility is queried. If above threshold, dynamic fee applies.
                        Otherwise, base fee.
                      </p>
                    </div>

                    <div className="panel">
                      <h3 className="card-title">Swap execution</h3>
                      <p className="quiet">
                        PoolManager executes swap at calculated fee. Hook emits{' '}
                        <code className="bg-gray-800 px-1">BeforeSwapCalled</code> event.
                      </p>
                    </div>

                    <div className="panel">
                      <h3 className="card-title">Compliance logged</h3>
                      <p className="quiet">
                        Supported swaps are checked against the access tier of the connected wallet. That tier is not proof of identity.
                      </p>
                    </div>
                </div>
              </section>
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

          {/* Page 5: Admin Observatory */}
          {currentPage === 'page5' && (
            <div>
              <AdminObservatory />
            </div>
          )}

          {/* Page 6: Project Presentation */}
          {currentPage === 'page6' && (
            <div>
              <ProjectPresentation />
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <footer className="site-footer">
          <p>Local Anvil demo for the RWAComply hook. This is not the Sepolia investor experience.</p>
          <p><a className="link" href="/getting-started">Getting started</a></p>
        </footer>
      </main>
    </>
  );
}
