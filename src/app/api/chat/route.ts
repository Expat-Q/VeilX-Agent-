import { NextResponse } from "next/server";
import { processUserMessage, routeHybridAI, isFinancialQuery } from "@/lib/ai-gateway";
import { resolveIntentValue } from "@/lib/near-price";
import { fetchMarketPrice } from "@/lib/price-service";
import { getLiveNearPrice } from "@/lib/oracle-service";

const SOCIAL_SYSTEM_INSTRUCTION = `You are VeilX Agent, an intelligent, conversational autonomous social finance copilot on NEAR Protocol. You converse naturally, warmly, interactively, and helpfully just like ChatGPT or Claude.

Core Guidelines & Behavior:
1. Multi-Turn Interactive Context: Maintain full conversational context. When the user provides follow-up answers (e.g. specifying an amount like "$0.5" or "0.01 NEAR", or confirming an action like "create a paylink"), connect them directly with previous turns instead of asking from scratch.
2. Invoicing & PayLinks: Users can request invoices in USD, USDC, or native crypto like NEAR (e.g. "create a 0.01 Near invoice for @expatq3 for testing", "invoice 10 NEAR", "create invoice $25"). Always accept crypto amounts (NEAR) and call create_invoice with the amount and asset. NEVER reject crypto denominations or tell users the amount must be in USD.
3. Direct Transfers vs Social Escrow: Target on-chain addresses (*.testnet, *.near, 0x...) execute via direct_transfer (0 escrow). Social handles (@handle) execute via tip_handle (social escrow).
4. Token & Stock Prices: When the user asks for the price of any cryptocurrency (NEAR, BTC, ETH, SOL) or tokenized equity (TSLA, NVDA, AAPL, SPY), call get_market_price to provide verified, real-time live market quotes.
5. Natural Conversational Style: Speak cleanly and professionally. Never leak internal raw schema names to the user.
6. Typography & Formatting: Strictly never output emojis (no warning signs, sparkles, robots, etc.). Format itemized capabilities and overviews cleanly as standard markdown bullet lists with bold titles.
7. Dedicated Scope: You are strictly the Social Finance copilot. Do NOT push stock trading rules or tokenized equity terminal commands here.`;

const TERMINAL_SYSTEM_INSTRUCTION = `You are VeilX Trading Copilot, an institutional-grade stock and algorithmic trading assistant specialized exclusively in Tokenized US Equities (Ondo Finance on NEAR: TSLAon, NVDAon, AAPLon, MSFTon, AMZNon, GOOGLon, METAon, SPYon, QQQon) via Defuse 1Click solvers.

Core Guidelines & Behavior:
1. Pure Trading & Equities Scope: You specialize exclusively in tokenized equities, conditional automated trading rules (dip buying, take profit, stop loss), Dollar Cost Averaging (DCA), bracket orders (buy and auto take-profit), portfolio tracking, on-chain tokenized stock transfers, real-time stock quotes, and technical analysis (RSI, moving averages).
2. Never Mention Social Features: Strictly NEVER mention or offer social tipping, invoicing, PayLinks, claiming social tips, or social faucets. You are purely a Wall Street and Web3 stock trading terminal copilot.
3. Capabilities: When asked what you can do or how to help, list your trading capabilities:
   - **Automated Trading Rules:** Set conditional dip-buying ("Buy $100 TSLA when it drops below $340"), take-profit ("Take profit on NVDA at +10%"), stop-loss, or Dollar Cost Averaging (DCA).
   - **Dollar Cost Averaging (DCA):** Execute recurring purchases (e.g. "DCA $50 into TSLA every minute" [1m Fast Testnet demonstration], daily, hourly, or weekly). ALWAYS accept 1-minute (1m) DCA commands!
   - **Chained Bracket Orders:** Execute instant market entry with linked automated exit rules (e.g. "Buy $100 TSLA now and take profit at +10%").
   - **Market Orders:** Execute instant buy/sell orders on NEAR via Defuse 1Click solvers.
   - **On-Chain Stock Transfers:** Tokenized equities on NEAR are standard NEP-141 fungible tokens (*.omdep.near). They can be transferred peer-to-peer to any NEAR wallet (*.near, *.testnet). Call transfer_stock when asked to send or transfer shares.
   - **Live Stock & Crypto Prices:** Query real-time prices, 24h performance, and technical RSI indicators.
   - **Portfolio Tracking:** View your active positions, liquid cash, and rule status.
4. Tool Calling:
   - Call trade_stock for instant manual market buy/sell orders without attached exit rules.
   - Call create_trading_rule for:
     * Recurring DCA: type: "recurring_buy", symbol, amountUsd, cadence ("1m", "5m", "hourly", "daily", "weekly"). NOTE: 1m is fully supported for rapid testnet validation!
     * Chained Bracket Orders: type: "bracket_order", symbol, amountUsd, takeProfitPercent (e.g. 10), and optional stopLossPercent.
     * Conditional Dip-Buying: type: "buy_dip", symbol, amountUsd, targetPrice or targetPercent.
     * Exit Take-Profit: type: "take_profit", symbol, targetPercent.
     * Stop-Loss: type: "stop_loss", symbol, targetPercent.
   - Call transfer_stock when the user wants to transfer or send tokenized stock shares to another NEAR wallet (*.near, *.testnet).
   - Call get_portfolio to inspect holdings.
   - Call get_market_price for stock and token prices.
5. Typography & Formatting: Strictly never output emojis. Speak analytically, concisely, and professionally.`;

const MARKET_PRICE_TOOL_DECLARATION = {
  name: "get_market_price",
  description: "Fetch the real-time market price, 24h change, and technical indicators for any cryptocurrency (NEAR, BTC, ETH, SOL) or tokenized stock (TSLAon, NVDAon, AAPLon, SPYon)",
  parameters: {
    type: "OBJECT",
    properties: {
      symbol: {
        type: "STRING",
        description: "Ticker symbol (e.g. 'NEAR', 'BTC', 'ETH', 'TSLA', 'NVDA', 'AAPL', 'SPY')",
      },
    },
    required: ["symbol"],
  },
};

