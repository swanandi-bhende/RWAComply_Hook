// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";

/// @notice Single description of the callbacks this hook enables, and the CREATE2 search used to match them.
library HookFlags {
    function declared() internal pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function toFlags(Hooks.Permissions memory permissions) internal pure returns (uint160 flags) {
        if (permissions.beforeInitialize) flags |= Hooks.BEFORE_INITIALIZE_FLAG;
        if (permissions.afterInitialize) flags |= Hooks.AFTER_INITIALIZE_FLAG;
        if (permissions.beforeAddLiquidity) flags |= Hooks.BEFORE_ADD_LIQUIDITY_FLAG;
        if (permissions.afterAddLiquidity) flags |= Hooks.AFTER_ADD_LIQUIDITY_FLAG;
        if (permissions.beforeRemoveLiquidity) flags |= Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG;
        if (permissions.afterRemoveLiquidity) flags |= Hooks.AFTER_REMOVE_LIQUIDITY_FLAG;
        if (permissions.beforeSwap) flags |= Hooks.BEFORE_SWAP_FLAG;
        if (permissions.afterSwap) flags |= Hooks.AFTER_SWAP_FLAG;
        if (permissions.beforeDonate) flags |= Hooks.BEFORE_DONATE_FLAG;
        if (permissions.afterDonate) flags |= Hooks.AFTER_DONATE_FLAG;
        if (permissions.beforeSwapReturnDelta) flags |= Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG;
        if (permissions.afterSwapReturnDelta) flags |= Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG;
        if (permissions.afterAddLiquidityReturnDelta) flags |= Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG;
        if (permissions.afterRemoveLiquidityReturnDelta) flags |= Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;
    }

    function mine(address deployer, bytes32 initCodeHash, uint160 flags)
        internal
        pure
        returns (bytes32 salt, address predicted)
    {
        for (uint256 i = 0; i < 1_000_000; i++) {
            salt = bytes32(i);
            predicted = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash))))
            );
            if (uint160(predicted) & Hooks.ALL_HOOK_MASK == flags) return (salt, predicted);
        }
        revert("no hook salt");
    }
}
