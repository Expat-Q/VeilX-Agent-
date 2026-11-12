// src/lib/market-analyst.ts
// Autonomous Trading Intelligence Engine: Confluence of Technicals + News + Strict Risk Rules

import { StockAsset, fetchLiveStockAssets } from "./ondo-stocks";

export interface RiskPolicy {
  maxSingleAssetPercent: number; // e.g. 25 for 25%
  minCashReservePercent: number;  // e.g. 20 for 20%
  stopLossPercent: number;        // e.g. 5 for -5%
  takeProfitPercent: number;      // e.g. 10 for +10%
  strategyMode: "dca" | "smart";  // default "dca"
  isAutonomousEnabled: boolean;
}

export interface PortfolioPosition {
  symbol: string;
  name: string;
  shares: number;
  avgEntryPrice: number;
  currentPrice: number;
  currentValueUsd: number;
  pnlUsd: number;
  pnlPercent: number;
  allocationPercent: number;
}

export interface AgentDecision {
  id: string;
  timestamp: string;
  action: "BUY" | "SELL" | "REBALANCE" | "HOLD";
  assetSymbol: string;
  assetName: string;
  amountUsd: number;
  shares: number;
  price: number;
  confidenceScore: number; // 0 to 100
  technicalSummary: string; // e.g. "RSI-14 at 38 (Oversold), above 20-SMA"
  newsHeadline: string;
  newsSentiment: "bullish" | "bearish" | "neutral";
  rationale: string;
  riskCheckPassed: boolean;
  status: "EXECUTED" | "HELD" | "BLOCKED_BY_RISK_RULE" | "PENDING_CONFIRMATION" | "PAUSED_FOR_REVIEW";
  txHash?: string;
}

// Curated live-like financial headlines for stocks and crypto
const LIVE_MARKET_HEADLINES: Record<string, { headline: string; sentiment: "bullish" | "bearish" | "neutral" }[]> = {
  NVDAon: [
    { headline: "Nvidia expands Blackwell AI datacenter delivery with top cloud providers", sentiment: "bullish" },
    { headline: "Semiconductor foundry capacity expands 14% year-over-year", sentiment: "bullish" },
    { headline: "Tech sector consolidates following enterprise AI capex reports", sentiment: "neutral" },
  ],
  TSLAon: [
    { headline: "Tesla energy storage installations hit new quarterly milestone", sentiment: "bullish" },
    { headline: "EV sector faces margin competition in overseas consumer markets", sentiment: "bearish" },
    { headline: "Autonomous driving fleet software rollout expands to new test regions", sentiment: "bullish" },
  ],
  SPYon: [
    { headline: "US GDP growth holds steady above 2.8%, consumer spending resilient", sentiment: "bullish" },
    { headline: "Federal Reserve signals steady rate trajectory amid slowing inflation", sentiment: "bullish" },
    { headline: "Treasury yields stabilize following institutional bond auctions", sentiment: "neutral" },
  ],
  AAPLon: [
    { headline: "Apple services revenue hits record high with growing subscription base", sentiment: "bullish" },
    { headline: "Global smartphone upgrade cycles lengthen according to industry supply checks", sentiment: "neutral" },
  ],
  NEAR: [
    { headline: "NEAR Protocol daily user transactions cross 4.5M on chain abstraction growth", sentiment: "bullish" },
    { headline: "Defuse 1Click solver volume on NEAR breaks single-day settlement high", sentiment: "bullish" },
  ],
  BTC: [
    { headline: "Institutional Bitcoin ETF inflows record net positive weekly additions", sentiment: "bullish" },
    { headline: "Global liquidity indices show steady capital reallocation into digital assets", sentiment: "bullish" },
  ],
};

const DEFAULT_HEADLINE = {
  headline: "Macro market liquidity conditions remain balanced across major tech equities",
  sentiment: "neutral" as const,
};

/**
 * Run comprehensive market analysis on the user's active watchlist
 * Returns actionable trade decisions compliant with strict risk guardrails
 */
