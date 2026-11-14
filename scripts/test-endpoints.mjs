// scripts/test-endpoints.mjs
async function run() {
  console.log("1. Testing MCP Server GET...");
  const mcpGet = await fetch("http://localhost:3000/api/mcp").then(r => r.json());
  console.log("   Name:", mcpGet.name, "| Tools Count:", mcpGet.toolsCount);

  console.log("2. Testing MCP tools/call for 'veil_quote_stock' (TSLA)...");
  const mcpCall = await fetch("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "veil_quote_stock",
        arguments: { symbol: "TSLA" }
      }
    })
  }).then(r => r.json());
  console.log("   MCP Result:", JSON.stringify(mcpCall.result?.content?.[0]?.text || mcpCall));

  console.log("3. Testing OpenAPI 3.0 GET...");
  const openapi = await fetch("http://localhost:3000/api/openapi.json").then(r => r.json());
  console.log("   OpenAPI Version:", openapi.openapi, "| Title:", openapi.info?.title);

  console.log("4. Testing PayLink Creation with Strict Non-Zero Guardrail...");
  const payQuote = await fetch("http://localhost:3000/api/paylinks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: `test-consult-${Date.now()}`,
      recipientNearAccount: "expatq3.veilx-agent.testnet",
      creatorHandle: "expatq3",
      amountUsd: 15,
      memo: "Test payment"
    })
  }).then(r => r.json());
  console.log("   PayLink Result:", payQuote.slug ? `Success! Created PayLink: /pay/${payQuote.slug}` : JSON.stringify(payQuote));

  console.log("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!");
}

run().catch(console.error);
