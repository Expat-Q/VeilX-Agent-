import { NextResponse } from "next/server";
import { getNearUsdPrice } from "@/lib/near-price";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const priceUsd = await getNearUsdPrice();
    return NextResponse.json({
      success: true,
      priceUsd,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, priceUsd: 3.50, error: err.message },
      { status: 500 }
    );
  }
}
