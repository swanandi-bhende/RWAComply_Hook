// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";

import {DemoLiquidity} from "./DemoLiquidity.sol";
import {AllocationLedger} from "../src/AllocationLedger.sol";
import {HookFlags} from "../src/HookFlags.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MockRWAOracle} from "../src/MockRWAOracle.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PoolExecutor} from "../src/PoolExecutor.sol";
import {RWAComplyHook} from "../src/RWAComplyHook.sol";

contract DeployFull is Script {
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint256 internal constant CAP = 1_000_000_000;
    uint256 internal constant PROOF_PURCHASE = 1_000_000;
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        require(pk != 0, "PRIVATE_KEY missing");

        address deployerEOA = vm.addr(pk);
        bytes32 groupId = keccak256("rwa-comply-demo");
        uint256 periodId = 1;

        vm.startBroadcast(pk);

        PoolManager poolManager = new PoolManager(address(0));
        MockRWAOracle oracle = new MockRWAOracle(deployerEOA);

        (bytes32 salt, address predictedHook) = _findValidHookSalt(
            IPoolManager(address(poolManager)),
            address(oracle),
            deployerEOA
        );

        RWAComplyHook hook = new RWAComplyHook{salt: salt}(
            IPoolManager(address(poolManager)),
            address(oracle),
            deployerEOA
        );
        require(address(hook) == predictedHook, "Hook mismatch");
        require(
            uint160(address(hook)) & Hooks.ALL_HOOK_MASK == HookFlags.toFlags(hook.getHookPermissions()),
            "Invalid hook address"
        );

        oracle.setVolatility(3);

        MockUSDC usdc = new MockUSDC();
        MockERC20 rwa = new MockERC20("RWA", "RWA", 0);
        require(address(usdc) != address(rwa), "pair collapsed");

        (address token0, address token1) =
            address(usdc) < address(rwa) ? (address(usdc), address(rwa)) : (address(rwa), address(usdc));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        poolManager.initialize(key, SQRT_PRICE_1_1);

        AllocationLedger ledger = new AllocationLedger(deployerEOA, deployerEOA);
        PoolExecutor executor = new PoolExecutor(
            IPoolManager(address(poolManager)),
            address(usdc),
            address(rwa),
            address(hook)
        );

        ledger.setAuthorizedHook(address(hook));
        hook.setTrustedRouter(address(executor));
        hook.setQuoteTokens(address(usdc), address(rwa));
        hook.setLedger(address(ledger));
        hook.setAllocation(groupId, periodId);
        ledger.setPolicy(groupId, periodId, CAP, address(usdc));

        uint256 expiry = block.timestamp + 30 days;
        bytes32 allocationId = keccak256(abi.encodePacked("deployer", deployerEOA));
        ledger.registerWallet(
            deployerEOA,
            allocationId,
            groupId,
            expiry,
            1,
            _sign(ledger, pk, deployerEOA, allocationId, groupId, expiry, 1)
        );
        hook.setTier(deployerEOA, 2);

        DemoLiquidity liquidity = new DemoLiquidity(IPoolManager(address(poolManager)));
        hook.setTier(address(liquidity), 2);
        usdc.mint(address(liquidity), 1e30);
        rwa.mint(address(liquidity), 1e30);
        usdc.mint(deployerEOA, 10_000_000_000);
        liquidity.add(key);

        usdc.approve(address(executor), PROOF_PURCHASE);
        executor.swapExactInput(key, PROOF_PURCHASE);

        require(usdc.decimals() == 6, "usdc decimals");
        require(ledger.authorizedHook() == address(hook), "hook not authorized");
        require(ledger.spentByAllocation(allocationId, groupId, periodId) == PROOF_PURCHASE, "spend not recorded");
        require(hook.trustedRouter() == address(executor), "router mismatch");
        require(hook.usdc() == address(usdc) && hook.rwaToken() == address(rwa), "pair mismatch");
        require(hook.allocationGroupId() == groupId && hook.allocationPeriodId() == periodId, "allocation mismatch");

        vm.stopBroadcast();

        console.log("CANONICAL FLOW COMPLETE");
        console.log("POOL_MANAGER:", address(poolManager));
        console.log("HOOK_ADDRESS:", address(hook));
        console.log("ORACLE:", address(oracle));
        console.log("USDC:", address(usdc));
        console.log("RWA:", address(rwa));
        console.log("TOKEN_A:", address(usdc));
        console.log("TOKEN_B:", address(rwa));
        console.log("LEDGER:", address(ledger));
        console.log("EXECUTOR:", address(executor));
        console.log("BROADCAST:", "broadcast/DeployFull.s.sol/31337/run-latest.json");
    }

    function _sign(
        AllocationLedger ledger,
        uint256 pk,
        address wallet,
        bytes32 allocationId,
        bytes32 groupId,
        uint256 expiry,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 structHash =
            keccak256(abi.encode(ledger.REGISTRATION_TYPEHASH(), wallet, allocationId, groupId, expiry, nonce));
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) = ledger.eip712Domain();
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                keccak256(
                    abi.encode(
                        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                        keccak256(bytes(name)),
                        keccak256(bytes(version)),
                        chainId,
                        verifyingContract
                    )
                ),
                structHash
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _findValidHookSalt(IPoolManager poolManager, address oracle, address owner)
        internal
        pure
        returns (bytes32 salt, address predicted)
    {
        bytes32 bytecodeHash =
            keccak256(abi.encodePacked(type(RWAComplyHook).creationCode, abi.encode(poolManager, oracle, owner)));
        return HookFlags.mine(CREATE2_DEPLOYER, bytecodeHash, HookFlags.toFlags(HookFlags.declared()));
    }
}
