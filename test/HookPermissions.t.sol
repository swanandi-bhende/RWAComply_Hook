// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

import {HookFlags} from "../src/HookFlags.sol";
import {MockRWAOracle} from "../src/MockRWAOracle.sol";
import {RWAComplyHook} from "../src/RWAComplyHook.sol";

contract HookPermissionsTest is Test {
    uint256 internal constant OTHER_CHAIN_ID = 424242;

    PoolManager internal manager;
    MockRWAOracle internal oracle;
    RWAComplyHook internal hook;

    function setUp() public {
        manager = new PoolManager(address(0));
        oracle = new MockRWAOracle(address(this));
        hook = _deploy(oracle, HookFlags.toFlags(HookFlags.declared()));
    }

    function testDeclaredPermissionsMatchTheDeployedAddress() public view {
        uint160 flags = HookFlags.toFlags(hook.getHookPermissions());
        assertEq(uint160(address(hook)) & Hooks.ALL_HOOK_MASK, flags);
        assertTrue(flags & Hooks.BEFORE_SWAP_FLAG != 0);
        assertTrue(flags & Hooks.AFTER_SWAP_FLAG != 0);
        assertTrue(flags & Hooks.BEFORE_ADD_LIQUIDITY_FLAG != 0);
        assertEq(flags & Hooks.BEFORE_INITIALIZE_FLAG, 0);
        assertEq(flags & Hooks.AFTER_INITIALIZE_FLAG, 0);
        assertEq(flags & Hooks.AFTER_ADD_LIQUIDITY_FLAG, 0);
        assertEq(flags & Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG, 0);
        assertEq(flags & Hooks.AFTER_REMOVE_LIQUIDITY_FLAG, 0);
        assertEq(flags & Hooks.BEFORE_DONATE_FLAG, 0);
        assertEq(flags & Hooks.AFTER_DONATE_FLAG, 0);
        assertEq(flags & Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG, 0);
        assertEq(flags & Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG, 0);
        assertEq(flags & Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG, 0);
        assertEq(flags & Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG, 0);
    }

    function testWrongPermissionMaskIsRejectedOnTheLocalChain() public {
        (bytes32 salt, address predicted) = _salt(oracle, Hooks.BEFORE_INITIALIZE_FLAG);
        vm.expectRevert(abi.encodeWithSelector(Hooks.HookAddressNotValid.selector, predicted));
        new RWAComplyHook{salt: salt}(IPoolManager(address(manager)), address(oracle), address(this));
    }

    function testDirectCallbackFromAnotherAddressIsRejected() public {
        (PoolKey memory key, IPoolManager.SwapParams memory params) = _swap();
        vm.expectRevert(RWAComplyHook.OnlyPoolManager.selector);
        hook.beforeSwap(address(this), key, params, abi.encode(address(this)));

        vm.expectRevert(RWAComplyHook.OnlyPoolManager.selector);
        hook.afterSwap(address(this), key, params, BalanceDelta.wrap(0), abi.encode(address(this)));
    }

    function testValidationAlsoHoldsOnAnotherChainId() public {
        vm.chainId(OTHER_CHAIN_ID);
        MockRWAOracle otherOracle = new MockRWAOracle(address(this));
        RWAComplyHook other = _deploy(otherOracle, HookFlags.toFlags(HookFlags.declared()));
        assertEq(uint160(address(other)) & Hooks.ALL_HOOK_MASK, HookFlags.toFlags(other.getHookPermissions()));

        (bytes32 salt, address predicted) =
            _salt(otherOracle, Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG);
        vm.expectRevert(abi.encodeWithSelector(Hooks.HookAddressNotValid.selector, predicted));
        new RWAComplyHook{salt: salt}(IPoolManager(address(manager)), address(otherOracle), address(this));
    }

    function _deploy(MockRWAOracle volatility, uint160 flags) internal returns (RWAComplyHook deployed) {
        (bytes32 salt, address predicted) = _salt(volatility, flags);
        deployed = new RWAComplyHook{salt: salt}(IPoolManager(address(manager)), address(volatility), address(this));
        require(address(deployed) == predicted, "hook mismatch");
    }

    function _salt(MockRWAOracle volatility, uint160 flags) internal view returns (bytes32 salt, address predicted) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode,
                abi.encode(IPoolManager(address(manager)), address(volatility), address(this))
            )
        );
        return HookFlags.mine(address(this), initCodeHash, flags);
    }

    function _swap() internal view returns (PoolKey memory key, IPoolManager.SwapParams memory params) {
        key = PoolKey({
            currency0: Currency.wrap(address(0x1111)),
            currency1: Currency.wrap(address(0x2222)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        params = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 0});
    }
}
