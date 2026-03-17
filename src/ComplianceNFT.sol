// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ComplianceNFT is ERC721, Ownable {

    uint256 public nextId;

    constructor(address initialOwner)
        ERC721("ComplianceNFT", "CNFT")
        Ownable(initialOwner)
    {}

    function mint(address to) external onlyOwner {
        nextId++;
        _mint(to, nextId);
    }
}