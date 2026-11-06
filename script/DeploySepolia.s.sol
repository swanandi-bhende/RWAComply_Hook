// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";

import {AllocationLedger} from "../src/AllocationLedger.sol";
import {DemoLiquidity} from "./DemoLiquidity.sol";
import {HookFlags} from "../src/HookFlags.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MockRWAOracle} from "../src/MockRWAOracle.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PoolExecutor} from "../src/PoolExecutor.sol";
import {RWAComplyHook} from "../src/RWAComplyHook.sol";

/// @notice Sepolia deployment. `preflight` only reads. `run` is not executed by the preparation step.
contract DeploySepolia is Script {
    address internal constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint256 internal constant SEPOLIA = 11155111;
    // Glamsterdam EIP-8037 charges 1,530 gas per new byte plus 183,600 for a new account.
    // Foundry 1.5.1 still prices code deposit at 200 gas/byte, so its broadcast limit is too low.
    // Creation limits are the Sepolia eth_estimateGas result plus 20 percent.
    // Call limits add 97,920 gas for each new storage slot, then round up.
    // The 0.5 gwei cap is the fee observed on the reverted creation and fits the deployer balance.
    uint256 public constant ORACLE_GAS = 1_984_519;
    uint256 public constant HOOK_GAS = 17_590_965;
    uint256 public constant USDC_GAS = 5_493_097;
    uint256 public constant RWA_GAS = 5_508_339;
    uint256 public constant LEDGER_GAS = 12_558_349;
    uint256 public constant EXECUTOR_GAS = 9_161_893;
    uint256 public constant LIQUIDITY_GAS = 5_138_716;
    uint256 public constant VOLATILITY_GAS = 400_000;
    uint256 public constant INITIALIZE_GAS = 2_000_000;
    uint256 public constant AUTHORIZED_GAS = 400_000;
    uint256 public constant ROUTER_GAS = 400_000;
    uint256 public constant QUOTES_GAS = 600_000;
    uint256 public constant SET_LEDGER_GAS = 400_000;
    uint256 public constant ALLOCATION_GAS = 600_000;
    uint256 public constant POLICY_GAS = 800_000;
    uint256 public constant TIER_GAS = 400_000;
    uint256 public constant MINT_GAS = 800_000;
    uint256 public constant ADD_GAS = 4_000_000;
    uint256 public constant MAX_FEE_WEI = 500_000_000;
    uint256 public constant GAS_RESERVE = 0.005 ether;

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
        uint256 nonce = vm.getNonce(deployer);
        (address oracle, address usdc, address rwa, address ledger, address executor, address liquidity, address hook) =
            _predicted(deployer, nonce);
        require(oracle.code.length == 0, "oracle address occupied");
        require(hook.code.length == 0, "hook address occupied");
        require(usdc.code.length == 0 && rwa.code.length == 0, "token address occupied");
        require(ledger.code.length == 0 && executor.code.length == 0, "ledger or executor occupied");
        require(liquidity.code.length == 0, "liquidity address occupied");
        require(uint160(hook) & Hooks.ALL_HOOK_MASK == HookFlags.toFlags(HookFlags.declared()), "hook flags");
        uint256 budget = totalGasLimit() * MAX_FEE_WEI;
        require(deployer.balance > budget + GAS_RESERVE, "balance does not cover gas budget");
        require(block.basefee < MAX_FEE_WEI, "base fee exceeds capped max fee");

        console.log("preflight ok");
        console.log("chain", block.chainid);
        console.log("pool manager", POOL_MANAGER);
        console.log("create2 deployer", CREATE2_DEPLOYER);
        console.log("deployer", deployer);
        console.log("deployer balance", deployer.balance);
        console.log("deployer nonce", nonce);
        console.log("base fee", block.basefee);
        console.log("block gas limit", block.gaslimit);
        console.log("gas budget wei", budget);
        console.log("predicted oracle", oracle);
        console.log("predicted hook", hook);
        console.log("predicted usdc", usdc);
        console.log("predicted rwa", rwa);
        console.log("predicted ledger", ledger);
        console.log("predicted executor", executor);
        console.log("predicted liquidity", liquidity);
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
        require(signer != address(0) && signer != deployer, "allocation signer must be a different account");
        require(groupId != bytes32(0), "ALLOCATION_GROUP_ID missing");

        vm.createSelectFork(vm.envString("ALLOCATION_RPC_URL"));
        require(block.chainid == SEPOLIA, "RPC is not Ethereum Sepolia");
        require(POOL_MANAGER.code.length > 0, "official PoolManager has no code");

        vm.startBroadcast(pk);
        MockRWAOracle oracle = new MockRWAOracle(deployer);
        (bytes32 salt, address predicted) = _hookSalt(IPoolManager(POOL_MANAGER), address(oracle), deployer);
        RWAComplyHook hook = new RWAComplyHook{salt: salt}(IPoolManager(POOL_MANAGER), address(oracle), deployer);
        require(address(hook) == predicted, "hook address");
        require(
            uint160(address(hook)) & Hooks.ALL_HOOK_MASK == HookFlags.toFlags(hook.getHookPermissions()),
            "hook permissions"
        );
        oracle.setVolatility{gas: VOLATILITY_GAS}(3);
        MockUSDC usdc = new MockUSDC();
        MockERC20 rwa = new MockERC20("RWA", "RWA", 0);
        (address token0, address token1) =
            address(usdc) < address(rwa) ? (address(usdc), address(rwa)) : (address(rwa), address(usdc));
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        IPoolManager(POOL_MANAGER).initialize{gas: INITIALIZE_GAS}(key, 79228162514264337593543950336);
        AllocationLedger ledger = new AllocationLedger(deployer, signer);
        PoolExecutor executor =
            new PoolExecutor(IPoolManager(POOL_MANAGER), address(usdc), address(rwa), address(hook));
        ledger.setAuthorizedHook{gas: AUTHORIZED_GAS}(address(hook));
        hook.setTrustedRouter{gas: ROUTER_GAS}(address(executor));
        hook.setQuoteTokens{gas: QUOTES_GAS}(address(usdc), address(rwa));
        hook.setLedger{gas: SET_LEDGER_GAS}(address(ledger));
        hook.setAllocation{gas: ALLOCATION_GAS}(groupId, 1);
        ledger.setPolicy{gas: POLICY_GAS}(groupId, 1, 1_000_000_000, address(usdc));
        DemoLiquidity liquidity = new DemoLiquidity(IPoolManager(POOL_MANAGER));
        hook.setTier{gas: TIER_GAS}(address(liquidity), 2);
        usdc.mint{gas: MINT_GAS}(address(liquidity), 1e30);
        rwa.mint{gas: MINT_GAS}(address(liquidity), 1e30);
        liquidity.add{gas: ADD_GAS}(key);
        vm.stopBroadcast();

        require(ledger.backendSigner() == signer, "backend signer");
        require(ledger.owner() == deployer, "ledger owner");
        require(address(hook.poolManager()) == POOL_MANAGER, "hook pool manager");
        require(address(hook.ledger()) == address(ledger), "hook ledger");
        require(hook.trustedRouter() == address(executor), "hook router");
        require(address(executor.poolManager()) == POOL_MANAGER, "executor pool manager");
        require(executor.trustedHook() == address(hook), "executor hook");
        require(hook.allocationGroupId() == groupId, "group");
        require(hook.usdc() == address(usdc) && hook.rwaToken() == address(rwa), "tokens");
        require(hook.userTier(deployer) == 0, "deployer tier must stay unset");

        console.log("POOL_MANAGER", POOL_MANAGER);
        console.log("LEDGER", address(ledger));
        console.log("HOOK", address(hook));
        console.log("EXECUTOR", address(executor));
        console.log("ORACLE", address(oracle));
        console.log("USDC", address(usdc));
        console.log("RWA", address(rwa));
        console.log("SIGNER", signer);
        console.log("group");
        console.logBytes32(groupId);
    }

    function _hookSalt(IPoolManager poolManager, address oracle, address owner)
        internal
        pure
        returns (bytes32 salt, address predicted)
    {
        bytes32 initCodeHash =
            keccak256(abi.encodePacked(type(RWAComplyHook).creationCode, abi.encode(poolManager, oracle, owner)));
        return HookFlags.mine(CREATE2_DEPLOYER, initCodeHash, HookFlags.toFlags(HookFlags.declared()));
    }

    function totalGasLimit() public pure returns (uint256) {
        return ORACLE_GAS + HOOK_GAS + VOLATILITY_GAS + USDC_GAS + RWA_GAS + INITIALIZE_GAS + LEDGER_GAS + EXECUTOR_GAS
            + AUTHORIZED_GAS + ROUTER_GAS + QUOTES_GAS + SET_LEDGER_GAS + ALLOCATION_GAS + POLICY_GAS + LIQUIDITY_GAS
            + TIER_GAS + MINT_GAS + MINT_GAS + ADD_GAS;
    }

    /// @dev Nonce order matches the transactions in `run`. The hook is CREATE2 and does not use a deployer nonce for its address.
    function _predicted(address deployer, uint256 nonce)
        internal
        pure
        returns (
            address oracle,
            address usdc,
            address rwa,
            address ledger,
            address executor,
            address liquidity,
            address hook
        )
    {
        oracle = vm.computeCreateAddress(deployer, nonce);
        usdc = vm.computeCreateAddress(deployer, nonce + 3);
        rwa = vm.computeCreateAddress(deployer, nonce + 4);
        ledger = vm.computeCreateAddress(deployer, nonce + 6);
        executor = vm.computeCreateAddress(deployer, nonce + 7);
        liquidity = vm.computeCreateAddress(deployer, nonce + 14);
        (, hook) = _hookSalt(IPoolManager(POOL_MANAGER), oracle, deployer);
    }
}
