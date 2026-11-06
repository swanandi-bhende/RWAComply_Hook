# Demo

The point of the demo is one sentence: one human can link two wallets to one USDC purchase budget, and another human keeps a separate budget.

Three parts:

- World ID, for proof of human. A live session has not been completed.
- The trusted Uniswap v4 route and `AllocationLedger`, for the budget.
- Arkiv, for the public offering record. It does not enforce the budget.

The purchase numbers below were produced on local Anvil. They have not been produced on Sepolia. No demo video has been recorded.

## Before a live session

- The page you open matches the chain you mean. `/demo` is Anvil. `/invest` is Sepolia.
- The wallet is not the deployer `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6`, the allocation signer `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`, or the liquidity helper `0x58F03D8e2B11014d24773eB32E467c9297634008`.
- Sepolia investor steps need World App and `WORLD_ID_ENVIRONMENT` set to the portal environment. This project’s configured value has been `staging`.
- The offering read is `npm run query:offering` from `frontend/`.
- Issuer tier is separate. Registration does not set it. The hook owner must call `setTier` before a registered wallet can buy. That call has not been sent for an investor. See [docs/issuer-runbook.md](docs/issuer-runbook.md).

## Local Anvil

Label this LOCAL ANVIL. Chain id `31337`.

```bash
bash script/start_anvil_demo.sh
bash script/demo_allocation_journey.sh
```

The journey script takes no arguments. It refuses every chain except `31337`. It registers Alice’s two wallets and Bob’s wallet, then:

| Action | Result |
|---|---|
| Alice wallet A buys 700 USDC | Spend becomes 700. Remaining 300 |
| Alice wallet B requests 500 | Reverts. Spend stays 700 |
| Alice wallet B buys 200 | Spend becomes 900. Remaining 100 |
| Bob | His own cap, unchanged by Alice |

The script skips the buys on a later run when the shared spend is already 900. USDC approval is to the PoolExecutor, not the PoolManager. The allocation id is not shown.

`/demo` can show the same market in the browser after `npm run dev` in `frontend/`. The script is the automated proof. The page is the interactive view. An earlier browser pass on this Anvil market showed Approving, Swapping, and Success, an unregistered-wallet rejection, a paused-pool rejection, and an over-budget rejection that did not increase spend.

Read local state with `cast` against `http://127.0.0.1:8545` and the addresses in `broadcast/DeployFull.s.sol/31337/run-latest.json`.

## Sepolia investor path

These steps are the product path. A real World ID proof and a real investor transaction have not been done. Do not treat the Anvil script as this path.

1. Open `/invest` and connect Wallet A on chain `11155111`.
2. Choose “Enroll and register this wallet” and finish World App.
3. Sign the wallet-link request.
4. Confirm `registerWallet`. The page says the wallet is linked only after the receipt, the `WalletRegistered` event, the allocation mapping, and the used nonce agree.
5. Disconnect Wallet A.
6. Connect Wallet B.
7. Choose “Continue and register this wallet.” Do not start a new enrollment.
8. Sign and register Wallet B. Both wallets share one budget. The allocation id is not on the page.
9. The offering panel reads Arkiv. The cap and the remainder come from Ethereum.
10. A different person needs a separate World ID proof and gets a separate budget.

Before a purchase, the hook owner sets that investor’s tier. World ID does not do it. The purchase then uses `PoolExecutor.swapExactInput`. The intended amounts, after that approval, are the same 700, rejected 500, and 200. They have not been sent.

`GET /api/product/purchases?wallet=` lists `SpendRecorded` for that wallet. A reverted purchase is absent. The Sepolia log range from block `12075637` had no registrations and no spend when it was last read.

## Judge walkthrough

| Question | Where to look |
|---|---|
| Who may swap | `beforeSwap` in [`src/RWAComplyHook.sol`](src/RWAComplyHook.sol). The sender must be the trusted executor |
| What is recorded | `afterSwap` records the settled USDC decrease. A revert rolls the spend back |
| Who pulls the tokens | [`src/PoolExecutor.sol`](src/PoolExecutor.sol). The purchaser is `msg.sender` |
| Where the budget lives | [`src/AllocationLedger.sol`](src/AllocationLedger.sol) |
| Who verified the human | [`frontend/app/api/world/enroll/route.ts`](frontend/app/api/world/enroll/route.ts) calls World. The browser does not |
| How a second wallet is bound | [`frontend/app/api/world/continue/route.ts`](frontend/app/api/world/continue/route.ts), then the EIP-712 registration |
| What Arkiv holds | Entity `0x6feefc2d7a889123485ccb454bba924db7057a8d18d5cb0b3e6a49c66a2a5578` |
| What is on Sepolia | [deployment.md](deployment.md) |

Useful commands:

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
| This offering is currently paused. | The hook owner paused the pool |
| This purchase exceeds your remaining allocation. | The shared budget is too small. Spend does not increase |
| This offering supports exact-input purchases only. | The swap is not exact-input |
| This pool does not use the supported quote token. | The input token is not the configured USDC |
| This trading route is not supported. | The caller is not the trusted executor |
| The transaction failed. Your allocation was not used. | The receipt reverted |
| Offering information could not be refreshed. Trading rules are still checked onchain. | Arkiv did not answer. The purchase button still uses Ethereum |
| Verification services are temporarily unavailable. | The World verifier could not be reached |
| Issuer approval required | The wallet has no access tier. Registration did not grant one |
| The wallet does not have enough gas or USDC. | The purchase could not be funded |
| The RPC is chain …, not local Anvil 31337. | `start_anvil_demo.sh` or the journey script refused a non-local chain |

There is no sentence for “this offering’s allocation period has ended.” The ledger has no end time.

## Recording

Speak the demo. Keep it between 2 and 4 minutes, at least 720p, with no AI voiceover and no text-to-speech. ETHGlobal rejects a video outside that length or under 720p. The spoken beats are in [docs/demo-script.md](docs/demo-script.md). No recording file is in this repository.
