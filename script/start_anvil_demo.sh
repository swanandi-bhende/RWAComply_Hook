#!/usr/bin/env bash
# Start local Anvil if needed, fund the deployer on that node, and deploy the demo.
# Addresses stay in the gitignored broadcast file. This script does not edit .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="${CHAIN_ID:-31337}"

if [[ ! -f .env ]]; then
  echo "Missing repository-root .env" >&2
  exit 1
fi

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  nohup anvil --host 127.0.0.1 --port 8545 --chain-id "$CHAIN_ID" > /tmp/rwacomply-anvil.log 2>&1 &
  echo $! > /tmp/rwacomply-anvil.pid
  disown || true
  for _ in $(seq 1 50); do
    if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
fi

ACTUAL_CHAIN="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$ACTUAL_CHAIN" != "$CHAIN_ID" ]]; then
  echo "The RPC is chain ${ACTUAL_CHAIN}, not local Anvil ${CHAIN_ID}." >&2
  exit 1
fi

LOCAL_RPC="$RPC_URL"
set -a
# shellcheck disable=SC1091
source .env
set +a
# The repository .env may point RPC_URL at Sepolia. This script always deploys to local Anvil.
RPC_URL="$LOCAL_RPC"
if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "PRIVATE_KEY is missing from the repository-root .env" >&2
  exit 1
fi

DEPLOYER="$(cast wallet address --private-key "$PRIVATE_KEY")"
# 1000 ETH on the local node only. This does not touch Sepolia.
cast rpc anvil_setBalance "$DEPLOYER" 0x3635C9ADC5DEA00000 --rpc-url "$RPC_URL" >/dev/null

forge script script/DeployFull.s.sol --rpc-url "$RPC_URL" --broadcast
echo "Local Anvil demo deployed for ${DEPLOYER} on chain ${ACTUAL_CHAIN}."
echo "Addresses: broadcast/DeployFull.s.sol/${CHAIN_ID}/run-latest.json"
