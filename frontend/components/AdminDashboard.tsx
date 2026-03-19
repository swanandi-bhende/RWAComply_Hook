'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { HOOK_ADDRESS, HOOK_ABI } from '@/contracts';

export function AdminDashboard() {
  const { address } = useAccount();
  const [newThreshold, setNewThreshold] = useState('');
  const [newCap, setNewCap] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  const { data: owner } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'owner',
  });

  // Check if connected user is owner
  React.useEffect(() => {
    if (owner && address && owner.toLowerCase() === address.toLowerCase()) {
      setIsOwner(true);
    }
  }, [owner, address]);

  if (!address) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">Connect wallet to access admin features</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-medium">Admin access required</p>
        <p className="text-sm text-red-700 mt-1">Only the hook owner can modify these settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center">
            <span className="text-red-700 font-bold">⚙️</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Admin Control Panel</h2>
            <p className="text-sm text-gray-600">Manage hook parameters and settings</p>
          </div>
        </div>
      </div>

      {/* Volatility Threshold Control */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Update Volatility Threshold</h3>
        <p className="text-sm text-gray-600 mb-4">
          Set the volatility level at which dynamic fees are triggered
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Threshold (%)
            </label>
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              placeholder="e.g., 5.5"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
            />
          </div>
          <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all">
            Update Threshold
          </button>
        </div>
      </div>

      {/* Retail Cap Control */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Update Retail Swap Cap</h3>
        <p className="text-sm text-gray-600 mb-4">
          Set maximum swap size for unverified (Tier 0) users
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Cap (Tokens)
            </label>
            <input
              type="number"
              value={newCap}
              onChange={(e) => setNewCap(e.target.value)}
              placeholder="e.g., 1000"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
            />
          </div>
          <button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all">
            Update Cap
          </button>
        </div>
      </div>

      {/* Pool Controls */}
      <div className="grid grid-cols-2 gap-4">
        <button className="bg-white border-2 border-yellow-200 text-yellow-700 font-bold py-3 rounded-lg hover:bg-yellow-50 transition-colors">
          ⏸️ Pause Pool
        </button>
        <button className="bg-white border-2 border-green-200 text-green-700 font-bold py-3 rounded-lg hover:bg-green-50 transition-colors">
          ▶️ Unpause Pool
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> All changes are permanent and will affect all trades immediately.
        </p>
      </div>
    </div>
  );
}
