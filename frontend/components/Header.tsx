'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="bg-black border-b-4 border-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0 bg-black border-2 border-white rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">Ψ</span>
          </div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">RWA COMPLIANCE</h1>
          <span className="shrink-0 text-sm font-bold text-white bg-black border border-white px-3 py-1 rounded">v4 HOOK</span>
        </div>
        <div className="shrink-0">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
