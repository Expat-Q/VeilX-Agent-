// scripts/test-phase2-intents.mjs
// Verification suite for Phase 2: NEAR Intents & Defuse 1Click Solver Execution

import assert from "node:assert/strict";

console.log("=================================================");
console.log("  PHASE 2: NEAR INTENTS & DEFUSE PROTOCOL TESTS  ");
console.log("=================================================\n");

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
      failed++;
    }
  }

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

  console.log("[1. AI GATEWAY INTENT EXTRACTION TESTS]");

  // Dynamic import of ai-gateway
  const { processUserMessage } = await import("../src/lib/ai-gateway.ts");

  await testAsync("Prompt: 'Send 10 USDC on Base to @bob' matches execute_cross_chain_intent", async () => {
    const res = await processUserMessage("Send 10 USDC on Base to @bob", "expatq3");
    assert.equal(res.tool, "execute_cross_chain_intent");
    assert.equal(res.args.amount, 10);
    assert.equal(res.args.targetAsset, "USDC");
    assert.equal(res.args.targetChain, "BASE");
    assert.equal(res.args.recipient, "bob");
  });

  await testAsync("Prompt: 'Transfer 25 USDT on Arbitrum to 0x1234567890123456789012345678901234567890'", async () => {
    const res = await processUserMessage("Transfer 25 USDT on Arbitrum to 0x1234567890123456789012345678901234567890", "expatq3");
    assert.equal(res.tool, "execute_cross_chain_intent");
    assert.equal(res.args.amount, 25);
    assert.equal(res.args.targetAsset, "USDT");
    assert.equal(res.args.targetChain, "ARBITRUM");
    assert.equal(res.args.recipient, "0x1234567890123456789012345678901234567890");
  });

  await testAsync("Prompt: 'Swap 5 USDC on Solana to @vitalik'", async () => {
    const res = await processUserMessage("Swap 5 USDC on Solana to @vitalik", "expatq3");
    assert.equal(res.tool, "execute_cross_chain_intent");
    assert.equal(res.args.amount, 5);
    assert.equal(res.args.targetAsset, "USDC");
    assert.equal(res.args.targetChain, "SOLANA");
    assert.equal(res.args.recipient, "vitalik");
  });

  await testAsync("Prompt: 'Send @alice 15 USDC on Optimism'", async () => {
    const res = await processUserMessage("Send @alice 15 USDC on Optimism", "expatq3");
    assert.equal(res.tool, "execute_cross_chain_intent");
    assert.equal(res.args.amount, 15);
    assert.equal(res.args.targetAsset, "USDC");
    assert.equal(res.args.targetChain, "OPTIMISM");
    assert.equal(res.args.recipient, "alice");
  });

  console.log("\n[2. 1CLICK INTENT LIFECYCLE MANAGER TESTS]");
  const { createIntentOrder, get1ClickExecutionStatus } = await import("../src/lib/1click.ts");

  await testAsync("createIntentOrder generates valid quote and 60s expiration", async () => {
    const order = await createIntentOrder({
      sourceChain: "NEAR",
      sourceAssetSymbol: "NEAR",
      targetChain: "BASE",
      targetAssetSymbol: "USDC",
      amount: 2.85,
      recipient: "bob.near",
    });

    assert.ok(order.orderId.startsWith("intent_"));
    assert.ok(order.depositAddress.length > 5);
    assert.equal(order.sourceChain, "NEAR");
    assert.equal(order.sourceAsset, "NEAR");
    assert.equal(order.targetChain, "BASE");
    assert.equal(order.targetAsset, "USDC");
    assert.ok(order.targetAmount > 0);
    assert.ok(order.expiresAt > Date.now());
    assert.ok(order.expiresAt <= Date.now() + 65000);
  });

  await testAsync("get1ClickExecutionStatus returns structured status object", async () => {
    const status = await get1ClickExecutionStatus("solver_intent_test.veilx-agent.testnet");
    assert.ok(["PENDING_DEPOSIT", "PROCESSING", "SUCCESS", "REFUNDED", "EXPIRED"].includes(status.status));
  });

  console.log("\n[3. LIVE API ENDPOINT VERIFICATION (HTTP localhost:3000)]");

  await testAsync("POST /api/intents creates persistent order", async () => {
    const res = await fetch("http://localhost:3000/api/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceChain: "NEAR",
        sourceAsset: "NEAR",
        targetChain: "BASE",
        targetAsset: "USDC",
        amount: 2.85,
        recipient: "alice.testnet",
        senderHandle: "expatq3",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.order.orderId);
    assert.ok(data.order.depositAddress);

    // Test GET /api/intents
    const getRes = await fetch(`http://localhost:3000/api/intents?orderId=${data.order.orderId}`);
    const getData = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.equal(getData.success, true);
    assert.equal(getData.intent.orderId, data.order.orderId);
    assert.equal(getData.intent.status, "created");

    // Test PATCH /api/intents
    const patchRes = await fetch("http://localhost:3000/api/intents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: data.order.orderId,
        status: "success",
        depositTxHash: "tx_near_test_deposit_123",
        destinationTxHash: "0xbase_destination_solver_settlement_456",
      }),
    });
    const patchData = await patchRes.json();
    assert.equal(patchRes.status, 200);
    assert.equal(patchData.success, true);
    assert.equal(patchData.intent.status, "success");
    assert.equal(patchData.intent.depositTxHash, "tx_near_test_deposit_123");
    assert.equal(patchData.intent.destinationTxHash, "0xbase_destination_solver_settlement_456");
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
