// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";

contract DeployCore is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        require(deployerPrivateKey != 0, "PRIVATE_KEY missing");

        vm.startBroadcast(deployerPrivateKey);

        // For local testing → no controller needed
        PoolManager poolManager = new PoolManager(address(0));

        vm.stopBroadcast();

        console.log("POOL_MANAGER:", address(poolManager));
    }
}