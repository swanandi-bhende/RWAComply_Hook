// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";

import "../src/MockERC20.sol";
import "../src/MockRWAOracle.sol";
import "../src/PoolExecutor.sol";
import "../src/RWAComplyHook.sol";

contract DeployFull is Script {

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint160 internal constant REQUIRED_HOOK_PERMISSIONS =
        Hooks.BEFORE_INITIALIZE_FLAG |
        Hooks.AFTER_INITIALIZE_FLAG |
        Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
        Hooks.BEFORE_SWAP_FLAG |
        Hooks.AFTER_SWAP_FLAG;
    address internal constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        require(pk != 0, "PRIVATE_KEY missing");

        address deployerEOA = vm.addr(pk);

        vm.startBroadcast(pk);

        PoolManager poolManager = new PoolManager(address(0));
        MockRWAOracle oracle = new MockRWAOracle(deployerEOA);

        (bytes32 salt, address predictedHook) = _findValidHookSalt(
            IPoolManager(address(poolManager)),
            address(oracle),
            deployerEOA
        );

        RWAComplyHook hook = new RWAComplyHook{salt: salt}(
            IPoolManager(address(poolManager)),
            address(oracle),
            deployerEOA
        );

        require(address(hook) == predictedHook, "Hook mismatch");
        require(
            uint160(address(hook)) & Hooks.ALL_HOOK_MASK == REQUIRED_HOOK_PERMISSIONS,
            "Invalid hook address"
        );

        oracle.setVolatility(3);

        MockERC20 tokenA = new MockERC20("TokenA", "TKA", 1e24);
        MockERC20 tokenB = new MockERC20("TokenB", "TKB", 1e24);

        (address token0, address token1) =
            address(tokenA) < address(tokenB)
                ? (address(tokenA), address(tokenB))
                : (address(tokenB), address(tokenA));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        poolManager.initialize(key, SQRT_PRICE_1_1);

        PoolExecutor executor = new PoolExecutor(
            IPoolManager(address(poolManager)),
            key
        );

        hook.setTier(address(executor), 2);

        tokenA.transfer(address(executor), 1e21);
        tokenB.transfer(address(executor), 1e21);

        executor.execute();

        vm.stopBroadcast();

        console.log("CANONICAL FLOW COMPLETE");
        console.log("POOL_MANAGER:", address(poolManager));
        console.log("HOOK_ADDRESS:", address(hook));
        console.log("ORACLE:", address(oracle));
        console.log("TOKEN_A:", address(tokenA));
        console.log("TOKEN_B:", address(tokenB));
        console.log("EXECUTOR:", address(executor));
        console.log("BROADCAST:", "broadcast/DeployFull.s.sol/31337/run-latest.json");
        console.log("RUN:", "node script/generateDemoRunLog.js");
    }

    function _findValidHookSalt(
        IPoolManager poolManager,
        address oracle,
        address owner
    ) internal pure returns (bytes32 salt, address predicted) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode,
                abi.encode(poolManager, oracle, owner)
            )
        );

        for (uint256 i = 0; i < 1_000_000; i++) {
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

            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == REQUIRED_HOOK_PERMISSIONS) {
                return (salt, predicted);
            }
        }

        revert("No valid hook salt");
    }
}