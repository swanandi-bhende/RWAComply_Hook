# Arkiv

Arkiv holds the public offering so the directory is not a private database. It does not hold the cap, the spend, or the remainder. A successful write does not reject a swap. Ethereum does.

Network: Rabdi, chain id `7794095`. The server client is [`frontend/lib/arkiv/client.ts`](../frontend/lib/arkiv/client.ts). It refuses to construct in the browser. `ARKIV_ACCESS_KEY` stays on the server. The publisher key is separate and is not an investor key.

| Field | Indexed | Value on the live entity |
|---|---|---|
| `projectTag` | yes | `rwacomply` |
| `offeringId` | yes | `sepolia-demo-rwa` |
| `rwaSymbol` | yes | `RWA` |
| `usdcAddress` | yes | the Sepolia mock USDC |
| `rwaAddress` | yes | the Sepolia mock RWA |
| `poolId` | yes | `0x45fa53491f19ed13a7b274ac5c3f2f6c670d699125f2ffeaedf7a94600d7a7f7` |
| `expiresAt` | yes | unix `1801744500` |

Schema name: `rwacomply-offering`. Writer: `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. Entity: `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`.

Query:

```text
projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')
```

The publisher lifetime is 90 days through `ExpirationTime.fromDays(90)`. Rabdi also stores that lifetime as an expiry block. The field list and the reasons those fields were chosen are in [arkiv/schema.md](../arkiv/schema.md).

From `frontend/`:

```bash
npm run query:offering
npm run publish:offering
```

`query:offering` reads. `publish:offering` creates an entity only when the current one is missing. A second run prints the same entity.

[`frontend/app/api/offerings/route.ts`](../frontend/app/api/offerings/route.ts) returns the directory status: `ready`, `missing`, `expired`, `mismatch`, or `unavailable`. Mismatch means the USDC, RWA, or pool id differs from the deployed market. Several matches do not pick the first row. The page copy is on `/invest`. The purchase button does not call this route.

Tests: `frontend/lib/arkiv/client.test.mts`, `offering.test.mts`, `purchaseBoundary.test.mts`. Prize notes: [arkiv/why-arkiv.md](../arkiv/why-arkiv.md), [arkiv/how-you-use-arkiv.md](../arkiv/how-you-use-arkiv.md), [arkiv/reach.md](../arkiv/reach.md), [arkiv/friction.md](../arkiv/friction.md).
