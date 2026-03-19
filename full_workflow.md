RWA Compliance Hook (Uniswap v4)
End-to-End Workflow

1. Purpose

This document explains how to run the project locally and how to use the frontend end to end.

The system includes:
- Foundry contracts
- Anvil local chain
- Next.js frontend with wallet and contract integration

2. Prerequisites

Install and verify:
- Foundry (forge, anvil)
- Node.js 18+
- npm

Version checks:
- forge --version
- anvil --version
- node --version

3. Setup

From repository root:
- forge build

From frontend directory:
- npm install

4. Start the System

Use three terminals.

Terminal 1 - Start local chain
- cd /path/to/UHI8_Hookathon
- anvil --chain-id 31337 --accounts 10 --silent

Terminal 2 - Deploy contracts and initialize state
- cd /path/to/UHI8_Hookathon
- bash script/run_canonical_demo.sh

Expected result:
- PoolManager, oracle, hook, tokens, and executor deployed
- Pool initialized
- Liquidity added
- One swap executed
- Deployment summary written to docs/demo_run_log.txt

Terminal 3 - Start frontend
- cd /path/to/UHI8_Hookathon/frontend
- npm run dev

Open:
- http://localhost:3000

5. Frontend Interaction Guide

5.1 Connect wallet
- Click Connect Wallet in the header.
- Connect any injected wallet.
- Ensure network points to localhost:8545 (chain 31337).

5.2 Page 1 - Dashboard
What to check:
- Connected account tier
- Current dynamic fee
- Oracle volatility
- Volatility threshold
- Retail cap
- Hook owner
- Pool paused state

Expected behavior:
- Values are contract reads and refresh automatically.

5.3 Page 2 - Access Control
What to do:
- Select Tier 0, Tier 1, and Tier 2.
- Move volatility slider across range.

Expected behavior:
- Tier 0 shows blocked behavior.
- Tier 1 and Tier 2 show different fee profiles.
- Fee output changes with volatility.

5.4 Page 3 - Fee Curves
What to check:
- Two curves for Tier 1 and Tier 2
- Threshold marker
- Live volatility indicator

What to do:
- Move simulated volatility and compare tier outputs.

Expected behavior:
- Tier 2 curve stays below Tier 1.
- Fee increases with volatility.

5.5 Page 4 - Swap Demo
Purpose:
- Run a real on-chain approve + swap flow.

Steps:
1. Enter a small amount (for example 0.1 or 1.0).
2. Click Execute Swap.
3. Approve allowance transaction in wallet.
4. Confirm swap transaction in wallet.

Expected behavior:
- UI moves through approve -> execute -> success or error.
- Transaction hash appears on success.
- Balances update after confirmation.
- Tier 0 account fails by design.

5.6 Page 5 - Admin
Purpose:
- Update hook parameters using owner account.

Actions:
- Set volatility threshold
- Set retail cap
- Set oracle address
- Set user tier
- Pause or unpause pool
- Set oracle volatility (if account owns oracle)

Expected behavior:
- Non-owner writes revert.
- Successful writes are reflected in state and logs.

6. Recommended End-to-End Validation

Run this sequence:
1. Open Page 1 and confirm live values are populated.
2. Open Page 2 and compare Tier 0, 1, and 2 behavior.
3. Open Page 3 and validate curve response to volatility.
4. Open Page 4 and execute one swap.
5. Return to Page 1 and confirm updated balances/state.
6. Open Page 5 and update one parameter.
7. Return to Page 3 or Page 1 and confirm update is reflected.

7. Troubleshooting

Issue: Frontend cannot load deployment addresses
- Confirm run_canonical_demo.sh completed.
- Check docs/demo_run_log.txt and broadcast output exist.
- Restart frontend.

Issue: Wallet connection fails
- Confirm Anvil is running on localhost:8545.
- Refresh page and reconnect.

Issue: Swap fails immediately
- Confirm account tier. Tier 0 is intentionally blocked.

Issue: Admin write fails
- Confirm connected account is hook owner.

Issue: UI values look stale
- Refresh page.
- Confirm frontend process is still running.

8. Command Reference

Start local chain:
- anvil --chain-id 31337 --accounts 10 --silent

Deploy and initialize:
- bash script/run_canonical_demo.sh

Start frontend:
- cd frontend && npm run dev

Run tests:
- forge test

Read latest deployment summary:
- cat docs/demo_run_log.txt

9. Stop Services

- Stop frontend: Ctrl+C in frontend terminal
- Stop Anvil: Ctrl+C in Anvil terminal

If Anvil is restarted, redeploy contracts before using the frontend again.
