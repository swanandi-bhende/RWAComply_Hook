# RWAComply Hook (Uniswap v4)

RWAComply is a Uniswap v4 hook prototype for compliance-aware pools.

It includes:
- tier-based access control (tier 0 blocked, tier 1 retail, tier 2 institutional)
- retail swap caps
- oracle-driven dynamic fee selection
- owner-only oracle volatility updates
- owner-managed hook config updates (oracle address, volatility threshold, retail cap)
- PoolManager-level integration tests

## Repository Structure

- src
  - RWAComplyHook.sol
  - MockRWAOracle.sol
  - MockERC20.sol
  - PoolExecutor.sol
- script
  - DeployCore.s.sol
  - DeployHook.s.sol
  - DeployFull.s.sol (canonical local demo flow)
  - PoolSetup.s.sol (deprecated)
  - run_canonical_demo.sh
  - generateDemoRunLog.js
- test
  - Counter.t.sol
  - RWAComply.t.sol
  - RWAComplyIntegration.t.sol
- **frontend/** (NEW - Next.js 14 Contract Showcase UI)
  - **Contract-first design**: Every display is a real contract read
  - **Narrative flow**: Hero → Compliance Status → Fee Visualization → Swap Demo → Admin
  - **Educational**: shows `beforeSwap()`, `beforeAddLiquidity()` code alongside UI
  - **Deployment-aware**: Validates and reads addresses from broadcast data, fails fast if stale
  - See [SETUP_GUIDE.md](frontend/SETUP_GUIDE.md) for setup details

## Prerequisites

- Foundry installed (`forge`, `anvil`)
- Local Anvil node for deployment runs
- Node.js (for `script/generateDemoRunLog.js`)
- Dependencies present in `lib/`

## Setup

1. Copy env template.

```bash
cp .env.example .env
```

2. Edit `.env` and set at minimum:

```dotenv
PRIVATE_KEY=0x...
```

Notes:
- Canonical flow auto-deploys PoolManager, oracle, hook, tokens, initializes pool, adds liquidity, and executes swap.
- In deployment scripts, the deployer EOA is owner of `MockRWAOracle` and `RWAComplyHook`.
- `POOL_MANAGER`, `HOOK_ADDRESS`, `TOKEN_A`, and `TOKEN_B` are only needed for legacy split-flow scripts.

## Local End-to-End Run (Fresh Anvil)

This run proves: deploy -> initialize -> add liquidity -> swap in a single canonical run.

1. Start Anvil.

```bash
anvil
```

2. Run canonical one-command flow.

```bash
bash script/run_canonical_demo.sh
```

This wrapper runs:

```bash
forge script script/DeployFull.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
node script/generateDemoRunLog.js
```

3. Check reproducibility outputs.

- `docs/demo_run_log.txt` contains deployed addresses and transaction hashes for the latest run.
- `broadcast/DeployFull.s.sol/31337/run-latest.json` contains full raw broadcast details.

Expected script logs include:
- `beforeAddLiquidity called`
- `beforeSwap called`
- `afterSwap called`

## Frontend Dashboard

After deployment, view the hook in action via the Web3 UI:

```bash
# 1. Ensure anvil is running and contracts deployed
bash script/run_canonical_demo.sh

# 2. Setup frontend environment
cd frontend
cp .env.example .env.local
# Edit .env.local with addresses from docs/demo_run_log.txt

# 3. Start dev server
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard displays:
- **Your compliance tier** (from `userTier` mapping)
- **Active fee rates** (from `getBaseFeeForTier()`)
- **Oracle volatility** (from `MockRWAOracle.getVolatility()`)
- **Contract configuration** (threshold, cap, owner, paused status)
- **All reads are live** from the deployed contracts on Anvil

## Legacy Split Flow (Deprecated)

- `script/PoolSetup.s.sol` is deprecated and intentionally reverts.
- `script/DeployCore.s.sol` + `script/DeployHook.s.sol` remain for debugging workflows, but are not the recommended demo path.
- Use `script/DeployFull.s.sol` as the canonical path for local end-to-end demos.

## Admin Controls (Owner Only)

- `MockRWAOracle.setVolatility(uint256)` is restricted to oracle owner.
- `RWAComplyHook.setVolatilityThreshold(uint256)` updates dynamic-fee threshold.
- `RWAComplyHook.setRetailSwapCap(uint256)` updates retail swap cap.
- `RWAComplyHook.setOracle(address)` updates oracle address and rejects zero address.
- Config updates emit dedicated events:
  - `VolatilityThresholdUpdated(oldThreshold, newThreshold)`
  - `RetailSwapCapUpdated(oldCap, newCap)`
  - `OracleUpdated(oldOracle, newOracle)`

## Test Guide

### Run all tests

```bash
forge test
```

### Run specific suites

Hook unit tests:

```bash
forge test --match-path test/RWAComply.t.sol -vv
```

Compliance integration tests via PoolManager swap path:

```bash
forge test --match-path test/RWAComplyIntegration.t.sol -vv
```

Counter sample tests:

```bash
forge test --match-path test/Counter.t.sol -vv
```

### Run focused compliance assertions

Tier 0 revert through PoolManager swap:

```bash
forge test --match-test testTier0SwapRevertsThroughPoolManager -vv
```

Tier 0 add liquidity revert through PoolManager path:

```bash
forge test --match-test testTier0AddLiquidityRevertsThroughPoolManager -vv
```

Tier 1 pass through PoolManager swap:

```bash
forge test --match-test testTier1SwapPassesThroughPoolManager -vv
```

Tier 2 pass through PoolManager swap:

```bash
forge test --match-test testTier2SwapPassesThroughPoolManager -vv
```

Oracle write access restricted to owner:

```bash
forge test --match-test testOnlyOwnerCanSetVolatility -vv
```

Hook config setters restricted to owner:

```bash
forge test --match-test testNonOwnerCannotUpdateHookConfig -vv
```

Hook rejects zero oracle address:

```bash
forge test --match-test testSetOracleZeroAddressReverts -vv
```

Paused pool swap revert through PoolManager path:

```bash
forge test --match-test testPausedSwapRevertsThroughPoolManager -vv
```

Retail cap exceeded revert through PoolManager path:

```bash
forge test --match-test testRetailCapExceededRevertsThroughPoolManager -vv
```

Full flow integration (initialize -> add liquidity -> swap):

```bash
forge test --match-test testFullFlowInitializeAddLiquidityAndSwap -vv
```

Dynamic fee applied for retail user on high volatility (executed PoolManager swap fee):

```bash
forge test --match-test testDynamicFeeAppliedRetailHighVolatility -vv
```

Dynamic fee applied for institutional user on high volatility (executed PoolManager swap fee):

```bash
forge test --match-test testDynamicFeeAppliedInstitutionalHighVolatility -vv
```

Default fee applied under low volatility:

```bash
forge test --match-test testDynamicFeeAppliedDefaultLowVolatility -vv
```

Static-fee pool ignores hook fee override and uses pool fee:

```bash
forge test --match-test testStaticFeePoolIgnoresHookOverride -vv
```

## Demo Script

Run these three commands in order for a concise live demo:

1. Unverified swap is blocked (tier 0):

```bash
forge test --match-test testTier0SwapRevertsThroughPoolManager -vvvv
```

2. Retail swap executes with high-volatility fee:

```bash
forge test --match-test testDynamicFeeAppliedRetailHighVolatility -vv
```

3. Institutional swap executes with high-volatility fee:

```bash
forge test --match-test testDynamicFeeAppliedInstitutionalHighVolatility -vv
```

Expected demo outcomes:
- blocked reason: `AccessDenied()` (wrapped by PoolManager)
- tier used + fee selected for successful swaps from `BeforeSwapCalled`
- executed fee values from PoolManager `Swap` event decoding in integration tests

### Recorded Terminal Output Snippets

Unverified swap blocked (`tier: 0` and `AccessDenied` in trace):

```text
$ forge test --match-test testTier0SwapRevertsThroughPoolManager -vvvv
[PASS] testTier0SwapRevertsThroughPoolManager()
Logs:
  beforeSwap called
  tier: 0
...
└─ ← [Revert] AccessDenied()
└─ ← [Revert] WrappedError(...)
```

Retail high-volatility swap success (`tier: 1`, `fee: 5000`):

```text
$ forge test --match-test testDynamicFeeAppliedRetailHighVolatility -vv
[PASS] testDynamicFeeAppliedRetailHighVolatility()
Logs:
  beforeSwap called
  tier: 1
  fee: 5000
  afterSwap called
```

Institutional high-volatility swap success (`tier: 2`, `fee: 500`):

```text
$ forge test --match-test testDynamicFeeAppliedInstitutionalHighVolatility -vv
[PASS] testDynamicFeeAppliedInstitutionalHighVolatility()
Logs:
  beforeSwap called
  tier: 2
  fee: 500
  afterSwap called
```

### Optional test output modes

Gas report:

```bash
forge test --gas-report
```

Very verbose traces:

```bash
forge test -vvvv
```

## What the Current Tests Prove

- `test/RWAComply.t.sol`
  - direct hook-level checks for fee logic, pause behavior, and unverified access control
  - oracle owner-only write restriction
  - hook owner-only config setter restriction
  - zero-address guard on oracle updates
- `test/RWAComplyIntegration.t.sol`
  - real PoolManager integration path
  - full flow succeeds: initialize -> add liquidity -> swap
  - tier 0 swap reverts
  - tier 0 add liquidity reverts
  - blocked reason surfaced as wrapped `AccessDenied()` in traces
  - paused swap reverts
  - retail cap exceeded reverts
  - tier 1 swap succeeds
  - tier 2 swap succeeds
  - executed dynamic fee is validated from PoolManager Swap events
  - low volatility applies default fee `1000`
  - retail high volatility swap applies fee `5000`
  - institutional high volatility swap applies fee `500`
  - static-fee pool keeps static fee `3000` even when hook computes a different fee

## Frontend Dashboard 🎨

A production-ready, Uniswap-inspired Web3 UI is included in the `frontend/` directory.

### Features

- **Overview Dashboard**: Compliance status, market conditions, quick stats
- **Swap Interface**: Uniswap-style token trading with dynamic fee display
- **Liquidity Management**: Add/remove liquidity forms
- **Admin Controls**: Owner-only parameter updates (volatility threshold, swap cap, pause/unpause)
- **Transaction History**: Real-time activity tracking

### Tech Stack

- Next.js 14 (React, TypeScript)
- Tailwind CSS for responsive design
- Wagmi v2 for contract interaction
- RainbowKit for wallet connection

### Quick Start

```bash
cd frontend
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

**Prerequisites**: Anvil must be running on `http://localhost:8545`. Ensure contracts are deployed first using:

```bash
bash script/run_canonical_demo.sh
```

See [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md) for comprehensive documentation.

## Troubleshooting

- `HookAddressNotValid(...)`:
  - canonical `DeployFull.s.sol` already brute-forces a valid CREATE2 salt for required hook flags
- `CurrencyNotSettled()`:
  - ensure you are using current `PoolExecutor` logic with `sync + settle` and `take`
- stale env values after redeploy (legacy split flow only):
  - if `POOL_MANAGER` changes, rerun `DeployHook.s.sol` and refresh dependent addresses
