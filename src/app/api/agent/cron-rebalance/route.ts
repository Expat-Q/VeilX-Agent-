import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Portfolio } from "@/models/Portfolio";
import { evaluateMarketAndGenerateDecisions } from "@/lib/market-analyst";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Strict authentication: CRON_SECRET must be configured and match the Bearer token
    if (!cronSecret) {
      console.error("[Cron Rebalance] CRON_SECRET is not configured in environment");
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
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    // Find all portfolios with autonomous mode active
    const activePortfolios = await Portfolio.find({ "riskPolicy.isAutonomousEnabled": true });

    const results: Array<{ handle: string; decisionCount: number; updatedCash: number }> = [];

    for (const port of activePortfolios) {
      try {
        const liquidCash = typeof port.cashUsd === "number" ? Math.max(0, port.cashUsd) : 0.0;
        const { decisions, updatedPositions, updatedCash } = await evaluateMarketAndGenerateDecisions(
          port.watchlist || ["NVDAon", "TSLAon", "SPYon", "NEAR"],
          liquidCash,
          port.positions || [],
          port.riskPolicy || {
            maxSingleAssetPercent: 25,
            minCashReservePercent: 20,
            stopLossPercent: 5,
            takeProfitPercent: 10,
            strategyMode: "dca",
            isAutonomousEnabled: true,
          }
        );

        // Update portfolio state and prepend new decisions
        port.cashUsd = updatedCash;
        port.positions = updatedPositions;
        const currentHistory = port.decisionHistory || [];
        port.decisionHistory = [...decisions, ...currentHistory].slice(0, 40);
        await port.save();

        results.push({
          handle: port.handle,
          decisionCount: decisions.length,
          updatedCash,
        });
      } catch (userErr) {
        console.warn(`Error running cron for handle ${port.handle}:`, userErr);
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("GET /api/agent/cron-rebalance error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
