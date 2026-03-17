// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";

import "./MockRWAOracle.sol";

contract RWAComplyHook is IHooks, Ownable {

    error AccessDenied();

    uint8 constant RETAIL = 1;
    uint8 constant INSTITUTIONAL = 2;

    mapping(address => uint8) public userTier;

    address public oracle;
    IPoolManager public poolManager;
    uint256 public volatilityThreshold = 5;

    event TierUpdated(address indexed user, uint8 tier);
    event FeeAccrued(address indexed user, uint256 amount);

    constructor(IPoolManager _poolManager, address _oracle)
        Ownable(msg.sender)
    {
        poolManager = _poolManager;
        oracle = _oracle;
    }

    function setTier(address user, uint8 tier) external onlyOwner {
        userTier[user] = tier;
        emit TierUpdated(user, tier);
    }

    function setVolatilityThreshold(uint256 newThreshold) external onlyOwner {
        volatilityThreshold = newThreshold;
    }

    function setOracle(address newOracle) external onlyOwner {
        oracle = newOracle;
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

    // -------- CORE HOOKS --------

    function beforeSwap(
        address sender,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    )
        external
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (userTier[sender] == 0) revert AccessDenied();

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
        returns (bytes4, int128)
    {
        uint256 fee = uint256(int256(delta.amount0()));
        emit FeeAccrued(sender, fee);

        return (IHooks.afterSwap.selector, 0);
    }

    function beforeAddLiquidity(
        address sender,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override returns (bytes4) {
        if (userTier[sender] == 0) revert AccessDenied();
        return IHooks.beforeAddLiquidity.selector;
    }

    // -------- REQUIRED STUBS --------

    function beforeInitialize(address, PoolKey calldata, uint160)
        external
        override
        returns (bytes4)
    {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24)
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
    ) external override returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external override returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        return IHooks.afterDonate.selector;
    }
}