// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {TickMath} from "@uniswap/v4-core/libraries/TickMath.sol";

contract PoolExecutor {

    IPoolManager public poolManager;
    PoolKey public key;

    constructor(IPoolManager _poolManager, PoolKey memory _key) {
        poolManager = _poolManager;
        key = _key;
    }

    function execute() external {
        poolManager.unlock("");
    }

    function unlockCallback(bytes calldata) external returns (bytes memory) {

        IPoolManager.ModifyLiquidityParams memory liquidityParams =
            IPoolManager.ModifyLiquidityParams({
                tickLower: -600,
                tickUpper: 600,
                liquidityDelta: 1000 ether,
                salt: bytes32(0)
            });

        poolManager.modifyLiquidity(key, liquidityParams, "");

        IPoolManager.SwapParams memory swapParams =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e18),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            });

        poolManager.swap(key, swapParams, "");

        return "";
    }
}