// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
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
import "../src/PoolExecutor.sol";
import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";
import "../src/MockERC20.sol";

contract PoolUser {

    error UnsupportedAction();

    IPoolManager public immutable poolManager;
    PoolKey public key;

    uint160 internal constant MIN_SQRT_PRICE_LIMIT = 4295128740;

    constructor(IPoolManager _poolManager, PoolKey memory _key) {
        poolManager = _poolManager;
        key = _key;
    }

    function addLiquidity() external {
        poolManager.unlock("ADD_LIQ");
    }

    function swap() external {
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
            IPoolManager.SwapParams memory params =
                IPoolManager.SwapParams({
                    zeroForOne: true,
                    amountSpecified: int256(1e18),
                    sqrtPriceLimitX96: MIN_SQRT_PRICE_LIMIT
                });

            BalanceDelta delta =
                poolManager.swap(key, params, "");

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

contract RWAComplyIntegrationTest is Test {

    event BeforeSwapCalled(address indexed user, uint8 tier, uint24 fee);

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 internal constant STATIC_FEE = 3000;
    bytes32 internal constant SWAP_EVENT_SIG =
        keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)");

    PoolManager internal poolManager;
    RWAComplyHook internal hook;
    MockRWAOracle internal oracle;
    MockERC20 internal tokenA;
    MockERC20 internal tokenB;

    PoolKey internal key;

    PoolUser internal liquidityUser;
    PoolUser internal unverifiedUser;
    PoolUser internal retailUser;
    PoolUser internal institutionalUser;

    AllocationLedger internal ledger;
    PoolExecutor internal router;
    address internal usdc;
    address internal rwa;
    address internal retailTrader;
    address internal institutionalTrader;
    bytes32 internal groupId = keccak256("group");
    uint256 internal periodId = 1;
    uint256 internal signerKey = 0xA11CE;
    uint256 internal constant SWAP_AMOUNT = 1_000_000;

    function setUp() public {
        poolManager = new PoolManager(address(0));
        oracle = new MockRWAOracle(address(this));

        hook = _deployHookWithValidAddress();

        tokenA = new MockERC20("TokenA", "TKA", 1e24);
        tokenB = new MockERC20("TokenB", "TKB", 1e24);

        (address token0, address token1) =
            address(tokenA) < address(tokenB)
                ? (address(tokenA), address(tokenB))
                : (address(tokenB), address(tokenA));

        key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        poolManager.initialize(key, SQRT_PRICE_1_1);

        liquidityUser = new PoolUser(IPoolManager(address(poolManager)), key);
        unverifiedUser = new PoolUser(IPoolManager(address(poolManager)), key);
        retailUser = new PoolUser(IPoolManager(address(poolManager)), key);
        institutionalUser = new PoolUser(IPoolManager(address(poolManager)), key);

        hook.setTier(address(liquidityUser), 2);
        hook.setTier(address(retailUser), 1);
        hook.setTier(address(institutionalUser), 2);

        _fund(address(liquidityUser), 1e21);
        _fund(address(unverifiedUser), 1e21);
        _fund(address(retailUser), 1e21);
        _fund(address(institutionalUser), 1e21);

        liquidityUser.addLiquidity();

        usdc = Currency.unwrap(key.currency0);
        rwa = Currency.unwrap(key.currency1);
        ledger = new AllocationLedger(address(this), vm.addr(signerKey));
        ledger.setPolicy(groupId, periodId, 1e30, usdc);
        router = new PoolExecutor(IPoolManager(address(poolManager)), usdc, rwa, address(hook));
        hook.setTrustedRouter(address(router));
        hook.setQuoteTokens(usdc, rwa);
        hook.setLedger(address(ledger));
        hook.setAllocation(groupId, periodId);
        ledger.setAuthorizedHook(address(hook));

        retailTrader = makeAddr("retail-trader");
        institutionalTrader = makeAddr("institutional-trader");
        hook.setTier(retailTrader, 1);
        hook.setTier(institutionalTrader, 2);
        _register(retailTrader, 1);
        _register(institutionalTrader, 2);

        MockERC20 quote = address(tokenA) == usdc ? tokenA : tokenB;
        quote.transfer(retailTrader, 100e18);
        quote.transfer(institutionalTrader, 100e18);
        vm.prank(retailTrader);
        quote.approve(address(router), type(uint256).max);
        vm.prank(institutionalTrader);
        quote.approve(address(router), type(uint256).max);
    }

    function _deployHookWithValidAddress() internal returns (RWAComplyHook deployed) {
        uint160 permissions = HookFlags.toFlags(HookFlags.declared());

        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode,
                abi.encode(
                    IPoolManager(address(poolManager)),
                    address(oracle),
                    address(this)
                )
            )
        );

        bytes32 salt;
        address predicted;
        bool found;

        for (uint256 i = 0; i < 1_000_000; i++) {
            salt = bytes32(i);

            predicted = address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                bytecodeHash
                            )
                        )
                    )
                )
            );

            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == permissions) {
                found = true;
                break;
            }
        }

        require(found, "No valid hook salt");

        deployed = new RWAComplyHook{salt: salt}(
            IPoolManager(address(poolManager)),
            address(oracle),
            address(this)
        );

        require(address(deployed) == predicted, "Hook mismatch");
    }

    function testTier0SwapRevertsThroughPoolManager() public {
        bytes memory expectedError = abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            address(hook),
            IHooks.beforeSwap.selector,
            abi.encodeWithSelector(RWAComplyHook.AccessDenied.selector),
            abi.encodeWithSelector(Hooks.HookCallFailed.selector)
        );

        address unverifiedTrader = makeAddr("unverified-trader");
        vm.prank(unverifiedTrader);
        vm.expectRevert(expectedError);
        router.swapExactInput(key, SWAP_AMOUNT);
    }

    function testTier0AddLiquidityRevertsThroughPoolManager() public {
        bytes memory expectedError = abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            address(hook),
            IHooks.beforeAddLiquidity.selector,
            abi.encodeWithSelector(RWAComplyHook.AccessDenied.selector),
            abi.encodeWithSelector(Hooks.HookCallFailed.selector)
        );

        vm.expectRevert(expectedError);
        unverifiedUser.addLiquidity();
    }

    function testTier1SwapPassesThroughPoolManager() public {
        vm.expectEmit(true, false, false, true, address(hook));
        emit BeforeSwapCalled(retailTrader, 1, 1000);

        vm.prank(retailTrader);
        router.swapExactInput(key, SWAP_AMOUNT);
    }

    function testTier2SwapPassesThroughPoolManager() public {
        vm.expectEmit(true, false, false, true, address(hook));
        emit BeforeSwapCalled(institutionalTrader, 2, 1000);

        vm.prank(institutionalTrader);
        router.swapExactInput(key, SWAP_AMOUNT);
    }

    function testFullFlowInitializeAddLiquidityAndSwap() public {
        PoolKey memory fullFlowKey = key;
        fullFlowKey.tickSpacing = 10;
        poolManager.initialize(fullFlowKey, SQRT_PRICE_1_1);

        PoolUser fullFlowUser = new PoolUser(IPoolManager(address(poolManager)), fullFlowKey);
        hook.setTier(address(fullFlowUser), 2);
        _fund(address(fullFlowUser), 1e21);
        fullFlowUser.addLiquidity();

        vm.expectEmit(true, false, false, true, address(hook));
        emit BeforeSwapCalled(institutionalTrader, 2, 1000);

        uint24 appliedFee = _swapAndGetAppliedFee(fullFlowKey, institutionalTrader);

        assertEq(appliedFee, 1000, "full flow executed fee mismatch");
    }

    function testPausedSwapRevertsThroughPoolManager() public {
        hook.setPoolPaused(true);

        bytes memory expectedError = abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            address(hook),
            IHooks.beforeSwap.selector,
            abi.encodeWithSelector(RWAComplyHook.PoolPaused.selector),
            abi.encodeWithSelector(Hooks.HookCallFailed.selector)
        );

        vm.expectRevert(expectedError);
        retailUser.swap();
    }

    function testDirectSwapRevertsThroughPoolManager() public {
        bytes memory expectedError = abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            address(hook),
            IHooks.beforeSwap.selector,
            abi.encodeWithSelector(RWAComplyHook.UntrustedRouter.selector, address(retailUser)),
            abi.encodeWithSelector(Hooks.HookCallFailed.selector)
        );

        vm.expectRevert(expectedError);
        retailUser.swap();
    }

    function testUntrustedRouterReverts() public {
        PoolExecutor other = new PoolExecutor(IPoolManager(address(poolManager)), usdc, rwa, address(hook));
        bytes memory expectedError = abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            address(hook),
            IHooks.beforeSwap.selector,
            abi.encodeWithSelector(RWAComplyHook.UntrustedRouter.selector, address(other)),
            abi.encodeWithSelector(Hooks.HookCallFailed.selector)
        );

        vm.prank(retailTrader);
        vm.expectRevert(expectedError);
        other.swapExactInput(key, SWAP_AMOUNT);
    }

    function testRetailCapExceededRevertsThroughPoolManager() public {
        hook.setRetailSwapCap(SWAP_AMOUNT - 1);

        bytes memory expectedError = abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            address(hook),
            IHooks.beforeSwap.selector,
            abi.encodeWithSelector(RWAComplyHook.RetailLimitExceeded.selector),
            abi.encodeWithSelector(Hooks.HookCallFailed.selector)
        );

        vm.prank(retailTrader);
        vm.expectRevert(expectedError);
        router.swapExactInput(key, SWAP_AMOUNT);
    }

    function testDynamicFeeAppliedDefaultLowVolatility() public {
        oracle.setVolatility(1);

        uint24 appliedFee = _swapAndGetAppliedFee(key, retailTrader);

        assertEq(appliedFee, 1000, "default low-vol fee mismatch");
    }

    function testDynamicFeeAppliedRetailHighVolatility() public {
        oracle.setVolatility(10);

        uint24 appliedFee = _swapAndGetAppliedFee(key, retailTrader);

        assertEq(appliedFee, 5000, "retail executed fee mismatch");
    }

    function testDynamicFeeAppliedInstitutionalHighVolatility() public {
        oracle.setVolatility(10);

        uint24 appliedFee = _swapAndGetAppliedFee(key, institutionalTrader);

        assertEq(appliedFee, 500, "institutional executed fee mismatch");
    }

    function testStaticFeePoolIgnoresHookOverride() public {
        oracle.setVolatility(10);

        PoolKey memory staticFeeKey = key;
        staticFeeKey.fee = STATIC_FEE;
        poolManager.initialize(staticFeeKey, SQRT_PRICE_1_1);

        PoolUser staticFeeUser = new PoolUser(IPoolManager(address(poolManager)), staticFeeKey);
        hook.setTier(address(staticFeeUser), 2);
        _fund(address(staticFeeUser), 1e21);
        staticFeeUser.addLiquidity();

        uint24 appliedFee = _swapAndGetAppliedFee(staticFeeKey, retailTrader);

        assertEq(appliedFee, STATIC_FEE, "static pool fee should ignore hook override");
    }

    function _swapAndGetAppliedFee(PoolKey memory poolKey, address trader) internal returns (uint24) {
        vm.recordLogs();
        vm.prank(trader);
        router.swapExactInput(poolKey, SWAP_AMOUNT);

        Vm.Log[] memory logs = vm.getRecordedLogs();

        for (uint256 i = logs.length; i > 0; i--) {
            Vm.Log memory logEntry = logs[i - 1];

            if (
                logEntry.emitter == address(poolManager)
                    && logEntry.topics.length == 3
                    && logEntry.topics[0] == SWAP_EVENT_SIG
                    && logEntry.topics[2] == bytes32(uint256(uint160(address(router))))
            ) {
                (, , , , , uint24 fee) = abi.decode(
                    logEntry.data,
                    (int128, int128, uint160, uint128, int24, uint24)
                );
                return fee;
            }
        }

        revert("Swap event not found");
    }

    function _fund(address user, uint256 amount) internal {
        tokenA.transfer(user, amount);
        tokenB.transfer(user, amount);
    }

    function _register(address wallet, uint256 nonce) internal {
        uint256 expiry = block.timestamp + 1 days;
        bytes32 allocationId = keccak256(abi.encode(wallet));
        ledger.registerWallet(wallet, allocationId, groupId, expiry, nonce, _sign(wallet, allocationId, expiry, nonce));
    }

    function _sign(address wallet, bytes32 allocationId, uint256 expiry, uint256 nonce) internal view returns (bytes memory) {
        bytes32 structHash =
            keccak256(abi.encode(ledger.REGISTRATION_TYPEHASH(), wallet, allocationId, groupId, expiry, nonce));
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) = ledger.eip712Domain();
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
