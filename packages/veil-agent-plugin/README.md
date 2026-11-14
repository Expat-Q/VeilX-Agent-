# @veil/agent-plugin
### Official Agent Plugin for Veil Autonomous Finance on NEAR Protocol

Connect your favorite AI agent framework (**Claude Desktop**, **ChatGPT**, **ElizaOS**, **LangChain**, or **Antigravity**) directly to your non-custodial Veil wallet.

---

## 🚀 Quick Start by Agent Platform

### 1. Claude Desktop (MCP Plugin)
Run in your terminal:
```bash
npx @veil/agent-plugin claude
```
Copy the JSON output into your `claude_desktop_config.json`:
* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "veil": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://veilx-agent.onrender.com/api/mcp"]
    }
  }
}
```

---

### 2. ChatGPT (Custom GPT Action Plugin)
Run in your terminal:
```bash
npx @veil/agent-plugin chatgpt
```
1. In ChatGPT: Go to **My GPTs** → **Create a GPT** → **Configure** → **Actions**.
2. Click **Import from URL**.
3. Paste: `https://veilx-agent.onrender.com/api/openapi.json` and click **Import**.

---

### 3. ElizaOS Framework Plugin
Install in your Eliza agent project:
```bash
npm install @veil/agent-plugin
```
Register in your Eliza agent character:
```typescript
import { veilElizaPlugin } from "@veil/agent-plugin";

export const character = {
  name: "VeilTrader",
  plugins: [veilElizaPlugin],
  // ...
};
```

---

## 🛠️ Supported Autonomous Tools
| Tool Name | Action | Security Check |
| :--- | :--- | :--- |
| `veil_get_portfolio` | Query NEAR/USDC balance and tokenized stock holdings | Read-only |
| `veil_quote_stock` | Fetch real-time Pyth & Ondo stock quotes | Read-only |
| `veil_execute_dca` | Execute automated DCA buy into TSLAon, NVDAon, SPYon | Daily spend cap check |
| `veil_manage_rules` | Arm or update 24/7 limit dip-buy & take-profit rules | Scoped key check |
| `veil_send_tip` | Send social payment to any @handle | Anomaly HitL quarantine ($25 limit) |
| `veil_direct_transfer` | Sovereign wallet transfers with NEAR/EVM guardrails | Address format check |
| `veil_pay_invoice` | Cross-chain PayLink settlement via 1Click solvers | Solver quote verification |
| `veil_set_guardrails` | Set rolling daily/weekly contract spending caps | On-chain contract write |
