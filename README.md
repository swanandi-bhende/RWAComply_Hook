RWAComply Hook (Uniswap v4)

Overview

RWAComply is a custom Uniswap v4 hook that introduces compliance-aware
logic for Real-World Asset (RWA) pools. It enforces user access control
and dynamically adjusts behavior based on user tiers and market
conditions.

This project is currently at a working MVP stage with fully tested
contracts and successful CREATE2-based deployment compatible with
Uniswap v4 requirements.

------------------------------------------------------------------------

Features Implemented

User Tier System

-   Addresses are assigned tiers: Retail (1) Institutional (2)
-   Unverified users (tier = 0) are blocked from swaps and liquidity
    actions.

Access Control (beforeSwap & beforeAddLiquidity)

-   Transactions are validated before execution.
-   Unauthorized users are reverted.
-   Retail users have a swap cap enforced.

Dynamic Fee Logic

-   Fee varies based on:
    -   User tier
    -   Market volatility from oracle
-   High volatility:
    -   Retail → higher fees
    -   Institutional → lower fees
-   Normal conditions:
    -   Default fee applied

Post-Swap Tracking

-   Emits fee-related events after swaps.

Mock Oracle Integration

-   Simulates real-world volatility data for testing fee behavior.

------------------------------------------------------------------------

Tech Stack

-   Solidity (0.8.24 / 0.8.26)
-   Foundry (Forge, Anvil)
-   Uniswap v4 Core
-   OpenZeppelin (Ownable)

------------------------------------------------------------------------

Project Structure

src/ RWAComplyHook.sol MockRWAOracle.sol

script/ DeployCore.s.sol DeployHook.s.sol PoolSetup.s.sol

test/ RWAComply.t.sol

lib/ v4-core/ openzeppelin-contracts/

------------------------------------------------------------------------

Contracts

RWAComplyHook.sol

-   Main hook contract implementing:
    -   beforeSwap
    -   afterSwap
    -   beforeAddLiquidity
-   Enforces compliance and dynamic fee logic
-   Uses CREATE2-compatible deployment constraints
-   Validates hook permissions (production only)

MockRWAOracle.sol

-   Simple contract to:
    -   Set volatility
    -   Return current volatility

------------------------------------------------------------------------

Deployment (Local - Anvil)

1.  Start Anvil

anvil

------------------------------------------------------------------------

2.  Set Environment Variables

Create .env:

PRIVATE_KEY=0x`<anvil_private_key>`{=html}

------------------------------------------------------------------------

3.  Deploy PoolManager

forge script script/DeployCore.s.sol\
--rpc-url http://127.0.0.1:8545\
--broadcast

Add: POOL_MANAGER=
```{=html}
<address>
```

------------------------------------------------------------------------

4.  Deploy Hook + Oracle (CREATE2)

forge script script/DeployHook.s.sol\
--rpc-url http://127.0.0.1:8545\
--broadcast

-   Salt is brute-forced automatically
-   Hook address satisfies Uniswap v4 permission mask

------------------------------------------------------------------------

Testing

Tests located in: test/RWAComply.t.sol

Covered cases:

-   Unverified users cannot swap
-   Retail fee logic under high volatility
-   Institutional fee logic under high volatility
-   Pool pause behavior

Run tests:

forge test

All tests are currently passing.

------------------------------------------------------------------------

Special Implementation Details

CREATE2 Deployment

-   Hook must satisfy: hookAddress & ALL_HOOK_MASK == permissions
-   Salt is brute-forced to achieve valid address
-   Uses canonical CREATE2 deployer (0x4e59...)

Ownership Fix

-   Owner passed explicitly in constructor
-   Avoids CREATE2 msg.sender issue

Test vs Production Handling

-   Hook validation skipped in test environment
-   onlyPoolManager relaxed in tests
-   Fully enforced in production

------------------------------------------------------------------------

Current Status

-   Contracts compile successfully
-   CREATE2 hook deployment working correctly
-   Permission bits matched exactly
-   Ownership correctly handled
-   Oracle integrated and functional
-   All tests passing
-   Hook logic validated in isolation

------------------------------------------------------------------------

Not Yet Implemented

-   Pool creation with hook attached
-   Token deployment and liquidity provisioning
-   Swap execution via PoolManager
-   NFT-based fee accrual
-   Chainlink oracle integration
-   Reactive Network integration
-   Frontend interface

------------------------------------------------------------------------

Next Steps

1.  Deploy mock ERC20 tokens
2.  Create Uniswap v4 pool with hook
3.  Initialize pool
4.  Add liquidity
5.  Execute swaps to trigger:
    -   beforeSwap
    -   afterSwap
6.  Validate dynamic fee behavior on-chain

------------------------------------------------------------------------

Notes

-   Hook does not custody funds (secure design)
-   All logic executed via PoolManager callbacks
-   CREATE2 is mandatory for Uniswap v4 hooks
-   Broadcast and cache folders should be gitignored

------------------------------------------------------------------------

Goal

To build a compliant liquidity layer for RWAs by combining:

-   On-chain identity (user tiers)
-   Oracle-driven adaptability
-   Hook-based enforcement in Uniswap v4
