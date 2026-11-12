// src/lib/ai-gateway.ts
// Dual-Mode AI Gateway: Seamlessly supports free zero-cost dev tier & NEAR AI Cloud
import { resolveIntentValue } from "./near-price";
import { normalizeChainName, SUPPORTED_CHAINS } from "./1click";
import { fetchMarketPrice } from "./price-service";
import { getLiveNearPrice } from "./oracle-service";

// Clean number parser helper handling commas
export function parseCleanNumber(str?: string | null): number {
  if (!str) return NaN;
  const sanitized = str.replace(/,/g, "").trim();
  return parseFloat(sanitized);
}

// Company to tokenized stock ticker dictionary
export const COMPANY_TICKER_MAP: Record<string, string> = {
  apple: "AAPLon",
  aapl: "AAPLon",
  tesla: "TSLAon",
  tsla: "TSLAon",
  nvidia: "NVDAon",
  nvda: "NVDAon",
  spy: "SPYon",
  sp500: "SPYon",
  microsoft: "MSFTon",
  msft: "MSFTon",
  amazon: "AMZNon",
  amzn: "AMZNon",
  google: "GOOGLon",
  googl: "GOOGLon",
  alphabet: "GOOGLon",
  meta: "METAon",
  hood: "HOODon",
  robinhood: "HOODon",
  coin: "COINon",
  coinbase: "COINon",
  near: "NEAR",
  btc: "BTC",
  bitcoin: "BTC",
  eth: "ETH",
  ethereum: "ETH",
  sol: "SOL",
  solana: "SOL"
};

export function normalizeStockOrCrypto(sym: string): string {
  const clean = sym.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (COMPANY_TICKER_MAP[clean]) return COMPANY_TICKER_MAP[clean];
  if (clean.endsWith("on")) {
    const base = clean.slice(0, -2).toUpperCase();
    return `${base}on`;
  }
  const upper = clean.toUpperCase();
  if (["BTC", "ETH", "SOL", "NEAR", "DOGE", "USDC", "USDT"].includes(upper)) {
    return upper;
  }
  return `${upper}on`;
}

// Adversarial prompt injection detector
export function isPromptInjection(text: string): boolean {
  return /(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:previous\s+|prior\s+)?(?:instructions|rules|guardrails|commands|prompts)|system\s*override|developer\s*mode\s*activated/i.test(text);
}

// Reserved words that must never be captured as recipient handles
export const RESERVED_HANDLES = new Set([
  "from", "to", "on", "via", "with", "using", "for", "in", "at", "into", "the", "my", "this",
  "base", "near", "solana", "sol", "arbitrum", "arb", "ethereum", "eth", "optimism", "op",
  "polygon", "pol", "bsc", "bnb", "avalanche", "avax", "bitcoin", "btc", "dogecoin", "doge",
  "zcash", "zec", "tron", "trx", "ton", "sui", "aptos", "apt", "stellar", "xlm", "cardano", "ada",
  "litecoin", "ltc", "berachain", "bera", "monad", "starknet", "gnosis", "xdai", "scroll", "xrp",
  "usdc", "usdt", "usd"
]);

export interface ToolCallResult {
  tool:
    | "tip_handle"
    | "direct_transfer"
    | "create_invoice"
    | "pay_invoice"
    | "cancel_invoice"
    | "query_history"
    | "execute_cross_chain_intent"
    | "claim_funds"
    | "check_balance"
    | "faucet"
    | "create_trading_rule"
    | "trade_stock"
    | "get_portfolio"
    | "get_market_price"
    | "unknown";
  args: Record<string, any>;
  assistantReply: string;
  engine?: string;
  isTeeEnclave?: boolean;
  isSpeedFallback?: boolean;
}

const isNearOnChainAddress = (str: string) => {
  const clean = str.replace("@", "").trim().toLowerCase();
  return clean.endsWith(".testnet") || clean.endsWith(".near") || (clean.length === 64 && /^[0-9a-f]+$/i.test(clean));
};

const isCrossChainAddress = (str: string) => {
  return /^0x[a-fA-F0-9]{40}$/.test(str) || /^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(str);
};

