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
        bytes memory signature = abi.encodePacked(bytes32(uint256(1)), bytes32(uint256(2)), uint8(27));

        vm.expectRevert(AllocationLedger.InvalidSignature.selector);
        ledger.registerWallet(wallet, allocationId, groupId, expiry, 1, signature);
    }

    function testExpiredAuthorizationReverts() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp - 1;
        bytes memory signature = _sign(ledger, wallet, allocationId, groupId, expiry, 1, signerKey);

        vm.expectRevert(AllocationLedger.AuthorizationExpired.selector);
        ledger.registerWallet(wallet, allocationId, groupId, expiry, 1, signature);
        assertFalse(ledger.usedNonce(1));
    }

    function testZeroWalletReverts() public {
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(ledger, address(0), allocationId, groupId, expiry, 1, signerKey);

        vm.expectRevert(AllocationLedger.ZeroAddress.selector);
        ledger.registerWallet(address(0), allocationId, groupId, expiry, 1, signature);
    }

    function testZeroAllocationIdReverts() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(ledger, wallet, bytes32(0), groupId, expiry, 1, signerKey);

        vm.expectRevert(AllocationLedger.ZeroAllocationId.selector);
        ledger.registerWallet(wallet, bytes32(0), groupId, expiry, 1, signature);
    }

    function testZeroGroupIdReverts() public {
        address wallet = address(0x1111);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory signature = _sign(ledger, wallet, allocationId, bytes32(0), expiry, 1, signerKey);

        vm.expectRevert(AllocationLedger.ZeroGroupId.selector);
        ledger.registerWallet(wallet, allocationId, bytes32(0), expiry, 1, signature);
    }

    function testReusedNonceReverts() public {
        address wallet = address(0x1111);
        address otherWallet = address(0x2222);
        uint256 expiry = block.timestamp + 1 days;
        uint256 nonce = 4;

        ledger.registerWallet(
            wallet, allocationId, groupId, expiry, nonce, _sign(ledger, wallet, allocationId, groupId, expiry, nonce, signerKey)
        );

        bytes memory second = _sign(ledger, otherWallet, allocationId, groupId, expiry, nonce, signerKey);
        vm.expectRevert(abi.encodeWithSelector(AllocationLedger.NonceAlreadyUsed.selector, nonce));
        ledger.registerWallet(otherWallet, allocationId, groupId, expiry, nonce, second);
        assertEq(ledger.allocationIdByWallet(otherWallet), bytes32(0));
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

    function _writeSpend(bytes32 allocation, bytes32 group, uint256 period, uint256 amount) internal {
        stdstore.target(address(ledger)).sig("spentByAllocation(bytes32,bytes32,uint256)").with_key(allocation)
            .with_key(group).with_key(period).checked_write(amount);
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
