# Presentation checklist

This is the local runbook. It does not claim a finished World ID proof or a Sepolia investor purchase.

The presentation registration path is `/invest`. Choose “Use demo verification for this presentation” only for the two wallets in `RWA_SEPOLIA_DEMO_ALLOWED_WALLETS`. That choice is not World ID. `/demo` remains the local Anvil sandbox.

## Before presentation

1. Confirm the branch is `v2`.
2. Do not print or edit the root `.env`.
3. Start the local chain if it is not already listening:

```bash
bash script/start_anvil_demo.sh
```

That script uses Anvil chain `31337` at `http://127.0.0.1:8545`. It deploys the local market with the Anvil development account and seeds Alice and Bob. It does not use the Sepolia deployer key for the broadcast.

4. From `frontend/`, build and serve:

```bash
npm run build
RWA_DEMO_IDENTITY=local npx next start --port 3463
```

5. Open `http://127.0.0.1:3463/demo`.
6. Choose Restart demo. The page must show Alice Wallet A and Bob each with `$1,000` remaining. Those amounts come from the ledger.
7. Confirm the page does not ask for a browser wallet, World App, or a personal signature.

## During presentation

1. Explain the problem: one person can use more than one wallet, so a limit on a single address is not a limit on the person.
2. Stay on `/demo`. Select Alice and Wallet A. Choose Buy 700 USDC. Wait for Transaction status: confirmed. Spent becomes `$700`. Remaining becomes `$300`.
3. Select Wallet B. Choose Attempt 500 USDC. Wait for Transaction status: rejected. Spent stays `$700`. Remaining stays `$300`.
4. With Alice Wallet B still selected, choose Buy 200 USDC. Wait for confirmed. Spent becomes `$900`. Remaining becomes `$100`.
5. Select Alice Wallet A again. Remaining stays `$100`. Both wallets share one allocation.
6. Select Bob. Wallet B is unavailable. Spent is `$0`. Remaining is `$1,000`.
7. Explain that the PoolExecutor swap called the hook, and the hook called the AllocationLedger. The rejected 500 USDC purchase reverted inside the transaction, so the ledger did not keep that spend.
8. Open `/invest` only to show the separate World ID path: World App, a server-checked proof, a wallet-ownership signature, then `registerWallet` on Ethereum Sepolia. Issuer approval is a later owner action.
9. Say plainly that a genuine World App proof has not been completed. The presenter does not have an Orb-verified credential, Selfie Check access, or an NFC-supported document. The local demo is not that proof.

Restart demo before the next run. It reloads the Anvil snapshot. It does not edit the displayed numbers by themselves.

## Do not say

- That World ID verification succeeded.
- That a Sepolia investor registration or purchase was confirmed.
- That the issuer marketplace can create an offering on Sepolia.
- That the allocation signer, the contract owner, or the liquidity helper is an ordinary investor wallet.
