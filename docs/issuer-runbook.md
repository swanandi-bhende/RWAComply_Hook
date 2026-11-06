# Issuer runbook

This runbook describes the owner calls that already exist. None of them were sent while this note was written.

The mock USDC and mock RWA are not real-world assets. World ID proof of human is not KYC, AML, accreditation, residency, nationality, or legal eligibility. Registering a wallet does not set an access tier. The liquidity helper's tier 2 is pool seeding, not investor approval.

## Who can act

Read on 6 November 2026, Ethereum Sepolia, chain id `11155111`:

| Role | Address | What it can do |
|---|---|---|
| Ledger owner and hook owner | `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6` | `setPolicy`, `setBackendSigner`, `setAuthorizedHook`, `setTier`, pause |
| Backend signer | `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46` | Sign `registerWallet` authorizations. It cannot set a tier. |
| Authorized hook | `0xD092CbB8De7cCa60807Ca73213f12920Afd308c0` | `recordSpend` only |
| Trusted router | `0x0E4f7a7D8bA8d629784056A04105d0a322b9768D` | `swapExactInput` |
| Liquidity helper | `0x58F03D8e2B11014d24773eB32E467c9297634008` | Tier 2. It is not an investor. |

An investor wallet cannot call `setTier`. The deployer tier is 0. Do not set an investor tier on the deployer or the liquidity helper.

## Current policy

Ledger `0xc74c64fee3b4C2D1E2ed37F218f0179026A9ceeA`.

Group `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677`, period `1`, cap `1000000000` raw USDC units ($1,000), USDC `0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe`.

`setPolicy` does not reset spend. It reverts if the new cap is below the highest spend already recorded for that group and period. The quote token cannot change after the first policy. There is no policy version and no end time.

## Access tier, when an investor wallet is known

Contract: hook `0xD092CbB8De7cCa60807Ca73213f12920Afd308c0`.

Function: `setTier(address user, uint8 tier)`.

Owner only. Tier 0 cannot purchase. Tier 1 is retail. Tier 2 is the existing institutional allowlist and still passes through the allocation ledger.

This call is not prepared for a specific investor because no investor wallet has been registered. Do not send it until the wallet address, the tier, and the effect have been approved. One approval does not approve a later purchase.

## Signer rotation

Contract: the ledger.

Function: `setBackendSigner(address newSigner)`.

Owner only. It replaces the address that must recover from a registration signature. It does not clear wallet registrations, used nonces, or spend. Signatures from the previous signer stop working. Unused nonces can still be used by the new signer. The zero address is rejected.

The live signer already matches the allocation key. Do not rotate it unless that key is being replaced.

## Pause

`pausePool` and the matching unpause on the hook are owner calls. A paused pool rejects the supported purchase. It does not change the ledger cap or the recorded spend.

## What the issuer cannot do from Arkiv

Publishing the Rabdi offering does not set the Ethereum policy, the tier, or the cap. The directory is public metadata. The purchase button reads the ledger.
