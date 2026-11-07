#!/usr/bin/env bash
# Local Anvil only. Runs the guided Alice and Bob purchases through the same
# local executor path as /demo. It refuses every chain except 31337 and does
# not print private keys or send a public-network transaction.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN="$(cast chain-id --rpc-url "$RPC_URL")"
if [[ "$CHAIN" != "31337" ]]; then
  echo "Refusing to run: RPC is chain ${CHAIN}, not local Anvil 31337." >&2
  exit 1
fi

cd "$ROOT/frontend"
node --experimental-strip-types scripts/runGuidedDemo.mts
