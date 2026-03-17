// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";
import "@uniswap/v4-core/interfaces/IPoolManager.sol";

contract DeployHook is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MockRWAOracle oracle = new MockRWAOracle();

        address poolManagerAddress = vm.envAddress("POOL_MANAGER");
        IPoolManager poolManager = IPoolManager(poolManagerAddress);

        RWAComplyHook hook = new RWAComplyHook(
            poolManager,
            address(oracle)
        );

        oracle.setVolatility(3);

        address deployer = vm.addr(deployerPrivateKey);
        hook.setTier(deployer, 2);

        vm.stopBroadcast();

        console.log("Oracle deployed at:", address(oracle));
        console.log("Hook deployed at:", address(hook));
        console.log("Using PoolManager:", poolManagerAddress);
    }
}