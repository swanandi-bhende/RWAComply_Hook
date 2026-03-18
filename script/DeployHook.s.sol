// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";

import "@uniswap/v4-core/interfaces/IPoolManager.sol";
import "@uniswap/v4-core/libraries/Hooks.sol";

contract DeployHook is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerEOA = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        MockRWAOracle oracle = new MockRWAOracle();

        IPoolManager poolManager = IPoolManager(
            vm.envAddress("POOL_MANAGER")
        );

        uint160 permissions =
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.AFTER_INITIALIZE_FLAG |
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.AFTER_SWAP_FLAG;

        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode,
                abi.encode(poolManager, address(oracle), deployerEOA)
            )
        );

        address CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

        bytes32 salt;
        address predicted;

        for (uint256 i = 0; i < 1000000; i++) {
            salt = bytes32(i);

            predicted = address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                CREATE2_DEPLOYER,
                                salt,
                                bytecodeHash
                            )
                        )
                    )
                )
            );

            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == permissions) {
                console.log("FOUND SALT:", i);
                console.log("Predicted:", predicted);
                break;
            }

            if (i == 999999) revert("No salt found");
        }

        RWAComplyHook hook = new RWAComplyHook{salt: salt}(
            poolManager,
            address(oracle),
            deployerEOA
        );

        require(address(hook) == predicted, "Hook mismatch");

        require(
            uint160(address(hook)) & Hooks.ALL_HOOK_MASK == permissions,
            "Invalid hook address"
        );

        oracle.setVolatility(3);
        hook.setTier(deployerEOA, 2);

        vm.stopBroadcast();

        console.log("Hook:", address(hook));
        console.log("Oracle:", address(oracle));
    }
}