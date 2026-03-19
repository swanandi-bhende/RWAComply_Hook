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
  - DeployFull.s.sol
  - PoolSetup.s.sol
- test
  - Counter.t.sol
  - RWAComply.t.sol
  - RWAComplyIntegration.t.sol

## Prerequisites

- Foundry installed (`forge`, `anvil`)
- Local Anvil node for deployment runs
- Dependencies present in `lib/`

## Setup

1. Copy env template.

```bash
cp .env.example .env
```

2. Edit `.env` and set at minimum:

```dotenv
PRIVATE_KEY=0x...
POOL_MANAGER=0x...
HOOK_ADDRESS=0x...
TOKEN_A=0x...
TOKEN_B=0x...
```

Notes:
- `TOKEN_A` and `TOKEN_B` must be ERC20 token addresses.
- `TOKEN_A` and `TOKEN_B` must not be `POOL_MANAGER` or `HOOK_ADDRESS`.
- Scripts already fail fast on missing/invalid env values.
- In deployment scripts, the deployer EOA is owner of `MockRWAOracle` and `RWAComplyHook`.

## Local End-to-End Run (Fresh Anvil)

This run proves: deploy -> initialize -> add liquidity -> swap.

1. Start Anvil.

```bash
anvil
```

2. Deploy PoolManager.

```bash
forge script script/DeployCore.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

3. Set `POOL_MANAGER` in `.env` from script output.

4. Deploy Hook + Oracle.

```bash
forge script script/DeployHook.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

5. Set `HOOK_ADDRESS` in `.env` from script output.

6. Deploy two mock ERC20 tokens and capture the two deployed addresses.

```bash
source .env
forge create src/MockERC20.sol:MockERC20 --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY" --constructor-args "TokenA" "TKA" 1000000000000000000000000
forge create src/MockERC20.sol:MockERC20 --rpc-url http://127.0.0.1:8545 --private-key "$PRIVATE_KEY" --constructor-args "TokenB" "TKB" 1000000000000000000000000
```

7. Set `TOKEN_A` and `TOKEN_B` in `.env` from the deploy outputs.

8. Run full flow.

```bash
forge script script/DeployFull.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Expected script logs include:
- `beforeAddLiquidity called`
- `beforeSwap called`
- `afterSwap called`

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

## Troubleshooting

- `HookAddressNotValid(...)`:
  - run `DeployHook.s.sol`; it brute-forces a valid CREATE2 salt for required hook flags
- `CurrencyNotSettled()`:
  - ensure you are using current `PoolExecutor` logic with `sync + settle` and `take`
- stale env values after redeploy:
  - if `POOL_MANAGER` changes, redeploy hook and update `HOOK_ADDRESS` before running `DeployFull`
