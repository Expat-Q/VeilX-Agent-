import { signSessionPayload, verifySessionToken } from "../src/lib/session.js";
import fs from "fs";

console.log("=== RUNNING PHASE 1 TEST SUITE ===");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

// 1. Test TASK-SEC-01 (Session Forgery Mitigation)
console.log("\n--- Testing TASK-SEC-01 (Session Token Verification) ---");
const forgedRawJson = '{"xHandle":"malicious_admin","nearAccountId":"admin.testnet"}';
assert(verifySessionToken(forgedRawJson) === null, "Raw unverified JSON cookie returns null");

assert(verifySessionToken("") === null, "Empty token returns null");
assert(verifySessionToken("not-a-valid-token") === null, "Malformed token returns null");

const legitimateSession = { xUserId: "12345", xHandle: "testuser", nearAccountId: "testuser.testnet" };
const validToken = signSessionPayload(legitimateSession);
const decoded = verifySessionToken(validToken);
assert(decoded !== null && decoded.xHandle === "testuser", "Legitimate HMAC signed session token decodes correctly");

// Tampered payload
const tamperedRaw = Buffer.from(validToken, "base64url").toString("utf8");
const envelope = JSON.parse(tamperedRaw);
envelope.payload.xHandle = "hacked";
const tamperedToken = Buffer.from(JSON.stringify(envelope)).toString("base64url");
assert(verifySessionToken(tamperedToken) === null, "Tampered session payload with invalid signature returns null");

// 2. Test TASK-SEC-04 (Hardcoded Crypto Addresses Purged)
console.log("\n--- Testing TASK-SEC-04 (Purged Fallback Crypto Addresses) ---");
const payPageContent = fs.readFileSync("src/app/pay/[slug]/page.tsx", "utf8");
assert(!payPageContent.includes("0x2eed719b54cda655b0b6eee3aab5384b3d4650a3"), "Hardcoded EVM address 0x2eed... purged from pay page");
assert(!payPageContent.includes("5U3bSapFRXeistmGghFsagkE814e8E9qG2vU2K1"), "Hardcoded Solana address 5U3b... purged from pay page");

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