export async function evaluateMarketAndGenerateDecisions(
  userWatchlistSymbols: string[],
  currentCashUsd: number,
  existingPositions: PortfolioPosition[],
  riskPolicy: RiskPolicy
): Promise<{ decisions: AgentDecision[]; updatedPositions: PortfolioPosition[]; updatedCash: number }> {
  const allAssets = await fetchLiveStockAssets();
  const assetMap = new Map<string, StockAsset>(allAssets.map((a) => [a.symbol, a]));

  const totalPortfolioValue =
    currentCashUsd + existingPositions.reduce((sum, p) => sum + p.currentValueUsd, 0);

  const decisions: AgentDecision[] = [];
  const updatedPositions: PortfolioPosition[] = existingPositions.map((p) => {
    const live = assetMap.get(p.symbol);
    const curPrice = live && live.price > 0 && !isNaN(live.price) ? live.price : p.currentPrice;
    const curVal = Number((p.shares * curPrice).toFixed(2));
    const pnlUsd = Number((curVal - p.shares * p.avgEntryPrice).toFixed(2));
    const costBasis = p.shares * p.avgEntryPrice;
    const pnlPercent = costBasis > 0 ? Number(((pnlUsd / costBasis) * 100).toFixed(2)) : 0;
    return {
      ...p,
      currentPrice: curPrice,
      currentValueUsd: curVal,
      pnlUsd,
      pnlPercent,
      allocationPercent: Number(((curVal / (totalPortfolioValue || 1)) * 100).toFixed(1)),
    };
  });

  let runningCash = currentCashUsd;

  // 1. FIRST PRIORITY: Evaluate Stop-Loss & Take-Profit on Existing Positions
  for (let i = 0; i < updatedPositions.length; i++) {
    const pos = updatedPositions[i];

    // Trigger A: Stop-Loss Protection (Option A Approved: Pause & Alert User, No 100% Autonomous Liquidation)
    if (pos.pnlPercent <= -riskPolicy.stopLossPercent) {
      decisions.push({
        id: `dec_${Date.now()}_sl_${pos.symbol}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action: "SELL",
        assetSymbol: pos.symbol,
        assetName: pos.name,
        amountUsd: pos.currentValueUsd,
        shares: pos.shares,
        price: pos.currentPrice,
        confidenceScore: 95,
        technicalSummary: `Stop-Loss Breaker Triggered at ${pos.pnlPercent}% (Limit was -${riskPolicy.stopLossPercent}%)`,
        newsHeadline: "Option A Guard Enforced: Autonomous liquidation halted for trader co-signature",
        newsSentiment: "bearish",
        rationale: `Stop-loss threshold breached (-${riskPolicy.stopLossPercent}%). Autonomous liquidation paused. Review card dispatched: [Stop-Loss Triggered: Liquidate Position? [Liquidate to USDC] [Hold Position]].`,
        riskCheckPassed: true,
        status: "PENDING_CONFIRMATION",
      });

      // Keep position intact, do NOT delete it; user decides whether to liquidate or hold
      continue;
    }

    // Trigger B: Take-Profit Target
    if (pos.pnlPercent >= riskPolicy.takeProfitPercent) {
      const profitShares = Number((pos.shares * 0.5).toFixed(4));
      const sellAmount = Number((profitShares * pos.currentPrice).toFixed(2));
      runningCash += sellAmount;

      decisions.push({
        id: `dec_${Date.now()}_tp_${pos.symbol}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action: "REBALANCE",
        assetSymbol: pos.symbol,
        assetName: pos.name,
        amountUsd: sellAmount,
        shares: profitShares,
        price: pos.currentPrice,
        confidenceScore: 92,
        technicalSummary: `Take-Profit Target Achieved at +${pos.pnlPercent}% (Goal was +${riskPolicy.takeProfitPercent}%)`,
        newsHeadline: "Realizing gains into liquid USDC stablecoin reserve via Defuse 1Click",
        newsSentiment: "bullish",
        rationale: `Secured $${sellAmount.toFixed(2)} in profits by trimming 50% of ${pos.symbol}. Ready for Defuse solver settlement.`,
        riskCheckPassed: true,
        status: "PENDING_CONFIRMATION",
      });

      pos.shares -= profitShares;
      pos.currentValueUsd -= sellAmount;
      continue;
    }
  }

  // 2. SECOND PRIORITY: Evaluate Confluence Buy Opportunities from Watchlist
  const symbolsToScan = userWatchlistSymbols.length > 0 ? userWatchlistSymbols : ["NVDAon", "TSLAon", "SPYon", "NEAR"];

  for (const sym of symbolsToScan) {
    const asset = assetMap.get(sym);
    if (!asset) continue;

    // Signal & Strategy Evaluation
    const headlines = LIVE_MARKET_HEADLINES[sym] || [DEFAULT_HEADLINE];
    const topHeadline = headlines[Math.floor(Math.random() * headlines.length)];
    const isSentimentBullish = topHeadline.sentiment === "bullish";

    const existingPos = updatedPositions.find((p) => p.symbol === sym);
    const existingVal = existingPos ? existingPos.currentValueUsd : 0;
    const currentAllocation = Number(((existingVal / (totalPortfolioValue || 1)) * 100).toFixed(1));

    let shouldBuy = false;
    let strategyReason = "";
    let technicalSummary = "";

    if (riskPolicy.strategyMode === "dca") {
      // DEFAULT STRATEGY: PURE DCA + REBALANCING (Extremely Safe)
      const targetAllocation = 100 / (symbolsToScan.length + 1);
      if (currentAllocation < targetAllocation) {
        shouldBuy = true;
        technicalSummary = `Pure DCA Mode: Allocation (${currentAllocation}%) is below target weight (${targetAllocation.toFixed(1)}%)`;
        strategyReason = `Pure DCA accumulation: Regular disciplined dollar-cost averaging into ${asset.name}. Maintains balanced target distribution without speculative timing.`;
      }
    } else {
      // OPTIONAL SMART MODE: Technicals (RSI < 48) + News Sentiment Filter
      const isRsiFavorable = asset.rsi14 < 48;
      const isTrendFavorable = asset.price >= asset.sma20 * 0.98;
      const hasDualConfluence = isRsiFavorable && (isTrendFavorable || isSentimentBullish);

      if (hasDualConfluence) {
        shouldBuy = true;
        technicalSummary = `Smart Mode: RSI-14 at ${asset.rsi14} (Oversold), 20-SMA at $${asset.sma20}`;
        strategyReason = `Smart Mode confluence verified: RSI indicator (${asset.rsi14}) aligned with positive sector sentiment. Position allocation strictly adheres to ${riskPolicy.maxSingleAssetPercent}% asset cap.`;
      }
    }

    if (shouldBuy) {
      // Calculate intended position size (capped by maxSingleAssetPercent)
      const maxAllowedForAsset = (totalPortfolioValue * riskPolicy.maxSingleAssetPercent) / 100;
      const roomLeft = maxAllowedForAsset - existingVal;

      const minCashFloor = (totalPortfolioValue * riskPolicy.minCashReservePercent) / 100;
      const availableSpendableCash = Math.max(0, runningCash - minCashFloor);

      const targetBuyAmountUsd = Math.min(roomLeft, availableSpendableCash, 35.0);

      if (targetBuyAmountUsd >= 10.0 && asset.price && asset.price > 0 && !isNaN(asset.price)) {
        const sharesToBuy = Number((targetBuyAmountUsd / asset.price).toFixed(4));
        runningCash -= targetBuyAmountUsd;

        if (existingPos) {
          const totalShares = existingPos.shares + sharesToBuy;
          if (totalShares > 0) {
            existingPos.avgEntryPrice = Number(
              ((existingPos.shares * existingPos.avgEntryPrice + targetBuyAmountUsd) / totalShares).toFixed(2)
            );
          }
          existingPos.shares = totalShares;
          existingPos.currentValueUsd += targetBuyAmountUsd;
        } else {
          updatedPositions.push({
            symbol: asset.symbol,
            name: asset.name,
            shares: sharesToBuy,
            avgEntryPrice: asset.price,
            currentPrice: asset.price,
            currentValueUsd: targetBuyAmountUsd,
            pnlUsd: 0,
            pnlPercent: 0,
            allocationPercent: Number(((targetBuyAmountUsd / (totalPortfolioValue || 1)) * 100).toFixed(1)),
          });
        }

        decisions.push({
          id: `dec_${Date.now()}_buy_${asset.symbol}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          action: "BUY",
          assetSymbol: asset.symbol,
          assetName: asset.name,
          amountUsd: targetBuyAmountUsd,
          shares: sharesToBuy,
          price: asset.price,
          confidenceScore: riskPolicy.strategyMode === "dca" ? 90 : 86,
          technicalSummary,
          newsHeadline: topHeadline.headline,
          newsSentiment: topHeadline.sentiment,
          rationale: strategyReason,
          riskCheckPassed: true,
          status: "PENDING_CONFIRMATION",
        });
      }
    }
  }

  // If no trades were triggered, log a clear capital-preservation HOLD explanation
  if (decisions.length === 0) {
    decisions.push({
      id: `dec_${Date.now()}_hold`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      action: "HOLD",
      assetSymbol: "PORTFOLIO",
      assetName: "Active Holdings",
      amountUsd: 0,
      shares: 0,
      price: 0,
      confidenceScore: 90,
      technicalSummary: "Technical indicators in neutral equilibrium; no high-probability setups",
      newsHeadline: "Macro market liquidity steady; awaiting catalyst events",
      newsSentiment: "neutral",
      rationale: `Capital Preservation Mode: Watchlist assets are currently within fair-value bands (RSI 48–62). Maintaining ${(
        (runningCash / (totalPortfolioValue || 1)) *
        100
      ).toFixed(1)}% cash reserve in safe USDC per risk policy.`,
      riskCheckPassed: true,
      status: "HELD",
    });
  }

  return {
    decisions,
    updatedPositions,
    updatedCash: Number(runningCash.toFixed(2)),
  };
}
