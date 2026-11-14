// src/app/api/mcp/route.ts
// Standard Model Context Protocol (MCP) & JSON-RPC 2.0 Interface for Veil
// Enables Claude Desktop, ChatGPT, Eliza, OpenClaw, and autonomous external agents
// to interact with Veil's on-chain trading engine, social tipping, and risk guardrails.

import { NextRequest, NextResponse } from "next/server";
import { MCP_TOOLS, executeMcpTool } from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-veil-session",
    },
  });
}

// GET handler returns MCP server manifest & tool documentation
export async function GET() {
  return NextResponse.json(
    {
      name: "veil-mcp-server",
      version: "1.0.0",
      description: "Veil MCP Server: Autonomous Omnichain Finance & Tokenized US Equities on NEAR",
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      toolsCount: MCP_TOOLS.length,
      tools: MCP_TOOLS,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

// POST handler: handles JSON-RPC 2.0 requests from Claude Desktop and agent frameworks
export async function POST(req: NextRequest) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const body = await req.json();

    // Check if body is standard JSON-RPC 2.0
    const isRpc = body.jsonrpc === "2.0";
    const id = body.id !== undefined ? body.id : null;
    const method = body.method;

    // Handle MCP protocol methods
    if (method === "initialize") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: {
              name: "veil-mcp-server",
              version: "1.0.0",
            },
          },
        },
        { headers }
      );
    }

    if (method === "notifications/initialized" || method === "ping") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {},
        },
        { headers }
      );
    }

    if (method === "tools/list") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS,
          },
        },
        { headers }
      );
    }

    if (method === "tools/call") {
      const toolName = body.params?.name;
      const toolArgs = body.params?.arguments || {};

      if (!toolName) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Missing tool name in params" },
          },
          { headers, status: 400 }
        );
      }

      try {
        const result = await executeMcpTool(toolName, toolArgs);
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                },
              ],
              isError: false,
            },
          },
          { headers }
        );
      } catch (toolErr: any) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Tool Execution Error: ${toolErr.message || String(toolErr)}`,
                },
              ],
              isError: true,
            },
          },
          { headers }
        );
      }
    }

    // Direct invocation fallback: if caller sends `{ tool: "veil_...", args: {...} }` or query param `?tool=veil_...`
    const toolFromQuery = req.nextUrl.searchParams.get("tool");
    const directToolName = toolFromQuery || body.tool || body.name;
    const directArgs = body.args || body.arguments || (toolFromQuery ? body : {});
    if (directToolName) {
      try {
        const result = await executeMcpTool(directToolName, directArgs);
        return NextResponse.json(
          isRpc
            ? {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                  isError: false,
                },
              }
            : { success: true, tool: directToolName, data: result },
          { headers }
        );
      } catch (err: any) {
        return NextResponse.json(
          isRpc
            ? {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text: `Error: ${err.message}` }],
                  isError: true,
                },
              }
            : { success: false, tool: directToolName, error: err.message },
          { headers, status: 500 }
        );
      }
    }

    // Unknown method
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method '${method}' not found` },
      },
      { headers, status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: `Parse error: ${err.message || String(err)}` },
      },
      { headers, status: 400 }
    );
  }
}
