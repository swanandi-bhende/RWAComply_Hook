# Local development

The frontend lives in `frontend/` and uses npm. There is one lockfile: `frontend/package-lock.json`.

## Runtime

Verified toolchain:

- Node.js `22.23.4`
- npm `10.9.9`

Next.js 16 requires Node.js 20.9 or newer. This repository pins the verified versions in `frontend/.nvmrc`, `frontend/package.json` `engines`, and `packageManager`.

`.nvmrc` does not install Node. Select it yourself:

```bash
cd frontend
nvm install
nvm use
node --version
npm --version
```

`nvm install` with no arguments reads `.nvmrc`. `nvm use` selects that version in the current shell.

## Frontend

From `frontend/`:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Other checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run start
```

`npm run start` serves the production build, also on port 3000. Stop the dev server first if it is already using that port.

`npm ci` must succeed without `--force` or `--legacy-peer-deps`. Do not add another package manager or lockfile.

World ID checks:

```bash
npm run test:world
npm run verify:world-signer
```

`verify:world-signer` prints only whether `WORLD_PRIVATE_KEY` matches `WORLD_RP_SIGNER_ADDRESS`. It does not print the key or the address.

## Contracts the UI expects

The local technical demo at `/demo` reads and writes Anvil at `http://127.0.0.1:8545`, chain id `31337`. The investor pages target Ethereum Sepolia, chain id `11155111`. Start Anvil, then deploy, when using the local demo:

```bash
anvil
```

In another shell, from the repository root:

```bash
# Put PRIVATE_KEY in the repository-root .env. Do not commit .env.
bash script/run_canonical_demo.sh
```

`script/DeployFull.s.sol` reads `PRIVATE_KEY` from the environment.

The page loads contract addresses from `broadcast/DeployFull.s.sol/31337/run-latest.json`. That file is created by the deploy script and is gitignored. If that file is missing, set the public addresses in the repository-root `.env`:

- `NEXT_PUBLIC_POOL_MANAGER`
- `NEXT_PUBLIC_HOOK_ADDRESS`
- `NEXT_PUBLIC_ORACLE_ADDRESS`
- `NEXT_PUBLIC_TOKEN_A_ADDRESS`
- `NEXT_PUBLIC_TOKEN_B_ADDRESS`
- `NEXT_PUBLIC_EXECUTOR_ADDRESS`

Without a deploy or those variables, the homepage still renders. `/api/deployment-addresses` returns an error until addresses exist.

The wallet control is RainbowKit’s Connect button, configured with the injected connector on the Anvil chain. No WalletConnect project id is required for that setup.

## World ID enrollment

The only local environment file is the repository-root `.env`. Next.js starts in `frontend/` and loads that file. Do not add `frontend/.env` or `frontend/.env.local`.

Names used by the server:

- `WORLD_APP_ID`
- `WORLD_RP_ID`
- `WORLD_PRIVATE_KEY` — the managed relying-party signing key. This is the only copy of that secret.
- `WORLD_RP_SIGNER_ADDRESS` — the public signer address shown in the World Developer Portal.
- `WORLD_ID_ENVIRONMENT` — `staging` or `production`.
- `WORLD_SESSION_ENCRYPTION_KEY` — a separate 32-byte key. Generate it with `openssl rand -hex 32`. Do not reuse the signing key.
- `WORLD_ENROLLMENT_DB_PATH` — optional. A relative path is resolved from the repository root. The default file is `frontend/data/world-enrollments.sqlite`.
- `ALLOCATION_AUTH_SIGNING_KEY` — the AllocationLedger backend signer. It is separate from `WORLD_PRIVATE_KEY`.
- `ALLOCATION_AUTH_SIGNER_ADDRESS` — the public address of that key. It must equal `AllocationLedger.backendSigner`.
- `ALLOCATION_LEDGER_ADDRESS`
- `ALLOCATION_CHAIN_ID`
- `ALLOCATION_GROUP_ID` — the trusted allocation group, as `bytes32`.
- `ALLOCATION_RPC_URL` — optional. Used only to read `usedNonce`.

From `frontend/`:

```bash
npm run verify:world-signer
```

That command derives the address from `WORLD_PRIVATE_KEY` with `viem/accounts` and compares it with `WORLD_RP_SIGNER_ADDRESS`. The output is a match or a configuration error. It does not print the key or the address.

Initial enrollment:

