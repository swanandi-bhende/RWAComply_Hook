# First time setup

I wrote this for someone opening the repo for the first time. The shorter command list, once the keys exist, is [setup.md](setup.md). The product boundary is [docs/product-scope.md](docs/product-scope.md).

You need Git, Node.js 22.23.4, npm 10.9.9, and Foundry (`forge`, `anvil`, `cast`). `frontend/.nvmrc` records the Node version. From `frontend/`, `nvm use` selects it. It does not install Node.

There is one environment file, at the repository root: `.env`. Do not create `frontend/.env` or `frontend/.env.local`. The Next.js app starts in `frontend/` and loads the root file.

## Five different keys

Do not reuse one key for two jobs. The server refuses to start if the allocation key and the World ID key are the same, and the Sepolia deploy script refuses to use the deployer as the allocation signer.

| Key | Environment name | What it is for |
|---|---|---|
| Ethereum deployer | `PRIVATE_KEY` | Local Anvil deploy, and the account that already owns the Sepolia contracts. Not an investor |
| Allocation signer | `ALLOCATION_AUTH_SIGNING_KEY` | Signs `registerWallet` authorizations. The public address is `ALLOCATION_AUTH_SIGNER_ADDRESS` |
| World ID RP signer | `WORLD_PRIVATE_KEY` | Signs the relying-party context. The public address is `WORLD_RP_SIGNER_ADDRESS` |
| Arkiv access key | `ARKIV_ACCESS_KEY` | Lets the server read and write Rabdi. It is not a wallet key |
| Arkiv publisher | `ARKIV_PUBLISHER_PRIVATE_KEY` | The wallet that owns the offering entity. Not an investor |

Put the values in the root `.env` only. Do not commit the file and do not paste the values into chat.

### World ID

