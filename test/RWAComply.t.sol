// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RWAComplyHook.sol";
import "../src/MockRWAOracle.sol";

contract RWAComplyTest is Test {

    RWAComplyHook hook;
    MockRWAOracle oracle;

    address user = address(1);

    function setUp() public {
        oracle = new MockRWAOracle();
        hook = new RWAComplyHook(address(oracle));
    }

    function testRevertIfUnverified() public {
        vm.expectRevert();
        hook.beforeSwap(user);
    }

    function testRetailFee() public {
        hook.setTier(user, 1);
        uint24 fee = hook.beforeSwap(user);
        assertTrue(fee > 0);
    }

    function testInstitutionalFee() public {
        hook.setTier(user, 2);
        uint24 fee = hook.beforeSwap(user);
        assertTrue(fee < 1000);
    }

    function testPause() public {
        hook.pause(true);
        vm.expectRevert();
        hook.beforeSwap(user);
    }
}