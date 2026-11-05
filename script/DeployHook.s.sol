// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/HookFlags.sol";
import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";

import "@uniswap/v4-core/interfaces/IPoolManager.sol";
import "@uniswap/v4-core/libraries/Hooks.sol";

contract DeployHook is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        require(deployerPrivateKey != 0, "PRIVATE_KEY missing");

        address poolManagerAddr = vm.envAddress("POOL_MANAGER");
        require(poolManagerAddr != address(0), "POOL_MANAGER missing");

        address deployerEOA = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        MockRWAOracle oracle = new MockRWAOracle(deployerEOA);

        IPoolManager poolManager = IPoolManager(poolManagerAddr);

        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode,
                abi.encode(poolManager, address(oracle), deployerEOA)
            )
        );

        address CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        (bytes32 salt, address predicted) =
            HookFlags.mine(CREATE2_DEPLOYER, bytecodeHash, HookFlags.toFlags(HookFlags.declared()));

        RWAComplyHook hook = new RWAComplyHook{salt: salt}(
            poolManager,
            address(oracle),
            deployerEOA
        );

        require(address(hook) == predicted, "Hook mismatch");

        require(
            uint160(address(hook)) & Hooks.ALL_HOOK_MASK == HookFlags.toFlags(hook.getHookPermissions()),
            "Invalid hook address"
        );

        oracle.setVolatility(3);
        hook.setTier(deployerEOA, 2);

        vm.stopBroadcast();

        console.log("Hook:", address(hook));
        console.log("Oracle:", address(oracle));
    }
}