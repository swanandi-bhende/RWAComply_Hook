// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Wallet-signed purchase authorization for the marketplace hook.
/// @dev Chain id is both a struct field and part of the hook EIP-712 domain.
library TradeIntent {
    struct Trade {
        address wallet;
        address recipient;
        bytes32 poolId;
        bytes32 policyId;
        bytes32 allocationGroupId;
        uint256 amountIn;
        uint256 periodId;
        uint32 policyVersion;
        uint256 nonce;
        uint256 deadline;
        uint256 chainId;
        address executor;
    }

    bytes32 internal constant TYPEHASH = keccak256(
        "Trade(address wallet,address recipient,bytes32 poolId,bytes32 policyId,bytes32 allocationGroupId,uint256 amountIn,uint256 periodId,uint32 policyVersion,uint256 nonce,uint256 deadline,uint256 chainId,address executor)"
    );

    function hash(Trade memory trade) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                TYPEHASH,
                trade.wallet,
                trade.recipient,
                trade.poolId,
                trade.policyId,
                trade.allocationGroupId,
                trade.amountIn,
                trade.periodId,
                trade.policyVersion,
                trade.nonce,
                trade.deadline,
                trade.chainId,
                trade.executor
            )
        );
    }
}