const SOCIAL_GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "tip_handle",
        description: "Send a social tip to an X (Twitter) handle via NEAR scoped session key",
        parameters: {
          type: "OBJECT",
          properties: {
            recipientHandle: {
              type: "STRING",
              description: "The X handle to tip, without @ (e.g. 'vitalik', 'expatq3')",
            },
            amount: {
              type: "NUMBER",
              description: "Amount to tip",
            },
            asset: {
              type: "STRING",
              description: "Asset ticker (default 'USDC')",
            },
            sourceChain: {
              type: "STRING",
              description: "Funding source network: 'BASE', 'NEAR', 'ETHEREUM', or 'ARBITRUM' (default 'NEAR' or 'BASE' if requested)",
            },
          },
          required: ["recipientHandle", "amount"],
        },
      },
      {
        name: "direct_transfer",
        description: "Send a direct wallet-to-wallet transfer to an on-chain NEAR or EVM/Solana address (e.g. *.testnet, *.near, 0x...) bypassing social escrow",
        parameters: {
          type: "OBJECT",
          properties: {
            recipientAddress: {
              type: "STRING",
              description: "The recipient on-chain wallet address (e.g. 'bob.testnet', 'alice.near', '0x...')",
            },
            amount: {
              type: "NUMBER",
              description: "Amount to transfer",
            },
            asset: {
              type: "STRING",
              description: "Asset ticker (e.g. 'NEAR', 'USDC')",
            },
            sourceChain: {
              type: "STRING",
              description: "Source funding chain (e.g. 'BASE', 'NEAR')",
            },
          },
          required: ["recipientAddress", "amount"],
        },
      },
      {
        name: "create_invoice",
        description: "Generate a universal multichain PayLink / payment invoice that settles directly into the user's NEAR wallet. Accepts amounts in USD, USDC, or native crypto like NEAR (e.g. 0.01 NEAR, 10 NEAR, $50).",
        parameters: {
          type: "OBJECT",
          properties: {
            amount: {
              type: "NUMBER",
              description: "Amount requested. Can be in USD or native crypto like NEAR (e.g. 0.01, 10, 50).",
            },
            asset: {
              type: "STRING",
              description: "Asset currency: 'NEAR', 'USDC', 'USD'. Defaults to 'USD' if dollar amount or unspecified.",
            },
            memo: {
              type: "STRING",
              description: "Description or purpose of the invoice (e.g. 'testing', 'Web Design')",
            },
            recipientHandle: {
              type: "STRING",
              description: "Optional target client X handle without @ (e.g. 'expatq3')",
            },
          },
          required: ["amount"],
        },
      },
      {
        name: "pay_invoice",
        description: "Pay and settle an existing invoice or PayLink using user's delegated session key",
        parameters: {
          type: "OBJECT",
          properties: {
            slug: {
              type: "STRING",
              description: "Invoice identifier slug (e.g. 'inv_abc123')",
            },
            amountUsd: {
              type: "NUMBER",
              description: "Amount in USD if specified",
            },
          },
          required: ["slug"],
        },
      },
      {
        name: "claim_funds",
        description: "Claim pending social tips from NEAR Escrow gaslessly via NEP-366 Meta-Transactions",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
      {
        name: "check_balance",
        description: "Check the user's omnichain wallet balances (NEAR Protocol and Base Sepolia EVM via NEAR Chain Signatures MPC) and active session spending cap",
        parameters: {
          type: "OBJECT",
          properties: {
            chain: {
              type: "STRING",
              description: "The chain to inspect ('base', 'near', or 'all')",
            },
          },
        },
      },
      {
        name: "faucet",
        description: "Claim 0.25 free testnet NEAR tokens from the VeilX Faucet to test payments and transactions",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
      {
        name: "execute_cross_chain_intent",
        description: "Formulate a cross-chain swap or transfer across NEAR, Base, Arbitrum, Solana, Ethereum, Optimism, Polygon, or BSC using NEAR Intents Defuse 1Click solvers",
        parameters: {
          type: "OBJECT",
          properties: {
            amount: { type: "NUMBER", description: "Amount of asset to deliver or spend" },
            targetAsset: { type: "STRING", description: "Asset to deliver (e.g. USDC, USDT, NEAR, SOL, ETH)" },
            targetChain: { type: "STRING", description: "Target blockchain (e.g. BASE, SOLANA, ARBITRUM, OPTIMISM, ETHEREUM)" },
            recipient: { type: "STRING", description: "Recipient handle or on-chain address" },
            sourceAsset: { type: "STRING", description: "Source asset to spend (default 'NEAR')" },
          },
          required: ["amount", "targetAsset", "targetChain", "recipient"],
        },
      },
      MARKET_PRICE_TOOL_DECLARATION,
    ],
  },
];

const TERMINAL_GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "trade_stock",
        description: "Execute or prepare a market order to buy or sell tokenized US equities (e.g. NVDAon, TSLAon, AAPLon, SPYon) on NEAR via Defuse 1Click solvers",
        parameters: {
          type: "OBJECT",
          properties: {
            symbol: {
              type: "STRING",
              description: "The stock ticker symbol (e.g. 'TSLA', 'TSLAon', 'NVDA', 'NVDAon', 'AAPL', 'SPY')",
            },
            action: {
              type: "STRING",
              description: "Trade action: 'buy' or 'sell'",
            },
            amountUsd: {
              type: "NUMBER",
              description: "Dollar amount to trade (e.g. 50, 100)",
            },
          },
          required: ["symbol", "action", "amountUsd"],
        },
      },
      {
        name: "create_trading_rule",
        description: "Set an automated trading rule: recurring DCA purchases ('recurring_buy' or 'dca'), chained entry buy + take profit ('bracket_order'), conditional dip-buy ('buy_dip'), take-profit exit ('take_profit'), or stop-loss ('stop_loss')",
        parameters: {
          type: "OBJECT",
          properties: {
            symbol: {
              type: "STRING",
              description: "The stock ticker symbol (e.g. 'TSLA', 'TSLAon', 'NVDA', 'NVDAon', 'AAPLon')",
            },
            type: {
              type: "STRING",
              description: "Rule type: 'recurring_buy' or 'dca' (for dollar-cost averaging), 'bracket_order' (for buy + take profit), 'buy_dip', 'take_profit', or 'stop_loss'",
            },
            cadence: {
              type: "STRING",
              description: "Cadence for recurring_buy (DCA): '1m' (1-minute fast testnet demo), '5m', 'hourly', 'daily', or 'weekly'",
            },
            takeProfitPercent: {
              type: "NUMBER",
              description: "Target gain percentage for take-profit exit or bracket order (e.g. 10 for +10%)",
            },
            stopLossPercent: {
              type: "NUMBER",
              description: "Target loss percentage for stop-loss protection (e.g. 5 for -5%)",
            },
            targetPrice: {
              type: "NUMBER",
              description: "Target trigger price in USD (e.g. 340, 207.50)",
            },
            targetPercent: {
              type: "NUMBER",
              description: "Target dip or gain percentage (e.g. 5, 10)",
            },
            amountUsd: {
              type: "NUMBER",
              description: "Dollar amount to allocate when rule triggers or executes (e.g. 50, 100)",
            },
          },
          required: ["symbol", "type"],
        },
      },
      {
        name: "transfer_stock",
        description: "Transfer tokenized US equities (e.g. TSLAon, NVDAon, AAPLon) on-chain to any NEAR wallet address (*.near, *.testnet) via standard NEP-141 ft_transfer",
        parameters: {
          type: "OBJECT",
          properties: {
            symbol: {
              type: "STRING",
              description: "The stock ticker symbol (e.g. 'TSLA', 'TSLAon', 'NVDAon')",
            },
            shares: {
              type: "NUMBER",
              description: "Number of shares to transfer",
            },
            amountUsd: {
              type: "NUMBER",
              description: "Dollar value of shares to transfer (optional alternative to shares)",
            },
            recipientAddress: {
              type: "STRING",
              description: "Recipient on-chain NEAR account address (e.g. 'bob.testnet', 'alice.near')",
            },
          },
          required: ["symbol", "recipientAddress"],
        },
      },
      {
        name: "get_portfolio",
        description: "View user's current tokenized stock holdings, cash balance, and active trading rules",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
      MARKET_PRICE_TOOL_DECLARATION,
    ],
  },
];

