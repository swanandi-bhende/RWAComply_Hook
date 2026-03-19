// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {IERC20Minimal} from "@uniswap/v4-core/interfaces/external/IERC20Minimal.sol";

contract PoolExecutor {

    error UnsupportedAction();

    IPoolManager public poolManager;
    PoolKey public key;

    constructor(IPoolManager _poolManager, PoolKey memory _key) {
        poolManager = _poolManager;
        key = _key;
    }

    function execute() external {
        poolManager.unlock("ADD_LIQ");
        poolManager.unlock("SWAP");
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "only manager");

        bytes32 action = keccak256(data);

        if (action == keccak256("ADD_LIQ")) {

            IPoolManager.ModifyLiquidityParams memory params =
                IPoolManager.ModifyLiquidityParams({
                    tickLower: -60,
                    tickUpper: 60,
                    liquidityDelta: 1e6,
                    salt: bytes32(0)
                });

            (BalanceDelta delta,) =
                poolManager.modifyLiquidity(key, params, "");

            _settleAndTake(delta);

        } else if (action == keccak256("SWAP")) {

            IPoolManager.SwapParams memory swapParams =
                IPoolManager.SwapParams({
                    zeroForOne: true,
                    amountSpecified: int256(1e18),
                    sqrtPriceLimitX96: 4295128740
                });

            BalanceDelta delta =
                poolManager.swap(key, swapParams, "");

            _settleAndTake(delta);

        } else {
            revert UnsupportedAction();
        }

        return "";
    }

    function _settleAndTake(BalanceDelta delta) internal {
        _settleOrTake(key.currency0, delta.amount0());
        _settleOrTake(key.currency1, delta.amount1());
    }

    function _settleOrTake(Currency currency, int256 amount) internal {
        if (amount < 0) {
            uint256 amountToPay = uint256(-amount);

            if (Currency.unwrap(currency) == address(0)) {
                poolManager.settle{value: amountToPay}();
            } else {
                poolManager.sync(currency);
                IERC20Minimal(Currency.unwrap(currency)).transfer(
                    address(poolManager),
                    amountToPay
                );
                poolManager.settle();
            }
        } else if (amount > 0) {
            poolManager.take(currency, address(this), uint256(amount));
        }
    }

    receive() external payable {}
}