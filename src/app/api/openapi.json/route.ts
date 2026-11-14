// src/app/api/openapi.json/route.ts
// Standard OpenAPI 3.0 Specification for ChatGPT Custom GPT Actions & External AI Agents

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "veilx-agent.vercel.app";
  const protocol =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  const openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "Veil Autonomous Omnichain Finance & Equities Agent",
      description:
        "Institutional-grade stock trading copilot and omnichain social finance engine powered by NEAR Protocol. Provides 24/7 tokenized US equity trading (Ondo Finance: TSLAon, NVDAon, AAPLon, SPYon) via Defuse 1Click solvers, automated Dollar Cost Averaging (DCA), bracket orders, multichain PayLinks, social tipping, and non-custodial session key guardrails.",
      version: "1.0.0",
      contact: {
        name: "Veil Protocol Engineering",
        url: baseUrl,
      },
    },
    servers: [
      {
        url: baseUrl,
        description: "Active Veil Engine Server",
      },
    ],
    paths: {
      "/api/portfolio": {
        get: {
          operationId: "veil_get_portfolio",
          summary: "Get Portfolio Holdings & Active Rules",
          description:
            "Retrieve current portfolio balances, tokenized stock positions (TSLAon, NVDAon, AAPLon, SPYon), cash, and active automated trading rules.",
          parameters: [
            {
              name: "handle",
              in: "query",
              required: false,
              description: "Twitter handle or NEAR account identifier without @ (e.g. 'expatq3')",
              schema: {
                type: "string",
                default: "guest",
              },
            },
          ],
          responses: {
            "200": {
              description: "Current user portfolio snapshot",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      portfolio: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/price": {
        get: {
          operationId: "veil_quote_stock",
          summary: "Get Real-Time Stock or Crypto Quote",
          description:
            "Fetch real-time verified price quote, 24h change, and technical indicators for any tokenized US equity (TSLAon, NVDAon, AAPLon, SPYon) or cryptocurrency (NEAR, BTC, ETH).",
          parameters: [
            {
              name: "symbol",
              in: "query",
              required: true,
              description: "Ticker symbol (e.g. 'TSLA', 'NVDA', 'AAPL', 'SPY', 'NEAR', 'BTC')",
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Real-time market quote data",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/dca": {
        post: {
          operationId: "veil_execute_dca",
          summary: "Activate Autonomous Dollar-Cost Averaging (DCA)",
          description:
            "Configure and activate an automated DCA recurring purchase rule for tokenized equities on NEAR Protocol.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["symbol", "amountUsd", "cadence"],
                  properties: {
                    symbol: {
                      type: "string",
                      description: "Target stock ticker symbol (e.g. 'TSLAon', 'NVDAon')",
                    },
                    amountUsd: {
                      type: "number",
                      description: "Dollar amount to allocate per recurring cycle (e.g. 25, 50, 100)",
                    },
                    cadence: {
                      type: "string",
                      enum: ["1m", "5m", "hourly", "daily", "weekly"],
                      description: "Execution cadence: '1m' (Fast testnet demo), '5m', 'hourly', 'daily', or 'weekly'",
                    },
                    handle: {
                      type: "string",
                      description: "Optional user handle without @",
                    },
                    maxExecutions: {
                      type: "number",
                      description: "Optional maximum execution cycles before auto-completion",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "DCA rule creation confirmation",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/rules": {
        post: {
          operationId: "veil_manage_rules",
          summary: "Manage Algorithmic Trading Rules",
          description:
            "Create, list, pause, or cancel conditional algorithmic trading rules (buy dip, take profit, stop loss, bracket orders).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["action"],
                  properties: {
                    action: {
                      type: "string",
                      enum: ["create", "list", "cancel", "pause"],
                      description: "Management action to perform",
                    },
                    handle: {
                      type: "string",
                      description: "User handle without @",
                    },
                    ruleId: {
                      type: "string",
                      description: "Specific rule ID required for 'cancel' or 'pause' actions",
                    },
                    symbol: {
                      type: "string",
                      description: "Stock ticker symbol (required when action is 'create')",
                    },
                    type: {
                      type: "string",
                      enum: ["buy_dip", "take_profit", "stop_loss", "bracket_order", "recurring_buy"],
                      description: "Rule type for 'create' action",
                    },
                    amountUsd: {
                      type: "number",
                      description: "Dollar allocation amount",
                    },
                    targetPrice: {
                      type: "number",
                      description: "Target trigger price in USD (for buy_dip)",
                    },
                    targetPercent: {
                      type: "number",
                      description: "Target percentage for dip, gain, or stop-loss",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Rule management operation result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/tip": {
        post: {
          operationId: "veil_send_tip",
          summary: "Send Social Tip via NEAR Smart Escrow",
          description:
            "Send a social tip to any Twitter/X handle with non-custodial session authorization and on-chain social escrow.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["recipientHandle", "amount"],
                  properties: {
                    recipientHandle: {
                      type: "string",
                      description: "Target Twitter handle to tip, without @ (e.g. 'vitalik', 'expatq3')",
                    },
                    amount: {
                      type: "number",
                      description: "Amount to tip in USD or crypto units",
                    },
                    asset: {
                      type: "string",
                      description: "Asset ticker (e.g. 'USDC', 'NEAR'). Default is 'USDC'.",
                    },
                    senderHandle: {
                      type: "string",
                      description: "Sender handle or agent identifier",
                    },
                    isPrivate: {
                      type: "boolean",
                      description: "Whether to wrap tip in zero-knowledge stealth escrow",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Tip deposit status and claim link",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/transfer": {
        post: {
          operationId: "veil_direct_transfer",
          summary: "Direct On-Chain Transfer",
          description:
            "Perform a direct wallet-to-wallet transfer to an on-chain NEAR account (*.near, *.testnet) or EVM address without escrow lock.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["recipientAddress", "amount", "asset"],
                  properties: {
                    recipientAddress: {
                      type: "string",
                      description: "Recipient on-chain address (*.near, *.testnet, or 0x EVM address)",
                    },
                    amount: {
                      type: "number",
                      description: "Amount to transfer",
                    },
                    asset: {
                      type: "string",
                      description: "Asset ticker (e.g. 'NEAR', 'USDC', 'TSLAon')",
                    },
                    sourceChain: {
                      type: "string",
                      description: "Origin blockchain ('NEAR', 'BASE', 'ETHEREUM')",
                    },
                    senderHandle: {
                      type: "string",
                      description: "Sender handle or account",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Transfer submission confirmation",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/pay-invoice": {
        post: {
          operationId: "veil_pay_invoice",
          summary: "Settle PayLink Multichain Invoice",
          description:
            "Settle an existing Veil PayLink invoice using non-custodial delegated session keys.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["slug"],
                  properties: {
                    slug: {
                      type: "string",
                      description: "PayLink invoice slug identifier (e.g. 'inv_a1b2c3')",
                    },
                    payerHandle: {
                      type: "string",
                      description: "Optional paying handle or wallet",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Invoice settlement receipt",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/guardrails": {
        post: {
          operationId: "veil_set_guardrails",
          summary: "Set On-Chain Spending Guardrails & Limits",
          description:
            "Set or update non-custodial on-chain spending guardrails and risk policy (daily spending limits, per-transaction caps, max single asset allocation, stop loss limits).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["handle"],
                  properties: {
                    handle: {
                      type: "string",
                      description: "User handle without @",
                    },
                    dailySpendingLimitUsd: {
                      type: "number",
                      description: "Maximum daily spending allowance in USD (e.g. 50, 100)",
                    },
                    weeklySpendingLimitUsd: {
                      type: "number",
                      description: "Maximum weekly spending allowance in USD (e.g. 200, 500)",
                    },
                    perTxLimitUsd: {
                      type: "number",
                      description: "Per-transaction limit in USD (e.g. 15, 25)",
                    },
                    maxSingleAssetPercent: {
                      type: "number",
                      description: "Maximum portfolio allocation percentage in any single asset (e.g. 25)",
                    },
                    stopLossPercent: {
                      type: "number",
                      description: "Default automated stop loss percentage across all holdings (e.g. 5)",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated active guardrails policy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/mcp": {
        post: {
          operationId: "veil_mcp_unified_gateway",
          summary: "Veil Unified MCP Gateway (JSON-RPC 2.0 / REST)",
          description:
            "Universal gateway for MCP clients (Claude Desktop) and agent frameworks (Eliza, OpenClaw). Accepts standard JSON-RPC 2.0 requests (initialize, tools/list, tools/call) as well as direct tool invocations.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tool: {
                      type: "string",
                      description: "Tool name (e.g. 'veil_get_portfolio', 'veil_quote_stock', etc.)",
                    },
                    args: {
                      type: "object",
                      description: "Arguments for the tool",
                    },
                    jsonrpc: {
                      type: "string",
                      description: "Set to '2.0' for JSON-RPC 2.0 requests",
                    },
                    method: {
                      type: "string",
                      description: "JSON-RPC method name ('tools/call', 'tools/list', etc.)",
                    },
                    params: {
                      type: "object",
                      description: "JSON-RPC params",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "MCP tool execution result or JSON-RPC 2.0 response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
