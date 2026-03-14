// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockRWAOracle {

    uint256 private volatility;

    event VolatilityUpdated(uint256 newVolatility);

    function setVolatility(uint256 _vol) external {
        volatility = _vol;
        emit VolatilityUpdated(_vol);
    }

    function getVolatility() external view returns (uint256) {
        return volatility;
    }
}