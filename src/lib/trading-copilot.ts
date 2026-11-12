// src/lib/trading-copilot.ts
// Natural language command parser and execution coordinator for VeilX Trading Terminal

import { StockAsset } from "./ondo-stocks";
import { PortfolioPosition } from "./market-analyst";

export interface TradingRule {
  id: string;
  symbol: string;
  type: "buy_dip" | "take_profit" | "stop_loss" | "recurring_buy" | "bracket_order";
  condition: string;
  triggerPrice?: number;
  triggerProfitPercent?: number;
  amountUsd: number;
  cadence?: "1m" | "5m" | "hourly" | "daily" | "weekly";
  lastTriggeredAt?: string;
  executionsCount?: number;
  maxExecutions?: number;
  status: "active" | "triggered" | "cancelled";
  createdAt: string;
}

export interface OrderHistoryItem {
  id: string;
  ruleId?: string;
  symbol: string;
  type: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  amountUsd: number;
  timestamp: string;
  mode: "simulation" | "mainnet";
  status: "filled" | "cancelled";
}

export interface TradingCopilotAction {
  type: "rule_created" | "rule_cancelled" | "trade_executed" | "portfolio_summary" | "analysis" | "require_confirmation" | "stop_loss_triggered" | "transfer_stock_confirm";
  title: string;
  details: {
    symbol?: string;
    name?: string;
    shares?: number;
    price?: number;
    amountUsd?: number;
    condition?: string;
    txHash?: string;
    ruleId?: string;
    gainPercent?: number;
    netValue?: number;
    cash?: number;
    positionsCount?: number;
    feeUsd?: number;
    maxSlippage?: string;
    routing?: string;
    promptConfirm?: string;
    isStopLoss?: boolean;
    cadence?: string;
    executionsCount?: number;
    recipientAddress?: string;
    transferDetails?: any;
  };
}

export interface CopilotProcessResult {
  reply: string;
  actionCard?: TradingCopilotAction;
  updatedRules?: TradingRule[];
  updatedCash?: number;
  updatedPositions?: PortfolioPosition[];
  newOrder?: OrderHistoryItem;
}

// Normalize stock symbols (e.g. "tsla", "tesla", "tslaon" -> "TSLAon")
function extractSymbol(text: string, liveAssets: StockAsset[]): { symbol: string; asset?: StockAsset } | null {
  const clean = text.toLowerCase();
  
  if (clean.includes("tesla") || clean.includes("tsla")) {
    return { symbol: "TSLAon", asset: liveAssets.find((a) => a.symbol === "TSLAon") };
  }
  if (clean.includes("nvidia") || clean.includes("nvda")) {
    return { symbol: "NVDAon", asset: liveAssets.find((a) => a.symbol === "NVDAon") };
  }
  if (clean.includes("apple") || clean.includes("aapl")) {
    return { symbol: "AAPLon", asset: liveAssets.find((a) => a.symbol === "AAPLon") };
  }
  if (clean.includes("spy") || clean.includes("s&p") || clean.includes("sp500")) {
    return { symbol: "SPYon", asset: liveAssets.find((a) => a.symbol === "SPYon") };
  }
  if (clean.includes("microsoft") || clean.includes("msft")) {
    return { symbol: "MSFTon", asset: liveAssets.find((a) => a.symbol === "MSFTon") };
  }
  if (clean.includes("amazon") || clean.includes("amzn")) {
    return { symbol: "AMZNon", asset: liveAssets.find((a) => a.symbol === "AMZNon") };
  }
  if (clean.includes("google") || clean.includes("googl") || clean.includes("alphabet")) {
    return { symbol: "GOOGLon", asset: liveAssets.find((a) => a.symbol === "GOOGLon") };
  }
  if (clean.includes("near")) {
    return { symbol: "NEAR", asset: liveAssets.find((a) => a.symbol === "NEAR") };
  }
  if (clean.includes("bitcoin") || clean.includes("btc")) {
    return { symbol: "BTC", asset: liveAssets.find((a) => a.symbol === "BTC") };
  }
  if (clean.includes("ethereum") || clean.includes("eth")) {
    return { symbol: "ETH", asset: liveAssets.find((a) => a.symbol === "ETH") };
  }
  if (clean.includes("solana") || clean.includes("sol")) {
    return { symbol: "SOL", asset: liveAssets.find((a) => a.symbol === "SOL") };
  }

  // Generic fallback match
  for (const asset of liveAssets) {
    if (clean.includes(asset.symbol.toLowerCase())) {
      return { symbol: asset.symbol, asset };
    }
  }

  return null;
}

// Extract dollar amounts (e.g. "$100", "100 usd", "100 dollars", or "$100.50")
function extractAmount(text: string): number | null {
  const match = text.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:usd|dollars)?/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

