# RWA Compliance Hook UI - Next.js Frontend

Modern, Uniswap-inspired Web3 interface for the Uniswap v4 RWA Compliance Hook.

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Anvil running locally: `anvil`
- Backend tests passing: `forge test`
- Contracts deployed: `bash script/run_canonical_demo.sh`

### Installation & Run

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔑 Admin Access

**Admin credentials are based on the contract owner address.**

### Default Admin Account (Anvil)
When using Anvil with default settings, the first account is the contract owner:

**Address**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`  
**Private Key**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb476c6b8d6c1f02f1d67e02daeda`

### How to Access Admin Controls

1. **Install MetaMask** (if not already installed)
2. **Add Anvil Network to MetaMask**:
   - Open MetaMask → Click network dropdown (top-left)
   - Click "Add Network" → "Add a network manually"
   - Fill in:
     - Network Name: `Anvil`
     - RPC URL: `http://127.0.0.1:8545`
     - Chain ID: `31337`
     - Currency Symbol: `ETH`
   - Click Save

3. **Import Admin Account**:
   - Click MetaMask profile icon (top-right)
   - Select "Import Account"
   - Paste the private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb476c6b8d6c1f02f1d67e02daeda`
   - Click Import

4. **Connect to Dashboard**:
   - Ensure MetaMask is on Anvil network
   - Visit http://localhost:3000
   - Click "Connect Wallet" (top-right)
   - Select MetaMask
   - Approve connection
   - Select the admin account

5. **Navigate to Admin Tab**:
   - You should now see the Admin tab (⚙️) in navigation
   - Click it to access owner control panel

---

## 📊 Features & Testing Guide

### Tab-by-Tab Demo Values

#### 1️⃣ **Overview Tab** (📊)
**Purpose**: See compliance status and oracle data at a glance

**What you'll see**:
- Your verification tier (Unverified/Tier 1/Tier 2)
- Current market volatility from oracle
- Fee trigger level
- Retail (Tier 0) swap cap
- Live balance of both tokens

**Demo**: Just refresh and observe - all data loads from contracts automatically.

---

#### 2️⃣ **Swap Tab** (⇄)
**Purpose**: Test token swapping with dynamic fee verification

**Demo Values to Input**:
- **Swap Amount**: `10` (10 tokens)
  - Click "MAX" to use your full balance
  - The input should show your Token A balance
  
- **Expected Behavior**:
  - Swap Info shows current volatility, fee trigger level, and tier 0 cap
  - Your tier displays (Tier 0/1 vs Tier 2)
  - Dynamic fee indicator shows "Based on volatility"
  - Button changes to "Swap Now" when amount entered

**When button is wired** (future):
- Will execute swap on hook contract
- Dynamic fee applied based on current volatility
- Token amounts updated in real-time

**Current Status**: ✅ All reads working (balances, tier, oracle data)  
**Not Implemented Yet**: ⏳ Swap transaction execution

---

#### 3️⃣ **Liquidity Tab** (+)
**Purpose**: Add/remove liquidity from the pool

**Demo Values to Input**:
- **Token A Amount**: `50` tokens
- **Token B Amount**: `50` tokens
- **Fee Tier**: Select from dropdown (0.01%, 0.05%, 0.30%, 1.00%)

**Expected Behavior**:
- Shows your LP token balance
- Estimated tokens received in return
- Slippage tolerance (set to 0.5% - 1%)
- Pool composition overview

**When button is wired** (future):
- Will approve tokens → execute addLiquidity call
- LP tokens minted to your address
- Position tracked in History tab

**Current Status**: ✅ UI displayed with form validation  
**Not Implemented Yet**: ⏳ Approve & addLiquidity transactions

---

#### 4️⃣ **Admin Tab** (⚙️) — **Owner Only**
**Purpose**: Manage hook parameters (requires admin account)

**Demo Values to Change**:

**A) Update Volatility Threshold**
- **New Value**: `10` (means 10% volatility triggers dynamic fees)
- Click "Update Threshold"
- Expected: Success notification, threshold updated in pool

**B) Update Retail Swap Cap**
- **New Value**: `100` (max 100 tokens per unverified user)
- Click "Update Retail Cap"
- Expected: Success notification, cap enforced immediately

**Admin-Only Actions** (all displayed on this tab):
- Pause/unpause trading
- Update fee tiers
- Manage verified users (add/remove from tier)

**Current Status**: ✅ UI & owner checks working  
**Not Implemented Yet**: ⏳ Transaction submission to contract

**Access Check**: If not admin, you'll see a red warning: "Admin access required - Only the hook owner can modify these settings"

---

#### 5️⃣ **History Tab** (📝)
**Purpose**: View recent transactions and activity

**Demo Data Shown**:
- Mock transaction history with sample swaps and LP actions
- Status indicators (Pending, Completed, Failed)
- Timestamps and amounts
- Links to view on etherscan (when wired to real Anvil explorer)

**Current Status**: Displays mock data for UI testing  
**Not Implemented Yet**: ⏳ Real on-chain event logs

---

## 🎬 Full Testing Workflow

### Scenario: Non-Admin User (Regular Testing)
1. **Create new MetaMask account** (or use a non-admin Anvil account)
2. Go to Overview → See "Tier 0/1" (unverified)
3. Go to Swap → Input `5` tokens → Click MAX → See balance
4. Try Admin Tab → See "Admin access required" warning ✅
5. Go to Liquidity → Input `25` + `25` tokens
6. Go to History → See mock transaction sample

### Scenario: Admin User (Hook Owner)
1. Import admin account (see Admin Access section above)
2. Go to Admin Tab → See "Admin Control Panel" unlocked
3. **Update Volatility**: Enter `7.5` → Click button
4. **Update Retail Cap**: Enter `150` → Click button
5. Go to Overview → Verify new values show
6. Go to Swap → See updated fee trigger level

---

## 🏗️ Architecture

### Components Structure
```
app/
├── page.tsx              # Server entry (force-dynamic to avoid SSR)
├── home-client.tsx       # Main dashboard with tabs
├── no-ssr-home.tsx       # Client-only wrapper (prevents SSR issues)
├── layout.tsx            # Root layout
├── providers.tsx         # Wagmi & RainbowKit config
└── globals.css           # Tailwind stylesheet

