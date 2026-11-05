// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";

import "../src/AllocationLedger.sol";
import "../src/HookFlags.sol";
import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";

contract RWAComplyTest is Test {

    RWAComplyHook hook;
    MockRWAOracle oracle;
    PoolManager poolManager;

    address user = address(1);
    address router = address(0xA11);
    address usdc = address(0x1111);
    address rwa = address(0x2222);
    bytes32 groupId = keccak256("group");
    uint256 signerKey = 0xA11CE;
    AllocationLedger ledger;

    function setUp() public {
        oracle = new MockRWAOracle(address(this));
        poolManager = new PoolManager(address(0));

        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode,
                abi.encode(IPoolManager(address(poolManager)), address(oracle), address(this))
            )
        );
        (bytes32 salt, address predicted) =
            HookFlags.mine(address(this), initCodeHash, HookFlags.toFlags(HookFlags.declared()));
        hook = new RWAComplyHook{salt: salt}(IPoolManager(address(poolManager)), address(oracle), address(this));
        require(address(hook) == predicted, "hook mismatch");
    }

    function testRevertIfUnverified() public {
        _configurePurchase();
        (PoolKey memory key, IPoolManager.SwapParams memory params) = _purchaseParams();

        vm.expectRevert(RWAComplyHook.AccessDenied.selector);
        vm.prank(address(poolManager));
        hook.beforeSwap(router, key, params, abi.encode(user));
    }

    function testRetailFee() public {
        _configurePurchase();
        hook.setTier(user, 1);
        _register(user, 1);
        oracle.setVolatility(10);

        (PoolKey memory key, IPoolManager.SwapParams memory params) = _purchaseParams();
        vm.prank(address(poolManager));
        (, , uint24 fee) = hook.beforeSwap(router, key, params, abi.encode(user));

        assertTrue(fee == 5000);
    }

    function testInstitutionalFee() public {
        _configurePurchase();
        hook.setTier(user, 2);
        _register(user, 1);
        oracle.setVolatility(10);

        (PoolKey memory key, IPoolManager.SwapParams memory params) = _purchaseParams();
        vm.prank(address(poolManager));
        (, , uint24 fee) = hook.beforeSwap(router, key, params, abi.encode(user));

        assertTrue(fee == 500);
    }

    function testPause() public {
        _configurePurchase();
        hook.setTier(user, 2);
        _register(user, 1);
        hook.setPoolPaused(true);

        (PoolKey memory key, IPoolManager.SwapParams memory params) = _purchaseParams();
        vm.expectRevert(RWAComplyHook.PoolPaused.selector);
        vm.prank(address(poolManager));
        hook.beforeSwap(router, key, params, abi.encode(user));
    }

    function testOnlyOwnerCanSetVolatility() public {
        vm.prank(user);
        vm.expectRevert();
        oracle.setVolatility(10);
    }

    function testOwnerCanSetVolatility() public {
        oracle.setVolatility(7);
        assertEq(oracle.getVolatility(), 7);
    }

    function testOwnerCanUpdateHookConfig() public {
        MockRWAOracle newOracle = new MockRWAOracle(address(this));

        hook.setVolatilityThreshold(9);
        hook.setRetailSwapCap(2e18);
        hook.setOracle(address(newOracle));

        assertEq(hook.volatilityThreshold(), 9);
        assertEq(hook.retailSwapCap(), 2e18);
        assertEq(hook.oracle(), address(newOracle));
    }

    function testNonOwnerCannotUpdateHookConfig() public {
        vm.startPrank(user);

        vm.expectRevert();
        hook.setVolatilityThreshold(9);

        vm.expectRevert();
        hook.setRetailSwapCap(2e18);

        vm.expectRevert();
        hook.setOracle(address(oracle));

        vm.stopPrank();
    }

    function testSetOracleZeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(RWAComplyHook.ZeroAddress.selector));
        hook.setOracle(address(0));
    }

    function _configurePurchase() internal {
        ledger = new AllocationLedger(address(this), vm.addr(signerKey));
        ledger.setPolicy(groupId, 1, 1_000_000_000, usdc);
        hook.setTrustedRouter(router);
        hook.setQuoteTokens(usdc, rwa);
        hook.setLedger(address(ledger));
        hook.setAllocation(groupId, 1);
    }

    function _purchaseParams() internal view returns (PoolKey memory key, IPoolManager.SwapParams memory params) {
        key = PoolKey({
            currency0: Currency.wrap(usdc),
            currency1: Currency.wrap(rwa),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        params = IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -int256(1_000_000), sqrtPriceLimitX96: 0});
    }

    function _register(address wallet, uint256 nonce) internal {
        uint256 expiry = block.timestamp + 1 days;
        bytes32 allocationId = keccak256("allocation");
        ledger.registerWallet(
            wallet,
            allocationId,
            groupId,
            expiry,
            nonce,
            _sign(wallet, allocationId, groupId, expiry, nonce)
        );
    }

    function _sign(address wallet, bytes32 allocationId, bytes32 group, uint256 expiry, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(ledger.REGISTRATION_TYPEHASH(), wallet, allocationId, group, expiry, nonce));
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) = ledger.eip712Domain();
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                keccak256(
                    abi.encode(
                        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                        keccak256(bytes(name)),
                        keccak256(bytes(version)),
                        chainId,
                        verifyingContract
                    )
                ),
                structHash
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }
}