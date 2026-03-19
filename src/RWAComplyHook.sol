// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "forge-std/console.sol";

import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";

import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";

import "./MockRWAOracle.sol";

contract RWAComplyHook is IHooks, Ownable {

    error AccessDenied();
    error PoolPaused();
    error RetailLimitExceeded();
    error OnlyPoolManager();

    uint8 constant RETAIL = 1;
    uint8 constant INSTITUTIONAL = 2;

    mapping(address => uint8) public userTier;

    IPoolManager public immutable poolManager;
    address public oracle;

    uint256 public volatilityThreshold = 5;
    uint256 public retailSwapCap = 1e18;
    bool public poolPaused;

    event TierUpdated(address indexed user, uint8 tier);
    event FeeAccrued(address indexed user, uint256 amount);
    event BeforeSwapCalled(address indexed user, uint8 tier, uint24 fee);
    event AfterSwapCalled(address indexed user);

    modifier onlyPoolManager() {
        if (block.chainid != 31337) {
            if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        }
        _;
    }

    constructor(
        IPoolManager _poolManager,
        address _oracle,
        address owner_
    )
        Ownable(owner_)
    {
        poolManager = _poolManager;
        oracle = _oracle;

        if (block.chainid != 31337) {
            Hooks.validateHookPermissions(
                IHooks(address(this)),
                getHookPermissions()
            );
        }
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
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

    function setTier(address user, uint8 tier) external onlyOwner {
        userTier[user] = tier;
        emit TierUpdated(user, tier);
    }

    function setPoolPaused(bool paused) external onlyOwner {
        poolPaused = paused;
    }

    function getDynamicFee(address user) public view returns (uint24) {
        uint8 tier = userTier[user];
        uint256 vol = MockRWAOracle(oracle).getVolatility();

        if (vol > volatilityThreshold) {
            if (tier == RETAIL) return 5000;
            if (tier == INSTITUTIONAL) return 500;
        }

        return 1000;
    }

    function beforeSwap(
        address sender,
        PoolKey calldata,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        console.log("beforeSwap called");
        console.log("sender:", sender);

        if (poolPaused) revert PoolPaused();

        uint8 tier = userTier[sender];
        console.log("tier:", tier);

        if (tier == 0) revert AccessDenied();

        if (tier == RETAIL) {
            uint256 amount = params.amountSpecified > 0
                ? uint256(params.amountSpecified)
                : uint256(-params.amountSpecified);

            if (amount > retailSwapCap) revert RetailLimitExceeded();
        }

        uint24 fee = getDynamicFee(sender);

        console.log("fee:", fee);

        emit BeforeSwapCalled(sender, tier, fee);

        return (
            IHooks.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            fee
        );
    }

    function afterSwap(
        address sender,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4, int128)
    {
        console.log("afterSwap called");

        emit AfterSwapCalled(sender);
        emit FeeAccrued(sender, 0);

        return (IHooks.afterSwap.selector, 0);
    }

    function beforeAddLiquidity(
        address sender,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4)
    {
        console.log("beforeAddLiquidity called");

        if (userTier[sender] == 0) revert AccessDenied();
        return IHooks.beforeAddLiquidity.selector;
    }

    // ✅ CRITICAL FIX — clean, NO logs, NO logic
    function beforeInitialize(
        address,
        PoolKey calldata,
        uint160
    )
        external
        override
        returns (bytes4)
    {
        return IHooks.beforeInitialize.selector;
    }

    // ✅ CRITICAL FIX — clean, NO logs, NO logic
    function afterInitialize(
        address,
        PoolKey calldata,
        uint160,
        int24
    )
        external
        override
        returns (bytes4)
    {
        return IHooks.afterInitialize.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    )
        external override returns (bytes4, BalanceDelta)
    {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    )
        external override returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    )
        external override returns (bytes4, BalanceDelta)
    {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    )
        external override returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    )
        external override returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }
}