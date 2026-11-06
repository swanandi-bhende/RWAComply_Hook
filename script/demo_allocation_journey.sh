#!/usr/bin/env bash
# Local Anvil only. Wallet A buys 700 USDC, Wallet B's 500 USDC purchase reverts,
# Wallet B buys 200 USDC, and a second person keeps a separate full cap.
# This does not send a Sepolia transaction and does not print private keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$CHAIN" != "31337" ]]; then
  echo "Refusing to run: RPC is chain ${CHAIN}, not local Anvil 31337." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing repository-root .env" >&2
  exit 1
fi

eval "$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("broadcast/DeployFull.s.sol/31337/run-latest.json").read_text())
found = {}
for tx in data.get("transactions", []):
    name = tx.get("contractName")
    address = tx.get("contractAddress")
    if name in {"RWAComplyHook", "AllocationLedger", "MockUSDC", "PoolExecutor"} and address:
        found[name] = address
    if name == "MockERC20" and isinstance(tx.get("arguments"), list) and tx["arguments"] and tx["arguments"][0] == "RWA":
        found["RWA"] = address
missing = [key for key in ("RWAComplyHook", "AllocationLedger", "MockUSDC", "PoolExecutor", "RWA") if key not in found]
if missing:
    raise SystemExit(f"broadcast is missing {', '.join(missing)}")
print(f'HOOK={found["RWAComplyHook"]}')
print(f'LEDGER={found["AllocationLedger"]}')
print(f'USDC={found["MockUSDC"]}')
print(f'EXECUTOR={found["PoolExecutor"]}')
print(f'RWA={found["RWA"]}')
PY
)"

ALICE_A=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
ALICE_B=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
BOB=0x90F79bf6EB2c4f870365E785982E1f101E93b906
STATE=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
GROUP=0xa6d68dbbe026d4e383d3af4257793a771d58cc2c2388bde9d3273a210e581677
PERIOD=1

LOCAL_RPC="$RPC_URL"
set -a
# shellcheck disable=SC1091
source .env
set +a
RPC_URL="$LOCAL_RPC"
export LEDGER GROUP ALICE_A ALICE_B BOB STATE

SIGS="$(cd frontend && node --input-type=module <<'JS'
import { keccak256, stringToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const key = process.env.PRIVATE_KEY
if (!key) throw new Error('PRIVATE_KEY missing')
const account = privateKeyToAccount(key)
const ledger = process.env.LEDGER
const group = process.env.GROUP
if (!ledger || !group || !process.env.ALICE_A) {
  throw new Error(`missing ledger=${Boolean(ledger)} group=${Boolean(group)} alice=${Boolean(process.env.ALICE_A)}`)
}
const expiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)
const wallets = [
  ['aliceA', process.env.ALICE_A, keccak256(stringToHex('rwa-comply-demo-alice')), 1101n],
  ['aliceB', process.env.ALICE_B, keccak256(stringToHex('rwa-comply-demo-alice')), 1102n],
  ['bob', process.env.BOB, keccak256(stringToHex('rwa-comply-demo-bob')), 1103n],
  ['state', process.env.STATE, keccak256(stringToHex('rwa-comply-demo-state')), 1104n],
]
for (const [name, wallet, allocationId, nonce] of wallets) {
  const signature = await account.signTypedData({
    domain: { name: 'AllocationLedger', version: '1', chainId: 31337, verifyingContract: ledger },
    types: { Registration: [
      { name: 'wallet', type: 'address' },
      { name: 'allocationId', type: 'bytes32' },
      { name: 'groupId', type: 'bytes32' },
      { name: 'expiry', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ] },
    primaryType: 'Registration',
    message: { wallet, allocationId, groupId: group, expiry, nonce },
  })
  console.log([name, wallet, allocationId, expiry.toString(), nonce.toString(), signature].join(' '))
}
JS
)"

