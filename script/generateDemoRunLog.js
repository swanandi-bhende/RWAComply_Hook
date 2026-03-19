#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const chainId = process.env.CHAIN_ID || "31337";
const scriptName = process.env.CANONICAL_SCRIPT || "DeployFull.s.sol";

const runLatestPath = path.join(
  root,
  "broadcast",
  scriptName,
  chainId,
  "run-latest.json"
);
const outputPath = path.join(root, "docs", "demo_run_log.txt");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(runLatestPath)) {
  fail(`Broadcast file not found: ${runLatestPath}`);
}

const runData = JSON.parse(fs.readFileSync(runLatestPath, "utf8"));
const txs = Array.isArray(runData.transactions) ? runData.transactions : [];

if (txs.length === 0) {
  fail("No transactions found in run-latest.json");
}

const createTxs = txs.filter(
  (tx) => tx.transactionType === "CREATE" || tx.transactionType === "CREATE2"
);

function firstCreatedAddress(contractName) {
  const tx = createTxs.find((item) => item.contractName === contractName);
  return tx ? tx.contractAddress : "N/A";
}

function createdAddresses(contractName) {
  return createTxs
    .filter((item) => item.contractName === contractName)
    .map((item) => item.contractAddress);
}

const tokenAddresses = createdAddresses("MockERC20");
const tokenA = tokenAddresses[0] || "N/A";
const tokenB = tokenAddresses[1] || "N/A";

const addresses = {
  POOL_MANAGER: firstCreatedAddress("PoolManager"),
  HOOK_ADDRESS: firstCreatedAddress("RWAComplyHook"),
  ORACLE: firstCreatedAddress("MockRWAOracle"),
  TOKEN_A: tokenA,
  TOKEN_B: tokenB,
  EXECUTOR: firstCreatedAddress("PoolExecutor"),
};

const lines = [];
lines.push("RWAComply Canonical Demo Run Log");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Chain ID: ${chainId}`);
lines.push(`Broadcast File: ${path.relative(root, runLatestPath)}`);
lines.push("");

lines.push("Addresses");
lines.push(`POOL_MANAGER=${addresses.POOL_MANAGER}`);
lines.push(`HOOK_ADDRESS=${addresses.HOOK_ADDRESS}`);
lines.push(`ORACLE=${addresses.ORACLE}`);
lines.push(`TOKEN_A=${addresses.TOKEN_A}`);
lines.push(`TOKEN_B=${addresses.TOKEN_B}`);
lines.push(`EXECUTOR=${addresses.EXECUTOR}`);
lines.push("");

lines.push("Transaction Hashes");
for (let i = 0; i < txs.length; i++) {
  const tx = txs[i];
  const label = tx.contractName || tx.function || tx.contractAddress || "unknown";
  const action = tx.function || tx.transactionType;
  lines.push(`${i + 1}. ${tx.hash} | ${label} | ${action}`);
}
lines.push("");

lines.push("Re-run Commands");
lines.push("1) forge script script/DeployFull.s.sol --rpc-url http://127.0.0.1:8545 --broadcast");
lines.push("2) node script/generateDemoRunLog.js");
lines.push("");

fs.writeFileSync(outputPath, lines.join("\n"));
console.log(`Wrote ${path.relative(root, outputPath)}`);
