# Ethereum Sepolia deployment

Network: Ethereum Sepolia, chain id `11155111`.

This file records the verified deployment. It is not a simulation. No private keys or RPC credentials belong here.

## Account

Deployer: `0x36Dc780DA078Ab4b8C5923bEd34eF4546DCb8ce6`

Allocation signer: `0x28FB61Dc27a37091f53C0c37b5026AdBbF5E1F46`

The signer is not the deployer. The deployer started this deployment at nonce 1, after the failed oracle creation `0x2285cdd075944609f38007b652a0adcf4ce71b8ceed4e57f8c8272f06a393539` in block `12075637`. The final nonce is 20. The starting balance was `99820063072258104` wei. The 19 successful transactions used `50554839` gas and `5055484759432263` wei in fees. The ending balance was `94764578312825841` wei.

## Contracts

| Contract | Address |
|---|---|
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| Oracle | `0x57Cf0d5C2e4202c011cA0Fb70b2D4D77b8370D7c` |
| Hook | `0xD092CbB8De7cCa60807Ca73213f12920Afd308c0` |
| USDC | `0x2BC48314C0B0B51E67E607FbC160304E9fD755Fe` |
| RWA | `0x73A9Aa42882931518bFDF23886f76F2580D5Ec27` |
| Ledger | `0xc74c64fee3b4C2D1E2ed37F218f0179026A9ceeA` |
| Executor | `0x0E4f7a7D8bA8d629784056A04105d0a322b9768D` |
| Liquidity helper | `0x58F03D8e2B11014d24773eB32E467c9297634008` |

The PoolManager is the existing official Sepolia Uniswap v4 manager. The hook address permission bits are `2240` (`0x8c0`).

Allocation group: `0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677`

Period: `1`

Cap: `1000000000` USDC base units. USDC has 6 decimals.

## Transactions

| Step | Hash |
|---|---|
| Oracle | `0x3910ffd9d10db5f718a22e865128b7d7fbbf1c6b5266195d4f69924d11f4f115` |
| Hook | `0x3251f9ff62f9ac79c62dbe837f2d07be09b8a6beb0a5da9ae7e11fea363673b4` |
| Volatility | `0x528832c2051a0bed4238c0944f008c6c2f7ccb5714f86e9caebb5101e519952b` |
| USDC | `0xa693031d51a57b7b8463c6841377cc71a72149566fc3cf4199e8ac26fe35e12e` |
| RWA | `0xbc5b24577b3e41038ae11bb635a1f74ecfeda43826006852e4ca80da0cd4cdb7` |
| Pool initialization | `0x33cd60cc417e8284dce10d896fa88e1f5cd6c3851bdd9145924eecf109c4db2f` |
| Ledger | `0x0296b02a91fa3dd677643298bbd626c6e4b5e37ed1c62bc28870a997668c22a1` |
| Executor | `0x4eb8bc3b0467c8461b7f626a9d00ee3e2550172fc45defb3b6f132442f26090a` |
| Authorize hook | `0x2578f67fc56fd74efdadbe6be90bc8cd6442af6865134ac965934c4bf127fd77` |
| Trust executor | `0x1c81fe32fee559274b69af45f5fa43d4169f6d99af231d0af1cbe448744f9eaf` |
| Quote tokens | `0xd9559c0f17e87d78d7ed8ecd47eee964592aedbbdfaa98221e39de5c5adc9115` |
| Hook ledger | `0x336308d85cde7d6f3774eb4e5207788d098d76ca52994d176f912d6c941a9cca` |
| Allocation | `0xf530410493e4c74a51715aacedeef9d37f4a3bd880e123a1e3a66080a983bf35` |
| Policy | `0x27a38cea00f591b18db4881eed054a62045e0ee3d51830a5ba43300a6c28ab7b` |
| Liquidity helper | `0x109cf806008c2b7c1dbd8aaa8780a95b23b6664853e2c4045afefd8ac9445060` |
| Helper tier | `0xfa685e77ec4c6bc163fd71934df244753f947c9ae1d062c8f9e9f30779bbbbd5` |
| Mint USDC | `0xdd58c9575790a5278c9a8117a63b960475ca39af083c07d950204c192889260d` |
| Mint RWA | `0x1e2430dccc2ec84ddcbeb8b3ee7cb6dd006eeaa7306621aa70684f7869c81e2a` |
| Add liquidity | `0xf82307f67401baa0484c9a46a32b175fdee8fed51f031fac7bb38db1222d8089` |

All 19 receipts succeeded. Independent reads confirmed code at every new address, the ledger owner and backend signer, the hook and executor references, the group, the 6-decimal USDC policy, deployer tier 0, and helper tier 2. The pool sqrt price is the 1:1 price and the seeded liquidity is `1000000000000000000000000`. The helper tier is liquidity setup, not investor approval. No investor wallet was registered.

The broadcast used `--gas-estimate-multiplier 800`, a 0.5 gwei max fee, a 0.1 gwei priority fee, and `--slow`. Foundry 1.5.1 still prices contract creation too low for Sepolia’s current code-storage cost, so the multiplier is required. The actual fee was about 0.00506 ETH because the base fee was 17 wei.

Verify again with `cast` against Ethereum Sepolia. Do not reuse these addresses on Anvil. The local demo still reads `broadcast/DeployFull.s.sol/31337/run-latest.json`.
