// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";

contract RWAComplyTest is Test {

    RWAComplyHook hook;
    MockRWAOracle oracle;
    PoolManager poolManager;

    address user = address(1);

    function setUp() public {
        oracle = new MockRWAOracle();
        poolManager = new PoolManager(address(0));

        hook = new RWAComplyHook(
            IPoolManager(address(poolManager)),
            address(oracle),
            address(this)
        );
    }

    function testRevertIfUnverified() public {
        PoolKey memory key;

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e18),
                sqrtPriceLimitX96: 0
            });

        vm.expectRevert();
        hook.beforeSwap(user, key, params, "");
    }

    function testRetailFee() public {
        hook.setTier(user, 1);

        PoolKey memory key;

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e18),
                sqrtPriceLimitX96: 0
            });

        (, , uint24 fee) = hook.beforeSwap(user, key, params, "");

        assertTrue(fee > 0);
    }

    function testInstitutionalFee() public {
        hook.setTier(user, 2);

        PoolKey memory key;

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e18),
                sqrtPriceLimitX96: 0
            });

        (, , uint24 fee) = hook.beforeSwap(user, key, params, "");

        assertTrue(fee < 1000);
    }

    function testPause() public {
        hook.setTier(user, 2);
        hook.setPoolPaused(true);

        PoolKey memory key;

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e18),
                sqrtPriceLimitX96: 0
            });

        vm.expectRevert();
        hook.beforeSwap(user, key, params, "");
    }
}