# Continuity

RWAComply V2 extends an existing Uniswap v4 hook. It does not replace that product, and it was not created from scratch during ETHGlobal Mumbai.

The new feature is a shared USDC purchase budget. Several registered wallets can point at one allocation id. The supported purchase route checks the remaining budget before the swap and records the USDC the pool actually takes after the swap. A different allocation id has its own budget.

This phase does not connect that allocation id to World ID. The id is created by a backend signature. It is not proof of humanity, KYC, AML, accreditation, or legal eligibility.

## A. Original Hookathon work

Git history from `15f1a4e` (2026-02-27) through `1629f37` (2026-03-20) is the earlier product. The repository README at that point, which is still the committed `README.md` at `7bcc85a` apart from a small later edit, describes:

- Tier 0 blocked, tier 1 retail with a cap, tier 2 institutional.
- A volatility oracle and tier-based dynamic fees.
- Admin controls for pause, the retail cap, the volatility threshold, and the oracle address.
- A Next.js demo and a local Anvil deployment.

The README links a demo video: https://youtu.be/oxLZlcRivwM

No hackathon submission URL, judging page, or event receipt for that March work is stored in this repository. The YouTube link above is the only public demo reference found in the current tree.

## B. Work after that baseline and before ETHGlobal Mumbai

The last commit before November 2026 is `1629f37` on 2026-03-20. The next commit is `540aeb2` on 2026-11-05 at 23:19 IST. There are no commits between those two. This repository does not show a separate body of work in that gap.

## C. Work during the ETHGlobal Mumbai dates

ETHGlobal's public event list shows ETHGlobal Mumbai on 5–7 November 2026. A secondary write-up of the organiser schedule says hacking runs from 21:00 IST on 5 November to 09:00 IST on 7 November. This note uses the commit timestamps in the repository. It does not treat the secondary schedule as something verified on ethglobal.com.

Commits with timestamps inside 5–7 November 2026 IST:

| Commit | Timestamp (IST) | What it contains |
|---|---|---|
| `540aeb2` | 2026-11-05 23:19 | Documentation rearrangement. It also deleted several older docs. |
| `7306d25` | 2026-11-05 23:59 | Frontend dependency pins and a fee helper. |
| `bd78828` | 2026-11-06 02:28 | First `src/AllocationLedger.sol` and its tests: policy storage and wallet registration. |
| `7bcc85a` | 2026-11-06 03:21 | Ledger spend accounting, the trusted `PoolExecutor.swapExactInput` router, router tests, and `docs/PRD v1.txt`. |

`7bcc85a` is the current `HEAD` of branch `v2`. Everything after it is uncommitted local work. It has no commit hash and no git timestamp, so it is not claimed here as a committed Mumbai artifact. That working tree adds the hook's budget check, settled-USDC recording, deployment wiring, the frontend `swapExactInput` call, and CREATE2 permission mining.

## How the V2 purchase budget works

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

- An allocation id is not yet tied to a person through World ID.
- The budget applies only to the `PoolExecutor.swapExactInput` route into this hook.
- Direct transfers, other pools, and other protocols are outside this check.
- A sale does not reduce the recorded spend.
- The original tier, retail-cap, pause, and dynamic-fee checks still run on this route. Low volatility uses fee 1000. High volatility uses 5000 for tier 1 and 500 for tier 2.

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