export async function processUserMessage(
  prompt: string,
  history?: { role: string; content: string }[],
  mode: "social" | "terminal" = "social"
): Promise<ToolCallResult> {
  if (!prompt || typeof prompt !== "string") {
    return { tool: "unknown", args: {}, assistantReply: "Please provide a valid prompt." };
  }

  // Security Gate 1: Unbounded input clamp (DoS / ReDoS prevention)
  let clean = prompt.slice(0, 1000).trim();

  // Security Gate 2: Adversarial Prompt Injection Guard
  if (isPromptInjection(clean)) {
    return {
      tool: "unknown",
      args: {},
      assistantReply: "Security Warning: Adversarial instruction override detected. Financial execution halted.",
    };
  }

  const isTerminal = mode === "terminal";

  // Multi-Turn Context Resolution for Follow-up answers
  if (history && history.length > 0) {
    const isOnlyAmount = /^\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(NEAR|USDC|USD|ETH|SOL)?$/i.test(clean);
    const amountVal = parseCleanNumber(clean.replace(/\$|(NEAR|USDC|USD|ETH|SOL)/gi, ""));
    const assetSpec = clean.match(/NEAR|USDC|USD|ETH|SOL/i)?.[0]?.toUpperCase();

    if (isOnlyAmount && !isNaN(amountVal) && amountVal > 0) {
      const recent = history.slice(-4).map((h) => h.content).join(" ");

      // Case A: Follow-up to Invoicing / PayLink
      if (/invoice|paylink|bill/i.test(recent)) {
        const handleMatch = recent.match(/@([a-zA-Z0-9_]+)/i);
        const client = handleMatch ? handleMatch[1] : undefined;
        const memoMatch = recent.match(/\bfor\s+([a-zA-Z0-9_ -]+)$/i);
        const memo = memoMatch ? memoMatch[1].trim() : "Payment Request";
        clean = `create invoice $${amountVal} ${client ? "for @" + client : ""} for ${memo}`;
      }
      // Case B: Follow-up to Social Tip
      else if (/tip|send\s+to/i.test(recent)) {
        const handleMatch = recent.match(/@([a-zA-Z0-9_.-]+)/i);
        if (handleMatch) {
          clean = `tip @${handleMatch[1]} ${amountVal} ${assetSpec || "USDC"}`;
        }
      }
      // Case C: Follow-up to Stock / Trading
      else if (/buy|invest|trade/i.test(recent)) {
        const symMatch = recent.match(/\b(TSLA|NVDA|AAPL|SPY|MSFT|AMZN|GOOGL|NEAR|BTC|ETH|SOL)(?:on)?\b/i);
        if (symMatch) {
          clean = `buy $${amountVal} ${symMatch[1]}`;
        }
      }
    } else if (/^(?:create\s+(?:a\s+)?(?:paylink|invoice)|paylink|invoice)$/i.test(clean)) {
      const recent = history.slice(-4).map((h) => h.content).join(" ");
      const amountMatch = recent.match(/\$(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(NEAR|USDC|USD)\b/i);
      const handleMatch = recent.match(/@([a-zA-Z0-9_]+)/i);
      if (amountMatch) {
        const amt = amountMatch[0];
        const client = handleMatch ? handleMatch[1] : undefined;
        clean = `create invoice ${amt} ${client ? "for @" + client : ""}`;
      }
    } else if (/(?:from|via|using|with)\s+(?:the\s+|my\s+)?(?:base|evm|sepolia)|(?:base|evm|sepolia)\s+(?:balance|wallet)/i.test(clean)) {
      const recent = history.slice(-6).map((h) => h.content).join(" ");
      const handleMatch = recent.match(/@([a-zA-Z0-9_.-]+)/i);
      const crossMatch = recent.match(/(0x[a-fA-F0-9]{40})/i);
      const recipient = handleMatch ? handleMatch[0] : (crossMatch ? crossMatch[1] : undefined);
      const amountMatch = recent.match(/\$?(\d+(?:\.\d+)?)\s*(NEAR|USDC|ETH)?/i);
      if (recipient && amountMatch) {
        const amt = amountMatch[1];
        clean = `send ${amt} USDC from base to ${recipient}`;
      }
    }
  }

  const hasDollarSign = clean.includes("$");

  // Interrogative / Conversational queries must remain conversational and not be hijacked as transaction commands
  const isConversationalQuestion =
    /^(?:can\s+(?:u|you)|could\s+(?:u|you)|is\s+it\s+possible|how\s+(?:do|can|does|to|would)|why\s+|what\s+is\s+|what\s+are\s+|what\s+can\s+|tell\s+me|explain|i\s+asked|are\s+you|who\s+are)/i.test(clean) ||
    clean.endsWith("?");

  const isExplicitTransactionCommand =
    /^(?:can\s+(?:u|you)\s+)?(?:please\s+)?(?:tip|send|transfer|pay|invoice|create\s+invoice)\s+(?:\$?\d+|@?[a-zA-Z0-9])/i.test(clean);

  if (isConversationalQuestion && !isExplicitTransactionCommand) {
    if (isTerminal) {
      if (/how\s+(?:does\s+it\s+work|do\s+rules\s+work|can\s+i\s+trade)|what\s+can\s+you\s+do|help/i.test(clean)) {
        return {
          tool: "unknown",
          args: {},
          assistantReply: `Welcome to the **VeilX Trading Terminal**. I execute algorithmic trading strategies and tokenized US equity market orders directly on NEAR via Ondo Finance and Defuse 1Click solvers.\n\nHere are my core capabilities:\n- **Automated Trading Rules**: Set conditional dip-buying ("Buy $100 TSLA when it drops below $340"), take-profit ("Take profit on NVDA at +10%"), or stop-loss rules.\n- **Market Orders**: Buy or sell tokenized stocks instantly (e.g. "Buy $25 AAPLon now").\n- **Live Market Quotes**: Check real-time quotes, 24h performance, and technical indicators for crypto and stocks (e.g. "TSLA price", "NEAR price").\n- **Portfolio Tracking**: View your holdings, rule trigger statuses, and cash balance.\n\nHow would you like to position your portfolio today?`,
        };
      }
    } else {
      if (/spend|use|pay\s+from|transfer\s+from.*(?:evm|base|arbitrum|eth|usdc|chain)/i.test(clean)) {
        return {
          tool: "unknown",
          args: {},
          assistantReply: `Through NEAR Protocol's **Chain Signatures (MPC)**, I can autonomously sign and execute transactions from your derived Universal EVM address on Base, Arbitrum, Ethereum, and more without exposing private keys.\n\nTo spend or transfer from your EVM funds, simply give me an instruction like:\n- "Send 5 USDC on Base to @vitalik"\n- "Transfer 0.001 ETH on Base to 0x123..."\n- "Pay invoice inv_xyz with my Base USDC"\n\nYour session key and spending cap protect you at all times. Would you like to initiate a transfer now?`,
        };
      }

      // Omnichain Intent & Cross-Chain Solver Educational Guardrail (Solana, Bitcoin, Defuse, etc.)
      if (/solana|bitcoin|btc|sol|doge|dogecoin|polygon|arbitrum|defuse|intent|omnichain|38\s*chains|how\s+(?:does\s+it\s+work|do\s+intents\s+work|can\s+users\s+tip)/i.test(clean)) {
        return {
          tool: "unknown",
          args: {},
          assistantReply: `VeilX integrates with **NEAR Intents (Defuse Protocol 1Click solvers)** to connect across 38+ blockchains including Bitcoin, Solana, Ethereum, Dogecoin, Arbitrum, and Polygon.\n\nHere is how it works:\n- **Zero Extra Wallets**: You only hold your personal NEAR account and Universal EVM address. You never need to manage a native Bitcoin or Solana wallet.\n- **Solver Execution**: When you instruct me to send or receive on Solana or Bitcoin, Defuse solvers front liquidity on the destination network and settle against NEAR in ~12 seconds.\n- **Omnichain Invoices**: PayLinks allow anyone to pay you in SOL, BTC, DOGE, or ETH, and funds automatically settle into your personal account.\n\nTry giving me a command like: "Send 0.05 SOL to @jack" or "Create a $10 paylink".`,
        };
      }

      // Privacy & Shielded Mode Educational Guardrail
      if (/privacy|shield|zk|proof|blind|commitment|secret/i.test(clean)) {
        return {
          tool: "unknown",
          args: {},
          assistantReply: `VeilX protects your social privacy through **Cryptographic Selective Disclosure Attestations** and **HMAC Blinding Commitments**:\n\n- **Blinded Commitments**: Tips and PayLinks can hide sender net worth and social handles from public observers.\n- **Shielded Mode**: Use the Shielded toggle beside your balance to ensure your transaction memos and receipts remain confidential.\n- **Selective Proofs**: After sending a tip or settling an invoice, you receive a shareable cryptographic proof link that recipients can verify without exposing your full wallet history or master credentials.\n\nWould you like to turn on Shielded Mode or generate a private payment link?`,
        };
      }

      if (/i\s+asked\s+(?:u|you)|you(?:'re|\s+are)\s+not\s+answering/i.test(clean)) {
        return {
          tool: "unknown",
          args: {},
          assistantReply: `I apologize for that! I am your VeilX autonomous social finance agent. I can answer questions about your multichain balances, send tips to 𝕏 handles, generate cross-chain PayLinks, and execute transfers across NEAR and EVM chains. Please ask your question again or tell me what you'd like to do!`,
        };
      }
    }
  }

  // Pattern 0: Pay Invoice ("Pay invoice inv_123", "Pay https://.../pay/inv_xyz", "Settle inv_xyz")
  const payInvRegex = /(?:pay(?:\s+this)?\s+invoice\s+|pay\s+|settle\s+)(?:https?:\/\/[^\s\/]+\/pay\/)?(inv_[a-zA-Z0-9_-]+)/i;
  const payInvMatch = clean.match(payInvRegex);
  if (payInvMatch) {
    const slug = payInvMatch[1];
    return {
      tool: "pay_invoice",
      args: { slug, invoiceSlug: slug },
      assistantReply: `Retrieved invoice details for ${slug}. Checking spending limit and preparing payment...`,
    };
  }

  // Pattern 0B: Cancel Invoice ("Cancel invoice inv_123", "Void inv_xyz", "Cancel paylink inv_xyz")
  const cancelInvRegex = /(?:cancel|void|delete|archive)\s+(?:invoice\s+|paylink\s+)?(?:https?:\/\/[^\s\/]+\/pay\/)?(inv_[a-zA-Z0-9_-]+)/i;
  const cancelInvMatch = clean.match(cancelInvRegex);
  if (cancelInvMatch) {
    const slug = cancelInvMatch[1];
    return {
      tool: "cancel_invoice",
      args: { slug, invoiceSlug: slug },
      assistantReply: `Preparing cancellation request for invoice ${slug}...`,
    };
  }

  // Pattern 0C: Query Transaction History / Spending Activity
  const historyRegex = /(?:show|view|get|list|query)\s+(?:my\s+)?(?:recent\s+)?(?:history|transactions|activity|spending|payments)|what did i spend/i;
  if (historyRegex.test(clean)) {
    return {
      tool: "query_history",
      args: {},
      assistantReply: "Fetching your recent transaction history and spending summary...",
    };
  }

  // Pattern 0D-1: Cross-Chain Self-Directed Swaps / Bridges ("bridge 0.1 eth to arbitrum", "swap 5 NEAR to SOL", "transfer 5 usdc from near to base")
  const selfBridgeMatch = /(?:bridge|swap|transfer)\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(?:from\s+([a-zA-Z]+)\s+)?to\s+([a-zA-Z]+)/i.exec(clean);
  if (selfBridgeMatch && !clean.includes("@") && !clean.match(/0x[a-fA-F0-9]{40}/)) {
    const rawAmt = parseCleanNumber(selfBridgeMatch[1]);
    const assetSpec = selfBridgeMatch[2]?.toUpperCase() || "USDC";
    const srcChain = selfBridgeMatch[3] ? normalizeChainName(selfBridgeMatch[3]) : "NEAR";
    const destChain = normalizeChainName(selfBridgeMatch[4]);
    return {
      tool: "execute_cross_chain_intent",
      args: {
        sourceChain: srcChain,
        sourceAsset: assetSpec,
        sourceAmount: rawAmt,
        targetChain: destChain,
        targetAsset: assetSpec,
        targetAmount: rawAmt,
        amount: rawAmt,
        recipient: "self",
        isDirectEvm: false,
      },
      assistantReply: `Cross-Chain Intent Formulated: Bridge ${rawAmt} ${assetSpec} from ${srcChain} to ${destChain} via Defuse 1Click Solvers.`,
    };
  }

  // Pattern 0D: Omnichain Cross-Chain Intent via NEAR Intents / Defuse 1Click Solvers (38+ Chains)
  // Handles: "Send 10 USDC on Base to @alice", "Send 0.05 SOL to @bob", "Send 0.001 BTC to @alice", "Tip 50 DOGE to @elon", "Swap 5 NEAR to SOL"
  const chainPattern = "(base|solana|arbitrum|ethereum|optimism|polygon|bsc|bnb|avalanche|avax|bitcoin|btc|dogecoin|doge|zcash|zec|tron|trx|ton|sui|aptos|apt|stellar|xlm|cardano|ada|litecoin|ltc|berachain|bera|monad|starknet|gnosis|xdai|scroll|xrp|sol|eth|arb|op|pol)";
  
  // Implicit native token to chain mappings (e.g. "Send 0.05 SOL to @alice" -> SOLANA, "Send 0.001 BTC to @alice" -> BITCOIN)
  const tokenToChainMap: Record<string, string> = {
    SOL: "SOLANA",
    BTC: "BITCOIN",
    DOGE: "DOGECOIN",
    ZEC: "ZCASH",
    TRX: "TRON",
    TON: "TON",
    SUI: "SUI",
    APT: "APTOS",
    XLM: "STELLAR",
    ADA: "CARDANO",
    LTC: "LITECOIN",
    BERA: "BERACHAIN",
    MON: "MONAD",
    STRK: "STARKNET",
    XRP: "XRP",
  };

  const crossChainIntentRegexA = new RegExp(`(?:send|tip|transfer|pay|swap)\\s+\\$?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)\\s*([a-zA-Z]+)?\\s+(?:on|from)?\\s+(?:the\\s+|my\\s+)?${chainPattern}(?:\\s+(?:chain|balance|wallet))?\\s+(?:to\\s+|for\\s+)?(?:this\\s+wallet\\s+)?@?([a-zA-Z0-9_.-]+)`, "i");
  const crossChainIntentRegexB = new RegExp(`(?:send|tip|transfer|pay|swap)\\s+\\$?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)\\s*([a-zA-Z]+)?\\s+(?:to\\s+)?(?:this\\s+wallet\\s+)?@?([a-zA-Z0-9_.-]+)\\s+(?:on|from|via)\\s+(?:the\\s+|my\\s+)?${chainPattern}(?:\\s+(?:chain|balance|wallet))?`, "i");
  const crossChainIntentRegexC = new RegExp(`(?:send|tip|transfer|pay|swap)\\s+(?:to\\s+)?(?:this\\s+wallet\\s+)?@?([a-zA-Z0-9_.-]+)\\s+\\$?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)\\s*([a-zA-Z]+)?\\s+(?:on|from|via)\\s+(?:the\\s+|my\\s+)?${chainPattern}(?:\\s+(?:chain|balance|wallet))?`, "i");
  // Implied native token regex (e.g. "Send 0.05 SOL to @expatq3", "Tip 10 DOGE to @jack")
  const impliedTokenIntentRegex = new RegExp(`(?:send|tip|transfer|pay|swap)\\s+\\$?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)\\s*(SOL|BTC|DOGE|ZEC|TRX|TON|SUI|APT|XLM|ADA|LTC|BERA|MON|STRK|XRP)\\s+(?:to\\s+)?(?:this\\s+wallet\\s+)?@?([a-zA-Z0-9_.-]+)`, "i");

  const matchIntentA = clean.match(crossChainIntentRegexA);
  const matchIntentB = clean.match(crossChainIntentRegexB);
  const matchIntentC = clean.match(crossChainIntentRegexC);
  const matchImplied = clean.match(impliedTokenIntentRegex);

  const intentMatch = matchIntentA || matchIntentB || matchIntentC || matchImplied;
  if (intentMatch) {
    let rawAmount = 10;
    let asset = "USDC";
    let destChain = "BASE";
    let recipient = "veilx-agent.testnet";

    if (matchIntentA) {
      rawAmount = parseCleanNumber(matchIntentA[1]);
      asset = matchIntentA[2] ? matchIntentA[2].toUpperCase() : "USDC";
      destChain = normalizeChainName(matchIntentA[3]);
      recipient = matchIntentA[4].replace("@", "").trim();
    } else if (matchIntentB) {
      rawAmount = parseCleanNumber(matchIntentB[1]);
      asset = matchIntentB[2] ? matchIntentB[2].toUpperCase() : "USDC";
      recipient = matchIntentB[3].replace("@", "").trim();
      destChain = normalizeChainName(matchIntentB[4]);
    } else if (matchIntentC) {
      recipient = matchIntentC[1].replace("@", "").trim();
      rawAmount = parseCleanNumber(matchIntentC[2]);
      asset = matchIntentC[3] ? matchIntentC[3].toUpperCase() : "USDC";
      destChain = normalizeChainName(matchIntentC[4]);
    } else if (matchImplied) {
      rawAmount = parseCleanNumber(matchImplied[1]);
      asset = matchImplied[2].toUpperCase();
      destChain = tokenToChainMap[asset] || "BASE";
      recipient = matchImplied[3].replace("@", "").trim();
    }

    destChain = normalizeChainName(destChain);

    const isFromEvm = /(?:from|via|using|with)\s+(?:the\s+|my\s+)?base/i.test(clean) || (/base/i.test(clean) && isCrossChainAddress(recipient)) || (/base/i.test(clean) && /balance|wallet/i.test(clean));
    const isDirectEvm = isFromEvm && (isCrossChainAddress(recipient) || destChain === "BASE");
    const liveNearPrice = await getLiveNearPrice();
    const requiredNear = asset === "NEAR" ? rawAmount : Number((rawAmount / (liveNearPrice || 3.70)).toFixed(3));

    return {
      tool: "execute_cross_chain_intent",
      args: {
        sourceChain: isDirectEvm ? "BASE" : "NEAR",
        sourceAsset: isDirectEvm ? asset : "NEAR",
        sourceAmount: isDirectEvm ? rawAmount : requiredNear,
        targetChain: destChain,
        targetAsset: asset,
        targetAmount: rawAmount,
        amount: rawAmount,
        recipient,
        recipientHandle: recipient,
        isDirectEvm,
      },
      assistantReply: isDirectEvm
        ? `Preparing direct transfer of ${rawAmount} ${asset} on ${destChain} to ${recipient}...`
        : `Formulating cross-chain intent order via NEAR Intents (Defuse 1Click Solvers). Requesting market-maker auction to deliver ${rawAmount} ${asset} on ${destChain} to @${recipient}...`,
    };
  }

function extractChainHint(input: string): string | undefined {
  const lower = input.toLowerCase();
  if (lower.includes("arbitrum") || lower.includes("arb")) return "arbitrum";
  if (lower.includes("ethereum") || lower.includes("eth mainnet") || (lower.includes("sepolia") && !lower.includes("base"))) return "ethereum";
  if (lower.includes("base")) return "base";
  return undefined;
}

  // Pattern 1A: Target first ("Send web3central.veilx-agent.testnet 0.05 near", "Tip @expatq3 $5", "Send bob.testnet 0.1 NEAR")
  const tipRegexA = /(?:tip|send|transfer)\s+@?([a-zA-Z0-9_.-]+)\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/i;
  const matchA = clean.match(tipRegexA);
  if (matchA && !RESERVED_HANDLES.has(matchA[1].replace("@", "").toLowerCase())) {
    const target = matchA[1].replace("@", "");
    const rawAmount = parseCleanNumber(matchA[2]);
    const specifiedAsset = matchA[3] || (hasDollarSign ? undefined : undefined);

    const val = await resolveIntentValue(rawAmount, specifiedAsset, hasDollarSign);

    const chainHint = extractChainHint(clean);
    const chainLabel = chainHint === "arbitrum" ? "Arbitrum Sepolia" : chainHint === "ethereum" ? "Ethereum Sepolia" : "Base Sepolia";

    if (isNearOnChainAddress(target) || isCrossChainAddress(target) || target.includes(".")) {
      return {
        tool: "direct_transfer",
        args: {
          recipientAddress: target,
          amount: (hasDollarSign || !specifiedAsset) ? rawAmount : val.amount,
          tokenAmount: val.amount,
          asset: val.asset,
          chain: chainHint || "base",
          chainId: chainHint === "arbitrum" ? 421614 : chainHint === "ethereum" ? 11155111 : 84532,
          usdEquivalent: val.usdEquivalent,
          nearEquivalent: val.nearEquivalent,
          nearPriceUsd: val.nearPriceUsd,
          conversionExplanation: val.conversionExplanation,
          isCrossChain: isCrossChainAddress(target),
        },
        assistantReply: `Prepared direct transfer of ${val.amount} ${val.asset} directly to ${target} (${val.conversionExplanation}). Source chain: ${chainLabel} (switchable below). No escrow claim required.`,
      };
    }

    return {
      tool: "tip_handle",
      args: {
        recipientHandle: target,
        amount: (hasDollarSign || !specifiedAsset) ? rawAmount : val.amount,
        tokenAmount: val.amount,
        asset: val.asset,
        usdEquivalent: val.usdEquivalent,
        nearEquivalent: val.nearEquivalent,
        nearPriceUsd: val.nearPriceUsd,
        conversionExplanation: val.conversionExplanation,
      },
      assistantReply: `Prepared tip of ${val.amount} ${val.asset} for @${target} (${val.conversionExplanation}). Executing via your delegated NEAR session key...`,
    };
  }

  // Pattern 1B: Amount first ("Send 0.05 NEAR to web3central.veilx-agent.testnet", "Send $5 to @expatq3", "Transfer 0.1 NEAR to bob.testnet")
  const tipRegexB = /(?:tip|send|transfer)\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(?:to\s+)?@?([a-zA-Z0-9_.-]+)/i;
  const matchB = clean.match(tipRegexB);
  if (matchB && !RESERVED_HANDLES.has(matchB[3].replace("@", "").toLowerCase())) {
    const rawAmount = parseCleanNumber(matchB[1]);
    const specifiedAsset = matchB[2];
    const target = matchB[3].replace("@", "");

    const val = await resolveIntentValue(rawAmount, specifiedAsset, hasDollarSign);

    const chainHint = extractChainHint(clean);
    const chainLabel = chainHint === "arbitrum" ? "Arbitrum Sepolia" : chainHint === "ethereum" ? "Ethereum Sepolia" : "Base Sepolia";

    if (isNearOnChainAddress(target) || isCrossChainAddress(target) || target.includes(".")) {
      return {
        tool: "direct_transfer",
        args: {
          recipientAddress: target,
          amount: (hasDollarSign || !specifiedAsset) ? rawAmount : val.amount,
          tokenAmount: val.amount,
          asset: val.asset,
          chain: chainHint || "base",
          chainId: chainHint === "arbitrum" ? 421614 : chainHint === "ethereum" ? 11155111 : 84532,
          usdEquivalent: val.usdEquivalent,
          nearEquivalent: val.nearEquivalent,
          nearPriceUsd: val.nearPriceUsd,
          conversionExplanation: val.conversionExplanation,
          isCrossChain: isCrossChainAddress(target),
        },
        assistantReply: `Prepared direct transfer of ${val.amount} ${val.asset} directly to ${target} (${val.conversionExplanation}). Source chain: ${chainLabel} (switchable below). No escrow claim required.`,
      };
    }

    return {
      tool: "tip_handle",
      args: {
        recipientHandle: target,
        amount: (hasDollarSign || !specifiedAsset) ? rawAmount : val.amount,
        tokenAmount: val.amount,
        asset: val.asset,
        usdEquivalent: val.usdEquivalent,
        nearEquivalent: val.nearEquivalent,
        nearPriceUsd: val.nearPriceUsd,
        conversionExplanation: val.conversionExplanation,
      },
      assistantReply: `Prepared tip of ${val.amount} ${val.asset} for @${target} (${val.conversionExplanation}). Executing via your delegated NEAR session key...`,
    };
  }

  // Pattern 2: Flexible Multi-Denomination Invoicing & PayLinks
  // Handles: "create a 0.01 Near invoice for @expatq3 for testing", "invoice @jack $25 for Web Design", "paylink 10 NEAR", etc.
  const isInvoiceKeyword = /(?:invoice|paylink|bill|payment\s+request)/i.test(clean);
  if (isInvoiceKeyword) {
    const handleMatch = clean.match(/@([a-zA-Z0-9_]+)/i);
    const client = handleMatch ? handleMatch[1] : undefined;

    let amount = 15;
    let asset = "USD";

    const dollarMatch = clean.match(/\$(\d+(?:\.\d+)?)/);
    const cryptoMatch = clean.match(/(\d+(?:\.\d+)?)\s*(NEAR|USDC|USD)\b/i);
    const fallbackNum = clean.match(/\b(\d+(?:\.\d+)?)\b/);

    if (dollarMatch) {
      amount = parseFloat(dollarMatch[1]);
      asset = "USD";
    } else if (cryptoMatch) {
      amount = parseFloat(cryptoMatch[1]);
      asset = cryptoMatch[2].toUpperCase();
    } else if (fallbackNum) {
      amount = parseFloat(fallbackNum[1]);
      if (/near/i.test(clean)) asset = "NEAR";
      else if (/usdc/i.test(clean)) asset = "USDC";
      else asset = "USD";
    }

    let memo = "Payment Request";
    const withoutHandle = client ? clean.replace(new RegExp(`for\\s+@?${client}\\b|@${client}\\b`, "i"), "") : clean;
    const memoMatch = withoutHandle.match(/\bfor\s+([a-zA-Z0-9_ -]+)$/i);
    if (memoMatch) {
      memo = memoMatch[1].trim();
    }

    const val = await resolveIntentValue(amount, asset, asset === "USD" || clean.includes("$"));
    const amountUsd = asset === "NEAR" ? val.usdEquivalent : (val.usdEquivalent || val.amount || 15.0);
    const invoiceAmount = asset === "NEAR" ? val.amount : amountUsd;

    const reply = asset === "NEAR"
      ? `Generated PayLink for ${invoiceAmount} NEAR (~$${amountUsd.toFixed(2)} USD)${client ? ` targeted to @${client}` : ""}${memo ? ` ("${memo}")` : ""}. Anyone can pay via Base, Solana, or NEAR.`
      : `Generated PayLink for $${amountUsd.toFixed(2)}${client ? ` targeted to @${client}` : ""}${memo ? ` ("${memo}")` : ""}. Anyone can pay via Base, Solana, or NEAR.`;

    return {
      tool: "create_invoice",
      args: {
        clientHandle: client,
        recipientHandle: client,
        amount: invoiceAmount,
        asset,
        amountUsd,
        usdEquivalent: amountUsd,
        nearEquivalent: val.nearEquivalent,
        nearPriceUsd: val.nearPriceUsd,
        memo,
      },
      assistantReply: reply,
    };
  }

  // Pattern 3: Claim ("Claim my tips" or "Withdraw my funds")
  if (/claim(?:\s+my)?\s+(?:tips?|funds?|payouts?)|withdraw\s+(?:my\s+)?funds?/i.test(clean)) {
    return {
      tool: "claim_funds",
      args: {},
      assistantReply: "Checking for your unclaimed tips and invoices on NEAR Escrow...",
    };
  }

  // Pattern 4: Balances & Portfolio Synonyms ("check my balance", "what's my near net worth", "show my stock holdings", "my positions", "view portfolio")
  if (/(?:balance|net\s*worth|holdings|positions|portfolio)/i.test(clean)) {
    if (/(?:stock\s+holdings|holdings|positions|portfolio)/i.test(clean)) {
      return {
        tool: "get_portfolio",
        args: {},
        assistantReply: "Querying your live tokenized equity holdings and active automated trading rules on NEAR...",
      };
    }
    const isBase = /base|evm|eth|sepolia/i.test(clean);
    return {
      tool: "check_balance",
      args: { chain: isBase ? "base" : "all", query: clean },
      assistantReply: isBase
        ? "Querying your live Universal EVM balances (Base · Arbitrum · Ethereum) via NEAR Chain Signatures MPC..."
        : "Querying your live omnichain balances on NEAR Protocol and EVM chains...",
    };
  }

  // Pattern 5: Faucet ("claim testnet tokens", "faucet", "how do I claim testnet tokens", "free near", "need tokens", "get tokens")
  if (/(?:faucet|testnet\s+tokens?|free\s+near|claim\s+testnet|how\s+(?:do\s+i|to)\s+claim\s+testnet|get\s+testnet)/i.test(clean)) {
    return {
      tool: "faucet",
      args: {},
      assistantReply: "Here is the VeilX Testnet Faucet. You can claim 0.25 free testnet NEAR instantly:",
    };
  }

  // Pattern 5B: Chained Bracket Order ("Buy $50 TSLA now and take profit at +10%", "buy 50 TSLA and exit at +12%", "Buy $50 TSLA with 10% take profit")
  const bracketMatch =
    /(?:buy\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s+(?:of\s+)?([A-Za-z0-9_-]+)(?:\s+now)?\s+(?:and|with)\s+(?:take\s+profit|tp|exit\s+at|target)\s+(?:at\s+)?\+?(\d+(?:\.\d+)?)\s*%?)|(?:buy\s+(?:into\s+)?([A-Za-z0-9_-]+)\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s+(?:and|with)\s+(?:take\s+profit|tp|exit\s+at|target)\s+(?:at\s+)?\+?(\d+(?:\.\d+)?)\s*%?)/i.exec(clean);
  if (bracketMatch) {
    const amountUsd = parseCleanNumber(bracketMatch[1] || bracketMatch[5]);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      return { tool: "unknown", args: {}, assistantReply: "Invalid order amount specified." };
    }
    const sym = normalizeStockOrCrypto(bracketMatch[2] || bracketMatch[4] || "TSLA");
    const takeProfitPercent = parseCleanNumber(bracketMatch[3] || bracketMatch[6]) || 10;
    return {
      tool: "create_trading_rule",
      args: {
        symbol: sym,
        type: "bracket_order",
        amountUsd,
        takeProfitPercent,
      },
      assistantReply: `Bracket Order Initialized: Executing immediate market entry of $${amountUsd.toFixed(
        2
      )} ${sym} and arming automated Take-Profit exit rule at +${takeProfitPercent}%. As soon as target is reached, profits are automatically liquidated back into USDC.`,
    };
  }

  // Pattern 5C: Dollar Cost Averaging (DCA) ("DCA $50 into TSLA every minute", "dca 10 into apple every 3 days", "recurring buy $20 SPY every minute")
  const dcaMatch =
    /(?:dca|dollar\s*cost\s*average|recurring\s*buy)\s+(?:into\s+)?\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:into\s+)?([A-Za-z0-9_-]+)(?:\s+(?:every|each|daily|hourly|weekly|min|minute|1m|5m)\s*([a-z0-9\s]*))?/i.exec(clean);
  if (dcaMatch && (clean.toLowerCase().includes("dca") || clean.toLowerCase().includes("recurring"))) {
    const amountUsd = parseCleanNumber(dcaMatch[1]);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      return { tool: "unknown", args: {}, assistantReply: "Invalid DCA amount." };
    }
    const sym = normalizeStockOrCrypto(dcaMatch[2]);
    let cadence: "1m" | "5m" | "hourly" | "daily" | "weekly" = "daily";
    const cl = clean.toLowerCase();
    if (cl.includes("1m") || cl.includes("minute")) cadence = "1m";
    else if (cl.includes("5m") || cl.includes("5 min")) cadence = "5m";
    else if (cl.includes("hour")) cadence = "hourly";
    else if (cl.includes("week")) cadence = "weekly";
    else if (cl.includes("day")) cadence = "daily";

    const cadenceLabel =
      cadence === "1m"
        ? "every minute (Fast Testnet Mode)"
        : cadence === "5m"
        ? "every 5 minutes"
        : cadence === "hourly"
        ? "every hour"
        : cadence === "weekly"
        ? "every week"
        : "daily";

    return {
      tool: "create_trading_rule",
      args: {
        symbol: sym,
        type: "recurring_buy",
        amountUsd,
        cadence,
      },
      assistantReply: `Automated DCA Rule Activated: I will automatically buy $${amountUsd.toFixed(
        2
      )} of ${sym} ${cadenceLabel} in your Paper Trading Sandbox using real-time oracle quotes.`,
    };
  }

  // Pattern 6: Trading Rules ("Buy $100 TSLA when it drops below $340", "Take profit on NVDA at +10%", "Stop loss on NVDA at -5%")
  const stopLossMatch = /(?:set\s+)?stop\s+loss\s+(?:on\s+)?([A-Za-z0-9_-]+)\s+at\s+(?:below\s+)?\$?(-?[0-9.]+)\s*(%?)/i.exec(clean);
  if (stopLossMatch) {
    const sym = normalizeStockOrCrypto(stopLossMatch[1]);
    const rawVal = Math.abs(parseCleanNumber(stopLossMatch[2]));
    const isPercent = stopLossMatch[3] === "%" || rawVal < 50;
    return {
      tool: "create_trading_rule",
      args: {
        symbol: sym,
        type: "stop_loss",
        targetPercent: isPercent ? rawVal : undefined,
        targetPrice: !isPercent ? rawVal : undefined,
        amountUsd: 100,
      },
      assistantReply: `Stop-Loss Rule Armed: Monitoring ${sym} to harvest position if it breaches -${rawVal}${isPercent ? "%" : " USD"}.`,
    };
  }

  const ruleMatchA = /(?:take\s+profit\s+(?:on\s+)?([A-Za-z0-9_-]+)\s+at\s+\+?(\d+(?:\.\d+)?)\s*%)/i.exec(clean);
  if (ruleMatchA) {
    const sym = normalizeStockOrCrypto(ruleMatchA[1]);
    const targetPercent = parseCleanNumber(ruleMatchA[2]) || 10;
    return {
      tool: "create_trading_rule",
      args: {
        symbol: sym,
        type: "take_profit",
        targetPercent,
        amountUsd: 100,
      },
      assistantReply: `Activated take-profit rule for ${sym} at +${targetPercent}%. I will automatically harvest profits and rebalance into liquid USDC on NEAR when triggered.`,
    };
  }

  const ruleMatchB = /(?:buy\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s+([A-Za-z0-9_-]+)\s+(?:when|if)\s+(?:it\s+)?(?:drops|dips)\s+below\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?))/i.exec(clean);
  if (ruleMatchB) {
    const amountUsd = parseCleanNumber(ruleMatchB[1]);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      return { tool: "unknown", args: {}, assistantReply: "Invalid order amount specified." };
    }
    const sym = normalizeStockOrCrypto(ruleMatchB[2]);
    const targetPrice = parseCleanNumber(ruleMatchB[3]) || 340;
    return {
      tool: "create_trading_rule",
      args: {
        symbol: sym,
        type: "buy_dip",
        amountUsd,
        targetPrice,
      },
      assistantReply: `Activated automated dip-buy rule for ${sym}. When the price drops below $${targetPrice.toFixed(2)}, I will automatically execute a $${amountUsd.toFixed(2)} buy order on NEAR via Defuse 1Click solvers.`,
    };
  }

  // Pattern 7: Direct Stock Trade ("Buy $50 AAPL now", "Buy $1,000 TSLA", "Sell 20 of NVDAon", "buy $0 TSLA")
  const tradeMatch = /(?:^(?:buy|sell|trade)\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s+(?:of\s+)?([A-Za-z0-9_-]+)(?:\s+now)?$)/i.exec(clean);
  if (tradeMatch) {
    const isSell = /^sell/i.test(clean);
    const amountUsd = parseCleanNumber(tradeMatch[1]);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      return { tool: "unknown", args: {}, assistantReply: "Invalid trade amount. Amount must be greater than zero." };
    }
    const sym = normalizeStockOrCrypto(tradeMatch[2]);
    return {
      tool: "trade_stock",
      args: {
        symbol: sym,
        action: isSell ? "sell" : "buy",
        amountUsd,
      },
      assistantReply: `I have prepared a ${isSell ? "SELL" : "BUY"} order for $${amountUsd.toFixed(2)} of ${sym} on NEAR via Defuse 1Click solvers. Zero slippage execution.`,
    };
  }

  // Pattern 8: Portfolio ("show my portfolio", "my portfolio", "portfolio summary")
  if (/(?:show\s+my\s+portfolio|my\s+portfolio|portfolio\s+summary|view\s+portfolio)/i.test(clean)) {
    return {
      tool: "get_portfolio",
      args: {},
      assistantReply: "Querying your live tokenized equity holdings and active automated trading rules on NEAR...",
    };
  }

  // Pattern 9: Real-Time Crypto & Stock Market Price Resolution
  // Handles: "near price", "btc price", "tsla price", "price of near", "how much is btc", "quote aapl", "what is nvda", "check sol", "spy price"
  const priceRegexA = /(?:what\s+is\s+the\s+price\s+of|what's\s+the\s+price\s+of|price\s+of|how\s+much\s+is|check\s+price\s+of|check|quote\s+for|what\s+is|what's)\s+([A-Za-z0-9_.-]+)(?:\s+price|\s+worth|\s+cost)?/i;
  const priceRegexB = /^([A-Za-z0-9_.-]+)\s+(?:price|current\s+price|worth|cost|quote)$/i;
  const priceRegexC = /^(?:price|quote)\s+([A-Za-z0-9_.-]+)$/i;

  const matchPriceA = clean.match(priceRegexA);
  const matchPriceB = clean.match(priceRegexB);
  const matchPriceC = clean.match(priceRegexC);
  const priceMatch = matchPriceA || matchPriceB || matchPriceC;

  if (priceMatch) {
    const candidate = (priceMatch[1] || "").replace(/[\?\.]$/, "").trim();
    if (!["my", "the", "a", "an", "your", "this", "that", "it"].includes(candidate.toLowerCase())) {
      const marketData = await fetchMarketPrice(candidate);
      if (marketData) {
        return {
          tool: "get_market_price",
          args: marketData,
          assistantReply: `**${marketData.name} (${marketData.symbol})** is currently trading at **$${marketData.priceUsd.toLocaleString(undefined, { minimumFractionDigits: marketData.priceUsd < 1 ? 4 : 2 })} USD** (${marketData.change24h >= 0 ? "+" : ""}${marketData.change24h}% 24h).${marketData.trend ? ` Market trend: **${marketData.trend.toUpperCase()}**.` : ""}${marketData.category === "stock" || marketData.category === "etf" ? " Available for 24/7 trading on NEAR via Ondo tokenized equities and Defuse 1Click solvers." : ""}`,
        };
      }
    }
  }

  if (isTerminal) {
    return {
      tool: "unknown",
      args: {},
      assistantReply: "I'm your VeilX Trading Copilot. I execute tokenized US equity orders (TSLAon, NVDAon, AAPLon, SPYon), manage conditional automated rules (buy dip, take profit, stop loss), and track your portfolio. You can also ask me for real-time stock and crypto prices.",
    };
  }

  return {
    tool: "unknown",
    args: {},
    assistantReply: "I'm your VeilX autonomous social finance copilot. You can ask me questions about your multichain accounts, tip any 𝕏 handle (e.g. 'Tip @expatq3 5 USDC'), create cross-chain PayLinks (e.g. 'Invoice $20 for Design'), query live prices, or check your balances across NEAR and EVM chains. How can I help you?",
  };
}

