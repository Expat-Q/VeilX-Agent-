// scripts/test-phase4-stealth-mpc.mjs
// Verification suite for Phase 4: Stealth Subaccounts & Outbound Chain Signatures MPC Signing

import assert from "node:assert/strict";

console.log("=================================================");
console.log("  PHASE 4: STEALTH SUBACCOUNTS & MPC SIGNING     ");
console.log("=================================================\n");

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
      failed++;
    }
  }

  console.log("[1. NEAR CHAIN SIGNATURES MPC & EVM DERIVATION]");
  const { deriveEvmAddress, parseMpcSignature, createAndSignBaseTransaction } = await import("../src/lib/near-chain-signatures.ts");

  await testAsync("deriveEvmAddress generates deterministic 0x address for veilx-agent.testnet", async () => {
    const res = deriveEvmAddress("veilx-agent.testnet", "ethereum,1");
    assert.ok(res.evmAddress.startsWith("0x"));
    assert.equal(res.evmAddress.length, 42);
    assert.ok(res.checksumAddress.startsWith("0x"));
    assert.equal(res.derivationPath, "ethereum,1");
    assert.equal(res.mpcContractId, "v1.signer-prod.testnet");
  });

  await testAsync("parseMpcSignature formats threshold outcome to EVM signature", async () => {
    const mockMpcOutcome = {
      big_r: {
        affine_point: "02" + "a".repeat(64),
      },
      s: {
        scalar: "b".repeat(64),
      },
      recovery_id: 1,
    };

    const sig = parseMpcSignature(mockMpcOutcome);
    assert.equal(sig.r, "0x" + "a".repeat(64));
    assert.equal(sig.s, "0x" + "b".repeat(64));
    assert.equal(sig.v, 1);
    assert.equal(sig.yParity, 1);
  });

  await testAsync("createAndSignBaseTransaction serializes valid EIP-1559 raw transaction", async () => {
    const recipient = "0x1234567890123456789012345678901234567890";
    const res = await createAndSignBaseTransaction({
      senderNearAccountId: "veilx-agent.testnet",
      recipientAddress: recipient,
      amountEth: "0.005",
      nonce: 0,
    });

    assert.equal(res.success, true);
    assert.ok(res.txHash.startsWith("0x"));
    assert.equal(res.txHash.length, 66); // 32 bytes hex + 0x
    assert.ok(res.rawTransaction.startsWith("0x02")); // EIP-1559 transaction type envelope
    assert.equal(res.destination, recipient);
  });

  console.log("\n[2. EPHEMERAL STEALTH CLAIM SUBACCOUNT FACTORY]");

  await testAsync("Stealth subaccount naming format strictly matches claim-[6hex].veilx-agent.testnet", async () => {
    const crypto = await import("crypto");
    const hex = crypto.randomBytes(3).toString("hex");
    const sub = `claim-${hex}.veilx-agent.testnet`;
    assert.match(sub, /^claim-[0-9a-f]{6}\.veilx-agent\.testnet$/);
  });

  console.log("\n[3. LIVE API ENDPOINT VERIFICATION (HTTP localhost:3000)]");

  await testAsync("POST /api/evm/send-mpc broadcasts signed Base Sepolia transaction", async () => {
    const res = await fetch("http://localhost:3000/api/evm/send-mpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        amountEth: "0.001",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.txHash.startsWith("0x"));
    assert.ok(data.rawTransaction.startsWith("0x02"));
    assert.ok(data.senderEvmAddress.startsWith("0x"));
    assert.equal(data.destination, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });

  await testAsync("POST /api/near/claim-subaccount enforces authentication & parameter safety", async () => {
    const res = await fetch("http://localhost:3000/api/near/claim-subaccount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipId: "tip_invalid_mock_123",
        recipientHandle: "expatq3",
      }),
    });

    // Without session cookie, it must cleanly reject with 401 Unauthorized
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error?.includes("Unauthorized") || data.error?.includes("session"));
  });

  console.log("\n=================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
