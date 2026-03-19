# RWAComply Hook (Uniswap v4)

RWAComply is a Uniswap v4 hook prototype for compliance-aware pools.

It includes:
- tier-based access control (tier 0 blocked, tier 1 retail, tier 2 institutional)
- retail swap caps
- oracle-driven dynamic fee selection
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

Tier 1 pass through PoolManager swap:

```bash
forge test --match-test testTier1SwapPassesThroughPoolManager -vv
```

Tier 2 pass through PoolManager swap:

```bash
forge test --match-test testTier2SwapPassesThroughPoolManager -vv
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
- `test/RWAComplyIntegration.t.sol`
  - real PoolManager integration path
  - tier 0 swap reverts
  - tier 1 swap succeeds
  - tier 2 swap succeeds

## Troubleshooting

- `HookAddressNotValid(...)`:
  - run `DeployHook.s.sol`; it brute-forces a valid CREATE2 salt for required hook flags
- `CurrencyNotSettled()`:
  - ensure you are using current `PoolExecutor` logic with `sync + settle` and `take`
- stale env values after redeploy:
  - if `POOL_MANAGER` changes, redeploy hook and update `HOOK_ADDRESS` before running `DeployFull`
