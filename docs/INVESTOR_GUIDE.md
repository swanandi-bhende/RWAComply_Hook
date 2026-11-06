# Investor guide

An investor uses the application the operator is running. The investor does not create a World ID app, edit an environment file, or deploy contracts.

## Current Sepolia market

Open `/invest` on the local preview. There is no production URL. Connect a wallet, switch to Ethereum Sepolia, complete proof of human in World App, sign wallet ownership, and confirm `registerWallet`. A second wallet uses “Continue and register this wallet” so both wallets share one budget. The issuer still has to approve the wallet before a purchase. That approval has not been sent for an investor on Sepolia.

The offering on that page is the historical single-pool market. Its cap is on the allocation ledger. Arkiv only describes the offering. A live World ID proof and a Sepolia investor purchase have not been completed.

## More than one offering

`/offerings` lists the live Sepolia directory entry and labels the solar and private-credit examples as illustrations. Those examples are not deployed offerings. When a marketplace registry is deployed, each offering has its own cap. Buying one does not reduce the budget of another. The detail route `/offerings/[offeringId]` does not invent balances for an id the Sepolia registry does not have.

A purchase on the marketplace path, once that path is deployed, still uses exact-input USDC through the trusted executor. The wallet signs a trade intent for that offering's pool, policy version, amount, and deadline. The existing Sepolia purchase button does not ask for that signature.
