// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IERC20Minimal} from "@uniswap/v4-core/interfaces/external/IERC20Minimal.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {CustomRevert} from "@uniswap/v4-core/libraries/CustomRevert.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";

import "../src/AllocationLedger.sol";
import "../src/HookFlags.sol";
import "../src/MockERC20.sol";
import "../src/MockRWAOracle.sol";
import "../src/MockUSDC.sol";
import "../src/PoolExecutor.sol";
import "../src/RWAComplyHook.sol";

contract AllocationJourneyTest is Test {
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint256 internal constant CAP = 1_000_000_000;
    uint256 internal constant SIGNER_KEY = 0xA11CE;

    PoolManager internal manager;
    RWAComplyHook internal hook;
    AllocationLedger internal ledger;
    PoolExecutor internal router;
    MockUSDC internal usdc;
    MockERC20 internal rwa;
    PoolKey internal key;

    address internal aliceA;
    address internal aliceB;
    address internal bob;
    bytes32 internal groupId = keccak256("rwa-comply-demo");
    bytes32 internal aliceId = keccak256("alice");
    bytes32 internal bobId = keccak256("bob");
    uint256 internal periodId = 1;

    function setUp() public {
        (manager, hook, usdc, rwa, key) = _market(true);
        ledger = new AllocationLedger(address(this), vm.addr(SIGNER_KEY));
        router = new PoolExecutor(manager, address(usdc), address(rwa), address(hook));
        ledger.setPolicy(groupId, periodId, CAP, address(usdc));
        ledger.setAuthorizedHook(address(hook));
        hook.setTrustedRouter(address(router));
        hook.setQuoteTokens(address(usdc), address(rwa));
        hook.setLedger(address(ledger));
        hook.setAllocation(groupId, periodId);

        aliceA = makeAddr("alice-a");
        aliceB = makeAddr("alice-b");
        bob = makeAddr("bob");
        _prepare(aliceA, aliceId, 1);
        _prepare(aliceB, aliceId, 2);
        _prepare(bob, bobId, 3);
    }

    function testSharedIdentityPurchasesRecordSettledUsdc() public {
        uint256 aliceBefore = _spent(aliceId);
        uint256 paidA = _buy(aliceA, 700_000_000);
        assertEq(paidA, 700_000_000);
        assertEq(_spent(aliceId), aliceBefore + paidA);
        assertNotEq(rwa.balanceOf(aliceA), paidA);

        uint256 spentAfterA = _spent(aliceId);
        uint256 left = ledger.remaining(aliceB, groupId, periodId);
        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(hook),
                IHooks.beforeSwap.selector,
                abi.encodeWithSelector(RWAComplyHook.AllocationExceeded.selector, 500_000_000, left),
                abi.encodeWithSelector(Hooks.HookCallFailed.selector)
            )
        );
        vm.prank(aliceB);
        router.swapExactInput(key, 500_000_000);
        assertEq(_spent(aliceId), spentAfterA);
        assertEq(usdc.balanceOf(aliceB), 2_000_000_000);

        uint256 paidB = _buy(aliceB, 200_000_000);
        assertEq(paidB, 200_000_000);
        assertEq(_spent(aliceId), 900_000_000);
        assertEq(ledger.remaining(aliceA, groupId, periodId), 100_000_000);
        assertEq(ledger.remaining(aliceB, groupId, periodId), 100_000_000);

        uint256 paidBob = _buy(bob, 900_000_000);
        assertEq(paidBob, 900_000_000);
        assertEq(_spent(bobId), 900_000_000);
        assertEq(ledger.remaining(bob, groupId, periodId), 100_000_000);
        assertEq(_spent(aliceId), 900_000_000);
    }

    function testUsdcAsCurrencyOneRecordsTheUsdcLeg() public {
        (PoolManager otherManager, RWAComplyHook otherHook, MockUSDC otherUsdc, MockERC20 otherRwa, PoolKey memory otherKey) =
            _market(false);
        AllocationLedger otherLedger = new AllocationLedger(address(this), vm.addr(SIGNER_KEY));
        PoolExecutor otherRouter = new PoolExecutor(otherManager, address(otherUsdc), address(otherRwa), address(otherHook));
        otherLedger.setPolicy(groupId, periodId, CAP, address(otherUsdc));
        otherLedger.setAuthorizedHook(address(otherHook));
        otherHook.setTrustedRouter(address(otherRouter));
        otherHook.setQuoteTokens(address(otherUsdc), address(otherRwa));
        otherHook.setLedger(address(otherLedger));
        otherHook.setAllocation(groupId, periodId);

        address trader = makeAddr("currency-one");
        otherHook.setTier(trader, 2);
        uint256 expiry = block.timestamp + 1 days;
        otherLedger.registerWallet(trader, aliceId, groupId, expiry, 11, _sign(otherLedger, trader, aliceId, expiry, 11));
        otherUsdc.mint(trader, 100_000_000);
        vm.prank(trader);
        otherUsdc.approve(address(otherRouter), 100_000_000);

        uint256 beforeUsdc = otherUsdc.balanceOf(trader);
        uint256 beforeRwa = otherRwa.balanceOf(trader);
        vm.prank(trader);
        otherRouter.swapExactInput(otherKey, 100_000_000);

        uint256 paid = beforeUsdc - otherUsdc.balanceOf(trader);
        uint256 received = otherRwa.balanceOf(trader) - beforeRwa;
        assertEq(paid, 100_000_000);
        assertNotEq(received, paid);
        assertEq(otherLedger.spentByAllocation(aliceId, groupId, periodId), paid);
        assertGt(uint160(address(otherUsdc)), uint160(address(otherRwa)));
    }

    function testOverBudgetPurchaseMovesNothing() public {
        uint256 paid = _buy(aliceA, 700_000_000);
        uint256 spent = _spent(aliceId);
        uint256 bal = usdc.balanceOf(aliceB);
        uint256 left = ledger.remaining(aliceB, groupId, periodId);
        vm.expectRevert(
            abi.encodeWithSelector(
                CustomRevert.WrappedError.selector,
                address(hook),
                IHooks.beforeSwap.selector,
                abi.encodeWithSelector(RWAComplyHook.AllocationExceeded.selector, CAP, left),
                abi.encodeWithSelector(Hooks.HookCallFailed.selector)
            )
        );
        vm.prank(aliceB);
        router.swapExactInput(key, CAP);
        assertEq(_spent(aliceId), spent);
        assertEq(usdc.balanceOf(aliceB), bal);
        assertEq(paid, 700_000_000);
    }

    function testSettlementFailureRecordsNoSpend() public {
        vm.prank(aliceA);
        usdc.approve(address(router), 0);
        uint256 bal = usdc.balanceOf(aliceA);

        vm.expectRevert();
        vm.prank(aliceA);
        router.swapExactInput(key, 100_000_000);

        assertEq(_spent(aliceId), 0);
        assertEq(usdc.balanceOf(aliceA), bal);
        assertEq(rwa.balanceOf(aliceA), 0);
    }

    function testLedgerRejectionRollsBackTheSwap() public {
        ledger.setAuthorizedHook(address(0xBEEF));
        uint256 bal = usdc.balanceOf(bob);

        vm.expectRevert();
        vm.prank(bob);
        router.swapExactInput(key, 100_000_000);

        assertEq(_spent(bobId), 0);
        assertEq(usdc.balanceOf(bob), bal);
        assertEq(rwa.balanceOf(bob), 0);
    }

    function testSellingRwaDoesNotReduceSpend() public {
        uint256 paid = _buy(aliceA, 100_000_000);
        assertEq(_spent(aliceId), paid);

        DirectedSwap seller = new DirectedSwap(manager);
        hook.setTrustedRouter(address(seller));
        bool sellingRwa = Currency.unwrap(key.currency0) == address(rwa);

        vm.expectRevert();
        seller.swap(key, sellingRwa, 1, aliceA);

        assertEq(_spent(aliceId), paid);
        hook.setTrustedRouter(address(router));
    }

    function testUnauthorizedAccountCannotRecordSpend() public {
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.HookNotAuthorized.selector, address(this)));
        ledger.recordSpend(aliceA, groupId, periodId, 1);
    }

    function _buy(address trader, uint256 amount) internal returns (uint256 paid) {
        uint256 beforeUsdc = usdc.balanceOf(trader);
        vm.prank(trader);
        router.swapExactInput(key, amount);
        paid = beforeUsdc - usdc.balanceOf(trader);
    }

    function _spent(bytes32 allocationId) internal view returns (uint256) {
        return ledger.spentByAllocation(allocationId, groupId, periodId);
    }

    function _prepare(address wallet, bytes32 allocationId, uint256 nonce) internal {
        hook.setTier(wallet, 2);
        uint256 expiry = block.timestamp + 1 days;
        ledger.registerWallet(wallet, allocationId, groupId, expiry, nonce, _sign(ledger, wallet, allocationId, expiry, nonce));
        usdc.mint(wallet, 2_000_000_000);
        vm.prank(wallet);
        usdc.approve(address(router), type(uint256).max);
    }

    function _sign(
        AllocationLedger budget,
        address wallet,
        bytes32 allocationId,
        uint256 expiry,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash =
            keccak256(abi.encode(budget.REGISTRATION_TYPEHASH(), wallet, allocationId, groupId, expiry, nonce));
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) = budget.eip712Domain();
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                keccak256(
                    abi.encode(
                        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                        keccak256(bytes(name)),
                        keccak256(bytes(version)),
                        chainId,
                        verifyingContract
                    )
                ),
                structHash
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _market(bool usdcIsCurrency0)
        internal
        returns (PoolManager pool, RWAComplyHook deployed, MockUSDC quote, MockERC20 asset, PoolKey memory poolKey)
    {
        pool = new PoolManager(address(0));
        MockRWAOracle oracle = new MockRWAOracle(address(this));
        deployed = _deployHook(pool, oracle);
        (quote, asset) = _pair(usdcIsCurrency0);
        poolKey = _key(address(quote), address(asset), address(deployed));
        pool.initialize(poolKey, SQRT_PRICE_1_1);

        JourneyLiquidity liquidity = new JourneyLiquidity(pool);
        deployed.setTier(address(liquidity), 2);
        quote.mint(address(liquidity), 1e30);
        asset.mint(address(liquidity), 1e30);
        liquidity.add(poolKey);
    }

    function _pair(bool usdcIsCurrency0) internal returns (MockUSDC quote, MockERC20 asset) {
        for (uint256 i = 0; i < 30; i++) {
            MockUSDC candidateQuote = new MockUSDC{salt: keccak256(abi.encode("usdc", usdcIsCurrency0, i))}();
            MockERC20 candidateAsset = new MockERC20{salt: keccak256(abi.encode("rwa", usdcIsCurrency0, i))}("RWA", "RWA", 0);
            if ((address(candidateQuote) < address(candidateAsset)) == usdcIsCurrency0) {
                return (candidateQuote, candidateAsset);
            }
        }
        revert("pair order");
    }

    function _key(address tokenA, address tokenB, address hooks) internal pure returns (PoolKey memory poolKey) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(hooks)
        });
    }

    function _deployHook(PoolManager pool, MockRWAOracle oracle) internal returns (RWAComplyHook deployed) {
        uint160 permissions = HookFlags.toFlags(HookFlags.declared());
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(type(RWAComplyHook).creationCode, abi.encode(IPoolManager(address(pool)), address(oracle), address(this)))
        );
        for (uint256 i = 0; i < 1_000_000; i++) {
            bytes32 salt = bytes32(i);
            address predicted =
                address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)))));
            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == permissions) {
                deployed = new RWAComplyHook{salt: salt}(IPoolManager(address(pool)), address(oracle), address(this));
                require(address(deployed) == predicted, "hook mismatch");
                return deployed;
            }
        }
        revert("no hook salt");
    }
}

