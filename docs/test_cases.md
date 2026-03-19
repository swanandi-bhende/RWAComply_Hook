# Test Cases

This document lists every test in this repository, how to run it, and what it verifies.

## Quick Run Guide

- Run all tests:

```bash
forge test
```

- Run a full test file:

```bash
forge test --match-path test/Counter.t.sol -vv
forge test --match-path test/RWAComply.t.sol -vv
forge test --match-path test/RWAComplyIntegration.t.sol -vv
```

- Run a single test:

```bash
forge test --match-test <TEST_NAME> -vv
```

## test/Counter.t.sol

- `test_Increment`
  - What it does: Confirms `increment()` moves the counter from 0 to 1.
  - Run:

```bash
forge test --match-test test_Increment -vv
```

- `testFuzz_SetNumber(uint256 x)`
  - What it does: Confirms `setNumber(x)` stores any fuzzed `uint256` value correctly.
  - Run:

```bash
forge test --match-test testFuzz_SetNumber -vv
```

## test/RWAComply.t.sol

- `testRevertIfUnverified`
  - What it does: Confirms an unverified user is rejected by `beforeSwap`.
  - Run:

```bash
forge test --match-test testRevertIfUnverified -vv
```

- `testRetailFee`
  - What it does: Confirms Tier 1 users get fee `5000` in high volatility.
  - Run:

```bash
forge test --match-test testRetailFee -vv
```

- `testInstitutionalFee`
  - What it does: Confirms Tier 2 users get fee `500` in high volatility.
  - Run:

```bash
forge test --match-test testInstitutionalFee -vv
```

- `testPause`
  - What it does: Confirms swaps revert when the pool is paused.
  - Run:

```bash
forge test --match-test testPause -vv
```

- `testOnlyOwnerCanSetVolatility`
  - What it does: Confirms non-owners cannot call oracle `setVolatility`.
  - Run:

```bash
forge test --match-test testOnlyOwnerCanSetVolatility -vv
```

- `testOwnerCanSetVolatility`
  - What it does: Confirms the owner can update oracle volatility.
  - Run:

```bash
forge test --match-test testOwnerCanSetVolatility -vv
```

- `testOwnerCanUpdateHookConfig`
  - What it does: Confirms the owner can update threshold, retail cap, and oracle address.
  - Run:

```bash
forge test --match-test testOwnerCanUpdateHookConfig -vv
```

- `testNonOwnerCannotUpdateHookConfig`
  - What it does: Confirms non-owners cannot change hook config values.
  - Run:

```bash
forge test --match-test testNonOwnerCannotUpdateHookConfig -vv
```

- `testSetOracleZeroAddressReverts`
  - What it does: Confirms setting oracle to zero address reverts with `ZeroAddress`.
  - Run:

```bash
forge test --match-test testSetOracleZeroAddressReverts -vv
```

## test/RWAComplyIntegration.t.sol

- `testTier0SwapRevertsThroughPoolManager`
  - What it does: Confirms Tier 0 swap reverts through PoolManager with wrapped `AccessDenied`.
  - Run:

```bash
forge test --match-test testTier0SwapRevertsThroughPoolManager -vv
```

- `testTier0AddLiquidityRevertsThroughPoolManager`
  - What it does: Confirms Tier 0 add-liquidity reverts through PoolManager with wrapped `AccessDenied`.
  - Run:

```bash
forge test --match-test testTier0AddLiquidityRevertsThroughPoolManager -vv
```

- `testTier1SwapPassesThroughPoolManager`
  - What it does: Confirms Tier 1 swaps succeed and emit expected `BeforeSwapCalled` data.
  - Run:

```bash
forge test --match-test testTier1SwapPassesThroughPoolManager -vv
```

- `testTier2SwapPassesThroughPoolManager`
  - What it does: Confirms Tier 2 swaps succeed and emit expected `BeforeSwapCalled` data.
  - Run:

```bash
forge test --match-test testTier2SwapPassesThroughPoolManager -vv
```

- `testFullFlowInitializeAddLiquidityAndSwap`
  - What it does: Confirms end-to-end initialize, add-liquidity, and swap flow executes with expected fee.
  - Run:

```bash
forge test --match-test testFullFlowInitializeAddLiquidityAndSwap -vv
```

- `testPausedSwapRevertsThroughPoolManager`
  - What it does: Confirms swaps revert with `PoolPaused` when pause is enabled.
  - Run:

```bash
forge test --match-test testPausedSwapRevertsThroughPoolManager -vv
```

- `testRetailCapExceededRevertsThroughPoolManager`
  - What it does: Confirms retail swaps over cap revert with `RetailLimitExceeded`.
  - Run:

```bash
forge test --match-test testRetailCapExceededRevertsThroughPoolManager -vv
```

- `testDynamicFeeAppliedDefaultLowVolatility`
  - What it does: Confirms low volatility applies default executed fee `1000`.
  - Run:

```bash
forge test --match-test testDynamicFeeAppliedDefaultLowVolatility -vv
```

- `testDynamicFeeAppliedRetailHighVolatility`
  - What it does: Confirms high volatility applies executed fee `5000` for Tier 1 users.
  - Run:

```bash
forge test --match-test testDynamicFeeAppliedRetailHighVolatility -vv
```

- `testDynamicFeeAppliedInstitutionalHighVolatility`
  - What it does: Confirms high volatility applies executed fee `500` for Tier 2 users.
  - Run:

```bash
forge test --match-test testDynamicFeeAppliedInstitutionalHighVolatility -vv
```

- `testStaticFeePoolIgnoresHookOverride`
  - What it does: Confirms static-fee pools keep static fee `3000` even when hook computes a different fee.
  - Run:

```bash
forge test --match-test testStaticFeePoolIgnoresHookOverride -vv
```
