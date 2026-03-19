# RWA Compliance Hook UI - Next.js Frontend

Modern, Uniswap-inspired Web3 interface for the Uniswap v4 RWA Compliance Hook.

## Features

✨ **Comprehensive Dashboard**
- **Overview Tab**: Compliance status, market conditions, and quick stats
- **Swap Tab**: Uniswap-style token swap interface with dynamic fee display
- **Liquidity Tab**: Add/remove liquidity with fee tier management
- **Admin Tab**: Owner controls for hook parameters (volatility threshold, retail cap)
- **History Tab**: Transaction history with status tracking

🔐 **Web3 Integration**
- RainbowKit wallet connection (includes MetaMask, WalletConnect, etc.)
- Wagmi for contract interactions
- Real-time balance queries
- Tier verification display

🎨 **Design System**
- Tailwind CSS for responsive, modern UI
- Uniswap-inspired color scheme and layout
- Mobile-first approach
- Accessible components

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: Wagmi, Viem, RainbowKit
- **Data Fetching**: React Query

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- A running Anvil local network (on http://127.0.0.1:8545)

### Installation

```bash
cd frontend
npm install
```

### Environment Configuration

The app is configured to connect to Anvil on `http://127.0.0.1:8545` (Chain ID: 31337). Update contract addresses in `src/contracts.ts` if your deployment differs.

### Running the App

Development mode:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Production build:
```bash
npm run build
npm run start
```

## Project Structure

```
app/
├── page.tsx              # Main dashboard with tab navigation
├── layout.tsx            # Root layout with Web3 providers
├── providers.tsx         # Wagmi & RainbowKit setup
└── globals.css           # Tailwind styles

src/
├── contracts.ts          # Contract ABIs and addresses
└── components/
    ├── Header.tsx        # Top navigation with wallet connect
    ├── ComplianceStatus.tsx  # Tier display & verification
    ├── OracleStatus.tsx   # Volatility, threshold, cap info
    ├── SwapInterface.tsx  # Main swap UI
    ├── AddLiquidity.tsx   # Liquidity provider form
    ├── AdminDashboard.tsx # Owner controls
    └── TransactionHistory.tsx # Activity log
```

## Key Components

### ComplianceStatus
Shows user's verification tier (Unverified/Tier1/Tier2) with visual indicators.

### OracleStatus
Displays current volatility, fee trigger level, and retail swap cap - updates in real-time from smart contracts.

### SwapInterface
Implements Uniswap-style swap UI with:
- Token pair selection
- Balance display
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