// Extract price targets (e.g. "below $340", "under 340", "< 340")
function extractPriceTarget(text: string): number | null {
  const match = text.match(/(?:below|under|drops below|dips below|<|at|target)\s*\$?([0-9]+(?:\.[0-9]+)?)/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

// Extract percentage targets (e.g. "10%", "+10%", "5 percent")
function extractPercentage(text: string): number | null {
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:%|percent)/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

export function processTradingInstruction(
  input: string,
  portfolio: {
    cashUsd: number;
    positions: PortfolioPosition[];
    rules: TradingRule[];
  },
  liveAssets: StockAsset[]
): CopilotProcessResult {
  const text = input.trim();
  const lower = text.toLowerCase();

  // 1. QUERY: PORTFOLIO SUMMARY / HOLDINGS
  if (
    lower.includes("portfolio") ||
    lower.includes("holdings") ||
    lower.includes("balance") ||
    lower === "summary"
  ) {
    const invested = portfolio.positions.reduce((sum, p) => sum + p.currentValueUsd, 0);
    const total = portfolio.cashUsd + invested;
    return {
      reply: `Your total portfolio net value is $${total.toFixed(2)}. You hold $${portfolio.cashUsd.toFixed(2)} in liquid USDC and $${invested.toFixed(2)} across ${portfolio.positions.length} active positions.`,
      actionCard: {
        type: "portfolio_summary",
        title: "Portfolio Summary",
        details: {
          netValue: total,
          cash: portfolio.cashUsd,
          positionsCount: portfolio.positions.length,
        },
      },
    };
  }

  // 2. QUERY: ACTIVE RULES
  if (
    (lower.includes("rules") || lower.includes("active rules") || lower.includes("what rules")) &&
    !lower.includes("buy") &&
    !lower.includes("sell")
  ) {
    const active = portfolio.rules.filter((r) => r.status === "active");
    if (active.length === 0) {
      return {
        reply: "You currently have no active automated rules. You can create one by saying 'Buy $100 TSLA when it dips below $340' or 'Take profit on NVDA at +10%'.",
      };
    }
    const ruleBullets = active.map((r) => `• ${r.symbol}: ${r.condition} ($${r.amountUsd.toFixed(2)})`).join("\n");
    return {
      reply: `You currently have ${active.length} active automated rule${active.length > 1 ? "s" : ""}:\n${ruleBullets}\n\nI am actively monitoring the price feed on NEAR/Defuse.`,
    };
  }

  // 3. CANCEL RULE
  if (lower.includes("cancel") || lower.includes("remove rule") || lower.includes("delete rule")) {
    const match = extractSymbol(text, liveAssets);
    if (match) {
      const activeRules = portfolio.rules.filter((r) => r.symbol === match.symbol && r.status === "active");
      if (activeRules.length > 0) {
        const cancelledId = activeRules[0].id;
        const updatedRules = portfolio.rules.map((r) => (r.id === cancelledId ? { ...r, status: "cancelled" as const } : r));
        return {
          reply: `I have cancelled your active automated rule for ${match.symbol}.`,
          actionCard: {
            type: "rule_cancelled",
            title: `Rule Cancelled: ${match.symbol}`,
            details: {
              symbol: match.symbol,
              ruleId: cancelledId,
            },
          },
          updatedRules,
        };
      }
    }
    // Cancel first active if no symbol specified
    const firstActive = portfolio.rules.find((r) => r.status === "active");
    if (firstActive) {
      const updatedRules = portfolio.rules.map((r) => (r.id === firstActive.id ? { ...r, status: "cancelled" as const } : r));
      return {
        reply: `Cancelled automated rule: ${firstActive.symbol} (${firstActive.condition}).`,
        actionCard: {
          type: "rule_cancelled",
          title: `Rule Cancelled: ${firstActive.symbol}`,
          details: {
            symbol: firstActive.symbol,
            ruleId: firstActive.id,
          },
        },
        updatedRules,
      };
    }
    return {
      reply: "There are no matching active rules to cancel.",
    };
  }

  // 4. DCA / RECURRING BUY RULE
  // e.g. "dca $50 into tsla daily", "recurring buy $20 eth every hour", "dca $10 spy every minute"
  if (
    lower.includes("dca") ||
    lower.includes("dollar cost") ||
    lower.includes("recurring") ||
    lower.includes("every day") ||
    lower.includes("daily") ||
    lower.includes("every hour") ||
    lower.includes("hourly") ||
    lower.includes("every week") ||
    lower.includes("weekly") ||
    lower.includes("every minute") ||
    lower.includes("1m")
  ) {
    const match = extractSymbol(text, liveAssets);
    if (!match) {
      return {
        reply: "Which asset would you like to set up a DCA schedule for? (e.g. TSLA, NVDA, AAPL, ETH, NEAR).",
      };
    }

    const amount = extractAmount(text) || 50.0;
    let cadence: "1m" | "5m" | "hourly" | "daily" | "weekly" = "daily";
    if (lower.includes("1m") || lower.includes("minute")) cadence = "1m";
    else if (lower.includes("5m") || lower.includes("5 min")) cadence = "5m";
    else if (lower.includes("hour")) cadence = "hourly";
    else if (lower.includes("week")) cadence = "weekly";

    const cadenceLabel =
      cadence === "1m"
        ? "every minute (Fast Testnet/Sandbox Mode)"
        : cadence === "5m"
        ? "every 5 minutes"
        : cadence === "hourly"
        ? "every hour"
        : cadence === "weekly"
        ? "every week"
        : "daily";

    const currentPrice = match.asset ? match.asset.price : 100.0;
    if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
      return {
        reply: `Price feed unavailable for ${match.symbol}. Please try again once market oracle quotes are online.`,
      };
    }
    const canExecuteInitial = portfolio.cashUsd >= amount;
    const shares = canExecuteInitial ? Number((amount / currentPrice).toFixed(4)) : 0;
    let nextCash = portfolio.cashUsd;
    let nextPositions = [...portfolio.positions];
    let newOrder: OrderHistoryItem | undefined = undefined;

    if (canExecuteInitial) {
      nextCash = Number((portfolio.cashUsd - amount).toFixed(2));
      const posIdx = nextPositions.findIndex((p) => p.symbol === match.symbol);
      if (posIdx >= 0) {
        const existing = nextPositions[posIdx];
        const totalShares = Number((existing.shares + shares).toFixed(4));
        const totalCost = existing.shares * existing.avgEntryPrice + amount;
        const newAvg = Number((totalCost / totalShares).toFixed(2));
        nextPositions[posIdx] = {
          ...existing,
          shares: totalShares,
          avgEntryPrice: newAvg,
          currentPrice,
          currentValueUsd: Number((totalShares * currentPrice).toFixed(2)),
          pnlUsd: Number(((currentPrice - newAvg) * totalShares).toFixed(2)),
          pnlPercent: Number((((currentPrice - newAvg) / newAvg) * 100).toFixed(2)),
        };
      } else {
        nextPositions.push({
          symbol: match.symbol,
          name: match.asset?.name || match.symbol,
          shares,
          avgEntryPrice: currentPrice,
          currentPrice,
          currentValueUsd: amount,
          pnlUsd: 0,
          pnlPercent: 0,
          allocationPercent: 10,
        });
      }

      newOrder = {
        id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        symbol: match.symbol,
        type: "recurring_buy",
        side: "buy",
        shares,
        price: currentPrice,
        amountUsd: amount,
        timestamp: new Date().toISOString(),
        mode: "simulation",
        status: "filled",
      };
    }

    const newRule: TradingRule = {
      id: `rule_dca_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: match.symbol,
      type: "recurring_buy",
      condition: `DCA $${amount.toFixed(2)} ${cadenceLabel}`,
      amountUsd: amount,
      cadence,
      executionsCount: canExecuteInitial ? 1 : 0,
      lastTriggeredAt: canExecuteInitial ? new Date().toISOString() : undefined,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    const updatedRules = [newRule, ...portfolio.rules];

    return {
      reply: canExecuteInitial
        ? `Automated DCA Active: Initial purchase of ${shares} shares of ${match.symbol} filled for $${amount.toFixed(
            2
          )} USD at $${currentPrice.toFixed(
            2
          )}. Cash deducted and holdings updated. Next recurring buy will execute ${cadenceLabel}.`
        : `Automated DCA Rule Activated: Scheduled to buy $${amount.toFixed(
            2
          )} of ${match.symbol} ${cadenceLabel} as soon as liquid cash is available.`,
      actionCard: {
        type: canExecuteInitial ? "trade_executed" : "rule_created",
        title: `DCA Active: ${match.symbol} ($${amount.toFixed(2)} ${cadence})`,
        details: {
          symbol: match.symbol,
          name: match.asset?.name || match.symbol,
          shares: canExecuteInitial ? shares : undefined,
          price: canExecuteInitial ? currentPrice : undefined,
          amountUsd: amount,
          condition: `DCA $${amount.toFixed(2)} ${cadenceLabel}`,
          cadence,
          ruleId: newRule.id,
        },
      },
      updatedCash: nextCash,
      updatedPositions: nextPositions,
      updatedRules,
      newOrder,
    };
  }

  // 4B. CHAINED BRACKET ORDER (BUY NOW + AUTO TAKE-PROFIT EXIT)
  // e.g. "buy $50 tsla now and take profit at +10%", "buy $100 tsla with 10% take profit", "buy $50 tsla and take profit at 10%"
  if (
    (lower.includes("buy") || lower.includes("long")) &&
    (lower.includes("take profit") || lower.includes("tp") || lower.includes("profit at"))
  ) {
    const match = extractSymbol(text, liveAssets);
    if (!match) {
      return {
        reply: "Please specify an asset for the bracket order (e.g. TSLA, NVDA, AAPL, SPY, ETH, NEAR).",
      };
    }

    const amount = extractAmount(text) || 50.0;
    const currentPrice = match.asset ? match.asset.price : 100.0;
    if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
      return {
        reply: `Price feed unavailable for ${match.symbol}. Please try again once market oracle quotes are online.`,
      };
    }
    if (portfolio.cashUsd < amount) {
      return {
        reply: `Insufficient liquid cash. You need $${amount.toFixed(2)} USD but hold $${portfolio.cashUsd.toFixed(2)}.`,
      };
    }

    const shares = Number((amount / currentPrice).toFixed(4));
    const percent = extractPercentage(text) || 10.0;
    const targetExitPrice = Number((currentPrice * (1 + percent / 100)).toFixed(2));
    const nextCash = Number((portfolio.cashUsd - amount).toFixed(2));

    // Deduct cash and add position immediately
    let nextPositions = [...portfolio.positions];
    const existingIdx = nextPositions.findIndex((p) => p.symbol === match.symbol);
    if (existingIdx >= 0) {
      const existing = nextPositions[existingIdx];
      const totalShares = Number((existing.shares + shares).toFixed(4));
      const totalCost = existing.shares * existing.avgEntryPrice + amount;
      const newAvg = Number((totalCost / totalShares).toFixed(2));
      nextPositions[existingIdx] = {
        ...existing,
        shares: totalShares,
        avgEntryPrice: newAvg,
        currentPrice,
        currentValueUsd: Number((totalShares * currentPrice).toFixed(2)),
        pnlUsd: Number(((currentPrice - newAvg) * totalShares).toFixed(2)),
        pnlPercent: Number((((currentPrice - newAvg) / newAvg) * 100).toFixed(2)),
      };
    } else {
      nextPositions.push({
        symbol: match.symbol,
        name: match.asset?.name || match.symbol,
        shares,
        avgEntryPrice: currentPrice,
        currentPrice,
        currentValueUsd: amount,
        pnlUsd: 0,
        pnlPercent: 0,
        allocationPercent: 10,
      });
    }

    // Arm the linked Take-Profit exit rule targeting entry + percent%
    const tpRule: TradingRule = {
      id: `rule_tp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: match.symbol,
      type: "take_profit",
      condition: `Sell when gain reaches +${percent}% (target $${targetExitPrice.toFixed(2)})`,
      triggerProfitPercent: percent,
      triggerPrice: targetExitPrice,
      amountUsd: amount,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    const newOrder: OrderHistoryItem = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: match.symbol,
      type: "bracket_entry_buy",
      side: "buy",
      shares,
      price: currentPrice,
      amountUsd: amount,
      timestamp: new Date().toISOString(),
      mode: "simulation",
      status: "filled",
    };

    const updatedRules = [tpRule, ...portfolio.rules];

    return {
      reply: `Bracket Order Executed: Bought ${shares} shares of ${match.symbol} for $${amount.toFixed(
        2
      )} USD at $${currentPrice.toFixed(
        2
      )}. Cash deducted, holdings updated, and automated Take-Profit exit rule armed at +${percent}% (target $${targetExitPrice.toFixed(
        2
      )}).`,
      actionCard: {
        type: "trade_executed",
        title: `Bracket Order: ${match.symbol} Entry + Exit TP (+${percent}%)`,
        details: {
          symbol: match.symbol,
          name: match.asset?.name || match.symbol,
          shares,
          price: currentPrice,
          amountUsd: amount,
          gainPercent: percent,
          condition: `Take Profit at $${targetExitPrice.toFixed(2)} (+${percent}%)`,
          ruleId: tpRule.id,
        },
      },
      updatedCash: nextCash,
      updatedPositions: nextPositions,
      updatedRules,
      newOrder,
    };
  }

  // 5. CONDITIONAL BUY (Dip Buying / Limit Rule)
  // e.g. "buy $100 tsla when price drops below $340", "buy tsla on 3% dip"
  if (
    lower.includes("buy") &&
    (lower.includes("when") ||
      lower.includes("if") ||
      lower.includes("below") ||
      lower.includes("drops") ||
      lower.includes("dips") ||
      lower.includes("under") ||
      lower.includes("dip"))
  ) {
    const match = extractSymbol(text, liveAssets);
    if (!match) {
      return {
        reply: "Please specify an asset for the dip-buying rule (e.g., TSLA, NVDA, AAPL, SPY, NEAR).",
      };
    }

    const currentPrice = match.asset ? match.asset.price : 100.0;
    const targetPrice = extractPriceTarget(text) || Number((currentPrice * 0.96).toFixed(2));
    const amount = extractAmount(text) || 100.0;

    const newRule: TradingRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: match.symbol,
      type: "buy_dip",
      condition: `Buy $${amount.toFixed(2)} if price drops below $${targetPrice.toFixed(2)}`,
      triggerPrice: targetPrice,
      amountUsd: amount,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    const updatedRules = [newRule, ...portfolio.rules];

    return {
      reply: `Automated rule created: I am now monitoring ${match.symbol} (current price: $${currentPrice.toFixed(2)}). When it drops below $${targetPrice.toFixed(2)}, I will automatically execute a $${amount.toFixed(2)} buy order on NEAR/Defuse.`,
      actionCard: {
        type: "rule_created",
        title: `Rule Active: ${match.symbol}`,
        details: {
          symbol: match.symbol,
          name: match.asset?.name || match.symbol,
          amountUsd: amount,
          price: targetPrice,
          condition: `Buy below $${targetPrice.toFixed(2)}`,
          ruleId: newRule.id,
        },
      },
      updatedRules,
    };
  }

  // 5. CONDITIONAL SELL / TAKE-PROFIT RULE
  // e.g. "take profit on nvda at +10%", "sell tsla when up 15%", "sell when profit reaches 10%"
  if (
    lower.includes("take profit") ||
    lower.includes("profit") ||
    (lower.includes("sell") && (lower.includes("when") || lower.includes("if") || lower.includes("up") || lower.includes("gain")))
  ) {
    const match = extractSymbol(text, liveAssets);
    if (!match) {
      return {
        reply: "Please specify which asset you want to set a take-profit rule for (e.g. NVDA, TSLA, AAPL, SPY).",
      };
    }

    const percent = extractPercentage(text) || 10.0;
    const currentPrice = match.asset ? match.asset.price : 100.0;
    const targetPrice = Number((currentPrice * (1 + percent / 100)).toFixed(2));

    const newRule: TradingRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: match.symbol,
      type: "take_profit",
      condition: `Sell when gain reaches +${percent}% (target $${targetPrice.toFixed(2)})`,
      triggerProfitPercent: percent,
      triggerPrice: targetPrice,
      amountUsd: 100.0,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    const updatedRules = [newRule, ...portfolio.rules];

    return {
      reply: `Take-profit rule activated for ${match.symbol}. When the asset reaches +${percent}% (approx $${targetPrice.toFixed(2)}), I will automatically harvest profits and rebalance into liquid USDC.`,
      actionCard: {
        type: "rule_created",
        title: `Take-Profit: ${match.symbol} (+${percent}%)`,
        details: {
          symbol: match.symbol,
          name: match.asset?.name || match.symbol,
          gainPercent: percent,
          price: targetPrice,
          condition: `Sell on +${percent}% gain`,
          ruleId: newRule.id,
        },
      },
      updatedRules,
    };
  }

  // 6. INSTANT ONE-CLICK BUY
  // e.g. "buy $50 aapl", "buy aapl 50"
  if (lower.startsWith("buy") || (lower.includes("buy") && !lower.includes("sell"))) {
    const match = extractSymbol(text, liveAssets);
    if (!match) {
      return {
        reply: "Which asset would you like to buy? Supported assets include NVDA, TSLA, AAPL, SPY, MSFT, AMZN, NEAR, BTC, ETH, and SOL.",
      };
    }

    const amount = extractAmount(text) || 50.0;
    if (portfolio.cashUsd < amount) {
      return {
        reply: `Insufficient liquid USDC balance. You have $${portfolio.cashUsd.toFixed(2)} available.`,
      };
    }

    const price = match.asset ? match.asset.price : 100.0;
    if (!price || price <= 0 || isNaN(price)) {
      return {
        reply: `Price feed unavailable for ${match.symbol}. Please try again once market oracle quotes are online.`,
      };
    }
    const sharesBought = Number((amount / price).toFixed(4));
    const isConfirmed = lower.includes("confirm");

    // Zero-Cost Deterministic Policy Gate: Orders > $250 require interactive confirmation card
    if (amount > 250 && !isConfirmed) {
      return {
        reply: `Deterministic Safety Gate: Order size ($${amount.toFixed(2)}) exceeds instant execution threshold ($250.00). Co-signature confirmation required:`,
        actionCard: {
          type: "require_confirmation",
          title: `Confirm Buy: ${match.symbol}`,
          details: {
            symbol: match.symbol,
            shares: sharesBought,
            price,
            amountUsd: amount,
            feeUsd: 0.04,
            maxSlippage: "1.0%",
            routing: "Defuse 1Click Solver Intent",
            promptConfirm: `buy $${amount} ${match.symbol} confirm`,
          },
        },
      };
    }

    if (!isConfirmed) {
      return {
        reply: `Trade Intent Generated: Buy ${sharesBought} ${match.symbol} for $${amount.toFixed(2)} at $${price.toFixed(2)} via Defuse 1Click Solver on NEAR. Please confirm to sign and broadcast:`,
        actionCard: {
          type: "require_confirmation",
          title: `Confirm Buy: ${match.symbol}`,
          details: {
            symbol: match.symbol,
            shares: sharesBought,
            price,
            amountUsd: amount,
            feeUsd: 0.04,
            maxSlippage: "1.0%",
            routing: "Defuse 1Click Solver (NEAR NEP-141)",
            promptConfirm: `buy $${amount} ${match.symbol} confirmed`,
          },
        },
      };
    }

    const newCash = Number((portfolio.cashUsd - amount).toFixed(2));

    // Update positions
    const existingIndex = portfolio.positions.findIndex((p) => p.symbol === match.symbol);
    let newPositions: PortfolioPosition[] = [];

    if (existingIndex >= 0) {
      newPositions = portfolio.positions.map((p, idx) => {
        if (idx !== existingIndex) return p;
        const newShares = Number((p.shares + sharesBought).toFixed(4));
        const newTotalVal = Number((newShares * price).toFixed(2));
        return {
          ...p,
          shares: newShares,
          currentPrice: price,
          currentValueUsd: newTotalVal,
        };
      });
    } else {
      newPositions = [
        ...portfolio.positions,
        {
          symbol: match.symbol,
          name: match.asset?.name || match.symbol,
          shares: sharesBought,
          avgEntryPrice: price,
          currentPrice: price,
          currentValueUsd: amount,
          pnlUsd: 0,
          pnlPercent: 0,
          allocationPercent: 10,
        },
      ];
    }

    return {
      reply: `Trade Executed: Bought ${sharesBought} ${match.symbol} for $${amount.toFixed(2)} at $${price.toFixed(2)} via Defuse 1Click Solver on NEAR. Position updated.`,
      actionCard: {
        type: "trade_executed",
        title: `Trade Executed: ${match.symbol}`,
        details: {
          symbol: match.symbol,
          shares: sharesBought,
          price,
          amountUsd: amount,
          feeUsd: 0.04,
          maxSlippage: "1.0%",
          routing: "Defuse 1Click Solver (NEAR NEP-141)",
        },
      },
      updatedCash: newCash,
      updatedPositions: newPositions,
    };
  }

  // 7. INSTANT ONE-CLICK SELL
  // e.g. "sell $50 tsla", "sell all nvda"
  if (lower.startsWith("sell")) {
    const match = extractSymbol(text, liveAssets);
    if (!match) {
      return {
        reply: "Which asset would you like to sell? (e.g. TSLA, NVDA, AAPL, SPY, NEAR)",
      };
    }

    const position = portfolio.positions.find((p) => p.symbol === match.symbol);
    if (!position || position.shares <= 0) {
      return {
        reply: `You do not have any open shares of ${match.symbol} to sell.`,
      };
    }

    const isAll = lower.includes("all");
    const amount = isAll ? position.currentValueUsd : Math.min(extractAmount(text) || position.currentValueUsd, position.currentValueUsd);
    const price = match.asset ? match.asset.price : position.currentPrice;
    if (!price || price <= 0 || isNaN(price)) {
      return {
        reply: `Price feed unavailable for ${match.symbol}. Please try again once market oracle quotes are online.`,
      };
    }
    const sharesSold = Number((amount / price).toFixed(4));
    const isConfirmed = lower.includes("confirm");

    // Zero-Cost Deterministic Policy Gate: Orders > $250 require interactive confirmation card
    if (amount > 250 && !isConfirmed) {
      return {
        reply: `Deterministic Safety Gate: Sell order size ($${amount.toFixed(2)}) exceeds instant execution threshold ($250.00). Co-signature confirmation required:`,
        actionCard: {
          type: "require_confirmation",
          title: `Confirm Sell: ${match.symbol}`,
          details: {
            symbol: match.symbol,
            shares: sharesSold,
            price,
            amountUsd: amount,
            feeUsd: 0.04,
            maxSlippage: "1.0%",
            routing: "Defuse 1Click Solver Intent",
            promptConfirm: `sell $${amount} ${match.symbol} confirm`,
          },
        },
      };
    }

    if (!isConfirmed) {
      return {
        reply: `Trade Intent Generated: Sell ${sharesSold} ${match.symbol} for $${amount.toFixed(2)} USDC via Defuse 1Click Solver. Please confirm to sign and settle:`,
        actionCard: {
          type: "require_confirmation",
          title: `Confirm Sell: ${match.symbol}`,
          details: {
            symbol: match.symbol,
            shares: sharesSold,
            price,
            amountUsd: amount,
            feeUsd: 0.04,
            maxSlippage: "1.0%",
            routing: "Defuse 1Click Solver (Liquid USDC Settlement)",
            promptConfirm: `sell $${amount} ${match.symbol} confirmed`,
          },
        },
      };
    }

    const newCash = Number((portfolio.cashUsd + amount).toFixed(2));

    const newPositions = portfolio.positions
      .map((p) => {
        if (p.symbol !== match.symbol) return p;
        const remShares = Number(Math.max(0, p.shares - sharesSold).toFixed(4));
        return {
          ...p,
          shares: remShares,
          currentPrice: price,
          currentValueUsd: Number((remShares * price).toFixed(2)),
        };
      })
      .filter((p) => p.shares > 0);

    return {
      reply: `Trade Executed: Sold ${sharesSold} ${match.symbol} for $${amount.toFixed(2)} USDC via Defuse 1Click Solver. Position updated.`,
      actionCard: {
        type: "trade_executed",
        title: `Trade Executed: ${match.symbol}`,
        details: {
          symbol: match.symbol,
          shares: sharesSold,
          price,
          amountUsd: amount,
          feeUsd: 0.04,
          maxSlippage: "1.0%",
          routing: "Defuse 1Click Solver (Liquid USDC Settlement)",
        },
      },
      updatedCash: newCash,
      updatedPositions: newPositions,
    };
  }

  // 8. TECHNICAL / OUTLOOK ANALYSIS
  if (lower.includes("analyze") || lower.includes("outlook") || lower.includes("price") || lower.includes("rsi")) {
    const match = extractSymbol(text, liveAssets);
    const asset = match?.asset || liveAssets[0];
    if (asset) {
      return {
        reply: `${asset.name} (${asset.symbol}) is currently trading at $${asset.price.toFixed(2)} (${asset.change24h >= 0 ? "+" : ""}${asset.change24h}% 24h). RSI-14 is at ${asset.rsi14} and 20-SMA is at $${asset.sma20.toFixed(2)}. Trend outlook: ${asset.trend.toUpperCase()}.`,
        actionCard: {
          type: "analysis",
          title: `Market Outlook: ${asset.symbol}`,
          details: {
            symbol: asset.symbol,
            name: asset.name,
            price: asset.price,
          },
        },
      };
    }
  }

  // 9. GENERAL / HELP FALLBACK
  return {
    reply: "I can execute conditional automated rules and live orders for you. Try saying:\n• 'Buy $100 TSLA when it drops below $340'\n• 'Take profit on NVDA at +10%'\n• 'Buy $50 AAPL now'\n• 'Show my portfolio' or 'List active rules'",
  };
}

export interface EvaluationResult {
  hasChanges: boolean;
  triggeredRules: TradingRule[];
  executedOrders: OrderHistoryItem[];
  updatedRules: TradingRule[];
  updatedCash: number;
  updatedPositions: PortfolioPosition[];
}

export function evaluateTradingRules(
  rules: TradingRule[],
  liveAssets: StockAsset[],
  portfolio: {
    cashUsd: number;
    positions: PortfolioPosition[];
    orderHistory?: OrderHistoryItem[];
  },
  mode: "simulation" | "mainnet" = "simulation"
): EvaluationResult {
  let updatedCash = portfolio.cashUsd;
  let updatedPositions = [...portfolio.positions];
  let updatedRules = [...rules];
  const triggeredRules: TradingRule[] = [];
  const executedOrders: OrderHistoryItem[] = [];
  const now = Date.now();

  for (let i = 0; i < updatedRules.length; i++) {
    const rule = updatedRules[i];
    if (rule.status !== "active") continue;

    const asset = liveAssets.find((a) => a.symbol.toLowerCase() === rule.symbol.toLowerCase());
    if (!asset || !asset.price || asset.price <= 0) continue;
    const currentPrice = asset.price;

    // 1. RECURRING BUY / DCA
    if (rule.type === "recurring_buy") {
      const isOneMin = rule.cadence === "1m" || (rule.condition && (rule.condition.toLowerCase().includes("1m") || rule.condition.toLowerCase().includes("minute")));
      let cadenceMs = 24 * 60 * 60 * 1000; // default 1 day
      if (isOneMin) cadenceMs = 60 * 1000;
      else if (rule.cadence === "5m") cadenceMs = 5 * 60 * 1000;
      else if (rule.cadence === "hourly") cadenceMs = 60 * 60 * 1000;
      else if (rule.cadence === "weekly") cadenceMs = 7 * 24 * 60 * 60 * 1000;

      // Check maxExecutions cap
      if (rule.maxExecutions && (rule.executionsCount || 0) >= rule.maxExecutions) {
        updatedRules[i] = { ...rule, status: "triggered" };
        continue;
      }

      const hasRunBefore = (rule.executionsCount || 0) > 0 || Boolean(rule.lastTriggeredAt);
      const lastRun = rule.lastTriggeredAt
        ? new Date(rule.lastTriggeredAt).getTime()
        : 0;

      // Trigger if interval elapsed OR if initial buy hasn't been executed yet
      if (!hasRunBefore || (now - lastRun >= cadenceMs)) {
        if (updatedCash >= rule.amountUsd) {
          const sharesBought = Number((rule.amountUsd / currentPrice).toFixed(4));
          updatedCash = Number((updatedCash - rule.amountUsd).toFixed(2));

          const posIdx = updatedPositions.findIndex((p) => p.symbol.toLowerCase() === rule.symbol.toLowerCase());
          if (posIdx >= 0) {
            const existing = updatedPositions[posIdx];
            const totalShares = Number((existing.shares + sharesBought).toFixed(4));
            const totalCost = existing.shares * existing.avgEntryPrice + rule.amountUsd;
            const newAvg = Number((totalCost / totalShares).toFixed(2));
            updatedPositions[posIdx] = {
              ...existing,
              shares: totalShares,
              avgEntryPrice: newAvg,
              currentPrice,
              currentValueUsd: Number((totalShares * currentPrice).toFixed(2)),
              pnlUsd: Number(((currentPrice - newAvg) * totalShares).toFixed(2)),
              pnlPercent: Number((((currentPrice - newAvg) / newAvg) * 100).toFixed(2)),
            };
          } else {
            updatedPositions.push({
              symbol: rule.symbol,
              name: asset.name || rule.symbol,
              shares: sharesBought,
              avgEntryPrice: currentPrice,
              currentPrice,
              currentValueUsd: rule.amountUsd,
              pnlUsd: 0,
              pnlPercent: 0,
              allocationPercent: 10,
            });
          }

          const newExecCount = (rule.executionsCount || 0) + 1;
          const isComplete = Boolean(rule.maxExecutions && newExecCount >= rule.maxExecutions);
          const updatedRule: TradingRule = {
            ...rule,
            lastTriggeredAt: new Date(now).toISOString(),
            executionsCount: newExecCount,
            status: isComplete ? "triggered" : rule.status,
          };
          updatedRules[i] = updatedRule;
          triggeredRules.push(updatedRule);

          executedOrders.push({
            id: `ord_${now}_${Math.random().toString(36).substring(2, 6)}`,
            ruleId: rule.id,
            symbol: rule.symbol,
            type: "recurring_buy",
            side: "buy",
            shares: sharesBought,
            price: currentPrice,
            amountUsd: rule.amountUsd,
            timestamp: new Date(now).toISOString(),
            mode,
            status: "filled",
          });
        }
      }
      continue;
    }

    // 2. BUY DIP (Limit buy)
    if (rule.type === "buy_dip") {
      if (rule.triggerPrice && currentPrice <= rule.triggerPrice) {
        if (updatedCash >= rule.amountUsd) {
          const sharesBought = Number((rule.amountUsd / currentPrice).toFixed(4));
          updatedCash = Number((updatedCash - rule.amountUsd).toFixed(2));

          const posIdx = updatedPositions.findIndex((p) => p.symbol.toLowerCase() === rule.symbol.toLowerCase());
          if (posIdx >= 0) {
            const existing = updatedPositions[posIdx];
            const totalShares = Number((existing.shares + sharesBought).toFixed(4));
            const totalCost = existing.shares * existing.avgEntryPrice + rule.amountUsd;
            const newAvg = Number((totalCost / totalShares).toFixed(2));
            updatedPositions[posIdx] = {
              ...existing,
              shares: totalShares,
              avgEntryPrice: newAvg,
              currentPrice,
              currentValueUsd: Number((totalShares * currentPrice).toFixed(2)),
              pnlUsd: Number(((currentPrice - newAvg) * totalShares).toFixed(2)),
              pnlPercent: Number((((currentPrice - newAvg) / newAvg) * 100).toFixed(2)),
            };
          } else {
            updatedPositions.push({
              symbol: rule.symbol,
              name: asset.name || rule.symbol,
              shares: sharesBought,
              avgEntryPrice: currentPrice,
              currentPrice,
              currentValueUsd: rule.amountUsd,
              pnlUsd: 0,
              pnlPercent: 0,
              allocationPercent: 10,
            });
          }

          const triggeredRule: TradingRule = {
            ...rule,
            status: "triggered",
            lastTriggeredAt: new Date(now).toISOString(),
            executionsCount: (rule.executionsCount || 0) + 1,
          };
          updatedRules[i] = triggeredRule;
          triggeredRules.push(triggeredRule);

          executedOrders.push({
            id: `ord_${now}_${Math.random().toString(36).substring(2, 6)}`,
            ruleId: rule.id,
            symbol: rule.symbol,
            type: "buy_dip",
            side: "buy",
            shares: sharesBought,
            price: currentPrice,
            amountUsd: rule.amountUsd,
            timestamp: new Date(now).toISOString(),
            mode,
            status: "filled",
          });
        }
      }
      continue;
    }

    // 3. TAKE PROFIT
    if (rule.type === "take_profit") {
      const pos = updatedPositions.find((p) => p.symbol.toLowerCase() === rule.symbol.toLowerCase());
      if (pos && pos.shares > 0) {
        const gainPercent = ((currentPrice - pos.avgEntryPrice) / pos.avgEntryPrice) * 100;
        const isTriggered =
          (rule.triggerProfitPercent !== undefined && gainPercent >= rule.triggerProfitPercent) ||
          (rule.triggerPrice !== undefined && currentPrice >= rule.triggerPrice);

        if (isTriggered) {
          const sellAmount = Number((pos.shares * currentPrice).toFixed(2));
          updatedCash = Number((updatedCash + sellAmount).toFixed(2));
          updatedPositions = updatedPositions.filter((p) => p.symbol.toLowerCase() !== rule.symbol.toLowerCase());

          const triggeredRule: TradingRule = {
            ...rule,
            status: "triggered",
            lastTriggeredAt: new Date(now).toISOString(),
            executionsCount: (rule.executionsCount || 0) + 1,
          };
          updatedRules[i] = triggeredRule;
          triggeredRules.push(triggeredRule);

          executedOrders.push({
            id: `ord_${now}_${Math.random().toString(36).substring(2, 6)}`,
            ruleId: rule.id,
            symbol: rule.symbol,
            type: "take_profit",
            side: "sell",
            shares: pos.shares,
            price: currentPrice,
            amountUsd: sellAmount,
            timestamp: new Date(now).toISOString(),
            mode,
            status: "filled",
          });
        }
      }
      continue;
    }

    // 4. STOP LOSS
    if (rule.type === "stop_loss") {
      const pos = updatedPositions.find((p) => p.symbol.toLowerCase() === rule.symbol.toLowerCase());
      if (pos && pos.shares > 0) {
        const targetLoss = Math.abs(rule.triggerProfitPercent || 0);
        const lossPercent = ((pos.avgEntryPrice - currentPrice) / pos.avgEntryPrice) * 100;
        const isTriggered =
          (targetLoss > 0 && lossPercent >= targetLoss) ||
          (rule.triggerPrice !== undefined && rule.triggerPrice > 0 && currentPrice <= rule.triggerPrice);

        if (isTriggered) {
          const sellAmount = Number((pos.shares * currentPrice).toFixed(2));
          updatedCash = Number((updatedCash + sellAmount).toFixed(2));
          updatedPositions = updatedPositions.filter((p) => p.symbol.toLowerCase() !== rule.symbol.toLowerCase());

          const triggeredRule: TradingRule = {
            ...rule,
            status: "triggered",
            lastTriggeredAt: new Date(now).toISOString(),
            executionsCount: (rule.executionsCount || 0) + 1,
          };
          updatedRules[i] = triggeredRule;
          triggeredRules.push(triggeredRule);

          executedOrders.push({
            id: `ord_${now}_${Math.random().toString(36).substring(2, 6)}`,
            ruleId: rule.id,
            symbol: rule.symbol,
            type: "stop_loss",
            side: "sell",
            shares: pos.shares,
            price: currentPrice,
            amountUsd: sellAmount,
            timestamp: new Date(now).toISOString(),
            mode,
            status: "filled",
          });
        }
      }
    }
  }

  return {
    hasChanges: executedOrders.length > 0,
    triggeredRules,
    executedOrders,
    updatedRules,
    updatedCash,
    updatedPositions,
  };
}
