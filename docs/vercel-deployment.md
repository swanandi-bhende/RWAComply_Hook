# Deploy RWAComply on Vercel

This guide is for a manual deployment. Nothing in the repository logs into Vercel, creates a project, or pushes the branch.

Status of this tree: the site can be deployed. It is not fully operational. World ID staging can create a connector request only after the portal and server variables match the final domain, and verification sessions cannot be stored until a persistent database is added. The guided demo remains a local Anvil presentation.

## What is local-only

These features assume a machine that stays running. They are not available on a Vercel function.

| Assumption | Where | Hosted behavior |
|---|---|---|
| Anvil at `127.0.0.1:8545`, chain `31337`, unlocked accounts, `evm_snapshot` / `evm_revert` | `frontend/lib/demo/sandboxChain.ts` | `/demo` on any other host says the hosted demo chain is not configured. `POST /api/demo/sandbox` stays disabled. The page does not invent hashes or balances |
| Shared snapshot reset | Same local route | Not exposed publicly. One visitor’s reset would erase another visitor’s history, so a shared public reset is not acceptable |
| SQLite file `frontend/data/world-enrollments.sqlite` | `frontend/lib/world/enrollmentStore.ts` | When `VERCEL=1`, identity routes return `Identity storage is not configured` and do not open the file. Marketing pages still render |
| Repository-root `.env` | `frontend/lib/world/loadRootEnv.ts` and `frontend/next.config.ts` | A missing file is ignored. Vercel-injected variables are used. Server secrets are not copied into `NEXT_PUBLIC_*` |
| Broadcast JSON and `docs/demo_run_log.txt` | `GET /api/deployment-addresses` | Returned only for localhost. A public host gets a short “local demonstration” response |
| RainbowKit Anvil transport | `frontend/app/providers.tsx` | Omitted from the client bundle when `VERCEL=1` |
| `RWA_DEMO_IDENTITY=local` | `frontend/lib/world/demoMode.ts` | Ignored unless the host is localhost, `127.0.0.1`, or `::1` |
| Preview port `3463` | Local `next start` only | Not part of the Vercel project |

API routes that use viem, SQLite, or Node cryptography set `export const runtime = 'nodejs'`. None of them use the Edge runtime. `npm run build` does not start Anvil and does not run a shell script.

A successful `next build` does not prove that World ID, the ledger, or the demo chain works on the deployed domain.

## Hosted demo

A Vercel function cannot keep an Anvil process. A safe public demo needs a separate persistent chain, one isolated state per visitor, and a dedicated signer that is not `WORLD_PRIVATE_KEY`, `ALLOCATION_AUTH_SIGNING_KEY`, the Sepolia deployer, or a personal wallet. Local contract addresses must not be reused.

`evm_snapshot` and `evm_revert` are safe for one presenter on one machine. They are not safe for concurrent public visitors, because a reset removes the shared history. This repository does not expose that reset on a public host, and it does not pretend a remote chain exists.

Until that chain exists, the public `/demo` page explains that the guided demo is for a live presentation and links to [How it works](/how) and [Invest](/invest).

## Database

World ID enrollments, encrypted sessions, hashed resume cookies, wallet challenges, nonces, and registration receipts are written to SQLite. That file does not survive a Vercel deployment or another function instance.

The recommended store is PostgreSQL, for example Neon or Vercel Postgres. Both have a free tier and a paid tier; do not create an account as part of this repository change. No `DATABASE_URL` adapter is connected. Identity routes fail with a named configuration error instead of reporting a successful verification. Homepage, offerings, how it works, and the issuer explanation still render.

## RPC

Sepolia reads use HTTP. `frontend/lib/product/rpc.ts` rewrites a `wss://` or `ws://` URL before `viem`’s HTTP transport uses it. The expected chain id is `11155111`. An RPC failure is returned as a ledger or transport error. It is not described as a rejected wallet signature. The target chain stays Sepolia.

## A. GitHub

Confirm the branch is `v2`. Push it yourself when you want Vercel to import it. This guide does not push.

## B. Create the Vercel project

