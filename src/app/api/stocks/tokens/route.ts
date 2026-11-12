import { NextResponse } from "next/server";
import { fetchLiveStockAssets } from "@/lib/ondo-stocks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const assets = await fetchLiveStockAssets();
    return NextResponse.json({
      success: true,
      assets,
      count: assets.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Failed to fetch stock assets:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch stock tokens" },
      { status: 500 }
    );
  }
}
