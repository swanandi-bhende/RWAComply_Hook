// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IUnlockCallback} from "@uniswap/v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {IERC20Minimal} from "@uniswap/v4-core/interfaces/external/IERC20Minimal.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

import {MockRWAOracle} from "../src/MockRWAOracle.sol";
import {PoolExecutor} from "../src/PoolExecutor.sol";
import {RWAComplyHook} from "../src/RWAComplyHook.sol";

contract PoolExecutorTest is Test {
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint24 internal constant POOL_FEE = 3000;
    uint256 internal constant USDC_IN = 1_000_000;

    TestERC20 internal usdc;

    function setUp() public {
        usdc = new TestERC20("USDC", "USDC", 6);
    }

    function testExactInputWhenUsdcIsCurrency0() public {
        Route memory route = _route(false);
        uint256 start = usdc.balanceOf(route.alice);

        vm.prank(route.alice);
        route.router.swapExactInput(route.key, USDC_IN);

        assertEq(usdc.balanceOf(route.alice), start - USDC_IN);
        assertGt(route.rwa.balanceOf(route.alice), 0);
        assertEq(usdc.balanceOf(address(route.router)), 0);
        assertEq(route.rwa.balanceOf(address(route.router)), 0);
        assertEq(route.hook.lastSender(), address(route.router));
        assertEq(route.hook.lastHookData(), abi.encode(route.alice));
        assertEq(route.hook.lastAmountSpecified(), -int256(USDC_IN));
        assertTrue(route.hook.lastZeroForOne());
    }

    function testExactInputWhenUsdcIsCurrency1() public {
        Route memory route = _route(true);
        uint256 start = usdc.balanceOf(route.alice);

        vm.prank(route.alice);
        route.router.swapExactInput(route.key, USDC_IN);

        assertEq(usdc.balanceOf(route.alice), start - USDC_IN);
        assertGt(route.rwa.balanceOf(route.alice), 0);
        assertEq(usdc.balanceOf(address(route.router)), 0);
        assertEq(route.rwa.balanceOf(address(route.router)), 0);
        assertEq(route.hook.lastHookData(), abi.encode(route.alice));
        assertEq(route.hook.lastAmountSpecified(), -int256(USDC_IN));
        assertFalse(route.hook.lastZeroForOne());
    }

    function testEachCallerSpendsOnlyTheirOwnUsdc() public {
        Route memory route = _route(false);
        uint256 aliceStart = usdc.balanceOf(route.alice);
        uint256 bobStart = usdc.balanceOf(route.bob);

        vm.prank(route.bob);
        route.router.swapExactInput(route.key, USDC_IN);

        assertEq(usdc.balanceOf(route.alice), aliceStart);
        assertEq(usdc.balanceOf(route.bob), bobStart - USDC_IN);
        assertEq(route.rwa.balanceOf(route.alice), 0);
        assertGt(route.rwa.balanceOf(route.bob), 0);
        assertEq(route.hook.lastHookData(), abi.encode(route.bob));
        assertEq(route.hook.lastSender(), address(route.router));
    }

    function testUnlockCallbackRejectsOtherCallers() public {
        Route memory route = _route(false);

        vm.prank(route.alice);
        vm.expectRevert(PoolExecutor.NotPoolManager.selector);
        route.router.unlockCallback(abi.encode(route.key, true));
    }

    function testZeroInputIsRejected() public {
        Route memory route = _route(false);
        uint256 start = usdc.balanceOf(route.alice);

        vm.prank(route.alice);
        vm.expectRevert(PoolExecutor.ZeroAmount.selector);
        route.router.swapExactInput(route.key, 0);

        assertEq(usdc.balanceOf(route.alice), start);
        assertEq(usdc.balanceOf(address(route.router)), 0);
        assertEq(route.hook.lastAmountSpecified(), 0);
    }

    function testNonUsdcInputIsRejected() public {
        Route memory route = _route(false);
        TestERC20 other = new TestERC20("OTHER", "OTH", 18);
        PoolKey memory foreign = _pool(address(other), address(route.rwa), address(route.hook));
        uint256 start = usdc.balanceOf(route.alice);

        vm.prank(route.alice);
        vm.expectRevert(PoolExecutor.UnsupportedInputCurrency.selector);
        route.router.swapExactInput(foreign, USDC_IN);

        assertEq(usdc.balanceOf(route.alice), start);
        assertEq(usdc.balanceOf(address(route.router)), 0);
    }

    function testSwapWithoutAllowanceRevertsAndLeavesBalances() public {
        Route memory route = _route(false);
        uint256 start = usdc.balanceOf(route.alice);
        vm.prank(route.alice);
        usdc.approve(address(route.router), 0);

        vm.prank(route.alice);
        vm.expectRevert();
        route.router.swapExactInput(route.key, USDC_IN);

        assertEq(usdc.balanceOf(route.alice), start);
        assertEq(route.rwa.balanceOf(route.alice), 0);
        assertEq(usdc.balanceOf(address(route.router)), 0);
        assertEq(route.rwa.balanceOf(address(route.router)), 0);
    }

    function testEmptyPoolRevertsWithoutTakingUsdc() public {
        RecordingHook hook = _deployRecordingHook();
        TestERC20 rwa = _deployRwa(false);
        PoolManager manager = new PoolManager(address(0));
        PoolExecutor router = new PoolExecutor(manager, address(usdc), address(rwa), address(hook));
        PoolKey memory key = _pool(address(usdc), address(rwa), address(hook));
        manager.initialize(key, SQRT_PRICE_1_1);

        address alice = makeAddr("alice");
        usdc.mint(alice, USDC_IN);
        vm.prank(alice);
        usdc.approve(address(router), USDC_IN);

        vm.prank(alice);
        vm.expectRevert();
        router.swapExactInput(key, USDC_IN);

        assertEq(usdc.balanceOf(alice), USDC_IN);
        assertEq(usdc.balanceOf(address(router)), 0);
    }

    function testExactInputThroughTheComplianceHook() public {
        PoolManager manager = new PoolManager(address(0));
        MockRWAOracle oracle = new MockRWAOracle(address(this));
        RWAComplyHook hook = _deployComplianceHook(manager, oracle);
        TestERC20 rwa = _deployRwa(false);
        PoolExecutor router = new PoolExecutor(manager, address(usdc), address(rwa), address(hook));
        PoolKey memory key = _pool(address(usdc), address(rwa), address(hook));
        manager.initialize(key, SQRT_PRICE_1_1);

        LiquidityPosition liquidity = new LiquidityPosition(manager);
        hook.setTier(address(liquidity), 2);
        hook.setTier(address(router), 2);
        usdc.mint(address(liquidity), 1e30);
        rwa.mint(address(liquidity), 1e30);
        liquidity.add(key);

        address alice = makeAddr("alice");
        usdc.mint(alice, USDC_IN);
        vm.prank(alice);
        usdc.approve(address(router), USDC_IN);

        vm.prank(alice);
        router.swapExactInput(key, USDC_IN);

        assertEq(usdc.balanceOf(alice), 0);
        assertGt(rwa.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(rwa.balanceOf(address(router)), 0);
    }

    struct Route {
        PoolManager manager;
        RecordingHook hook;
        TestERC20 rwa;
        PoolExecutor router;
        PoolKey key;
        address alice;
        address bob;
    }

    function _route(bool usdcIsCurrency1) internal returns (Route memory route) {
        route.manager = new PoolManager(address(0));
        route.hook = _deployRecordingHook();
        route.rwa = _deployRwa(!usdcIsCurrency1);
        route.router = new PoolExecutor(route.manager, address(usdc), address(route.rwa), address(route.hook));
        route.key = _pool(address(usdc), address(route.rwa), address(route.hook));
        route.manager.initialize(route.key, SQRT_PRICE_1_1);

        LiquidityPosition liquidity = new LiquidityPosition(route.manager);
        usdc.mint(address(liquidity), 1e30);
        route.rwa.mint(address(liquidity), 1e30);
        liquidity.add(route.key);

        route.alice = makeAddr("alice");
        route.bob = makeAddr("bob");
        usdc.mint(route.alice, 10 * USDC_IN);
        usdc.mint(route.bob, 10 * USDC_IN);
        vm.prank(route.alice);
        usdc.approve(address(route.router), type(uint256).max);
        vm.prank(route.bob);
        usdc.approve(address(route.router), type(uint256).max);
    }

    function _pool(address tokenA, address tokenB, address hook) internal pure returns (PoolKey memory key) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: POOL_FEE,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
    }

    function _deployRwa(bool aboveUsdc) internal returns (TestERC20 token) {
        for (uint256 i = 0; i < 50; i++) {
            TestERC20 candidate = new TestERC20{salt: keccak256(abi.encode("rwa", aboveUsdc, i))}("RWA", "RWA", 18);
            if ((address(candidate) > address(usdc)) == aboveUsdc) return candidate;
        }
        revert("no rwa address");
    }

    function _deployRecordingHook() internal returns (RecordingHook deployed) {
        uint160 permissions = Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;
        bytes32 bytecodeHash = keccak256(abi.encodePacked(type(RecordingHook).creationCode));
        (bytes32 salt, address predicted) = _salt(bytecodeHash, permissions);
        deployed = new RecordingHook{salt: salt}();
        require(address(deployed) == predicted, "hook mismatch");
    }

    function _deployComplianceHook(PoolManager manager, MockRWAOracle oracle) internal returns (RWAComplyHook deployed) {
        uint160 permissions = Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG
            | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG;
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode, abi.encode(IPoolManager(address(manager)), address(oracle), address(this))
            )
        );
        (bytes32 salt, address predicted) = _salt(bytecodeHash, permissions);
        deployed = new RWAComplyHook{salt: salt}(IPoolManager(address(manager)), address(oracle), address(this));
        require(address(deployed) == predicted, "hook mismatch");
    }

    function _salt(bytes32 bytecodeHash, uint160 permissions) internal view returns (bytes32 salt, address predicted) {
        for (uint256 i = 0; i < 1_000_000; i++) {
            salt = bytes32(i);
            predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)))));
            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == permissions) return (salt, predicted);
        }
        revert("no hook salt");
    }
}

contract TestERC20 is ERC20 {
    uint8 private tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract RecordingHook is IHooks {
    address public lastSender;
    bytes public lastHookData;
    int256 public lastAmountSpecified;
    bool public lastZeroForOne;

    function beforeSwap(address sender, PoolKey calldata, IPoolManager.SwapParams calldata params, bytes calldata hookData)
        external
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        lastSender = sender;
        lastHookData = hookData;
        lastAmountSpecified = params.amountSpecified;
        lastZeroForOne = params.zeroForOne;
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, BalanceDelta, bytes calldata)
        external
        pure
        returns (bytes4, int128)
    {
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
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
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IHooks.afterDonate.selector;
    }
}

contract LiquidityPosition is IUnlockCallback {
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
            IPoolManager.ModifyLiquidityParams({tickLower: -60, tickUpper: 60, liquidityDelta: 1e18, salt: bytes32(0)}),
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
