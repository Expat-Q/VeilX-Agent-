// src/services/balance-service.ts
// Unified Multi-Chain Token Registry & Balance Service for Veil
// Single source of truth for Dashboard, Chat Agent, and Header

export interface NormalizedTokenHolding {
  id: string;
  chainId: number | string;
  chainName: string;
  networkSlug: string; // 'base' | 'arbitrum' | 'ethereum' | 'near'
  symbol: string;
  name: string;
  contractAddress?: string;
  isNative: boolean;
  balance: string; // Formatted display string e.g. "70.00"
  numericBalance: number;
  usdPrice: number;
  valueUsd: number;
  explorerUrl: string;
}

export interface PortfolioBalanceSnapshot {
  nearAccountId: string;
  evmAddress: string;
  nearBalance: string;
  nearUsd: number;
  totalEvmUsd: number;
  totalLiquidUsd: number;
  holdings: NormalizedTokenHolding[];
  timestamp: number;
}

let cachedSnapshot: PortfolioBalanceSnapshot | null = null;
const CACHE_TTL_MS = 12_000; // 12 seconds snappy cache

export async function getUnifiedPortfolioBalances(
  nearAccountId: string,
  forceRefresh = false
): Promise<PortfolioBalanceSnapshot> {
  const now = Date.now();
  if (!forceRefresh && cachedSnapshot && cachedSnapshot.nearAccountId === nearAccountId && (now - cachedSnapshot.timestamp) < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  // 1. Fetch EVM balances from multi-RPC endpoint
  let evmAddress = "";
  let rawEvmHoldings: any[] = [];
  let totalEvmUsd = 0;

  try {
    const res = await fetch(`/api/evm/balance?accountId=${encodeURIComponent(nearAccountId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        evmAddress = json.data.address || "";
        rawEvmHoldings = json.data.holdings || [];
        totalEvmUsd = typeof json.data.totalEvmUsd === "number" ? json.data.totalEvmUsd : 0;
      }
    }
  } catch (err) {
    console.warn("[balance-service] EVM balance fetch error:", err);
  }

  // 2. Normalize EVM Holdings into unified format
  const normalizedHoldings: NormalizedTokenHolding[] = [];

  for (const h of rawEvmHoldings) {
    const balNum = parseFloat(h.balance) || 0;
    const networkLower = (h.network || "").toLowerCase();

    let networkSlug = "ethereum";
    if (networkLower.includes("base")) networkSlug = "base";
    else if (networkLower.includes("arbitrum") || networkLower.includes("arb")) networkSlug = "arbitrum";
    else if (networkLower.includes("optimism") || networkLower.includes("op")) networkSlug = "optimism";
    else if (networkLower.includes("polygon") || networkLower.includes("amoy")) networkSlug = "polygon";

    normalizedHoldings.push({
      id: `evm_${h.chainId}_${h.symbol}`,
      chainId: h.chainId,
      chainName: h.network,
      networkSlug,
      symbol: h.symbol,
      name: h.name,
      contractAddress: h.contractAddress,
      isNative: Boolean(h.isNative),
      balance: h.balance,
      numericBalance: balNum,
      usdPrice: h.usdPrice || 1.0,
      valueUsd: h.valueUsd || Number((balNum * (h.usdPrice || 1)).toFixed(2)),
      explorerUrl: h.explorerUrl || "",
    });
  }

  // 3. Read NEAR balance and NEP-141 tokens from sessionStorage
  let nearBalStr = "0.00";
  let nearTokensList: any[] = [];
  if (typeof window !== "undefined") {
    nearBalStr = sessionStorage.getItem("veil_cached_near_balance") || "0.00";
    try {
      const savedTokens = sessionStorage.getItem("veil_cached_near_tokens");
      if (savedTokens) nearTokensList = JSON.parse(savedTokens);
    } catch {}
  }
  const nearNum = parseFloat(nearBalStr) || 0;
  const nearUsd = Number((nearNum * 3.75).toFixed(2));
  let nearTokensUsd = 0;

  // Add NEP-141 tokens on NEAR (e.g. USDC, USDT)
  if (Array.isArray(nearTokensList)) {
    for (const t of nearTokensList) {
      if ((t.numericBalance || 0) > 0) {
        const val = Number((t.valueUsd || (t.numericBalance * (t.usdPrice || 1))).toFixed(2));
        nearTokensUsd += val;
        normalizedHoldings.unshift({
          id: `near_${t.symbol.toLowerCase()}`,
          chainId: "near-testnet",
          chainName: "NEAR Protocol",
          networkSlug: "near",
          symbol: t.symbol,
          name: t.name || `${t.symbol} (NEAR)`,
          contractAddress: t.contractAddress,
          isNative: false,
          balance: t.balance || String(t.numericBalance),
          numericBalance: t.numericBalance,
          usdPrice: t.usdPrice || 1.0,
          valueUsd: val,
          explorerUrl: `https://testnet.nearblocks.io/address/${nearAccountId}`,
        });
      }
    }
  }

  // Add NEAR native holding
  normalizedHoldings.unshift({
    id: "near_native",
    chainId: "near-testnet",
    chainName: "NEAR Protocol",
    networkSlug: "near",
    symbol: "NEAR",
    name: "NEAR Protocol",
    isNative: true,
    balance: nearNum.toFixed(4),
    numericBalance: nearNum,
    usdPrice: 3.75,
    valueUsd: nearUsd,
    explorerUrl: `https://testnet.nearblocks.io/address/${nearAccountId}`,
  });

  const totalLiquid = Number((totalEvmUsd + nearUsd + nearTokensUsd).toFixed(2));

  const snapshot: PortfolioBalanceSnapshot = {
    nearAccountId,
    evmAddress,
    nearBalance: nearBalStr,
    nearUsd,
    totalEvmUsd,
    totalLiquidUsd: totalLiquid,
    holdings: normalizedHoldings,
    timestamp: now,
  };

  cachedSnapshot = snapshot;
  return snapshot;
}

// Helper to query available balance for a specific chain & asset
export function getChainAssetBalance(
  snapshot: PortfolioBalanceSnapshot | null,
  chainSlug: string,
  assetSymbol: string
): { balance: number; formatted: string } {
  if (!snapshot) return { balance: 0, formatted: "0.00" };

  const targetAsset = assetSymbol.toUpperCase();
  const targetChain = chainSlug.toLowerCase();

  const holding = snapshot.holdings.find(
    (h) => h.networkSlug === targetChain && h.symbol.toUpperCase() === targetAsset
  );

  if (holding) {
    return { balance: holding.numericBalance, formatted: holding.balance };
  }

  return { balance: 0, formatted: "0.00" };
}