export function isFinancialQuery(prompt: string): boolean {
  return /(?:tip|send|transfer|pay|invoice|paylink|bill|swap|intent|withdraw|claim|faucet|deposit|balance|spend|funds|tokens?|buy|sell|trade|stock|shares|invest|portfolio|dca|rule|take.?profit|dip|limit|order)/i.test(prompt);
}

export const NEAR_AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "tip_handle",
      description: "Send a social tip to an X (Twitter) handle via NEAR scoped session key",
      parameters: {
        type: "object",
        properties: {
          recipientHandle: { type: "string", description: "The X handle without @" },
          amount: { type: "number", description: "Amount in USD or tokens" },
          asset: { type: "string", description: "Asset ticker (e.g. USDC, NEAR)" },
        },
        required: ["recipientHandle", "amount"],
      },
    },
  },
  {
    type: "function",
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
    type: "function",
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
          sourceChain: { type: "string", description: "Source blockchain (default NEAR)" },
          sourceAmount: { type: "number", description: "Source amount to spend" },
          targetAmount: { type: "number", description: "Target amount to deliver" },
          isDirectEvm: { type: "boolean", description: "Whether direct EVM transfer" },
        },
        required: ["amount", "targetAsset", "targetChain", "recipient"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description: "Generate a universal multichain PayLink that settles directly into the user's NEAR wallet. Accepts amounts in USD, USDC, or native crypto like NEAR.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount requested in USD or crypto like NEAR" },
          amountUsd: { type: "number", description: "Amount in USD equivalent" },
          asset: { type: "string", description: "Asset currency: NEAR, USDC, or USD" },
          memo: { type: "string", description: "Memo or purpose" },
          recipientHandle: { type: "string", description: "Optional client handle without @" },
          clientHandle: { type: "string", description: "Optional client handle without @" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
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
    type: "function",
    function: {
      name: "claim_funds",
      description: "Claim pending tips gaslessly via NEP-366",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
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
    type: "function",
    function: {
      name: "faucet",
      description: "Claim 0.25 free testnet NEAR tokens from VeilX Faucet to test payments",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market_price",
      description: "Fetch real-time market quotes and 24h performance for crypto (NEAR, BTC, ETH, SOL) or tokenized stocks (TSLAon, NVDAon, AAPLon, SPYon)",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol to query (e.g. NEAR, BTC, ETH, TSLA, NVDA, AAPL)" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trade_stock",
      description: "Execute or prepare a market order to buy or sell tokenized US equities (TSLAon, NVDAon, AAPLon, SPYon) on NEAR via Defuse 1Click solvers",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock symbol (e.g. TSLAon, NVDAon)" },
          action: { type: "string", description: "Order action: 'buy' or 'sell'" },
          amountUsd: { type: "number", description: "Dollar amount to allocate" },
        },
        required: ["symbol", "action", "amountUsd"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_trading_rule",
      description: "Set an automated trading rule (buy dip, take profit, stop loss, DCA recurring buy, bracket order)",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock symbol (e.g. TSLAon, NVDAon)" },
          type: { type: "string", enum: ["buy_dip", "take_profit", "stop_loss", "recurring_buy", "bracket_order"], description: "Rule type" },
          targetPrice: { type: "number", description: "Target trigger price in USD" },
          targetPercent: { type: "number", description: "Target percent" },
          takeProfitPercent: { type: "number", description: "Take profit target percent for bracket orders" },
          amountUsd: { type: "number", description: "Dollar amount to allocate when triggered" },
          cadence: { type: "string", enum: ["1m", "5m", "hourly", "daily", "weekly"], description: "Cadence for recurring buy" },
        },
        required: ["symbol", "type", "amountUsd"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_portfolio",
      description: "View user's current tokenized stock holdings, cash balance, and active trading rules",
      parameters: { type: "object", properties: {} },
    },
  },
];

