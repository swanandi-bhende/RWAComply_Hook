// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";

import {AllocationLedger} from "../src/AllocationLedger.sol";
import {HookFlags} from "../src/HookFlags.sol";
import {MockRWAOracle} from "../src/MockRWAOracle.sol";
import {RWAComplyHook} from "../src/RWAComplyHook.sol";

contract HookBudgetTest is Test {
    uint256 internal constant CAP = 1_000_000;
    uint256 internal signerKey = 0xA11CE;

    PoolManager internal manager;
    RWAComplyHook internal hook;
    AllocationLedger internal ledger;
    address internal router = address(0xA11);
    address internal usdc = address(0x1111);
    address internal rwa = address(0x2222);
    address internal trader = address(0xB0B);
    bytes32 internal groupId = keccak256("group");
    bytes32 internal otherGroupId = keccak256("other-group");
    bytes32 internal allocationId = keccak256("allocation");
    bytes32 internal otherAllocationId = keccak256("other-allocation");
    uint256 internal periodId = 1;

    function setUp() public {
        MockRWAOracle oracle = new MockRWAOracle(address(this));
        manager = new PoolManager(address(0));
        hook = _deploy(oracle);
        ledger = new AllocationLedger(address(this), vm.addr(signerKey));
        ledger.setPolicy(groupId, periodId, CAP, usdc);
        ledger.setPolicy(otherGroupId, periodId, CAP * 10, usdc);
        ledger.setPolicy(groupId, 2, CAP / 2, usdc);
        hook.setTrustedRouter(router);
        hook.setQuoteTokens(usdc, rwa);
        hook.setLedger(address(ledger));
        hook.setAllocation(groupId, periodId);
        hook.setTier(trader, 2);
        _register(trader, allocationId, 1);
    }

    function testConfiguredRouterSwapPassesWithoutRecordingSpend() public {
        (, IPoolManager.SwapParams memory params) = _params(true, -int256(CAP));

        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
        assertEq(ledger.remaining(trader, groupId, periodId), CAP);
    }

    function testInputAboveRemainingIsRejected() public {
        (, IPoolManager.SwapParams memory params) = _params(true, -int256(CAP + 1));

        vm.expectRevert(abi.encodeWithSelector(RWAComplyHook.AllocationExceeded.selector, CAP + 1, CAP));
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
    }

    function testInputEqualToRemainingIsAccepted() public {
        _seedSpend(CAP - 100);
        (, IPoolManager.SwapParams memory params) = _params(true, -100);

        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), CAP - 100);
        assertEq(ledger.remaining(trader, groupId, periodId), 100);
    }

    function testZeroRemainingRejectsAPurchase() public {
        _seedSpend(CAP);
        (, IPoolManager.SwapParams memory params) = _params(true, -1);

        vm.expectRevert(abi.encodeWithSelector(RWAComplyHook.AllocationExceeded.selector, 1, 0));
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), CAP);
    }

    function testUnregisteredTraderIsRejected() public {
        address stranger = address(0x3333);
        hook.setTier(stranger, 2);
        (, IPoolManager.SwapParams memory params) = _params(true, -1);

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.WalletNotRegistered.selector, stranger));
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(stranger));
    }

    function testMissingPolicyIsRejected() public {
        hook.setAllocation(keccak256("unset-group"), periodId);
        (, IPoolManager.SwapParams memory params) = _params(true, -1);

        vm.expectRevert(
            abi.encodeWithSelector(AllocationLedger.PolicyNotConfigured.selector, keccak256("unset-group"), periodId)
        );
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
    }

    function testSharedAllocationUsesOneRemainingBudget() public {
        address second = address(0x4444);
        hook.setTier(second, 2);
        _register(second, allocationId, 2);
        _seedSpend(700_000);

        (, IPoolManager.SwapParams memory over) = _params(true, -300_001);
        vm.expectRevert(abi.encodeWithSelector(RWAComplyHook.AllocationExceeded.selector, 300_001, 300_000));
        _beforeSwap(router, _key(usdc, rwa), over, abi.encode(second));
        assertEq(ledger.remaining(trader, groupId, periodId), 300_000);
        assertEq(ledger.remaining(second, groupId, periodId), 300_000);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000);
    }

    function testSecondWalletCanRequestTheSharedRemainder() public {
        address second = address(0x4444);
        hook.setTier(second, 2);
        _register(second, allocationId, 2);
        _seedSpend(700_000);

        (, IPoolManager.SwapParams memory within) = _params(true, -300_000);
        _beforeSwap(router, _key(usdc, rwa), within, abi.encode(second));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000);
        assertEq(ledger.remaining(second, groupId, periodId), 300_000);
    }

    function testOtherAllocationKeepsItsOwnBudget() public {
        address bob = address(0x5555);
        hook.setTier(bob, 2);
        _register(bob, otherAllocationId, 3);
        _seedSpend(700_000);

        (, IPoolManager.SwapParams memory full) = _params(true, -int256(CAP));
        _beforeSwap(router, _key(usdc, rwa), full, abi.encode(bob));
        assertEq(ledger.spentByAllocation(otherAllocationId, groupId, periodId), 0);
        assertEq(ledger.remaining(bob, groupId, periodId), CAP);
        assertEq(ledger.remaining(trader, groupId, periodId), CAP - 700_000);
    }

    function testConfiguredGroupAndPeriodAreTheOnesChecked() public {
        (, IPoolManager.SwapParams memory params) = _params(true, -int256(CAP));

        hook.setAllocation(groupId, 2);
        vm.expectRevert(abi.encodeWithSelector(RWAComplyHook.AllocationExceeded.selector, CAP, CAP / 2));
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));

        hook.setAllocation(otherGroupId, periodId);
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));
        assertEq(ledger.spentByAllocation(allocationId, groupId, 2), 0);
        assertEq(ledger.spentByAllocation(allocationId, otherGroupId, periodId), 0);
    }

    function testDirectCallerIsRejected() public {
        (, IPoolManager.SwapParams memory params) = _params(true, -1);
        vm.expectRevert(abi.encodeWithSelector(RWAComplyHook.UntrustedRouter.selector, trader));
        _beforeSwap(trader, _key(usdc, rwa), params, abi.encode(trader));
    }

    function testMalformedAndEmptyHookDataAreRejected() public {
        (, IPoolManager.SwapParams memory params) = _params(true, -1);
        PoolKey memory key = _key(usdc, rwa);

        vm.expectRevert(RWAComplyHook.MalformedHookData.selector);
        _beforeSwap(router, key, params, "");
        vm.expectRevert(RWAComplyHook.MalformedHookData.selector);
        _beforeSwap(router, key, params, hex"1234");
        vm.expectRevert(RWAComplyHook.MalformedHookData.selector);
        _beforeSwap(router, key, params, abi.encode(trader, uint256(1)));
        vm.expectRevert(RWAComplyHook.MalformedHookData.selector);
        _beforeSwap(router, key, params, abi.encode(bytes32(uint256(uint160(trader)) | (uint256(1) << 160))));
    }

    function testZeroTraderIsRejected() public {
        (, IPoolManager.SwapParams memory params) = _params(true, -1);
        vm.expectRevert(RWAComplyHook.ZeroTrader.selector);
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(address(0)));
    }

    function testPositiveAndZeroAmountsAreRejected() public {
        PoolKey memory key = _key(usdc, rwa);
        (, IPoolManager.SwapParams memory positiveAmount) = _params(true, int256(CAP));
        (, IPoolManager.SwapParams memory zeroAmount) = _params(true, 0);

        vm.expectRevert(RWAComplyHook.ExactInputRequired.selector);
        _beforeSwap(router, key, positiveAmount, abi.encode(trader));
        vm.expectRevert(RWAComplyHook.ExactInputRequired.selector);
        _beforeSwap(router, key, zeroAmount, abi.encode(trader));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
    }

    function testNonUsdcInputIsRejected() public {
        (, IPoolManager.SwapParams memory sellingRwa) = _params(true, -1);
        vm.expectRevert(RWAComplyHook.UnsupportedInputCurrency.selector);
        _beforeSwap(router, _key(rwa, usdc), sellingRwa, abi.encode(trader));
    }

    function testUsdcAsCurrencyZeroPasses() public {
        (, IPoolManager.SwapParams memory usdcIsCurrency0) = _params(true, -1);
        _beforeSwap(router, _key(usdc, rwa), usdcIsCurrency0, abi.encode(trader));
    }

    function testUsdcAsCurrencyOnePasses() public {
        hook.setQuoteTokens(address(0x3333), address(0x2222));
        (, IPoolManager.SwapParams memory usdcIsCurrency1) = _params(false, -1);
        _beforeSwap(router, _key(address(0x2222), address(0x3333)), usdcIsCurrency1, abi.encode(trader));
    }

    function testTierCheckUsesTheTraderRatherThanTheRouter() public {
        hook.setTier(trader, 0);
        hook.setTier(router, 2);
        (, IPoolManager.SwapParams memory params) = _params(true, -1);

        vm.expectRevert(RWAComplyHook.AccessDenied.selector);
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));

        hook.setTier(trader, 1);
        hook.setRetailSwapCap(0);
        vm.expectRevert(RWAComplyHook.RetailLimitExceeded.selector);
        _beforeSwap(router, _key(usdc, rwa), params, abi.encode(trader));
    }

    function _beforeSwap(
        address sender,
        PoolKey memory key,
        IPoolManager.SwapParams memory params,
        bytes memory data
    ) internal {
        vm.prank(address(manager));
        hook.beforeSwap(sender, key, params, data);
    }

    function _deploy(MockRWAOracle oracle) internal returns (RWAComplyHook deployed) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode, abi.encode(IPoolManager(address(manager)), address(oracle), address(this))
            )
        );
        (bytes32 salt, address predicted) =
            HookFlags.mine(address(this), initCodeHash, HookFlags.toFlags(HookFlags.declared()));
        deployed = new RWAComplyHook{salt: salt}(IPoolManager(address(manager)), address(oracle), address(this));
        require(address(deployed) == predicted, "hook mismatch");
    }

    function _key(address token0, address token1) internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _params(bool zeroForOne, int256 amount)
        internal
        pure
        returns (PoolKey memory, IPoolManager.SwapParams memory params)
    {
        params = IPoolManager.SwapParams({zeroForOne: zeroForOne, amountSpecified: amount, sqrtPriceLimitX96: 0});
    }

    function _register(address wallet, bytes32 allocation, uint256 nonce) internal {
        uint256 expiry = block.timestamp + 1 days;
        ledger.registerWallet(wallet, allocation, groupId, expiry, nonce, _sign(wallet, allocation, expiry, nonce));
    }

    function _seedSpend(uint256 amount) internal {
        ledger.setAuthorizedHook(address(this));
        ledger.recordSpend(trader, groupId, periodId, amount);
    }

    function _sign(address wallet, bytes32 allocation, uint256 expiry, uint256 nonce) internal view returns (bytes memory) {
        bytes32 structHash =
            keccak256(abi.encode(ledger.REGISTRATION_TYPEHASH(), wallet, allocation, groupId, expiry, nonce));
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
