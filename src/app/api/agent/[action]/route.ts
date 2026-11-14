// src/app/api/agent/[action]/route.ts
// Direct REST Action Handlers for External AI Agents & ChatGPT Custom GPT Actions

import { NextRequest, NextResponse } from "next/server";
import { executeMcpTool } from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";

const ACTION_TOOL_MAP: Record<string, string> = {
  dca: "veil_execute_dca",
  rules: "veil_manage_rules",
  tip: "veil_send_tip",
  transfer: "veil_direct_transfer",
  "pay-invoice": "veil_pay_invoice",
  guardrails: "veil_set_guardrails",
  portfolio: "veil_get_portfolio",
  quote: "veil_quote_stock",
};

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

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const actionKey = params.action?.toLowerCase();
    const toolName = ACTION_TOOL_MAP[actionKey];

    if (!toolName) {
      return NextResponse.json(
        { success: false, error: `Unknown agent action '${params.action}'` },
        { status: 404, headers }
      );
    }

    const body = await req.json().catch(() => ({}));
    const result = await executeMcpTool(toolName, body);

    return NextResponse.json({ success: true, tool: toolName, data: result }, { headers });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Action execution failed" },
      { status: 500, headers }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const actionKey = params.action?.toLowerCase();
    const toolName = ACTION_TOOL_MAP[actionKey];

    if (!toolName) {
      return NextResponse.json(
        { success: false, error: `Unknown agent action '${params.action}'` },
        { status: 404, headers }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const args: Record<string, any> = {};
    searchParams.forEach((val, key) => {
      args[key] = val;
    });

    const result = await executeMcpTool(toolName, args);
    return NextResponse.json({ success: true, tool: toolName, data: result }, { headers });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Action execution failed" },
      { status: 500, headers }
    );
  }
}
