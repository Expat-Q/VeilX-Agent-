// packages/veil-agent-plugin/src/index.ts
// Official Veil Plugin for ElizaOS, LangChain, and Node.js Agent Frameworks

export interface VeilPluginConfig {
  baseUrl?: string;
  mcpEndpoint?: string;
  openapiEndpoint?: string;
}

export const DEFAULT_CONFIG: VeilPluginConfig = {
  baseUrl: "https://veilx-agent.onrender.com",
  mcpEndpoint: "https://veilx-agent.onrender.com/api/mcp",
  openapiEndpoint: "https://veilx-agent.onrender.com/api/openapi.json",
};

/**
 * ElizaOS Plugin Definition for Veil Finance
 */
export const veilElizaPlugin = {
  name: "veil-finance",
  description: "Autonomous Omnichain Social Finance Copilot, Tokenized Equities DCA, and On-Chain Guardrails on NEAR Protocol",
  actions: [
    {
      name: "VEIL_GET_PORTFOLIO",
      description: "Query user on-chain NEAR/USDC balance and tokenized US equities holdings.",
      handler: async (runtime: any, message: any) => {
        const res = await fetch(`${DEFAULT_CONFIG.baseUrl}/api/agent/portfolio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        return res.json();
      },
    },
    {
      name: "VEIL_EXECUTE_DCA",
      description: "Execute a dollar-cost averaging purchase of tokenized US equities (TSLAon, NVDAon, SPYon).",
      handler: async (runtime: any, message: any) => {
        const res = await fetch(`${DEFAULT_CONFIG.baseUrl}/api/agent/dca`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.content || {}),
        });
        return res.json();
      },
    },
    {
      name: "VEIL_SEND_TIP",
      description: "Send a social tip to any Twitter/X handle via non-custodial session key.",
      handler: async (runtime: any, message: any) => {
        const res = await fetch(`${DEFAULT_CONFIG.baseUrl}/api/agent/tip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.content || {}),
        });
        return res.json();
      },
    },
    {
      name: "VEIL_SET_GUARDRAILS",
      description: "Configure daily or weekly mathematical spending caps on the NEAR smart contract.",
      handler: async (runtime: any, message: any) => {
        const res = await fetch(`${DEFAULT_CONFIG.baseUrl}/api/agent/guardrails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.content || {}),
        });
        return res.json();
      },
    },
  ],
};

export default veilElizaPlugin;
