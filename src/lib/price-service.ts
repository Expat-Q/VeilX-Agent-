// src/lib/price-service.ts
// Unified Real-Time Multi-Source Market Price Resolution for Crypto & Equities
// Powered by CoinMarketCap Pro, Defuse 1Click Solvers, and Yahoo Finance

import { getLiveAssetPrice, ASSET_METADATA_MAP } from "./oracle-service";

export interface MarketPriceResult {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  category: "crypto" | "stock" | "etf" | "commodity";
  trend?: "bullish" | "bearish" | "neutral";
  rsi14?: number;
  sma20?: number;
  source: string;
}

export async function fetchMarketPrice(rawQuery: string): Promise<MarketPriceResult | null> {
  const clean = rawQuery.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return null;

  try {
    const quote = await getLiveAssetPrice(clean);
    if (!quote || quote.priceUsd <= 0) return null;

    const meta = ASSET_METADATA_MAP[clean];
    const isStock = clean.endsWith("ON") || ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "SPY", "QQQ", "GLD"].includes(clean);
    const category = meta ? meta.category : isStock ? "stock" : "crypto";
    const name = meta ? meta.name : clean;

    return {
      symbol: clean,
      name,
      priceUsd: quote.priceUsd,
      change24h: quote.change24h,
      category,
      trend: quote.change24h > 0 ? "bullish" : quote.change24h < 0 ? "bearish" : "neutral",
      source: quote.source,
    };
  } catch (err) {
    console.warn("[Price Service] fetchMarketPrice failed:", err);
    return null;
  }
}
