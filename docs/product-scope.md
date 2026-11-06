# Product scope

This is the boundary of the thing I actually built. The README stays short on purpose.

The cap applies to the router’s exact-input USDC purchase, `PoolExecutor.swapExactInput`, through this hook. It does not block direct token transfers, other protocols, or other chains. A pool that does not use this hook is outside the check. Selling RWA does not restore the budget. The spent amount stays on `AllocationLedger`.

The World ID credential is not KYC or AML. It is not accreditation, residency, nationality, or legal eligibility. It proves a human for this session. The issuer access tier is a separate owner action, `setTier` on the hook. Registering a wallet does not set the tier, and the investor cannot set it.

USDC is the quote asset for this version. The ledger accounts gross purchases in that token’s base units. The Sepolia USDC and RWA contracts are mocks. They are not a production real-world asset market.

Ethereum is the record of registration, the cap, the period, the spend, and the remainder. Arkiv stores the public offering metadata and nothing else. A write to Arkiv cannot reject a swap.

One pool is deployed on Sepolia. The ledger can key spend by group, so a second pool on the same hook and group would share the budget, but I have not deployed that pool or tested it. There is no wallet revoke function, no policy end time, and no per-swap trade signature. The trusted executor is the purchase control. Those choices are written up in [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md).

The 700 / 500 / 200 walk has been run on local Anvil, chain id `31337`. It has not been run as an investor purchase on Sepolia. A live World ID proof has not been completed.
