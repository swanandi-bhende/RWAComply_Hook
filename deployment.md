# Deployment

Two markets exist. They do not share addresses.

| Market | Chain id | How it was deployed |
|---|---|---|
| Local Anvil | `31337` | [`script/start_anvil_demo.sh`](script/start_anvil_demo.sh) broadcasts [`script/DeployFull.s.sol`](script/DeployFull.s.sol). Addresses stay in `broadcast/DeployFull.s.sol/31337/run-latest.json` |
| Ethereum Sepolia | `11155111` | [`script/DeploySepolia.s.sol`](script/DeploySepolia.s.sol), already broadcast. Do not broadcast it again |

`script/DeployMarketplace.s.sol` reverts unless the chain id is `31337`. It has not been broadcast. It does not replace the Sepolia market.

The Sepolia PoolManager is the official Uniswap v4 manager. The script does not deploy another one. The first oracle creation, `0x2285cdd075944609f38007b652a0adcf4ce71b8ceed4e57f8c8272f06a393539`, reverted in block `12075637`. The successful deployment started at the deployer nonce after that failure. The transaction log is [docs/sepolia-deployment.md](docs/sepolia-deployment.md). A machine-readable copy of the public fields is [deployments/sepolia-deployment.json](deployments/sepolia-deployment.json). Runtime code does not read that file.

## Sepolia

Deployer and ledger owner: `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6`

Allocation signer, `backendSigner()`: `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`

| Contract | Address |
|---|---|
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| Oracle | `0x57Cf0d5C2e4202c011cA0Fb70b2D4D77b8370D7c` |
| Hook | `0xD092CbB8De7cCa60807Ca73213f12920Afd308c0` |
| Mock USDC | `0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe` |
| Mock RWA | `0x73A9Aa42882931518bFDF23886f76F2580D5Ec27` |
| AllocationLedger | `0xc74c64fee3b4C2D1E2ed37F218f0179026A9ceeA` |
| PoolExecutor | `0x0E4f7a7D8bA8d629784056A04105d0a322b9768D` |
| Liquidity helper | `0x58F03D8e2B11014d24773eB32E467c9297634008` |

Pool id: `0x45fa53491f19ed13a7b274ac5c3f2f6c670d699125f2ffeaedf7a94600d7a7f7`

The pool was initialized in `0x33cd60cc417e8284dce10d896fa88e1f5cd6c3851bdd9145924eecf109c4db2f`. Arkiv’s offering note records that initialization in block `12076181`.

Hook permission bits: `2240` (`0x8c0`). The hook address was mined with CREATE2 so those bits sit in the address. The salt logic is in [`script/DeploySepolia.s.sol`](script/DeploySepolia.s.sol) and [`src/HookFlags.sol`](src/HookFlags.sol).

Allocation group: `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677`

Period: `1`. Cap: `1000000000` raw USDC units, which is 1,000 USDC at 6 decimals. Policy transaction: `0x27a38cea00f591b18db4881eed054a62045e0ee3d51830a5ba43300a6c28ab7b`.

The liquidity helper has tier 2 so it could seed the pool (`0xf82307f67401baa0484c9a46a32b175fdee8fed51f031fac7bb38db1222d8089`). That tier is not investor approval. The deployer tier is 0. No investor `registerWallet` and no investor purchase are in the deployment log.

Independent reads confirmed code at the hook and the ledger, `backendSigner()` equal to the allocation signer, the executor as `trustedRouter`, the group, the period, and the cap. Those reads did not send a transaction.

Explorer pages are `https://sepolia.etherscan.io/address/` plus the address, and `https://sepolia.etherscan.io/tx/` plus a hash from [docs/sepolia-deployment.md](docs/sepolia-deployment.md).

## Read-only checks

Use `cast` with a Sepolia RPC. Do not pass a private key.

```bash
cast chain-id --rpc-url "$ALLOCATION_RPC_URL"
cast call 0xc74c64fee3b4C2D1E2ed37F218f0179026A9ceeA "backendSigner()(address)" --rpc-url "$ALLOCATION_RPC_URL"
cast call 0xD092CbB8De7cCa60807Ca73213f12920Afd308c0 "trustedRouter()(address)" --rpc-url "$ALLOCATION_RPC_URL"
```

`cast call` reads. `forge script --broadcast` and `cast send` write. The deployment script is a write.
