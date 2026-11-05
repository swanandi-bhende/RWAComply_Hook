// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "forge-std/console.sol";

import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";

import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";

import "./AllocationLedger.sol";
import "./HookFlags.sol";
import "./MockRWAOracle.sol";

contract RWAComplyHook is IHooks, Ownable {

    error AccessDenied();
    error PoolPaused();
    error RetailLimitExceeded();
    error OnlyPoolManager();
    error ZeroAddress();
    error UntrustedRouter(address sender);
    error MalformedHookData();
    error ZeroTrader();
    error ExactInputRequired();
    error UnsupportedInputCurrency();
    error InvalidPool();
    error LedgerNotConfigured();
    error AllocationNotConfigured();
    error AllocationExceeded(uint256 amount, uint256 remaining);
    error PurchaseInProgress();
    error UnexpectedSwapDelta();
    error SettledInputExceedsQuote(uint256 settled, uint256 quoted);

    uint8 constant RETAIL = 1;
    uint8 constant INSTITUTIONAL = 2;

    mapping(address => uint8) public userTier;

    IPoolManager public immutable poolManager;
    address public oracle;

    /// @notice The only account allowed to call PoolManager.swap for this hook.
    address public trustedRouter;

    /// @notice Input token. Raw units, six decimals for USDC.
    address public usdc;

    /// @notice Output token for the supported purchase pair.
    address public rwaToken;

    /// @notice Budget ledger. Spend is not written during beforeSwap.
    AllocationLedger public ledger;

    /// @notice Allocation group and period checked by this hook.
    bytes32 public allocationGroupId;
    uint256 public allocationPeriodId;

    /// @notice Quote captured in beforeSwap and consumed by afterSwap of the same purchase.
    struct Purchase {
        address trader;
        bytes32 groupId;
        uint256 periodId;
        uint256 quotedInput;
        bool active;
    }

    Purchase private purchase;

    uint256 public volatilityThreshold = 5;
    uint256 public retailSwapCap = 1e18;
    bool public poolPaused;

    event TierUpdated(address indexed user, uint8 tier);
    event VolatilityThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event RetailSwapCapUpdated(uint256 oldCap, uint256 newCap);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event BeforeSwapCalled(address indexed user, uint8 tier, uint24 fee);
    event AfterSwapCalled(address indexed user);

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    constructor(
        IPoolManager _poolManager,
        address _oracle,
        address owner_
    )
        Ownable(owner_)
    {
        if (_oracle == address(0)) revert ZeroAddress();

        poolManager = _poolManager;
        oracle = _oracle;

        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return HookFlags.declared();
    }

    function setTier(address user, uint8 tier) external onlyOwner {
        userTier[user] = tier;
        emit TierUpdated(user, tier);
    }

    function setPoolPaused(bool paused) external onlyOwner {
        poolPaused = paused;
    }

    function setVolatilityThreshold(uint256 newThreshold) external onlyOwner {
        uint256 oldThreshold = volatilityThreshold;
        volatilityThreshold = newThreshold;
        emit VolatilityThresholdUpdated(oldThreshold, newThreshold);
    }

    function setRetailSwapCap(uint256 newCap) external onlyOwner {
        uint256 oldCap = retailSwapCap;
        retailSwapCap = newCap;
        emit RetailSwapCapUpdated(oldCap, newCap);
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();

        address oldOracle = oracle;
        oracle = newOracle;
        emit OracleUpdated(oldOracle, newOracle);
    }

    /// @notice Set the only router allowed to swap through this hook.
    function setTrustedRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert ZeroAddress();
        trustedRouter = router_;
    }

    /// @notice Set the supported USDC input token and RWA output token.
    function setQuoteTokens(address usdc_, address rwa_) external onlyOwner {
        if (usdc_ == address(0) || rwa_ == address(0)) revert ZeroAddress();
        if (usdc_ == rwa_) revert InvalidPool();
        usdc = usdc_;
        rwaToken = rwa_;
    }

    /// @notice Set the ledger whose remaining budget is checked before a purchase.
    function setLedger(address ledger_) external onlyOwner {
        if (ledger_ == address(0)) revert ZeroAddress();
        ledger = AllocationLedger(ledger_);
    }

    /// @notice Select the allocation group and period this hook enforces.
    function setAllocation(bytes32 groupId, uint256 periodId) external onlyOwner {
        if (groupId == bytes32(0)) revert AllocationNotConfigured();
        allocationGroupId = groupId;
        allocationPeriodId = periodId;
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
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    )
        external
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (poolPaused) revert PoolPaused();
        if (purchase.active) revert PurchaseInProgress();
        if (trustedRouter == address(0) || sender != trustedRouter) revert UntrustedRouter(sender);

        address trader = _trader(hookData);
        if (params.amountSpecified >= 0) revert ExactInputRequired();
        uint256 amountIn = uint256(-params.amountSpecified);

        address inputCurrency = params.zeroForOne ? Currency.unwrap(key.currency0) : Currency.unwrap(key.currency1);
        address outputCurrency = params.zeroForOne ? Currency.unwrap(key.currency1) : Currency.unwrap(key.currency0);
        if (inputCurrency != usdc) revert UnsupportedInputCurrency();
        if (outputCurrency != rwaToken) revert InvalidPool();

        uint8 tier = userTier[trader];
        if (tier == 0) revert AccessDenied();
        if (tier == RETAIL && amountIn > retailSwapCap) revert RetailLimitExceeded();

        if (address(ledger) == address(0)) revert LedgerNotConfigured();
        if (allocationGroupId == bytes32(0)) revert AllocationNotConfigured();
        uint256 budget = ledger.remaining(trader, allocationGroupId, allocationPeriodId);
        if (amountIn > budget) revert AllocationExceeded(amountIn, budget);

        purchase = Purchase({
            trader: trader,
            groupId: allocationGroupId,
            periodId: allocationPeriodId,
            quotedInput: amountIn,
            active: true
        });

        uint24 fee = getDynamicFee(trader);
        emit BeforeSwapCalled(trader, tier, fee);

        uint24 feeForSwap = fee;
        if (key.fee == LPFeeLibrary.DYNAMIC_FEE_FLAG) {
            feeForSwap = fee | LPFeeLibrary.OVERRIDE_FEE_FLAG;
        }

        return (
            IHooks.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            feeForSwap
        );
    }

    /// @dev Router hook data is abi.encode(trader). Any other shape is rejected.
    function _trader(bytes calldata hookData) private pure returns (address trader) {
        if (hookData.length != 32) revert MalformedHookData();

        uint256 word;
        assembly ("memory-safe") {
            word := calldataload(hookData.offset)
        }
        if (word >> 160 != 0) revert MalformedHookData();

        trader = address(uint160(word));
        if (trader == address(0)) revert ZeroTrader();
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    )
        external
        override
        onlyPoolManager
        returns (bytes4, int128)
    {
        if (!purchase.active || sender != trustedRouter) revert UntrustedRouter(sender);
        if (_trader(hookData) != purchase.trader) revert UnexpectedSwapDelta();

        uint256 settled = _settledUsdcInput(key, params, delta);
        if (settled > purchase.quotedInput) revert SettledInputExceedsQuote(settled, purchase.quotedInput);

        address trader = purchase.trader;
        bytes32 groupId = purchase.groupId;
        uint256 periodId = purchase.periodId;

        ledger.recordSpend(trader, groupId, periodId, settled);
        purchase.active = false;
        emit AfterSwapCalled(trader);

        return (IHooks.afterSwap.selector, 0);
    }

    /// @dev A negative USDC leg is currency the pool took from the router. That is the purchase.
    function _settledUsdcInput(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta
    ) private view returns (uint256 settled) {
        address inputCurrency = params.zeroForOne ? Currency.unwrap(key.currency0) : Currency.unwrap(key.currency1);
        int128 inputDelta = params.zeroForOne ? delta.amount0() : delta.amount1();
        if (inputCurrency != usdc || inputDelta >= 0) revert UnexpectedSwapDelta();

        settled = uint256(uint128(-inputDelta));
        if (settled == 0) revert UnexpectedSwapDelta();
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