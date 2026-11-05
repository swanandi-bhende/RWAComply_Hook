// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUnlockCallback} from "@uniswap/v4-core/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {TickMath} from "@uniswap/v4-core/libraries/TickMath.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

/// @title PoolExecutor
/// @notice Trusted exact-input USDC router. The purchaser is always msg.sender.
/// @dev This contract does not check allocation budgets. The hook does that in a later step.
///      Amounts are raw token units. USDC is six decimals; this contract does not assume 18.
contract PoolExecutor is IUnlockCallback {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error AmountTooLarge();
    error InvalidPool();
    error UnsupportedInputCurrency();
    error NotPoolManager();
    error Reentrancy();
    error InsufficientOutput();
    error SettlementFailed();

    /// @notice PoolManager this router is allowed to unlock.
    IPoolManager public immutable poolManager;

    /// @notice The only accepted input token.
    address public immutable usdc;

    /// @notice The only accepted output token.
    address public immutable rwa;

    /// @notice Hook a pool must use to be tradable through this router.
    address public immutable trustedHook;

    /// @notice Set only while this router is inside its own unlock callback.
    bool private inSwap;

    /// @notice Purchaser captured from msg.sender before unlock. The callback does not accept another trader.
    address private activeTrader;

    /// @notice Requested exact-input amount, in raw USDC units.
    uint256 private activeAmount;

    /// @notice Emitted after the USDC debt is settled and the RWA output is taken to the trader.
    event ExactInputExecuted(address indexed trader, uint256 amountIn, uint256 usdcPaid, uint256 rwaReceived);

    constructor(IPoolManager poolManager_, address usdc_, address rwa_, address hook_) {
        if (address(poolManager_) == address(0) || usdc_ == address(0) || rwa_ == address(0) || hook_ == address(0)) {
            revert ZeroAddress();
        }
        if (usdc_ == rwa_) revert InvalidPool();

        poolManager = poolManager_;
        usdc = usdc_;
        rwa = rwa_;
        trustedHook = hook_;
    }

    /// @notice Buy RWA with an exact amount of USDC.
    /// @dev The trader and the output recipient are msg.sender. There is no trader, recipient, or hookData argument.
    ///      `amountIn` is raw USDC units.
    function swapExactInput(PoolKey calldata key, uint256 amountIn) external returns (BalanceDelta delta) {
        if (inSwap) revert Reentrancy();
        if (amountIn == 0) revert ZeroAmount();
        if (amountIn > uint256(type(int256).max)) revert AmountTooLarge();

        bool zeroForOne = _exactInputDirection(key);

        inSwap = true;
        activeTrader = msg.sender;
        activeAmount = amountIn;

        delta = abi.decode(poolManager.unlock(abi.encode(key, zeroForOne)), (BalanceDelta));

        inSwap = false;
        activeTrader = address(0);
        activeAmount = 0;
    }

    /// @notice PoolManager unlock callback. Settles the swap opened by `swapExactInput`.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager) || !inSwap) revert NotPoolManager();

        (PoolKey memory key, bool zeroForOne) = abi.decode(data, (PoolKey, bool));
        if (_exactInputDirection(key) != zeroForOne) revert InvalidPool();

        address trader = activeTrader;
        uint256 amountIn = activeAmount;

        BalanceDelta delta = poolManager.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            abi.encode(trader)
        );

        int128 usdcDelta = zeroForOne ? delta.amount0() : delta.amount1();
        int128 rwaDelta = zeroForOne ? delta.amount1() : delta.amount0();
        if (usdcDelta >= 0) revert SettlementFailed();

        uint256 usdcOwed = uint256(uint128(-usdcDelta));
        if (usdcOwed == 0 || usdcOwed > amountIn) revert SettlementFailed();
        if (rwaDelta <= 0) revert InsufficientOutput();

        IERC20 inputToken = IERC20(usdc);
        uint256 balanceBefore = inputToken.balanceOf(address(this));
        inputToken.safeTransferFrom(trader, address(this), usdcOwed);
        if (inputToken.balanceOf(address(this)) - balanceBefore != usdcOwed) revert SettlementFailed();

        Currency inputCurrency = zeroForOne ? key.currency0 : key.currency1;
        poolManager.sync(inputCurrency);
        inputToken.safeTransfer(address(poolManager), usdcOwed);
        if (poolManager.settle() != usdcOwed) revert SettlementFailed();

        Currency outputCurrency = zeroForOne ? key.currency1 : key.currency0;
        poolManager.take(outputCurrency, trader, uint256(uint128(rwaDelta)));

        emit ExactInputExecuted(trader, amountIn, usdcOwed, uint256(uint128(rwaDelta)));
        return abi.encode(delta);
    }

    /// @dev USDC as currency0 sells token0. USDC as currency1 sells token1.
    ///      The other currency must be the configured RWA token.
    function _exactInputDirection(PoolKey memory key) private view returns (bool zeroForOne) {
        address currency0 = Currency.unwrap(key.currency0);
        address currency1 = Currency.unwrap(key.currency1);
        if (currency0 >= currency1 || address(key.hooks) != trustedHook) revert InvalidPool();

        if (currency0 == usdc && currency1 == rwa) return true;
        if (currency0 == rwa && currency1 == usdc) return false;
        if (currency0 != usdc && currency1 != usdc) revert UnsupportedInputCurrency();
        revert InvalidPool();
    }
}
