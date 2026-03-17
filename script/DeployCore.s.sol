// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../lib/v4-core/src/PoolManager.sol";

contract DeployCore is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        address protocolFeeController = vm.addr(deployerPrivateKey);

        PoolManager poolManager = new PoolManager(protocolFeeController);

        vm.stopBroadcast();

        console.log("PoolManager deployed at:", address(poolManager));
        console.log("Protocol Fee Controller:", protocolFeeController);
    }
}