# RWAComply

One human. Multiple wallets. One shared purchase budget.

A person can split a purchase across wallets and look like several investors. RWAComply gives an issuer one USDC budget for one verified human. Wallets linked to that human share the budget. A purchase through the trusted Uniswap v4 route consumes it. Another person keeps a separate budget.

Alice has 1,000 USDC. Wallet A buys 700. Wallet B’s 500 request is rejected. Wallet B buys 200. Alice has 100 left across both wallets. Bob still has his own 1,000.

CCA helps an issuer discover a launch price and distribute tokens. RWAComply helps an issuer enforce how much a verified investor can cumulatively purchase across linked wallets in supported markets.

The Sepolia pool uses mock USDC and mock RWA. They are not real-world assets. World ID proof of human is not KYC, AML, accreditation, residency, nationality, or legal eligibility.

## Core primitives

- **Linked wallets, one allocation.** A verified human receives a pseudonymous allocation id. Each wallet is registered to it only after a separate ownership signature and an onchain receipt.
- **One cumulative budget.** [`src/AllocationLedger.sol`](src/AllocationLedger.sol) records gross USDC spend. [`src/RWAComplyHook.sol`](src/RWAComplyHook.sol) enforces the remainder on the supported swap.
- **A public offering record.** Arkiv stores the offering’s public metadata. It does not store the cap, the spend, or the remainder.

## How it works

1. Prove human uniqueness with World ID.
2. Prove wallet ownership with a separate signature.
3. Register the wallet to the shared allocation identity.
4. Buy exact-input USDC through [`src/PoolExecutor.sol`](src/PoolExecutor.sol).
5. The hook checks the remaining allocation and records the settled USDC.

Proof of human, wallet ownership, onchain registration, issuer approval, and purchase enforcement are separate steps. An investor cannot set their own tier.

## Quick navigation

| Guide | What it answers |
|---|---|
| [setup.md](setup.md) | Install, environment, Anvil, Sepolia reads, Arkiv |
| [tests.md](tests.md) | Contract, application, and production checks |
| [demo.md](demo.md) | Local demo, Sepolia investor path, judge walkthrough |
| [architecture.md](architecture.md) | Layers and the source of truth for each record |
| [deployment.md](deployment.md) | Sepolia addresses, pool, and transaction record |
| [integrations/uniswap-v4.md](integrations/uniswap-v4.md) | Hook, executor, and PoolManager |
| [integrations/world-id.md](integrations/world-id.md) | Enrollment, continuation, and registration |
| [integrations/arkiv.md](integrations/arkiv.md) | Offering directory |
| [FEEDBACK.md](FEEDBACK.md) | Uniswap hook notes |
| [docs/PRD_COMPLIANCE_AUDIT.md](docs/PRD_COMPLIANCE_AUDIT.md) | Requirement-by-requirement status |

## Core components

| Piece | Path |
|---|---|
| Hook | [`src/RWAComplyHook.sol`](src/RWAComplyHook.sol) |
| Allocation ledger | [`src/AllocationLedger.sol`](src/AllocationLedger.sol) |
| Trusted executor | [`src/PoolExecutor.sol`](src/PoolExecutor.sol) |
| Oracle | [`src/MockRWAOracle.sol`](src/MockRWAOracle.sol) |
| Sepolia deploy | [`script/DeploySepolia.s.sol`](script/DeploySepolia.s.sol) |
| Local deploy | [`script/DeployFull.s.sol`](script/DeployFull.s.sol) |
| Investor page | [`frontend/components/product/InvestorExperience.tsx`](frontend/components/product/InvestorExperience.tsx) |
| Offering client | [`frontend/lib/arkiv/offering.ts`](frontend/lib/arkiv/offering.ts) |

The backend is the Next.js server. Routes:

- [`frontend/app/api/world/rp-context/route.ts`](frontend/app/api/world/rp-context/route.ts)
- [`frontend/app/api/world/enroll/route.ts`](frontend/app/api/world/enroll/route.ts)
- [`frontend/app/api/world/continue/route.ts`](frontend/app/api/world/continue/route.ts)
- [`frontend/app/api/world/wallet-challenge/route.ts`](frontend/app/api/world/wallet-challenge/route.ts)
- [`frontend/app/api/world/wallet-authorization/route.ts`](frontend/app/api/world/wallet-authorization/route.ts)
- [`frontend/app/api/world/registration-receipt/route.ts`](frontend/app/api/world/registration-receipt/route.ts)
- [`frontend/app/api/product/status/route.ts`](frontend/app/api/product/status/route.ts)
- [`frontend/app/api/product/purchases/route.ts`](frontend/app/api/product/purchases/route.ts)
- [`frontend/app/api/offerings/route.ts`](frontend/app/api/offerings/route.ts)
- [`frontend/app/api/deployment-addresses/route.ts`](frontend/app/api/deployment-addresses/route.ts)

Pages: `/`, `/invest`, `/how`, and `/demo`.

## Protocol integrations

- [Uniswap v4](integrations/uniswap-v4.md) supplies the pool and the hook callbacks. The official Sepolia PoolManager is `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`.
- [World ID](integrations/world-id.md) proves a human for this session. Proofs and `session_id` stay in the backend.
- [Arkiv](integrations/arkiv.md) publishes the offering. Arkiv stores the public offering metadata and cannot reject a swap.

Read the current offering from `frontend/` with `npm run query:offering`. The writer is `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. The entity is `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`. The query is `projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')`.

## Deployments and proof

Ethereum Sepolia, chain id `11155111`. Addresses, the pool id, and the transaction hashes are in [deployment.md](deployment.md). The local market is Anvil chain id `31337` and is not those addresses.

## Current implementation status

| State | What |
|---|---|
| Implemented and covered by tests | Shared USDC budget, exact-input enforcement, registration authorization, offering directory, purchase-history read |
| Demonstrated on local Anvil | Wallet A buys 700, Wallet B’s 500 reverts, Wallet B buys 200, Bob keeps a separate budget |
| Deployed on Sepolia and read back | Hook, ledger, executor, oracle, mock tokens, pool, policy cap of 1,000 USDC, Arkiv offering |
| Awaiting a real person | World ID enrollment, continuation, Sepolia registration, issuer tier, and a Sepolia purchase |
| Not this release | KYC, transfer restrictions, a second live pool, wallet revocation, a per-swap trade signature |

Commit `1629f37` (2026-03-20) is the last commit from before this event. What already existed there was the hook, the oracle, the executor, the local deploy, and the demo UI. What was added after it is the ledger, the shared-budget hook path, World ID, the investor pages, and Arkiv. There are no commits between `1629f37` and `540aeb2` (2026-11-05). The earlier demo video is https://youtu.be/oxLZlcRivwM.

## Limitations

The cap applies to the router’s exact-input USDC purchase, `PoolExecutor.swapExactInput`, through this hook. It does not block direct token transfers, other protocols, or other chains. Selling RWA does not restore the budget. The credential is not KYC or AML. The issuer access tier is a separate owner action.

## License

[MIT](LICENSE)
