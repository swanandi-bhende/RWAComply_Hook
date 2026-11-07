# Live acceptance report

Date: 6 November 2026. Branch: `v2`. Chain reads only. No public transaction was sent.

## Backend signer

Independent read of ledger `0xc74c64fee3b4C2D1E2ed37F218f0179026A9ceeA` on chain `11155111`:

| Check | Result |
|---|---|
| `owner()` | `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6` |
| `backendSigner()` | `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46` |
| `authorizedHook()` | `0xD092CbB8De7cCa60807Ca73213f12920Afd308c0` |
| Derived `ALLOCATION_AUTH_SIGNING_KEY` against `ALLOCATION_AUTH_SIGNER_ADDRESS` | MATCH |
| Derived key against `backendSigner()` | MATCH |
| Configured signer address against `backendSigner()` | MATCH |
| `backendSigner()` against the deployer | MISMATCH |
| Allocation signer against the World ID signer `0x77543b2a9d2555F778edC1A5a2642c4a969850c1` | MISMATCH |
| World key against `WORLD_RP_SIGNER_ADDRESS` | MATCH |
| Hook `trustedRouter()` against the PoolExecutor | MATCH |
| Hook `ledger()` against this ledger | MATCH |
| Hook group and period | The documented group, period `1` |
| Deployer tier | `0` |
| Liquidity helper tier | `2` |

The earlier audit sentence that called the deployer the backend signer was wrong. `script/DeploySepolia.s.sol` passes `ALLOCATION_AUTH_SIGNER_ADDRESS` into `new AllocationLedger(deployer, signer)` and requires that signer to differ from the deployer. The live contract matches that.

No `setBackendSigner` transaction was sent. Rotation would not erase registrations or spend. It would make old registration signatures invalid. It is not needed.

The registration signature is EIP-712 domain `AllocationLedger` version `1`, chain id, and ledger address. The fields are wallet, allocation id, group id, expiry, and nonce, in that order. The server signs with `ALLOCATION_AUTH_SIGNING_KEY`. A different chain, ledger, wallet, nonce, expiry, or group changes the digest. Local tests cover a wrong chain and a wrong verifying contract.

## World ID

`WORLD_ID_ENVIRONMENT` is `sandbox`. The app id and RP id are set. The World signer matches `WORLD_RP_SIGNER_ADDRESS`. No real proof was completed. No duration was measured. No continuation grant was issued by World. Fixture tests still show that a cancelled, failed, or timed-out widget does not register a wallet, and that a rejected proof does not create an enrollment.

To complete it, a person has to do these steps. Do not treat a fixture as this result.

1. Open `/invest` on the app that is serving this branch.
2. Connect Wallet A. It must not be the deployer `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6`, the allocation signer `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`, or the liquidity helper `0x58F03D8e2B11014d24773eB32E467c9297634008`.
3. Switch the wallet to Ethereum Sepolia.
4. Choose “Enroll and register this wallet” and finish the World App proof.
5. Sign the wallet-link request. Then confirm `registerWallet`.
6. The page may say the wallet is linked only after the receipt, the `WalletRegistered` event, the allocation mapping, and the used nonce agree.
7. Disconnect. Connect Wallet B, a second wallet of the same person, with the same exclusions.
8. Choose “Continue and register this wallet.” Do not start a new enrollment.
9. A different person needs a separate World ID proof. Do not invent that second proof.

## Registration, issuer approval, and purchases

| Item | Result |
|---|---|
| Wallet A `registerWallet` | Not sent. Waiting for a real World ID proof. |
| Wallet B continuation | Not sent. |
| Shared allocation on Sepolia | Not observed. No investor is registered. |
| Different human | Not observed. |
| `setTier` | Not sent. The owner is the deployer. The function is owner-only. The target wallet is not known yet. |
| 700 / 500 / 200 purchase | Not sent. |
| Allowance spender | The app approves the PoolExecutor. No live approval was made in this run. |

The local Anvil journey remains the evidence for the shared-budget numbers. It is chain `31337`, not Sepolia.

A read of `SpendRecorded` and `WalletRegistered` logs from block `12075637` returned 0 spend events and 0 registration events. `GET /api/product/purchases` for the deployer returned `{ "purchases": [] }`. An invalid wallet also returns an empty list.

The previous server on port 3459 does not include that route. The build checked in Chrome at `http://127.0.0.1:3462/invest` had no horizontal overflow at 1440, 768, 390, or 360, and the offering panel was visible. No wallet was connected, so the purchase list and a live World ID proof were not exercised in the browser.

## Outstanding live tests

1. A person completes World ID for Wallet A and the same session for Wallet B.
2. After those receipts, approve `setTier` for the exact investor address, tier, and chain.
3. After that approval, run the 700, rejected 500, and 200 purchases, then read the shared remaining budget.
4. A second person completes a separate proof and shows an untouched cap.

One approval does not cover the next transaction.
