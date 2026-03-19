'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { HOOK_ADDRESS, ORACLE_ADDRESS, TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, HOOK_ABI, ORACLE_ABI } from '@/contracts';
import { parseEther, formatEther } from 'viem';

interface PendingTx {
  id: string;
  action: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
  hash?: string;
}

export function AdminObservatory() {
  const { address } = useAccount();
  const [pendingTransactions, setPendingTransactions] = useState<PendingTx[]>([]);
  const [newThreshold, setNewThreshold] = useState('5');
  const [newRetailCap, setNewRetailCap] = useState('1.0');
  const [newOracle, setNewOracle] = useState('');
  const [poolPausedValue, setPoolPausedValue] = useState(false);

  // Read hook state
  const { data: hookOwner } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'owner',
  });

  const { data: threshold } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'volatilityThreshold',
  });

  const { data: retailCap } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'retailSwapCap',
  });

  const { data: oracleAddress } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'oracle',
  });

  const { data: poolPaused } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'poolPaused',
  });

  const { data: tier1Fee } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getBaseFeeForTier',
    args: [1],
  });

  const { data: tier2Fee } = useReadContract({
    address: HOOK_ADDRESS as `0x${string}`,
    abi: HOOK_ABI,
    functionName: 'getBaseFeeForTier',
    args: [2],
  });

  // Write contracts
  const { writeContract: setThreshold } = useWriteContract();
  const { writeContract: setRetailCapFn } = useWriteContract();
  const { writeContract: setPoolPausedFn } = useWriteContract();

  // Check if user is owner
  const isOwner = address && hookOwner && typeof hookOwner === 'string' && address.toLowerCase() === hookOwner.toLowerCase();

  // Format values
  const thresholdNum = threshold ? Number(threshold) : 0;
  const capNum = retailCap ? Number(retailCap) / 1e18 : 0;
  const tier1FeeNum = tier1Fee ? Number(tier1Fee) : 0;
  const tier2FeeNum = tier2Fee ? Number(tier2Fee) : 0;
  const poolPausedBool = poolPaused ? Boolean(poolPaused) : false;
  const ownerText = hookOwner ? `${String(hookOwner).slice(0, 6)}...${String(hookOwner).slice(-4)}` : 'Loading...';
  const oracleText = oracleAddress ? `${String(oracleAddress).slice(0, 6)}...${String(oracleAddress).slice(-4)}` : 'Loading...';

  // Handle threshold change
  const handleSetThreshold = async () => {
    try {
      const newVal = BigInt(Math.floor(parseFloat(newThreshold)));
      setThreshold({
        address: HOOK_ADDRESS as `0x${string}`,
        abi: HOOK_ABI,
        functionName: 'setVolatilityThreshold',
        args: [newVal],
      });
      addTransaction('setVolatilityThreshold', newThreshold);
    } catch (err: any) {
      addTransaction('setVolatilityThreshold', newThreshold, 'error');
    }
  };

  // Handle retail cap change
  const handleSetRetailCap = async () => {
    try {
      const newVal = parseEther(newRetailCap);
      setRetailCapFn({
        address: HOOK_ADDRESS as `0x${string}`,
        abi: HOOK_ABI,
        functionName: 'setRetailSwapCap',
        args: [newVal],
      });
      addTransaction('setRetailSwapCap', newRetailCap);
    } catch (err: any) {
      addTransaction('setRetailSwapCap', newRetailCap, 'error');
    }
  };

  // Handle pool paused toggle
  const handleSetPoolPaused = async () => {
    try {
      const newVal = !poolPausedBool;
      setPoolPausedFn({
        address: HOOK_ADDRESS as `0x${string}`,
        abi: HOOK_ABI,
        functionName: 'setPoolPaused',
        args: [newVal],
      });
      addTransaction('setPoolPaused', newVal ? 'Paused' : 'Resumed');
    } catch (err: any) {
      addTransaction('setPoolPaused', !poolPausedBool ? 'Paused' : 'Resumed', 'error');
    }
  };

  // Add to transaction log
  const addTransaction = (action: string, value: string, status: 'pending' | 'error' = 'pending') => {
    const tx: PendingTx = {
      id: Date.now().toString(),
      action,
      value,
      timestamp: Date.now(),
      status,
    };
    setPendingTransactions([tx, ...pendingTransactions]);
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3">Admin Observatory</h2>
        <p className="text-gray-600">
          {isOwner === true
            ? '🔐 You are the hook owner. Adjust parameters to manage fees, caps, and compliance rules.'
            : '👁️ View-only mode. You are not the hook owner.'}
        </p>
      </div>

      {/* Owner Status Card */}
      <div className={`border-2 rounded-lg p-6 ${isOwner ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">👤 Hook Owner</h3>
          {isOwner === true && <span className="bg-green-600 text-white px-3 py-1 rounded font-bold text-sm">✅ You</span>}
        </div>
        <p className="font-mono text-lg mb-3">{ownerText}</p>
        {isOwner === true && (
          <div className="bg-green-100 border border-green-400 p-3 rounded text-sm">
            <p className="text-green-900 font-semibold">✅ You have permission to modify hook parameters</p>
          </div>
        )}
      </div>

      {/* Current State Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Volatility Threshold */}
        <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
          <h4 className="font-bold text-sm text-gray-600 mb-3">📊 VOLATILITY THRESHOLD</h4>
          <p className="text-4xl font-black text-gray-900 mb-2">{thresholdNum}%</p>
          <p className="text-xs text-gray-600">
            When oracle volatility exceeds {thresholdNum}%, dynamic fees kick in.
          </p>
          {isOwner === true && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <label className="text-xs font-semibold text-gray-700 block mb-2">Set New Threshold (%)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={handleSetThreshold}
                  className="px-3 py-1 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 transition"
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Retail Swap Cap */}
        <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
          <h4 className="font-bold text-sm text-gray-600 mb-3">💰 RETAIL SWAP CAP</h4>
          <p className="text-4xl font-black text-gray-900 mb-2">{capNum}</p>
          <p className="text-xs text-gray-600">
            Maximum tokens per swap for Tier 1 (Retail) users.
          </p>
          {isOwner === true && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <label className="text-xs font-semibold text-gray-700 block mb-2">Set New Cap (tokens)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newRetailCap}
                  onChange={(e) => setNewRetailCap(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={handleSetRetailCap}
                  className="px-3 py-1 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 transition"
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Oracle Address */}
        <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
          <h4 className="font-bold text-sm text-gray-600 mb-3">🔮 ORACLE ADDRESS</h4>
          <p className="font-mono text-sm text-gray-900 break-all mb-3">{oracleText}</p>
          <p className="text-xs text-gray-600">
            Provides real-time market volatility data for dynamic fee calculations.
          </p>
        </div>

        {/* Tier 1 Base Fee */}
        <div className="border-2 border-blue-300 rounded-lg p-6 bg-blue-50">
          <h4 className="font-bold text-sm text-blue-700 mb-3">💙 TIER 1 BASE FEE</h4>
          <p className="text-4xl font-black text-blue-900 mb-2">{tier1FeeNum} bps</p>
          <p className="text-xs text-blue-700">
            Retail traders start at {tier1FeeNum} basis points, increasing with volatility.
          </p>
        </div>

        {/* Tier 2 Base Fee */}
        <div className="border-2 border-purple-300 rounded-lg p-6 bg-purple-50">
          <h4 className="font-bold text-sm text-purple-700 mb-3">💜 TIER 2 BASE FEE</h4>
          <p className="text-4xl font-black text-purple-900 mb-2">{tier2FeeNum} bps</p>
          <p className="text-xs text-purple-700">
            Institutional traders get preferential rates at {tier2FeeNum} basis points.
          </p>
        </div>

        {/* Pool Status */}
        <div className={`border-2 rounded-lg p-6 ${poolPausedBool ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
          <h4 className="font-bold text-sm mb-3">{poolPausedBool ? '⏸️ POOL PAUSED' : '✅ POOL ACTIVE'}</h4>
          <p className={`text-lg font-bold mb-3 ${poolPausedBool ? 'text-red-700' : 'text-green-700'}`}>
            {poolPausedBool ? 'No swaps/LP changes allowed' : 'Accepting swaps and liquidity changes'}
          </p>
          {isOwner === true && (
            <button
              onClick={handleSetPoolPaused}
              className={`w-full px-3 py-2 rounded font-bold text-sm transition ${
                poolPausedBool
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {poolPausedBool ? 'Resume Pool' : 'Pause Pool'}
            </button>
          )}
        </div>
      </div>

      {/* Security Highlights Section */}
      <div className="bg-black text-white border-2 border-black rounded-lg p-8">
        <h3 className="text-2xl font-black mb-6">🔐 Security Architecture</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* onlyOwner Modifier */}
          <div className="border-2 border-white p-6">
            <h4 className="font-bold mb-3 text-yellow-300">✓ onlyOwner Modifier</h4>
            <div className="font-mono text-xs bg-gray-900 p-3 rounded mb-3 overflow-x-auto">
              <p className="text-gray-400">contract RWAComplyHook &#123;</p>
              <p className="text-gray-400 ml-2">modifier onlyOwner() &#123;</p>
              <p className="text-green-400 ml-4">require(msg.sender == owner);</p>
              <p className="text-gray-400 ml-4">_;</p>
              <p className="text-gray-400 ml-2">&#125;</p>
              <p className="text-gray-400 ml-2">function setThreshold(...)</p>
              <p className="text-yellow-300 ml-4">onlyOwner &#123;</p>
              <p className="text-gray-400 ml-4">// protected code</p>
              <p className="text-gray-400 ml-2">&#125;</p>
              <p className="text-gray-400">&#125;</p>
            </div>
            <p className="text-sm text-gray-300">
              Only the owner address can modify hook parameters. Reverts immediately if called by non-owner.
            </p>
          </div>

          {/* Zero-Address Validation */}
          <div className="border-2 border-white p-6">
            <h4 className="font-bold mb-3 text-yellow-300">✓ Zero-Address Check</h4>
            <div className="font-mono text-xs bg-gray-900 p-3 rounded mb-3 overflow-x-auto">
              <p className="text-gray-400">function setOracle(address newOracle)</p>
              <p className="text-gray-400 ml-2">external onlyOwner &#123;</p>
              <p className="text-red-400 ml-4">if (newOracle == address(0))</p>
              <p className="text-red-400 ml-6">revert ZeroAddress();</p>
              <p className="text-gray-400 ml-4">// prevent setting oracle to 0x0</p>
              <p className="text-gray-400 ml-2">oracle = newOracle;</p>
              <p className="text-gray-400 ml-2">emit OracleUpdated(...);</p>
              <p className="text-gray-400 ml-2">&#125;</p>
            </div>
            <p className="text-sm text-gray-300">
              Critical state changes validate inputs. Setting oracle to 0x0 would break the entire system.
            </p>
          </div>

          {/* Ownable Pattern */}
          <div className="border-2 border-white p-6">
            <h4 className="font-bold mb-3 text-yellow-300">✓ Ownable Pattern (OpenZeppelin)</h4>
            <div className="font-mono text-xs bg-gray-900 p-3 rounded mb-3 overflow-x-auto">
              <p className="text-gray-400">import &#123; Ownable &#125;</p>
              <p className="text-gray-400">from &quot;@openzeppelin/contracts/access/Ownable.sol&quot;;</p>
              <p className="text-gray-400 mt-2">contract RWAComplyHook is IHooks,</p>
              <p className="text-blue-400">Ownable &#123;</p>
              <p className="text-gray-400 ml-2">// constructor accepts owner_</p>
              <p className="text-gray-400 ml-2">Ownable(owner_) &#123;&#125;</p>
              <p className="text-gray-400">&#125;</p>
            </div>
            <p className="text-sm text-gray-300">
              Uses battle-tested OpenZeppelin implementation. Includes ownership transfer safeguards.
            </p>
          </div>

          {/* Event Logging */}
          <div className="border-2 border-white p-6">
            <h4 className="font-bold mb-3 text-yellow-300">✓ Event Emissions</h4>
            <div className="font-mono text-xs bg-gray-900 p-3 rounded mb-3 overflow-x-auto">
              <p className="text-gray-400">event VolatilityThresholdUpdated(</p>
              <p className="text-gray-400 ml-2">uint256 oldThreshold,</p>
              <p className="text-gray-400 ml-2">uint256 newThreshold</p>
              <p className="text-gray-400">);</p>
              <p className="text-gray-400 mt-2">// All admin actions emit events</p>
              <p className="text-gray-400">// for compliance audit trail</p>
            </div>
            <p className="text-sm text-gray-300">
              All parameter changes emit events for immutable, on-chain audit trails. Regulators can verify compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Log */}
      <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
        <h3 className="font-bold text-lg mb-4">📝 Admin Action Log</h3>

        {pendingTransactions && pendingTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No admin actions yet.</p>
            {isOwner === true && <p className="text-xs mt-2">Use controls above to modify hook parameters.</p>}
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {pendingTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`border-l-4 pl-4 py-2 ${
                  tx.status === 'success'
                    ? 'border-green-500 bg-green-50'
                    : tx.status === 'error'
                      ? 'border-red-500 bg-red-50'
                      : 'border-yellow-500 bg-yellow-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{tx.action}</p>
                    <p className="text-xs text-gray-600 mt-1">New value: {tx.value}</p>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      tx.status === 'success'
                        ? 'text-green-700'
                        : tx.status === 'error'
                          ? 'text-red-700'
                          : 'text-yellow-700'
                    }`}
                  >
                    {tx.status === 'success' ? '✅ Success' : tx.status === 'error' ? '❌ Error' : '⏳ Pending'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(tx.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fee Impact Visualization */}
      <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-6">
        <h3 className="font-bold mb-4 text-blue-900">📊 How Changes Ripple Through the System</h3>

        <div className="space-y-4">
          <div className="bg-white p-4 rounded border border-blue-300">
            <p className="text-sm font-semibold text-gray-900 mb-2">🔄 Volatility Threshold → Fee Curves</p>
            <p className="text-sm text-gray-700">
              When you adjust the volatility threshold on this page, Page 3's Dynamic Fee Visualizer graph automatically updates. The threshold line moves, and fee multipliers recalculate based on the new trigger point.
            </p>
          </div>

          <div className="bg-white p-4 rounded border border-blue-300">
            <p className="text-sm font-semibold text-gray-900 mb-2">📈 Retail Cap → Swap Demo Limits</p>
            <p className="text-sm text-gray-700">
              Changing the retail swap cap here immediately impacts Page 4's Swap Demo. Tier 1 users see updated cap validation and error messages if they try to exceed it.
            </p>
          </div>

          <div className="bg-white p-4 rounded border border-blue-300">
            <p className="text-sm font-semibold text-gray-900 mb-2">⏸️ Pool Pause → All Operations</p>
            <p className="text-sm text-gray-700">
              Pausing the pool blocks all swaps and liquidity operations. Useful during security incidents or maintenance windows.
            </p>
          </div>

          <div className="bg-white p-4 rounded border border-blue-300">
            <p className="text-sm font-semibold text-gray-900 mb-2">🔮 Oracle Update → Real-Time Repricing</p>
            <p className="text-sm text-gray-700">
              If you own both the hook and oracle, use this to manually adjust volatility. All fees recalculate immediately, ensuring market-responsive pricing.
            </p>
          </div>
        </div>
      </div>

      {/* Educational Callout */}
      <div className="bg-green-100 border-2 border-green-400 rounded-lg p-6">
        <p className="font-bold mb-2 text-green-900">💡 Why This Matters for Uniswap</p>
        <p className="text-sm text-green-900 mb-3">
          Admin controls are <strong>not backdoors</strong> — they're <strong>governance mechanisms</strong>:
        </p>
        <ul className="text-sm text-green-900 space-y-2 ml-4 list-disc">
          <li>
            <strong>Offchain Governance:</strong> DAO can vote to change parameters, then admin executes via these functions
          </li>
          <li>
            <strong>Circuit Breakers:</strong> Owner can pause pool during oracle failures or market manipulation attempts
          </li>
          <li>
            <strong>Audit Trail:</strong> Every change emits an event, creating immutable on-chain compliance records for regulators
          </li>
          <li>
            <strong>RWA Integration:</strong> Fees dynamically adjust based on real volatility, keeping institutional traders competitive
          </li>
        </ul>
        <p className="text-sm text-green-900 mt-3">
          This demonstrates that Uniswap v4 hooks can embed <span className="font-bold">managed governance</span> within decentralized protocols.
        </p>
      </div>
    </div>
  );
}
