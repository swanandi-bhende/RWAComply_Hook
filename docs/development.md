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

Wallet reads and writes use Anvil at `http://127.0.0.1:8545`, chain id `31337`. Start the chain, then deploy:

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

Not in this step: signup UI, wallet connection, continuing an existing session, associating another wallet, EIP-712 authorization, and onchain registration.

## Solidity

From the repository root:

```bash
forge build
forge test
```

Foundry dependencies are installed under `/lib` and are gitignored. Frontend source under `frontend/lib/` is tracked.