export interface HybridAIOptions {
  history?: { role: string; content: string }[];
  nearAiApiKey?: string;
  geminiApiKey?: string;
  preferTee?: boolean;
  timeoutMs?: number; // Defaults to 2500ms for TEE circuit breaker
  mode?: "social" | "terminal";
}

/**
 * Executes prompt inside NEAR AI Cloud Hardware TEE Enclave.
 * Target: https://api.near.ai/v1/chat/completions
 * Model: meta-llama/Llama-3.3-70B-Instruct
 */
export async function callNearAICloud(
  prompt: string,
  history: { role: string; content: string }[] = [],
  apiKey?: string,
  timeoutMs = 2500
): Promise<ToolCallResult | null> {
  const activeKey = apiKey || process.env.NEAR_AI_API_KEY;
  if (!activeKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formattedMessages = [
      {
        role: "system",
        content: "You are VeilX Agent running in a confidential NEAR AI Cloud Hardware TEE Enclave. Parse financial intent with cryptographic precision. Output structured function calls whenever actions are requested.",
      },
      ...history
        .filter((m) => m.content && m.content.trim())
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content.trim(),
        })),
      { role: "user", content: prompt.trim() },
    ];

    const model = process.env.NEAR_AI_MODEL || "meta-llama/Llama-3.3-70B-Instruct";
    const res = await fetch("https://api.near.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        tools: NEAR_AI_TOOLS,
        tool_choice: "auto",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[NEAR AI TEE] Returned non-ok status: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall) {
      const name = toolCall.function.name as ToolCallResult["tool"];
      const args = JSON.parse(toolCall.function.arguments || "{}");
      return {
        tool: name,
        args,
        assistantReply: choice.message.content || `Executing ${name} inside NEAR AI Cloud TEE enclave...`,
        engine: `near-ai-tee-${model}`,
        isTeeEnclave: true,
      };
    }

    if (choice?.message?.content) {
      return {
        tool: "unknown",
        args: {},
        assistantReply: choice.message.content,
        engine: `near-ai-tee-${model}`,
        isTeeEnclave: true,
      };
    }

    return null;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.warn(`[NEAR AI TEE] Circuit Breaker Tripped: Request exceeded ${timeoutMs}ms timeout`);
    } else {
      console.warn("[NEAR AI TEE] Enclave call failed:", err);
    }
    return null;
  }
}

