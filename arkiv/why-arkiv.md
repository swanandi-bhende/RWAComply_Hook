# Why Arkiv

## If this data stayed in the current database, what would users lose?

Before this directory, the offering list lived in the app. A reviewer could not check it except by trusting the page. On Arkiv the same row has a wallet owner, an expiry, and a query that does not go through the app:

```text
projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')
```

That query returns entity `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`, owned by `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`. Another app can run it against Rabdi, chain id `7794095`. A row in Postgres, or a constant in the frontend, would not give them that owner or that expiry, and it would disappear when this app is offline.

## What was kept off Arkiv, and why?

Spend accounting stays on the Ethereum Sepolia `AllocationLedger` because Arkiv cannot reject a swap. The cap, the period, the amount already spent, and the remaining budget are read from that contract. A purchase calls `PoolExecutor.swapExactInput`. It does not read or write Arkiv.

The entity also does not store World ID sessions, allocation identities, or wallet-to-human mappings. An Arkiv record is public. Those values are not public offering metadata, and a directory row is not proof of human identity.

When the directory is missing, expired, mismatched, or unavailable, `/invest` still shows the chain cap and period. The purchase button stays under the contract checks.
