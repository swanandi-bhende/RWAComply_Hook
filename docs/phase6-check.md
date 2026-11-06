# Phase 6 checks

These commands were run on 6 November 2026, on branch `v2`, after Steps 6.5–6.8. The phase is not marked complete from the UI.

| Command | Result |
|---|---|
| `forge test` | 114 passed, 0 failed, 0 skipped. 8 suites. |
| `npm run test:world` | 83 passed, 0 failed. |
| `npx tsc --noEmit` | Passed. |
| `npm run lint` | Passed. |
| `npm run build` | Passed. Routes include `/`, `/invest`, `/how`, `/demo`, and the World, product, and offerings APIs. |
| `git diff --check` | Clean. |

`GET http://localhost:3459/invest` returned HTTP 200. That only shows the server is up. It is not a purchase or a World ID verification.

A read of Ethereum Sepolia, chain id `11155111`, found code at the hook (`8904` bytes) and the allocation ledger (`6428` bytes). Group `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677`, period `1`, cap `1000000000`, USDC `0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe`. No transaction was sent.

`npm run query:offering` read the existing Rabdi entity `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`, writer `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. It did not create or update an entity.

## Step 6.10

No commit was created. The user has not asked for one. Commit `1629f37` (2026-03-20) remains the boundary between the pre-event tree and the later `v2` history.