/**
 * Google Gemini 2.5 Flash client for sub-second conversational responses (<400ms).
 */
export async function callGeminiFlash(
  prompt: string,
  history: { role: string; content: string }[] = [],
  apiKey?: string,
  timeoutMs = 3000
): Promise<ToolCallResult | null> {
  const activeKey = apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!activeKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are the VeilX Autonomous Finance Copilot on NEAR Protocol. Your tone is institutional, precise, and professional. Never use emojis. When listing items, format cleanly with standard markdown bullets (- Item). Do not output stray asterisks.",
            },
          ],
        },
        contents: [
          ...history.map((h) => ({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }],
          })),
          { role: "user", parts: [{ text: prompt }] },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: any) => p.text);

    if (textPart?.text) {
      return {
        tool: "unknown",
        args: {},
        assistantReply: textPart.text,
        engine: "gemini-2.5-flash",
      };
    }

    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Hybrid AI Routing Gateway:
 * Intelligently classifies requests and routes financial commands to NEAR AI Cloud (TEE Enclaves)
 * with a 2500ms circuit breaker that falls back to Gemini / deterministic processing.
 */
export async function routeHybridAI(
  prompt: string,
  options: HybridAIOptions = {}
): Promise<ToolCallResult> {
  const isFinancial = isFinancialQuery(prompt);
  const nearKey = options.nearAiApiKey || process.env.NEAR_AI_API_KEY;
  const timeoutMs = options.timeoutMs || 2500;

  // 1. If financial query AND NEAR AI key configured (or user requested TEE):
  if (isFinancial && (nearKey || options.preferTee)) {
    try {
      const teeResult = await callNearAICloud(prompt, options.history, nearKey, timeoutMs);
      if (teeResult) {
        return teeResult;
      }
    } catch (e) {
      console.warn("[Hybrid AI Gateway] TEE Enclave call failed, activating speed circuit breaker:", e);
    }

    // Circuit Breaker Fallback: Fast deterministic parsing tagged with fallback metadata
    const localFallback = await processUserMessage(prompt, options.history, options.mode);
    return {
      ...localFallback,
      engine: "deterministic-assisted (TEE speed fallback)",
      isSpeedFallback: true,
    };
  }

  // 2. High-speed path (<1ms): Deterministic parser for recognized commands
  const fastMatch = await processUserMessage(prompt, options.history, options.mode);
  if (fastMatch.tool !== "unknown") {
    return {
      ...fastMatch,
      engine: "deterministic-fastpath",
    };
  }

  // 3. Conversational / General Query: Gemini Flash (<400ms)
  const geminiResult = await callGeminiFlash(prompt, options.history, options.geminiApiKey);
  if (geminiResult) {
    return geminiResult;
  }

  // 4. Ultimate fallback
  return fastMatch;
}
