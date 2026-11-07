# Setup

Investors use Part A of [first-time-setup.md](first-time-setup.md) and do not need this file. Developers running the repository use Part B of that file, then the commands here. This file is the command and environment reference.

One environment file, at the repository root: `.env`. Do not create `frontend/.env` or `frontend/.env.local`. The Next.js app starts in `frontend/` and loads the root file. Foundry scripts read the same file.

Names below are names only. Do not commit values.

## Prerequisites

| Tool | What this repo uses |
|---|---|
| Git | Clone |
| Node.js `22.23.4` and npm `10.9.9` | `frontend/package.json` `engines` and `frontend/.nvmrc` |
| Foundry `forge`, `anvil`, and `cast` | Solidity `0.8.26` in `foundry.toml`. This machine used Forge 1.5.1-stable |
| A browser wallet | `/invest` and `/demo` |
| World App | Only for a live proof. Fixture tests do not need it |

There is no root `package.json`. Install dependencies in `frontend/` only. Forge libraries are already under `lib/`.

## Clone and install

```bash
git clone <this repository>
cd RWAComply_Hook
cd frontend
nvm use
npm ci
```

`nvm use` reads `frontend/.nvmrc`. It does not install Node by itself.

## Environment

Put `.env` in the repository root. Four identities stay distinct:

| Identity | Secret name | Public name | Role |
|---|---|---|---|
| Deployment account | `PRIVATE_KEY` | the address it derives | Deploys contracts. Owns the ledger and the hook. Not an investor |
| Allocation signer | `ALLOCATION_AUTH_SIGNING_KEY` | `ALLOCATION_AUTH_SIGNER_ADDRESS` | Signs `registerWallet`. Must equal `AllocationLedger.backendSigner` |
| World ID signer | `WORLD_PRIVATE_KEY` | `WORLD_RP_SIGNER_ADDRESS` | Signs relying-party context. Must not be the allocation key |
| Arkiv publisher | `ARKIV_PUBLISHER_PRIVATE_KEY` | the address it derives | Writes the offering entity. Not an investor and not the allocation signer |

Check the World signer from `frontend/` without printing it:

```bash
npm run verify:world-signer
```

The allocation server refuses to start signing when `ALLOCATION_AUTH_SIGNING_KEY` does not derive `ALLOCATION_AUTH_SIGNER_ADDRESS`.

### Ethereum

| Name | Required for | Secret |
|---|---|---|
| `PRIVATE_KEY` | Anvil deploy and the Sepolia script | Yes |
| `ALLOCATION_RPC_URL` | Sepolia reads. Optional for issuing a registration if the used-nonce check is skipped | Yes, when it embeds a provider key |
| `ALLOCATION_CHAIN_ID` | Must be `11155111` for the investor flow | No |
| `ALLOCATION_LEDGER_ADDRESS` | Investor registration and budget reads | No |
| `ALLOCATION_GROUP_ID` | The shared group, as `bytes32` | No |
| `NEXT_PUBLIC_HOOK_ADDRESS` | Demo and investor market | No |
| `NEXT_PUBLIC_EXECUTOR_ADDRESS` | The trusted purchase route | No |
| `NEXT_PUBLIC_ORACLE_ADDRESS` | Oracle display | No |
| `NEXT_PUBLIC_POOL_MANAGER` | PoolManager display | No |
| `NEXT_PUBLIC_TOKEN_A_ADDRESS` | Mock USDC | No |
| `NEXT_PUBLIC_TOKEN_B_ADDRESS` | Mock RWA | No |

`NEXT_PUBLIC_*` values are compiled into the browser bundle. Use addresses only.

### Allocation authorization

`ALLOCATION_AUTH_SIGNING_KEY` and `ALLOCATION_AUTH_SIGNER_ADDRESS`, plus the chain, ledger, and group above. The signing key is a secret. The address is public.

### World ID

| Name | Notes |
|---|---|
| `WORLD_APP_ID` | Public app id |
| `WORLD_RP_ID` | Public relying-party id |
| `WORLD_PRIVATE_KEY` | Secret. The only World signing key the server reads |
| `WORLD_RP_SIGNER_ADDRESS` | Public signer shown in the World Developer Portal |
| `WORLD_ID_ENVIRONMENT` | `staging`, `sandbox`, or `production`. This deployment uses `sandbox` |
| `WORLD_SESSION_ENCRYPTION_KEY` | Secret. 32 bytes from `openssl rand -hex 32`. Do not reuse the signing key |
| `WORLD_ENROLLMENT_DB_PATH` | Optional. Relative paths resolve from the repository root. The default file is `frontend/data/world-enrollments.sqlite` |

`WORLD_RP_SIGNING_KEY` is not read. The server rejects that old name.

### Arkiv

| Name | Secret |
|---|---|
| `ARKIV_ACCESS_KEY` | Yes. Create it at [Arkiv Hub access keys](https://hub.arkiv.network/access-keys) |
| `ARKIV_PUBLISHER_PRIVATE_KEY` | Yes. 32 bytes of hex, with or without `0x` |

`ARKIV_CLIENT_STOPPED=1` in the process environment, not in `.env`, makes the directory report unavailable. It is a test switch.

## Local Anvil

Chain id `31337`. From the repository root, in this order:

```bash
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
bash script/start_anvil_demo.sh
```

The first command is optional. If nothing is listening on `127.0.0.1:8545`, `script/start_anvil_demo.sh` starts Anvil itself. It funds the deployer on that node only and broadcasts [`script/DeployFull.s.sol`](script/DeployFull.s.sol). It does not edit `.env` and it does not send a Sepolia transaction. The root `.env` may contain a Sepolia RPC. The script forces the local URL for the broadcast.

Local addresses are in `broadcast/DeployFull.s.sol/31337/run-latest.json`. They are not the Sepolia addresses.

Then, from `frontend/`:

```bash
npm run dev
```

Open `http://localhost:3000`. `/demo` is the Anvil market. `/invest` is the Sepolia investor page. The same process is the API. The local two-wallet purchase is the last command in this guide. It does not need Arkiv.

## Sepolia reads

Chain id `11155111`. Contract addresses are in [deployment.md](deployment.md). Confirm code and wiring with read-only `cast` calls. Do not broadcast [`script/DeploySepolia.s.sol`](script/DeploySepolia.s.sol) again. That script sends transactions. The market is already deployed. Its tokens are mock USDC and mock RWA.

`GET /api/product/status` reports whether the signer, chain, and contract code are ready. It does not return keys or the RPC URL. If the data is missing, the page says so. It does not substitute sample balances.

## Arkiv

Network: Rabdi, chain id `7794095`. Fund the publisher with tGLM at [the Hub faucet](https://hub.arkiv.network/faucet). From `frontend/`:

```bash
npm run query:offering
```

That is a read. It prints the entity key, the writer, and the query. It throws unless exactly one offering matches.

```bash
npm run publish:offering
```

That writes only when the current offering is absent. If the offering is already on Rabdi, it prints the existing entity and does not create another. Do not run it to “refresh” a record that is already there.

The local purchase, from the repository root, after Anvil is up:

```bash
bash script/demo_allocation_journey.sh
```

It refuses every chain except `31337`.
