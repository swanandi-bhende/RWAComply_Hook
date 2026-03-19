# 🚀 Quick Start Guide - RWA Compliance Hook UI

## What You Just Got

A production-ready, Uniswap-inspired Next.js dashboard for the UHI8 Hookathon Uniswap v4 Compliance Hook.

## Architecture Overview

```
┌─────────────────────────────────┐
│  User Browser (Next.js UI)      │
│  ├─ Swap Interface              │
│  ├─ Add Liquidity               │
│  ├─ Admin Controls              │
│  └─ Transaction History         │
└────────────┬────────────────────┘
             │
             │ (Wagmi + RainbowKit)
             │
┌────────────▼────────────────────┐
│  RainbowKit Wallet Connect      │
│  (MetaMask, WalletConnect, etc) │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│  Anvil Local Network (http://localhost:8545)   │
│  Chain ID: 31337                               │
│                                                 │
│  ├─ RWAComplyHook (compliance logic)           │
│  ├─ PoolManager (Uniswap v4 core)             │
│  ├─ MockRWAOracle (volatility data)           │
│  └─ MockERC20 (token contracts)               │
└──────────────────────────────────────────────────┘
```

## Components

### 📊 Overview Tab
- Compliance tier display (Unverified/Tier 1/Tier 2)
- Real-time volatility and market conditions
- Quick stats (TVL, volume, users, avg fee)

### ⇄ Swap Tab
- Uniswap-style swap interface
- Token pair selection with balance display
- Dynamic fee visualization based on volatility
- Tier-based trading capabilities

### ➕ Liquidity Tab
- Add/remove liquidity forms
- Dynamic fee tier information
- Position management interface

### ⚙️ Admin Tab (Owner Only)
- Update volatility threshold
- Modify retail swap cap
- Pause/unpause pool controls

### 📝 History Tab
- Transaction history with status tracking
- Transaction hashes and timestamps
- Filter by transaction type

## Running the UI

### Prerequisites
1. Anvil running on http://localhost:8545
2. Contracts deployed (use: `bash script/run_canonical_demo.sh` from main project)
3. Node.js 18+

### Start the Dev Server

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm run start
```

## Key Features

✨ **Modern Design**
- Uniswap-inspired UI with Tailwind CSS
- Responsive grid layouts
- Smooth transitions and hover effects

🔐 **Web3 Integration**
- Real-time contract reads with Wagmi
- RainbowKit wallet connection
- Automatic balance updates

📱 **Mobile Ready**
- Fully responsive design
- Touch-friendly buttons
- Optimized for all screen sizes

⚡ **Performance**
- React Query caching
- Turbopack for fast builds
- Optimized bundle size

## Contract Addresses

Update these in `contracts.ts` if your deployment differs:

```typescript
HOOK_ADDRESS = "0xf4C4Ac3Ec1d5FBa46879Db82764d8fA1eC14B8c0"
POOL_MANAGER_ADDRESS = "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf"
ORACLE_ADDRESS = "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF"
TOKEN_A_ADDRESS = "0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00"
TOKEN_B_ADDRESS = "0x36C02dA8a0983159322a80FFE9F24b1acfF8B570"
```

## Common Issues

**Can't connect wallet**
- Ensure MetaMask is set to Anvil (localhost:8545, Chain ID: 31337)
- Check wallet shows "Anvil" network

**Contract calls failing**
- Verify Anvil is running: `ps aux | grep anvil`
- Check contract addresses match deployment output
- Contracts must be deployed before UI can read from them

**Styles not loading**
- Clear browser cache: Ctrl+Shift+Delete
- Restart dev server: `npm run dev`

**Turbopack errors**
- Clear .next folder: `rm -rf .next`
- Reinstall dependencies: `npm install`

## File Structure

```
frontend/
├── app/
│   ├── page.tsx           # Main dashboard
│   ├── layout.tsx         # Root layout with providers
│   ├── providers.tsx      # Web3 setup
│   └── globals.css        # Tailwind imports
├── components/            # React components
│   ├── Header.tsx
│   ├── ComplianceStatus.tsx
│   ├── OracleStatus.tsx
│   ├── SwapInterface.tsx
│   ├── AddLiquidity.tsx
│   ├── AdminDashboard.tsx
│   └── TransactionHistory.tsx
├── contracts.ts           # ABIs and addresses
├── package.json
└── tsconfig.json
```

## Next Steps

1. ✅ Start UI: `npm run dev`
2. ✅ Connect wallet via RainbowKit button
3. ✅ View compliance tier and market data on Overview
4. ✅ Test Swap interface (if admin, test Admin controls)
5. ✅ Review transaction history

## Advanced: Custom Chains

To add a different chain to the UI, update `app/providers.tsx`:

```typescript
import { myChain } from 'viem/chains';

const config = createConfig({
  chains: [myChain],
  transports: {
    [myChain.id]: http('your-rpc-url'),
  },
});
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 in use | `npx kill-port 3000` or change port in next.config.ts |
| Wagmi errors | Update wagmi: `npm install wagmi@latest viem@latest` |
| RainbowKit not showing | Clear cache, check imports in providers.tsx |
| Stale balances | Wait 5 seconds or hard refresh (Cmd+Shift+R) |

## Performance Tips

- Use mobile Chrome DevTools to simulate mobile devices
- Lighthouse audits available in Chrome DevTools
- Next.js bundle analysis: `npm run build -- --analyze`

## Demo Workflow

Perfect for live demonstrations:

1. **Show Compliance Status** 
   - Connect to see Tier verification
   - Highlight the visual tier indicators

2. **Demonstrate Market Conditions**
   - Show volatility and fee triggers
   - Explain how fees adjust dynamically

3. **Execute Swap**
   - Swap Token A ↔ Token B
   - Show fee calculation based on tier

4. **Admin Controls** (if owner)
   - Update volatility threshold
   - Show how it affects trading immediately

5. **View History**
   - Show transaction tracking
   - Display all details and status

---

**Built for UHI8 Hookathon** 🎉
**Tech**: Next.js 14 • React • Tailwind CSS • Wagmi • RainbowKit
