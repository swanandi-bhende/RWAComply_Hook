// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IUnlockCallback} from "@uniswap/v4-core/interfaces/callback/IUnlockCallback.sol";

import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

import {TickMath} from "@uniswap/v4-core/libraries/TickMath.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";


// ---------------- MOCK TOKEN ----------------

contract MockToken is ERC20 {
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
    {
        _mint(msg.sender, 1e24);
    }
}


// ---------------- UNLOCK HELPER ----------------

contract PoolActions is IUnlockCallback {

    IPoolManager public poolManager;

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    struct CallbackData {
        PoolKey key;
        IPoolManager.ModifyLiquidityParams liquidityParams;
        IPoolManager.SwapParams swapParams;
    }

    function execute(
        PoolKey memory key,
        IPoolManager.ModifyLiquidityParams memory liquidityParams,
        IPoolManager.SwapParams memory swapParams
    ) external {
        poolManager.unlock(
            abi.encode(CallbackData(key, liquidityParams, swapParams))
        );
    }

    function unlockCallback(bytes calldata data)
        external
        override
        returns (bytes memory)
    {
        require(msg.sender == address(poolManager), "Not pool manager");

        CallbackData memory decoded = abi.decode(data, (CallbackData));

        poolManager.modifyLiquidity(decoded.key, decoded.liquidityParams, "");
        poolManager.swap(decoded.key, decoded.swapParams, "");

        return "";
    }
}


// ---------------- SCRIPT ----------------

contract PoolSetup is Script {

    function run() external {
        vm.startBroadcast();

        // -------- DEPLOY TOKENS --------
        MockToken token0 = new MockToken("TokenA", "TKA");
        MockToken token1 = new MockToken("TokenB", "TKB");

        // enforce deterministic ordering
        address t0 = address(token0);
        address t1 = address(token1);
        if (t0 > t1) (t0, t1) = (t1, t0);

        // -------- DEPLOY POOL MANAGER --------
        PoolManager poolManager = new PoolManager(address(0));

        // -------- DEPLOY ORACLE --------
        MockRWAOracle oracle = new MockRWAOracle();

        // -------- DEPLOY HOOK --------
        RWAComplyHook hook = new RWAComplyHook(
            IPoolManager(address(poolManager)),
            address(oracle)
        );

        // -------- SET USER TIER --------
        hook.setTier(msg.sender, 2);

        // -------- CREATE POOL KEY --------
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(t0),
            currency1: Currency.wrap(t1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        // -------- INITIALIZE POOL --------
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(0);
        poolManager.initialize(key, sqrtPriceX96);

        // -------- APPROVE TOKENS --------
        ERC20(t0).approve(address(poolManager), type(uint256).max);
        ERC20(t1).approve(address(poolManager), type(uint256).max);

        // -------- PREPARE ACTIONS --------
        PoolActions actions = new PoolActions(IPoolManager(address(poolManager)));

        IPoolManager.ModifyLiquidityParams memory liquidityParams =
            IPoolManager.ModifyLiquidityParams({
                tickLower: -120,
                tickUpper: 120,
                liquidityDelta: 1e18,
                salt: bytes32(0)
            });

        IPoolManager.SwapParams memory swapParams =
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: int256(1e17),
                sqrtPriceLimitX96: 0
            });

        // -------- EXECUTE VIA UNLOCK --------
        actions.execute(key, liquidityParams, swapParams);

        vm.stopBroadcast();

        // -------- LOG OUTPUT --------
        console.log("PoolManager:", address(poolManager));
        console.log("Hook:", address(hook));
        console.log("Token0:", t0);
        console.log("Token1:", t1);
    }
}