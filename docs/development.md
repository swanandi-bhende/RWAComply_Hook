# Local development

Public setup, tests, and the demo are [setup.md](../setup.md), [tests.md](../tests.md), and [demo.md](../demo.md). This file is the internal note. The map of which document owns which subject is [docs/DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md).

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

## Interface

The product UI is a light fintech layout. Tokens live in `frontend/app/globals.css` under `:root`: lavender `#EFABFF`, light orchid `#EDA2F2`, rose `#DC6BAD`, muted purple `#8C7AA9`, blue `#7192BE`, and black. Small text uses darker ink, `--color-text-secondary` and `--color-blue-ink`, because the pale palette colors do not meet WCAG AA on white.

Base color and type sit in `@layer base`. Component classes (`.page`, `.panel`, `.btn`, `.nav-link`, `.pill`, `.step`, `.notice`, `.field`) are unlayered so they stay consistent. Product pages should use those classes. Do not add a new page-specific stylesheet for a color or spacing change.

The page does not follow the operating system's dark color scheme. An earlier unlayered `body` background, set to near-black in dark mode, covered `/invest` even though no dialog was open. RainbowKit's connect dialog and backdrop are portaled onto `document.body` only while that dialog is open, then removed. Do not leave a fixed scrim in the page tree.

Breakpoints are 1100px, 980px, and 760px. Below 1100px the header links move into a Menu button so a tablet does not clip them. Escape closes it. The content width is 1120px with a 20px gutter, 14px on a narrow screen.

The local demo at `/demo` still contains older utility-class markup. Rules scoped to `.demo` map those utilities onto the same surfaces. New product UI should not rely on that block.

`npm ci` must succeed without `--force` or `--legacy-peer-deps`. Do not add another package manager or lockfile.

World ID checks:

```bash
npm run test:world
npm run verify:world-signer
```

`verify:world-signer` prints only whether `WORLD_PRIVATE_KEY` matches `WORLD_RP_SIGNER_ADDRESS`. It does not print the key or the address.

## Contracts the UI expects

The local technical demo at `/demo` reads and writes Anvil at `http://127.0.0.1:8545`, chain id `31337`. The investor pages target Ethereum Sepolia, chain id `11155111`. From the repository root:

```bash
bash script/start_anvil_demo.sh
```

That command starts Anvil when port 8545 is not already serving chain `31337`, funds the deployer on that local node, and broadcasts `script/DeployFull.s.sol` only to Anvil. It does not edit `.env` and it does not send a Sepolia transaction. `PRIVATE_KEY` stays in the repository-root `.env`.

The page loads addresses from `broadcast/DeployFull.s.sol/31337/run-latest.json`. That file is gitignored local Anvil state. `/api/deployment-addresses` returns those addresses with `chainId: 31337`. It does not read `NEXT_PUBLIC_*` values, so a Sepolia PoolManager address in `.env` cannot fill the Anvil form. The Swap Demo then reads bytecode on chain `31337` and shows the purchase form only after the hook, executor, tokens, oracle, and PoolManager have code. A connected wallet on another chain sees a switch control, and the purchase button does not send.

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

The investor page action “Verify with World App” requests a relying-party context, runs IDKit, and posts the result to `/api/world/enroll`. A cancelled or failed widget stops there. The wallet is not authorized and `registerWallet` is not called. After a verified enrollment, the same action asks the wallet to sign, posts that signature to `/api/world/wallet-authorization`, and submits `registerWallet`. The wallet is shown as registered only after the chain receipt matches. The separate “Link this wallet” action remains for a later wallet on an existing session.

The local Anvil swap demo treats the typed value as a six-decimal USDC amount. It approves that amount to the `PoolExecutor` and calls `swapExactInput` with the same amount. It does not approve the PoolManager. If the router’s USDC address cannot be read, the purchase is not sent.

The purchase panel shows Approving, Registering, Swapping, Success, and Hook rejection. `RetailLimitExceeded`, `AllocationExceeded`, and `CapExceeded`, including those selectors inside a Uniswap wrapped revert, are shown as “This purchase exceeds your remaining allocation.” An unregistered wallet is shown as “Verify with World ID before purchasing.” A paused pool is shown as “This offering is currently paused.” `ExactInputRequired` is “This offering supports exact-input purchases only.” `UnsupportedInputCurrency` is “This pool does not use the supported quote token.” `UntrustedRouter` is “This trading route is not supported.” A mined receipt with status `reverted` is “The transaction failed. Your allocation was not used.” It is not shown as success, and it does not increase recorded spend. There is no policy-expiry message, because the ledger has no end time. Registering does not send a purchase.