1. The browser asks `POST /api/world/rp-context` for a short-lived signed context. The signing key stays on the server.
2. IDKit requests a new Proof of Human session (`session_id: "create"`, `allow_legacy_proofs: false`).
3. The browser sends the complete IDKit result to `POST /api/world/enroll`.
4. The server sends that body to `POST https://developer.world.org/api/v4/verify/{rp_id}` using the configured RP ID.
5. After World accepts the proof, the server creates a random `bytes32` allocation id and stores the session encrypted.

SQLite stores the enrollment. The unique key is the app, environment, action, and a SHA-256 hash of the verified nullifier. The raw nullifier and the raw session id are not stored. A duplicate proof returns HTTP 409, and the failed write is rolled back.

The session id is encrypted with AES-256-GCM. Each row stores the ciphertext, a fresh 12-byte IV, and the authentication tag. Decryption checks the tag and fails closed if the ciphertext or key is wrong.

World verifies Proof of Human. RWAComply maps that verified session to a pseudonymous allocation id. This is not KYC, AML, nationality, residency, or accreditation.

### Uniqueness proofs and session proofs

The first wallet uses `IDKit.request` with `action: "signup"`, `session_id: "create"`, and `allow_legacy_proofs: false`. That is an action-scoped uniqueness proof. It creates the session and produces a normal nullifier. The nullifier is replay-protected. It is not an allocation id.

Another wallet uses `IDKit.proveSession(existingSessionId, config)`. That request has no action. It is a World ID 4.0 session proof, not a new uniqueness proof. The result contains `session_nullifier`, which only shows that this interaction belongs to the same World ID session. It is not a permanent identity, not a uniqueness nullifier, and not an allocation id. `IDKit.createSession()` is a different operation and is not used.

A World ID session is a linkable pseudonymous identifier. Several proofs in one relying-party session can be connected to the same person. The browser keeps the session id in `sessionStorage` for the hackathon flow. The backend keeps the authoritative copy encrypted. Possession of the session id alone does not prove identity or wallet ownership.

### Continuation and wallet association

1. `POST /api/world/continue` accepts the complete session-proof result. It finds the enrollment by a hash of the session id, checks the app, RP, and environment, and sends the body to World's v4 verify endpoint.
2. A successful proof creates a one-time continuation grant. The response contains the raw token and its expiry, about five minutes. The database stores only the token hash. It does not return the allocation id.
3. `POST /api/world/wallet-challenge` accepts that token and a wallet address. The wallet signs an EIP-712 `WalletLink` challenge bound to the app, wallet, chain, AllocationLedger address, nonce, time, and the purpose "Associate this wallet with an RWAComply allocation identity".
4. `POST /api/world/wallet-authorization` recovers the signer. After the signature and the grant match the same wallet, it consumes both and returns an `AllocationLedger` registration authorization for the existing allocation id.

The registration typed data is `Registration(address wallet,bytes32 allocationId,bytes32 groupId,uint256 expiry,uint256 nonce)` in the domain `AllocationLedger` version `1`, with the configured chain id and ledger address. The nonce is a random unused `uint256`. The contract treats nonces as globally unique.

`ALLOCATION_AUTH_SIGNING_KEY` signs that authorization. It must not be `WORLD_PRIVATE_KEY`. `ALLOCATION_AUTH_SIGNER_ADDRESS` must be the address derived from it, and that address must be `AllocationLedger.backendSigner`. Requests fail closed until those values, plus `ALLOCATION_LEDGER_ADDRESS`, `ALLOCATION_CHAIN_ID`, and `ALLOCATION_GROUP_ID`, are set in the root `.env`. Optional `ALLOCATION_RPC_URL` lets the server read `usedNonce` before it issues an authorization.

The local deploy group is `keccak256("rwa-comply-demo")`, which is `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677`. The deploy script currently sets the ledger signer to the deployer. This phase does not rotate that signer.

### Onchain wallet registration

After the backend returns a registration authorization, `submitRegistration` asks the connected wallet to call `AllocationLedger.registerWallet`. It checks the wallet, chain, ledger, group, expiry, and current `allocationIdByWallet` before sending. A matching allocation is already linked and is not submitted again. A different allocation is blocked.

The helper shows "Registration pending" while the transaction is mined. "Wallet linked to your shared allocation" is shown only after the receipt succeeds, the `WalletRegistered` event matches, `allocationIdByWallet` matches, and `usedNonce` is true. A backend signature alone does not mean the wallet is registered.

`POST /api/world/registration-receipt` records that result only after the server reads the same chain state. It ignores a client `success` flag. Without `ALLOCATION_RPC_URL`, the server leaves the row at `issued` and does not mark it confirmed. The onchain read remains the authority for the connected user.

