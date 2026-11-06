# Documentation guide

This is the map for people changing the repository. [README.md](../README.md) is the entry point. The files below are the only places that should grow a full explanation of their subject.

| Subject | Authoritative file |
|---|---|
| What the product is, and where to go next | [README.md](../README.md) |
| First machine, keys, World App, and the first demo | [first-time-setup.md](../first-time-setup.md) |
| Install, environment, Anvil, Sepolia reads, Arkiv commands | [setup.md](../setup.md) |
| Test commands and what each suite covers | [tests.md](../tests.md) |
| How to demonstrate the product | [demo.md](../demo.md) |
| What the product does not do | [docs/product-scope.md](product-scope.md) |
| On-site onboarding | `/getting-started` in the frontend |
| Layers and sources of truth | [architecture.md](../architecture.md) |
| Addresses and deployment proof | [deployment.md](../deployment.md) and [docs/sepolia-deployment.md](sepolia-deployment.md) |
| Uniswap v4 | [integrations/uniswap-v4.md](../integrations/uniswap-v4.md) |
| World ID | [integrations/world-id.md](../integrations/world-id.md) |
| Arkiv | [integrations/arkiv.md](../integrations/arkiv.md) |
| Hook feedback for the Uniswap submission | [FEEDBACK.md](../FEEDBACK.md) |
| Requirement audit | [docs/PRD_COMPLIANCE_AUDIT.md](PRD_COMPLIANCE_AUDIT.md) |
| What was actually done live | [docs/LIVE_ACCEPTANCE_REPORT.md](LIVE_ACCEPTANCE_REPORT.md) |
| Decisions that were not built | [docs/ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) |
| Owner calls | [docs/issuer-runbook.md](issuer-runbook.md) |
| Spoken recording beats | [docs/demo-script.md](demo-script.md) |
| Internal notes | [docs/development.md](development.md) |
| History of the pre-event tree | [docs/continuity/README.md](continuity/README.md) |
| Prize essays | `arkiv/*.md` |

`frontend/README.md`, `frontend/SETUP_GUIDE.md`, and `full_workflow.md` are older notes. They point here. Do not add a second setup procedure to them.

## What goes where

README stays short. It links out. It does not grow a limitations section. Product boundaries go in [product-scope.md](product-scope.md). Someone setting up a machine for the first time follows [first-time-setup.md](../first-time-setup.md). [setup.md](../setup.md) stays the command and environment reference. [demo.md](../demo.md) stays the demonstration guide. The website page `/getting-started` explains the same steps for a visitor and links to `first-time-setup.md`. It must not describe a local Anvil walk as a Sepolia purchase, or a fixture as a live World ID proof.

A new feature updates the guide for its subject and adds a link from README only if a new reader needs it on the first page. A new contract or API is linked from [architecture.md](../architecture.md) and, when it changes how to run the app, from [setup.md](../setup.md). A new test file is named in [tests.md](../tests.md) when `npm run test:world` or `forge test` starts running it.

A deployment change updates [deployment.md](../deployment.md), [docs/sepolia-deployment.md](sepolia-deployment.md), and [deployments/sepolia-deployment.json](../deployments/sepolia-deployment.json) together. The JSON file is a public index. Application code does not load it.

A new integration gets a file in `integrations/` and a row in README. It does not get a second copy inside the README.

## Live, local, and mocked

Say which one a behavior is.

- Live means a real network or a real World ID proof, with the command or the transaction that showed it.
- Local means Anvil chain `31337`.
- Fixture means a unit test with stand-in data.

Do not describe a fixture as a live proof. Do not describe mock USDC or mock RWA as a production asset. Do not describe Arkiv as the purchase enforcer.

## Secrets

Document variable names. Do not write values for `PRIVATE_KEY`, `ALLOCATION_AUTH_SIGNING_KEY`, `WORLD_PRIVATE_KEY`, `WORLD_SESSION_ENCRYPTION_KEY`, `ARKIV_ACCESS_KEY`, `ARKIV_PUBLISHER_PRIVATE_KEY`, or RPC URLs. Do not add `frontend/.env`.

## Avoiding drift

One subject, one file. Other files link to it. When a sentence in an older note disagrees with the code or with a newer read of chain state, correct the sentence or mark the note as historical. Do not delete a historical note that still explains the pre-event tree or a failed deployment attempt.

## Checklist for a change

1. Update the authoritative guide for the subject you changed.
2. Keep README as navigation. Do not paste the guide into it.
3. Say whether the behavior is live, local, or a fixture.
4. Update addresses only from a record you can point at.
5. Leave secrets out.
6. Check relative links in the files you edited.
7. Run the documentation tests in `frontend/lib/arkiv/submissionDocs.test.mts` and `prizeDocs.test.mts` through `npm run test:world`.
