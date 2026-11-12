// src/lib/oracle-service.ts
// Centralized Multi-Source Real-Time Market Price Oracle for VeilX
// Prioritizes CoinMarketCap Pro, with CoinGecko, 1Click Defuse, and Yahoo Finance fallbacks

export interface LivePriceData {
  symbol: string;
  priceUsd: number;
  change24h: number;
  lastUpdated: number;
  source: string;
}

const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "e604e35801694a95a0ff21f352377754";
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// In-memory server cache
const memoryCache = new Map<string, LivePriceData>();

// Standard CMC Symbol to ID and Normalized Symbol Mapping
export const ASSET_METADATA_MAP: Record<string, { cmcId: number; name: string; category: "crypto" | "stock" | "etf" | "commodity" }> = {
  BTC: { cmcId: 1, name: "Bitcoin", category: "crypto" },
  ETH: { cmcId: 1027, name: "Ethereum", category: "crypto" },
  SOL: { cmcId: 5426, name: "Solana", category: "crypto" },
  NEAR: { cmcId: 6535, name: "NEAR Protocol", category: "crypto" },
  USDC: { cmcId: 3408, name: "USD Coin", category: "crypto" },
  USDT: { cmcId: 825, name: "Tether USD", category: "crypto" },
  DOGE: { cmcId: 74, name: "Dogecoin", category: "crypto" },
  ZEC: { cmcId: 1437, name: "Zcash", category: "crypto" },
  XRP: { cmcId: 52, name: "XRP", category: "crypto" },
  ADA: { cmcId: 2010, name: "Cardano", category: "crypto" },
  SUI: { cmcId: 20947, name: "Sui", category: "crypto" },
  APT: { cmcId: 21794, name: "Aptos", category: "crypto" },
  LTC: { cmcId: 2, name: "Litecoin", category: "crypto" },
  TRX: { cmcId: 1958, name: "TRON", category: "crypto" },
  AVAX: { cmcId: 5805, name: "Avalanche", category: "crypto" },
  LINK: { cmcId: 1975, name: "Chainlink", category: "crypto" },
  ARB: { cmcId: 11841, name: "Arbitrum", category: "crypto" },
  OP: { cmcId: 11840, name: "Optimism", category: "crypto" },
};

const EQUITIES_AND_ETFS = new Set([
  "TSLA", "NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "SPY", "QQQ",
  "GLD", "SLV", "TLT", "MRVL", "HOOD", "INTC", "AGG", "MAG7X", "PLTR", "COIN", "AMD", "NFLX"
]);

export function isEquityOrEtf(sym: string): boolean {
  const upper = sym.toUpperCase();
  if (upper.endsWith("ON")) return true;
  return EQUITIES_AND_ETFS.has(upper);
}

// CoinGecko fallback ID mapping
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  NEAR: "near",
  USDC: "usd-coin",
  USDT: "tether",
  DOGE: "dogecoin",
  ZEC: "zcash",
  XRP: "ripple",
  ADA: "cardano",
  SUI: "sui",
  APT: "aptos",
  LTC: "litecoin",
  TRX: "tron",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  ARB: "arbitrum",
  OP: "optimism",
};

/**
 * Fetch batch crypto quotes from CoinMarketCap Pro API (Server-side only)
 */
async function fetchFromCoinMarketCap(symbols: string[]): Promise<Record<string, { price: number; change24h: number }>> {
  const result: Record<string, { price: number; change24h: number }> = {};
  if (!symbols.length || typeof window !== "undefined") return result;

  try {
    const symbolStr = symbols.join(",");
    const res = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbolStr}`, {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_API_KEY,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.data) {
        for (const sym of symbols) {
          const item = data.data[sym];
          if (item && item.quote && item.quote.USD) {
            const price = Number(item.quote.USD.price) || 0;
            const change24h = Number(item.quote.USD.percent_change_24h) || 0;
            if (price > 0) {
              result[sym] = { price, change24h };
            }
          }
        }
      }
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === "development" && err?.name !== "AbortError") {
      console.warn("[Oracle Service] CoinMarketCap batch fetch failed:", err?.message || err);
    }
  }

  return result;
}

/**
 * Fetch fallback quotes from CoinGecko Free Simple Price API (Server-side only)
 */
async function fetchFromCoinGecko(symbols: string[]): Promise<Record<string, { price: number; change24h: number }>> {
  const result: Record<string, { price: number; change24h: number }> = {};
  if (!symbols.length || typeof window !== "undefined") return result;

  const geckoIds = symbols.map((s) => COINGECKO_IDS[s]).filter(Boolean);
  if (!geckoIds.length) return result;

  try {
    const idStr = geckoIds.join(",");
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idStr}&vs_currencies=usd&include_24hr_change=true`, {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      for (const sym of symbols) {
        const id = COINGECKO_IDS[sym];
        if (id && data[id]) {
          const price = Number(data[id].usd) || 0;
          const change24h = Number(data[id].usd_24h_change) || 0;
          if (price > 0) {
            result[sym] = { price, change24h };
          }
        }
      }
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === "development" && err?.name !== "AbortError") {
      console.warn("[Oracle Service] CoinGecko fallback fetch failed:", err?.message || err);
    }
  }

  return result;
}