`WORLD_RP_SIGNING_KEY` is not read. The only World signing secret is `WORLD_PRIVATE_KEY`. The old name is rejected if a client sends it. It can be removed from the root `.env` by hand.

A wallet already stored for the same allocation can receive another authorization. A wallet stored for a different allocation is rejected. Wallet B does not get a new allocation id.

## Investor product

The public pages are:

- `/` explains the shared allocation, the Alice and Bob example, and the difference from CCA.
- `/invest` connects a wallet, starts World ID proof of human, continues a saved session, asks the wallet to sign, and submits `registerWallet` through the existing registration helper.
- `/how` explains identity, wallet ownership, onchain registration, and purchase enforcement as separate steps.
- `/demo` is the earlier local Anvil technical demo. It is not the Sepolia investor flow.

The investor page reads `GET /api/product/status` before it offers registration or a purchase. That route checks the allocation signer, chain id `11155111`, contract code, and the hook and executor when public market addresses are set. It does not return signing keys or the RPC URL. If the ledger has no code, the signer does not match, or the RPC is not Sepolia, the page says the data is unavailable. It does not show sample balances as if they were live.

The dashboard reads `policyByGroupPeriod`, `spentByAllocation`, and `remaining` from Ethereum Sepolia. It does not display the allocation id. Purchase history from other sessions is not listed, because this app does not index it.

A purchase button is enabled only when the executor, hook, USDC, and RWA addresses are set, have code on Sepolia, and the hook group matches the configured allocation group. The purchase is an exact-input USDC buy through `PoolExecutor.swapExactInput`. The page simulates it, waits for the receipt, and reads the allocation again. If those contracts are not deployed, the purchase section says the market is not available.

`ALLOCATION_CHAIN_ID` must be `11155111` for this flow. The wallet connector includes Ethereum Sepolia and local Anvil. Anvil remains available for `/demo`.

World ID, wallet ownership, onchain registration, and purchase enforcement are separate. A backend authorization or a database row does not mark a wallet as linked.

## Sepolia deployment preparation

The investor pages target Ethereum Sepolia, chain id `11155111`. Local Anvil deployment stays in `script/DeployFull.s.sol` and is not the Sepolia path.

`script/DeploySepolia.s.sol` uses the official Uniswap v4 PoolManager at `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`. It does not deploy a new PoolManager. The hook, ledger, executor, oracle, and mock tokens are deployed by `script/SepoliaWiring.sol`. The ledger owner is the deployment account. The ledger backend signer is `ALLOCATION_AUTH_SIGNER_ADDRESS`, not the deployer. No investor wallet is registered, and no investor access tier is set. The liquidity helper receives tier 2 only so it can seed the pool. That is not investor approval.

Proof of human does not grant an access tier. The hook owner calls `setTier` for a wallet after registration. A wallet cannot call `setTier` for itself. Tier 0 cannot buy. This is separate from KYC, AML, accreditation, and legal eligibility.

Check the deployment without sending a transaction:

```bash
forge script script/DeploySepolia.s.sol:DeploySepolia --sig "preflight()" -vv
```

Preflight reads `ALLOCATION_RPC_URL`, checks chain id `11155111`, the official PoolManager code, the CREATE2 deployer, the allocation signer, the group id, and that `PRIVATE_KEY` belongs to an account with Sepolia ETH. It prints addresses and the hook permission flags. It does not print private keys.

Broadcast is a later explicit step:

```bash
forge script script/DeploySepolia.s.sol:DeploySepolia --rpc-url "$ALLOCATION_RPC_URL" --broadcast
```

Do not run the broadcast command until the preflight succeeds and the deployment account is funded. After a real deployment, copy the logged addresses into the root `.env` as `ALLOCATION_LEDGER_ADDRESS`, `NEXT_PUBLIC_HOOK_ADDRESS`, `NEXT_PUBLIC_EXECUTOR_ADDRESS`, `NEXT_PUBLIC_TOKEN_A_ADDRESS`, and `NEXT_PUBLIC_TOKEN_B_ADDRESS`. The app still checks code, the backend signer, the group, and the policy before it shows registration or the purchase market as ready. A deployed ledger does not make the market ready. A ready market does not mean a wallet is linked or approved.

`ALLOCATION_RPC_URL` may be `http`, `https`, `ws`, or `wss`.

## Solidity

From the repository root:

```bash
forge build
forge test
```

Foundry dependencies are installed under `/lib` and are gitignored. Frontend source under `frontend/lib/` is tracked.
