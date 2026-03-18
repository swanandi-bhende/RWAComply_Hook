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

    function run() external {

        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        IPoolManager poolManager =
            IPoolManager(vm.envAddress("POOL_MANAGER"));

        address hookAddr = vm.envAddress("HOOK_ADDRESS");

        address tokenAAddr = vm.envAddress("TOKEN_A");
        address tokenBAddr = vm.envAddress("TOKEN_B");

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

        PoolExecutor executor = new PoolExecutor(poolManager, key);

        RWAComplyHook(hookAddr).setTier(address(executor), 2);

        executor.execute();

        vm.stopBroadcast();
    }
}