// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {DemoLiquidity} from "../script/DemoLiquidity.sol";
import {DeploySepolia} from "../script/DeploySepolia.s.sol";
import {HookFlags} from "../src/HookFlags.sol";
import {SepoliaWiring} from "../script/SepoliaWiring.sol";

contract DeploySepoliaTest is Test {
    address signer = address(0xBEEF);
    bytes32 groupId = keccak256("rwa-comply-demo");

    function testSepoliaWiringUsesTheProvidedPoolManager() public {
        PoolManager official = new PoolManager(address(0));
        SepoliaWiring wiring = new SepoliaWiring();
        SepoliaWiring.Market memory market = wiring.deploy(IPoolManager(address(official)), signer, groupId, address(this));

        assertEq(address(market.poolManager), address(official));
        assertEq(address(market.hook.poolManager()), address(official));
        assertEq(address(market.executor.poolManager()), address(official));
        assertEq(market.executor.trustedHook(), address(market.hook));
        assertEq(market.hook.trustedRouter(), address(market.executor));
        assertEq(address(market.hook.ledger()), address(market.ledger));
        assertEq(market.ledger.backendSigner(), signer);
        assertEq(market.ledger.owner(), address(this));
        assertEq(market.hook.allocationGroupId(), groupId);
        assertEq(market.hook.allocationPeriodId(), 1);
        assertEq(market.hook.usdc(), address(market.usdc));
        assertEq(market.hook.rwaToken(), address(market.rwa));
        (uint256 cap,, address quote) = market.ledger.policyByGroupPeriod(groupId, 1);
        assertEq(cap, 1_000_000_000);
        assertEq(quote, address(market.usdc));
        assertEq(uint160(address(market.hook)) & Hooks.ALL_HOOK_MASK, HookFlags.toFlags(market.hook.getHookPermissions()));
        assertEq(market.hook.userTier(address(0xCAFE)), 0);

        DeploySepolia deploy = new DeploySepolia();
        uint256 cpsb = 1530;
        assertGe(deploy.ORACLE_GAS(), (120 + address(market.oracle).code.length) * cpsb);
        assertGe(deploy.HOOK_GAS(), (120 + address(market.hook).code.length) * cpsb);
        assertGe(deploy.USDC_GAS(), (120 + address(market.usdc).code.length) * cpsb);
        assertGe(deploy.RWA_GAS(), (120 + address(market.rwa).code.length) * cpsb);
        assertGe(deploy.LEDGER_GAS(), (120 + address(market.ledger).code.length) * cpsb);
        assertGe(deploy.EXECUTOR_GAS(), (120 + address(market.executor).code.length) * cpsb);
        DemoLiquidity helper = new DemoLiquidity(official);
        assertGe(deploy.LIQUIDITY_GAS(), (120 + address(helper).code.length) * cpsb);
    }

    function testAWalletCannotGrantItsOwnAccessTier() public {
        PoolManager official = new PoolManager(address(0));
        SepoliaWiring wiring = new SepoliaWiring();
        SepoliaWiring.Market memory market = wiring.deploy(IPoolManager(address(official)), signer, groupId, address(this));

        address investor = address(0xCAFE);
        vm.prank(investor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, investor));
        market.hook.setTier(investor, 1);

        market.hook.setTier(investor, 1);
        assertEq(market.hook.userTier(investor), 1);
    }

    function testMissingPoolManagerFailsClosed() public {
        SepoliaWiring wiring = new SepoliaWiring();
        vm.expectRevert(SepoliaWiring.PoolManagerMissing.selector);
        wiring.deploy(IPoolManager(address(0x1234)), signer, groupId, address(this));
    }
}