components/
├── Header.tsx            # Connection & navigation
├── ComplianceStatus.tsx  # Tier verification widget
├── OracleStatus.tsx      # Volatility + fees + cap cards
├── SwapInterface.tsx     # Swap panel
├── AddLiquidity.tsx      # LP form
├── AdminDashboard.tsx    # Owner controls
└── TransactionHistory.tsx # Activity log
```

### Contract Integration
- **Network**: Anvil (Chain ID 31337)
- **RPC**: `http://127.0.0.1:8545`
- **Web3 Library**: Wagmi 2.x + Viem
- **Wallet**: RainbowKit (MetaMask, WalletConnect, etc.)

### Current Contract Addresses
```
HOOK_ADDRESS: 0xc76AB729c5e92964F4ea91870cE751A64434f8c0
POOL_MANAGER_ADDRESS: 0x82e01223d51Eb87e16A03E24687EDF0F294da6f1
ORACLE_ADDRESS: 0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3
TOKEN_A_ADDRESS: 0xc351628EB244ec633d5f21fBD6621e1a683B1181
TOKEN_B_ADDRESS: 0xFD471836031dc5108809D173A067e8486B9047A3
```
- MAX button
- Dynamic fee visualization
- Real-time tier info

### AdminDashboard
Owner-only controls for:
- Updating volatility threshold
- Changing retail swap cap
- Pausing/unpausing pools

### TransactionHistory
Mock transaction display (future: integrate with on-chain events/logs)

## Contract Integration

All contract addresses and ABIs are in `src/contracts.ts`. The UI connects to:

- **RWAComplyHook**: Main hook contract for tier checks and fee logic
- **MockRWAOracle**: Volatility data source
- **MockERC20**: Token balances and approvals

Contract reads use Wagmi's `useContractRead` hook for real-time data.

## Styling

The UI uses Tailwind CSS with a carefully curated palette:

- **Primary**: Blue (500-600) for main actions
- **Secondary**: Purple (600) for accents
- **Status**: Green (success), Yellow (warning), Red (error)
- **Neutral**: Gray scale for text and backgrounds

Inspired by Uniswap's clean, minimal aesthetic with rounded corners and clear visual hierarchy.

## Future Enhancements

- [ ] Actual swap execution with contract calls
- [ ] Liquidity position management
- [ ] Real transaction history from on-chain events
- [ ] Admin function execution
- [ ] Multi-language support
- [ ] Advanced charts (volatility, volume)
- [ ] Tier upgrade flow

## Troubleshooting

**"Cannot connect to network"**
- Ensure Anvil is running on http://127.0.0.1:8545
- Check contract addresses in `src/contracts.ts` match your deployment

**"Contract call failed"**
- Verify wallet is connected to correct chain (Chain ID 31337)
- Check contract ABI matches deployed contract

**"RainbowKit not showing"**
- Clear browser cache
- Verify RainbowKit styles are imported in `app/providers.tsx`

## Contributing

This UI is designed to work seamlessly with the canonical Uniswap v4 compliance hook. For improvements, refer to the main project README.

---

Built for **UHI8 Hookathon** 🚀

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
