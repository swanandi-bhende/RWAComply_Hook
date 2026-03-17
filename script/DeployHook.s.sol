// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";
import "@uniswap/v4-core/interfaces/IPoolManager.sol";

contract DeployHook is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MockRWAOracle oracle = new MockRWAOracle();

        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));

        RWAComplyHook hook = new RWAComplyHook(
            poolManager,
            address(oracle)
        );

        oracle.setVolatility(3);

        address deployer = vm.addr(deployerPrivateKey);
        hook.setTier(deployer, 2);

        vm.stopBroadcast();

        console.log("Oracle:", address(oracle));
        console.log("Hook:", address(hook));
    }
}