register_if_needed() {
  local name="$1" wallet="$2" allocation="$3" expiry="$4" nonce="$5" signature="$6"
  local current
  current="$(cast call "$LEDGER" 'allocationIdByWallet(address)(bytes32)' "$wallet" --rpc-url "$LOCAL_RPC")"
  if [[ "$current" == "0x0000000000000000000000000000000000000000000000000000000000000000" ]]; then
    cast send "$LEDGER" 'registerWallet(address,bytes32,bytes32,uint256,uint256,bytes)' \
      "$wallet" "$allocation" "$GROUP" "$expiry" "$nonce" "$signature" \
      --private-key "$PRIVATE_KEY" --rpc-url "$LOCAL_RPC" >/dev/null
  fi
  local tier
  tier="$(cast call "$HOOK" 'userTier(address)(uint8)' "$wallet" --rpc-url "$LOCAL_RPC")"
  if [[ "$tier" == "0" ]]; then
    cast send "$HOOK" 'setTier(address,uint8)' "$wallet" 1 \
      --private-key "$PRIVATE_KEY" --rpc-url "$LOCAL_RPC" >/dev/null
  fi
  cast send "$USDC" 'mint(address,uint256)' "$wallet" 2000000000 \
    --private-key "$PRIVATE_KEY" --rpc-url "$LOCAL_RPC" >/dev/null
}

while read -r name wallet allocation expiry nonce signature; do
  [[ -n "$name" ]] || continue
  register_if_needed "$name" "$wallet" "$allocation" "$expiry" "$nonce" "$signature"
done <<<"$SIGS"

sort_pair() {
  local a b
  a="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  b="$(echo "$2" | tr '[:upper:]' '[:lower:]')"
  if [[ "$a" < "$b" ]]; then echo "$1" "$2"; else echo "$2" "$1"; fi
}
read -r CURRENCY0 CURRENCY1 < <(sort_pair "$USDC" "$RWA")

buy() {
  local wallet="$1" amount="$2"
  cast send "$USDC" 'approve(address,uint256)' "$EXECUTOR" "$amount" \
    --unlocked --from "$wallet" --rpc-url "$LOCAL_RPC" >/dev/null
  cast send "$EXECUTOR" 'swapExactInput((address,address,uint24,int24,address),uint256)' \
    "($CURRENCY0,$CURRENCY1,8388608,60,$HOOK)" "$amount" \
    --unlocked --from "$wallet" --rpc-url "$LOCAL_RPC" >/dev/null
}

alice_spent() {
  local allocation
  allocation="$(cast call "$LEDGER" 'allocationIdByWallet(address)(bytes32)' "$ALICE_A" --rpc-url "$LOCAL_RPC")"
  cast call "$LEDGER" 'spentByAllocation(bytes32,bytes32,uint256)(uint256)' "$allocation" "$GROUP" "$PERIOD" --rpc-url "$LOCAL_RPC" | awk '{print $1}'
}

SPENT="$(alice_spent)"
if [[ "$SPENT" == "0" ]]; then
  buy "$ALICE_A" 700000000
  set +e
  buy "$ALICE_B" 500000000 >/tmp/rwacomply-reject.txt 2>&1
  REJECT_STATUS=$?
  set -e
  if [[ "$REJECT_STATUS" == "0" ]]; then
    echo "The 500 USDC purchase was accepted; it must revert." >&2
    exit 1
  fi
  if ! rg -q "AllocationExceeded|0xcbfc2b28" /tmp/rwacomply-reject.txt; then
    echo "The 500 USDC purchase did not revert with AllocationExceeded." >&2
    exit 1
  fi
  buy "$ALICE_B" 200000000
elif [[ "$SPENT" != "900000000" ]]; then
  echo "Alice already has spent ${SPENT}. Refusing to buy again." >&2
  exit 1
fi

alice_remaining="$(cast call "$LEDGER" 'remaining(address,bytes32,uint256)(uint256)' "$ALICE_B" "$GROUP" "$PERIOD" --rpc-url "$LOCAL_RPC" | awk '{print $1}')"
bob_remaining="$(cast call "$LEDGER" 'remaining(address,bytes32,uint256)(uint256)' "$BOB" "$GROUP" "$PERIOD" --rpc-url "$LOCAL_RPC" | awk '{print $1}')"
bob_spent_raw="$(cast call "$LEDGER" 'allocationIdByWallet(address)(bytes32)' "$BOB" --rpc-url "$LOCAL_RPC")"
bob_spent="$(cast call "$LEDGER" 'spentByAllocation(bytes32,bytes32,uint256)(uint256)' "$bob_spent_raw" "$GROUP" "$PERIOD" --rpc-url "$LOCAL_RPC" | awk '{print $1}')"
echo "alice_remaining ${alice_remaining}"
echo "bob_remaining ${bob_remaining}"
echo "bob_spent ${bob_spent}"
if [[ "$alice_remaining" != "100000000" || "$bob_remaining" != "1000000000" || "$bob_spent" != "0" ]]; then
  echo "Shared budget result did not match 100 USDC remaining for Alice and a full cap for Bob." >&2
  exit 1
fi
echo "Local allocation journey confirmed on Anvil."
