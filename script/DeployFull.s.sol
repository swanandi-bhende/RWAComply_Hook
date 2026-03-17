// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";

contract DeployFull is Script {

    function run() external {
        vm.startBroadcast();

        PoolManager poolManager = new PoolManager(address(0));
        MockRWAOracle oracle = new MockRWAOracle();

        RWAComplyHook hook = new RWAComplyHook(
            IPoolManager(address(poolManager)),
            address(oracle)
        );

        vm.stopBroadcast();
    }
}