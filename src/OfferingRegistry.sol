// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";

import {AllocationLedger} from "./AllocationLedger.sol";
import {IOfferingConfig, IRwaApprover} from "./IMarketplace.sol";

/// @title OfferingRegistry
/// @notice Issuer authorization and one allocation group per offering.
/// @dev This contract becomes the ledger owner on a new deployment. It is not the owner of the
///      already deployed Sepolia ledger. Arkiv metadata is not read here.
contract OfferingRegistry is Ownable, EIP712, IOfferingConfig {
    using PoolIdLibrary for PoolKey;

    uint256 public constant MAX_CAP = 1_000_000_000_000_000;

    bytes32 public constant RESTORE_TYPEHASH = keccak256(
        "Restore(address wallet,bytes32 offeringId,uint256 epoch,uint256 expiry,uint256 nonce)"
    );

    AllocationLedger public immutable ledger;
    address public immutable usdc;

    IRwaApprover public executor;
    address public hook;

    struct Offering {
        address issuer;
        address rwa;
        bytes32 groupId;
        uint256 periodId;
        uint256 cap;
        uint64 startTime;
        uint64 endTime;
        uint32 version;
        bytes32 poolId;
        address liquidityOperator;
        bool paused;
        bool exists;
        bool tokenReviewed;
        string name;
        string symbol;
        string category;
    }

    mapping(address => bool) public authorizedIssuer;
    mapping(bytes32 => Offering) private offerings;
    mapping(bytes32 => bool) public groupUsed;
    mapping(bytes32 => bytes32) public poolToOffering;
    mapping(address => bool) public tokenReviewed;
    bytes32[] private offeringIds;

    mapping(address => uint256) public revocationEpoch;
    mapping(address => uint256) public restoredThroughEpoch;
    mapping(bytes32 => mapping(address => uint256)) public offeringRevocationEpoch;
    mapping(bytes32 => mapping(address => uint256)) public offeringRestoredEpoch;
    mapping(uint256 => bool) public usedRestoreNonce;

    event IssuerAuthorized(address indexed issuer, bool allowed);
    event OfferingCreated(
        bytes32 indexed offeringId,
        address indexed issuer,
        bytes32 indexed groupId,
        uint256 cap,
        uint256 periodId,
        address rwa
    );
    event PolicyUpdated(bytes32 indexed offeringId, uint32 version, uint256 cap, uint64 endTime);
    event OfferingPaused(bytes32 indexed offeringId, bool paused);
    event PoolRegistered(bytes32 indexed offeringId, bytes32 indexed poolId);
    event WalletRevoked(address indexed wallet, bytes32 indexed offeringId, uint256 epoch);
    event WalletRestored(address indexed wallet, bytes32 indexed offeringId, uint256 epoch);

    error NotIssuer();
    error OfferingExists();
    error UnknownOffering();
    error InvalidOffering();
    error InvalidToken();
    error GroupUsed();
    error PoolUsed();
    error WrongHook();
    error PairMismatch();
    error NotRevoked();
    error AuthorizationExpired();
    error InvalidSignature();
    error NonceUsed();
    error AlreadySet();
    error CapBelowSpend(uint256 cap, uint256 spent);

    constructor(AllocationLedger ledger_, address usdc_, address initialOwner)
        Ownable(initialOwner)
        EIP712("OfferingRegistry", "1")
    {
        if (address(ledger_) == address(0) || usdc_ == address(0)) revert InvalidOffering();
        ledger = ledger_;
        usdc = usdc_;
    }

    function setExecutor(IRwaApprover executor_) external onlyOwner {
        if (address(executor) != address(0)) revert AlreadySet();
        if (address(executor_) == address(0)) revert InvalidOffering();
        executor = executor_;
    }

    function setHook(address hook_) external onlyOwner {
        if (hook != address(0)) revert AlreadySet();
        if (hook_ == address(0)) revert InvalidOffering();
        hook = hook_;
    }

    function authorizeIssuer(address issuer, bool allowed) external onlyOwner {
        if (issuer == address(0)) revert InvalidOffering();
        authorizedIssuer[issuer] = allowed;
        emit IssuerAuthorized(issuer, allowed);
    }

    function reviewToken(address token, bool reviewed) external onlyOwner {
        tokenReviewed[token] = reviewed;
    }

    function createOffering(
        string calldata name,
        string calldata symbol,
        string calldata category,
        address rwa,
        bytes32 groupId,
        uint256 periodId,
        uint256 cap,
        uint64 startTime,
        uint64 endTime
    ) external returns (bytes32 offeringId) {
        if (!authorizedIssuer[msg.sender]) revert NotIssuer();
        if (bytes(name).length == 0 || bytes(name).length > 64) revert InvalidOffering();
        if (bytes(symbol).length == 0 || bytes(symbol).length > 12) revert InvalidOffering();
        if (rwa == address(0) || rwa == usdc || rwa.code.length == 0) revert InvalidToken();
        if (!_hasDecimals(rwa)) revert InvalidToken();
        if (groupId == bytes32(0) || groupUsed[groupId]) revert GroupUsed();
        if (periodId == 0 || cap == 0 || cap > MAX_CAP) revert InvalidOffering();
        if (startTime >= endTime || endTime <= block.timestamp) revert InvalidOffering();

        ledger.setPolicy(groupId, periodId, cap, usdc);
        executor.approveRwa(rwa, true);

        offeringId = keccak256(abi.encode(msg.sender, groupId, rwa, offeringIds.length));
        if (offerings[offeringId].exists) revert OfferingExists();
        groupUsed[groupId] = true;
        offerings[offeringId] = Offering({
            issuer: msg.sender,
            rwa: rwa,
            groupId: groupId,
            periodId: periodId,
            cap: cap,
            startTime: startTime,
            endTime: endTime,
            version: 1,
            poolId: bytes32(0),
            liquidityOperator: address(0),
            paused: false,
            exists: true,
            tokenReviewed: tokenReviewed[rwa],
            name: name,
            symbol: symbol,
            category: category
        });
        offeringIds.push(offeringId);
        emit OfferingCreated(offeringId, msg.sender, groupId, cap, periodId, rwa);
    }

    function updateCap(bytes32 offeringId, uint256 cap) external {
        Offering storage offering = _editable(offeringId);
        if (cap == 0 || cap > MAX_CAP) revert InvalidOffering();
        uint256 spent = ledger.highestSpendByGroupPeriod(offering.groupId, offering.periodId);
        if (cap < spent) revert CapBelowSpend(cap, spent);
        ledger.setPolicy(offering.groupId, offering.periodId, cap, usdc);
        offering.cap = cap;
        offering.version += 1;
        emit PolicyUpdated(offeringId, offering.version, cap, offering.endTime);
    }

    function updateEndTime(bytes32 offeringId, uint64 endTime) external {
        Offering storage offering = _editable(offeringId);
        if (endTime <= offering.startTime || endTime <= block.timestamp) revert InvalidOffering();
        offering.endTime = endTime;
        offering.version += 1;
        emit PolicyUpdated(offeringId, offering.version, offering.cap, endTime);
    }

    function setPaused(bytes32 offeringId, bool paused) external {
        Offering storage offering = _editable(offeringId);
        offering.paused = paused;
        emit OfferingPaused(offeringId, paused);
    }

    function setLiquidityOperator(bytes32 offeringId, address operator) external {
        Offering storage offering = _editable(offeringId);
        if (operator == address(0)) revert InvalidOffering();
        offering.liquidityOperator = operator;
    }

    function registerPool(bytes32 offeringId, PoolKey calldata key) external {
        Offering storage offering = _editable(offeringId);
        if (address(key.hooks) != hook) revert WrongHook();
        address currency0 = Currency.unwrap(key.currency0);
        address currency1 = Currency.unwrap(key.currency1);
        bool pair = (currency0 == usdc && currency1 == offering.rwa) || (currency1 == usdc && currency0 == offering.rwa);
        if (!pair) revert PairMismatch();
        bytes32 poolId = PoolId.unwrap(key.toId());
        if (poolToOffering[poolId] != bytes32(0)) revert PoolUsed();
        poolToOffering[poolId] = offeringId;
        if (offering.poolId == bytes32(0)) offering.poolId = poolId;
        emit PoolRegistered(offeringId, poolId);
    }

    function setInvestorTier(bytes32 offeringId, address wallet, uint8 tier) external {
        Offering storage offering = _editable(offeringId);
        if (wallet == address(0) || tier > 2 || !offering.exists) revert InvalidOffering();
        investorTier[offeringId][wallet] = tier;
        emit TierSet(offeringId, wallet, tier);
    }

    mapping(bytes32 => mapping(address => uint8)) public investorTier;
    event TierSet(bytes32 indexed offeringId, address indexed wallet, uint8 tier);

    function revokeWallet(address wallet) external onlyOwner {
        _revoke(wallet, bytes32(0));
    }

    function revokeOfferingWallet(bytes32 offeringId, address wallet) external {
        _known(offeringId);
        if (msg.sender != offerings[offeringId].issuer && msg.sender != owner()) revert NotIssuer();
        _revoke(wallet, offeringId);
    }

    function restoreWallet(
        address wallet,
        bytes32 offeringId,
        uint256 expiry,
        uint256 nonce,
        bytes calldata signature
    ) external {
        uint256 epoch = _epoch(offeringId, wallet);
        uint256 restored = _restored(offeringId, wallet);
        if (epoch <= restored) revert NotRevoked();
        if (block.timestamp > expiry) revert AuthorizationExpired();
        if (usedRestoreNonce[nonce]) revert NonceUsed();
        address signer = ledger.backendSigner();
        if (signer == address(0)) revert InvalidSignature();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(RESTORE_TYPEHASH, wallet, offeringId, epoch, expiry, nonce)));
        if (ECDSA.recover(digest, signature) != signer) revert InvalidSignature();
        usedRestoreNonce[nonce] = true;
        if (offeringId == bytes32(0)) restoredThroughEpoch[wallet] = epoch;
        else offeringRestoredEpoch[offeringId][wallet] = epoch;
        emit WalletRestored(wallet, offeringId, epoch);
    }

    function offeringCount() external view returns (uint256) {
        return offeringIds.length;
    }

    function offeringIdAt(uint256 index) external view returns (bytes32) {
        return offeringIds[index];
    }

    function getOffering(bytes32 offeringId) external view returns (Offering memory) {
        _known(offeringId);
        return offerings[offeringId];
    }

    function offeringForPool(bytes32 poolId) external view returns (bytes32 offeringId, OfferingView memory offering) {
        offeringId = poolToOffering[poolId];
        if (offeringId == bytes32(0)) revert UnknownOffering();
        Offering storage stored = offerings[offeringId];
        offering = OfferingView({
            issuer: stored.issuer,
            rwa: stored.rwa,
            groupId: stored.groupId,
            periodId: stored.periodId,
            cap: stored.cap,
            startTime: stored.startTime,
            endTime: stored.endTime,
            version: stored.version,
            liquidityOperator: stored.liquidityOperator,
            paused: stored.paused,
            exists: stored.exists,
            tokenReviewed: stored.tokenReviewed
        });
    }

    function isPurchaseBlocked(bytes32 offeringId, address wallet) external view returns (bool) {
        if (revocationEpoch[wallet] > restoredThroughEpoch[wallet]) return true;
        return offeringRevocationEpoch[offeringId][wallet] > offeringRestoredEpoch[offeringId][wallet];
    }

    function _editable(bytes32 offeringId) private view returns (Offering storage offering) {
        offering = offerings[offeringId];
        if (!offering.exists) revert UnknownOffering();
        if (msg.sender != offering.issuer && msg.sender != owner()) revert NotIssuer();
    }

    function _known(bytes32 offeringId) private view {
        if (!offerings[offeringId].exists) revert UnknownOffering();
    }

    function _revoke(address wallet, bytes32 offeringId) private {
        if (wallet == address(0)) revert InvalidOffering();
        if (offeringId == bytes32(0)) revocationEpoch[wallet] += 1;
        else offeringRevocationEpoch[offeringId][wallet] += 1;
        emit WalletRevoked(wallet, offeringId, _epoch(offeringId, wallet));
    }

    function _epoch(bytes32 offeringId, address wallet) private view returns (uint256) {
        if (offeringId == bytes32(0)) return revocationEpoch[wallet];
        return offeringRevocationEpoch[offeringId][wallet];
    }

    function _restored(bytes32 offeringId, address wallet) private view returns (uint256) {
        if (offeringId == bytes32(0)) return restoredThroughEpoch[wallet];
        return offeringRestoredEpoch[offeringId][wallet];
    }

    function _hasDecimals(address token) private view returns (bool) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        return ok && data.length >= 32;
    }
}
