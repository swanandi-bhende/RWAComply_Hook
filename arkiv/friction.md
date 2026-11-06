# Arkiv setup friction

These are the problems hit while connecting Rabdi and publishing the offering.

The access key and the faucet each require a wallet signature and the Arkiv Hub captcha. They cannot be created or claimed from the repository. Until both values were added to the repository-root `.env`, the server rejected the connection and no entity was written.

The publisher key was saved as 64 hex characters without a `0x` prefix. viem treats that string as an invalid private key. The publish path now accepts that form and normalizes it. The value stays in the root `.env`.

The Arkiv client loaded environment files on every construction. That loader defaults to the `frontend/` directory and reloads with replacement. A key already read from the repository root was removed, so a configured key looked missing. The client now keeps a key that is already present.

`describeColumns` in `@arkiv-network/sdk@1.0.1` returns one comma-separated string, not a list of column objects.

Uniswap v4 `PoolManager` does not expose `getSlot0`. A call for the computed pool id reverted. The pool id was confirmed from the `Initialize` log on the official Sepolia PoolManager instead.

Rabdi's `$expiresAt` is a block number. The offering's indexed `expiresAt` is a unix timestamp. Both were checked after the write: each is 90 days from publication, using the chain's 2 second block time for the block expiry.

A Sepolia websocket client keeps the Node process open after a finished read. The publish script exits explicitly after it prints the entity key.

The first publish created one entity. The next run found that entity, printed the same key, and did not send another create.
