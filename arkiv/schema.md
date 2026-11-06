# Offering schema

Schema name: `rwacomply-offering`

The entity describes the public mock USDC and mock RWA demo pool on Ethereum Sepolia. It is not a real-world asset. The owner is the publisher wallet `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`.

Published entity: `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`

## Fields

| Field | Indexed | Value |
|---|---|---|
| `projectTag` | yes | `rwacomply` |
| `offeringId` | yes | `sepolia-demo-rwa` |
| `rwaSymbol` | yes | `RWA` |
| `usdcAddress` | yes | `0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe` |
| `rwaAddress` | yes | `0x73A9Aa42882931518bFDF23886f76F2580D5Ec27` |
| `poolId` | yes | `0x45fa53491f19ed13a7b274ac5c3f2f6c670d699125f2ffeaedf7a94600d7a7f7` |
| `expiresAt` | yes | `1801744500` |

`rwaAddress` is stored so the directory can compare the deployed USDC and RWA pair. The pool id is the Uniswap v4 id of that pair, fee `0x800000`, tick spacing 60, and the deployed hook. Sepolia block 12076181 contains the matching `Initialize` log.

The query filters on `projectTag` and `offeringId`:

```text
projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')
```

## Expiry

The create uses `ExpirationTime.fromDays(90)`. The indexed `expiresAt` is the same 90 days as a unix timestamp, `1801744500`. Rabdi stores the entity lifetime separately as `$expiresAt` block `4179369`. At the 2 second block time read back after publication, that block is also 90 days ahead. The record does not store the allocation cap, the amount spent, or the remaining budget.

## Owner

The writer and `$owner` are the publisher wallet derived from `ARKIV_PUBLISHER_PRIVATE_KEY`. That wallet is not the Ethereum deployer, the allocation signer, or the World ID signer. A second run of the publish script reads this entity and does not create another one.
