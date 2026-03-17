// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/access/Ownable.sol";

contract ComplianceNFT is ERC721, Ownable {

    uint256 public id;

    mapping(address => uint256) public balance;

    constructor() ERC721("ComplianceNFT", "CNFT") {}

    function mint(address to) external onlyOwner {
        id++;
        _mint(to, id);
        balance[to]++;
    }

    function hasBoost(address user) external view returns (bool) {
        return balance[user] > 1;
    }
}