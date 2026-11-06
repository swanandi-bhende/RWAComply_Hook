# Marketplace architecture

The Sepolia market stays a single pool, a single hook group, and a single executor pair. The contracts in this note are a separate local path. They are not deployed on Sepolia, and they do not change the deployed bytecode.

## What the deployed contracts can and cannot do

`AllocationLedger` already accounts spend by allocation id, group, and period. A wallet is stored against one allocation id. The group in a registration signature is not a membership record, so one registration can be used with more than one group.

`RWAComplyHook` stores one `allocationGroupId`, one period, and one USDC/RWA pair. `setAllocation` and `setQuoteTokens` replace those values. They do not map a pool to an offering.

`PoolExecutor` fixes one USDC address, one RWA address, and one hook in the constructor. It cannot accept a second RWA token.

`setPolicy` is owner-only. An issuer wallet cannot call it on the deployed ledger. The deployed `Policy` struct is cap, period, and USDC. It has no version, start, or end. The deployed ledger has no revoke function.

Those limits are immutable for the contracts already on Sepolia. A new offering with its own token and cap needs new contracts. The existing pool id `0x45fa53491f19ed13a7b274ac5c3f2f6c670d699125f2ffeaedf7a94600d7a7f7` keeps using the existing hook.

## Local marketplace

| Contract | Role |
|---|---|
| `OfferingRegistry` | Platform owner authorizes issuers. An issuer creates only its own offering. The registry owns the new ledger and is the only account that calls `setPolicy` for that ledger. |
| `MarketplaceHook` | Reads the pool id, finds the offering, checks the window, pause, tier, revocation, and signed trade, then records spend on the ledger. |
| `MarketplaceExecutor` | Pulls USDC from the wallet named in the signed trade and pays the RWA to the signed recipient. The spender is this executor. |

One offering receives one new `groupId`, one cap, one period, and its own start and end. Two pools may be registered to that same offering, and they share the cap. A second offering uses a different group. Spend does not cross groups.

The issuer sets the cap in USDC base units. The cap must be non-zero and at most `1_000_000_000_000_000`. Arkiv does not supply the cap. Investors cannot change it. Raising or lowering the cap increments a policy version on the registry and does not erase ledger spend. A new cap below recorded spend reverts. A trade signed for the previous version no longer matches.

The marketplace hook rejects a purchase before the start or after the end. The deployed Sepolia hook does not, because its ledger has no clock.

## Authorization

The platform owner calls `authorizeIssuer`. An investor cannot. An issuer can pause, replace the cap, register pools, set a liquidity operator, and set tiers only for its own offering. The issuer is not the ledger owner and cannot rotate the backend signer or the hook.

Tier 0 cannot buy. Tier 1 and tier 2 both remain subject to the offering cap. A token is stored as unreviewed until the owner calls `reviewToken`. The hook does not treat that flag as a purchase authorization.

## Revocation

Revocation is not on the deployed ledger. On the registry, the owner can revoke one wallet for every marketplace offering, and an issuer can revoke one wallet for its own offering. Other wallets that share the allocation id keep the remaining budget. Spend is not reduced. Clearing the revoke flag requires a new backend signature that includes the current revocation epoch. An older registration signature does not clear it.

## Trade intent

The marketplace purchase is a wallet signature over `Trade(...)` in the domain `RWAComplyTrade` version 1. The signed fields are wallet, recipient, pool, policy, group, amount, period, policy version, nonce, deadline, chain id, and executor. The hook checks the signature again and consumes the nonce only inside the swap. The existing `PoolExecutor.swapExactInput` path is unchanged and still has no per-purchase signature. The two routes are not the same control.

EIP-1271 smart-contract wallets are not accepted on this path.

## Migration

`script/DeployFull.s.sol` remains the single-offering local demo. `script/DeployMarketplace.s.sol` reverts unless the chain id is `31337`. It has not been broadcast. Deploying it, or any new hook, on Sepolia requires a separate approval. Until that approval, `/issuer` and `/offerings` describe the local design and the one live Sepolia offering. They do not send marketplace transactions.
