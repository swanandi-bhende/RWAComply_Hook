// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";
import "../src/MockERC20.sol";

contract DeployFull is Script {

    function run() external {
        vm.startBroadcast();

        PoolManager poolManager = new PoolManager(address(0));

        MockRWAOracle oracle = new MockRWAOracle();

        RWAComplyHook hook = new RWAComplyHook(
            IPoolManager(address(poolManager)),
            address(oracle),
            msg.sender
        );

        MockERC20 tokenA = new MockERC20("TokenA", "TKA", 1e24);
        MockERC20 tokenB = new MockERC20("TokenB", "TKB", 1e24);

        tokenA.mint(msg.sender, 1e24);
        tokenB.mint(msg.sender, 1e24);

        tokenA.approve(address(poolManager), type(uint256).max);
        tokenB.approve(address(poolManager), type(uint256).max);

        (address token0, address token1) =
            address(tokenA) < address(tokenB)
                ? (address(tokenA), address(tokenB))
                : (address(tokenB), address(tokenA));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        poolManager.initialize(key, sqrtPriceX96);

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
                sqrtPriceLimitX96: 0
            });

        poolManager.swap(key, swapParams, "");

        vm.stopBroadcast();
    }
}