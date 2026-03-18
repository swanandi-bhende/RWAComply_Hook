import { keccak256, getCreate2Address } from "ethers";
import { ethers } from "ethers";
import fs from "fs";

// ===== INPUTS =====
const DEPLOYER = "0xYourDeployerAddress"; 
const BYTECODE = fs.readFileSync("./out/RWAComplyHook.sol/RWAComplyHook.json");
const PERMISSIONS = 14528n;
const MASK = (1n << 14n) - 1n;

// ===== PREP =====
const json = JSON.parse(BYTECODE);
const bytecode = json.bytecode.object;
const bytecodeHash = keccak256("0x" + bytecode);

console.log("Starting brute force...");

for (let i = 0; i < 10_000_000; i++) {
    const salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);

    const addr = getCreate2Address(
        DEPLOYER,
        salt,
        bytecodeHash
    );

    const addrBigInt = BigInt(addr);

    if ((addrBigInt & MASK) === PERMISSIONS) {
        console.log("✅ FOUND!");
        console.log("Salt:", salt);
        console.log("Address:", addr);
        break;
    }

    if (i % 100000 === 0) {
        console.log("Checked:", i);
    }
}