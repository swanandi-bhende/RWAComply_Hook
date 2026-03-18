// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

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

        vm.stopBroadcast();
    }
}