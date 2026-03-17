// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";

import "./MockRWAOracle.sol";

contract RWAComplyHook is IHooks, Ownable {

    // -------- ERRORS --------
    error AccessDenied();
    error PoolPaused();
    error RetailLimitExceeded();
    error OnlyPoolManager();

    // -------- CONSTANTS --------
    uint8 constant RETAIL = 1;
    uint8 constant INSTITUTIONAL = 2;

    // -------- STORAGE --------
    mapping(address => uint8) public userTier;

    IPoolManager public immutable poolManager;
    address public oracle;

    uint256 public volatilityThreshold = 5;
    uint256 public retailSwapCap = 1e18;
    bool public poolPaused;

    // -------- EVENTS --------
    event TierUpdated(address indexed user, uint8 tier);
    event FeeAccrued(address indexed user, uint256 amount);
    event PoolPauseUpdated(bool paused);
    event OracleUpdated(address oracle);

    // -------- MODIFIER --------
    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    // -------- CONSTRUCTOR --------
    constructor(IPoolManager _poolManager, address _oracle)
        Ownable(msg.sender)
    {
        poolManager = _poolManager;
        oracle = _oracle;
    }

    // -------- PERMISSIONS (CRITICAL FOR V4) --------
    function getHookPermissions() external pure returns (uint8) {
        return uint8(
            (1 << 0) | // beforeInitialize
            (1 << 1) | // afterInitialize
            (1 << 2) | // beforeAddLiquidity
            (1 << 4) | // beforeSwap
            (1 << 5)   // afterSwap
        );
    }

    // -------- ADMIN --------

    function setTier(address user, uint8 tier) external onlyOwner {
        userTier[user] = tier;
        emit TierUpdated(user, tier);
    }

    function revokeUser(address user) external onlyOwner {
        userTier[user] = 0;
        emit TierUpdated(user, 0);
    }

    function setOracle(address newOracle) external onlyOwner {
        oracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    function setVolatilityThreshold(uint256 newThreshold) external onlyOwner {
        volatilityThreshold = newThreshold;
    }

    function setRetailSwapCap(uint256 cap) external onlyOwner {
        retailSwapCap = cap;
    }

    function setPoolPaused(bool paused) external onlyOwner {
        poolPaused = paused;
        emit PoolPauseUpdated(paused);
    }

    // -------- CORE LOGIC --------

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
        if (poolPaused) revert PoolPaused();

        uint8 tier = userTier[sender];
        if (tier == 0) revert AccessDenied();

        if (tier == RETAIL) {
            uint256 amount = params.amountSpecified > 0
                ? uint256(params.amountSpecified)
                : uint256(-params.amountSpecified);

            if (amount > retailSwapCap) revert RetailLimitExceeded();
        }

        uint24 fee = getDynamicFee(sender);

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
        BalanceDelta delta,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4, int128)
    {
        int256 raw = int256(delta.amount0());
        uint256 fee = raw < 0 ? uint256(-raw) : uint256(raw);

        emit FeeAccrued(sender, fee);

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
        if (poolPaused) revert PoolPaused();
        if (userTier[sender] == 0) revert AccessDenied();

        return IHooks.beforeAddLiquidity.selector;
    }

    // -------- REACTIVE READY --------

    function reactiveUpdate(address user, uint8 newTier, bool pause) external {
        userTier[user] = newTier;
        poolPaused = pause;

        emit TierUpdated(user, newTier);
        emit PoolPauseUpdated(pause);
    }

    // -------- REQUIRED STUBS --------

    function beforeInitialize(address, PoolKey calldata, uint160)
        external override onlyPoolManager returns (bytes4)
    {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24)
        external override onlyPoolManager returns (bytes4)
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
        external override onlyPoolManager returns (bytes4, BalanceDelta)
    {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    )
        external override onlyPoolManager returns (bytes4)
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
        external override onlyPoolManager returns (bytes4, BalanceDelta)
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
        external override onlyPoolManager returns (bytes4)
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
        external override onlyPoolManager returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }
}