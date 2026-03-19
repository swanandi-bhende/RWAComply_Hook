# RWA Compliance Hook - Frontend Setup Guide

## Overview

The frontend is a **contract-showcase** UI designed to demonstrate the RWA Compliance Hook at its best. Every interaction is **real**: reading from contracts, executing swaps, managing compliance tiers, and showcasing the oracle integration.

## Quick Start

### Prerequisites

1. Anvil running locally
2. Contracts deployed: Run `bash script/run_canonical_demo.sh` from the project root
3. Node.js 18+

### Installation

```bash
cd frontend
npm install
```

### Setup Environment

1. Copy the environment template:
```bash
cp .env.example .env.local
```

2. Add deployment addresses. After running `bash script/run_canonical_demo.sh`, addresses are stored in `docs/demo_run_log.txt` or get them from:
```
broadcast/DeployFull.s.sol/31337/run-latest.json
```

3. Fill in `.env.local`:
```env
NEXT_PUBLIC_POOL_MANAGER=0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d
NEXT_PUBLIC_HOOK_ADDRESS=0x851eE973e4Ba7E6d19fF1DcfF9406CC6CE1ef8C0
NEXT_PUBLIC_ORACLE_ADDRESS=0xdbC43Ba45381e02825b14322cDdd15eC4B3164E6
NEXT_PUBLIC_TOKEN_A_ADDRESS=0x21dF544947ba3E8b3c32561399E88B52Dc8b2823
NEXT_PUBLIC_TOKEN_B_ADDRESS=0x2E2Ed0Cfd3AD2f1d34481277b3204d807Ca2F8c2
NEXT_PUBLIC_EXECUTOR_ADDRESS=0xDC11f7E700A4c898AE5CAddB1082cFfa76512aDD
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

The frontend is a **single-page narrative flow** that showcases the hook's core features:

### Page 1: Hero/Compliance Dashboard (Current)
- **Hero Section**: Immediate differentiator with 3-card visual summary
- **Live Compliance Status**: Your wallet's tier, fees, volatility, and swap caps (all read from contracts)
- **Quick Stats**: Contract configuration (thresholds, ownership, pool status)
- **How It Works**: 4-step visual explanation of the hook flow
- **Technical Specs**: Hook permissions and key features

### Pages 2-5 (Next Priorities)
- **Page 2**: Interactive Tier Tester (explore tier scenarios)
- **Page 3**: Dynamic Fee Visualizer (volatility → fee curves)
- **Page 4**: Live Swap Demo (real on-chain interaction)
- **Page 5**: Admin Observatory (owner controls)

## Components

### Core Display Components
- `HeroSection.tsx` - Title, subtitle, 3-card summary
- `LiveComplianceStatus.tsx` - Real-time wallet compliance data (reads from hook)
- `QuickStats.tsx` - Contract configuration snapshot

### Configuration
- `config/deployments.ts` - Loads and validates deployment addresses
- `contracts.ts` - ABI definitions and legacy address fallbacks

## Key Design Principles

✅ **No Fake Data**: All displays are contract reads
✅ **Real Interactions**: All future swaps/txs will be real on-chain calls
✅ **Educational**: Shows contract code snippets alongside UI
✅ **Fail Fast**: Missing/stale deploymentaddresses show clear error messages
✅ **Contract-Centric**: UI primarily demonstrates hook capabilities, not DEX features

## Development

### Build for Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

## Troubleshooting

### "Deployment Error" Message
**Issue**: Environment variables not set or deployment addresses stale

**Solution**:
1. Run contracts: `bash script/run_canonical_demo.sh`
2. Copy addresses from `docs/demo_run_log.txt`
3. Update `.env.local`
4. Restart dev server

### "Module not found"
**Issue**: TypeScript path aliases not resolved

**Solution**: Run `npm install` and restart dev server

### Cannot read from contracts
**Issue**: Anvil not running or RPC URL incorrect

**Solution**:
1. Ensure Anvil is running: `anvil`
2. Check `NEXT_PUBLIC_RPC_URL` in `.env.local`
3. Verify MetaMask is connected to correct network (31337)

## Adding New Pages

Each page is a standalone narrative:

1. Create component in `components/YourPage.tsx`
2. Import in `home-client.tsx`
3. Add section to main content flow

Example structure:
```tsx
// Component: components/TierTester.tsx
export function TierTester() {
  const { data: userTier } = useReadContract(...);
  // Interactive tier scenario UI
}
```

## Admin Access

The admin controls (Page 5) are only visible when you connect with the **hook owner address**.

### Default Anvil Owner
- Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb476c6b8d6c1f02f1d67e02daeda`

To access admin controls:
1. Import the above private key into MetaMask
2. Connect MetaMask to the Anvil network (http://127.0.0.1:8545, Chain ID: 31337)
3. Navigate to Page 5 (Admin) tab — should show owner controls

## API Routes

Currently, the frontend uses environment variables for deployment addresses. Future enhancements:

- `/api/deployment-addresses` - Reads from broadcast JSON (optional)
- `/api/hook-stats` - Real-time hook metrics (optional)
- `/api/oracle-data` - Cached oracle volatility (optional)

---

**Built for**: Uniswap v4 Hookathon 2026
