import { NextRequest, NextResponse } from "next/server";
import { evaluateMarketAndGenerateDecisions, RiskPolicy, PortfolioPosition } from "@/lib/market-analyst";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const watchlist: string[] = Array.isArray(body.watchlist) ? body.watchlist : ["NVDAon", "TSLAon", "SPYon", "NEAR"];
    const cashUsd: number = typeof body.cashUsd === "number" ? body.cashUsd : 500.0;
    const positions: PortfolioPosition[] = Array.isArray(body.positions) ? body.positions : [];
    const riskPolicy: RiskPolicy = body.riskPolicy || {
      maxSingleAssetPercent: 25,
      minCashReservePercent: 20,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      strategyMode: "dca",
      isAutonomousEnabled: true,
    };

    const result = await evaluateMarketAndGenerateDecisions(
      watchlist,
      cashUsd,
      positions,
      riskPolicy
    );

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Market evaluation failed:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to analyze market" },
      { status: 500 }
    );
  }
}
