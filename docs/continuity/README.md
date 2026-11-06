# Continuity

RWAComply V2 extends the existing Uniswap v4 hook. The earlier product checks who may trade, how large a retail purchase may be, and what fee applies. V2 adds a separate control: several wallets can share one USDC purchase budget, and that budget is enforced on the supported swap route.

The allocation id is an opaque server identifier. Proof of Human enrollment can create one after World verifies a session-bound uniqueness proof. That check is not KYC, AML, accreditation, or legal eligibility. The ledger registration of a wallet is separate and is not issued by this enrollment step.

## Earlier product

Commits `15f1a4e` (2026-02-27) through `1629f37` (2026-03-20) contain the earlier hook. As described by the repository README, that product has:

- Tier 0 blocked, tier 1 retail with a cap, and tier 2 institutional.
- A volatility oracle and tier-based dynamic fees.
- Admin controls for pause, the retail cap, the volatility threshold, and the oracle address.
- A Next.js demo and a local Anvil deployment.

The README links a demo video: https://youtu.be/oxLZlcRivwM

There are no commits between `1629f37` on 2026-03-20 and `540aeb2` on 2026-11-05.

## Later commits on `v2`

These commits are in the repository history. Their dates are the git author dates.

| Commit | Git date | What it contains |
|---|---|---|
| `540aeb2` | 2026-11-05 | Documentation rearrangement. It also removed several older docs. |
| `7306d25` | 2026-11-05 | Frontend dependency pins and a fee helper. |
| `bd78828` | 2026-11-06 | First `src/AllocationLedger.sol` and its tests: policy storage and wallet registration. |
| `7bcc85a` | 2026-11-06 | Ledger spend accounting, the trusted `PoolExecutor.swapExactInput` router, router tests, and `docs/PRD v1.txt`. |
| `b2b0b45` | 2026-11-06 | Hook budget checks, settled-USDC recording, deployment wiring, the frontend `swapExactInput` call, and CREATE2 permission mining. |
| `2dadaf3` | 2026-11-06 | World ID server configuration and relying-party context signing. |
| `92263ef` | 2026-11-06 | Proof of Human enrollment, encrypted session storage, and the IDKit request helper. |
| `12fe9f5` | 2026-11-06 | World ID signer check, root `.env` loading, and enrollment API hardening. |
| `2f9dc28` | 2026-11-06 | World ID session continuation and wallet-association authorization. |

`2f9dc28` is the current committed `HEAD` of branch `v2`. Onchain registration submission after that commit is in the working tree and is not part of the commit.

## What V2 adds

`src/AllocationLedger.sol` stores a wallet, an allocation id, and USDC spent for a group and period. Two wallets with the same allocation id share one counter. Another allocation id has a separate counter.

`src/PoolExecutor.sol` takes the trader from `msg.sender`. It pulls that wallet's USDC and passes `abi.encode(trader)` as hook data. The caller cannot supply a different trader.

`src/RWAComplyHook.sol` accepts only the configured router. `beforeSwap` checks `AllocationLedger.remaining` for the decoded trader. `afterSwap` reads the negative USDC leg of the pool's `BalanceDelta` and calls `recordSpend` for that amount. The group and period are the ones captured before the swap. If the swap or the ledger write reverts, neither the tokens nor the spend remain.

The journey covered by `test/AllocationJourney.t.sol` is:

- Alice wallet A buys 700 USDC. The shared spend becomes 700.
- Alice wallet B tries 500 USDC. The transaction reverts and the spend stays 700.
- Alice wallet B buys 200 USDC. The shared spend is 900, so 100 remains.
- Bob, with a different allocation id, buys 900 USDC and has 100 remaining on his own counter.

The recorded number is the USDC paid, not the RWA received. The same check is covered with USDC as currency0 and as currency1.

## Limits of this phase

- Proof of Human enrollment can verify a session-bound `signup` proof, store the session encrypted, and create an allocation id. The investor page can continue that session, ask the wallet to sign, and submit registration. The wallet is treated as linked only after the chain state matches. Live Sepolia balances and purchases stay unavailable until the configured contracts have code. No sample values are shown as live data.
- The budget applies only to the `PoolExecutor.swapExactInput` route into this hook.
- Sepolia deployment is prepared in `script/DeploySepolia.s.sol` and has not been broadcast. The hook owner must set an access tier before a linked wallet can purchase. Proof of human does not set that tier.
- Direct transfers, other pools, and other protocols are outside this check.
- A sale does not reduce the recorded spend.
- The tier, retail-cap, pause, and dynamic-fee checks still run on this route. Low volatility uses fee 1000. High volatility uses 5000 for tier 1 and 500 for tier 2.

## Where to read the code

- `src/AllocationLedger.sol`
- `src/PoolExecutor.sol`
- `src/RWAComplyHook.sol`
- `src/HookFlags.sol`
- `test/AllocationLedger.t.sol`
- `test/AllocationJourney.t.sol`
- `test/HookPermissions.t.sol`
- `test/RWAComply.t.sol`
- `test/RWAComplyIntegration.t.sol`
- `script/DeployFull.s.sol`
