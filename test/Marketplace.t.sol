// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IERC20Minimal} from "@uniswap/v4-core/interfaces/external/IERC20Minimal.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";

import "../src/AllocationLedger.sol";
import "../src/HookFlags.sol";
import "../src/MarketplaceExecutor.sol";
import "../src/MarketplaceHook.sol";
import "../src/MockERC20.sol";
import "../src/MockUSDC.sol";
import "../src/OfferingRegistry.sol";
import "../src/TradeIntent.sol";

contract MarketplaceTest is Test {
    using PoolIdLibrary for PoolKey;

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint256 internal constant SIGNER_KEY = 0xA11CE;
    uint256 internal constant SOLAR_CAP = 1_000_000_000;
    uint256 internal constant CREDIT_CAP = 5_000_000_000;

    PoolManager internal manager;
    OfferingRegistry internal registry;
    MarketplaceHook internal hook;
    MarketplaceExecutor internal router;
    AllocationLedger internal ledger;
    MockUSDC internal usdc;
    MockERC20 internal solar;
    MockERC20 internal credit;
    PoolKey internal solarA;
    PoolKey internal solarB;
    PoolKey internal creditKey;
    MarketLiquidity internal liquidity;

    address internal issuerA;
    address internal issuerB;
    address internal outsider;
    address internal aliceA;
    address internal aliceB;
    address internal bob;
    uint256 internal aliceAKey;
    uint256 internal aliceBKey;
    uint256 internal bobKey;
    bytes32 internal aliceId = keccak256("alice");
    bytes32 internal bobId = keccak256("bob");
    bytes32 internal solarGroup = keccak256("solar-group");
    bytes32 internal creditGroup = keccak256("credit-group");
    bytes32 internal solarId;
    bytes32 internal creditId;
    uint256 internal nonce = 1;

    function setUp() public {
        (aliceA, aliceAKey) = makeAddrAndKey("aliceA");
        (aliceB, aliceBKey) = makeAddrAndKey("aliceB");
        (bob, bobKey) = makeAddrAndKey("bob");
        issuerA = makeAddr("issuerA");
        issuerB = makeAddr("issuerB");
        outsider = makeAddr("outsider");

        manager = new PoolManager(address(0));
        usdc = new MockUSDC();
        solar = new MockERC20("Solar Revenue Participation Token", "SPRT", 0);
        credit = new MockERC20("Private Credit Participation Token", "PCPT", 0);
        ledger = new AllocationLedger(address(this), vm.addr(SIGNER_KEY));
        registry = new OfferingRegistry(ledger, address(usdc), address(this));
        hook = _deployHook();
        router = new MarketplaceExecutor(manager, address(usdc), hook, address(this));
        registry.setExecutor(router);
        registry.setHook(address(hook));
        ledger.setAuthorizedHook(address(hook));
        ledger.transferOwnership(address(registry));
        hook.setTrustedRouter(address(router));
        router.transferOwnership(address(registry));

        registry.authorizeIssuer(issuerA, true);
        registry.authorizeIssuer(issuerB, true);
        _order(address(usdc), address(solar));
        _order(address(usdc), address(credit));

        vm.prank(outsider);
        vm.expectRevert(OfferingRegistry.NotIssuer.selector);
        registry.createOffering("Nope", "NO", "demo", address(solar), solarGroup, 1, SOLAR_CAP, uint64(block.timestamp), uint64(block.timestamp + 90 days));

        vm.prank(issuerA);
        solarId = registry.createOffering(
            "Solar Revenue Participation Token",
            "SPRT",
            "demo infrastructure",
            address(solar),
            solarGroup,
            1,
            SOLAR_CAP,
            uint64(block.timestamp),
            uint64(block.timestamp + 90 days)
        );
        vm.prank(issuerB);
        creditId = registry.createOffering(
            "Private Credit Participation Token",
            "PCPT",
            "demo credit",
            address(credit),
            creditGroup,
            1,
            CREDIT_CAP,
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days)
        );

        solarA = _key(address(usdc), address(solar), 3000, 60);
        solarB = _key(address(usdc), address(solar), 10000, 200);
        creditKey = _key(address(usdc), address(credit), 3000, 60);
        manager.initialize(solarA, SQRT_PRICE_1_1);
        manager.initialize(solarB, SQRT_PRICE_1_1);
        manager.initialize(creditKey, SQRT_PRICE_1_1);

        liquidity = new MarketLiquidity(manager);
        vm.startPrank(issuerA);
        registry.setLiquidityOperator(solarId, address(liquidity));
        registry.registerPool(solarId, solarA);
        registry.registerPool(solarId, solarB);
        registry.setInvestorTier(solarId, aliceA, 1);
        registry.setInvestorTier(solarId, aliceB, 1);
        registry.setInvestorTier(solarId, bob, 1);
        vm.stopPrank();
        vm.startPrank(issuerB);
        registry.setLiquidityOperator(creditId, address(liquidity));
        registry.registerPool(creditId, creditKey);
        registry.setInvestorTier(creditId, aliceA, 1);
        registry.setInvestorTier(creditId, bob, 1);
        vm.stopPrank();

        usdc.mint(address(liquidity), 1e30);
        solar.mint(address(liquidity), 1e30);
        credit.mint(address(liquidity), 1e30);
        liquidity.add(solarA);
        liquidity.add(solarB);
        liquidity.add(creditKey);

        _register(aliceA, aliceId, 11);
        _register(aliceB, aliceId, 12);
        _register(bob, bobId, 13);
        usdc.mint(aliceA, 20_000_000_000);
        usdc.mint(aliceB, 20_000_000_000);
        usdc.mint(bob, 20_000_000_000);
        vm.prank(aliceA);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(aliceB);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(router), type(uint256).max);
    }

    function testIndependentOfferingsAndSharedWallets() public {
        _buy(aliceA, aliceAKey, solarA, solarId, 700_000_000);
        assertEq(_spent(aliceId, solarGroup), 700_000_000);
        assertEq(_spent(aliceId, creditGroup), 0);

        vm.expectRevert();
        this.buy(aliceB, aliceBKey, solarB, solarId, 500_000_000);
        assertEq(_spent(aliceId, solarGroup), 700_000_000);

        _buy(aliceB, aliceBKey, solarA, solarId, 200_000_000);
        assertEq(_spent(aliceId, solarGroup), 900_000_000);

        _buy(aliceA, aliceAKey, creditKey, creditId, 1_000_000_000);
        assertEq(_spent(aliceId, solarGroup), 900_000_000);
        assertEq(_spent(aliceId, creditGroup), 1_000_000_000);

        _buy(bob, bobKey, solarB, solarId, 700_000_000);
        assertEq(_spent(bobId, solarGroup), 700_000_000);
        assertEq(_spent(aliceId, solarGroup), 900_000_000);
    }

    function testIssuerCannotEditAnotherOfferingAndCapCannotFallBelowSpend() public {
        _buy(aliceA, aliceAKey, solarA, solarId, 700_000_000);
        vm.prank(issuerB);
        vm.expectRevert(OfferingRegistry.NotIssuer.selector);
        registry.updateCap(solarId, SOLAR_CAP);
        vm.prank(issuerA);
        vm.expectRevert(abi.encodeWithSelector(OfferingRegistry.CapBelowSpend.selector, 100, 700_000_000));
        registry.updateCap(solarId, 100);
        vm.prank(issuerA);
        registry.updateCap(solarId, 2_000_000_000);
        assertEq(registry.getOffering(solarId).version, 2);
        assertEq(registry.getOffering(solarId).cap, 2_000_000_000);
        assertEq(_spent(aliceId, solarGroup), 700_000_000);
    }

    function testOldTradeIntentDiesWhenPolicyVersionChanges() public {
        (TradeIntent.Trade memory trade, bytes memory signature) = _trade(aliceA, aliceAKey, solarA, solarId, 100_000_000);
        vm.prank(issuerA);
        registry.updateCap(solarId, 2_000_000_000);
        vm.expectRevert();
        router.swapWithIntent(solarA, trade, signature);
        _buy(aliceA, aliceAKey, solarA, solarId, 100_000_000);
    }

    function testExpiryPauseRevocationAndReplay() public {
        vm.warp(8_000_000);
        vm.expectRevert();
        this.buy(aliceA, aliceAKey, solarA, solarId, 100_000_000);
        vm.warp(2_000_000);
        vm.prank(issuerA);
        registry.setPaused(solarId, true);
        vm.expectRevert();
        this.buy(aliceA, aliceAKey, solarA, solarId, 100_000_000);
        vm.prank(issuerA);
        registry.setPaused(solarId, false);

        (TradeIntent.Trade memory first, bytes memory firstSig) = _trade(aliceA, aliceAKey, solarA, solarId, 100_000_000);
        router.swapWithIntent(solarA, first, firstSig);
        vm.expectRevert();
        router.swapWithIntent(solarA, first, firstSig);

        vm.prank(issuerA);
        registry.revokeOfferingWallet(solarId, aliceA);
        vm.expectRevert();
        this.buy(aliceA, aliceAKey, solarA, solarId, 100_000_000);
        _buy(aliceA, aliceAKey, creditKey, creditId, 100_000_000);
        _buy(aliceB, aliceBKey, solarA, solarId, 100_000_000);

        uint256 epoch = registry.offeringRevocationEpoch(solarId, aliceA);
        bytes memory restoreSig = _restoreSig(aliceA, solarId, epoch, 90);
        registry.restoreWallet(aliceA, solarId, block.timestamp + 1 days, 90, restoreSig);
        _buy(aliceA, aliceAKey, solarA, solarId, 100_000_000);
    }

    function buy(address wallet, uint256 key, PoolKey calldata poolKey, bytes32 offeringId, uint256 amount) external {
        _buy(wallet, key, poolKey, offeringId, amount);
    }

    function _buy(address wallet, uint256 key, PoolKey memory poolKey, bytes32 offeringId, uint256 amount) internal {
        (TradeIntent.Trade memory trade, bytes memory signature) = _trade(wallet, key, poolKey, offeringId, amount);
        router.swapWithIntent(poolKey, trade, signature);
    }

    function _trade(address wallet, uint256 key, PoolKey memory poolKey, bytes32 offeringId, uint256 amount)
        internal
        returns (TradeIntent.Trade memory trade, bytes memory signature)
    {
        OfferingRegistry.Offering memory offering = registry.getOffering(offeringId);
        trade = TradeIntent.Trade({
            wallet: wallet,
            recipient: wallet,
            poolId: PoolId.unwrap(poolKey.toId()),
            policyId: offeringId,
            allocationGroupId: offering.groupId,
            amountIn: amount,
            periodId: offering.periodId,
            policyVersion: offering.version,
            nonce: nonce++,
            deadline: block.timestamp + 1 hours,
            chainId: block.chainid,
            executor: address(router)
        });
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domain(), TradeIntent.hash(trade)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _restoreSig(address wallet, bytes32 offeringId, uint256 epoch, uint256 restoreNonce) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(registry.RESTORE_TYPEHASH(), wallet, offeringId, epoch, block.timestamp + 1 days, restoreNonce)
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                keccak256(
                    abi.encode(
                        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                        keccak256("OfferingRegistry"),
                        keccak256("1"),
                        block.chainid,
                        address(registry)
                    )
                ),
                structHash
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _domain() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("RWAComplyTrade"),
                keccak256("1"),
                block.chainid,
                address(hook)
            )
        );
    }

    function _spent(bytes32 allocationId, bytes32 groupId) internal view returns (uint256) {
        return ledger.spentByAllocation(allocationId, groupId, 1);
    }

    function _register(address wallet, bytes32 allocationId, uint256 registrationNonce) internal {
        uint256 expiry = block.timestamp + 30 days;
        bytes32 structHash = keccak256(
            abi.encode(ledger.REGISTRATION_TYPEHASH(), wallet, allocationId, solarGroup, expiry, registrationNonce)
        );
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, digest);
        ledger.registerWallet(wallet, allocationId, solarGroup, expiry, registrationNonce, abi.encodePacked(r, s, v));
    }

    function _order(address left, address right) internal pure {
        left;
        right;
    }

    function _key(address tokenA, address tokenB, uint24 fee, int24 spacing) internal view returns (PoolKey memory poolKey) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: fee,
            tickSpacing: spacing,
            hooks: IHooks(address(hook))
        });
    }

    function _deployHook() internal returns (MarketplaceHook deployed) {
        uint160 permissions = HookFlags.toFlags(HookFlags.declared());
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(type(MarketplaceHook).creationCode, abi.encode(IPoolManager(address(manager)), registry, ledger, address(this)))
        );
        for (uint256 i = 0; i < 1_000_000; i++) {
            bytes32 salt = bytes32(i);
            address predicted = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)))));
            if ((uint160(predicted) & Hooks.ALL_HOOK_MASK) == permissions) {
                deployed = new MarketplaceHook{salt: salt}(manager, registry, ledger, address(this));
                return deployed;
            }
        }
        revert("no hook salt");
    }
}

contract MarketLiquidity is IUnlockCallback {
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
            IPoolManager.ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 1e24, salt: bytes32(0)}),
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
