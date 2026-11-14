// scripts/test-user-key.mjs
async function test() {
  console.log("1. Fetching user agent key for expatq23...");
  const res = await fetch("http://localhost:3000/api/user/agent-key?handle=expatq23").then(r => r.json());
  console.log("   API Key:", res.apiKey);

  console.log("\n2. Calling MCP URL with ?key= parameter and NO auth header...");
  const mcpUrl = `http://localhost:3000/api/mcp?key=${res.apiKey}`;
  const mcpRes = await fetch(mcpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 20,
      method: "tools/call",
      params: {
        name: "veil_get_portfolio",
        arguments: {}
      }
    })
  }).then(r => r.json());

  console.log("\n3. MCP Result received via Query Param Auth:");
  console.log(mcpRes.result?.content?.[0]?.text);
}

test().catch(console.error);
