# Demo

Investor setup is Part A of [first-time-setup.md](first-time-setup.md). The marketplace design is [docs/MARKETPLACE_ARCHITECTURE.md](docs/MARKETPLACE_ARCHITECTURE.md). `/offerings` shows the Sepolia demo market and labels it as test tokens. The solar and private-credit examples sit in a separate section and are not deployed offerings. `/issuer` explains the issuer workflow and can review a local draft. It does not create an offering, and the connected wallet is not treated as an authorized issuer. The on-site page is `/getting-started`. Repository setup is Part B of that file and [setup.md](setup.md).

The demonstration is one shared USDC purchase budget for one verified human, including a second wallet, with a separate budget for a second human. World ID is the proof of human. The trusted Uniswap v4 route and `AllocationLedger` enforce the budget. Offering metadata is published through Arkiv and cannot reject a swap.

No demo video has been recorded. The purchase numbers below were produced on local Anvil. They have not been produced on Sepolia.

## Investor workflow

`/invest` is the Sepolia product path, chain id `11155111`. `/demo` is the local Anvil market, chain id `31337`. Do not treat the Anvil script as a completed Sepolia session.

| Step | Where it stands |
|---|---|
| 1. Connect a wallet | The header Connect button opens RainbowKit. Connecting does not start a demo identity, register the wallet, or change the wallet’s network. A wallet on another network stays connected and must be switched to Ethereum Sepolia before registration |
| 2. Complete proof of human in World App | The button is “Verify with World App”. The page shows the QR code and link from the IDKit request. Proof of human needs an Orb-verified World ID. A live World ID proof has not been completed. `/invest` does not substitute a demo identity |
| 3. Sign wallet ownership | The browser wallet signs after World accepts the proof. The Register wallet section stays on that World ID session |
| 4. Register the wallet | `registerWallet` on Sepolia. The page reports success only after the receipt matches. No investor registration has been sent |
| 5. View the allocation and the offering | The cap and the remainder come from Ethereum. The offering panel reads Arkiv. The allocation id is not shown |
| 6. Connect a second wallet | Disconnect the first wallet, then connect the second |
| 7. Continue the existing World ID session | “Continue and register this wallet”. The verified session stays in an HttpOnly cookie for this browser. A new enrollment is a different person |
| 8. Register the second wallet | Same signature and `registerWallet` path. Not yet done on Sepolia |
| 9. Show the shared budget | Both wallets read one remaining USDC budget |
| 10. Purchase through the supported route | `PoolExecutor.swapExactInput`. The Anvil result is below. It has not been sent on Sepolia |

Before step 10, the hook owner must set that investor’s tier. Registration does not do it, and the investor cannot do it. The page says “Issuer approval required” while the tier is 0. No investor `setTier` has been sent.

The investor needs Sepolia ETH for gas and demo USDC in the wallet. The quote token is mock USDC at `0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe`. Its `mint` function is public. The investor page does not mint it. The received token is mock RWA.

Use two wallets the investor controls. Do not use the owner `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6`, the allocation signer `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`, or the liquidity helper `0x58F03D8e2B11014d24773eB32E467c9297634008`.

### Guided local demo

Label this LOCAL ANVIL. It is not the investor session above and it is not evidence of World ID verification. Open `/demo` after the startup command. The page is “Local demonstration — Anvil test network”. Alice and Bob are simulated personas on unlocked Anvil accounts. No browser extension, wallet signature popup, or World App is required.

```bash
bash script/start_anvil_demo.sh
bash script/demo_allocation_journey.sh
```

`RWA_DEMO_IDENTITY=local` must be set in the frontend process, and the browser host must be localhost or 127.0.0.1. The startup command deploys a fresh local market and seeds the personas. The journey command resets to that snapshot, then runs the purchases. Both refuse every chain except `31337`. The local market is the single-offering `DeployFull` path. The marketplace contracts are not what this demo executes.

The journey registers Alice’s two wallets on one allocation and Bob’s wallet on another:

| Action | Result |
|---|---|
| Wallet A buys 700 USDC | Spend becomes 700. Remaining 300 |
| Wallet B requests 500 | Reverts. Spend stays 700 |
| Wallet B buys 200 | Spend becomes 900. Remaining 100 |
| Second person | A separate cap, unchanged by the first person |

Reset on `/demo` loads the Anvil snapshot taken after seeding and before the purchases. It does not edit the displayed numbers by themselves. USDC approval is to the PoolExecutor, not the PoolManager. Serve the frontend with `RWA_DEMO_IDENTITY=local npx next start --port 3463` from `frontend/` after `npm run build`, or `npm run dev` with the same variable.

The presentation order is [docs/PRESENTATION_CHECKLIST.md](docs/PRESENTATION_CHECKLIST.md). A public host does not run this chain. When the request host is not localhost, `/demo` says the hosted demo chain is not configured. It does not call `127.0.0.1:8545`, and it does not invent balances or transaction hashes. Hosting steps are in [docs/vercel-deployment.md](docs/vercel-deployment.md).

`GET /api/product/purchases?wallet=` lists `SpendRecorded` for that one wallet. A reverted purchase is absent. The Sepolia log range from block `12075637` had no registrations and no spend when it was last read.

## Issuer workflow

There is no live issuer dashboard. `/issuer` does not authorize a wallet, create a pool, or publish metadata. The actions below are the supported operations. Investor registration and purchasing stay in the investor workflow.

