// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {PoolId} from "@uniswap/v4-core/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";

import {AllocationLedger} from "./AllocationLedger.sol";
import {HookFlags} from "./HookFlags.sol";
import {IOfferingConfig} from "./IMarketplace.sol";
import {TradeIntent} from "./TradeIntent.sol";

/// @title MarketplaceHook
/// @notice Enforces one offering policy per pool. The deployed single-group hook is unchanged.
contract MarketplaceHook is IHooks, Ownable, EIP712 {
    using PoolIdLibrary for PoolKey;

    error OnlyPoolManager();
    error UntrustedRouter(address sender);
    error MalformedHookData();
    error ExactInputRequired();
    error UnsupportedInputCurrency();
    error InvalidPool();
    error OfferingInactive();
    error OfferingExpired();
    error WalletRevoked();
    error AccessDenied();
    error AllocationExceeded(uint256 amount, uint256 remaining);
    error IntentRejected();
    error NonceUsed(uint256 nonce);
    error PurchaseInProgress();
    error UnexpectedSwapDelta();
    error SettledInputExceedsQuote(uint256 settled, uint256 quoted);
    error NotLiquidityOperator();

    IPoolManager public immutable poolManager;
    IOfferingConfig public immutable registry;
    AllocationLedger public immutable ledger;
    address public trustedRouter;

    struct Purchase {
        address trader;
        bytes32 groupId;
        uint256 periodId;
        uint256 quotedInput;
        bool active;
    }

    Purchase private purchase;
    mapping(uint256 => bool) public usedTradeNonce;

    event TradeAccepted(address indexed wallet, bytes32 indexed policyId, uint256 amountIn, uint32 policyVersion);

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    constructor(IPoolManager poolManager_, IOfferingConfig registry_, AllocationLedger ledger_, address owner_)
        Ownable(owner_)
        EIP712("RWAComplyTrade", "1")
    {
        if (address(poolManager_) == address(0) || address(registry_) == address(0) || address(ledger_) == address(0)) {
            revert InvalidPool();
        }
        poolManager = poolManager_;
        registry = registry_;
        ledger = ledger_;
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return HookFlags.declared();
    }

    function setTrustedRouter(address router) external onlyOwner {
        if (router == address(0)) revert InvalidPool();
        trustedRouter = router;
    }

    /// @notice Checks the signed intent without consuming its nonce.
    function checkTrade(TradeIntent.Trade calldata trade, bytes calldata signature, uint256 amountIn) external view {
        (bytes32 offeringId, IOfferingConfig.OfferingView memory offering) = registry.offeringForPool(trade.poolId);
        _checkIntent(trade, signature, trade.poolId, offeringId, offering, amountIn);
    }

    function beforeSwap(address sender, PoolKey calldata key, IPoolManager.SwapParams calldata params, bytes calldata hookData)
        external
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (purchase.active) revert PurchaseInProgress();
        if (trustedRouter == address(0) || sender != trustedRouter) revert UntrustedRouter(sender);
        if (params.amountSpecified >= 0) revert ExactInputRequired();
        uint256 amountIn = uint256(-params.amountSpecified);

        (TradeIntent.Trade memory trade, bytes memory signature) = abi.decode(hookData, (TradeIntent.Trade, bytes));
        bytes32 poolId = PoolId.unwrap(key.toId());
        (bytes32 offeringId, IOfferingConfig.OfferingView memory offering) = registry.offeringForPool(poolId);
        _checkOffering(offering, key, params);
        _checkIntent(trade, signature, poolId, offeringId, offering, amountIn);
        if (registry.isPurchaseBlocked(offeringId, trade.wallet)) revert WalletRevoked();
        if (registry.investorTier(offeringId, trade.wallet) == 0) revert AccessDenied();

        uint256 budget = ledger.remaining(trade.wallet, offering.groupId, offering.periodId);
        if (amountIn > budget) revert AllocationExceeded(amountIn, budget);

        usedTradeNonce[trade.nonce] = true;
        purchase = Purchase({
            trader: trade.wallet,
            groupId: offering.groupId,
            periodId: offering.periodId,
            quotedInput: amountIn,
            active: true
        });
        emit TradeAccepted(trade.wallet, offeringId, amountIn, offering.version);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, int128) {
        if (!purchase.active || sender != trustedRouter) revert UntrustedRouter(sender);
        (TradeIntent.Trade memory trade,) = abi.decode(hookData, (TradeIntent.Trade, bytes));
        if (trade.wallet != purchase.trader) revert UnexpectedSwapDelta();
        uint256 settled = _settledUsdcInput(key, params, delta);
        if (settled > purchase.quotedInput) revert SettledInputExceedsQuote(settled, purchase.quotedInput);
        ledger.recordSpend(purchase.trader, purchase.groupId, purchase.periodId, settled);
        purchase.active = false;
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeAddLiquidity(address sender, PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external
        override
        onlyPoolManager
        returns (bytes4)
    {
        (bytes32 offeringId, IOfferingConfig.OfferingView memory offering) = registry.offeringForPool(PoolId.unwrap(key.toId()));
        if (sender != offering.liquidityOperator && sender != offering.issuer) revert NotLiquidityOperator();
        offeringId;
        return IHooks.beforeAddLiquidity.selector;
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external override returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external override returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function afterAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        override
        returns (bytes4, BalanceDelta)
    {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external
        override
        returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        override
        returns (bytes4, BalanceDelta)
    {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external override returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external override returns (bytes4) {
        return IHooks.afterDonate.selector;
    }

    function _checkOffering(
        IOfferingConfig.OfferingView memory offering,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params
    ) private view {
        if (!offering.exists || offering.paused) revert OfferingInactive();
        if (block.timestamp < offering.startTime || block.timestamp > offering.endTime) revert OfferingExpired();
        address input = params.zeroForOne ? Currency.unwrap(key.currency0) : Currency.unwrap(key.currency1);
        address output = params.zeroForOne ? Currency.unwrap(key.currency1) : Currency.unwrap(key.currency0);
        if (input != registry.usdc()) revert UnsupportedInputCurrency();
        if (output != offering.rwa) revert InvalidPool();
    }

    function _checkIntent(
        TradeIntent.Trade memory trade,
        bytes memory signature,
        bytes32 poolId,
        bytes32 offeringId,
        IOfferingConfig.OfferingView memory offering,
        uint256 amountIn
    ) private view {
        if (trade.wallet == address(0) || trade.recipient == address(0)) revert IntentRejected();
        if (trade.poolId != poolId || trade.policyId != offeringId) revert IntentRejected();
        if (trade.allocationGroupId != offering.groupId || trade.periodId != offering.periodId) revert IntentRejected();
        if (trade.policyVersion != offering.version || trade.amountIn != amountIn) revert IntentRejected();
        if (trade.chainId != block.chainid || trade.executor != trustedRouter) revert IntentRejected();
        if (block.timestamp > trade.deadline) revert IntentRejected();
        if (usedTradeNonce[trade.nonce]) revert NonceUsed(trade.nonce);
        bytes32 digest = _hashTypedDataV4(TradeIntent.hash(trade));
        if (ECDSA.recover(digest, signature) != trade.wallet) revert IntentRejected();
    }

    function _settledUsdcInput(PoolKey calldata key, IPoolManager.SwapParams calldata params, BalanceDelta delta)
        private
        view
        returns (uint256 settled)
    {
        address inputCurrency = params.zeroForOne ? Currency.unwrap(key.currency0) : Currency.unwrap(key.currency1);
        int128 inputDelta = params.zeroForOne ? delta.amount0() : delta.amount1();
        if (inputCurrency != registry.usdc() || inputDelta >= 0) revert UnexpectedSwapDelta();
        settled = uint256(uint128(-inputDelta));
        if (settled == 0) revert UnexpectedSwapDelta();
    }
}
