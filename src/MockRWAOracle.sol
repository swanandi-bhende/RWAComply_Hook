// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockRWAOracle is Ownable {

    uint256 private volatility;

    event VolatilityUpdated(uint256 newVolatility);

    constructor(address owner_) Ownable(owner_) {}

    function setVolatility(uint256 _vol) external onlyOwner {
        volatility = _vol;
        emit VolatilityUpdated(_vol);
    }

    function getVolatility() external view returns (uint256) {
        return volatility;
    }
}