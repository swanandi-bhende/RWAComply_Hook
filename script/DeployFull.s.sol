// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RWAComplyHook.sol";
import "../src/ComplianceNFT.sol";
import "../src/MockERC20.sol";
import "../src/MockRWAOracle.sol";

contract DeployFull is Script {

    function run() external {
        vm.startBroadcast();

        MockRWAOracle oracle = new MockRWAOracle();
        RWAComplyHook hook = new RWAComplyHook(address(oracle));
        ComplianceNFT nft = new ComplianceNFT();

        hook.setNFT(address(nft));
        nft.transferOwnership(address(hook));

        MockERC20 token0 = new MockERC20("Token0", "T0");
        MockERC20 token1 = new MockERC20("Token1", "T1");

        vm.stopBroadcast();
    }
}