// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../lib/v4-core/src/PoolManager.sol";

contract DeployCore is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        address controller = vm.addr(deployerPrivateKey);

        PoolManager poolManager = new PoolManager(controller);

        vm.stopBroadcast();

        console.log("PoolManager:", address(poolManager));
    }
}