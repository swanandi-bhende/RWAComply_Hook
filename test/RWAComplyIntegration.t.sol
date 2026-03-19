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

    function setUp() public {
        poolManager = new PoolManager(address(0));
        oracle = new MockRWAOracle();

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
    }

    function _deployHookWithValidAddress() internal returns (RWAComplyHook deployed) {
        uint160 permissions =
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.AFTER_INITIALIZE_FLAG |
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.AFTER_SWAP_FLAG;

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

        vm.expectRevert(expectedError);
        unverifiedUser.swap();
    }

    function testTier1SwapPassesThroughPoolManager() public {
        vm.expectEmit(true, false, false, true, address(hook));
        emit BeforeSwapCalled(address(retailUser), 1, 1000);

        retailUser.swap();
    }

    function testTier2SwapPassesThroughPoolManager() public {
        vm.expectEmit(true, false, false, true, address(hook));
        emit BeforeSwapCalled(address(institutionalUser), 2, 1000);

        institutionalUser.swap();
    }

    function testFullFlowInitializeAddLiquidityAndSwap() public {
        MockERC20 tokenC = new MockERC20("TokenC", "TKC", 1e24);
        MockERC20 tokenD = new MockERC20("TokenD", "TKD", 1e24);

        (address token0, address token1) =
            address(tokenC) < address(tokenD)
                ? (address(tokenC), address(tokenD))
                : (address(tokenD), address(tokenC));

        PoolKey memory fullFlowKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        poolManager.initialize(fullFlowKey, SQRT_PRICE_1_1);

        PoolUser fullFlowUser =
            new PoolUser(IPoolManager(address(poolManager)), fullFlowKey);

        hook.setTier(address(fullFlowUser), 2);

        tokenC.transfer(address(fullFlowUser), 1e21);
        tokenD.transfer(address(fullFlowUser), 1e21);

        fullFlowUser.addLiquidity();

        vm.expectEmit(true, false, false, true, address(hook));
        emit BeforeSwapCalled(address(fullFlowUser), 2, 1000);

        uint24 appliedFee = _swapAndGetAppliedFee(fullFlowUser);

        assertEq(appliedFee, 1000, "full flow executed fee mismatch");
    }

    function testDynamicFeeAppliedRetailHighVolatility() public {
        oracle.setVolatility(10);

        uint24 appliedFee = _swapAndGetAppliedFee(retailUser);

        assertEq(appliedFee, 5000, "retail executed fee mismatch");
    }

    function testDynamicFeeAppliedInstitutionalHighVolatility() public {
        oracle.setVolatility(10);

        uint24 appliedFee = _swapAndGetAppliedFee(institutionalUser);

        assertEq(appliedFee, 500, "institutional executed fee mismatch");
    }

    function _swapAndGetAppliedFee(PoolUser user) internal returns (uint24) {
        vm.recordLogs();
        user.swap();

        Vm.Log[] memory logs = vm.getRecordedLogs();

        for (uint256 i = logs.length; i > 0; i--) {
            Vm.Log memory logEntry = logs[i - 1];

            if (
                logEntry.emitter == address(poolManager)
                    && logEntry.topics.length == 3
                    && logEntry.topics[0] == SWAP_EVENT_SIG
                    && logEntry.topics[2] == bytes32(uint256(uint160(address(user))))
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
}
