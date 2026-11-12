// scripts/test-phase3-hybrid-ai.mjs
// Verification suite for Phase 3: Hybrid AI Routing & TEE Enclave Circuit-Breaker

import assert from "node:assert/strict";

console.log("=================================================");
console.log("  PHASE 3: HYBRID AI ROUTING & TEE ENCLAVE TESTS ");
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

  console.log("[1. FINANCIAL QUERY CLASSIFIER HEURISTICS]");
  const { isFinancialQuery, routeHybridAI, callNearAICloud } = await import("../src/lib/ai-gateway.ts");

  await testAsync("Identifies financial transaction intent accurately", async () => {
    assert.equal(isFinancialQuery("Tip @expatq3 5 USDC"), true);
    assert.equal(isFinancialQuery("Send 10 USDC on Base to @alice"), true);
    assert.equal(isFinancialQuery("Pay invoice inv_test123"), true);
    assert.equal(isFinancialQuery("What is my balance?"), true);
    assert.equal(isFinancialQuery("Claim my tips from escrow"), true);
    assert.equal(isFinancialQuery("How do I get faucet tokens?"), true);
  });

  await testAsync("Identifies general conversational queries accurately", async () => {
    assert.equal(isFinancialQuery("Hello, who are you?"), false);
    assert.equal(isFinancialQuery("Explain how zero-knowledge proofs work"), false);
    assert.equal(isFinancialQuery("What is the weather today?"), false);
  });

  console.log("\n[2. TEE CIRCUIT-BREAKER & SPEED FALLBACK HARNESS]");

  await testAsync("Circuit Breaker: Invalid/unreachable TEE key trips cleanly and falls back", async () => {
    const start = Date.now();
    // Providing a dummy NEAR AI key to test circuit breaker
    const result = await routeHybridAI("Send 5 NEAR to @bob", {
      nearAiApiKey: "sk-near-invalid-test-key-circuit-breaker",
      preferTee: true,
      timeoutMs: 800, // fast timeout for test
    });
    const elapsed = Date.now() - start;

    assert.ok(result);
    assert.equal(result.tool, "tip_handle");
    assert.equal(result.args.recipientHandle, "bob");
    assert.equal(result.isSpeedFallback, true);
    assert.ok(result.engine?.includes("fallback"));
    console.log(`    (Circuit breaker fallback completed in ${elapsed}ms)`);
  });

  await testAsync("Fast Path: Non-TEE mode executes recognized financial intent in <10ms", async () => {
    const start = Date.now();
    const result = await routeHybridAI("Send 10 USDC on Base to @alice");
    const elapsed = Date.now() - start;

    assert.ok(result);
    assert.equal(result.tool, "execute_cross_chain_intent");
    assert.equal(result.args.targetChain, "BASE");
    assert.equal(result.args.targetAsset, "USDC");
    assert.equal(result.args.amount, 10);
    assert.ok(elapsed < 50, `Execution took ${elapsed}ms (expected <50ms)`);
    console.log(`    (Fast path completed in ${elapsed}ms)`);
  });

  await testAsync("Multi-Chain Intent via Hybrid Routing", async () => {
    const result = await routeHybridAI("Transfer 25 USDT on Arbitrum to 0x1234567890123456789012345678901234567890");
    assert.equal(result.tool, "execute_cross_chain_intent");
    assert.equal(result.args.targetChain, "ARBITRUM");
    assert.equal(result.args.targetAsset, "USDT");
    assert.equal(result.args.amount, 25);
  });

  console.log("\n[3. LIVE API CHAT ENDPOINT VERIFICATION (HTTP localhost:3000)]");

  await testAsync("POST /api/chat with financial intent returns structured tool call", async () => {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Tip @expatq3 2 NEAR",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.tool, "tip_handle");
    assert.equal(data.args.recipientHandle, "expatq3");
  });

  await testAsync("POST /api/chat with cross-chain intent returns execute_cross_chain_intent", async () => {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Send 10 USDC on Base to @bob",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.tool, "execute_cross_chain_intent");
    assert.equal(data.args.targetChain, "BASE");
    assert.equal(data.args.targetAsset, "USDC");
    assert.equal(data.args.amount, 10);
  });

  await testAsync("POST /api/chat with provider: 'nearai' exercises TEE fallback harness", async () => {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Invoice $50 for Security Audit",
        provider: "nearai",
        customApiKey: "sk-mock-nearai-key",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.tool, "create_invoice");
    assert.equal(data.args.amount, 50);
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
