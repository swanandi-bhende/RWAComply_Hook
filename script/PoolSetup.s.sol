// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

import {TickMath} from "@uniswap/v4-core/libraries/TickMath.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";

contract MockToken is ERC20 {
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
    {
        _mint(msg.sender, 1e24);
    }
}

contract PoolSetup is Script {

    function run() external {
        vm.startBroadcast();

        // ---------- TOKENS ----------
        MockToken token0 = new MockToken("TokenA", "TKA");
        MockToken token1 = new MockToken("TokenB", "TKB");

        // enforce ordering
        address t0 = address(token0);
        address t1 = address(token1);
        if (t0 > t1) (t0, t1) = (t1, t0);

        // ---------- POOL MANAGER ----------
        PoolManager poolManager = new PoolManager(address(0));

        // ---------- ORACLE ----------
        MockRWAOracle oracle = new MockRWAOracle();

        // ---------- HOOK ----------
        RWAComplyHook hook = new RWAComplyHook(address(oracle));

        // IMPORTANT: set permissions bitmap
        hook.setPermissions(
            true,  // beforeSwap
            true,  // afterSwap
            true,  // beforeModifyPosition
            false, false, false, false, false
        );

        // ---------- USER TIER ----------
        hook.setTier(msg.sender, 2);

        // ---------- POOL KEY ----------
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(t0),
            currency1: Currency.wrap(t1),
            fee: 3000,
            tickSpacing: 60,
            hooks: address(hook)
        });

        // ---------- INITIALIZE ----------
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(0);
        poolManager.initialize(key, sqrtPriceX96);

        // ---------- APPROVAL ----------
        ERC20(t0).approve(address(poolManager), type(uint256).max);
        ERC20(t1).approve(address(poolManager), type(uint256).max);

        // ---------- ADD LIQUIDITY ----------
        IPoolManager.ModifyLiquidityParams memory liquidityParams =
            IPoolManager.ModifyLiquidityParams({
                tickLower: -120,
                tickUpper: 120,
                liquidityDelta: 1e18,
                salt: bytes32(0)
            });

        poolManager.modifyLiquidity(key, liquidityParams, "");

        // ---------- SWAP ----------
        IPoolManager.SwapParams memory swapParams =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e17),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO + 1
            });

        poolManager.swap(key, swapParams, "");

        vm.stopBroadcast();

        console.log("=== DEPLOYMENTS ===");
        console.log("PoolManager:", address(poolManager));
        console.log("Hook:", address(hook));
        console.log("Oracle:", address(oracle));
        console.log("Token0:", t0);
        console.log("Token1:", t1);
    }
}