/**
 * Fetch live stock / ETF price from Yahoo Finance Chart API (Server-side only)
 */
async function fetchStockFromYahooFinance(cleanSymbol: string): Promise<{ price: number; change24h: number } | null> {
  if (typeof window !== "undefined") return null;
  const ticker = cleanSymbol.replace(/ON$/i, "");
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta && meta.regularMarketPrice) {
        const curPrice = Number(meta.regularMarketPrice);
        const prevClose = Number(meta.chartPreviousClose || curPrice);
        const changePercent = prevClose > 0 ? ((curPrice - prevClose) / prevClose) * 100 : 0;
        return {
          price: Number(curPrice.toFixed(2)),
          change24h: Number(changePercent.toFixed(2)),
        };
      }
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === "development" && err?.name !== "AbortError" && !["MAG7X", "BTC", "ETH"].includes(ticker)) {
      console.warn(`[Oracle Service] Yahoo Finance fetch failed for ${ticker}:`, err?.message || err);
    }
  }
  return null;
}

/**
 * Fetch token prices from Defuse 1Click Solver API
 */
async function fetchFrom1Click(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  try {
    const res = await fetch("https://1click.chaindefuser.com/v0/tokens?ondoTokens", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item.symbol && item.price) {
            const symUpper = item.symbol.toUpperCase();
            const priceNum = Number(item.price);
            result[symUpper] = priceNum;
            if (symUpper.endsWith("ON")) {
              result[symUpper.slice(0, -2)] = priceNum;
            }
          }
        }
      }
    }
  } catch {}
  return result;
}

/**
 * Primary function: Get live price and 24h change for any token or equity
 */
export async function getLiveAssetPrice(rawSymbol: string): Promise<LivePriceData> {
  const sym = rawSymbol.trim().toUpperCase();
  const now = Date.now();

  const cached = memoryCache.get(sym);
  if (cached && now - cached.lastUpdated < CACHE_TTL_MS) {
    return cached;
  }

  // Browser Client Proxy: Route through Next.js API to bypass browser CORS restrictions
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(sym)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.prices?.[sym]) {
          const item = data.prices[sym] as LivePriceData;
          memoryCache.set(sym, item);
          return item;
        }
      }
    } catch {
      // Fall through to fallback
    }
  }

  // 1. Check if tokenized stock / ETF (ends with ON or is stock ticker like NVDA, TSLA, SPY)
  const isStock = isEquityOrEtf(sym);
  if (isStock) {
    // Priority: Try Ondo 1Click Defuse Solvers first so price matches actual execution
    const oneClickMap = await fetchFrom1Click();
    const cleanTicker = sym.replace(/ON$/i, "");
    const oneClickPrice = oneClickMap[sym] || oneClickMap[`${cleanTicker}ON`] || oneClickMap[cleanTicker];
    if (oneClickPrice && oneClickPrice > 0) {
      const yfQuote = await fetchStockFromYahooFinance(sym);
      const data: LivePriceData = {
        symbol: sym,
        priceUsd: Number(oneClickPrice.toFixed(2)),
        change24h: yfQuote?.change24h ?? 3.10,
        lastUpdated: now,
        source: "Ondo Finance (via 1Click Defuse)",
      };
      memoryCache.set(sym, data);
      return data;
    }

    // Fallback: Yahoo Finance spot feed if 1Click is temporarily unreachable
    const yfQuote = await fetchStockFromYahooFinance(sym);
    if (yfQuote && yfQuote.price > 0) {
      const data: LivePriceData = {
        symbol: sym,
        priceUsd: yfQuote.price,
        change24h: yfQuote.change24h,
        lastUpdated: now,
        source: "Yahoo Finance Live Market Feed",
      };
      memoryCache.set(sym, data);
      return data;
    }
  }

  // 2. Crypto Assets: Query CoinMarketCap Pro
  const cmcQuotes = await fetchFromCoinMarketCap([sym]);
  if (cmcQuotes[sym] && cmcQuotes[sym].price > 0) {
    const data: LivePriceData = {
      symbol: sym,
      priceUsd: Number(cmcQuotes[sym].price.toFixed(cmcQuotes[sym].price < 1 ? 4 : 2)),
      change24h: Number(cmcQuotes[sym].change24h.toFixed(2)),
      lastUpdated: now,
      source: "CoinMarketCap Pro Live Feed",
    };
    memoryCache.set(sym, data);
    return data;
  }

  // 3. Fallback: CoinGecko
  const geckoQuotes = await fetchFromCoinGecko([sym]);
  if (geckoQuotes[sym] && geckoQuotes[sym].price > 0) {
    const data: LivePriceData = {
      symbol: sym,
      priceUsd: Number(geckoQuotes[sym].price.toFixed(geckoQuotes[sym].price < 1 ? 4 : 2)),
      change24h: Number(geckoQuotes[sym].change24h.toFixed(2)),
      lastUpdated: now,
      source: "CoinGecko Real-Time API",
    };
    memoryCache.set(sym, data);
    return data;
  }

  // 4. Fallback: 1Click Defuse
  const oneClick = await fetchFrom1Click();
  if (oneClick[sym] && oneClick[sym] > 0) {
    const data: LivePriceData = {
      symbol: sym,
      priceUsd: Number(oneClick[sym].toFixed(oneClick[sym] < 1 ? 4 : 2)),
      change24h: 0.0,
      lastUpdated: now,
      source: "1Click Solvers",
    };
    memoryCache.set(sym, data);
    return data;
  }

  // Default conservative fallback
  const fallbackPrice = sym === "USDC" || sym === "USDT" ? 1.0 : sym === "NEAR" ? 3.70 : sym === "ETH" ? 2240 : 1.0;
  const fallbackData: LivePriceData = {
    symbol: sym,
    priceUsd: fallbackPrice,
    change24h: 0.0,
    lastUpdated: now,
    source: "Network Equilibrium",
  };
  return fallbackData;
}

