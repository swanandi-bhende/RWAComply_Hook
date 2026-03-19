'use client';

import { useEffect, useState } from 'react';

export function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="bg-white border-b-2 border-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Title Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-black mb-2 leading-tight">
            RWA Compliance Hook
          </h1>
          <h2 className="text-5xl md:text-6xl font-black text-black mb-6">
            for Uniswap v4
          </h2>
          <p className="text-lg md:text-xl text-black font-semibold max-w-2xl">
            Regulatory-ready trading with oracle-driven dynamic fees and tier-based access control.
            Demonstrates how on-chain compliance integrates directly into Uniswap's hook architecture.
          </p>
        </div>

        {/* 3-Card Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Card 1: Tier-Based Access */}
          <div className="bg-black text-white border-2 border-black p-6 md:p-8 rounded">
            <div className="mb-4">
              <div className="text-4xl font-black mb-2">🔐</div>
              <h3 className="text-lg font-bold mb-2">Tier-Based Access</h3>
            </div>
            <p className="text-sm font-semibold mb-4 leading-relaxed">
              Control who can trade and at what rates using compliance tiers.
            </p>
            <div className="space-y-2 text-xs font-mono bg-black border border-white p-3">
              <div>
                <span className="text-red-400">Tier 0:</span>{' '}
                <span className="text-white">❌ Blocked</span>
              </div>
              <div>
                <span className="text-yellow-300">Tier 1:</span>{' '}
                <span className="text-white">Retail 30bps</span>
              </div>
              <div>
                <span className="text-green-300">Tier 2:</span>{' '}
                <span className="text-white">Institutional 10bps</span>
              </div>
            </div>
          </div>

          {/* Card 2: Oracle-Driven Fees */}
          <div className="bg-black text-white border-2 border-black p-6 md:p-8 rounded">
            <div className="mb-4">
              <div className="text-4xl font-black mb-2">📡</div>
              <h3 className="text-lg font-bold mb-2">Oracle-Driven Fees</h3>
            </div>
            <p className="text-sm font-semibold mb-4 leading-relaxed">
              Fees adjust dynamically based on market volatility from on-chain oracle.
            </p>
            <div className="space-y-2 text-xs font-mono bg-black border border-white p-3">
              <div>
                <span className="text-white">Vol &lt; 5%:</span>{' '}
                <span className="text-green-300">Default</span>
              </div>
              <div>
                <span className="text-white">Vol {'>'} 5%:</span>{' '}
                <span className="text-orange-300">Dynamic ⬆️</span>
              </div>
              <div>
                <span className="text-white">Tier 2:</span>{' '}
                <span className="text-blue-300">Always Lower</span>
              </div>
            </div>
          </div>

          {/* Card 3: Hook Integration */}
          <div className="bg-black text-white border-2 border-black p-6 md:p-8 rounded">
            <div className="mb-4">
              <div className="text-4xl font-black mb-2">⚙️</div>
              <h3 className="text-lg font-bold mb-2">Hook Integration</h3>
            </div>
            <p className="text-sm font-semibold mb-4 leading-relaxed">
              Deep Uniswap v4 integration: runs in beforeSwap() and beforeAddLiquidity().
            </p>
            <div className="space-y-2 text-xs font-mono bg-black border border-white p-3">
              <div>
                <span className="text-purple-300">beforeSwap:</span> Tier check
              </div>
              <div>
                <span className="text-cyan-300">beforeAddLiq:</span> Verify tier
              </div>
              <div>
                <span className="text-pink-300">afterSwap:</span> Event log
              </div>
            </div>
          </div>
        </div>

        {/* "Why This Matters" Callout */}
        <div className="mt-12 bg-black border-2 border-black p-6 md:p-8">
          <p className="text-white font-bold text-lg mb-2">📋 Why This Matters for Uniswap</p>
          <p className="text-white text-sm leading-relaxed">
            This hook proves that Uniswap v4's architecture can embed regulatory compliance
            at the protocol level without sacrificing composability. Institutions can now
            trade with confidence on decentralized venues, unlocking trillions in RWA liquidity.
          </p>
        </div>
      </div>
    </div>
  );
}
