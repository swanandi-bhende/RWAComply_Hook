// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";
import "../src/MockERC20.sol";

import "@uniswap/v4-core/interfaces/IPoolManager.sol";
import "@uniswap/v4-core/interfaces/IHooks.sol";

import "@uniswap/v4-core/types/PoolKey.sol";
import "@uniswap/v4-core/types/Currency.sol";

import "@uniswap/v4-core/libraries/Hooks.sol";

contract PoolSetup is Script {

    function run() external {

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        require(deployerPrivateKey != 0, "PRIVATE_KEY missing");

        address poolManagerAddr = vm.envAddress("POOL_MANAGER");
        require(poolManagerAddr != address(0), "POOL_MANAGER missing");

        address deployerEOA = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // ---------------- DEPLOY CORE ----------------

        IPoolManager poolManager = IPoolManager(poolManagerAddr);

        MockRWAOracle oracle = new MockRWAOracle();

        // ---------------- FIND VALID HOOK ADDRESS ----------------

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

            if (i == 999999) revert("No valid salt found");
        }

        // ---------------- DEPLOY HOOK ----------------

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

        // ---------------- DEPLOY TOKENS ----------------

        MockERC20 tokenA = new MockERC20("TokenA", "TKA", 1e24);
        MockERC20 tokenB = new MockERC20("TokenB", "TKB", 1e24);

        // ---------------- SORT TOKENS ----------------

        (address token0, address token1) =
            address(tokenA) < address(tokenB)
                ? (address(tokenA), address(tokenB))
                : (address(tokenB), address(tokenA));

        // ---------------- CREATE POOL KEY ----------------

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        // ---------------- INITIALIZE POOL ----------------

        uint160 sqrtPriceX96 = 79228162514264337593543950336;

        poolManager.initialize(key, sqrtPriceX96);

        vm.stopBroadcast();

        // ---------------- LOG EVERYTHING ----------------

        console.log("PoolManager:", address(poolManager));
        console.log("Hook:", address(hook));
        console.log("Oracle:", address(oracle));
        console.log("TokenA:", address(tokenA));
        console.log("TokenB:", address(tokenB));
    }
}