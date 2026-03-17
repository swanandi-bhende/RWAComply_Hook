# RWAComply Hook (Uniswap v4)

## Overview

RWAComply is a custom Uniswap v4 hook that introduces compliance-aware logic for Real-World Asset (RWA) pools. It enforces user access control and dynamically adjusts behavior based on user tiers and market conditions.

This project is currently at a working MVP stage with deployed contracts on a local Anvil network.

---

## Features Implemented

* **User Tier System**

  * Addresses are assigned tiers:

    * Retail (1)
    * Institutional (2)
  * Unverified users (tier = 0) are blocked from swaps and liquidity actions.

* **Access Control (beforeSwap & beforeAddLiquidity)**

  * Transactions are validated before execution.
  * Unauthorized users are reverted.

* **Dynamic Fee Logic**

  * Fee varies based on:

    * User tier
    * Market volatility from oracle
  * Higher volatility → higher fees for retail users.

* **Post-Swap Tracking**

  * Emits fee-related events after swaps.

* **Mock Oracle Integration**

  * Simulates real-world volatility data.

---

## Tech Stack

* Solidity (0.8.24 / 0.8.26)
* Foundry (Forge, Anvil)
* Uniswap v4 Core
* OpenZeppelin (Ownable)

---

## Project Structure

```
src/
  RWAComplyHook.sol
  MockRWAOracle.sol

script/
  DeployCore.s.sol
  DeployHook.s.sol

lib/
  v4-core/
  openzeppelin-contracts/
```

---

## Contracts

### RWAComplyHook.sol

Main hook contract implementing:

* beforeSwap
* afterSwap
* beforeAddLiquidity
* Required IHooks interface functions

### MockRWAOracle.sol

Simple contract to:

* Set volatility
* Return current volatility

---

## Deployment (Local - Anvil)

### 1. Start Anvil

```
anvil
```

---

### 2. Set Environment Variables

Create `.env`:

```
PRIVATE_KEY=0x<anvil_private_key>
```

---

### 3. Deploy PoolManager

```
forge script script/DeployCore.s.sol \
--rpc-url http://127.0.0.1:8545 \
--broadcast
```

Copy the deployed address and add:

```
POOL_MANAGER=<address>
```

---

### 4. Deploy Hook + Oracle

```
forge script script/DeployHook.s.sol \
--rpc-url http://127.0.0.1:8545 \
--broadcast
```

---

## Current Status

* Contracts compile successfully
* PoolManager deployed
* Oracle deployed
* Hook deployed and configured
* Tier system working
* Access control working

---

## Not Yet Implemented

* Pool creation with hook attached
* Token deployment and liquidity provisioning
* Swap execution to trigger hooks
* NFT-based fee accrual
* Chainlink oracle integration
* Reactive Network integration
* Frontend

---

## Next Steps

1. Deploy mock ERC20 tokens
2. Create a Uniswap v4 pool using the hook
3. Add liquidity
4. Execute swaps to trigger:

   * beforeSwap
   * afterSwap
5. Test dynamic fee behavior

---

## Notes

* The hook does not hold funds (safe design)
* All logic is executed via Uniswap v4 PoolManager callbacks
* Broadcast and cache folders are ignored for clean version control

---

## Goal

To build a compliant liquidity layer for RWAs by combining:

* On-chain identity (tiers)
* Oracle-based adaptability
* Hook-based enforcement in Uniswap v4
