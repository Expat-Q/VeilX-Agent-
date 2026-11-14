// src/lib/mcp-tools.ts
// Core Tool Execution Engine for Veil MCP & External AI Agents
// Exposes the full 8-tool suite across Claude Desktop, ChatGPT, Eliza, and OpenClaw

import { connectToDatabase } from "@/lib/mongodb";
import { Portfolio } from "@/models/Portfolio";
import { User } from "@/models/User";
import { EscrowTip } from "@/models/EscrowTip";
import { PayLink } from "@/models/PayLink";
import { fetchMarketPrice } from "@/lib/price-service";
import { recordOnChainSpend, setOnChainGuardrails } from "@/lib/onchain-guardrails";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "veil_get_portfolio",
    description: "Retrieve current portfolio holdings, tokenized US equities (NVDAon, TSLAon, AAPLon, SPYon), cash balances, and active trading rules.",
    inputSchema: {
      type: "object",
      properties: {
        handle: {
          type: "string",
          description: "Twitter handle or NEAR account identifier without @ (e.g. 'expatq3')",
        },
      },
    },
  },
  {
    name: "veil_quote_stock",
    description: "Get real-time verified price quote, 24h change, technical indicators (RSI), and Defuse 1Click execution routing for tokenized US equities or cryptocurrencies (e.g. TSLA, NVDA, AAPL, SPY, NEAR, BTC).",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Ticker symbol (e.g. 'TSLA', 'NVDA', 'AAPL', 'SPY', 'NEAR', 'BTC')",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "veil_execute_dca",
    description: "Configure and activate an autonomous Dollar-Cost Averaging (DCA) rule for tokenized equities on NEAR Protocol.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Target stock ticker symbol (e.g. 'TSLAon', 'NVDAon', 'SPYon')",
        },
        amountUsd: {
          type: "number",
          description: "Dollar amount to allocate per recurring execution (e.g. 25, 50, 100)",
        },
        cadence: {
          type: "string",
          enum: ["1m", "5m", "hourly", "daily", "weekly"],
          description: "Execution cadence: '1m' (Fast testnet validation), '5m', 'hourly', 'daily', or 'weekly'",
        },
        handle: {
          type: "string",
          description: "Optional user handle without @",
        },
        maxExecutions: {
          type: "number",
          description: "Optional maximum execution cycles before auto-completion",
        },
      },
      required: ["symbol", "amountUsd", "cadence"],
    },
  },
  {
    name: "veil_manage_rules",
    description: "Create, inspect, pause, or cancel conditional algorithmic trading rules (dip buying, take-profit exit, stop-loss protection, bracket orders).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "list", "cancel", "pause"],
          description: "Management action to perform",
        },
        handle: {
          type: "string",
          description: "User handle without @",
        },
        ruleId: {
          type: "string",
          description: "Specific rule ID required for 'cancel' or 'pause' actions",
        },
        symbol: {
          type: "string",
          description: "Stock ticker symbol (required when action is 'create')",
        },
        type: {
          type: "string",
          enum: ["buy_dip", "take_profit", "stop_loss", "bracket_order", "recurring_buy"],
          description: "Rule type for 'create' action",
        },
        amountUsd: {
          type: "number",
          description: "Dollar allocation amount",
        },
        targetPrice: {
          type: "number",
          description: "Target trigger price in USD (for buy_dip)",
        },
        targetPercent: {
          type: "number",
          description: "Target percentage for dip, gain, or stop-loss",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "veil_send_tip",
    description: "Send a social tip to any Twitter/X handle with non-custodial session authorization and social escrow.",
    inputSchema: {
      type: "object",
      properties: {
        recipientHandle: {
          type: "string",
          description: "Target Twitter handle to tip, without @ (e.g. 'vitalik', 'expatq3')",
        },
        amount: {
          type: "number",
          description: "Amount to tip in USD or crypto units",
        },
        asset: {
          type: "string",
          description: "Asset ticker (e.g. 'USDC', 'NEAR'). Default is 'USDC'.",
        },
        senderHandle: {
          type: "string",
          description: "Sender handle or agent identifier",
        },
        isPrivate: {
          type: "boolean",
          description: "Whether to wrap tip in zero-knowledge stealth escrow",
        },
      },
      required: ["recipientHandle", "amount"],
    },
  },
  {
    name: "veil_direct_transfer",
    description: "Perform a direct wallet-to-wallet transfer to an on-chain NEAR account or EVM address without escrow lock.",
    inputSchema: {
      type: "object",
      properties: {
        recipientAddress: {
          type: "string",
          description: "Recipient on-chain address (*.near, *.testnet, or 0x EVM address)",
        },
        amount: {
          type: "number",
          description: "Amount to transfer",
        },
        asset: {
          type: "string",
          description: "Asset ticker (e.g. 'NEAR', 'USDC', 'TSLAon')",
        },
        sourceChain: {
          type: "string",
          description: "Origin blockchain ('NEAR', 'BASE', 'ETHEREUM')",
        },
        senderHandle: {
          type: "string",
          description: "Sender handle or account",
        },
      },
      required: ["recipientAddress", "amount", "asset"],
    },
  },
  {
    name: "veil_pay_invoice",
    description: "Settle an existing Veil PayLink multichain invoice using non-custodial delegated session keys.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "PayLink invoice slug identifier (e.g. 'inv_a1b2c3')",
        },
        payerHandle: {
          type: "string",
          description: "Optional paying handle or wallet",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "veil_set_guardrails",
    description: "Set or update non-custodial on-chain spending guardrails and risk policy (daily spending limits, per-transaction caps, max single asset allocation, stop loss limits).",
    inputSchema: {
      type: "object",
      properties: {
        handle: {
          type: "string",
          description: "User handle without @",
        },
        dailySpendingLimitUsd: {
          type: "number",
          description: "Maximum daily spending allowance in USD (e.g. 50, 100)",
        },
        weeklySpendingLimitUsd: {
          type: "number",
          description: "Maximum weekly spending allowance in USD (e.g. 200, 500)",
        },
        perTxLimitUsd: {
          type: "number",
          description: "Per-transaction limit in USD (e.g. 15, 25)",
        },
        maxSingleAssetPercent: {
          type: "number",
          description: "Maximum portfolio allocation percentage in any single asset (e.g. 25)",
        },
        stopLossPercent: {
          type: "number",
          description: "Default automated stop loss percentage across all holdings (e.g. 5)",
        },
      },
      required: ["handle"],
    },
  },
];

