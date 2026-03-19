'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">Ψ</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">RWA Compliance</h1>
          <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">v4 Hook</span>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
