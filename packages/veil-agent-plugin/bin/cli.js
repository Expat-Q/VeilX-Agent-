#!/usr/bin/env node

const args = process.argv.slice(2);
const command = (args[0] || "info").toLowerCase();

console.log("\n⚡ Veil Autonomous Finance Plugin for AI Agents ⚡");
console.log("====================================================\n");

if (command === "connect" || command === "claude") {
  console.log("📋 Claude Desktop MCP Configuration:");
  console.log("------------------------------------");
  const config = {
    mcpServers: {
      veil: {
        command: "npx",
        args: ["-y", "mcp-remote", "https://veilx-agent.onrender.com/api/mcp"]
      }
    }
  };
  console.log(JSON.stringify(config, null, 2));
  console.log("\n💡 Add this to your claude_desktop_config.json under 'mcpServers'.");
  console.log("macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json");
  console.log("Windows: %APPDATA%\\Claude\\claude_desktop_config.json\n");
} else if (command === "schema" || command === "chatgpt") {
  console.log("🌐 ChatGPT Custom GPT Action Schema URL:");
  console.log("----------------------------------------");
  console.log("https://veilx-agent.onrender.com/api/openapi.json");
  console.log("\n💡 In ChatGPT: Custom GPT -> Configure -> Actions -> Import from URL -> Paste this link.\n");
} else if (command === "tools") {
  console.log("🛠️ Available Veil Autonomous Tools:");
  console.log("----------------------------------");
  console.log("1. veil_get_portfolio       - Query on-chain NEAR/USDC and tokenized stock holdings");
  console.log("2. veil_quote_stock         - Live Pyth & Ondo real-time oracle stock quotes");
  console.log("3. veil_execute_dca         - Programmatic DCA buy execution into tokenized US equities");
  console.log("4. veil_manage_rules        - Arm or modify 24/7 autonomous DCA & limit dip-buy rules");
  console.log("5. veil_send_tip            - Social pay transfer to any @handle via non-custodial session key");
  console.log("6. veil_direct_transfer     - Wallet transfers with NEAR & EVM safety guardrails");
  console.log("7. veil_pay_invoice         - Cross-chain invoice settlement via Defuse 1Click solvers");
  console.log("8. veil_set_guardrails      - Dynamically enforce rolling daily/weekly on-chain budget caps\n");
} else {
  console.log("Usage: npx @veil/agent-plugin <command>\n");
  console.log("Commands:");
  console.log("  claude   - Print Claude Desktop MCP configuration JSON");
  console.log("  chatgpt  - Print ChatGPT Custom GPT OpenAPI schema URL");
  console.log("  tools    - List all 8 autonomous financial execution tools");
  console.log("  info     - Display plugin summary and integration links\n");
}
