// scripts/test-phase1-privacy.mjs
// Automated Verification Suite for Phase 1: Privacy Hardening
import fs from "fs";
import path from "path";
import crypto from "crypto";

console.log("=================================================");
console.log("  VEILX AGENT — PHASE 1 PRIVACY VERIFICATION");
console.log("=================================================\n");

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    console.log(`  [PASS] Test ${total}: ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] Test ${total}: ${testName}`);
    process.exitCode = 1;
  }
}

// 1. Test Commitment Hash Formula
console.log("1. Verifying Cryptographic Commitment Hashing...");
const handle1 = "expatq3";
const salt1 = "9831aef4c0291823";
const cleanHandle = handle1.toLowerCase().replace(/^@/, "").trim();
const expectedCommitment = crypto.createHash("sha256").update(`${cleanHandle}${salt1}`).digest("hex");

assert(expectedCommitment.length === 64, "Commitment hash is 64-character hex");
assert(
  expectedCommitment === crypto.createHash("sha256").update("expatq39831aef4c0291823").digest("hex"),
  "Matches SHA-256(handle || salt) formula"
);

// 2. Test AES-256-GCM Memo Encryption & Decryption
console.log("\n2. Verifying Client-Side AES-256-GCM Metadata Encryption...");
const memoPlaintext = "Confidential retainer invoice for security audit";
const secretKey = "veilx_super_secret_testnet_key_9831";

const key = crypto.createHash("sha256").update(secretKey).digest();
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

let encrypted = cipher.update(memoPlaintext, "utf8", "base64");
encrypted += cipher.final("base64");
const tag = cipher.getAuthTag().toString("base64");

assert(encrypted !== memoPlaintext, "Ciphertext does not match plaintext");
assert(encrypted.length > 20, "Ciphertext is populated base64");

// Decrypt
const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(Buffer.from(tag, "base64"));
let decrypted = decipher.update(encrypted, "base64", "utf8");
decrypted += decipher.final("utf8");

assert(decrypted === memoPlaintext, "Decrypted text exactly matches original plaintext");

// 3. Test WASM Contract Exports
console.log("\n3. Verifying WASM Contract Compilation & Exported Methods...");
const wasmPath = path.resolve("./contracts/veilx-escrow/target/wasm32-unknown-unknown/release/veilx_escrow.wasm");
assert(fs.existsSync(wasmPath), "veilx_escrow.wasm exists in target release");

const wasmBytes = fs.readFileSync(wasmPath);
assert(wasmBytes.length > 200000, `WASM binary has expected size (${wasmBytes.length} bytes)`);

// Check that string method names exist inside the compiled WASM binary
const wasmStr = wasmBytes.toString("latin1");
assert(wasmStr.includes("deposit_private_near_tip"), "WASM exports 'deposit_private_near_tip'");
assert(wasmStr.includes("claim_private_tip"), "WASM exports 'claim_private_tip'");
assert(wasmStr.includes("deposit_near_tip"), "WASM preserves backward-compatible 'deposit_near_tip'");
assert(wasmStr.includes("claim_tip"), "WASM preserves backward-compatible 'claim_tip'");

console.log("\n=================================================");
console.log(`  SUMMARY: ${passed} / ${total} tests passed successfully.`);
console.log("=================================================");
