// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v4-core/interfaces/IHooks.sol";
import "@uniswap/v4-core/interfaces/IPoolManager.sol";
import "@uniswap/v4-core/types/PoolKey.sol";
import "@uniswap/v4-core/types/BalanceDelta.sol";
import "@uniswap/v4-core/libraries/Hooks.sol";
import "./MockRWAOracle.sol";

contract RWAComplyHook is IHooks, Ownable {

    error AccessDenied();

    uint8 constant RETAIL = 1;
    uint8 constant INSTITUTIONAL = 2;

    mapping(address => uint8) public userTier;

    address public oracle;
    IPoolManager public poolManager;

    uint256 public volatilityThreshold = 5;

    event TierUpdated(address user, uint8 tier);
    event FeeAccrued(address user, uint256 amount);

    constructor(IPoolManager _poolManager, address _oracle) {
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

    function getHookPermissions()
        public
        pure
        returns (Hooks.Permissions memory)
    {
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
            beforeAddLiquidityReturnDelta: false,
            afterAddLiquidityReturnDelta: false
        });
    }

    function beforeSwap(
        address sender,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external override returns (bytes4) {
        uint8 tier = userTier[sender];
        if (tier == 0) revert AccessDenied();
        return IHooks.beforeSwap.selector;
    }

    function afterSwap(
        address sender,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    ) external override returns (bytes4) {
        uint256 fee = uint256(int256(delta.amount0()));
        emit FeeAccrued(sender, fee);
        return IHooks.afterSwap.selector;
    }

    function beforeAddLiquidity(
        address sender,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override returns (bytes4) {
        uint8 tier = userTier[sender];
        if (tier == 0) revert AccessDenied();
        return IHooks.beforeAddLiquidity.selector;
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
}