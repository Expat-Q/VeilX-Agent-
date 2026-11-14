// scripts/test-user-key.mjs
async function test() {
  console.log("1. Generating / retrieving Agent API Key for expatq23...");
  const res = await fetch("http://localhost:3000/api/user/agent-key?handle=expatq23").then(r => r.json());
  console.log("   Result:", res);

  console.log("\n2. Calling veil_get_portfolio with Authorization Bearer header...");
  const mcpRes = await fetch("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${res.apiKey}`
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "veil_get_portfolio",
        arguments: {}
      }
    })
  }).then(r => r.json());

  console.log("\n3. MCP Result received by ChatGPT:");
  console.log(mcpRes.result?.content?.[0]?.text);
}

test().catch(console.error);
