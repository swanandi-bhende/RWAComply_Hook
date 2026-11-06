// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRwaApprover {
    function approveRwa(address rwa, bool allowed) external;
}

interface IOfferingConfig {
    struct OfferingView {
        address issuer;
        address rwa;
        bytes32 groupId;
        uint256 periodId;
        uint256 cap;
        uint64 startTime;
        uint64 endTime;
        uint32 version;
        address liquidityOperator;
        bool paused;
        bool exists;
        bool tokenReviewed;
    }

    function offeringForPool(bytes32 poolId) external view returns (bytes32 offeringId, OfferingView memory offering);

    function isPurchaseBlocked(bytes32 offeringId, address wallet) external view returns (bool);

    function investorTier(bytes32 offeringId, address wallet) external view returns (uint8);

    function usdc() external view returns (address);
}