Install [World App](https://world.org) and create a World ID account on a phone. That account is the human. It is not the browser wallet.

In the World Developer Portal, create an app for this project. Copy the app id into `WORLD_APP_ID` and the RP id into `WORLD_RP_ID`. The portal shows the public RP signer address. Put that in `WORLD_RP_SIGNER_ADDRESS`.

The RP signing key is created in that same portal. It is the managed key for the relying party, not a wallet you use to buy tokens. Store it as `WORLD_PRIVATE_KEY`. Set `WORLD_ID_ENVIRONMENT` to `staging` or `production` to match the app you created. This project has been configured for `staging`.

Generate a separate 32-byte session key and store it as `WORLD_SESSION_ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Do not reuse `WORLD_PRIVATE_KEY` for that value. `WORLD_ENROLLMENT_DB_PATH` is optional. If you leave it out, enrollments go to `frontend/data/world-enrollments.sqlite`.

From `frontend/`:

```bash
npm run verify:world-signer
```

That checks that `WORLD_PRIVATE_KEY` derives `WORLD_RP_SIGNER_ADDRESS`. It prints neither value.

### Allocation signer

On your own machine:

```bash
cast wallet new
```

The command prints a new key and address in your terminal. Put the key in `ALLOCATION_AUTH_SIGNING_KEY` and the address in `ALLOCATION_AUTH_SIGNER_ADDRESS`. This key must not be the World ID key and must not be `PRIVATE_KEY`.

On the already deployed Sepolia ledger, `backendSigner()` is `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`. Registration signatures only work if your `ALLOCATION_AUTH_SIGNER_ADDRESS` is that address. If you are using the existing market, use the signer that was deployed, not a brand-new one. If the two names in `.env` do not match each other, the API fails with `ALLOCATION_AUTH_SIGNING_KEY does not match ALLOCATION_AUTH_SIGNER_ADDRESS` and does not print the key.

Also set:

| Name | Value |
|---|---|
| `ALLOCATION_CHAIN_ID` | `11155111` for the investor page |
| `ALLOCATION_LEDGER_ADDRESS` | `0xc74c64fee3b4C2D1E2ed37F218f0179026A9ceeA` for the deployed ledger |
| `ALLOCATION_GROUP_ID` | `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677` |

### Sepolia RPC and the deployer

`ALLOCATION_RPC_URL` is a Sepolia HTTPS or WebSocket URL from your RPC provider. Treat it as a secret when the URL contains an API key. The investor page uses it to read chain state. It is not broadcast to the browser.

`PRIVATE_KEY` is the deployer. The Sepolia owner is `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6`. The market is already deployed, so you do not need to broadcast [`script/DeploySepolia.s.sol`](script/DeploySepolia.s.sol) again. The local demo script reads this same name and funds that account on Anvil only. Use a key you control. Do not use an investor wallet as the deployer.

Public contract addresses for the frontend, copied from [deployment.md](deployment.md):

```text
NEXT_PUBLIC_POOL_MANAGER=0xE03A1074c86CFeDd5C142C4F04F1a1536e203543
NEXT_PUBLIC_HOOK_ADDRESS=0xD092CbB8De7cCa60807Ca73213f12920Afd308c0
NEXT_PUBLIC_EXECUTOR_ADDRESS=0x0E4f7a7D8bA8d629784056A04105d0a322b9768D
NEXT_PUBLIC_ORACLE_ADDRESS=0x57Cf0d5C2e4202c011cA0Fb70b2D4D77b8370D7c
NEXT_PUBLIC_TOKEN_A_ADDRESS=0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe
NEXT_PUBLIC_TOKEN_B_ADDRESS=0x73A9Aa42882931518bFDF23886f76F2580D5Ec27
```

Those are addresses, not secrets. They are included in the browser bundle.

### Arkiv

Create an access key at [Arkiv Hub](https://hub.arkiv.network/access-keys) and put it in `ARKIV_ACCESS_KEY`.

The publisher is a separate wallet. Its key goes in `ARKIV_PUBLISHER_PRIVATE_KEY`, with or without a `0x` prefix. Fund that wallet with tGLM at [the Rabdi faucet](https://hub.arkiv.network/faucet). The existing writer is `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. If you are reading the offering that is already published, you do not need to fund a new publisher.

## Wallet and World App

World App proves the human. The browser wallet proves you control an address. Connecting a wallet does not verify a human, and finishing World ID does not register the wallet. Registration is a third step: a Sepolia transaction, `registerWallet`, after the server has checked both.

For the shared-budget demo you want two addresses you control, Wallet A and Wallet B. Neither one should be the deployer, the allocation signer `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`, or the liquidity helper `0x58F03D8e2B11014d24773eB32E467c9297634008`.

Get Sepolia ETH for the wallet that will send transactions from a Sepolia faucet, for example [Alchemy’s Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia). In the browser wallet, switch to Ethereum Sepolia, chain id `11155111`. The investor page has a button for that switch.

On `/invest`:

1. Connect Wallet A and choose “Enroll and register this wallet”. World App asks you to prove you are human. That step needs the phone.
2. Sign the wallet-link message in the browser wallet. That signature proves this address, not the human by itself.
3. Confirm the `registerWallet` transaction. The page calls the wallet linked only after the receipt matches the chain.
4. Disconnect Wallet A, connect Wallet B, and choose “Continue and register this wallet”. That continues the same World ID session. Do not start a new enrollment if you want the same budget.
5. Sign again, and confirm the second registration. Both wallets then share one budget. The page does not show the allocation id.

A live World ID proof has not been completed in this project yet. The buttons are the real flow. A cancelled World App prompt does not register the wallet.

The issuer still has to set an access tier before a registered wallet can buy. That is `setTier` from the hook owner. It is not part of World ID. See [docs/issuer-runbook.md](docs/issuer-runbook.md).

## Run it

From the repository root:

```bash
cd frontend
nvm use
npm ci
```

Local market, chain id `31337`. From the repository root:

```bash
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
bash script/start_anvil_demo.sh
```

You can skip the first command. If port 8545 is quiet, `script/start_anvil_demo.sh` starts Anvil itself. It does not edit `.env` and it does not send a Sepolia transaction.

From `frontend/`:

```bash
npm run dev
```

Open `http://localhost:3000`. `/demo` is the local market. `/invest` is Sepolia. `/getting-started` is the short on-site explanation.

Read the offering, still from `frontend/`:

```bash
npm run query:offering
```

That only reads. `npm run publish:offering` writes an entity if one is missing, and prints the existing one if it is already there. The current entity should stay a single row. Do not run publish just to refresh it.

The two-wallet purchase on Anvil, from the repository root:

```bash
bash script/demo_allocation_journey.sh
```

It refuses every chain except `31337`. Wallet A buys 700 USDC, Wallet B’s 500 is rejected, Wallet B buys 200, and a second person keeps a separate cap.

Tests:

```bash
forge test
cd frontend && npm run test:world
```

More detail is in [tests.md](tests.md) and [demo.md](demo.md).
