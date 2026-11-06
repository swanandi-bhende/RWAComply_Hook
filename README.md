# RWAComply

## Problem

A purchase limit on a single wallet does not limit the investor. The same person can buy through another wallet and stay under a per-wallet cap. RWAComply addresses that gap for purchases that go through its supported market.

## Product

The platform enforces one shared purchase budget per verified human across the wallets that human links. On the local marketplace path, each offering has its own cap. The deployed Sepolia market is still one offering. Investors can connect a wallet, complete proof of human in World App, register that wallet, and link another wallet to the same budget. A purchase through the supported exact-input USDC route reduces that shared budget. A second person keeps a separate budget.

The system verifies proof of human, wallet ownership, onchain registration, and the issuer access tier as separate steps. An investor cannot set their own tier. World proofs and `session_id` stay in the backend. The chain stores the allocation id, the wallet registration, and the USDC spent. Offering metadata is published through Arkiv. Arkiv stores the public offering metadata. It does not store the cap or the spend, and it cannot reject a swap.

The current market uses mock USDC and mock RWA. They are not real-world assets. CCA helps an issuer discover a launch price and distribute tokens. RWAComply helps an issuer enforce how much a verified investor can cumulatively purchase across linked wallets in supported markets.

## How to access

No production URL is published. The current method is a local preview, not a production deployment. From `frontend/`, `npm run dev` serves `http://localhost:3000`.

| Page | What it is |
|---|---|
| `/invest` | Ethereum Sepolia investor page |
| `/getting-started` | Investor guide |
| `/demo` | Local Anvil market, chain id `31337` |
| `/offerings` | The live Sepolia offering, plus labeled examples that are not deployed |
| `/issuer` | Issuer preparation. It does not send a Sepolia transaction |

Commands for that preview are in [setup.md](setup.md).

## Documentation

| Subject | Guide |
|---|---|
| Investor steps, then repository setup | [first-time-setup.md](first-time-setup.md) |
| Commands and environment names | [setup.md](setup.md) |
| Investor and issuer demonstrations | [demo.md](demo.md) |
| How the pieces connect | [architecture.md](architecture.md) |
| Tests | [tests.md](tests.md) |
| Hook, World ID, and Arkiv | [integrations/uniswap-v4.md](integrations/uniswap-v4.md), [integrations/world-id.md](integrations/world-id.md), [integrations/arkiv.md](integrations/arkiv.md) |
| Sepolia deployment | [deployment.md](deployment.md) |
| Product boundary | [docs/product-scope.md](docs/product-scope.md) |
| Marketplace design | [docs/MARKETPLACE_ARCHITECTURE.md](docs/MARKETPLACE_ARCHITECTURE.md) |

## Proof and implementation

| Piece | Source |
|---|---|
| Hook | [`src/RWAComplyHook.sol`](src/RWAComplyHook.sol) |
| Allocation ledger | [`src/AllocationLedger.sol`](src/AllocationLedger.sol) |
| Trusted executor | [`src/PoolExecutor.sol`](src/PoolExecutor.sol) |
| Oracle | [`src/MockRWAOracle.sol`](src/MockRWAOracle.sol) |
| Sepolia deploy | [`script/DeploySepolia.s.sol`](script/DeploySepolia.s.sol) |
| Local deploy | [`script/DeployFull.s.sol`](script/DeployFull.s.sol) |
| Enrollment | [`frontend/app/api/world/enroll/route.ts`](frontend/app/api/world/enroll/route.ts) |
| Second wallet | [`frontend/app/api/world/continue/route.ts`](frontend/app/api/world/continue/route.ts) |
| Offering read | [`frontend/app/api/offerings/route.ts`](frontend/app/api/offerings/route.ts) |
| Public addresses | [`frontend/app/api/deployment-addresses/route.ts`](frontend/app/api/deployment-addresses/route.ts) |
| Purchase history | [`frontend/app/api/product/purchases/route.ts`](frontend/app/api/product/purchases/route.ts) |

The Sepolia market record is [deployment.md](deployment.md) and [deployments/sepolia-deployment.json](deployments/sepolia-deployment.json). The official PoolManager is `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`. From `frontend/`, `npm run query:offering` reads the Arkiv offering. The writer is `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. The entity is `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`. The query is `projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')`.

Commit `1629f37` (2026-03-20) is the pre-event boundary. What already existed was the hook, the oracle, the executor, the local deploy, and the demo UI. What was added after it is the ledger, the shared budget, World ID, the investor pages, and Arkiv. The shared-budget purchase was run on local Anvil. A live World ID session and a Sepolia investor purchase have not been completed. The earlier demo video is https://youtu.be/oxLZlcRivwM. License: [MIT](LICENSE).
