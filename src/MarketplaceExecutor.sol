// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUnlockCallback} from "@uniswap/v4-core/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {TickMath} from "@uniswap/v4-core/libraries/TickMath.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";

import {IRwaApprover} from "./IMarketplace.sol";
import {MarketplaceHook} from "./MarketplaceHook.sol";
import {TradeIntent} from "./TradeIntent.sol";

/// @title MarketplaceExecutor
/// @notice Exact-input USDC purchases for approved RWA tokens. The signed intent names the wallet.
/// @dev USDC is pulled from the wallet in the intent. Output is paid to the signed recipient.
///      The approval spender is this contract, not the PoolManager.
contract MarketplaceExecutor is IUnlockCallback, Ownable, IRwaApprover {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;

    error ZeroAddress();
    error ZeroAmount();
    error AmountTooLarge();
    error InvalidPool();
    error UnsupportedInputCurrency();
    error NotPoolManager();
    error Reentrancy();
    error InsufficientOutput();
    error SettlementFailed();
    error TokenNotApproved();

    IPoolManager public immutable poolManager;
    address public immutable usdc;
    MarketplaceHook public immutable trustedHook;

    mapping(address => bool) public approvedRwa;
    bool private inSwap;
    TradeIntent.Trade private activeTrade;
    bytes private activeSignature;

    event ExactInputExecuted(address indexed trader, address indexed recipient, uint256 amountIn, uint256 usdcPaid, uint256 rwaReceived);

    constructor(IPoolManager poolManager_, address usdc_, MarketplaceHook hook_, address owner_) Ownable(owner_) {
        if (address(poolManager_) == address(0) || usdc_ == address(0) || address(hook_) == address(0)) revert ZeroAddress();
        poolManager = poolManager_;
        usdc = usdc_;
        trustedHook = hook_;
    }

    function approveRwa(address rwa, bool allowed) external onlyOwner {
        if (rwa == address(0) || rwa == usdc) revert ZeroAddress();
        approvedRwa[rwa] = allowed;
    }

    function swapWithIntent(PoolKey calldata key, TradeIntent.Trade calldata trade, bytes calldata signature)
        external
        returns (BalanceDelta delta)
    {
        if (inSwap) revert Reentrancy();
        if (trade.amountIn == 0) revert ZeroAmount();
        if (trade.amountIn > uint256(type(int256).max)) revert AmountTooLarge();
        if (trade.executor != address(this)) revert InvalidPool();
        if (trade.poolId != PoolId.unwrap(key.toId())) revert InvalidPool();
        bool zeroForOne = _exactInputDirection(key);
        trustedHook.checkTrade(trade, signature, trade.amountIn);

        inSwap = true;
        activeTrade = trade;
        activeSignature = signature;
        delta = abi.decode(poolManager.unlock(abi.encode(key, zeroForOne)), (BalanceDelta));
        inSwap = false;
        delete activeTrade;
        delete activeSignature;
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager) || !inSwap) revert NotPoolManager();
        (PoolKey memory key, bool zeroForOne) = abi.decode(data, (PoolKey, bool));
        if (_exactInputDirection(key) != zeroForOne) revert InvalidPool();

        TradeIntent.Trade memory trade = activeTrade;
        BalanceDelta delta = poolManager.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(trade.amountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            abi.encode(trade, activeSignature)
        );

        int128 usdcDelta = zeroForOne ? delta.amount0() : delta.amount1();
        int128 rwaDelta = zeroForOne ? delta.amount1() : delta.amount0();
        if (usdcDelta >= 0 || rwaDelta <= 0) revert SettlementFailed();
        uint256 usdcOwed = uint256(uint128(-usdcDelta));
        if (usdcOwed == 0 || usdcOwed > trade.amountIn) revert SettlementFailed();

        IERC20 inputToken = IERC20(usdc);
        uint256 balanceBefore = inputToken.balanceOf(address(this));
        inputToken.safeTransferFrom(trade.wallet, address(this), usdcOwed);
        if (inputToken.balanceOf(address(this)) - balanceBefore != usdcOwed) revert SettlementFailed();

        Currency inputCurrency = zeroForOne ? key.currency0 : key.currency1;
        poolManager.sync(inputCurrency);
        inputToken.safeTransfer(address(poolManager), usdcOwed);
        if (poolManager.settle() != usdcOwed) revert SettlementFailed();

        poolManager.take(zeroForOne ? key.currency1 : key.currency0, trade.recipient, uint256(uint128(rwaDelta)));
        emit ExactInputExecuted(trade.wallet, trade.recipient, trade.amountIn, usdcOwed, uint256(uint128(rwaDelta)));
        return abi.encode(delta);
    }

    function _exactInputDirection(PoolKey memory key) private view returns (bool zeroForOne) {
        address currency0 = Currency.unwrap(key.currency0);
        address currency1 = Currency.unwrap(key.currency1);
        if (currency0 >= currency1 || address(key.hooks) != address(trustedHook)) revert InvalidPool();
        if (currency0 == usdc && approvedRwa[currency1]) return true;
        if (approvedRwa[currency0] && currency1 == usdc) return false;
        if (currency0 != usdc && currency1 != usdc) revert UnsupportedInputCurrency();
        revert TokenNotApproved();
    }
}
