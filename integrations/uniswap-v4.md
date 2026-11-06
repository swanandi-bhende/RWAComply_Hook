# Uniswap v4

Uniswap v4 is the pool. RWAComply is a hook on one pool plus the only router allowed to swap through that hook.

| Piece | Role |
|---|---|
| PoolManager `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | Official Sepolia v4 manager. The deploy script does not deploy a second one. Anvil deploys its own manager |
| [`src/RWAComplyHook.sol`](../src/RWAComplyHook.sol) | `beforeSwap` allows or rejects. `afterSwap` records the settled USDC |
| [`src/PoolExecutor.sol`](../src/PoolExecutor.sol) | The trusted execution path. `swapExactInput` pulls USDC from `msg.sender` |
| [`src/AllocationLedger.sol`](../src/AllocationLedger.sol) | The budget. The hook is the only account that may record spend |

The hook address encodes permission bits `2240` (`0x8c0`). [`src/HookFlags.sol`](../src/HookFlags.sol) declares them. [`test/HookPermissions.t.sol`](../test/HookPermissions.t.sol) checks the deployed address and rejects a direct callback from any other account.

`beforeSwap` reverts unless `sender` is `trustedRouter`. The trader comes from the executor’s hook data, not from an arbitrary caller. The swap must be exact-input. The input currency must be the configured USDC. The trader must be registered and inside the remaining budget. The hook also still applies the earlier tier, retail-cap, pause, and dynamic-fee checks. The fee reads [`src/MockRWAOracle.sol`](../src/MockRWAOracle.sol).

`afterSwap` records the negative USDC leg of the `BalanceDelta`. If `recordSpend` reverts, the swap reverts. Selling RWA does not reduce spend. Exact output records nothing.

Two wallets registered to the same allocation id share `spentByAllocation` for that group and period. The Sepolia hook stores one group, `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677`, and period `1`. One pool is deployed: `0x45fa53491f19ed13a7b274ac5c3f2f6c670d699125f2ffeaedf7a94600d7a7f7`. A second pool is not deployed, so shared enforcement across two pools is not demonstrated.

The local journey is [`script/demo_allocation_journey.sh`](../script/demo_allocation_journey.sh) on chain `31337`. The Sepolia wiring is [deployment.md](../deployment.md). Hook notes for the continuity submission are [FEEDBACK.md](../FEEDBACK.md).

Tests: `test/PoolExecutor.t.sol`, `test/HookBudget.t.sol`, `test/AllocationJourney.t.sol`, `test/RWAComply.t.sol`, `test/RWAComplyIntegration.t.sol`.
