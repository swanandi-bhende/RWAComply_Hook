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
        oracle = new MockRWAOracle(address(this));
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
        oracle.setVolatility(10);

        PoolKey memory key;

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e18),
                sqrtPriceLimitX96: 0
            });

        (, , uint24 fee) = hook.beforeSwap(user, key, params, "");

        assertTrue(fee == 5000);
    }

    function testInstitutionalFee() public {
        hook.setTier(user, 2);
        oracle.setVolatility(10);

        PoolKey memory key;

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e18),
                sqrtPriceLimitX96: 0
            });

        (, , uint24 fee) = hook.beforeSwap(user, key, params, "");

        assertTrue(fee == 500);
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

    function testOnlyOwnerCanSetVolatility() public {
        vm.prank(user);
        vm.expectRevert();
        oracle.setVolatility(10);
    }

    function testOwnerCanSetVolatility() public {
        oracle.setVolatility(7);
        assertEq(oracle.getVolatility(), 7);
    }

    function testOwnerCanUpdateHookConfig() public {
        MockRWAOracle newOracle = new MockRWAOracle(address(this));

        hook.setVolatilityThreshold(9);
        hook.setRetailSwapCap(2e18);
        hook.setOracle(address(newOracle));

        assertEq(hook.volatilityThreshold(), 9);
        assertEq(hook.retailSwapCap(), 2e18);
        assertEq(hook.oracle(), address(newOracle));
    }

    function testNonOwnerCannotUpdateHookConfig() public {
        vm.startPrank(user);

        vm.expectRevert();
        hook.setVolatilityThreshold(9);

        vm.expectRevert();
        hook.setRetailSwapCap(2e18);

        vm.expectRevert();
        hook.setOracle(address(oracle));

        vm.stopPrank();
    }

    function testSetOracleZeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(RWAComplyHook.ZeroAddress.selector));
        hook.setOracle(address(0));
    }
}