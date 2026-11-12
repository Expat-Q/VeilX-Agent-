import { NextRequest, NextResponse } from "next/server";
import { fetchMarketPrice } from "@/lib/price-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") || searchParams.get("query") || "NEAR";

    const result = await fetchMarketPrice(symbol);
    if (!result) {
      return NextResponse.json(
        { success: false, error: `Price information for '${symbol}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to resolve price" },
      { status: 500 }
    );
  }
}
