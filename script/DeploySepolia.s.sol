// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";

import {HookFlags} from "../src/HookFlags.sol";
import {SepoliaWiring} from "./SepoliaWiring.sol";

/// @notice Sepolia deployment. `preflight` only reads. `run` is not executed by the preparation step.
contract DeploySepolia is Script {
    address internal constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint256 internal constant SEPOLIA = 11155111;

    function preflight() external {
        vm.createSelectFork(vm.envString("ALLOCATION_RPC_URL"));
        require(block.chainid == SEPOLIA, "RPC is not Ethereum Sepolia");
        require(vm.envUint("ALLOCATION_CHAIN_ID") == SEPOLIA, "ALLOCATION_CHAIN_ID is not Ethereum Sepolia");
        require(POOL_MANAGER.code.length > 0, "official PoolManager has no code");
        require(CREATE2_DEPLOYER.code.length > 0, "CREATE2 deployer has no code");

        address signer = vm.envAddress("ALLOCATION_AUTH_SIGNER_ADDRESS");
        require(signer != address(0), "ALLOCATION_AUTH_SIGNER_ADDRESS missing");
        bytes32 groupId = vm.envBytes32("ALLOCATION_GROUP_ID");
        require(groupId != bytes32(0), "ALLOCATION_GROUP_ID missing");

        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        require(pk != 0, "PRIVATE_KEY missing");
        address deployer = vm.addr(pk);
        require(deployer.balance > 0, "deployer has no Sepolia ETH");

        console.log("preflight ok");
        console.log("chain", block.chainid);
        console.log("pool manager", POOL_MANAGER);
        console.log("create2 deployer", CREATE2_DEPLOYER);
        console.log("deployer", deployer);
        console.log("deployer balance", deployer.balance);
        console.log("allocation signer", signer);
        console.log("hook permission flags", HookFlags.toFlags(HookFlags.declared()));
        console.log("group");
        console.logBytes32(groupId);
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address signer = vm.envAddress("ALLOCATION_AUTH_SIGNER_ADDRESS");
        bytes32 groupId = vm.envBytes32("ALLOCATION_GROUP_ID");

        vm.createSelectFork(vm.envString("ALLOCATION_RPC_URL"));
        require(block.chainid == SEPOLIA, "RPC is not Ethereum Sepolia");
        require(POOL_MANAGER.code.length > 0, "official PoolManager has no code");

        vm.startBroadcast(pk);
        SepoliaWiring wiring = new SepoliaWiring();
        SepoliaWiring.Market memory market =
            wiring.deploy(IPoolManager(POOL_MANAGER), signer, groupId, deployer);
        vm.stopBroadcast();

        require(address(market.poolManager) == POOL_MANAGER, "pool manager changed");
        require(market.ledger.backendSigner() == signer, "backend signer");
        require(market.ledger.owner() == deployer, "ledger owner");
        require(address(market.hook.poolManager()) == POOL_MANAGER, "hook pool manager");
        require(address(market.hook.ledger()) == address(market.ledger), "hook ledger");
        require(market.hook.trustedRouter() == address(market.executor), "hook router");
        require(address(market.executor.poolManager()) == POOL_MANAGER, "executor pool manager");
        require(market.executor.trustedHook() == address(market.hook), "executor hook");
        require(market.hook.allocationGroupId() == groupId, "group");
        require(market.hook.usdc() == address(market.usdc), "usdc");
        require(market.hook.rwaToken() == address(market.rwa), "rwa");
        require(market.hook.userTier(deployer) == 0, "deployer tier must stay unset");

        console.log("POOL_MANAGER", POOL_MANAGER);
        console.log("LEDGER", address(market.ledger));
        console.log("HOOK", address(market.hook));
        console.log("EXECUTOR", address(market.executor));
        console.log("ORACLE", address(market.oracle));
        console.log("USDC", address(market.usdc));
        console.log("RWA", address(market.rwa));
        console.log("SIGNER", signer);
        console.log("group");
        console.logBytes32(groupId);
    }
}
