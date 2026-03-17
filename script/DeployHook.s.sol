// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";

import "../lib/v4-core/src/interfaces/IPoolManager.sol";

contract DeployHook is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // -----------------------------
        // 1. Deploy Oracle
        // -----------------------------
        MockRWAOracle oracle = new MockRWAOracle();

        // -----------------------------
        // 2. Load PoolManager
        // -----------------------------
        address poolManagerAddress = vm.envAddress("POOL_MANAGER");
        IPoolManager poolManager = IPoolManager(poolManagerAddress);

        // -----------------------------
        // 3. Deploy Hook
        // -----------------------------
        RWAComplyHook hook = new RWAComplyHook(
            poolManager,
            address(oracle)
        );

        // -----------------------------
        // 4. Basic Setup
        // -----------------------------
        oracle.setVolatility(3);

        address deployer = vm.addr(deployerPrivateKey);
        hook.setTier(deployer, 2); // institutional

        vm.stopBroadcast();

        console.log("Oracle deployed at:", address(oracle));
        console.log("Hook deployed at:", address(hook));
        console.log("Using PoolManager:", poolManagerAddress);
    }
}