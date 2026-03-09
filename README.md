# RWAComply

A permissioned Uniswap v4 hook optimized for tokenized Real-World Assets (RWAs) like real estate or treasuries. It gates access via KYC/identity checks and dynamically adapts pool parameters (e.g., fees or swap caps) based on user compliance tiers and RWA oracle data (e.g., Chainlink feeds for asset status). Integrated with Reactive Network for cross-chain reactivity and deployed on Unichain.

## Installation
forge install

## Deployment
forge script script/Deploy.s.sol

## Testing
forge test