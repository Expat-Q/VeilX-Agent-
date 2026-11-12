// src/app/api/prices/route.ts
// Real-Time Multi-Source Market Price Endpoint (CoinMarketCap Pro + CoinGecko + 1Click)

import { NextRequest, NextResponse } from "next/server";
import { getLiveAssetPrices, getLiveNearPrice, getLiveEthPrice } from "@/lib/oracle-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbols = searchParams.get("symbols") || "NEAR,ETH,BTC,SOL,USDC,USDT";
    const symbols = rawSymbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const rawPrices = await getLiveAssetPrices(symbols);
    const nearPrice = await getLiveNearPrice();
    const ethPrice = await getLiveEthPrice();

    const prices: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawPrices)) {
      prices[key] = val;
      prices[key.toUpperCase()] = val;
      if (key.toUpperCase().endsWith("ON")) {
        const base = key.slice(0, -2);
        prices[base] = val;
        prices[`${base}on`] = val;
        prices[`${base}ON`] = val;
      } else {
        prices[`${key}on`] = val;
        prices[`${key}ON`] = val;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      prices,
      nearPrice,
      ethPrice,
    });
  } catch (err: any) {
    console.error("[API /api/prices] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to fetch live prices",
        nearPrice: 3.70,
        ethPrice: 2240.0,
      },
      { status: 500 }
    );
  }
}