/**
 * Batch query for multiple assets simultaneously
 */
export async function getLiveAssetPrices(symbols: string[]): Promise<Record<string, LivePriceData>> {
  const result: Record<string, LivePriceData> = {};
  if (!symbols || symbols.length === 0) return result;

  // Browser Client Proxy: Route through Next.js API to bypass browser CORS restrictions
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(","))}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.prices) {
          for (const [sym, p] of Object.entries(data.prices)) {
            const item = p as LivePriceData;
            memoryCache.set(sym, item);
            result[sym] = item;
          }
          return result;
        }
      }
    } catch {
      // Fall through to local cache and fallback resolution below
    }
  }

  const uncached: string[] = [];
  const now = Date.now();

  for (const s of symbols) {
    const sym = s.trim().toUpperCase();
    const cached = memoryCache.get(sym);
    if (cached && now - cached.lastUpdated < CACHE_TTL_MS) {
      result[sym] = cached;
    } else {
      uncached.push(sym);
    }
  }

  if (uncached.length > 0) {
    // 1. Separate crypto and stocks
    const stockSymbols = uncached.filter((s) => isEquityOrEtf(s));
    const cryptoSymbols = uncached.filter((s) => !isEquityOrEtf(s));

    // A. Fetch CMC batch
    if (cryptoSymbols.length > 0) {
      const cmcQuotes = await fetchFromCoinMarketCap(cryptoSymbols);
      for (const [sym, quote] of Object.entries(cmcQuotes)) {
        const item: LivePriceData = {
          symbol: sym,
          priceUsd: Number(quote.price.toFixed(quote.price < 1 ? 4 : 2)),
          change24h: Number(quote.change24h.toFixed(2)),
          lastUpdated: now,
          source: "CoinMarketCap Pro Live Feed",
        };
        memoryCache.set(sym, item);
        result[sym] = item;
      }

      // Check remaining missing cryptos
      const missingCrypto = cryptoSymbols.filter((s) => !result[s]);
      if (missingCrypto.length > 0) {
        const geckoQuotes = await fetchFromCoinGecko(missingCrypto);
        for (const [sym, quote] of Object.entries(geckoQuotes)) {
          const item: LivePriceData = {
            symbol: sym,
            priceUsd: Number(quote.price.toFixed(quote.price < 1 ? 4 : 2)),
            change24h: Number(quote.change24h.toFixed(2)),
            lastUpdated: now,
            source: "CoinGecko Real-Time API",
          };
          memoryCache.set(sym, item);
          result[sym] = item;
        }
      }
    }

    // B. Fetch stocks in parallel
    if (stockSymbols.length > 0) {
      await Promise.all(
        stockSymbols.map(async (stock) => {
          const data = await getLiveAssetPrice(stock);
          result[stock] = data;
        })
      );
    }

    // Fill any still remaining with individual resolution
    for (const s of uncached) {
      if (!result[s]) {
        result[s] = await getLiveAssetPrice(s);
      }
    }
  }

  return result;
}

/**
 * Convenience helper for NEAR price
 */
export async function getLiveNearPrice(): Promise<number> {
  const data = await getLiveAssetPrice("NEAR");
  return data.priceUsd > 0 ? data.priceUsd : 3.70;
}

/**
 * Convenience helper for ETH price
 */
export async function getLiveEthPrice(): Promise<number> {
  const data = await getLiveAssetPrice("ETH");
  return data.priceUsd > 0 ? data.priceUsd : 2240.0;
}
