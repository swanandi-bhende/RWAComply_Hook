// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title AllocationLedger
/// @notice Stores pseudonymous allocation identity and USDC budget accounting.
/// @dev This contract does not execute swaps and is not wired to the hook.
///      Amounts are raw USDC units with 6 decimals: 1_000_000_000 is $1,000.
///      World ID sessions, nullifiers, and proofs are not stored here.
///      The backend signer attests that offchain verification already happened.
contract AllocationLedger is Ownable, EIP712 {
    /// @notice Spending cap for one allocation group during one period.
    /// @param cap Maximum cumulative spend, in raw USDC units (6 decimals).
    /// @param periodId Period this policy applies to.
    /// @param usdc USDC token used for this group's accounting.
    struct Policy {
        uint256 cap;
        uint256 periodId;
        address usdc;
    }

    /// @notice EIP-712 type hash for `registerWallet`.
    /// @dev The signed fields are wallet, allocationId, groupId, expiry, and nonce. No other field is signed.
    bytes32 public constant REGISTRATION_TYPEHASH = keccak256(
        "Registration(address wallet,bytes32 allocationId,bytes32 groupId,uint256 expiry,uint256 nonce)"
    );

    /// @notice Account authorized to sign wallet registrations.
    address public backendSigner;

    /// @notice Wallet to pseudonymous allocation id. `bytes32(0)` means unset.
    mapping(address => bytes32) public allocationIdByWallet;

    /// @notice Policy for an allocation group and period.
    /// @dev Keyed by opaque `groupId` (`bytes32`) and `periodId` (`uint256`).
    mapping(bytes32 => mapping(uint256 => Policy)) public policyByGroupPeriod;

    /// @notice Cumulative USDC spent by one allocation, in one group, during one period.
    /// @dev Every wallet that shares an allocation id reads and, later, updates this same counter.
    ///      Distinct allocation ids, groups, and periods keep independent counters.
    ///      `setPolicy` never writes this mapping.
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => uint256))) public spentByAllocation;

    /// @notice Nonces already consumed by a successful registration.
    /// @dev Uniqueness is global. A nonce cannot be reused for another wallet, allocation, or group.
    mapping(uint256 => bool) public usedNonce;

    /// @notice Emitted when a group policy is created or replaced.
    event PolicyUpdated(bytes32 indexed groupId, uint256 indexed periodId, uint256 cap, address usdc);

    /// @notice Emitted when a wallet is bound to an allocation id.
    event WalletRegistered(
        address indexed wallet,
        bytes32 indexed allocationId,
        bytes32 indexed groupId,
        uint256 expiry,
        uint256 nonce
    );

    /// @notice Emitted when the owner changes the backend signer.
    event BackendSignerUpdated(address indexed previousSigner, address indexed newSigner);

    error ZeroGroupId();
    error ZeroAddress();
    error ZeroCap();
    error ZeroAllocationId();
    error AuthorizationExpired();
    error NonceAlreadyUsed(uint256 nonce);
    error InvalidSignature();
    error SignerNotConfigured();
    error AllocationMismatch(bytes32 currentAllocationId, bytes32 newAllocationId);

    /// @param initialOwner Account that can set policy and rotate the backend signer.
    /// @param initialSigner Backend signer. `address(0)` leaves registration disabled until `setBackendSigner`.
    constructor(address initialOwner, address initialSigner)
        Ownable(initialOwner)
        EIP712("AllocationLedger", "1")
    {
        if (initialSigner != address(0)) {
            _setBackendSigner(initialSigner);
        }
    }

    /// @notice Replace the backend account whose EIP-712 signatures can register wallets.
    function setBackendSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        _setBackendSigner(newSigner);
    }

    /// @notice Create or replace the spending policy for one group and period.
    /// @dev Does not read or write `spentByAllocation`. A later period is a different storage key.
    function setPolicy(bytes32 groupId, uint256 periodId, uint256 cap, address usdc) external onlyOwner {
        if (groupId == bytes32(0)) revert ZeroGroupId();
        if (usdc == address(0)) revert ZeroAddress();
        if (cap == 0) revert ZeroCap();

        policyByGroupPeriod[groupId][periodId] = Policy({cap: cap, periodId: periodId, usdc: usdc});

        emit PolicyUpdated(groupId, periodId, cap, usdc);
    }

    /// @notice Bind `wallet` to `allocationId` using a backend EIP-712 authorization.
    /// @dev A wallet already stored under the same allocation id may be registered again with a new
    ///      authorization. That does not change the stored id. A different allocation id reverts.
    ///      The nonce is marked used only after every check succeeds. Replay across chains or
    ///      deployments fails because the EIP-712 domain includes chain id and this contract.
    ///      `groupId` is bound by the signature and the event. It is not a separate membership store.
    function registerWallet(
        address wallet,
        bytes32 allocationId,
        bytes32 groupId,
        uint256 expiry,
        uint256 nonce,
        bytes calldata signature
    ) external {
        if (wallet == address(0)) revert ZeroAddress();
        if (allocationId == bytes32(0)) revert ZeroAllocationId();
        if (groupId == bytes32(0)) revert ZeroGroupId();
        if (block.timestamp > expiry) revert AuthorizationExpired();
        if (usedNonce[nonce]) revert NonceAlreadyUsed(nonce);
        if (backendSigner == address(0)) revert SignerNotConfigured();

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(REGISTRATION_TYPEHASH, wallet, allocationId, groupId, expiry, nonce))
        );
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != backendSigner) revert InvalidSignature();

        bytes32 currentAllocationId = allocationIdByWallet[wallet];
        if (currentAllocationId != bytes32(0) && currentAllocationId != allocationId) {
            revert AllocationMismatch(currentAllocationId, allocationId);
        }

        usedNonce[nonce] = true;
        if (currentAllocationId == bytes32(0)) {
            allocationIdByWallet[wallet] = allocationId;
        }

        emit WalletRegistered(wallet, allocationId, groupId, expiry, nonce);
    }

    function _setBackendSigner(address newSigner) private {
        address previousSigner = backendSigner;
        backendSigner = newSigner;
        emit BackendSignerUpdated(previousSigner, newSigner);
    }
}
