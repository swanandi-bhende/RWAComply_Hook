// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";

import {AllocationLedger} from "../src/AllocationLedger.sol";
import {HookFlags} from "../src/HookFlags.sol";
import {IOfferingConfig} from "../src/IMarketplace.sol";
import {MarketplaceExecutor} from "../src/MarketplaceExecutor.sol";
import {MarketplaceHook} from "../src/MarketplaceHook.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {OfferingRegistry} from "../src/OfferingRegistry.sol";

/// @notice Local-only marketplace stack. It does not touch the deployed Sepolia market.
contract DeployMarketplace is Script {
    error NotLocal();

    function run() external {
        if (block.chainid != 31337) revert NotLocal();
        address signer = vm.envAddress("ALLOCATION_AUTH_SIGNER_ADDRESS");

        vm.startBroadcast();
        address owner = msg.sender;
        PoolManager manager = new PoolManager(owner);
        MockUSDC usdc = new MockUSDC();
        AllocationLedger ledger = new AllocationLedger(owner, signer);
        OfferingRegistry registry = new OfferingRegistry(ledger, address(usdc), owner);
        MarketplaceHook hook = _hook(manager, registry, ledger, owner);
        MarketplaceExecutor executor = new MarketplaceExecutor(manager, address(usdc), hook, owner);
        registry.setExecutor(executor);
        registry.setHook(address(hook));
        ledger.setAuthorizedHook(address(hook));
        ledger.transferOwnership(address(registry));
        hook.setTrustedRouter(address(executor));
        executor.transferOwnership(address(registry));
        vm.stopBroadcast();

        console.log("marketplace registry", address(registry));
        console.log("marketplace hook", address(hook));
        console.log("marketplace executor", address(executor));
    }

    function _hook(PoolManager manager, OfferingRegistry registry, AllocationLedger ledger, address owner)
        internal
        returns (MarketplaceHook deployed)
    {
        uint160 flags = HookFlags.toFlags(HookFlags.declared());
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(MarketplaceHook).creationCode,
                abi.encode(IPoolManager(address(manager)), IOfferingConfig(address(registry)), ledger, owner)
            )
        );
        for (uint256 i = 0; i < 1_000_000; i++) {
            bytes32 salt = bytes32(i);
            address predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), owner, salt, bytecodeHash)))));
            if (uint160(predicted) & Hooks.ALL_HOOK_MASK == flags) {
                return new MarketplaceHook{salt: salt}(manager, registry, ledger, owner);
            }
        }
        revert("no hook salt");
    }
}
