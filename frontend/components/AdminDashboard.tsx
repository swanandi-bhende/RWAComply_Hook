'use client';

import { useEffect, useState } from 'react';
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

  const ownerAddress = typeof owner === 'string' ? owner : undefined;

  // Check if connected user is owner
  useEffect(() => {
    if (ownerAddress && address && ownerAddress.toLowerCase() === address.toLowerCase()) {
      setIsOwner(true);
    } else {
      setIsOwner(false);
    }
  }, [ownerAddress, address]);

  if (!address) {
    return (
      <div className="bg-white border-3 border-black rounded p-6">
        <p className="text-black font-bold">Connect wallet to access admin features</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="bg-white border-3 border-black rounded p-6">
        <p className="text-black font-bold">ADMIN ACCESS REQUIRED</p>
        <p className="text-sm font-semibold text-black mt-2">Only the hook owner can modify these settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-black border-3 border-black rounded p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white border-2 border-black rounded flex items-center justify-center">
            <span className="text-black font-bold text-lg">⚙️</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">ADMIN CONTROL PANEL</h2>
            <p className="text-sm font-semibold text-white">Manage hook parameters and settings</p>
          </div>
        </div>
      </div>

      {/* Volatility Threshold Control */}
      <div className="bg-white border-3 border-black p-6">
        <h3 className="text-lg font-bold text-black mb-4">UPDATE VOLATILITY THRESHOLD</h3>
        <p className="text-sm font-semibold text-black mb-4">
          Set the volatility level at which dynamic fees are triggered
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-black mb-2">
              NEW THRESHOLD (%)
            </label>
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              placeholder="e.g., 5.5"
              className="w-full px-4 py-3 border-3 border-black focus:outline-none bg-white text-black font-bold"
            />
          </div>
          <button className="w-full bg-black text-white font-bold py-3 border-3 border-black hover:bg-white hover:text-black transition-all">
            UPDATE THRESHOLD
          </button>
        </div>
      </div>

      {/* Retail Cap Control */}
      <div className="bg-white border-3 border-black p-6">
        <h3 className="text-lg font-bold text-black mb-4">UPDATE RETAIL SWAP CAP</h3>
        <p className="text-sm font-semibold text-black mb-4">
          Set maximum swap size for unverified (Tier 0) users
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-black mb-2">
              NEW CAP (TOKENS)
            </label>
            <input
              type="number"
              value={newCap}
              onChange={(e) => setNewCap(e.target.value)}
              placeholder="e.g., 1000"
              className="w-full px-4 py-3 border-3 border-black focus:outline-none bg-white text-black font-bold"
            />
          </div>
          <button className="w-full bg-black text-white font-bold py-3 border-3 border-black hover:bg-white hover:text-black transition-all">
            UPDATE CAP
          </button>
        </div>
      </div>

      {/* Pool Controls */}
      <div className="grid grid-cols-2 gap-4">
        <button className="bg-white border-3 border-black text-black font-bold py-3 hover:bg-black hover:text-white transition-all">
          ⏸️ PAUSE POOL
        </button>
        <button className="bg-black border-3 border-black text-white font-bold py-3 hover:bg-white hover:text-black transition-all">
          ▶️ UNPAUSE POOL
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