contract JourneyLiquidity is IUnlockCallback {
    IPoolManager public immutable poolManager;

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    function add(PoolKey calldata key) external {
        poolManager.unlock(abi.encode(key));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "only manager");
        PoolKey memory key = abi.decode(data, (PoolKey));
        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -60, tickUpper: 60, liquidityDelta: 1e24, salt: bytes32(0)}),
            ""
        );
        _settle(key.currency0, delta.amount0());
        _settle(key.currency1, delta.amount1());
        return "";
    }

    function _settle(Currency currency, int128 amount) internal {
        if (amount < 0) {
            uint256 pay = uint256(uint128(-amount));
            poolManager.sync(currency);
            IERC20Minimal(Currency.unwrap(currency)).transfer(address(poolManager), pay);
            poolManager.settle();
        } else if (amount > 0) {
            poolManager.take(currency, address(this), uint256(uint128(amount)));
        }
    }
}

contract DirectedSwap is IUnlockCallback {
    IPoolManager public immutable poolManager;

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    function swap(PoolKey calldata key, bool zeroForOne, uint256 amountIn, address trader) external {
        poolManager.unlock(abi.encode(key, zeroForOne, amountIn, trader));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "only manager");
        (PoolKey memory key, bool zeroForOne, uint256 amountIn, address trader) =
            abi.decode(data, (PoolKey, bool, uint256, address));
        poolManager.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? 4295128740 : 1461446703485210103287273052203988822378723970341
            }),
            abi.encode(trader)
        );
        return "";
    }
}
