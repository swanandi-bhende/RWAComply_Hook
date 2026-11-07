# Tests

Run commands from the directories below. Counts in old notes are historical. The count from a command is the one in that command’s output.

## Solidity

From the repository root:

```bash
forge test
```

| File | What it covers |
|---|---|
| `test/RWAComply.t.sol` | Tiers, retail cap, pause, oracle fee |
| `test/RWAComplyIntegration.t.sol` | Swaps through a PoolManager |
| `test/HookPermissions.t.sol` | CREATE2 permission bits and direct callbacks |
| `test/HookBudget.t.sol` | Hook budget checks |
| `test/AllocationLedger.t.sol` | Policy, registration, nonce, cap |
| `test/AllocationJourney.t.sol` | Shared spend, rejected over-budget swap, sell does not restore spend, exact output records nothing |
| `test/PoolExecutor.t.sol` | Exact-input executor and untrusted callers |
| `test/DeploySepolia.t.sol` | The Sepolia script’s predicted wiring on a fork fixture, not a live broadcast |

`forge build` compiles `src/` with Solidity `0.8.26`.

## Frontend and backend

From `frontend/`:

```bash
npm run test:world
```

That one command runs the Node test files named in `frontend/package.json`. There is no separate backend package. The groups are:

| Area | Files |
|---|---|
| World ID configuration, relying-party context, session encryption, hosted cookies and identity storage | `lib/world/config.test.mts`, `rpContext.test.mts`, `sessionCrypto.test.mts`, `loadRootEnv.test.mts`, `hosting.test.mts` |
| Enrollment and continuation, including a cancelled widget and a rejected proof | `lib/world/enroll.test.mts`, `enrollClient.test.mts`, `enrollmentAction.test.mts`, `continue.test.mts`, `continueClient.test.mts` |
| EIP-712 wallet link and registration receipt | `lib/world/walletLink.test.mts`, `ledgerRegistration.test.mts` |
| Product status, purchase planner, purchase errors, wallet roles, second wallet | `lib/product/product.test.mts`, `usdcPurchase.test.mts`, `purchaseFlow.test.mts`, `walletRole.test.mts`, `lib/world/secondWallet.test.mts` |
| Purchase history decoding | `lib/product/purchaseHistory.test.mts` |
| Anvil deployment parsing, guided-demo action checks, and the local ledger journey | `lib/demo/anvilDeployment.test.mts`, `allocationJourney.test.mts`, `sandbox.test.mts`, `sandboxChain.test.mts` |
| Arkiv client, schema, purchase boundary, prize notes, submission docs | `lib/arkiv/client.test.mts`, `offering.test.mts`, `purchaseBoundary.test.mts`, `prizeDocs.test.mts`, `submissionDocs.test.mts` |

These tests use fixtures. A passing World ID test is not a live World App proof. A passing Arkiv test is not a Rabdi write.

## Local demo

```bash
bash script/start_anvil_demo.sh
bash script/demo_allocation_journey.sh
```

The journey script resets the local snapshot, then buys 700 USDC, rejects 500, and buys 200 on chain `31337`. It refuses every other chain. `sandboxChain.test.mts` runs that same ledger check when Anvil is up. The approval spender is the PoolExecutor. Details are in [demo.md](demo.md).

## Type, lint, and production

From `frontend/`:

| Command | Purpose |
|---|---|
| `npx tsc --noEmit` | Typecheck |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `git diff --check` | From the repository root. Whitespace errors in the diff |

## Before a change is called done

```bash
forge test
cd frontend
npm run test:world
npx tsc --noEmit
npm run lint
npm run build
cd ..
git diff --check
```

There is no automated browser suite and no test that sends a Sepolia investor purchase.