### Available now

Reviewing the offering. `/invest` shows the public Arkiv metadata for the mock USDC and mock RWA pool. A developer can read the same row with `npm run query:offering` from `frontend/`. The row does not set the cap or the tier.

The allocation policy already on Sepolia is group `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677`, period `1`, and a cap of `1000000000` raw units, which is 1,000 demo USDC. Changing it is `setPolicy` on `AllocationLedger`, and only the owner `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6` can send it. The call does not clear spend and reverts if the new cap is below spend already recorded. No product screen sends `setPolicy`. The owner call is described in [docs/issuer-runbook.md](docs/issuer-runbook.md).

Approving an investor. `setTier(address,uint8)` on the hook is also owner-only. Tier 0 cannot purchase. Tier 1 is retail. Tier 2 still passes through the ledger cap. It is not an unrestricted institutional budget. On the local Anvil demo, `/demo` includes Admin Observatory. The tier, pause, retail-cap, volatility, and oracle controls render only when the connected wallet is the hook owner. That panel is a local demo utility. It is not a retailer-facing interface, and it does not appear on `/invest`.

`setRetailSwapCap` on that panel is an older per-swap hook parameter. It is not the shared human budget. The shared budget remains the ledger cap.

Pause and resume are `setPoolPaused` on the hook, owner-only. The same local owner panel can send it. A direct owner transaction can send it on Sepolia. Pause rejects the supported purchase and does not change the ledger cap or the recorded spend.

Offering metadata is published with `npm run publish:offering`. That command is not an issuer screen. The current entity should stay one row. Publishing metadata does not change Ethereum policy.

Monitoring. The investor page lists purchases for the connected wallet only. Admin Observatory shows hook owner, pool pause, and fee fields for the local demo. Neither view is an aggregate allocation report.

### Not available

- A retailer or issuer dashboard.
- Creating an offering, editing policy, or pausing an offering from `/invest`.
- An issuer view of every wallet in one allocation.
- A second issuer, or a separate institutional cap.
- An investor `setTier` on Sepolia. No investor wallet has been registered, so the call has not been sent.

Those missing pieces need a product workflow or an explicit owner transaction. They are not investor actions.

## Where the checks live

| Question | Where to look |
|---|---|
| Who may swap | `beforeSwap` in [`src/RWAComplyHook.sol`](src/RWAComplyHook.sol). The sender must be the trusted executor |
| What is recorded | `afterSwap` records the settled USDC decrease |
| Who pulls the tokens | [`src/PoolExecutor.sol`](src/PoolExecutor.sol) |
| Where the budget lives | [`src/AllocationLedger.sol`](src/AllocationLedger.sol) |
| Who verified the human | [`frontend/app/api/world/enroll/route.ts`](frontend/app/api/world/enroll/route.ts) |
| How a second wallet is bound | [`frontend/app/api/world/continue/route.ts`](frontend/app/api/world/continue/route.ts) |
| What Arkiv holds | Entity `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578` |
| What is on Sepolia | [deployment.md](deployment.md) |

```bash
forge test
cd frontend && npm run test:world
cd frontend && npm run query:offering
```

Sepolia contract pages use `https://sepolia.etherscan.io/address/` plus the address in [deployment.md](deployment.md). The Rabdi explorer is [https://rabdi.explorer.arkiv.network](https://rabdi.explorer.arkiv.network).

## Troubleshooting

| What you see | Meaning |
|---|---|
| Connect a wallet to continue. | No wallet is connected |
| Switch to Ethereum Sepolia | The wallet is on the wrong chain for `/invest` |
| Verify with World ID before purchasing. | The wallet is not registered |
| Verification was cancelled. No wallet was registered. | The World ID widget was cancelled |
| Verification could not be completed. Please try again. | World rejected the proof, or the proof failed |
| Your RWAComply session could not be found. | Continuation has no stored session |
| This wallet could not be linked to your existing allocation. | The session proof or the link was rejected |
| Your registration request expired. Please try again. | The authorization timed out |
| This wallet is already associated with another allocation. | The wallet belongs to a different allocation id |
| The pool is paused. | The hook owner paused the pool |
| The purchase exceeds your remaining allocation. | The shared budget is too small. Spend does not increase |
| This offering supports exact-input purchases only. | The swap is not exact-input |
| This pool does not use the supported quote token. | The input token is not the configured USDC |
| This trading route is not supported. | The caller is not the trusted executor |
| The transaction reverted. Your allocation was not consumed. | The receipt reverted |
| Offering information could not be refreshed. Trading rules are still checked onchain. | Arkiv did not answer. The purchase button still uses Ethereum |
| Verification services are temporarily unavailable. | The World verifier could not be reached |
| Issuer approval required | The wallet has no access tier. Registration did not grant one |
| The wallet does not have enough gas or USDC. | The purchase could not be funded |
| The RPC is chain …, not local Anvil 31337. | `start_anvil_demo.sh` or the journey script refused a non-local chain |

There is no sentence for “this offering’s allocation period has ended.” The ledger has no end time.

## Recording

Speak the demo. Keep it between 2 and 4 minutes, at least 720p, with no AI voiceover and no text-to-speech. ETHGlobal rejects a video outside that length or under 720p. The spoken beats are in [docs/demo-script.md](docs/demo-script.md). No recording file is in this repository.
