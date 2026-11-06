# Uniswap v4 feedback

Continuity submission for the existing RWAComply hook. The form is [https://developers.uniswap.org/hackathon-feedback](https://developers.uniswap.org/hackathon-feedback).

The three places this integration sits are [`beforeSwap`](src/RWAComplyHook.sol), [`afterSwap`](src/RWAComplyHook.sol), and the router [`swapExactInput`](src/PoolExecutor.sol).

## beforeSwap

`beforeSwap` receives the router as `sender`, not the person who is buying. A budget checked against `sender` would be the router's budget. [`PoolExecutor.swapExactInput`](src/PoolExecutor.sol) takes USDC from `msg.sender` and passes `abi.encode(trader)` as hook data. The hook rejects any other length, a dirty address word, or the zero address, and it rejects the call unless `sender` is the configured router.

That split is easy to get wrong from the hook docs alone. The callback looks like it identifies the user. On a routed pool it identifies the contract that unlocked the PoolManager. The trader has to be carried in hook data, and the router has to be the thing that decides who that trader is. If the hook trusted the bytes without checking the router, any caller could name someone else's budget.

The quoted input is `uint256(-params.amountSpecified)`, so the path only accepts exact input. A positive `amountSpecified` reverts before the ledger is read.

## afterSwap

The number that has to be recorded is the USDC the pool actually took, not the amount requested in `beforeSwap`. In `BalanceDelta`, that leg is negative. [`afterSwap`](src/RWAComplyHook.sol) reads the input currency's delta, requires it to be USDC and negative, and records `uint256(uint128(-inputDelta))`. If that settled amount is above the quote captured in `beforeSwap`, the hook reverts.

`ledger.recordSpend` is called from `afterSwap`. If it reverts, the swap reverts with it, so a rejected budget does not leave the tokens moved and the counter unchanged, or the other way around. The group and period stored before the swap are the ones passed to `recordSpend`. Selling RWA back does not go through this USDC-input check, and it does not reduce the recorded spend.

The sign convention is the part that took the longest to pin down. A positive delta looks like "the user received something" until you test USDC as currency0 and as currency1. Both have to treat a negative USDC leg as the purchase.

## Router

[`PoolExecutor`](src/PoolExecutor.sol) is an `IUnlockCallback`. It unlocks the PoolManager, pulls USDC from the caller, and settles the swap. The hook will not accept a direct swap through the PoolManager from any other address. That is what makes the budget apply to this route only. A plain ERC-20 transfer, another router, or another chain never calls `beforeSwap`.

Two deployment details were not obvious from the pool examples:

- A dynamic-fee pool ignores the hook fee unless `beforeSwap` returns the fee with `OVERRIDE_FEE_FLAG`. Returning the raw fee left the pool on the static value.
- The official Sepolia `PoolManager` does not expose `getSlot0`. The pool id is the keccak of the `PoolKey`. It was confirmed from the `Initialize` log, not from a view call on the manager.

The hook address also has to encode its permission flags. The CREATE2 salt search is in the Sepolia deploy script. A one-byte mismatch in the flags deploys a contract the PoolManager will not call.