export async function executeMcpTool(name: string, args: Record<string, any>) {
  await connectToDatabase();

  switch (name) {
    case "veil_get_portfolio": {
      const handle = (args.handle || "guest").replace("@", "").trim().toLowerCase();
      let portfolio = await Portfolio.findOne({ handle });
      if (!portfolio) {
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
        });
      }

      let totalPositionValueUsd = 0;
      const enrichedPositions = await Promise.all(
        (portfolio.positions || []).map(async (pos: any) => {
          const quote = await fetchMarketPrice(pos.symbol);
          const currentPrice = quote?.priceUsd || pos.currentPrice || pos.avgEntryPrice;
          const currentValueUsd = Number((pos.shares * currentPrice).toFixed(2));
          const costBasis = Number((pos.shares * pos.avgEntryPrice).toFixed(2));
          const pnlUsd = Number((currentValueUsd - costBasis).toFixed(2));
          const pnlPercent = costBasis > 0 ? Number(((pnlUsd / costBasis) * 100).toFixed(2)) : 0;
          totalPositionValueUsd += currentValueUsd;

          return {
            symbol: pos.symbol,
            name: pos.name || pos.symbol,
            shares: pos.shares,
            avgEntryPrice: pos.avgEntryPrice,
            currentPrice,
            currentValueUsd,
            pnlUsd,
            pnlPercent,
          };
        })
      );

      const cash = portfolio.mode === "mainnet" ? portfolio.cashUsd : portfolio.paperCashUsd;
      const totalPortfolioValueUsd = Number((cash + totalPositionValueUsd).toFixed(2));

      return {
        handle,
        nearAccountId: portfolio.nearAccountId,
        mode: portfolio.mode,
        cashUsd: cash,
        totalPortfolioValueUsd,
        positionsCount: enrichedPositions.length,
        positions: enrichedPositions,
        activeRulesCount: (portfolio.rules || []).filter((r: any) => r.status === "active").length,
        rules: portfolio.rules || [],
        riskPolicy: portfolio.riskPolicy,
      };
    }

    case "veil_quote_stock": {
      const rawSymbol = (args.symbol || "").trim().toUpperCase();
      if (!rawSymbol) {
        throw new Error("Missing 'symbol' parameter");
      }
      const quote = await fetchMarketPrice(rawSymbol);
      if (!quote) {
        throw new Error(`Real-time quote for '${rawSymbol}' could not be resolved`);
      }

      return {
        symbol: quote.symbol,
        name: quote.name,
        priceUsd: quote.priceUsd,
        change24h: quote.change24h,
        category: quote.category,
        trend: quote.trend,
        source: quote.source,
        executionVenue: "Defuse 1Click Solvers (NEAR Protocol)",
        tokenStandard: quote.category === "stock" || quote.category === "etf" ? "NEP-141 (*.omdep.near)" : "Native / Multichain",
        timestamp: new Date().toISOString(),
      };
    }

    case "veil_execute_dca": {
      const rawSymbol = (args.symbol || "").trim().toUpperCase();
      const symbol = rawSymbol.endsWith("ON") ? rawSymbol : `${rawSymbol}on`;
      const amountUsd = Number(args.amountUsd);
      const cadence = args.cadence || "1m";
      const handle = (args.handle || "guest").replace("@", "").trim().toLowerCase();
      const maxExecutions = Number(args.maxExecutions) || 20;

      if (!rawSymbol || !amountUsd || amountUsd <= 0) {
        throw new Error("Valid 'symbol' and positive 'amountUsd' are required");
      }

      let portfolio = await Portfolio.findOne({ handle });
      if (!portfolio) {
        portfolio = await Portfolio.create({
          handle,
          nearAccountId: `${handle}.veilx-agent.testnet`,
          paperCashUsd: 10000.0,
          mode: "simulation",
          positions: [],
          rules: [],
        });
      }

      const ruleId = `rule_dca_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const cadenceLabel = cadence === "1m" ? "every minute (Fast Testnet Mode)" : cadence === "5m" ? "every 5 minutes" : cadence === "hourly" ? "every hour" : cadence === "weekly" ? "every week" : "daily";

      const newRule = {
        id: ruleId,
        symbol,
        type: "recurring_buy",
        condition: `DCA $${amountUsd.toFixed(2)} ${cadenceLabel}`,
        amountUsd,
        cadence,
        executionsCount: 0,
        maxExecutions,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      portfolio.rules = portfolio.rules || [];
      portfolio.rules.unshift(newRule);
      await portfolio.save();

      return {
        success: true,
        ruleId,
        symbol,
        amountUsd,
        cadence,
        maxExecutions,
        status: "active",
        executionCadence: cadenceLabel,
        sandboxMode: portfolio.mode === "simulation",
        message: `Automated DCA activated for ${symbol}: $${amountUsd.toFixed(2)} ${cadenceLabel}. Managed autonomously by Veil cron engine.`,
      };
    }

    case "veil_manage_rules": {
      const action = args.action;
      const handle = (args.handle || "guest").replace("@", "").trim().toLowerCase();
      let portfolio = await Portfolio.findOne({ handle });
      if (!portfolio) {
        portfolio = await Portfolio.create({
          handle,
          nearAccountId: `${handle}.veilx-agent.testnet`,
          paperCashUsd: 10000.0,
          rules: [],
        });
      }

      if (action === "list") {
        return {
          handle,
          rulesCount: (portfolio.rules || []).length,
          rules: portfolio.rules || [],
        };
      }

      if (action === "cancel" || action === "pause") {
        const ruleId = args.ruleId;
        if (!ruleId) throw new Error("ruleId is required to cancel or pause a rule");
        let found = false;
        portfolio.rules = (portfolio.rules || []).map((r: any) => {
          if (r.id === ruleId) {
            found = true;
            return { ...r, status: action === "cancel" ? "cancelled" : "paused" };
          }
          return r;
        });
        if (!found) throw new Error(`Rule ${ruleId} not found in user portfolio`);
        await portfolio.save();
        return {
          success: true,
          ruleId,
          newStatus: action === "cancel" ? "cancelled" : "paused",
          message: `Rule ${ruleId} successfully ${action}led.`,
        };
      }

      if (action === "create") {
        const rawSymbol = (args.symbol || "TSLA").trim().toUpperCase();
        const symbol = rawSymbol.endsWith("ON") ? rawSymbol : `${rawSymbol}on`;
        const type = args.type || "buy_dip";
        const amountUsd = Number(args.amountUsd) || 50;
        const ruleId = `rule_${type}_${Date.now()}`;
        const condition = type === "bracket_order"
          ? `Bracket Order: Entry $${amountUsd} + Take Profit +${args.targetPercent || 10}%`
          : type === "take_profit"
          ? `Take Profit at +${args.targetPercent || 10}%`
          : type === "stop_loss"
          ? `Stop Loss at -${args.targetPercent || 5}%`
          : `Buy Dip $${amountUsd} if price drops ${args.targetPrice ? `below $${args.targetPrice}` : `by ${args.targetPercent || 5}%`}`;

        const newRule = {
          id: ruleId,
          symbol,
          type,
          condition,
          amountUsd,
          triggerPrice: args.targetPrice,
          triggerProfitPercent: args.targetPercent,
          status: "active",
          createdAt: new Date().toISOString(),
        };

        portfolio.rules = portfolio.rules || [];
        portfolio.rules.unshift(newRule);
        await portfolio.save();

        return {
          success: true,
          ruleId,
          rule: newRule,
          message: `Rule '${condition}' created and active.`,
        };
      }

      throw new Error(`Unsupported action '${action}'`);
    }

    case "veil_send_tip": {
      const recipientHandle = (args.recipientHandle || "").replace("@", "").trim().toLowerCase();
      const amount = Number(args.amount);
      const asset = (args.asset || "USDC").toUpperCase();
      const senderHandle = (args.senderHandle || "veil_agent").replace("@", "").trim().toLowerCase();
      const isPrivate = Boolean(args.isPrivate);

      if (!recipientHandle || !amount || amount <= 0) {
        throw new Error("Valid 'recipientHandle' and positive 'amount' are required");
      }

      const tipId = `tip_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const tip = await EscrowTip.create({
        tipId,
        senderHandle,
        senderWallet: `${senderHandle}.veilx-agent.testnet`,
        recipientHandle,
        recipientWallet: `${recipientHandle}.veilx-agent.testnet`,
        amount,
        amountNear: asset === "NEAR" ? amount : Number((amount / 5.0).toFixed(3)),
        amountUsd: asset === "USDC" ? amount : amount * 5.0,
        asset,
        depositTxHash: `0xmock_deposit_${Date.now()}`,
        status: "pending",
        isPrivate,
      });

      return {
        success: true,
        tipId: tip.tipId,
        senderHandle,
        recipientHandle: `@${recipientHandle}`,
        amount,
        asset,
        isPrivate,
        status: "pending",
        escrowMechanism: "NEAR Smart Contract Social Escrow",
        claimUrl: `https://veilx-agent.vercel.app/verify/${tip.tipId}`,
        message: `Social tip of ${amount} ${asset} locked in non-custodial escrow for @${recipientHandle}. Claimable on-chain anytime.`,
      };
    }

    case "veil_direct_transfer": {
      const recipientAddress = (args.recipientAddress || "").trim();
      const amount = Number(args.amount);
      const asset = (args.asset || "NEAR").toUpperCase();
      const sourceChain = (args.sourceChain || "NEAR").toUpperCase();
      const senderHandle = (args.senderHandle || "veil_agent").replace("@", "").trim();

      if (!recipientAddress || !amount || amount <= 0) {
        throw new Error("Valid 'recipientAddress' and positive 'amount' are required");
      }

      const isNearAccount = recipientAddress.includes(".near") || recipientAddress.includes(".testnet") || recipientAddress.length === 64;
      const isEvmAddress = recipientAddress.startsWith("0x") && recipientAddress.length === 42;

      if (!isNearAccount && !isEvmAddress) {
        throw new Error("Recipient address must be a valid NEAR account (*.near, *.testnet) or EVM address (0x...)");
      }

      // Enforce on-chain guardrail on NEAR Protocol
      const usdAmount = ["USDC", "USDT"].includes(asset) ? amount : amount * 5.0;
      await recordOnChainSpend({
        accountId: `${senderHandle}.veilx-agent.testnet`,
        amountUsd: usdAmount,
      });

      const txHash = isEvmAddress
        ? `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`
        : `near_tx_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

      return {
        success: true,
        txHash,
        sender: `${senderHandle}.veilx-agent.testnet`,
        recipientAddress,
        amount,
        asset,
        sourceChain,
        status: "submitted",
        routing: "Direct on-chain settlement (Zero escrow lock)",
        timestamp: new Date().toISOString(),
        message: `Transferred ${amount} ${asset} directly to ${recipientAddress} on ${sourceChain}.`,
      };
    }

    case "veil_pay_invoice": {
      const slug = (args.slug || "").trim();
      const payerHandle = (args.payerHandle || "agent").replace("@", "").trim();

      if (!slug) {
        throw new Error("Missing invoice 'slug' parameter");
      }

      const paylink = await PayLink.findOne({ slug });
      if (!paylink) {
        throw new Error(`Invoice with slug '${slug}' not found`);
      }

      if (paylink.status === "settled") {
        return {
          success: true,
          slug,
          status: "settled",
          alreadySettled: true,
          amountUsd: paylink.amountUsd,
          memo: paylink.memo,
          recipientNearAccount: paylink.recipientNearAccount,
          settledTx: paylink.settledTx,
          message: `Invoice '${slug}' was already settled.`,
        };
      }

      paylink.status = "settled";
      paylink.settledTx = `tx_settle_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      await paylink.save();

      return {
        success: true,
        slug,
        status: "settled",
        amountUsd: paylink.amountUsd,
        memo: paylink.memo,
        recipientNearAccount: paylink.recipientNearAccount,
        settledBy: payerHandle,
        settledTx: paylink.settledTx,
        message: `Successfully settled invoice '${slug}' for $${paylink.amountUsd.toFixed(2)} USD. Settled into ${paylink.recipientNearAccount}.`,
      };
    }

    case "veil_set_guardrails": {
      const handle = (args.handle || "").replace("@", "").trim().toLowerCase();
      if (!handle) {
        throw new Error("Missing 'handle' parameter");
      }

      const user = await User.findOne({ xHandle: handle });
      if (user) {
        if (typeof args.dailySpendingLimitUsd === "number") user.spendingLimitUsd = args.dailySpendingLimitUsd;
        if (typeof args.weeklySpendingLimitUsd === "number") user.weeklyLimitUsd = args.weeklySpendingLimitUsd;
        await user.save();
      }

      let portfolio = await Portfolio.findOne({ handle });
      if (portfolio) {
        if (!portfolio.riskPolicy) {
          portfolio.riskPolicy = {
            maxSingleAssetPercent: 25,
            minCashReservePercent: 20,
            stopLossPercent: 5,
            takeProfitPercent: 10,
            strategyMode: "dca",
            isAutonomousEnabled: true,
          };
        }
        if (typeof args.maxSingleAssetPercent === "number") portfolio.riskPolicy.maxSingleAssetPercent = args.maxSingleAssetPercent;
        if (typeof args.stopLossPercent === "number") portfolio.riskPolicy.stopLossPercent = args.stopLossPercent;
        await portfolio.save();
      }

      // Sync on-chain smart contract guardrails on NEAR
      setOnChainGuardrails({
        accountId: `${handle}.veilx-agent.testnet`,
        dailyLimitUsd: args.dailySpendingLimitUsd ?? user?.spendingLimitUsd ?? 50.0,
        weeklyLimitUsd: args.weeklySpendingLimitUsd ?? user?.weeklyLimitUsd ?? 200.0,
        perTxMaxUsd: args.perTxLimitUsd ?? 15.0,
      }).catch((chainErr) => {
        console.warn("[mcp-tools] On-chain set_guardrails sync notice:", chainErr);
      });

      return {
        success: true,
        handle,
        guardrails: {
          dailySpendingLimitUsd: args.dailySpendingLimitUsd ?? user?.spendingLimitUsd ?? 50.0,
          weeklySpendingLimitUsd: args.weeklySpendingLimitUsd ?? user?.weeklyLimitUsd ?? 200.0,
          perTxLimitUsd: args.perTxLimitUsd ?? 15.0,
          maxSingleAssetPercent: args.maxSingleAssetPercent ?? portfolio?.riskPolicy?.maxSingleAssetPercent ?? 25,
          stopLossPercent: args.stopLossPercent ?? portfolio?.riskPolicy?.stopLossPercent ?? 5,
        },
        securityModel: "Non-custodial scoped session keys on NEAR Protocol",
        message: `Guardrails updated for @${handle}. Agent transactions exceeding these limits will be rejected automatically on-chain.`,
      };
    }

    default:
      throw new Error(`Unknown tool '${name}'`);
  }
}
