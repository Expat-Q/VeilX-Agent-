// test-1click-quote.mjs
// Standalone tracer bullet: tests live 1Click API token fetching and quote generation

const ONECLICK_BASE = "https://1click.chaindefuser.com";

async function main() {
  console.log("=== 1Click API Tracer Bullet ===");
  console.log("1. Fetching live token catalog...");
  
  const tokensRes = await fetch(`${ONECLICK_BASE}/v0/tokens?ondoTokens`);
  if (!tokensRes.ok) {
    throw new Error(`Failed to fetch tokens: ${tokensRes.statusText}`);
  }
  const tokens = await tokensRes.json();
  console.log(`✓ Total tokens indexed: ${tokens.length}`);

  // Base USDC
  const baseUsdc = tokens.find(
    (t) => t.blockchain === "base" && t.symbol === "USDC"
  );
  console.log("✓ Base USDC Asset ID:", baseUsdc?.assetId);

  // NEAR wNEAR
  const nearToken = tokens.find(
    (t) => t.blockchain === "near" && t.symbol === "wNEAR"
  );
  console.log("✓ NEAR wNEAR Asset ID:", nearToken?.assetId);

  // 2. Request a live dry-run quote: Base USDC -> NEAR
  console.log("\n2. Requesting a verified dry-run quote (10 Base USDC -> wNEAR)...");
  const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  const quotePayload = {
    dry: true,
    swapType: "EXACT_INPUT",
    originAsset: baseUsdc.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: nearToken.assetId,
    amount: "10000000", // 10 USDC (6 decimals)
    recipient: "veilx-demo.testnet",
    recipientType: "INTENTS",
    refundTo: "veilx-demo.testnet",
    refundType: "INTENTS",
    slippageTolerance: 100, // 1%
    deadline: deadline,
  };

  const quoteRes = await fetch(`${ONECLICK_BASE}/v0/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quotePayload),
  });

  if (!quoteRes.ok) {
    const errText = await quoteRes.text();
    throw new Error(`Quote failed (${quoteRes.status}): ${errText}`);
  }

  const quoteData = await quoteRes.json();
  console.log("✓ Quote Successful!");
  console.log(`  Amount In:  $${quoteData.quote.amountInUsd} (${quoteData.quote.amountInFormatted} Base USDC)`);
  console.log(`  Amount Out: $${quoteData.quote.amountOutUsd} (${quoteData.quote.amountOutFormatted} wNEAR)`);
  console.log(`  Estimated Time: ${quoteData.quote.timeEstimate} seconds`);
  console.log(`  Solvers Signature: ${quoteData.signature.slice(0, 32)}...`);
  console.log("\n=== Tracer Bullet 1 Passed with 100% Real Live Network Proof ===");
}

main().catch(console.error);