1. Sign in to Vercel and import the GitHub repository.
2. Select branch `v2`.
3. Set Root Directory to `frontend`.
4. Framework preset: Next.js.
5. Install command: `npm ci`.
6. Build command: `npm run build`.
7. Output Directory: turn the override off, or leave the field empty. Do not type `Default`, `.next`, or `frontend`. `frontend/vercel.json` sets `outputDirectory` to `null` so a saved value of `Default` is not used. Next.js publishes `.next` on its own.
8. Node.js: the app is developed on Node `22.23.4` because it uses `node:sqlite` locally. If Vercel rejects that exact patch, set the project Node.js version to 22.x.
9. Do not set a custom function max duration. The routes are ordinary reads and one signature, not long jobs.
10. Do not add a hardcoded production domain in the repository.

## C. Environment variables

Use the names in [vercel-environment-variables.md](vercel-environment-variables.md).

- Public configuration: the six `NEXT_PUBLIC_*` addresses. You already have them from the Sepolia deployment record.
- World ID secrets: `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_PRIVATE_KEY`, `WORLD_RP_SIGNER_ADDRESS`, `WORLD_ID_ENVIRONMENT=sandbox`, `WORLD_SESSION_ENCRYPTION_KEY`. Copy the existing values. Do not invent production ids.
- Allocation signing: `ALLOCATION_AUTH_SIGNING_KEY` and `ALLOCATION_AUTH_SIGNER_ADDRESS`. Copy the existing pair.
- RPC: `ALLOCATION_RPC_URL`, `ALLOCATION_CHAIN_ID=11155111`, `ALLOCATION_LEDGER_ADDRESS`, `ALLOCATION_GROUP_ID`.
- Database: none yet. Do not set `WORLD_ENROLLMENT_DB_PATH`.
- Hosted demo: leave `DEMO_ANVIL_RPC_URL` and `DEMO_SIGNER_PRIVATE_KEY` unset. Do not set `RWA_DEMO_IDENTITY`.
- Omit `PRIVATE_KEY`, `ARKIV_PUBLISHER_PRIVATE_KEY`, and `ARKIV_CLIENT_STOPPED`. `ARKIV_ACCESS_KEY` is optional and server-only.

## D. First deployment

The marketing pages do not need the public contract addresses. Deploy those pages first if you want a URL before the World ID portal is updated.

Add the public addresses, RPC settings, World ID staging values, and allocation signer before expecting `/invest` or `/offerings` to talk to Sepolia. Identity storage still fails closed until PostgreSQL is implemented. That failure must stay visible. It must not be treated as a successful proof.

## E. World ID portal after the URL exists

The current mode is staging. Keep it until a production application id exists and a genuine credential has been tested on the deployed origin.

After the first deployment:

1. Copy the Vercel URL, including `https://`.
2. In the World Developer Portal, open the same staging app whose id is `WORLD_APP_ID`.
3. Add that exact origin as an allowed URL for the relying party. Do not leave the connector pointed at localhost.
4. Confirm the RP id matches `WORLD_RP_ID`.
5. Redeploy if the portal required a different `WORLD_RP_ID`.
6. Open `/invest`, start verification, and confirm the QR uses `sandbox.world.org` for the Sandbox app, or `world.org` only for a production app.
7. A successful proof still requires a genuine Orb-verified World ID. This repository has not completed that proof on a deployed domain.

Cookies are `HttpOnly` and `SameSite=Lax`. `Secure` is added when `x-forwarded-proto` is `https`. The cookie has no `Domain` attribute, so the host that set it is the only host that receives it.

## F. After deployment

- `/` loads and the navigation reaches offerings, invest, issuer, how, and demo.
- Offerings render the recorded Sepolia market or a clear configuration error. They do not invent a second offering.
- `/invest` explains World App proof of human. It does not offer a demo identity.
- The connector request is signed by the server. A missing variable is named in the error and the value is not returned.
- With no persistent database, `/api/world/identity` returns `Identity storage is not configured`. The invest page shows that text. It does not say the person is verified.
- Response cookies on `https` include `Secure`, `HttpOnly`, and `SameSite=Lax`.
- The browser makes no request to `127.0.0.1:8545`.
- `/demo` says the hosted demo chain is not configured. Buy and Reset are absent.
- `/issuer` still says the Sepolia marketplace registry is not deployed.

## G. Custom domain later

Add the domain in Vercel, then add the same `https` origin in the World Developer Portal before asking anyone to verify on it. The cookie is host-only, so a session started on the `vercel.app` host is not sent to the custom domain. Update the portal RP origin and start a new verification after the domain changes.
