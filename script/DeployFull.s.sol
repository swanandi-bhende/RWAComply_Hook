// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

import "../src/MockERC20.sol";
import "../src/PoolExecutor.sol";
import "../src/RWAComplyHook.sol";

contract DeployFull is Script {

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external {

        uint256 pk = vm.envUint("PRIVATE_KEY");
        require(pk != 0, "PRIVATE_KEY missing");

        address poolManagerAddr = vm.envAddress("POOL_MANAGER");
        address hookAddr = vm.envAddress("HOOK_ADDRESS");
        address tokenAAddr = vm.envAddress("TOKEN_A");
        address tokenBAddr = vm.envAddress("TOKEN_B");

        require(poolManagerAddr != address(0), "POOL_MANAGER missing");
        require(hookAddr != address(0), "HOOK_ADDRESS missing");
        require(tokenAAddr != address(0), "TOKEN_A missing");
        require(tokenBAddr != address(0), "TOKEN_B missing");

        require(hookAddr != poolManagerAddr, "HOOK is PoolManager");
        require(tokenAAddr != tokenBAddr, "TOKEN_A == TOKEN_B");
        require(
            tokenAAddr != poolManagerAddr && tokenBAddr != poolManagerAddr,
            "TOKEN is PoolManager"
        );
        require(
            tokenAAddr != hookAddr && tokenBAddr != hookAddr,
            "TOKEN is hook"
        );

        IPoolManager poolManager = IPoolManager(poolManagerAddr);

        vm.startBroadcast(pk);

        MockERC20 tokenA = MockERC20(tokenAAddr);
        MockERC20 tokenB = MockERC20(tokenBAddr);

        tokenA.approve(address(poolManager), type(uint256).max);
        tokenB.approve(address(poolManager), type(uint256).max);

        (address token0, address token1) =
            tokenAAddr < tokenBAddr
                ? (tokenAAddr, tokenBAddr)
                : (tokenBAddr, tokenAAddr);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hookAddr)
        });

        poolManager.initialize(
            key,
            SQRT_PRICE_1_1
        );

        PoolExecutor executor = new PoolExecutor(poolManager, key);

        RWAComplyHook(hookAddr).setTier(address(executor), 2);

        tokenA.transfer(address(executor), 1e21);
        tokenB.transfer(address(executor), 1e21);

        executor.execute();

        vm.stopBroadcast();
    }
}