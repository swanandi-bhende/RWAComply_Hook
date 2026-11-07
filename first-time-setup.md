# First-time setup

This file has two audiences. Part A is for an investor using RWAComply. Part B is for a developer, hacker, or judge running the repository. The command reference for Part B is [setup.md](setup.md). The product boundary is [docs/product-scope.md](docs/product-scope.md).

## Part A. Using the product

An investor does not create a World ID application, create a relying party, generate signing keys, edit an environment file, install Foundry, run Anvil, or deploy contracts. The product operator configures the World ID application and the backend credentials once.

The investor uses the application the operator is already running. There is no production URL yet. Until one is published, start at the local preview: `/` explains the product, `/offerings` shows the Sepolia demo market, and `/invest` is the investor journey. The on-site guide is `/getting-started`. That preview is not a production deployment.

What the investor needs:

- The RWAComply application.
- A browser wallet the investor controls.
- A little Ethereum Sepolia ETH for gas. One public faucet is [Alchemy’s Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia).
- World App, from [world.org](https://world.org), with a World ID on the phone.
- Demo USDC in the wallet before a purchase. The token is mock USDC at `0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe`, not real USDC. Its `mint` function is public, and the investor page does not call it. The received token is mock RWA, not a real-world asset.
- Issuer approval before a purchase. Registration does not grant it. The investor cannot set it.

Leave the contract owner `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6`, the allocation signer `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`, and the liquidity helper `0x58F03D8e2B11014d24773eB32E467c9297634008` out of the investor wallets. The ledger does not reject the owner or the signer, but `/invest` reads those roles from the contract and blocks registration for them. The liquidity helper is a contract, not a browser wallet.

1. Open `/invest`.
2. Connect the first wallet.
3. Switch to Ethereum Sepolia, chain id `11155111`. The page has a switch button when the wallet is on another network.
4. Open World App on the phone. The investor does not open the World Developer Portal.
5. Choose “Verify with World App”. On a computer, scan the QR code with World App. On a phone, open the World App link. Approve the proof there. RWAComply checks that proof with the operator’s configured World ID application before it says the person is verified. The proof is not KYC or AML, and it does not register the wallet by itself.
6. Sign the wallet-ownership message in the browser wallet. That signature shows control of the address.
7. Confirm the `registerWallet` transaction. The page reports the wallet as linked only after the chain receipt matches.
8. Wait for issuer approval. The hook owner sets the access tier with `setTier`. Tier 0 cannot purchase. The investor sees “Issuer approval required” until that call exists. No investor tier has been set on Sepolia.
9. Disconnect the first wallet, connect the second wallet, and choose “Continue and register this wallet”. That continues the existing World ID session. A new enrollment would be a different person and a different budget. Sign again and confirm the second registration. The allocation id is not shown.
10. Read the shared remaining budget on the page. The cap and the spend come from Ethereum. The offering panel is public metadata. A purchase uses the supported exact-input USDC route. Selling does not restore the budget.

A live World ID proof has not been completed on this deployment, so steps 5 through 9 are the product flow and not a finished recording. The 700, rejected 500, and 200 purchase was run on local Anvil, not as a Sepolia investor transaction. A cancelled World App prompt does not register a wallet.

## Part B. Running the repository

This part is only for someone self-hosting RWAComply. Investors should stop at Part A.

A self-hosted instance needs its own development World ID application and its own backend credentials. Do not reuse or request the operator’s private keys, access keys, or RPC credentials. Public contract addresses are not secrets. Private keys are.

Prerequisites are Git, Node.js 22.23.4, npm 10.9.9, and Foundry (`forge`, `anvil`, `cast`). `frontend/.nvmrc` records the Node version. There is no root `package.json`. Install only in `frontend/` with `npm ci`. The full command order is in [setup.md](setup.md): local Anvil, the demo deploy, `npm run dev`, the offering commands, then the Anvil purchase script.

Use one environment file, the repository-root `.env`. Do not create `frontend/.env` or `frontend/.env.local`.

Five credentials stay separate. Do not reuse one for another job. The server refuses to start if the allocation key and the World ID key are the same, and the Sepolia deploy script refuses to use the deployer as the allocation signer.

| Credential | Environment name | Purpose |
|---|---|---|
| Ethereum deployer | `PRIVATE_KEY` | Local deploy, and the existing Sepolia owner. Not an investor |
| Allocation signer | `ALLOCATION_AUTH_SIGNING_KEY` | Signs `registerWallet`. The public address is `ALLOCATION_AUTH_SIGNER_ADDRESS` |
| World ID RP signer | `WORLD_PRIVATE_KEY` | Signs relying-party context. The public address is `WORLD_RP_SIGNER_ADDRESS` |
| Arkiv access key | `ARKIV_ACCESS_KEY` | Hub access to Rabdi. Not a wallet key |
| Arkiv publisher | `ARKIV_PUBLISHER_PRIVATE_KEY` | Wallet that owns the offering entity. Not an investor |

Create the World ID application in the World Developer Portal for the development instance. Copy the app id to `WORLD_APP_ID` and the relying-party id to `WORLD_RP_ID`. Store the portal’s RP signing key as `WORLD_PRIVATE_KEY` and the shown signer address as `WORLD_RP_SIGNER_ADDRESS`. Set `WORLD_ID_ENVIRONMENT` to match that app. This deployment has been configured for `staging`. Generate a different 32-byte value for `WORLD_SESSION_ENCRYPTION_KEY` with `openssl rand -hex 32`. From `frontend/`, `npm run verify:world-signer` checks that the World key matches the signer address and prints neither value.

Create the allocation signer with `cast wallet new` on the developer machine. Put the key and address in the two allocation names. For a brand-new local Anvil market, that new signer is correct. For the already deployed Sepolia ledger, `backendSigner()` is `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`. Registration against that market works only when the configured signer is that address. Do not ask the operator for the private key. Without it, run the local market instead of writing to Sepolia.

`ALLOCATION_RPC_URL` is a Sepolia HTTPS or WebSocket URL from an RPC provider. Treat it as a secret when it contains an API key. The variable list, including the public `NEXT_PUBLIC_*` addresses, is in [setup.md](setup.md).

Create an Arkiv access key at [Arkiv Hub](https://hub.arkiv.network/access-keys). Fund a separate publisher wallet with tGLM at [the Rabdi faucet](https://hub.arkiv.network/faucet). The existing writer is `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. Reading the published offering does not require a new publisher. `npm run query:offering` only reads. `npm run publish:offering` must not create a second entity.

Local Anvil is chain id `31337`. `bash script/start_anvil_demo.sh` starts it when port 8545 is quiet, deploys the local market with Anvil’s development account, seeds Alice and Bob, and does not send a Sepolia transaction. `bash script/demo_allocation_journey.sh` then runs the two-wallet purchase and refuses every other chain. `/demo` is that guided local demonstration. `/invest` is the separate World ID and Sepolia path. A successful local demo is not a World ID verification. From `frontend/`, `RWA_DEMO_IDENTITY=local npm run dev` serves the preview. `forge test` and `npm run test:world` are the test commands. Details and the required order are in [setup.md](setup.md), [tests.md](tests.md), and [demo.md](demo.md).
