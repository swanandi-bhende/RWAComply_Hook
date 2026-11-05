// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title AllocationLedger
/// @notice Stores pseudonymous allocation identity and USDC budget accounting.
/// @dev This contract does not execute swaps. The future hook calls `recordSpend`.
///      Amounts are raw USDC units with 6 decimals: 1_000_000_000 is $1,000.
///      World ID sessions, nullifiers, and proofs are not stored here.
///      The backend signer attests that offchain verification already happened.
///      Allocation ids are pseudonymous. The public wallet mapping shows which wallets share one.
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

    /// @notice The only account allowed to record spend. `address(0)` disables recording.
    address public authorizedHook;

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

    /// @notice Largest cumulative spend recorded for one group and period.
    /// @dev Lets `setPolicy` reject a cap below spend already recorded, without scanning every allocation id.
    mapping(bytes32 => mapping(uint256 => uint256)) public highestSpendByGroupPeriod;

    /// @notice Quote token locked for an allocation group. `address(0)` means unset.
    mapping(bytes32 => address) public quoteTokenByGroup;

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

    /// @notice Emitted when the owner changes the account allowed to record spend.
    event AuthorizedHookUpdated(address indexed previousHook, address indexed newHook);

    /// @notice Emitted when the authorized hook records a purchase.
    event SpendRecorded(
        address indexed wallet,
        bytes32 indexed allocationId,
        bytes32 indexed groupId,
        uint256 periodId,
        uint256 amount,
        uint256 newSpent
    );

    error ZeroGroupId();
    error ZeroAddress();
    error ZeroCap();
    error ZeroAmount();
    error ZeroAllocationId();
    error AuthorizationExpired();
    error NonceAlreadyUsed(uint256 nonce);
    error InvalidSignature();
    error SignerNotConfigured();
    error AllocationMismatch(bytes32 currentAllocationId, bytes32 newAllocationId);
    error HookNotAuthorized(address caller);
    error WalletNotRegistered(address wallet);
    error PolicyNotConfigured(bytes32 groupId, uint256 periodId);
    error CapExceeded(uint256 spent, uint256 amount, uint256 cap);
    error CapBelowRecordedSpend(uint256 cap, uint256 recordedSpend);
    error QuoteTokenImmutable(address lockedQuoteToken, address newQuoteToken);

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

    /// @notice Set the only account that may record spend. Cannot be cleared back to zero.
    function setAuthorizedHook(address newHook) external onlyOwner {
        if (newHook == address(0)) revert ZeroAddress();
        address previousHook = authorizedHook;
        authorizedHook = newHook;
        emit AuthorizedHookUpdated(previousHook, newHook);
    }

    /// @notice Create or replace the spending policy for one group and period.
    /// @dev Does not write `spentByAllocation`. The cap may not fall below spend already recorded
    ///      for this group and period. The group's quote token is fixed by the first policy.
    function setPolicy(bytes32 groupId, uint256 periodId, uint256 cap, address usdc) external onlyOwner {
        if (groupId == bytes32(0)) revert ZeroGroupId();
        if (usdc == address(0)) revert ZeroAddress();
        if (cap == 0) revert ZeroCap();

        uint256 recordedSpend = highestSpendByGroupPeriod[groupId][periodId];
        if (cap < recordedSpend) revert CapBelowRecordedSpend(cap, recordedSpend);

        address lockedQuoteToken = quoteTokenByGroup[groupId];
        if (lockedQuoteToken == address(0)) {
            quoteTokenByGroup[groupId] = usdc;
        } else if (usdc != lockedQuoteToken) {
            revert QuoteTokenImmutable(lockedQuoteToken, usdc);
        }

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

    /// @notice Remaining USDC budget for `wallet`'s allocation in this group and period.
    /// @dev Reverts when the wallet is unregistered or the policy is unset.
    ///      Returns zero when recorded spend is already at or above the cap.
    ///      Does not write storage. Every wallet that shares the allocation id sees the same value.
    function remaining(address wallet, bytes32 groupId, uint256 periodId) external view returns (uint256) {
        (, Policy memory policy, uint256 spent) = _budget(wallet, groupId, periodId);
        if (spent >= policy.cap) return 0;
        return policy.cap - spent;
    }

    /// @notice Record a gross USDC purchase against the wallet's shared allocation budget.
    /// @dev Only `authorizedHook` may call this. Purchases increase spend. Nothing in this contract decreases it.
    ///      The amount is raw six-decimal USDC. This function does not transfer tokens or execute a swap.
    function recordSpend(address wallet, bytes32 groupId, uint256 periodId, uint256 usdcAmount) external {
        if (authorizedHook == address(0) || msg.sender != authorizedHook) revert HookNotAuthorized(msg.sender);
        if (usdcAmount == 0) revert ZeroAmount();

        (bytes32 allocationId, Policy memory policy, uint256 spent) = _budget(wallet, groupId, periodId);
        uint256 newSpent = spent + usdcAmount;
        if (newSpent > policy.cap) revert CapExceeded(spent, usdcAmount, policy.cap);

        spentByAllocation[allocationId][groupId][periodId] = newSpent;
        if (newSpent > highestSpendByGroupPeriod[groupId][periodId]) {
            highestSpendByGroupPeriod[groupId][periodId] = newSpent;
        }
        emit SpendRecorded(wallet, allocationId, groupId, periodId, usdcAmount, newSpent);
    }

    /// @dev Shared lookup for reads and spend recording. A policy with a zero cap is unset,
    ///      because `setPolicy` rejects a zero cap.
    function _budget(address wallet, bytes32 groupId, uint256 periodId)
        private
        view
        returns (bytes32 allocationId, Policy memory policy, uint256 spent)
    {
        if (wallet == address(0)) revert ZeroAddress();
        if (groupId == bytes32(0)) revert ZeroGroupId();

        allocationId = allocationIdByWallet[wallet];
        if (allocationId == bytes32(0)) revert WalletNotRegistered(wallet);

        policy = policyByGroupPeriod[groupId][periodId];
        if (policy.cap == 0) revert PolicyNotConfigured(groupId, periodId);

        spent = spentByAllocation[allocationId][groupId][periodId];
    }

    function _setBackendSigner(address newSigner) private {
        address previousSigner = backendSigner;
        backendSigner = newSigner;
        emit BackendSignerUpdated(previousSigner, newSigner);
    }
}
