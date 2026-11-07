# Vercel environment variables

Names only. Do not paste private keys into chat, into this file, or into a commit. Copy values from the local repository-root `.env` into the Vercel dashboard yourself. Public contract addresses already recorded in [sepolia-deployment.md](sepolia-deployment.md) are the source for the public address variables.

`NEXT_PUBLIC_*` values are inlined when `npm run build` runs. Set them before the first production build. Changing one later requires a new deployment. Server-only variables are read when a route runs. A missing optional local `.env` does not stop the build.

| Variable | Required | Client/server | Purpose | Where to obtain |
|---|---|---|---|---|
| `NEXT_PUBLIC_POOL_MANAGER` | No for marketing pages. Required before a wallet can buy on Sepolia | Client | Uniswap v4 PoolManager address | Already deployed. Copy the public address from [sepolia-deployment.md](sepolia-deployment.md) |
| `NEXT_PUBLIC_HOOK_ADDRESS` | Same as the pool manager | Client | Compliance hook address | Same deployment record |
| `NEXT_PUBLIC_ORACLE_ADDRESS` | Same | Client | Oracle address shown to the investor | Same deployment record |
| `NEXT_PUBLIC_TOKEN_A_ADDRESS` | Same | Client | Mock USDC address | Same deployment record |
| `NEXT_PUBLIC_TOKEN_B_ADDRESS` | Same | Client | Mock RWA address | Same deployment record |
| `NEXT_PUBLIC_EXECUTOR_ADDRESS` | Same | Client | Pool executor used for the exact-input purchase | Same deployment record |
| `ALLOCATION_LEDGER_ADDRESS` | Required for registration and purchase reads | Server | Allocation ledger. Also read by the server purchase history | Same deployment record. Do not prefix it with `NEXT_PUBLIC_` |
| `ALLOCATION_CHAIN_ID` | Required for registration | Server | Must be `11155111` for Sepolia | Fixed chain id. The app rejects another chain |
| `ALLOCATION_GROUP_ID` | Required for registration | Server | The single Sepolia allocation group | Same deployment record |
| `ALLOCATION_RPC_URL` | Required for ledger reads, offerings, and registration checks | Server | Sepolia JSON-RPC. `wss://` and `ws://` are rewritten to HTTP for reads | Your RPC provider. Keep the URL and any API key server-only |
| `ALLOCATION_AUTH_SIGNING_KEY` | Required before a wallet can be authorized | Server | Signs registration authorizations. Must not equal `WORLD_PRIVATE_KEY` | Already generated locally. Copy it into Vercel. Never expose it |
| `ALLOCATION_AUTH_SIGNER_ADDRESS` | Required with the signing key | Server | Address derived from the allocation signing key. The server checks that they match | Already recorded with the deployment |
| `WORLD_APP_ID` | Required before World ID can start | Server | World ID application id | World Developer Portal, current staging app. Do not invent a production id |
| `WORLD_RP_ID` | Required before World ID can start | Server | Relying-party id | World Developer Portal |
| `WORLD_PRIVATE_KEY` | Required before a connector request can be signed | Server | RP signing key. Must not equal the allocation key or the session key | World Developer Portal. Server only |
| `WORLD_RP_SIGNER_ADDRESS` | Required with the RP key | Server | Address derived from `WORLD_PRIVATE_KEY` | World Developer Portal |
| `WORLD_ID_ENVIRONMENT` | Required for identity routes | Server | `sandbox` for the TestFlight and Play app. `production` only after a real production app exists | Set `sandbox` |
| `WORLD_SESSION_ENCRYPTION_KEY` | Required before an enrollment can be stored | Server | Encrypts the saved World ID session. 32-byte hex. Must not reuse the RP key | Generated locally. Server only |
| `WORLD_ENROLLMENT_DB_PATH` | Omit on Vercel | Server | Local SQLite path. On Vercel the identity routes refuse to open it | Leave unset in Vercel |
| `RWA_DEMO_IDENTITY` | Omit on Vercel | Server | `local` enables the Anvil demo only when the host is localhost. Any other host, including a Vercel domain, stays off | Do not set this in Vercel |
| `RWA_SEPOLIA_DEMO_BYPASS_ENABLED` | No. Off unless set to `true` | Server | Enables the presentation registration option on `/invest` | Set `true` only for the presentation |
| `RWA_SEPOLIA_DEMO_ALLOWED_WALLETS` | Required when the bypass is enabled | Server | Comma-separated investor wallets. No wildcard. The deployer, allocation signer, and liquidity helper are rejected even if listed | The two presentation investor wallets. Do not use the infrastructure accounts |
| `ARKIV_ACCESS_KEY` | Optional. Offerings still render the chain status without it | Server | Reads the published offering directory | Already created for the local Arkiv client. Server only |
| `ARKIV_PUBLISHER_PRIVATE_KEY` | Omit | Server | Used only by the local publish script. The website does not publish on request | Do not put this in Vercel |
| `ARKIV_CLIENT_STOPPED` | Omit | Server | Test switch that stops the Arkiv client | Do not set this |
| `PRIVATE_KEY` | Omit | Neither | Foundry deploy key. The Next.js app does not read it | Do not put the deployer key in Vercel |
| `DEMO_ANVIL_RPC_URL` | Not used | — | Reserved name for a future isolated demo chain. The current code does not connect to it | Do not invent a URL |
| `DEMO_SIGNER_PRIVATE_KEY` | Not used | — | Reserved name. Do not reuse the World ID key, the allocation key, or the Sepolia deployer | Do not generate one until a dedicated demo chain exists |

`DATABASE_URL` is not read. Identity storage on Vercel fails closed until a persistent database adapter exists. See [vercel-deployment.md](vercel-deployment.md).
