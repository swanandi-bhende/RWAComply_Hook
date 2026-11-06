// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

/// @notice Deploys the RWAComply market against an existing PoolManager.
/// @dev This contract does not deploy a PoolManager. The hook salt is mined for this contract.
contract SepoliaWiring {
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    uint256 internal constant CAP = 1_000_000_000;
    uint256 internal constant PERIOD = 1;

    struct Market {
        IPoolManager poolManager;
        MockRWAOracle oracle;
        RWAComplyHook hook;
        MockUSDC usdc;
        MockERC20 rwa;
        AllocationLedger ledger;
        PoolExecutor executor;
        PoolKey key;
        bytes32 groupId;
        address backendSigner;
    }

    error PoolManagerMissing();
    error SignerMissing();
    error GroupMissing();

    function deploy(IPoolManager poolManager, address backendSigner, bytes32 groupId, address owner)
        external
        returns (Market memory market)
    {
        if (address(poolManager).code.length == 0) revert PoolManagerMissing();
        if (backendSigner == address(0)) revert SignerMissing();
        if (groupId == bytes32(0)) revert GroupMissing();

        market.poolManager = poolManager;
        market.backendSigner = backendSigner;
        market.groupId = groupId;
        market.oracle = new MockRWAOracle(address(this));

        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(RWAComplyHook).creationCode,
                abi.encode(poolManager, address(market.oracle), address(this))
            )
        );
        (bytes32 salt, address predicted) =
            HookFlags.mine(address(this), initCodeHash, HookFlags.toFlags(HookFlags.declared()));
        market.hook = new RWAComplyHook{salt: salt}(poolManager, address(market.oracle), address(this));
        require(address(market.hook) == predicted, "hook address");
        require(
            uint160(address(market.hook)) & Hooks.ALL_HOOK_MASK == HookFlags.toFlags(market.hook.getHookPermissions()),
            "hook permissions"
        );

        market.oracle.setVolatility(3);
        market.usdc = new MockUSDC();
        market.rwa = new MockERC20("RWA", "RWA", 0);

        (address token0, address token1) = address(market.usdc) < address(market.rwa)
            ? (address(market.usdc), address(market.rwa))
            : (address(market.rwa), address(market.usdc));
        market.key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(market.hook))
        });
        poolManager.initialize(market.key, SQRT_PRICE_1_1);

        market.ledger = new AllocationLedger(address(this), backendSigner);
        market.executor = new PoolExecutor(poolManager, address(market.usdc), address(market.rwa), address(market.hook));

        market.ledger.setAuthorizedHook(address(market.hook));
        market.hook.setTrustedRouter(address(market.executor));
        market.hook.setQuoteTokens(address(market.usdc), address(market.rwa));
        market.hook.setLedger(address(market.ledger));
        market.hook.setAllocation(groupId, PERIOD);
        market.ledger.setPolicy(groupId, PERIOD, CAP, address(market.usdc));

        DemoLiquidity liquidity = new DemoLiquidity(poolManager);
        market.hook.setTier(address(liquidity), 2);
        market.usdc.mint(address(liquidity), 1e30);
        market.rwa.mint(address(liquidity), 1e30);
        liquidity.add(market.key);

        market.oracle.transferOwnership(owner);
        market.hook.transferOwnership(owner);
        market.ledger.transferOwnership(owner);
    }
}
