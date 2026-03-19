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
        <div className="border-b border-gray-200 bg-white sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
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
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Compliance Status</h2>
                <ComplianceStatus />
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Market Conditions</h2>
                <OracleStatus />
              </section>

              {/* Quick Stats */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Stats</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                    <p className="text-gray-600 text-sm font-medium mb-2">Total Value Locked</p>
                    <h3 className="text-2xl font-bold text-gray-900">$2.5M</h3>
                  </div>
                  <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                    <p className="text-gray-600 text-sm font-medium mb-2">24h Volume</p>
                    <h3 className="text-2xl font-bold text-gray-900">$156K</h3>
                  </div>
                  <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                    <p className="text-gray-600 text-sm font-medium mb-2">Verified Users</p>
                    <h3 className="text-2xl font-bold text-gray-900">1,234</h3>
                  </div>
                  <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                    <p className="text-gray-600 text-sm font-medium mb-2">Avg Fee</p>
                    <h3 className="text-2xl font-bold text-gray-900">0.15%</h3>
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
                <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Swap Info</h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="text-gray-600">Min. Price Impact:</span> <span className="font-semibold">0.5%</span></p>
                    <p><span className="text-gray-600">Slippage Tolerance:</span> <span className="font-semibold">0.5%</span></p>
                    <p><span className="text-gray-600">Network Fee:</span> <span className="font-semibold">~$2-5</span></p>
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
                <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Your Positions</h3>
                  <p className="text-gray-600 text-sm mb-4">Connect wallet to view positions</p>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">Active Ranges: </span><span className="font-semibold">0</span></p>
                    <p><span className="text-gray-600">Total Liquidity: </span><span className="font-semibold">-</span></p>
                    <p><span className="text-gray-600">Earned Fees: </span><span className="font-semibold text-green-600">-</span></p>
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
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-gray-900 mb-3">About</h3>
              <p className="text-sm text-gray-600">RWA Compliance Hook for Uniswap v4</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Links</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-blue-600">Documentation</a></li>
                <li><a href="#" className="hover:text-blue-600">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Support</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-blue-600">Help Center</a></li>
                <li><a href="#" className="hover:text-blue-600">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-blue-600">Terms</a></li>
                <li><a href="#" className="hover:text-blue-600">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8">
            <p className="text-center text-sm text-gray-600">
              © 2026 RWA Compliance Hook. Built for UHI8 Hookathon.
            </p>
          </div>
        </div>
      </footer>
    </Providers>
  );
}
