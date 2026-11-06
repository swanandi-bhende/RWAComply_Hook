# Reach

This answers the existing-project questions for the public offering directory. The tokens are the mock USDC and mock RWA on the Ethereum Sepolia demo pool. They are not real-world assets, and this demo does not have a production investor base.

## Who uses the product today, and will they use the part on Arkiv?

The people using it today are the operators and reviewers of this demo. The investor page at `/invest` is the screen they open. That page reads one Arkiv entity and shows it as the public offering.

There is one published entity, written by one wallet:

- Entity: `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578`
- Writer: `0xbfBf7Ca4f33993fA8b918d38286dad927231FB72`
- Query: `projectTag = str('rwacomply') AND offeringId = str('sepolia-demo-rwa')`

Anyone with that query can read the same row from Rabdi, chain id `7794095`, without asking the app operator. The explorer is [https://rabdi.explorer.arkiv.network](https://rabdi.explorer.arkiv.network). The Sepolia pool the row points at was initialized in block `12076181`. Its cap on the allocation contract is `1_000_000_000` base units, which is $1,000 of the mock USDC.

Reviewers use the Arkiv part every time `/invest` loads the directory. The chain cap and period on that same panel come from Ethereum, not from the entity.

## Will it ship to them after Mumbai?

The same `/invest` directory keeps reading this entity until the indexed expiry, unix `1801744500` (`2027-02-04`). The app does not need a new deploy to keep showing it. After that timestamp the directory marks the record expired and keeps showing the Ethereum policy.

This remains a demo of mock tokens. It is not a commitment to offer those tokens to the public after the event.
