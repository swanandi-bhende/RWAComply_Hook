// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";

import "../src/MockERC20.sol";

contract PoolExecutor {

    IPoolManager public poolManager;
    PoolKey public key;

    constructor(IPoolManager _poolManager, PoolKey memory _key) {
        poolManager = _poolManager;
        key = _key;
    }

    function execute() external {
        poolManager.unlock("INIT");
        poolManager.unlock("ADD_LIQ");
        poolManager.unlock("SWAP");
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "only manager");

        bytes32 action = keccak256(data);

        if (action == keccak256("INIT")) {

            // ✅ Set initial price = 1:1
            uint160 sqrtPriceX96 = 79228162514264337593543950336;

            poolManager.initialize(key, sqrtPriceX96);

        } else if (action == keccak256("ADD_LIQ")) {

            IPoolManager.ModifyLiquidityParams memory params =
                IPoolManager.ModifyLiquidityParams({
                    tickLower: -60,
                    tickUpper: 60,
                    liquidityDelta: 1e6,
                    salt: bytes32(0)
                });

            (BalanceDelta delta,) =
                poolManager.modifyLiquidity(key, params, "");

            _settleLiquidity(delta);

        } else {

            IPoolManager.SwapParams memory swapParams =
                IPoolManager.SwapParams({
                    zeroForOne: true,
                    amountSpecified: int256(1e18),
                    sqrtPriceLimitX96: 4295128740
                });

            BalanceDelta delta =
                poolManager.swap(key, swapParams, "");

            _settleSwap(delta);
        }

        return "";
    }

    function _settleLiquidity(BalanceDelta delta) internal {
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);

        int256 amt0 = delta.amount0();
        int256 amt1 = delta.amount1();

        if (amt0 < 0) {
            MockERC20(token0).transfer(
                address(poolManager),
                uint256(-amt0)
            );
        }

        if (amt1 < 0) {
            MockERC20(token1).transfer(
                address(poolManager),
                uint256(-amt1)
            );
        }
    }

    function _settleSwap(BalanceDelta delta) internal {
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);

        int256 amt0 = delta.amount0();
        int256 amt1 = delta.amount1();

        if (amt0 > 0) {
            MockERC20(token0).transfer(
                address(poolManager),
                uint256(amt0)
            );
        }

        if (amt1 > 0) {
            MockERC20(token1).transfer(
                address(poolManager),
                uint256(amt1)
            );
        }
    }
}