import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Portfolio } from "@/models/Portfolio";
import { fetchLiveStockAssets } from "@/lib/ondo-stocks";
import { evaluateTradingRules } from "@/lib/trading-copilot";

export const dynamic = "force-dynamic";

// Keep-Alive Autonomous Rule Evaluation Worker for Veil
// Strictly protected via Authorization: Bearer <CRON_SECRET>
async function handleEvaluateRules(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Strict authentication: CRON_SECRET must be configured and match the Bearer token
    if (!cronSecret) {
      console.error("[Cron Evaluate Rules] CRON_SECRET is not configured in environment");
      return NextResponse.json(
        { error: "Server misconfiguration: CRON_SECRET is not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized: Invalid cron bearer secret" }, { status: 401 });
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });
    }

    // Optional user handle filter, or evaluate all active users
    const { searchParams } = new URL(req.url);
    let filterHandle = searchParams.get("handle");

    if (!filterHandle && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        if (body && typeof body.handle === "string") {
          filterHandle = body.handle;
        }
      } catch {
        // ignore body parsing error
      }
    }

    const query: any = {
      "rules.status": "active",
    };
    if (filterHandle) {
      query.handle = filterHandle.replace("@", "").trim();
    }

    const portfolios = await Portfolio.find(query);
    if (!portfolios || portfolios.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active trading rules pending evaluation.",
        evaluatedCount: 0,
        executedCount: 0,
      });
    }

    // Fetch live market prices for all tracked assets
    const liveAssets = await fetchLiveStockAssets();

    let totalExecuted = 0;
    const executionSummaries: any[] = [];

    for (const port of portfolios) {
      const mode = (port.mode as "simulation" | "mainnet") || "simulation";
      const cashToUse = mode === "mainnet" ? (port.cashUsd || 0) : (port.paperCashUsd !== undefined ? port.paperCashUsd : 10000.0);

      const result = evaluateTradingRules(
        port.rules as any,
        liveAssets,
        {
          cashUsd: cashToUse,
          positions: (port.positions as any) || [],
          orderHistory: (port.orderHistory as any) || [],
        },
        mode
      );

      if (result.hasChanges) {
        port.rules = result.updatedRules as any;
        port.positions = result.updatedPositions as any;
        if (mode === "mainnet") {
          port.cashUsd = result.updatedCash;
        } else {
          port.paperCashUsd = result.updatedCash;
        }

        const existingHistory = Array.isArray(port.orderHistory) ? port.orderHistory : [];
        port.orderHistory = [...result.executedOrders, ...existingHistory] as any;

        await port.save();

        totalExecuted += result.executedOrders.length;
        executionSummaries.push({
          handle: port.handle,
          orders: result.executedOrders,
        });
      }
    }

    return NextResponse.json({
      success: true,
      evaluatedPortfolios: portfolios.length,
      totalExecutedOrders: totalExecuted,
      executions: executionSummaries,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Cron /api/cron/evaluate-rules error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleEvaluateRules(req);
}

export async function POST(req: NextRequest) {
  return handleEvaluateRules(req);
}
