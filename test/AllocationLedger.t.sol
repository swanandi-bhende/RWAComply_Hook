// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {AllocationLedger} from "../src/AllocationLedger.sol";

contract AllocationLedgerTest is Test {
    using stdStorage for StdStorage;

    uint256 internal signerKey = 0xA11CE;
    address internal signer;
    address internal owner = address(this);
    address internal stranger = address(0xBEEF);

    AllocationLedger internal ledger;

    bytes32 internal groupId = keccak256("group");
    bytes32 internal allocationId = keccak256("allocation");
    bytes32 internal otherAllocationId = keccak256("other-allocation");
    uint256 internal periodId = 1;
    address internal usdc = address(0xA0B8);
    uint256 internal cap = 1_000_000_000;

    function setUp() public {
        signer = vm.addr(signerKey);
        ledger = new AllocationLedger(owner, signer);
    }

    function testOwnerCanSetPolicy() public {
        vm.expectEmit(true, true, false, true);
        emit AllocationLedger.PolicyUpdated(groupId, periodId, cap, usdc);
        ledger.setPolicy(groupId, periodId, cap, usdc);

        (uint256 storedCap, uint256 storedPeriodId, address storedUsdc) =
            ledger.policyByGroupPeriod(groupId, periodId);

        assertEq(storedCap, cap);
        assertEq(storedPeriodId, periodId);
        assertEq(storedUsdc, usdc);
    }

    function testStrangerCannotSetPolicy() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        ledger.setPolicy(groupId, periodId, cap, usdc);
    }

    function testStrangerCannotUpdatePolicy() public {
        ledger.setPolicy(groupId, periodId, cap, usdc);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        ledger.setPolicy(groupId, periodId, cap + 1, usdc);
    }

    function testSetPolicyRejectsZeroGroup() public {
        vm.expectRevert(AllocationLedger.ZeroGroupId.selector);
        ledger.setPolicy(bytes32(0), periodId, cap, usdc);
    }

    function testSetPolicyRejectsZeroUsdc() public {
        vm.expectRevert(AllocationLedger.ZeroAddress.selector);
        ledger.setPolicy(groupId, periodId, cap, address(0));
    }

    function testSetPolicyRejectsZeroCap() public {
        vm.expectRevert(AllocationLedger.ZeroCap.selector);
        ledger.setPolicy(groupId, periodId, 0, usdc);
    }

    function testPolicyUpdateDoesNotChangeSpend() public {
        bytes32 secondGroup = keccak256("second-group");
        uint256 secondPeriod = 2;
        uint256 spentFirst = 200_000_000;
        uint256 spentSecond = 500_000_000;

        _writeSpend(allocationId, groupId, periodId, spentFirst);
        _writeSpend(allocationId, secondGroup, secondPeriod, spentSecond);

        ledger.setPolicy(groupId, periodId, cap, usdc);
        ledger.setPolicy(groupId, periodId, 700_000_000, usdc);
        ledger.setPolicy(secondGroup, secondPeriod, 900_000_000, usdc);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), spentFirst);
        assertEq(ledger.spentByAllocation(allocationId, secondGroup, secondPeriod), spentSecond);
        (uint256 updatedCap,,) = ledger.policyByGroupPeriod(groupId, periodId);
        (uint256 secondCap,,) = ledger.policyByGroupPeriod(secondGroup, secondPeriod);
        assertEq(updatedCap, 700_000_000);
        assertEq(secondCap, 900_000_000);
    }

    function testValidSignatureRegistersWallet() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        uint256 nonce = 7;
        bytes memory signature = _sign(ledger, wallet, allocationId, groupId, expiry, nonce, signerKey);

        vm.expectEmit(true, true, true, true);
        emit AllocationLedger.WalletRegistered(wallet, allocationId, groupId, expiry, nonce);
        ledger.registerWallet(wallet, allocationId, groupId, expiry, nonce, signature);

        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertTrue(ledger.usedNonce(nonce));
    }

    function testInvalidSignatureReverts() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        uint256 nonce = 1;
        bytes memory signature = abi.encodePacked(bytes32(uint256(1)), bytes32(uint256(2)), uint8(27));

        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertFalse(ledger.usedNonce(nonce));

        vm.expectRevert(AllocationLedger.InvalidSignature.selector);
        ledger.registerWallet(wallet, allocationId, groupId, expiry, nonce, signature);

        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertFalse(ledger.usedNonce(nonce));

        ledger.registerWallet(
            wallet, allocationId, groupId, expiry, nonce, _sign(ledger, wallet, allocationId, groupId, expiry, nonce, signerKey)
        );
        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertTrue(ledger.usedNonce(nonce));
    }

    function testExpiredAuthorizationReverts() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp - 1;
        uint256 nonce = 1;
        bytes memory signature = _sign(ledger, wallet, allocationId, groupId, expiry, nonce, signerKey);

        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertFalse(ledger.usedNonce(nonce));

        vm.expectRevert(AllocationLedger.AuthorizationExpired.selector);
        ledger.registerWallet(wallet, allocationId, groupId, expiry, nonce, signature);

        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertFalse(ledger.usedNonce(nonce));

        uint256 freshExpiry = block.timestamp + 1 days;
        ledger.registerWallet(
            wallet,
            allocationId,
            groupId,
            freshExpiry,
            nonce,
            _sign(ledger, wallet, allocationId, groupId, freshExpiry, nonce, signerKey)
        );
        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertTrue(ledger.usedNonce(nonce));
    }

    function testAuthorizationRemainsValidAtExpiryTimestamp() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp;
        uint256 nonce = 9;

        ledger.registerWallet(
            wallet, allocationId, groupId, expiry, nonce, _sign(ledger, wallet, allocationId, groupId, expiry, nonce, signerKey)
        );

        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertTrue(ledger.usedNonce(nonce));
    }

    function testZeroWalletReverts() public {
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(ledger, address(0), allocationId, groupId, expiry, 1, signerKey);

        vm.expectRevert(AllocationLedger.ZeroAddress.selector);
        ledger.registerWallet(address(0), allocationId, groupId, expiry, 1, signature);
        assertFalse(ledger.usedNonce(1));
    }

    function testZeroAllocationIdReverts() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(ledger, wallet, bytes32(0), groupId, expiry, 1, signerKey);

        vm.expectRevert(AllocationLedger.ZeroAllocationId.selector);
        ledger.registerWallet(wallet, bytes32(0), groupId, expiry, 1, signature);
        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertFalse(ledger.usedNonce(1));
    }

    function testZeroGroupIdReverts() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(ledger, wallet, allocationId, bytes32(0), expiry, 1, signerKey);

        vm.expectRevert(AllocationLedger.ZeroGroupId.selector);
        ledger.registerWallet(wallet, allocationId, bytes32(0), expiry, 1, signature);
        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertFalse(ledger.usedNonce(1));
    }

    function testReusedNonceReverts() public {
        address wallet = address(0x1111);
        address otherWallet = address(0x2222);
        uint256 expiry = block.timestamp + 1 days;
        uint256 nonce = 4;
        bytes memory first = _sign(ledger, wallet, allocationId, groupId, expiry, nonce, signerKey);

        ledger.registerWallet(wallet, allocationId, groupId, expiry, nonce, first);
        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertTrue(ledger.usedNonce(nonce));

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.NonceAlreadyUsed.selector, nonce));
        ledger.registerWallet(wallet, allocationId, groupId, expiry, nonce, first);
        assertEq(ledger.allocationIdByWallet(wallet), allocationId);

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.NonceAlreadyUsed.selector, nonce));
        ledger.registerWallet(otherWallet, allocationId, groupId, expiry, nonce, first);
        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertEq(ledger.allocationIdByWallet(otherWallet), bytes32(0));

        bytes memory second = _sign(ledger, otherWallet, otherAllocationId, groupId, expiry, nonce, signerKey);
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.NonceAlreadyUsed.selector, nonce));
        ledger.registerWallet(otherWallet, otherAllocationId, groupId, expiry, nonce, second);
        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertEq(ledger.allocationIdByWallet(otherWallet), bytes32(0));
        assertTrue(ledger.usedNonce(nonce));
    }

    function testWalletCannotMoveToAnotherAllocation() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;

        ledger.registerWallet(
            wallet, allocationId, groupId, expiry, 1, _sign(ledger, wallet, allocationId, groupId, expiry, 1, signerKey)
        );

        bytes memory resign = _sign(ledger, wallet, otherAllocationId, groupId, expiry, 2, signerKey);
        vm.expectRevert(
            abi.encodeWithSelector(AllocationLedger.AllocationMismatch.selector, allocationId, otherAllocationId)
        );
        ledger.registerWallet(wallet, otherAllocationId, groupId, expiry, 2, resign);

        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertFalse(ledger.usedNonce(2));
    }

    function testSameAllocationCanBeRegisteredAgain() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;

        ledger.registerWallet(
            wallet, allocationId, groupId, expiry, 1, _sign(ledger, wallet, allocationId, groupId, expiry, 1, signerKey)
        );
        ledger.registerWallet(
            wallet,
            allocationId,
            keccak256("another-group"),
            expiry,
            2,
            _sign(ledger, wallet, allocationId, keccak256("another-group"), expiry, 2, signerKey)
        );

        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertTrue(ledger.usedNonce(2));
    }

    function testTwoWalletsShareOneAllocationId() public {
        address first = address(0x1111);
        address second = address(0x2222);
        uint256 expiry = block.timestamp + 1 days;

        ledger.registerWallet(
            first, allocationId, groupId, expiry, 1, _sign(ledger, first, allocationId, groupId, expiry, 1, signerKey)
        );
        ledger.registerWallet(
            second, allocationId, groupId, expiry, 2, _sign(ledger, second, allocationId, groupId, expiry, 2, signerKey)
        );

        assertEq(ledger.allocationIdByWallet(first), allocationId);
        assertEq(ledger.allocationIdByWallet(second), allocationId);
    }

    function testUnauthorizedSignerReverts() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        uint256 otherKey = 0xB0B;
        bytes memory signature = _sign(ledger, wallet, allocationId, groupId, expiry, 1, otherKey);

        vm.expectRevert(AllocationLedger.InvalidSignature.selector);
        ledger.registerWallet(wallet, allocationId, groupId, expiry, 1, signature);
        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertFalse(ledger.usedNonce(1));
    }

    function testSignatureCannotBeReplayedOnAnotherChain() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(ledger, wallet, allocationId, groupId, expiry, 1, signerKey);

        vm.chainId(block.chainid + 1);
        vm.expectRevert(AllocationLedger.InvalidSignature.selector);
        ledger.registerWallet(wallet, allocationId, groupId, expiry, 1, signature);
        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertFalse(ledger.usedNonce(1));
    }

    function testSignatureCannotBeReplayedOnAnotherDeployment() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(ledger, wallet, allocationId, groupId, expiry, 1, signerKey);

        AllocationLedger other = new AllocationLedger(owner, signer);
        vm.expectRevert(AllocationLedger.InvalidSignature.selector);
        other.registerWallet(wallet, allocationId, groupId, expiry, 1, signature);

        ledger.registerWallet(wallet, allocationId, groupId, expiry, 1, signature);
        assertEq(ledger.allocationIdByWallet(wallet), allocationId);
        assertEq(other.allocationIdByWallet(wallet), bytes32(0));
    }

    function testUnconfiguredSignerReverts() public {
        AllocationLedger unsigned = new AllocationLedger(owner, address(0));
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(unsigned, wallet, allocationId, groupId, expiry, 1, signerKey);

        vm.expectRevert(AllocationLedger.SignerNotConfigured.selector);
        unsigned.registerWallet(wallet, allocationId, groupId, expiry, 1, signature);
    }

    function testRemainingReturnsFullCapBeforeSpend() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);

        assertEq(ledger.remaining(address(0x1111), groupId, periodId), cap);
    }

    function testRemainingAfterSevenHundredSpend() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);

        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 300_000_000);
    }

    function testSharedWalletsSeeTheSameRemaining() public {
        _register(address(0x1111), allocationId, 1);
        _register(address(0x2222), allocationId, 2);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);

        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 300_000_000);
        assertEq(ledger.remaining(address(0x2222), groupId, periodId), 300_000_000);
    }

    function testAllocationsHaveIndependentRemaining() public {
        _register(address(0x1111), allocationId, 1);
        _register(address(0x3333), otherAllocationId, 2);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);

        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 300_000_000);
        assertEq(ledger.remaining(address(0x3333), groupId, periodId), cap);
    }

    function testGroupsHaveIndependentRemaining() public {
        bytes32 otherGroup = keccak256("other-group");
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        ledger.setPolicy(otherGroup, periodId, 500_000_000, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);

        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 300_000_000);
        assertEq(ledger.remaining(address(0x1111), otherGroup, periodId), 500_000_000);
    }

    function testPeriodsHaveIndependentRemaining() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        ledger.setPolicy(groupId, 2, 200_000_000, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);

        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 300_000_000);
        assertEq(ledger.remaining(address(0x1111), groupId, 2), 200_000_000);
    }

    function testSetPolicyRejectsCapBelowRecordedSpend() public {
        bytes32 otherGroup = keccak256("other-group");
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        ledger.setPolicy(otherGroup, periodId, 200_000_000, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.CapBelowRecordedSpend.selector, 200_000_000, 700_000_000));
        ledger.setPolicy(groupId, periodId, 200_000_000, usdc);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000_000);
        (uint256 storedCap,,) = ledger.policyByGroupPeriod(groupId, periodId);
        assertEq(storedCap, cap);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 300_000_000);

        ledger.setPolicy(groupId, periodId, 700_000_000, usdc);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 0);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000_000);
        assertEq(ledger.highestSpendByGroupPeriod(groupId, periodId), 700_000_000);

        vm.prank(address(0xA11));
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.CapExceeded.selector, 700_000_000, 1, 700_000_000));
        ledger.recordSpend(address(0x1111), groupId, periodId, 1);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000_000);
        (uint256 otherCap,,) = ledger.policyByGroupPeriod(otherGroup, periodId);
        assertEq(otherCap, 200_000_000);
    }

    function testRemainingRevertsWhenWalletIsUnregistered() public {
        address wallet = address(0x1111);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.WalletNotRegistered.selector, wallet));
        ledger.remaining(wallet, groupId, periodId);

        assertEq(ledger.allocationIdByWallet(wallet), bytes32(0));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
        assertEq(ledger.highestSpendByGroupPeriod(groupId, periodId), 0);
    }

    function testRemainingRevertsWhenPolicyIsMissing() public {
        _register(address(0x1111), allocationId, 1);

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.PolicyNotConfigured.selector, groupId, periodId));
        ledger.remaining(address(0x1111), groupId, periodId);
    }

    function testAuthorizedHookRecordsSpend() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        ledger.setAuthorizedHook(address(0xA11));

        vm.prank(address(0xA11));
        vm.expectEmit(true, true, true, true);
        emit AllocationLedger.SpendRecorded(address(0x1111), allocationId, groupId, periodId, 200_000_000, 200_000_000);
        ledger.recordSpend(address(0x1111), groupId, periodId, 200_000_000);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 200_000_000);
    }

    function testUnauthorizedCallerCannotRecordSpend() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        ledger.setAuthorizedHook(address(0xA11));

        assertEq(ledger.remaining(address(0x1111), groupId, periodId), cap);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.HookNotAuthorized.selector, stranger));
        ledger.recordSpend(address(0x1111), groupId, periodId, 200_000_000);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), cap);

        vm.prank(address(0xA11));
        ledger.recordSpend(address(0x1111), groupId, periodId, 200_000_000);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 200_000_000);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), cap - 200_000_000);
    }

    function testUnsetHookCannotRecordSpend() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);

        vm.prank(address(0xA11));
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.HookNotAuthorized.selector, address(0xA11)));
        ledger.recordSpend(address(0x1111), groupId, periodId, 200_000_000);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
    }

    function testRecordSpendRejectsUnregisteredWallet() public {
        ledger.setPolicy(groupId, periodId, cap, usdc);
        ledger.setAuthorizedHook(address(0xA11));

        assertEq(ledger.allocationIdByWallet(address(0x1111)), bytes32(0));

        vm.prank(address(0xA11));
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.WalletNotRegistered.selector, address(0x1111)));
        ledger.recordSpend(address(0x1111), groupId, periodId, 200_000_000);

        assertEq(ledger.allocationIdByWallet(address(0x1111)), bytes32(0));
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
        assertEq(ledger.spentByAllocation(bytes32(0), groupId, periodId), 0);
        assertEq(ledger.highestSpendByGroupPeriod(groupId, periodId), 0);
    }

    function testRecordSpendRejectsZeroAmount() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 200_000_000);

        vm.prank(address(0xA11));
        vm.expectRevert(AllocationLedger.ZeroAmount.selector);
        ledger.recordSpend(address(0x1111), groupId, periodId, 0);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 200_000_000);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), cap - 200_000_000);
    }

    function testRecordSpendRejectsZeroWallet() public {
        ledger.setAuthorizedHook(address(0xA11));
        vm.prank(address(0xA11));
        vm.expectRevert(AllocationLedger.ZeroAddress.selector);
        ledger.recordSpend(address(0), groupId, periodId, 200_000_000);
    }

    function testRecordSpendRejectsZeroGroup() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setAuthorizedHook(address(0xA11));

        vm.prank(address(0xA11));
        vm.expectRevert(AllocationLedger.ZeroGroupId.selector);
        ledger.recordSpend(address(0x1111), bytes32(0), periodId, 200_000_000);
    }

    function testRecordSpendRejectsMissingPolicy() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setAuthorizedHook(address(0xA11));

        vm.prank(address(0xA11));
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.PolicyNotConfigured.selector, groupId, periodId));
        ledger.recordSpend(address(0x1111), groupId, periodId, 200_000_000);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 0);
    }

    function testSpendEqualToCapSucceeds() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, cap);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), cap);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 0);
    }

    function testSpendAboveCapRevertsWithoutChangingCounter() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);

        vm.prank(address(0xA11));
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.CapExceeded.selector, 700_000_000, 400_000_000, cap));
        ledger.recordSpend(address(0x1111), groupId, periodId, 400_000_000);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000_000);
        assertEq(ledger.highestSpendByGroupPeriod(groupId, periodId), 700_000_000);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 300_000_000);
    }

    function testSharedAllocationUsesOneCap() public {
        _register(address(0x1111), allocationId, 1);
        _register(address(0x2222), allocationId, 2);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);
        _hookSpend(address(0x2222), groupId, periodId, 300_000_000);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), cap);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 0);
        assertEq(ledger.remaining(address(0x2222), groupId, periodId), 0);

        vm.prank(address(0xA11));
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.CapExceeded.selector, cap, 1, cap));
        ledger.recordSpend(address(0x2222), groupId, periodId, 1);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), cap);
    }

    function testDifferentAllocationHasItsOwnCap() public {
        _register(address(0x1111), allocationId, 1);
        _register(address(0x3333), otherAllocationId, 2);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 700_000_000);
        _hookSpend(address(0x3333), groupId, periodId, cap);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000_000);
        assertEq(ledger.spentByAllocation(otherAllocationId, groupId, periodId), cap);
    }

    function testPolicyUpdateDoesNotResetRecordedSpend() public {
        _register(address(0x1111), allocationId, 1);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(address(0x1111), groupId, periodId, 200_000_000);
        _hookSpend(address(0x1111), groupId, periodId, 200_000_000);

        vm.expectEmit(true, true, false, true);
        emit AllocationLedger.PolicyUpdated(groupId, periodId, 500_000_000, usdc);
        ledger.setPolicy(groupId, periodId, 500_000_000, usdc);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 400_000_000);
        assertEq(ledger.highestSpendByGroupPeriod(groupId, periodId), 400_000_000);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 100_000_000);
        (uint256 storedCap,, address storedUsdc) = ledger.policyByGroupPeriod(groupId, periodId);
        assertEq(storedCap, 500_000_000);
        assertEq(storedUsdc, usdc);

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.CapBelowRecordedSpend.selector, 100_000_000, 400_000_000));
        ledger.setPolicy(groupId, periodId, 100_000_000, usdc);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 400_000_000);
        assertEq(ledger.highestSpendByGroupPeriod(groupId, periodId), 400_000_000);
        assertEq(ledger.remaining(address(0x1111), groupId, periodId), 100_000_000);
        (storedCap,, storedUsdc) = ledger.policyByGroupPeriod(groupId, periodId);
        assertEq(storedCap, 500_000_000);
        assertEq(storedUsdc, usdc);
    }

    function testQuoteTokenIsFixedForTheGroup() public {
        address otherUsdc = address(0xBEEF);
        ledger.setPolicy(groupId, periodId, cap, usdc);

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.QuoteTokenImmutable.selector, usdc, otherUsdc));
        ledger.setPolicy(groupId, periodId, cap, otherUsdc);
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.QuoteTokenImmutable.selector, usdc, otherUsdc));
        ledger.setPolicy(groupId, 2, cap, otherUsdc);

        (uint256 storedCap, uint256 storedPeriod, address storedUsdc) = ledger.policyByGroupPeriod(groupId, periodId);
        assertEq(storedCap, cap);
        assertEq(storedPeriod, periodId);
        assertEq(storedUsdc, usdc);
        assertEq(ledger.quoteTokenByGroup(groupId), usdc);
        (uint256 nextCap,,) = ledger.policyByGroupPeriod(groupId, 2);
        assertEq(nextCap, 0);

        ledger.setPolicy(groupId, 2, cap, usdc);
        (nextCap,, storedUsdc) = ledger.policyByGroupPeriod(groupId, 2);
        assertEq(nextCap, cap);
        assertEq(storedUsdc, usdc);
        assertEq(ledger.quoteTokenByGroup(groupId), usdc);
    }

    function testCapFloorFollowsTheHighestSpendInOneGroupPeriod() public {
        address alice = address(0x1111);
        address bob = address(0x3333);
        _register(alice, allocationId, 1);
        _register(bob, otherAllocationId, 2);
        ledger.setPolicy(groupId, periodId, cap, usdc);
        _hookSpend(alice, groupId, periodId, 700_000_000);
        _hookSpend(bob, groupId, periodId, 900_000_000);

        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.CapBelowRecordedSpend.selector, 800_000_000, 900_000_000));
        ledger.setPolicy(groupId, periodId, 800_000_000, usdc);

        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000_000);
        assertEq(ledger.spentByAllocation(otherAllocationId, groupId, periodId), 900_000_000);
        assertEq(ledger.highestSpendByGroupPeriod(groupId, periodId), 900_000_000);
        (uint256 storedCap,,) = ledger.policyByGroupPeriod(groupId, periodId);
        assertEq(storedCap, cap);
        assertEq(ledger.remaining(alice, groupId, periodId), 300_000_000);
        assertEq(ledger.remaining(bob, groupId, periodId), 100_000_000);

        ledger.setPolicy(groupId, 2, 200_000_000, usdc);
        assertEq(ledger.remaining(alice, groupId, 2), 200_000_000);
        assertEq(ledger.spentByAllocation(allocationId, groupId, 2), 0);
        (storedCap,,) = ledger.policyByGroupPeriod(groupId, periodId);
        assertEq(storedCap, cap);

        ledger.setPolicy(groupId, periodId, 900_000_000, usdc);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000_000);
        assertEq(ledger.spentByAllocation(otherAllocationId, groupId, periodId), 900_000_000);
        assertEq(ledger.remaining(alice, groupId, periodId), 200_000_000);
        assertEq(ledger.remaining(bob, groupId, periodId), 0);
    }

    function testSharedWalletsFollowThePurchaseSequence() public {
        address aliceA = address(0x1111);
        address aliceB = address(0x2222);
        address bob = address(0x3333);
        _register(aliceA, allocationId, 1);
        _register(aliceB, allocationId, 2);
        _register(bob, otherAllocationId, 3);
        ledger.setPolicy(groupId, periodId, cap, usdc);

        _hookSpend(aliceA, groupId, periodId, 700_000_000);
        assertEq(ledger.remaining(aliceA, groupId, periodId), 300_000_000);
        assertEq(ledger.remaining(aliceB, groupId, periodId), 300_000_000);

        vm.prank(address(0xA11));
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.CapExceeded.selector, 700_000_000, 500_000_000, cap));
        ledger.recordSpend(aliceB, groupId, periodId, 500_000_000);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 700_000_000);
        assertEq(ledger.remaining(aliceB, groupId, periodId), 300_000_000);

        _hookSpend(aliceB, groupId, periodId, 200_000_000);
        assertEq(ledger.spentByAllocation(allocationId, groupId, periodId), 900_000_000);
        assertEq(ledger.remaining(aliceA, groupId, periodId), 100_000_000);
        assertEq(ledger.remaining(aliceB, groupId, periodId), 100_000_000);
        assertEq(ledger.remaining(bob, groupId, periodId), cap);
        assertEq(ledger.spentByAllocation(otherAllocationId, groupId, periodId), 0);
    }

    function testOnlyOwnerCanSetAuthorizedHook() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        ledger.setAuthorizedHook(address(0xA11));

        vm.expectRevert(AllocationLedger.ZeroAddress.selector);
        ledger.setAuthorizedHook(address(0));
    }

    function _register(address wallet, bytes32 allocation, uint256 nonce) internal {
        uint256 expiry = block.timestamp + 1 days;
        ledger.registerWallet(
            wallet, allocation, groupId, expiry, nonce, _sign(ledger, wallet, allocation, groupId, expiry, nonce, signerKey)
        );
    }

    function _hookSpend(address wallet, bytes32 group, uint256 period, uint256 amount) internal {
        if (ledger.authorizedHook() != address(0xA11)) {
            ledger.setAuthorizedHook(address(0xA11));
        }
        vm.prank(address(0xA11));
        ledger.recordSpend(wallet, group, period, amount);
    }

    function _writeSpend(bytes32 allocation, bytes32 group, uint256 period, uint256 amount) internal {
        stdstore.target(address(ledger)).sig("spentByAllocation(bytes32,bytes32,uint256)").with_key(allocation)
            .with_key(group).with_key(period).checked_write(amount);
        if (amount > ledger.highestSpendByGroupPeriod(group, period)) {
            stdstore.target(address(ledger)).sig("highestSpendByGroupPeriod(bytes32,uint256)").with_key(group)
                .with_key(period).checked_write(amount);
        }
    }

    function _sign(
        AllocationLedger target,
        address wallet,
        bytes32 allocation,
        bytes32 group,
        uint256 expiry,
        uint256 nonce,
        uint256 key
    ) internal view returns (bytes memory) {
        bytes32 structHash =
            keccak256(abi.encode(target.REGISTRATION_TYPEHASH(), wallet, allocation, group, expiry, nonce));
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            target.eip712Domain();
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