const MARKET_PRICE_OPENAI_TOOL = {
  type: "function" as const,
  function: {
    name: "get_market_price",
    description: "Fetch the real-time market price, 24h change, and technical indicators for any cryptocurrency (NEAR, BTC, ETH, SOL) or tokenized stock (TSLAon, NVDAon, AAPLon, SPYon)",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol (e.g. NEAR, BTC, ETH, TSLA, NVDA, AAPL, SPY)" },
      },
      required: ["symbol"],
    },
  },
};

const SOCIAL_OPENAI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "tip_handle",
      description: "Send a social tip to an X (Twitter) handle via NEAR scoped session key",
      parameters: {
        type: "object",
        properties: {
          recipientHandle: { type: "string", description: "The X handle without @" },
          amount: { type: "number", description: "Amount in USD" },
          asset: { type: "string", description: "Asset ticker (e.g. USDC)" },
        },
        required: ["recipientHandle", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "direct_transfer",
      description: "Send a direct wallet-to-wallet transfer to an on-chain NEAR or EVM/Solana address bypassing social escrow",
      parameters: {
        type: "object",
        properties: {
          recipientAddress: { type: "string", description: "The recipient on-chain wallet address (e.g. bob.testnet, 0x...)" },
          amount: { type: "number", description: "Amount to transfer" },
          asset: { type: "string", description: "Asset ticker (e.g. NEAR, USDC)" },
        },
        required: ["recipientAddress", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_invoice",
      description: "Generate a universal multichain PayLink that settles directly into the user's NEAR wallet. Accepts amounts in USD, USDC, or native crypto like NEAR.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount requested in USD or crypto like NEAR" },
          asset: { type: "string", description: "Asset currency: NEAR, USDC, or USD" },
          memo: { type: "string", description: "Memo or purpose" },
          recipientHandle: { type: "string", description: "Optional client handle without @" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pay_invoice",
      description: "Pay and settle an existing invoice / PayLink using user's delegated session key",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Invoice identifier slug (e.g. inv_123)" },
          amountUsd: { type: "number", description: "Amount in USD" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "claim_funds",
      description: "Claim pending tips gaslessly via NEP-366",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_balance",
      description: "Check the user's omnichain wallet balances (NEAR Protocol and Base Sepolia EVM via NEAR Chain Signatures MPC) and daily spending limit",
      parameters: {
        type: "object",
        properties: {
          chain: { type: "string", description: "The chain to inspect ('base', 'near', or 'all')" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "faucet",
      description: "Claim 0.25 free testnet NEAR tokens from VeilX Faucet to test payments",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "execute_cross_chain_intent",
      description: "Formulate a cross-chain swap or transfer across NEAR, Base, Arbitrum, Solana, Ethereum, Optimism, Polygon, or BSC using NEAR Intents Defuse 1Click solvers",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount of asset to deliver or spend" },
          targetAsset: { type: "string", description: "Asset to deliver (e.g. USDC, USDT, NEAR, SOL, ETH)" },
          targetChain: { type: "string", description: "Target blockchain (e.g. BASE, SOLANA, ARBITRUM, OPTIMISM, ETHEREUM)" },
          recipient: { type: "string", description: "Recipient handle or on-chain address" },
          sourceAsset: { type: "string", description: "Source asset to spend (default NEAR)" },
        },
        required: ["amount", "targetAsset", "targetChain", "recipient"],
      },
    },
  },
  MARKET_PRICE_OPENAI_TOOL,
];

const TERMINAL_OPENAI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "trade_stock",
      description: "Execute or prepare a market order to buy or sell tokenized US equities (e.g. NVDAon, TSLAon, AAPLon, SPYon) on NEAR via Defuse 1Click solvers",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker symbol (e.g. TSLAon, NVDAon, AAPLon)" },
          action: { type: "string", description: "Trade action: 'buy' or 'sell'" },
          amountUsd: { type: "number", description: "Dollar amount to trade" },
        },
        required: ["symbol", "action", "amountUsd"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_trading_rule",
      description: "Set an automated trading rule: recurring DCA purchases ('recurring_buy' or 'dca'), chained entry buy + take profit ('bracket_order'), conditional dip-buy ('buy_dip'), take-profit exit ('take_profit'), or stop-loss ('stop_loss')",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker symbol (e.g. TSLAon, NVDAon, AAPLon)" },
          type: { type: "string", description: "Rule type: 'recurring_buy' or 'dca' (DCA), 'bracket_order' (buy + take profit), 'buy_dip', 'take_profit', or 'stop_loss'" },
          cadence: { type: "string", description: "Cadence for recurring_buy (DCA): '1m', '5m', 'hourly', 'daily', or 'weekly'" },
          takeProfitPercent: { type: "number", description: "Target gain percentage for take-profit exit or bracket order (e.g. 10)" },
          stopLossPercent: { type: "number", description: "Target loss percentage for stop-loss protection (e.g. 5)" },
          targetPrice: { type: "number", description: "Target trigger price in USD" },
          targetPercent: { type: "number", description: "Target dip or gain percentage" },
          amountUsd: { type: "number", description: "Dollar amount to allocate when triggered or executed" },
        },
        required: ["symbol", "type"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "transfer_stock",
      description: "Transfer tokenized US equities (e.g. TSLAon, NVDAon, AAPLon) on-chain to another NEAR wallet (*.near, *.testnet) via standard NEP-141 ft_transfer",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker (e.g. TSLAon, NVDAon)" },
          shares: { type: "number", description: "Number of shares to transfer" },
          amountUsd: { type: "number", description: "Dollar amount of stock to transfer" },
          recipientAddress: { type: "string", description: "Recipient NEAR wallet address (e.g. bob.testnet, alice.near)" },
        },
        required: ["symbol", "recipientAddress"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_portfolio",
      description: "View user's current tokenized stock holdings, cash balance, and active trading rules",
      parameters: { type: "object", properties: {} },
    },
  },
  MARKET_PRICE_OPENAI_TOOL,
];

