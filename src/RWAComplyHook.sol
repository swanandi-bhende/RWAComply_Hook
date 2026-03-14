// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@uniswap/v4-periphery/BaseHook.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MockRWAOracle.sol";

contract RWAComplyHook is BaseHook, Ownable {

    error AccessDenied();

    uint8 constant RETAIL = 1;
    uint8 constant INSTITUTIONAL = 2;

    mapping(address => uint8) public userTier;

    address public oracle;
    bytes32 public whitelistRoot;

    uint256 public volatilityThreshold = 5;

    event TierUpdated(address user, uint8 tier);
    event FeeAccrued(address user, uint256 amount);

    constructor(IPoolManager _poolManager, address _oracle)
        BaseHook(_poolManager)
    {
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
        override
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

        return BaseHook.beforeSwap.selector;
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

        return BaseHook.afterSwap.selector;
    }

    function beforeAddLiquidity(
        address sender,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override returns (bytes4) {

        uint8 tier = userTier[sender];

        if (tier == 0) revert AccessDenied();

        return BaseHook.beforeAddLiquidity.selector;
    }

    function getDynamicFee(address user) public view returns (uint24) {

        uint8 tier = userTier[user];
        uint256 vol = MockRWAOracle(oracle).getVolatility();

        if (vol > volatilityThreshold) {
            if (tier == RETAIL) return 5000;          // 0.5%
            if (tier == INSTITUTIONAL) return 500;    // 0.05%
        }

        return 1000; // default 0.1%
    }
}