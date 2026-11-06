# RWAComply

RWAComply is a Uniswap v4 hook for one compliance-aware pool. Several wallets can share one USDC purchase budget. The budget is enforced only on the supported purchase route.

The mock USDC and mock RWA on the demo pool are not real-world assets. World ID proof of human is not KYC, AML, accreditation, residency, nationality, or legal eligibility.

## What already existed on `v2`

Commit `1629f37` (2026-03-20) is the last commit from before this event. That tree already had:

- [`src/RWAComplyHook.sol`](src/RWAComplyHook.sol) — tier 0 blocked, tier 1 retail with a cap, tier 2 institutional, pause, and a dynamic fee from [`src/MockRWAOracle.sol`](src/MockRWAOracle.sol).
- [`src/PoolExecutor.sol`](src/PoolExecutor.sol) — a local swap helper for that hook.
- [`src/MockERC20.sol`](src/MockERC20.sol) and [`src/MockRWAOracle.sol`](src/MockRWAOracle.sol) — demo tokens and the volatility oracle.
- [`script/DeployFull.s.sol`](script/DeployFull.s.sol) and [`script/run_canonical_demo.sh`](script/run_canonical_demo.sh) — the local Anvil deployment.
- [`frontend/app/api/deployment-addresses/route.ts`](frontend/app/api/deployment-addresses/route.ts) — the only backend route, used by the local demo.
- The Next.js demo under `frontend/`, including [`frontend/components/SwapDemo.tsx`](frontend/components/SwapDemo.tsx).

The earlier demo video is https://youtu.be/oxLZlcRivwM. There are no commits between `1629f37` and `540aeb2` (2026-11-05).

## What was added

- [`src/AllocationLedger.sol`](src/AllocationLedger.sol) — one allocation id, the wallets registered to it, and the USDC spent for a group and period.
- [`src/PoolExecutor.sol`](src/PoolExecutor.sol) — `swapExactInput`. The purchaser is `msg.sender`. The router passes that address to the hook and does not accept a different trader.
- [`src/RWAComplyHook.sol`](src/RWAComplyHook.sol) — `beforeSwap` checks the ledger for that trader. `afterSwap` records the settled USDC. A revert leaves both the tokens and the spend unchanged.
- [`script/DeploySepolia.s.sol`](script/DeploySepolia.s.sol) — the Ethereum Sepolia deployment against the existing Uniswap v4 PoolManager. Addresses are in [`docs/sepolia-deployment.md`](docs/sepolia-deployment.md).
- [`script/start_anvil_demo.sh`](script/start_anvil_demo.sh) and [`script/demo_allocation_journey.sh`](script/demo_allocation_journey.sh) — local Anvil deploy and the two-wallet purchase.
- World ID and product routes, all served by the Next.js app:
  - [`frontend/app/api/world/rp-context/route.ts`](frontend/app/api/world/rp-context/route.ts)
  - [`frontend/app/api/world/enroll/route.ts`](frontend/app/api/world/enroll/route.ts)
  - [`frontend/app/api/world/continue/route.ts`](frontend/app/api/world/continue/route.ts)
  - [`frontend/app/api/world/wallet-challenge/route.ts`](frontend/app/api/world/wallet-challenge/route.ts)
  - [`frontend/app/api/world/wallet-authorization/route.ts`](frontend/app/api/world/wallet-authorization/route.ts)
  - [`frontend/app/api/world/registration-receipt/route.ts`](frontend/app/api/world/registration-receipt/route.ts)
  - [`frontend/app/api/product/status/route.ts`](frontend/app/api/product/status/route.ts)
  - [`frontend/app/api/offerings/route.ts`](frontend/app/api/offerings/route.ts)
- The investor pages `/`, `/invest`, and `/how`, and the Arkiv offering under [`arkiv/schema.md`](arkiv/schema.md).

The offering writer is `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. The entity is `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`. From `frontend/`:

```bash
npm run query:offering
```

That prints the entity key, the writer, and:

```text
projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')
```

## Identity boundary

World proofs and `session_id` stay in the backend. Enrollment and continuation are [`frontend/app/api/world/enroll/route.ts`](frontend/app/api/world/enroll/route.ts) and [`frontend/app/api/world/continue/route.ts`](frontend/app/api/world/continue/route.ts). The session is encrypted server-side. Neither the proof nor `session_id` is written to the contracts or to Arkiv.

The chain stores the allocation id, the wallet registration, and the USDC spent. Those values are in [`src/AllocationLedger.sol`](src/AllocationLedger.sol). The hook reads the remaining budget and records the settled purchase. It does not read a World ID proof.

Arkiv stores the public offering metadata and nothing else. The schema is [`arkiv/schema.md`](arkiv/schema.md). The cap, the spent amount, and the remaining budget are not in the entity. Spend accounting stays on the ledger because Arkiv cannot reject a swap.

Proof of human, wallet ownership, onchain registration, and the issuer access tier are separate. An investor cannot set their own tier.

## Run

From the repository root, in this order. The only environment file is the repository-root `.env`. Do not add `frontend/.env`.

1. Start Anvil on chain id `31337`, if it is not already listening on `127.0.0.1:8545`:

```bash
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
```

2. Deploy the local demo. [`script/start_anvil_demo.sh`](script/start_anvil_demo.sh) starts Anvil when step 1 was skipped, funds the deployer on that node only, and broadcasts [`script/DeployFull.s.sol`](script/DeployFull.s.sol). It does not edit `.env` and it does not send a Sepolia transaction.

```bash
bash script/start_anvil_demo.sh
```

3. Start the backend. The API routes above are the backend, and they run inside the Next.js server:

```bash
cd frontend
npm ci
npm run dev
```

4. Start the frontend. The same command serves the pages. Open `http://localhost:3000`. `/demo` is the Anvil market. `/invest` is the Ethereum Sepolia investor page.

5. Publish the Arkiv offering. From `frontend/`, with `ARKIV_ACCESS_KEY` and `ARKIV_PUBLISHER_PRIVATE_KEY` in the repository-root `.env`:

```bash
npm run publish:offering
```

If the current offering is already on Rabdi, the command prints it and does not create another.

6. Run the two-wallet purchase on local Anvil only:

```bash
bash script/demo_allocation_journey.sh
```

Wallet A buys 700 USDC, Wallet B's 500 USDC purchase reverts, Wallet B buys 200 USDC, and a second person keeps a separate cap. The script refuses every chain except `31337`.

Tests:

```bash
forge test
cd frontend && npm run test:world
```

Uniswap hook notes for this continuity submission are in [`FEEDBACK.md`](FEEDBACK.md). The World ID note is [`docs/world-integration.md`](docs/world-integration.md). The spoken demo script is [`docs/demo-script.md`](docs/demo-script.md).

## Limits

The World ID credential is not KYC or AML. It is a proof of human for this session.

The cap applies to the router's exact-input USDC purchase, `PoolExecutor.swapExactInput`, through this hook. It does not block direct token transfers, other protocols, or other chains. Selling RWA does not restore the budget. The spent amount stays on `AllocationLedger`.

## License

MIT
