# RWAComply

One human. Multiple wallets. One shared purchase budget.

I built this so an issuer can cap how much one person buys, even when that person uses more than one wallet. Alice’s budget is 1,000 USDC. Wallet A buys 700. Wallet B’s request for 500 is rejected. Wallet B buys 200. Alice has 100 left across both wallets. Bob still has his own 1,000.

The purchase goes through [`src/PoolExecutor.sol`](src/PoolExecutor.sol) as an exact-input USDC swap. [`src/RWAComplyHook.sol`](src/RWAComplyHook.sol) checks the remaining budget. [`src/AllocationLedger.sol`](src/AllocationLedger.sol) stores what has been spent. What the cap does not cover is in [docs/product-scope.md](docs/product-scope.md).

The Sepolia pool uses mock USDC and mock RWA. They are not real-world assets. CCA finds a launch price and distributes tokens. RWAComply answers a different question: how much one verified person can cumulatively buy across the wallets they link.

Proof of human, wallet ownership, onchain registration, and the issuer’s access tier are separate. An investor cannot set their own tier. World proofs and `session_id` stay in the backend. The chain stores the allocation id, the wallet registration, and the USDC spent. Arkiv stores the public offering metadata. It does not store the cap or the spend, and it cannot reject a swap.

## Read next

| If you want to | Open |
|---|---|
| Prepare a machine and run the demo | [first-time-setup.md](first-time-setup.md) |
| See the commands and environment names | [setup.md](setup.md) |
| Run the tests | [tests.md](tests.md) |
| Show the product | [demo.md](demo.md) |
| See how the pieces connect | [architecture.md](architecture.md) |
| Look up the Sepolia deployment | [deployment.md](deployment.md) |
| Read the hook, World ID, or Arkiv notes | [integrations/uniswap-v4.md](integrations/uniswap-v4.md), [integrations/world-id.md](integrations/world-id.md), [integrations/arkiv.md](integrations/arkiv.md) |
| See the product boundary | [docs/product-scope.md](docs/product-scope.md) |
| Read the Uniswap hook notes | [FEEDBACK.md](FEEDBACK.md) |

## Code

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

The API is the Next.js server in `frontend/`:

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

Pages: `/`, `/invest`, `/how`, `/getting-started`, and `/demo`.

## What is deployed

Ethereum Sepolia, chain id `11155111`. The official PoolManager is `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`. The rest of the addresses, the pool id, and the transaction hashes are in [deployment.md](deployment.md). Local Anvil is chain id `31337` and uses different addresses.

From `frontend/`, `npm run query:offering` reads the Arkiv offering. The writer is `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. The entity is `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`. The query is `projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')`.

The shared-budget purchase, 700 then a rejected 500 then 200, has been run on local Anvil. The contracts and the offering are on Sepolia. A real World ID session and a Sepolia investor purchase have not been done.

Commit `1629f37` (2026-03-20) is the last commit from before this event. What already existed there was the hook, the oracle, the executor, the local deploy, and the demo UI. What was added after it is the ledger, the shared budget, World ID, the investor pages, and Arkiv. There are no commits between `1629f37` and `540aeb2` (2026-11-05). The earlier demo video is https://youtu.be/oxLZlcRivwM.

## License

[MIT](LICENSE)
