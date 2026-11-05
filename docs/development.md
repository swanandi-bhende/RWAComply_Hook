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

## Contracts the UI expects

Wallet reads and writes use Anvil at `http://127.0.0.1:8545`, chain id `31337`. Start the chain, then deploy:

```bash
anvil
```

In another shell, from the repository root:

```bash
cp .env.example .env
# Set PRIVATE_KEY in .env. Do not commit .env.
bash script/run_canonical_demo.sh
```

`script/DeployFull.s.sol` reads `PRIVATE_KEY` from the environment. The root `.env.example` has placeholder names only.

The page loads contract addresses from `broadcast/DeployFull.s.sol/31337/run-latest.json`. That file is created by the deploy script and is gitignored. If that file is missing, set the public addresses in `frontend/.env.local` using the names in `frontend/.env.example`:

- `NEXT_PUBLIC_POOL_MANAGER`
- `NEXT_PUBLIC_HOOK_ADDRESS`
- `NEXT_PUBLIC_ORACLE_ADDRESS`
- `NEXT_PUBLIC_TOKEN_A_ADDRESS`
- `NEXT_PUBLIC_TOKEN_B_ADDRESS`
- `NEXT_PUBLIC_EXECUTOR_ADDRESS`

Without a deploy or those variables, the homepage still renders. `/api/deployment-addresses` returns an error until addresses exist.

The wallet control is RainbowKit’s Connect button, configured with the injected connector on the Anvil chain. No WalletConnect project id is required for that setup.

## Solidity

From the repository root:

```bash
forge build
forge test
```

Foundry dependencies are installed under `/lib` and are gitignored. Frontend source under `frontend/lib/` is tracked.
