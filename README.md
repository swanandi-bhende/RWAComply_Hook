# RWAComplyHook (Uniswap v4)

RWAComplyHook is a Uniswap v4 hook for specialized, compliance-aware markets.
It enforces tier-based access, retail caps, volatility-aware dynamic fees, and admin safeguards during swap flow.

## Demo

- Demo video: [UHI8 Hookathon.mp4](UHI8%20Hookathon.mp4)
- Full workflow: [full_workflow.md](full_workflow.md)


## Core Features

- Tier-based compliance access:
  - Tier 0: blocked
  - Tier 1: retail (capped)
  - Tier 2: institutional
- Dynamic fees based on oracle volatility and user tier
- Admin controls:
  - pause and unpause
  - set retail cap
  - set volatility threshold
  - update oracle address
- PoolManager integration tests on the real hook call path

## Repository Layout

- `src/RWAComplyHook.sol` - main hook logic
- `src/MockRWAOracle.sol` - volatility oracle
- `src/PoolExecutor.sol` - swap execution helper
- `src/MockERC20.sol` - demo tokens
- `test/RWAComply.t.sol` - hook unit tests
- `test/RWAComplyIntegration.t.sol` - PoolManager integration tests
- `script/DeployFull.s.sol` - canonical local deployment flow
- `script/run_canonical_demo.sh` - one-command demo run
- `frontend/` - interactive UI and presentation page
- `docs/demo_run_log.txt` - reproducible local run output

## Quick Start (Local)

1. Start local chain:

```bash
anvil
```

2. Deploy and run canonical flow:

```bash
bash script/run_canonical_demo.sh
```

3. Start frontend:

```bash
cd frontend
npm install
npm run dev
```

4. Open:

`http://localhost:3000`

## Run Tests

```bash
forge test
```

## Test Coverage (One Sentence Each)

- `test_Increment`: Verifies that calling `increment()` increases the counter value from 0 to 1.
- `testFuzz_SetNumber(uint256 x)`: Verifies that `setNumber(x)` stores any fuzzed `uint256` value correctly.
- `testRevertIfUnverified`: Verifies that an unverified user is rejected by `beforeSwap`.
- `testRetailFee`: Verifies that a Tier 1 user gets fee `5000` under high volatility.
- `testInstitutionalFee`: Verifies that a Tier 2 user gets fee `500` under high volatility.
- `testPause`: Verifies that swaps revert when the pool is paused.
- `testOnlyOwnerCanSetVolatility`: Verifies that non-owners cannot call `setVolatility` on the oracle.
- `testOwnerCanSetVolatility`: Verifies that the owner can update oracle volatility.
- `testOwnerCanUpdateHookConfig`: Verifies that the owner can update volatility threshold, retail cap, and oracle address.
- `testNonOwnerCannotUpdateHookConfig`: Verifies that non-owners cannot update hook configuration values.
- `testSetOracleZeroAddressReverts`: Verifies that setting oracle to the zero address reverts with `ZeroAddress`.
- `testTier0SwapRevertsThroughPoolManager`: Verifies that Tier 0 swap attempts revert through the PoolManager hook path.
- `testTier0AddLiquidityRevertsThroughPoolManager`: Verifies that Tier 0 add-liquidity attempts revert through the PoolManager hook path.
- `testTier1SwapPassesThroughPoolManager`: Verifies that Tier 1 swaps succeed and emit expected `BeforeSwapCalled` data.
- `testTier2SwapPassesThroughPoolManager`: Verifies that Tier 2 swaps succeed and emit expected `BeforeSwapCalled` data.
- `testFullFlowInitializeAddLiquidityAndSwap`: Verifies full end-to-end flow of initialize, add liquidity, and swap with correct executed fee.
- `testPausedSwapRevertsThroughPoolManager`: Verifies that swaps revert with `PoolPaused` when pool pause is enabled.
- `testRetailCapExceededRevertsThroughPoolManager`: Verifies that retail swaps above cap revert with `RetailLimitExceeded`.
- `testDynamicFeeAppliedDefaultLowVolatility`: Verifies that low volatility applies default executed fee `1000`.
- `testDynamicFeeAppliedRetailHighVolatility`: Verifies that high volatility applies executed fee `5000` for Tier 1 users.
- `testDynamicFeeAppliedInstitutionalHighVolatility`: Verifies that high volatility applies executed fee `500` for Tier 2 users.
- `testStaticFeePoolIgnoresHookOverride`: Verifies that static-fee pools keep static fee `3000` even when hook computes a different fee.

## Additional Docs

- [full_workflow.md](full_workflow.md)

## License

MIT