`/invest` has a Second wallet section. Disconnect the current wallet, connect the next one, and use “Continue and register this wallet.” That path calls `/api/world/continue`, then the existing wallet signature and `registerWallet`. It does not start a new enrollment and it does not show the allocation id. After registration, the page reads `remaining` for the connected wallet. A cancelled continuation does not authorize or register the wallet. This live World ID continuation still needs a real World ID session and a deployed Sepolia ledger.

A local Anvil purchase of 2 USDC through the executor reduced the deployer USDC balance by 2 USDC and increased recorded spend by 2 USDC. The approval spender was the executor. The PoolManager allowance stayed 0. A later 1,000 USDC purchase reverted with `AllocationExceeded` and left the recorded spend unchanged. Those transactions were on chain `31337` only.

The local shared-budget walk is `bash script/demo_allocation_journey.sh`. It refuses every chain except Anvil `31337`. It registers two wallets for one person and one wallet for another person, then buys 700 USDC, rejects 500 USDC, and buys 200 USDC. The page then reads 100 USDC remaining for the first person and 1,000 USDC remaining for the second. The allocation id is not shown. Run it only against the local Anvil deployment. A repeated run skips the buys when the shared spend is already 900 USDC.

On that same Anvil market, the Swap Demo was driven in a browser. The connected wallet for the first person showed “Shared remaining 100 USDC”. The second person showed “1000 USDC”. An unregistered wallet click showed the shorter sentence “This wallet is not registered.” and router state Registering, without sending a purchase. The current sentence is “Verify with World ID before purchasing.” A registered purchase passed through Approving, Swapping, and Success. With the pool paused, the same action showed “The pool is paused.” A 1,500 USDC purchase above the remaining budget showed “Hook rejection” and “remaining budget is not enough.” The recorded spend did not increase. The approval spender was the PoolExecutor. These are Anvil transactions, not Sepolia.

The demo and admin screens that this phase touches say Proof of Human, or retail access, and that the purchase cap is enforced on the supported purchase route. They do not call that check KYC or AML. The product pages keep the separate statement that proof of human is not KYC, AML, accreditation, residency, or nationality.

## Sepolia deployment preparation

The investor pages target Ethereum Sepolia, chain id `11155111`. Local Anvil deployment stays in `script/DeployFull.s.sol` and is not the Sepolia path.

`script/DeploySepolia.s.sol` uses the official Uniswap v4 PoolManager at `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`. It does not deploy a new PoolManager. The script deploys the oracle, hook, mock USDC, mock RWA, ledger, executor, and liquidity helper from the deployer account. `script/SepoliaWiring.sol` remains the local test path. Its bytecode is larger than the 24,576-byte contract limit, so it is not deployed on Sepolia. The ledger owner is the deployment account. The ledger backend signer is `ALLOCATION_AUTH_SIGNER_ADDRESS`, not the deployer. No investor wallet is registered, and no investor access tier is set. The liquidity helper receives tier 2 only so it can seed the pool. That is not investor approval.

The first broadcast reverted. Transaction `0x2285cdd075944609f38007b652a0adcf4ce71b8ceed4e57f8c8272f06a393539` created `MockRWAOracle` in block `12075637` and used its entire 342,737 gas limit. No contract code was stored. The deployer nonce is now 1. Sepolia’s Glamsterdam rules (EIP-8037) charge 1,530 gas per byte of new code, while Foundry 1.5.1 still estimates 200 gas per byte. Solidity cannot set a gas limit on `new`, so the retry uses `--gas-estimate-multiplier 800` for creations and explicit gas on the configuration calls. The 800 percent multiplier is the old estimate times about 6.3, plus margin. A corrected simulation, with no broadcast, put every creation limit above the live `eth_estimateGas` result. The broadcast also caps the max fee at 0.5 gwei so the full gas budget stays inside the deployer balance.

Proof of human does not grant an access tier. The hook owner calls `setTier` for a wallet after registration. A wallet cannot call `setTier` for itself. Tier 0 cannot buy. This is separate from KYC, AML, accreditation, and legal eligibility.

Check the deployment without sending a transaction:

```bash
forge script script/DeploySepolia.s.sol:DeploySepolia --sig "preflight()" -vv
```

Preflight reads `ALLOCATION_RPC_URL`, checks chain id `11155111`, the official PoolManager code, the CREATE2 deployer, the allocation signer, the group id, and that `PRIVATE_KEY` belongs to an account with Sepolia ETH. It prints addresses and the hook permission flags. It does not print private keys.

Broadcast is a later explicit step:

```bash
forge script script/DeploySepolia.s.sol:DeploySepolia --sig "run()" --rpc-url "$ALLOCATION_RPC_URL" --gas-estimate-multiplier 800 --with-gas-price 500000000 --broadcast --slow
```

The corrected deployment was broadcast to Ethereum Sepolia and independently verified. The addresses, transaction hashes, gas, and fees are in `docs/sepolia-deployment.md`. Those verified addresses are in the root `.env`. The app still checks code, the backend signer, the group, and the policy before it shows registration or the purchase market as ready. A deployed ledger does not make the market ready. A ready market does not mean a wallet is linked or approved. No investor was registered, no investor tier was set, and no investor purchase was sent. A real World ID session is still required for live enrollment.

The local Anvil loader reads the ledger, router, and USDC from the Anvil deploy log. It fails with an explicit error when any of those addresses is missing. It does not use the Sepolia environment addresses as Anvil addresses.

## Arkiv

Rabdi is chain id `7794095`. The server reads `ARKIV_ACCESS_KEY` from the repository-root `.env` and connects with `rabdi({ accessKey })` from `@arkiv-network/sdk@1.0.1`. The key is not put in a frontend bundle, an API response, or a log. An empty key is rejected, and the client refuses to construct in the browser. A key that is already loaded is left in place. The client does not reload the frontend directory over it.

Create the access key at https://hub.arkiv.network/access-keys and fund the publisher with tGLM at https://hub.arkiv.network/faucet. Both steps need a wallet signature and the Hub captcha. Put `ARKIV_ACCESS_KEY` and `ARKIV_PUBLISHER_PRIVATE_KEY` only in the repository-root `.env`. The publisher key may be 32 bytes of hex with or without a `0x` prefix. The configured publisher is `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. A read-only Rabdi call returned chain id `7794095`, and that wallet held 10 tGLM before the write.

The public offering is one Arkiv entity, schema `rwacomply-offering`. Its indexed fields are `projectTag` (`rwacomply`), `offeringId` (`sepolia-demo-rwa`), `rwaSymbol` (`RWA`), `usdcAddress`, `rwaAddress`, `poolId`, and `expiresAt`. The owner is the publisher wallet. The entity lifetime is 90 days through `ExpirationTime.fromDays(90)`, and `expiresAt` stores that same lifetime as unix time `1801744500`. Rabdi also records `$expiresAt` as block `4179369`, which is 90 days at the 2 second block time. The record does not store the purchase cap or the amount spent. Those stay on the Ethereum Sepolia `AllocationLedger`. The tokens are the deployed mock USDC and mock RWA on the demo pool, not real-world assets.

The published entity is `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`. The query that returns it is:

```text
projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')
```

From `frontend/`, `npm run publish:offering` prints the entity key, the writer address, and that query. If that one current offering already exists, the script prints it and does not create another. If the match is stale, or more than one match exists, it stops without writing. It also stops when the publisher has no tGLM. The field list, owner, expiry, and query filters are in `arkiv/schema.md`. The setup problems are in `arkiv/friction.md`. Who the directory is for, why the row is on Arkiv, and how the filters show up on `/invest` are in `arkiv/reach.md`, `arkiv/why-arkiv.md`, and `arkiv/how-you-use-arkiv.md`.

From `frontend/`, `npm run query:offering` reads that query and prints the entity key, the writer, and the query. It does not create an entity.

`/api/offerings` runs that query and, in the same response, reads the ledger cap and period. The remaining budget is read only when the request includes a valid wallet. An unregistered wallet leaves that field empty and does not clear the cap or period. `/invest` lists the result. A successful empty query is `missing`. A failed query or a stopped client is `unavailable`. An expired record is `expired`. A record whose USDC, RWA, or pool id differs from the deployment is `mismatch`. A current matching record is `ready`. In every case the cap and period come from Ethereum. The purchase button calls `PoolExecutor.swapExactInput` and does not query Arkiv.

To show that separation, start the server with `ARKIV_CLIENT_STOPPED=1`. Do not put that switch in the frontend. The directory then says the Arkiv client is stopped and still shows the chain policy. Leave the switch unset for the live directory. The offering unit tests use a fixture key and do not contact Rabdi. The live read-back above was made against Rabdi after the create.

`ALLOCATION_RPC_URL` may be `http`, `https`, `ws`, or `wss`.

## Solidity

From the repository root:

```bash
forge build
forge test
```

Foundry dependencies are installed under `/lib` and are gitignored. Frontend source under `frontend/lib/` is tracked.

The submission README separates the pre-event hook from the allocation work, states the identity boundary, and lists the local run in order. Uniswap notes for `beforeSwap`, `afterSwap`, and the router are in `FEEDBACK.md`.
