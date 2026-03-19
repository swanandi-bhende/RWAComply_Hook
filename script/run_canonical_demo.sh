#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="${CHAIN_ID:-31337}"

forge script script/DeployFull.s.sol --rpc-url "$RPC_URL" --broadcast
CHAIN_ID="$CHAIN_ID" node script/generateDemoRunLog.js

echo "Canonical run completed. See docs/demo_run_log.txt"
