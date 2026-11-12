import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { Portfolio } from "@/models/Portfolio";
import { verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawHandle = searchParams.get("handle") || "guest";
    const handle = rawHandle.replace("@", "").trim();

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });
    }

    let portfolio = await Portfolio.findOne({ handle });
    if (!portfolio) {
      // Clean initial portfolio with $10,000 sandbox virtual capital & simulation mode
      portfolio = await Portfolio.create({
        handle,
        nearAccountId: `${handle}.veilx-agent.testnet`,
        cashUsd: 0.0,
        paperCashUsd: 10000.0,
        mode: "simulation",
        watchlist: ["NVDAon", "TSLAon", "SPYon", "NEAR"],
        positions: [],
        rules: [],
        orderHistory: [],
        riskPolicy: {
          maxSingleAssetPercent: 25,
          minCashReservePercent: 20,
          stopLossPercent: 5,
          takeProfitPercent: 10,
          strategyMode: "dca",
          isAutonomousEnabled: true,
        },
        decisionHistory: [],
      });
    }

    return NextResponse.json({ success: true, portfolio });
  } catch (err: any) {
    console.error("GET /api/portfolio error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawHandle = body.handle || "guest";
    const handle = rawHandle.replace("@", "").trim();

    // Authenticate session and enforce resource ownership
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!sessionUser || sessionUser.xHandle?.toLowerCase() !== handle.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active authenticated session matching user handle is required" },
        { status: 401 }
      );
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 503 });
    }

    const updateData: any = {};
    if (typeof body.cashUsd === "number") updateData.cashUsd = body.cashUsd;
    if (typeof body.paperCashUsd === "number") updateData.paperCashUsd = body.paperCashUsd;
    if (typeof body.mode === "string") updateData.mode = body.mode;
    if (Array.isArray(body.watchlist)) updateData.watchlist = body.watchlist;
    if (Array.isArray(body.positions)) updateData.positions = body.positions;
    if (body.riskPolicy) updateData.riskPolicy = body.riskPolicy;
    if (Array.isArray(body.decisionHistory)) updateData.decisionHistory = body.decisionHistory;
    if (Array.isArray(body.rules)) updateData.rules = body.rules;
    if (Array.isArray(body.orderHistory)) updateData.orderHistory = body.orderHistory;

    const portfolio = await Portfolio.findOneAndUpdate(
      { handle },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, portfolio });
  } catch (err: any) {
    console.error("POST /api/portfolio error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