function buildGeminiContents(
  history: { role: string; content: string }[],
  currentMessage: string
) {
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];

  for (const item of history) {
    if (!item.content || !item.content.trim()) continue;
    const role: "user" | "model" = item.role === "assistant" ? "model" : "user";
    if (contents.length === 0 && role === "model") continue;

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += "\n" + item.content.trim();
    } else {
      contents.push({ role, parts: [{ text: item.content.trim() }] });
    }
  }

  if (contents.length > 0 && contents[contents.length - 1].role === "user") {
    contents.push({ role: "model", parts: [{ text: "Understood. Please continue." }] });
  }
  contents.push({ role: "user", parts: [{ text: currentMessage.trim() }] });

  return contents;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message,
      history = [],
      customApiKey,
      provider = "gemini",
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    const mode = body.mode || "social";
    const isTerminal = mode === "terminal";
    const selectedInstruction = isTerminal ? TERMINAL_SYSTEM_INSTRUCTION : SOCIAL_SYSTEM_INSTRUCTION;
    const selectedGeminiTools = isTerminal ? TERMINAL_GEMINI_TOOLS : SOCIAL_GEMINI_TOOLS;
    const selectedOpenAiTools = isTerminal ? TERMINAL_OPENAI_TOOLS : SOCIAL_OPENAI_TOOLS;

    // 0. Confidential AI Execution via NEAR AI Cloud (Hardware TEE Enclaves with Circuit Breaker)
    const isFinancial = isFinancialQuery(message);
    const nearAiKey = (provider === "nearai" ? customApiKey : undefined) || process.env.NEAR_AI_API_KEY;
    if (provider === "nearai" || (nearAiKey && isFinancial) || (body as any).confidential) {
      const hybridResult = await routeHybridAI(message, {
        history,
        nearAiApiKey: nearAiKey,
        preferTee: true,
        timeoutMs: 2500, // 2500ms hardware enclave timeout race
        mode: isTerminal ? "terminal" : "social",
      });

      if (hybridResult.tool !== "unknown") {
        return NextResponse.json({
          success: true,
          ...hybridResult,
        });
      }
    }

    // Fast-path evaluation: If message matches unambiguous cross-chain, paylink, trading, or query command, resolve immediately with sub-millisecond precision
    const fastCheck = await processUserMessage(message, history, isTerminal ? "terminal" : "social");
    if (
      fastCheck.tool === "execute_cross_chain_intent" ||
      fastCheck.tool === "pay_invoice" ||
      fastCheck.tool === "cancel_invoice" ||
      fastCheck.tool === "query_history" ||
      fastCheck.tool === "faucet" ||
      fastCheck.tool === "create_trading_rule" ||
      fastCheck.tool === "trade_stock" ||
      fastCheck.tool === "get_portfolio" ||
      fastCheck.tool === "get_market_price"
    ) {
      return NextResponse.json({
        success: true,
        engine: "deterministic-fastpath",
        ...fastCheck,
      });
    }

    // 1. Google Gemini Provider (Multi-Model Resilient Cascade)
    if (apiKey && (provider === "gemini" || apiKey.startsWith("AIzaSy"))) {
      try {
        const payload = {
          contents: buildGeminiContents(history, message),
          tools: selectedGeminiTools,
          systemInstruction: { parts: [{ text: selectedInstruction }] },
        };

        const candidateModels = ["gemini-2.5-flash", "gemini-3-flash-preview"];
        let data: any = null;

        for (const modelId of candidateModels) {
          try {
            const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
            const res = await fetch(geminiEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (res.ok) {
              data = await res.json();
              break;
            }
          } catch (modelErr) {
            console.warn(`Gemini model ${modelId} failed:`, modelErr);
          }
        }

        if (data) {
          const candidate = data.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          const functionCallPart = parts.find((p: any) => p.functionCall);

          if (functionCallPart) {
            const { name, args } = functionCallPart.functionCall;
            const textPart = parts.find((p: any) => p.text);

            let resolvedArgs = { ...args, asset: args.asset || "USDC" };
            let reply = textPart?.text || getAssistantReplyForTool(name, args);

            if (name === "tip_handle") {
              const val = await resolveIntentValue(args.amount, args.asset, message.includes("$"));
              resolvedArgs = {
                ...args,
                amount: val.amount,
                asset: val.asset,
                usdEquivalent: val.usdEquivalent,
                nearEquivalent: val.nearEquivalent,
                nearPriceUsd: val.nearPriceUsd,
                conversionExplanation: val.conversionExplanation,
              };
              reply = `Prepared tip of ${val.amount} ${val.asset} for @${args.recipientHandle} (${val.conversionExplanation}). Executing via NEAR session key...`;
            } else if (name === "direct_transfer") {
              const val = await resolveIntentValue(args.amount, args.asset || "NEAR", message.includes("$"));
              const lowerMsg = message.toLowerCase();
              let detectedChain = "base";
              if (lowerMsg.includes("arbitrum") || lowerMsg.includes("arb")) detectedChain = "arbitrum";
              else if (lowerMsg.includes("ethereum") || lowerMsg.includes("eth mainnet") || (lowerMsg.includes("sepolia") && !lowerMsg.includes("base"))) detectedChain = "ethereum";
              else if (args.chain) detectedChain = args.chain.toLowerCase();

              const chainLabel = detectedChain === "arbitrum" ? "Arbitrum Sepolia" : detectedChain === "ethereum" ? "Ethereum Sepolia" : "Base Sepolia";

              resolvedArgs = {
                recipientAddress: args.recipientAddress,
                amount: val.amount,
                asset: val.asset || "NEAR",
                chain: detectedChain,
                chainId: detectedChain === "arbitrum" ? 421614 : detectedChain === "ethereum" ? 11155111 : 84532,
                usdEquivalent: val.usdEquivalent,
                nearEquivalent: val.nearEquivalent,
                nearPriceUsd: val.nearPriceUsd,
                conversionExplanation: val.conversionExplanation,
              };
              reply = `I have prepared a direct transfer of ${val.amount} ${val.asset} directly to \`${args.recipientAddress}\`. Source chain: ${chainLabel} (switchable below). No escrow lock required. Review and authorize below:`;
            } else if (name === "pay_invoice") {
              resolvedArgs = {
                slug: args.slug,
                amountUsd: args.amountUsd || 15.0,
              };
              reply = `Found invoice \`${args.slug}\`. Review details and authorize one-click settlement below:`;
            } else if (name === "create_invoice") {
              const isNear = (args.asset || "").toUpperCase() === "NEAR" || message.toLowerCase().includes("near");
              const assetName = isNear ? "NEAR" : (args.asset || "USD");
              const val = await resolveIntentValue(args.amount, assetName, message.includes("$"));
              const amountUsd = assetName === "NEAR" ? val.usdEquivalent : (val.usdEquivalent || val.amount || 15.0);
              const invoiceAmount = assetName === "NEAR" ? val.amount : amountUsd;
              resolvedArgs = {
                ...args,
                amount: invoiceAmount,
                asset: assetName,
                amountUsd,
                usdEquivalent: amountUsd,
                nearEquivalent: val.nearEquivalent,
                nearPriceUsd: val.nearPriceUsd,
                memo: args.memo || "Payment Request",
                recipientHandle: args.recipientHandle?.replace("@", ""),
                clientHandle: args.recipientHandle?.replace("@", ""),
              };
              reply = isNear
                ? `Created PayLink for ${invoiceAmount} NEAR (~$${amountUsd.toFixed(2)} USD)${args.recipientHandle ? ` for @${args.recipientHandle.replace("@", "")}` : ""}${args.memo ? ` ("${args.memo}")` : ""}. Anyone on Base, Solana, or NEAR can pay straight to your wallet.`
                : `Created PayLink for $${amountUsd.toFixed(2)}${args.recipientHandle ? ` for @${args.recipientHandle.replace("@", "")}` : ""}${args.memo ? ` ("${args.memo}")` : ""}. Anyone on Base, Solana, or NEAR can pay straight to your wallet.`;
            } else if (name === "execute_cross_chain_intent") {
              const targetAmount = Number(args.amount) || 10;
              const targetAsset = (args.targetAsset || "USDC").toUpperCase();
              const targetChain = (args.targetChain || "BASE").toUpperCase();
              const recipient = (args.recipient || "").replace("@", "").trim();
              const userWantsFromBase = /from\s+(?:the\s+)?base(?:\s+chain)?/i.test(message) || (args.sourceChain && args.sourceChain.toUpperCase() === "BASE");
              const isDirectEvm = userWantsFromBase || (targetChain === "BASE" && recipient.startsWith("0x"));
              const finalSourceChain = isDirectEvm ? "BASE" : (args.sourceChain || "NEAR").toUpperCase();
              const finalSourceAsset = isDirectEvm ? targetAsset : (args.sourceAsset || "NEAR").toUpperCase();
              const liveNearPrice = await getLiveNearPrice();
              const requiredNear = targetAsset === "NEAR"
                ? targetAmount
                : Number((targetAmount / liveNearPrice).toFixed(3));
              const finalSourceAmount = isDirectEvm ? targetAmount : requiredNear;

              resolvedArgs = {
                sourceChain: finalSourceChain,
                sourceAsset: finalSourceAsset,
                sourceAmount: finalSourceAmount,
                targetChain,
                targetAsset,
                targetAmount,
                amount: targetAmount,
                recipient,
                recipientHandle: recipient,
                isDirectEvm,
                estimatedFeeUsd: isDirectEvm ? 0.01 : 0.04,
              };
              reply = isDirectEvm
                ? `Preparing direct transfer of ${targetAmount} ${targetAsset} on ${targetChain} to ${recipient}...`
                : `Formulating cross-chain intent order via NEAR Intents (Defuse 1Click Solvers) to deliver ${targetAmount} ${targetAsset} on ${targetChain} to @${recipient}...`;
            } else if (name === "trade_stock") {
              const rawSymbol = (args.symbol || "TSLA").toUpperCase().trim();
              const symbol = rawSymbol.endsWith("ON") ? rawSymbol : `${rawSymbol}on`;
              const action = (args.action || "buy").toLowerCase();
              const amountUsd = Number(args.amountUsd) || 50;
              resolvedArgs = {
                symbol,
                action,
                amountUsd,
              };
              reply = `I have formulated a ${action.toUpperCase()} order for $${amountUsd.toFixed(2)} of ${symbol} via Defuse 1Click solvers. Review the quote details below and authorize execution:`;
            } else if (name === "create_trading_rule") {
              const rawSymbol = (args.symbol || "TSLA").toUpperCase().trim();
              const symbol = rawSymbol.endsWith("ON") ? rawSymbol : `${rawSymbol}on`;
              const rawType = (args.type || "buy_dip").toLowerCase();
              const isDca = rawType === "recurring_buy" || rawType === "dca" || rawType === "recurring" || message.toLowerCase().includes("dca") || message.toLowerCase().includes("minute");
              const isBracket = rawType === "bracket_order" || message.toLowerCase().includes("bracket");
              const ruleType = isDca ? "recurring_buy" : isBracket ? "bracket_order" : rawType;
              const amountUsd = Number(args.amountUsd) || 50;
              const targetPrice = args.targetPrice ? Number(args.targetPrice) : undefined;
              const targetPercent = args.targetPercent ? Number(args.targetPercent) : undefined;
              const cadence = args.cadence || (message.toLowerCase().includes("1m") || message.toLowerCase().includes("minute") ? "1m" : "daily");
              const takeProfitPercent = args.takeProfitPercent ? Number(args.takeProfitPercent) : 10;
              
              resolvedArgs = {
                symbol,
                type: ruleType,
                amountUsd,
                targetPrice,
                targetPercent,
                cadence,
                takeProfitPercent,
              };

              let conditionText = `Buy $${amountUsd.toFixed(2)} if price drops ${targetPrice ? `below $${targetPrice.toFixed(2)}` : `by ${targetPercent || 5}%`}`;
              if (isDca) {
                const cadenceLabel = cadence === "1m" ? "every minute (Fast Testnet Mode)" : cadence === "5m" ? "every 5 minutes" : cadence === "hourly" ? "every hour" : cadence === "weekly" ? "every week" : "daily";
                conditionText = `DCA $${amountUsd.toFixed(2)} ${cadenceLabel}`;
                reply = `Automated DCA Rule Activated: I will automatically buy $${amountUsd.toFixed(2)} of ${symbol} ${cadenceLabel} in your Paper Trading Sandbox using real-time oracle quotes.`;
              } else if (isBracket) {
                conditionText = `Bracket Order: Entry buy $${amountUsd.toFixed(2)} + Take Profit at +${takeProfitPercent}%`;
                reply = `Bracket Order Formulated: Instant entry market buy for $${amountUsd.toFixed(2)} of ${symbol} and automated Take-Profit exit armed at +${takeProfitPercent}%.`;
              } else if (ruleType === "take_profit") {
                conditionText = `Sell on +${targetPercent || 10}% gain`;
                reply = `Automated trading rule activated for ${symbol}. Condition: "${conditionText}". I will monitor the market 24/7 on NEAR and execute automatically when triggered.`;
              } else if (ruleType === "stop_loss") {
                conditionText = `Stop-loss exit on -${args.stopLossPercent || targetPercent || 5}% loss`;
                reply = `Automated Stop-Loss protection activated for ${symbol}. Condition: "${conditionText}".`;
              } else {
                reply = `Automated trading rule activated for ${symbol}. Condition: "${conditionText}". I will monitor the market 24/7 on NEAR and execute automatically when triggered.`;
              }
            } else if (name === "transfer_stock") {
              const rawSymbol = (args.symbol || "TSLA").toUpperCase().trim();
              const symbol = rawSymbol.endsWith("ON") ? rawSymbol : `${rawSymbol}on`;
              const recipientAddress = (args.recipientAddress || "").trim();
              const shares = Number(args.shares) || 1.0;
              const amountUsd = Number(args.amountUsd) || 0;
              resolvedArgs = {
                symbol,
                shares,
                amountUsd,
                recipientAddress,
              };
              reply = `I have prepared an on-chain transfer of ${shares} shares of ${symbol} directly to \`${recipientAddress}\` via NEP-141 token standard (*.omdep.near) on NEAR. Review and authorize below:`;
            } else if (name === "get_portfolio") {
              resolvedArgs = {};
              reply = "Here is your current tokenized stock portfolio and active automated trading rules:";
            } else if (name === "get_market_price") {
              const sym = (args.symbol || "NEAR").toUpperCase().trim();
              const marketData = await fetchMarketPrice(sym);
              if (marketData) {
                resolvedArgs = marketData;
                reply = `**${marketData.name} (${marketData.symbol})** is currently trading at **$${marketData.priceUsd.toLocaleString(undefined, { minimumFractionDigits: marketData.priceUsd < 1 ? 4 : 2 })} USD** (${marketData.change24h >= 0 ? "+" : ""}${marketData.change24h}% 24h).${marketData.trend ? ` Market trend: **${marketData.trend.toUpperCase()}**.` : ""}${marketData.category === "stock" || marketData.category === "etf" ? " Available for 24/7 trading on NEAR via Ondo tokenized equities and Defuse 1Click solvers." : ""}`;
              } else {
                resolvedArgs = { symbol: sym };
                reply = `Could not locate current price data for '${sym}'. Available assets include NEAR, BTC, ETH, SOL, TSLAon, NVDAon, AAPLon, SPYon, and MSFTon.`;
              }
            }

            return NextResponse.json({
              success: true,
              engine: "gemini-ai",
              tool: name,
              args: resolvedArgs,
              assistantReply: reply,
            });
          }

          // Prioritize conversational text reply if Gemini answered
          const textPart = parts.find((p: any) => p.text);
          if (textPart && textPart.text && textPart.text.trim()) {
            return NextResponse.json({
              success: true,
              engine: "gemini-ai-conversational",
              tool: "unknown",
              args: {},
              assistantReply: textPart.text.trim(),
            });
          }

          // Check if deterministic regex detects a specific financial command
          const localCheck = await processUserMessage(message, history);
          if (localCheck.tool !== "unknown") {
            return NextResponse.json({
              success: true,
              engine: "deterministic-assisted",
              ...localCheck,
            });
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini API call failed:", geminiErr);
      }
    }

    // 2. OpenAI / NEAR AI / Groq Provider (OpenAI-compatible)
    if (apiKey && (provider === "nearai" || provider === "openai" || provider === "groq")) {
      try {
        const baseUrl =
          provider === "nearai"
            ? "https://api.near.ai/v1"
            : provider === "groq"
            ? "https://api.groq.com/openai/v1"
            : "https://api.openai.com/v1";

        const modelName =
          provider === "nearai"
            ? "llama-3.3-70b-instruct"
            : provider === "groq"
            ? "llama-3.3-70b-versatile"
            : "gpt-4o-mini";

        const formattedMessages = [
          { role: "system", content: selectedInstruction },
          ...history
            .filter((m: any) => m.content && m.content.trim())
            .map((m: any) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content.trim(),
            })),
          { role: "user", content: message.trim() },
        ];

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: formattedMessages,
            tools: selectedOpenAiTools,
            tool_choice: "auto",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const choice = data.choices?.[0];
          const toolCall = choice?.message?.tool_calls?.[0];

          if (toolCall) {
            const name = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments || "{}");

            let resolvedArgs = { ...args, asset: args.asset || "USDC" };
            let reply = choice.message.content || getAssistantReplyForTool(name, args);

            if (name === "tip_handle") {
              const val = await resolveIntentValue(args.amount, args.asset, message.includes("$"));
              resolvedArgs = {
                ...args,
                amount: val.amount,
                asset: val.asset,
                usdEquivalent: val.usdEquivalent,
                nearEquivalent: val.nearEquivalent,
                nearPriceUsd: val.nearPriceUsd,
                conversionExplanation: val.conversionExplanation,
              };
              reply = `Prepared tip of ${val.amount} ${val.asset} for @${args.recipientHandle} (${val.conversionExplanation}). Executing via NEAR session key...`;
            } else if (name === "direct_transfer") {
              const val = await resolveIntentValue(args.amount, args.asset || "NEAR", message.includes("$"));
              const lowerMsg = message.toLowerCase();
              let detectedChain = "base";
              if (lowerMsg.includes("arbitrum") || lowerMsg.includes("arb")) detectedChain = "arbitrum";
              else if (lowerMsg.includes("ethereum") || lowerMsg.includes("eth mainnet") || (lowerMsg.includes("sepolia") && !lowerMsg.includes("base"))) detectedChain = "ethereum";
              else if (args.chain) detectedChain = args.chain.toLowerCase();

              const chainLabel = detectedChain === "arbitrum" ? "Arbitrum Sepolia" : detectedChain === "ethereum" ? "Ethereum Sepolia" : "Base Sepolia";

              resolvedArgs = {
                recipientAddress: args.recipientAddress,
                amount: val.amount,
                asset: val.asset || "NEAR",
                chain: detectedChain,
                chainId: detectedChain === "arbitrum" ? 421614 : detectedChain === "ethereum" ? 11155111 : 84532,
                usdEquivalent: val.usdEquivalent,
                nearEquivalent: val.nearEquivalent,
                nearPriceUsd: val.nearPriceUsd,
                conversionExplanation: val.conversionExplanation,
              };
              reply = `I have prepared a direct transfer of ${val.amount} ${val.asset} directly to \`${args.recipientAddress}\`. Source chain: ${chainLabel} (switchable below). No escrow lock required. Review and authorize below:`;
            } else if (name === "pay_invoice") {
              resolvedArgs = {
                slug: args.slug,
                amountUsd: args.amountUsd || 15.0,
              };
              reply = `Found invoice \`${args.slug}\`. Review details and authorize one-click settlement below:`;
            } else if (name === "create_invoice") {
              const isNear = (args.asset || "").toUpperCase() === "NEAR" || message.toLowerCase().includes("near");
              const assetName = isNear ? "NEAR" : (args.asset || "USD");
              const val = await resolveIntentValue(args.amount, assetName, message.includes("$"));
              const amountUsd = assetName === "NEAR" ? val.usdEquivalent : (val.usdEquivalent || val.amount || 15.0);
              const invoiceAmount = assetName === "NEAR" ? val.amount : amountUsd;
              resolvedArgs = {
                ...args,
                amount: invoiceAmount,
                asset: assetName,
                amountUsd,
                usdEquivalent: amountUsd,
                nearEquivalent: val.nearEquivalent,
                nearPriceUsd: val.nearPriceUsd,
                memo: args.memo || "Payment Request",
                recipientHandle: args.recipientHandle?.replace("@", ""),
                clientHandle: args.recipientHandle?.replace("@", ""),
              };
              reply = isNear
                ? `Created PayLink for ${invoiceAmount} NEAR (~$${amountUsd.toFixed(2)} USD)${args.recipientHandle ? ` for @${args.recipientHandle.replace("@", "")}` : ""}${args.memo ? ` ("${args.memo}")` : ""}. Anyone on Base, Solana, or NEAR can pay straight to your wallet.`
                : `Created PayLink for $${amountUsd.toFixed(2)}${args.recipientHandle ? ` for @${args.recipientHandle.replace("@", "")}` : ""}${args.memo ? ` ("${args.memo}")` : ""}. Anyone on Base, Solana, or NEAR can pay straight to your wallet.`;
            } else if (name === "execute_cross_chain_intent") {
              const targetAmount = Number(args.amount) || 10;
              const targetAsset = (args.targetAsset || "USDC").toUpperCase();
              const targetChain = (args.targetChain || "BASE").toUpperCase();
              const recipient = (args.recipient || "").replace("@", "").trim();
              const userWantsFromBase = /from\s+(?:the\s+)?base(?:\s+chain)?/i.test(message) || (args.sourceChain && args.sourceChain.toUpperCase() === "BASE");
              const isDirectEvm = userWantsFromBase || (targetChain === "BASE" && recipient.startsWith("0x"));
              const finalSourceChain = isDirectEvm ? "BASE" : (args.sourceChain || "NEAR").toUpperCase();
              const finalSourceAsset = isDirectEvm ? targetAsset : (args.sourceAsset || "NEAR").toUpperCase();
              const liveNearPrice = await getLiveNearPrice();
              const requiredNear = targetAsset === "NEAR"
                ? targetAmount
                : Number((targetAmount / liveNearPrice).toFixed(3));
              const finalSourceAmount = isDirectEvm ? targetAmount : requiredNear;

              resolvedArgs = {
                sourceChain: finalSourceChain,
                sourceAsset: finalSourceAsset,
                sourceAmount: finalSourceAmount,
                targetChain,
                targetAsset,
                targetAmount,
                amount: targetAmount,
                recipient,
                recipientHandle: recipient,
                isDirectEvm,
                estimatedFeeUsd: isDirectEvm ? 0.01 : 0.04,
              };
              reply = isDirectEvm
                ? `Preparing direct transfer of ${targetAmount} ${targetAsset} on ${targetChain} to ${recipient}...`
                : `Formulating cross-chain intent order via NEAR Intents (Defuse 1Click Solvers) to deliver ${targetAmount} ${targetAsset} on ${targetChain} to @${recipient}...`;
            } else if (name === "trade_stock") {
              const rawSymbol = (args.symbol || "TSLA").toUpperCase().trim();
              const symbol = rawSymbol.endsWith("ON") ? rawSymbol : `${rawSymbol}on`;
              const action = (args.action || "buy").toLowerCase();
              const amountUsd = Number(args.amountUsd) || 50;
              resolvedArgs = {
                symbol,
                action,
                amountUsd,
              };
              reply = `I have formulated a ${action.toUpperCase()} order for $${amountUsd.toFixed(2)} of ${symbol} via Defuse 1Click solvers. Review the quote details below and authorize execution:`;
            } else if (name === "create_trading_rule") {
              const rawSymbol = (args.symbol || "TSLA").toUpperCase().trim();
              const symbol = rawSymbol.endsWith("ON") ? rawSymbol : `${rawSymbol}on`;
              const rawType = (args.type || "buy_dip").toLowerCase();
              const isDca = rawType === "recurring_buy" || rawType === "dca" || rawType === "recurring" || message.toLowerCase().includes("dca") || message.toLowerCase().includes("minute");
              const isBracket = rawType === "bracket_order" || message.toLowerCase().includes("bracket");
              const ruleType = isDca ? "recurring_buy" : isBracket ? "bracket_order" : rawType;
              const amountUsd = Number(args.amountUsd) || 50;
              const targetPrice = args.targetPrice ? Number(args.targetPrice) : undefined;
              const targetPercent = args.targetPercent ? Number(args.targetPercent) : undefined;
              const cadence = args.cadence || (message.toLowerCase().includes("1m") || message.toLowerCase().includes("minute") ? "1m" : "daily");
              const takeProfitPercent = args.takeProfitPercent ? Number(args.takeProfitPercent) : 10;
              
              resolvedArgs = {
                symbol,
                type: ruleType,
                amountUsd,
                targetPrice,
                targetPercent,
                cadence,
                takeProfitPercent,
              };

              let conditionText = `Buy $${amountUsd.toFixed(2)} if price drops ${targetPrice ? `below $${targetPrice.toFixed(2)}` : `by ${targetPercent || 5}%`}`;
              if (isDca) {
                const cadenceLabel = cadence === "1m" ? "every minute (Fast Testnet Mode)" : cadence === "5m" ? "every 5 minutes" : cadence === "hourly" ? "every hour" : cadence === "weekly" ? "every week" : "daily";
                conditionText = `DCA $${amountUsd.toFixed(2)} ${cadenceLabel}`;
                reply = `Automated DCA Rule Activated: I will automatically buy $${amountUsd.toFixed(2)} of ${symbol} ${cadenceLabel} in your Paper Trading Sandbox using real-time oracle quotes.`;
              } else if (isBracket) {
                conditionText = `Bracket Order: Entry buy $${amountUsd.toFixed(2)} + Take Profit at +${takeProfitPercent}%`;
                reply = `Bracket Order Formulated: Instant entry market buy for $${amountUsd.toFixed(2)} of ${symbol} and automated Take-Profit exit armed at +${takeProfitPercent}%.`;
              } else if (ruleType === "take_profit") {
                conditionText = `Sell on +${targetPercent || 10}% gain`;
                reply = `Automated trading rule activated for ${symbol}. Condition: "${conditionText}". I will monitor the market 24/7 on NEAR and execute automatically when triggered.`;
              } else if (ruleType === "stop_loss") {
                conditionText = `Stop-loss exit on -${args.stopLossPercent || targetPercent || 5}% loss`;
                reply = `Automated Stop-Loss protection activated for ${symbol}. Condition: "${conditionText}".`;
              } else {
                reply = `Automated trading rule activated for ${symbol}. Condition: "${conditionText}". I will monitor the market 24/7 on NEAR and execute automatically when triggered.`;
              }
            } else if (name === "transfer_stock") {
              const rawSymbol = (args.symbol || "TSLA").toUpperCase().trim();
              const symbol = rawSymbol.endsWith("ON") ? rawSymbol : `${rawSymbol}on`;
              const recipientAddress = (args.recipientAddress || "").trim();
              const shares = Number(args.shares) || 1.0;
              const amountUsd = Number(args.amountUsd) || 0;
              resolvedArgs = {
                symbol,
                shares,
                amountUsd,
                recipientAddress,
              };
              reply = `I have prepared an on-chain transfer of ${shares} shares of ${symbol} directly to \`${recipientAddress}\` via NEP-141 token standard (*.omdep.near) on NEAR. Review and authorize below:`;
            } else if (name === "get_portfolio") {
              resolvedArgs = {};
              reply = "Here is your current tokenized stock portfolio and active automated trading rules:";
            } else if (name === "get_market_price") {
              const sym = (args.symbol || "NEAR").toUpperCase().trim();
              const marketData = await fetchMarketPrice(sym);
              if (marketData) {
                resolvedArgs = marketData;
                reply = `**${marketData.name} (${marketData.symbol})** is currently trading at **$${marketData.priceUsd.toLocaleString(undefined, { minimumFractionDigits: marketData.priceUsd < 1 ? 4 : 2 })} USD** (${marketData.change24h >= 0 ? "+" : ""}${marketData.change24h}% 24h).${marketData.trend ? ` Market trend: **${marketData.trend.toUpperCase()}**.` : ""}${marketData.category === "stock" || marketData.category === "etf" ? " Available for 24/7 trading on NEAR via Ondo tokenized equities and Defuse 1Click solvers." : ""}`;
              } else {
                resolvedArgs = { symbol: sym };
                reply = `Could not locate current price data for '${sym}'. Available assets include NEAR, BTC, ETH, SOL, TSLAon, NVDAon, AAPLon, SPYon, and MSFTon.`;
              }
            }

            return NextResponse.json({
              success: true,
              engine: `${provider}-${modelName}`,
              tool: name,
              args: resolvedArgs,
              assistantReply: reply,
            });
          }

          const localCheck = await processUserMessage(message, history);
          if (localCheck.tool !== "unknown") {
            return NextResponse.json({
              success: true,
              engine: "deterministic-assisted",
              ...localCheck,
            });
          }

          return NextResponse.json({
            success: true,
            engine: `${provider}-${modelName}`,
            tool: "unknown",
            args: {},
            assistantReply: choice?.message?.content || "Understood.",
          });
        }
      } catch (openAiErr) {
        console.warn("OpenAI/NEAR-AI API call failed:", openAiErr);
      }
    }

    // 3. Deterministic Local Fallback (Guarantees zero downtime)
    const localResult = await processUserMessage(message, history);
    return NextResponse.json({
      success: true,
      engine: "deterministic-fallback",
      ...localResult,
    });
  } catch (err: any) {
    console.error("Chat API route error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}

function getAssistantReplyForTool(name: string, args: any): string {
  if (name === "tip_handle") {
    return `Prepared tip of ${args.amount} ${args.asset || "USDC"} for @${args.recipientHandle}. Executing via NEAR session key...`;
  }
  if (name === "direct_transfer") {
    return `Prepared direct transfer of ${args.amount} ${args.asset || "NEAR"} to ${args.recipientAddress}. Zero escrow required.`;
  }
  if (name === "pay_invoice") {
    return `Found invoice ${args.slug}. Authorize one-click settlement below:`;
  }
  if (name === "create_invoice") {
    const isNear = (args.asset || "").toUpperCase() === "NEAR";
    const amountStr = isNear ? `${args.amount} NEAR` : `$${Number(args.amount).toFixed(2)}`;
    return `Created PayLink for ${amountStr}${args.memo ? ` ("${args.memo}")` : ""}. Anyone on Base, Solana, or NEAR can pay straight to your wallet.`;
  }
  if (name === "claim_funds") {
    return "Checking for your unclaimed tips on NEAR Escrow and claiming gaslessly via NEP-366 relayer...";
  }
  if (name === "check_balance") {
    return "Querying your personal NEAR wallet balance and active daily spending authority...";
  }
  if (name === "faucet") {
    return "Here is the VeilX Testnet Faucet. You can claim 0.25 free testnet NEAR instantly below:";
  }
  if (name === "execute_cross_chain_intent") {
    return `Formulating cross-chain intent order via NEAR Intents (Defuse 1Click Solvers) to deliver ${args.amount} ${args.targetAsset || "USDC"} on ${args.targetChain || "Base"} to @${args.recipient}...`;
  }
  if (name === "trade_stock") {
    return `Formulated ${args.action || "buy"} order for $${args.amountUsd || 50} of ${args.symbol} on NEAR via Defuse 1Click solvers.`;
  }
  if (name === "create_trading_rule") {
    return `Activated automated ${args.type || "trading"} rule for ${args.symbol}.`;
  }
  if (name === "get_portfolio") {
    return "Here is your current tokenized portfolio summary:";
  }
  if (name === "get_market_price") {
    return `Fetching real-time price and technical indicator metrics for ${args.symbol || "asset"}...`;
  }
  return "Executing requested agent action...";
}
