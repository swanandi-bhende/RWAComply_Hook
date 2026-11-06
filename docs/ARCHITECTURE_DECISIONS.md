# Architecture decisions

The sections below describe the deployed Sepolia contracts and the original single-pool path. [MARKETPLACE_ARCHITECTURE.md](MARKETPLACE_ARCHITECTURE.md) describes the separate local marketplace contracts. Those contracts add a per-offering policy, a signed trade for that path, and wallet revocation. They are not deployed on Sepolia, and they do not change the deployed hook, ledger, or executor.

These decisions record what the deployed code does.

## Signed trade intent and the trusted executor

The PRD, sections 8.4 and 12.7, asks the hook to check a signed trade intent on every purchase. The intent would bind the wallet, recipient, pool, policy, group, amount, period, policy version, nonce, expiry, chain, and route.

The shipped path is different. `PoolExecutor.swapExactInput` takes the purchaser from `msg.sender`. It pulls that wallet's USDC and passes `abi.encode(trader)` to the PoolManager. `RWAComplyHook.beforeSwap` rejects any sender other than `trustedRouter`. There is no per-purchase signature, trade nonce, or expiry.

They are not equivalent.

| Property | Signed intent in the PRD | Trusted executor now |
|---|---|---|
| Who may start a purchase | Any relayer holding a valid intent | The wallet that holds the tokens, through the executor |
| Wallet binding | Inside the signature | `msg.sender` on the executor |
| Recipient binding | Inside the signature | The executor pays the swap output to its caller |
| Amount and token | Inside the signature | The function arguments, then the settled USDC delta |
| Replay | Trade nonce | No second signature to replay. A new transaction is a new purchase and spends the budget again |
| Expiry | On the intent | None. The registration authorization expires. The purchase does not |
| Relayer | Can submit the intent | Cannot buy for someone else unless it is the trusted executor and mis-labels the trader |
| Trust | Backend signer plus the hook checks | The executor code and the hook's router check |
| Extra gas | One ECDSA recovery per swap | None beyond the existing hook |

A compromised or replaced executor is the remaining trust assumption. An untrusted router cannot enter. Registration signatures still cannot cross wallets, nonces, expiries, chains, or ledger deployments, because the EIP-712 domain is `AllocationLedger` version `1` with the chain id and the ledger address, and the struct is `Registration(address wallet,bytes32 allocationId,bytes32 groupId,uint256 expiry,uint256 nonce)`.

Recommendation: keep the trusted executor for this release. Do not implement a second signature until there is an approved design. Do not describe the executor as the PRD's signed trade intent.

## Multiple pools

`AllocationLedger` spend is keyed by allocation id, group id, and period. Two pools can share a budget only if they call `recordSpend` with the same three keys.

This hook stores one `allocationGroupId` and one `allocationPeriodId`. Every pool that uses this hook and this ledger shares that group and period. A pool on another hook, another chain, or a direct token transfer does not.

One pool is deployed: `0x45fa53491f19ed13a7b274ac5c3f2f6c670d699125f2ffeaedf7a94600d7a7f7`. No test buys through two pools. Multi-pool support is a property of the accounting key, not a demonstrated market.

A second pool needs a new deployment and explicit approval. It should use the same hook, the same USDC, and the same group, or it will not share the budget.

## Wallet revocation

The ledger can register a wallet and can reject a second allocation id for that wallet. It cannot revoke one.

If revocation is added later, the safe meaning is:

- Revoke one wallet, not the whole human, unless the owner asks for that separately.
- Leave historical spend in place. Selling already does not restore it, and revocation should not restore it either.
- Leave the remaining budget for the wallets that stay linked.
- A revoked wallet cannot purchase and cannot use an outstanding registration signature.
- The same wallet can be registered again only with a new authorization after the revoke flag is cleared.
- Other linked wallets keep the same allocation id and the same remaining budget.

That needs a contract change. It is not deployed and it is not implemented here.

## Policy version and end time

`Policy` stores `cap`, `periodId`, and `usdc`. There is no version, start time, or end time.

The period id is chosen by the hook owner through `setAllocation`. It is not computed from the clock. A new period is a new spend counter. `setPolicy` on the same period does not clear spend and cannot set the cap below the highest spend recorded for that group and period.

Registration signatures do not include a policy version. A cap change does not invalidate an unused registration signature. The signature still dies at its expiry, and its nonce dies when it is used.

Do not show “this offering's allocation period has ended.” Nothing in the contract can make that sentence true.

## Purchase history

The source is `AllocationLedger.SpendRecorded`. Arkiv is not a second balance.

`GET /api/product/purchases` reads those logs for one wallet from block `12075637` and returns the transaction hash, the amount, and the shared total after that purchase. It does not return the allocation id. A reverted purchase has no log. A reorg can remove a recent log because the read follows the current chain head. Purchases by another wallet in the same allocation appear in the shared remaining balance, not in this wallet's list.
