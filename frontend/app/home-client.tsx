'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { ComplianceStatus } from '@/components/ComplianceStatus';
import { OracleStatus } from '@/components/OracleStatus';
import { SwapInterface } from '@/components/SwapInterface';
import { AddLiquidity } from '@/components/AddLiquidity';
import { AdminDashboard } from '@/components/AdminDashboard';
import { TransactionHistory } from '@/components/TransactionHistory';
import { Providers } from './providers';

type Tab = 'overview' | 'swap' | 'liquidity' | 'admin' | 'history';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'swap', label: 'Swap', icon: '⇄' },
    { id: 'liquidity', label: 'Liquidity', icon: '+' },
    { id: 'admin', label: 'Admin', icon: '⚙️' },
    { id: 'history', label: 'History', icon: '📝' },
  ];

  return (
    <Providers>
      <Header />
      
      <main className="flex-1">
        {/* Top Navigation */}
        <div className="border-b-4 border-black bg-white sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 border-b-4 font-bold text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-black text-black bg-gray-100'
                      : 'border-transparent text-black hover:bg-gray-50'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-black mb-4">YOUR COMPLIANCE STATUS</h2>
                <ComplianceStatus />
              </section>

              <section>
                <h2 className="text-2xl font-bold text-black mb-4">MARKET CONDITIONS</h2>
                <OracleStatus />
              </section>

              {/* Quick Stats */}
              <section>
                <h2 className="text-2xl font-bold text-black mb-4">QUICK STATS</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white border-3 border-black p-6">
                    <p className="text-black text-sm font-bold mb-2">TOTAL VALUE LOCKED</p>
                    <h3 className="text-2xl font-bold text-black">$2.5M</h3>
                  </div>
                  <div className="bg-white border-3 border-black p-6">
                    <p className="text-black text-sm font-bold mb-2">24H VOLUME</p>
                    <h3 className="text-2xl font-bold text-black">$156K</h3>
                  </div>
                  <div className="bg-white border-3 border-black p-6">
                    <p className="text-black text-sm font-bold mb-2">VERIFIED USERS</p>
                    <h3 className="text-2xl font-bold text-black">1,234</h3>
                  </div>
                  <div className="bg-white border-3 border-black p-6">
                    <p className="text-black text-sm font-bold mb-2">AVG FEE</p>
                    <h3 className="text-2xl font-bold text-black">0.15%</h3>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Swap Tab */}
          {activeTab === 'swap' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <SwapInterface />
              </div>
              <div className="space-y-6">
                <div className="bg-white border-3 border-black p-6">
                  <h3 className="font-bold text-black mb-4">SWAP INFO</h3>
                  <div className="space-y-3 text-sm font-bold text-black border-t-2 border-black pt-3">
                    <p><span>Min. Price Impact:</span> <span>0.5%</span></p>
                    <p><span>Slippage Tolerance:</span> <span>0.5%</span></p>
                    <p><span>Network Fee:</span> <span>~$2-5</span></p>
                  </div>
                </div>
                <OracleStatus />
              </div>
            </div>
          )}

          {/* Liquidity Tab */}
          {activeTab === 'liquidity' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <AddLiquidity />
              </div>
              <div className="space-y-6">
                <div className="bg-white border-3 border-black p-6">
                  <h3 className="font-bold text-black mb-4">YOUR POSITIONS</h3>
                  <p className="text-black font-bold text-sm mb-4">Connect wallet to view positions</p>
                  <div className="space-y-2 text-sm font-bold text-black border-t-2 border-black pt-3">
                    <p><span>Active Ranges: </span><span>0</span></p>
                    <p><span>Total Liquidity: </span><span>-</span></p>
                    <p><span>Earned Fees: </span><span>-</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Tab */}
          {activeTab === 'admin' && (
            <div className="max-w-2xl">
              <AdminDashboard />
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <TransactionHistory />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black border-t-4 border-black mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-white mb-3">ABOUT</h3>
              <p className="text-sm font-semibold text-white">RWA Compliance Hook for Uniswap v4</p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-3">LINKS</h3>
              <ul className="space-y-2 text-sm font-semibold text-white">
                <li><a href="#" className="hover:underline">Documentation</a></li>
                <li><a href="#" className="hover:underline">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-3">SUPPORT</h3>
              <ul className="space-y-2 text-sm font-semibold text-white">
                <li><a href="#" className="hover:underline">Help Center</a></li>
                <li><a href="#" className="hover:underline">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-3">LEGAL</h3>
              <ul className="space-y-2 text-sm font-semibold text-white">
                <li><a href="#" className="hover:underline">Terms</a></li>
                <li><a href="#" className="hover:underline">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t-2 border-white pt-8">
            <p className="text-center text-sm font-bold text-white">
              © 2026 RWA Compliance Hook. Built for UHI8 Hookathon.
            </p>
          </div>
        </div>
      </footer>
    </Providers>
  );
}
