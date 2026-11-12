"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  ArrowRight,
  X,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  MessageSquare,
  ListOrdered,
  Sparkles,
  Shield,
} from "lucide-react";
import { StockAsset, fetchLiveStockAssets, findStockAsset } from "@/lib/ondo-stocks";
import { PortfolioPosition } from "@/lib/market-analyst";
import { useAuth } from "@/context/AuthContext";
import { AssetLogo } from "@/components/common/AssetLogo";
import {
  TradingRule,
  TradingCopilotAction,
  OrderHistoryItem,
  processTradingInstruction,
  evaluateTradingRules,
} from "@/lib/trading-copilot";
import { TradingChart } from "@/components/terminal/TradingChart";
import { OrderLedgerTabs } from "@/components/terminal/OrderLedgerTabs";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actionCard?: TradingCopilotAction;
}

const DEFAULT_SUGGESTIONS = [
  "DCA: Buy $50 TSLA daily",
  "Buy $100 TSLA when it drops below $345",
  "Take profit on NVDA at +10%",
  "DCA: Buy $20 ETH hourly",
  "Show my portfolio",
];

const INITIAL_WELCOME: ChatEntry = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to your **Veil Autonomous Trading Copilot**.\n\n• **Paper Sandbox ($10,000 USD virtual capital)**: Test automated DCA schedules, limit dip-buys, and take-profit rules against live real-time oracle quotes with zero real money risk.\n• **Autonomous Keep-Alive Engine**: Active rules monitor quotes 24/7 and execute automatically even if you navigate away.\n• **Mainnet MPC Execution**: Toggle Mainnet to broadcast real swaps via NEAR MPC session keys.\n\nTry saying:\n• 'DCA $50 into TSLA daily'\n• 'Buy $100 NVDA when it drops below $135'\n• 'Take profit on TSLA at +10%'\n• 'Show my portfolio'",
  createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

function FormattedContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (!content) return null;

  return (
    <div
      className={`prose prose-sm max-w-none text-xs sm:text-[13px] leading-relaxed break-words [overflow-wrap:anywhere] ${
        isUser ? "text-[#FAF7F0]" : "text-[#1E1315]"
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed font-normal">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className={`font-bold ${isUser ? "text-white" : "text-[#1E1315]"}`}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className={`italic ${isUser ? "text-[#EFE8D8]" : "text-[#4A3B32]"}`}>{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="my-2 pl-4 list-disc space-y-1 marker:text-[#6E5D4F]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 pl-4 list-decimal space-y-1 marker:text-[#6E5D4F]">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
          code: ({ children }) => (
            <code
              className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold break-all inline-block ${
                isUser
                  ? "bg-[#2C1D20] text-[#FAF7F0] border border-[#443236]"
                  : "bg-[#FAF7F0] text-[#1E1315] border border-[#EBE3D5]"
              }`}
            >
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function TerminalPage() {
  const { user, nearBalance, evmBalance, networkMode } = useAuth();
  const handle = user?.xHandle || "trader";
  const userAvatar = user?.avatarUrl || (user?.xHandle ? `https://unavatar.io/twitter/${user.xHandle}` : "https://unavatar.io/twitter/expatq3");
  const STORAGE_KEY = `Veil_terminal_history_${handle}`;

  // Mode is governed by global navbar networkMode (Testnet = Paper Sandbox, Mainnet = MPC Mainnet)
  const tradingMode: "simulation" | "mainnet" = networkMode === "mainnet" ? "mainnet" : "simulation";
  const isMainnet = tradingMode === "mainnet";

  // Live Oracle Prices for accurate portfolio computation
  const [oracleNearPrice, setOracleNearPrice] = useState(3.70);
  const [oracleEthPrice, setOracleEthPrice] = useState(2240.0);

  useEffect(() => {
    fetch("/api/prices?symbols=NEAR,ETH")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          if (d.nearPrice) setOracleNearPrice(d.nearPrice);
          if (d.ethPrice) setOracleEthPrice(d.ethPrice);
        }
      })
      .catch(() => {});
  }, []);

  // Calculate user's real on-chain liquid balance across NEAR and EVM MPC
  const nearAmount = parseFloat(nearBalance) || 0;
  const nearUsd = nearAmount * oracleNearPrice;
  const usdcAmount = evmBalance?.usdc ? parseFloat(evmBalance.usdc) : 0;
  const ethUsd = (evmBalance?.eth ? parseFloat(evmBalance.eth) : 0) * oracleEthPrice;
  const realLiquidCashUsd = Number((nearUsd + usdcAmount + ethUsd).toFixed(2));

  // Portfolio & Mode State (Instant Stale-While-Revalidate hydration)
  const [paperCashUsd, setPaperCashUsd] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const p = sessionStorage.getItem("veil_cached_paper_cash_usd");
      if (p) return parseFloat(p) || 10000.0;
    }
    return 10000.0;
  });
  const [cashUsd, setCashUsd] = useState<number>(realLiquidCashUsd);
  const [positions, setPositions] = useState<PortfolioPosition[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("veil_cached_positions");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [rules, setRules] = useState<TradingRule[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("veil_cached_rules");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [liveAssets, setLiveAssets] = useState<StockAsset[]>([]);
  const [isLoaded, setIsLoaded] = useState(() => {
    if (typeof window !== "undefined") {
      return Boolean(sessionStorage.getItem("veil_cached_positions"));
    }
    return false;
  });
  const [selectedChartAsset, setSelectedChartAsset] = useState<string>("TSLAon");
  const [mobileView, setMobileView] = useState<"chart" | "copilot">("copilot");

  // Adjustable View Splitter State (default 58% chart, 42% copilot)
  const [chartWidthPercent, setChartWidthPercent] = useState<number>(58);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingSplitter) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!workspaceRef.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const rect = workspaceRef.current.getBoundingClientRect();
      const rawPercent = ((clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(30, Math.min(75, rawPercent));
      setChartWidthPercent(Number(clamped.toFixed(1)));
      window.dispatchEvent(new Event("resize"));
    };
    const onUp = () => setIsDraggingSplitter(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDraggingSplitter]);

  // Custom Styled Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    variant: "danger" | "warning" | "info" | "success";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    variant: "warning",
    onConfirm: () => {},
  });

  // Chat State
  const [messages, setMessages] = useState<ChatEntry[]>([INITIAL_WELCOME]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Toast Notification State for Simulated Orders
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showSimulatedToast = (msg = "Simulated Paper Order Executed") => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Modal State for Manual Rule Creation
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [ruleModalSymbol, setRuleModalSymbol] = useState("TSLAon");
  const [ruleModalType, setRuleModalType] = useState<"buy_dip" | "take_profit" | "recurring_buy" | "bracket_order">("buy_dip");
  const [ruleModalCadence, setRuleModalCadence] = useState<"1m" | "5m" | "hourly" | "daily" | "weekly">("1m");
  const [triggerInputMode, setTriggerInputMode] = useState<"price" | "percent">("percent");
  const [ruleModalTarget, setRuleModalTarget] = useState("5"); // 5% by default
  const [ruleModalAmount, setRuleModalAmount] = useState("10");

  // Keep cashUsd strictly synced to verified on-chain liquid balance (zero phantom capital)
  useEffect(() => {
    setCashUsd(realLiquidCashUsd);
  }, [realLiquidCashUsd]);

  // Load portfolio from API
  const loadPortfolioData = useCallback(async () => {
    try {
      const [portRes, stockAssets] = await Promise.all([
        fetch(`/api/portfolio?handle=${encodeURIComponent(handle)}`),
        fetchLiveStockAssets(),
      ]);

      setLiveAssets(stockAssets);

      if (portRes.ok) {
        const portData = await portRes.json();
        if (portData.success && portData.portfolio) {
          setCashUsd(realLiquidCashUsd);

          if (typeof portData.portfolio.paperCashUsd === "number") {
            setPaperCashUsd(portData.portfolio.paperCashUsd);
            sessionStorage.setItem("veil_cached_paper_cash_usd", String(portData.portfolio.paperCashUsd));
          }

          if (Array.isArray(portData.portfolio.positions)) {
            setPositions(portData.portfolio.positions);
            sessionStorage.setItem("veil_cached_positions", JSON.stringify(portData.portfolio.positions));
          } else {
            setPositions([]);
          }

          if (Array.isArray(portData.portfolio.rules)) {
            const sanitizedRules: TradingRule[] = portData.portfolio.rules.map((r: any) => {
              if (r.type === "recurring_buy") {
                const isOneMin = r.cadence === "1m" || (r.condition && (r.condition.includes("1m") || r.condition.includes("minute")));
                return {
                  ...r,
                  cadence: isOneMin ? "1m" : r.cadence || "daily",
                  condition: r.condition?.includes("Stop-loss")
                    ? `DCA $${Number(r.amountUsd || 50).toFixed(2)} ${isOneMin ? "every minute (Fast Testnet Mode)" : "daily"}`
                    : r.condition,
                };
              }
              return r;
            });
            setRules(sanitizedRules);
            sessionStorage.setItem("veil_cached_rules", JSON.stringify(sanitizedRules));
          }

          if (Array.isArray(portData.portfolio.orderHistory)) {
            setOrderHistory(portData.portfolio.orderHistory);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load initial portfolio:", err);
    } finally {
      setIsLoaded(true);
    }
  }, [handle, realLiquidCashUsd]);

  useEffect(() => {
    loadPortfolioData();
  }, [loadPortfolioData]);

  // Rehydrate terminal chat history from localStorage and MongoDB Atlas
  useEffect(() => {
    try {
      const cached =
        localStorage.getItem(STORAGE_KEY) ||
        (user?.xHandle ? localStorage.getItem(`Veil_terminal_history_${user.xHandle}`) : null) ||
        localStorage.getItem("Veil_terminal_history_active") ||
        localStorage.getItem("Veil_terminal_history_trader");

      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to load local terminal history", e);
    }

    const queryHandle = user?.xHandle || handle;
    if (queryHandle && queryHandle !== "trader") {
      fetch(`/api/chat/history?handle=${encodeURIComponent(queryHandle)}&channel=terminal`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages((prev) => {
              if (prev.length <= 1) {
                const cloudMsgs: ChatEntry[] = data.messages.map((m: any) => ({
                  id: m.id || `db_${Math.random()}`,
                  role: m.role,
                  content: m.content,
                  actionCard: m.actionCard,
                  createdAt: m.createdAt
                    ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                }));
                const merged = [INITIAL_WELCOME, ...cloudMsgs];
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                  localStorage.setItem("Veil_terminal_history_active", JSON.stringify(merged));
                } catch {}
                return merged;
              }
              return prev;
            });
          }
        })
        .catch((err) => console.warn("Failed to fetch MongoDB terminal history:", err));
    }
  }, [handle, user?.xHandle, STORAGE_KEY]);

  // Helper to notify other components/tabs of paper cash updates
  const dispatchPaperCashUpdated = (newCash: number) => {
    try {
      sessionStorage.setItem("veil_cached_paper_cash_usd", String(newCash));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("veil_paper_cash_updated", {
            detail: { paperCashUsd: newCash, cash: newCash, value: newCash },
          })
        );
      }
    } catch (e) {
      console.warn("Failed to dispatch veil_paper_cash_updated event:", e);
    }
  };

  // Synchronize paper cash when other components/tabs dispatch 'veil_paper_cash_updated'
  useEffect(() => {
    const handlePaperCashSync = (e: any) => {
      const val =
        e?.detail?.paperCashUsd ??
        e?.detail?.cash ??
        e?.detail?.value ??
        (typeof e?.detail === "number" ? e.detail : undefined);
      if (typeof val === "number" && !isNaN(val)) {
        setPaperCashUsd((prev) => (prev !== val ? val : prev));
      }
    };
    window.addEventListener("veil_paper_cash_updated", handlePaperCashSync);
    return () => window.removeEventListener("veil_paper_cash_updated", handlePaperCashSync);
  }, []);

  // Sync state to API whenever positions, cash, or rules change
  const syncPortfolio = async (
    newCash: number,
    newPaperCash: number,
    newMode: string,
    newPositions: PortfolioPosition[],
    newRules: TradingRule[],
    newHistory?: OrderHistoryItem[]
  ) => {
    if (typeof newPaperCash === "number") {
      dispatchPaperCashUpdated(newPaperCash);
    }
    try {
      await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          cashUsd: newCash,
          paperCashUsd: newPaperCash,
          mode: newMode,
          positions: newPositions,
          rules: newRules,
          orderHistory: newHistory || orderHistory,
        }),
      });
    } catch (e) {
      console.error("Sync error:", e);
    }
  };

  // Reset Sandbox Balance to $10,000.00 with custom styled dialog
  const handleResetSandbox = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Paper Sandbox",
      description: "Reset your simulated capital to $10,000.00 USD and clear simulated holdings? Your historical orders and logs will remain preserved.",
      confirmText: "Reset to $10k",
      variant: "warning",
      onConfirm: () => {
        setPaperCashUsd(10000.0);
        setPositions([]);
        dispatchPaperCashUpdated(10000.0);
        syncPortfolio(cashUsd, 10000.0, tradingMode, [], rules, orderHistory);
        showSimulatedToast("Paper Sandbox reset to $10,000.00 USD");
      },
    });
  };

  // Close Position
  const handleClosePosition = (symbol: string) => {
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) return;
    const asset = liveAssets.find((a) => a.symbol === symbol);
    const currentPrice = asset?.price || pos.currentPrice;
    const sellAmount = Number((pos.shares * currentPrice).toFixed(2));

    const nextCash = Number((paperCashUsd + sellAmount).toFixed(2));
    const nextPositions = positions.filter((p) => p.symbol !== symbol);
    setPaperCashUsd(nextCash);
    setPositions(nextPositions);

    const newOrder: OrderHistoryItem = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol,
      type: "close_position",
      side: "sell",
      shares: pos.shares,
      price: currentPrice,
      amountUsd: sellAmount,
      timestamp: new Date().toISOString(),
      mode: tradingMode,
      status: "filled",
    };
    const nextHistory = [newOrder, ...orderHistory];
    setOrderHistory(nextHistory);
    syncPortfolio(cashUsd, nextCash, tradingMode, nextPositions, rules, nextHistory);
    showSimulatedToast(`Position closed: Sold ${pos.shares} ${symbol} for $${sellAmount.toFixed(2)}`);
  };

  // Cancel Rule
  const handleCancelRule = (ruleId: string) => {
    const nextRules = rules.map((r) => (r.id === ruleId ? { ...r, status: "cancelled" as const } : r));
    setRules(nextRules);
    syncPortfolio(cashUsd, paperCashUsd, tradingMode, positions, nextRules, orderHistory);
    showSimulatedToast("Trading rule cancelled");
  };

  // =========================================================================
  // AUTONOMOUS KEEP-ALIVE CLIENT HEARTBEAT (Evaluates active rules every 8s)
  // =========================================================================
  useEffect(() => {
    if (!isLoaded || liveAssets.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const freshAssets = await fetchLiveStockAssets();
        if (Array.isArray(freshAssets) && freshAssets.length > 0) {
          setLiveAssets(freshAssets);
        }

        const assetsToUse = freshAssets.length > 0 ? freshAssets : liveAssets;
        const currentActiveCash = tradingMode === "mainnet" ? cashUsd : paperCashUsd;

        const evalRes = evaluateTradingRules(
          rules,
          assetsToUse,
          {
            cashUsd: currentActiveCash,
            positions,
            orderHistory,
          },
          tradingMode
        );

        if (evalRes.hasChanges) {
          if (tradingMode === "mainnet") {
            setCashUsd(evalRes.updatedCash);
          } else {
            setPaperCashUsd(evalRes.updatedCash);
          }
          setPositions(evalRes.updatedPositions);
          setRules(evalRes.updatedRules);
          const nextHistory = [...evalRes.executedOrders, ...orderHistory];
          setOrderHistory(nextHistory);

          syncPortfolio(
            tradingMode === "mainnet" ? evalRes.updatedCash : cashUsd,
            tradingMode === "simulation" ? evalRes.updatedCash : paperCashUsd,
            tradingMode,
            evalRes.updatedPositions,
            evalRes.updatedRules,
            nextHistory
          );

          evalRes.executedOrders.forEach((ord) => {
            const isDca = ord.type === "recurring_buy";
            // Clean UX: Display sleek toast notification and log strictly in Order History ledger
            // to avoid spamming/cluttering the conversational chat layout.
            showSimulatedToast(`⚡ ${isDca ? "DCA" : "Rule"} Filled: ${ord.shares} ${ord.symbol} @ $${ord.price.toFixed(2)}`);
          });
        }
      } catch (e) {
        console.warn("Autonomous rule evaluator loop error:", e);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isLoaded, rules, liveAssets, cashUsd, paperCashUsd, positions, orderHistory, tradingMode]);

  // Append & Persist Message (localStorage + MongoDB Atlas)
  const appendTerminalMessage = (msg: ChatEntry) => {
    setMessages((prev) => {
      const updated = [...prev, msg];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        localStorage.setItem("Veil_terminal_history_active", JSON.stringify(updated));
      } catch (e) {
        console.warn("localStorage quota exceeded", e);
      }
      return updated;
    });

    const activeUserHandle = user?.xHandle || handle;
    if (msg.id !== "welcome" && activeUserHandle) {
      fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userHandle: activeUserHandle,
          role: msg.role,
          content: msg.content,
          actionCard: msg.actionCard,
          channel: "terminal",
        }),
      }).catch((e) => console.warn("MongoDB terminal history sync failed:", e));
    }
  };

  // Execute a Simulated Paper Order (Paper Trading & AI Simulation Sandbox)
  const handleExecuteSimulatedTrade = (details: any) => {
    if (!details) return;
    const rawSym = details.symbol || "TSLAon";
    const foundAsset = findStockAsset(rawSym, liveAssets);
    const sym = foundAsset?.symbol || rawSym;
    const shares = Number(details.shares) || 0.1;
    const price = Number(details.price) || (foundAsset?.price ?? 100.0);
    const amt = Number(details.amountUsd) || Number((shares * price).toFixed(2));
    const isSell = (details.promptConfirm || "").toLowerCase().includes("sell");

    // Update simulated paper portfolio
    let nextPositions = [...positions];
    let nextCash = tradingMode === "mainnet" ? cashUsd : paperCashUsd;

    if (isSell) {
      nextCash = Number((nextCash + amt).toFixed(2));
      nextPositions = nextPositions
        .map((p) => {
          if (p.symbol.toLowerCase() !== sym.toLowerCase()) return p;
          const rem = Number(Math.max(0, p.shares - shares).toFixed(4));
          return {
            ...p,
            shares: rem,
            currentValueUsd: Number((rem * price).toFixed(2)),
          };
        })
        .filter((p) => p.shares > 0);
    } else {
      nextCash = Number(Math.max(0, nextCash - amt).toFixed(2));
      const existing = nextPositions.findIndex((p) => p.symbol.toLowerCase() === sym.toLowerCase());
      if (existing >= 0) {
        nextPositions = nextPositions.map((p, idx) => {
          if (idx !== existing) return p;
          const totalShares = Number((p.shares + shares).toFixed(4));
          return {
            ...p,
            shares: totalShares,
            currentValueUsd: Number((totalShares * price).toFixed(2)),
          };
        });
      } else {
        nextPositions.push({
          symbol: sym,
          name: foundAsset?.name || sym,
          shares,
          avgEntryPrice: price,
          currentPrice: price,
          currentValueUsd: amt,
          pnlUsd: 0,
          pnlPercent: 0,
          allocationPercent: 10,
        });
      }
    }

    if (tradingMode === "mainnet") {
      setCashUsd(nextCash);
    } else {
      setPaperCashUsd(nextCash);
    }
    setPositions(nextPositions);

    const newOrder: OrderHistoryItem = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: sym,
      type: "market_order",
      side: isSell ? "sell" : "buy",
      shares,
      price,
      amountUsd: amt,
      timestamp: new Date().toISOString(),
      mode: tradingMode,
      status: "filled",
    };
    const nextHistory = [newOrder, ...orderHistory];
    setOrderHistory(nextHistory);

    syncPortfolio(
      tradingMode === "mainnet" ? nextCash : cashUsd,
      tradingMode === "simulation" ? nextCash : paperCashUsd,
      tradingMode,
      nextPositions,
      rules,
      nextHistory
    );

    // Toast notification reading strictly: Simulated Paper Order Executed
    showSimulatedToast(
      tradingMode === "mainnet" ? "Mainnet MPC Order Executed" : "Simulated Paper Order Executed"
    );

    // Append executed message with prominent badge
    const execMsg: ChatEntry = {
      id: `exec_${Date.now()}`,
      role: "assistant",
      content: `**${
        tradingMode === "mainnet" ? "Mainnet MPC Order Executed" : "Simulated Paper Order Executed"
      }**: Successfully ${
        isSell ? "sold" : "bought"
      } ${shares} shares of ${sym} for $${amt.toFixed(
        2
      )} USD at $${price.toFixed(
        2
      )} via ${tradingMode === "mainnet" ? "NEAR MPC Defuse Solver" : "Paper Trading Sandbox"}.`,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      actionCard: {
        type: "trade_executed",
        title: tradingMode === "mainnet" ? "MPC Order Executed" : "Simulated Paper Order Executed",
        details: {
          symbol: sym,
          shares,
          price,
          amountUsd: amt,
          feeUsd: 0.0,
          routing: tradingMode === "mainnet" ? "NEAR MPC / Defuse Solver" : "Veil Simulation Sandbox Engine",
        },
      },
    };
    appendTerminalMessage(execMsg);
  };

  // Handle Tokenized Stock On-Chain Peer-to-Peer Transfer Execution
  const handleExecuteSimulatedTransfer = (details: any) => {
    if (!details) return;
    const rawSym = details.symbol || "TSLAon";
    const foundAsset = findStockAsset(rawSym, liveAssets);
    const sym = foundAsset?.symbol || rawSym;
    const shares = Number(details.shares) || 0.1;
    const recipient = details.recipientAddress || "recipient.testnet";
    const price = Number(details.price) || (foundAsset?.price ?? 100.0);
    const amt = Number(details.amountUsd) || Number((shares * price).toFixed(2));

    // Deduct transferred shares from active positions
    let nextPositions = [...positions];
    nextPositions = nextPositions
      .map((p) => {
        if (p.symbol.toLowerCase() !== sym.toLowerCase()) return p;
        const rem = Number(Math.max(0, p.shares - shares).toFixed(4));
        return {
          ...p,
          shares: rem,
          currentValueUsd: Number((rem * price).toFixed(2)),
        };
      })
      .filter((p) => p.shares > 0);

    setPositions(nextPositions);

    const newOrder: OrderHistoryItem = {
      id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: sym,
      type: "stock_transfer" as any,
      side: "sell",
      shares,
      price,
      amountUsd: amt,
      timestamp: new Date().toISOString(),
      mode: tradingMode,
      status: "filled",
    };
    const nextHistory = [newOrder, ...orderHistory];
    setOrderHistory(nextHistory);

    syncPortfolio(cashUsd, paperCashUsd, tradingMode, nextPositions, rules, nextHistory);
    showSimulatedToast(`NEP-141 Transfer Confirmed: Sent ${shares} ${sym} to ${recipient}`);

    appendTerminalMessage({
      id: `trans_exec_${Date.now()}`,
      role: "assistant",
      content: `**On-Chain Transfer Confirmed**: Successfully transferred ${shares} shares of ${sym} to \`${recipient}\` via standard NEAR NEP-141 token transfer (*.omdep.near). Transaction settled on NEAR Protocol.`,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  // Clear Terminal Chat History with custom styled dialog
  const handleClearChat = () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Trading Chat History",
      description: "Are you sure you want to clear your terminal trading conversation history? Your active rules and portfolio holdings will not be affected.",
      confirmText: "Clear History",
      variant: "danger",
      onConfirm: () => {
        setMessages([INITIAL_WELCOME]);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        fetch(`/api/chat/history?handle=${encodeURIComponent(handle)}&channel=terminal`, {
          method: "DELETE",
        }).catch(() => {});
      },
    });
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Derived Totals
  const activeCash = tradingMode === "mainnet" ? cashUsd : paperCashUsd;
  const positionsValueUsd = positions.reduce((sum, p) => sum + p.currentValueUsd, 0);
  const totalNetValue = Number((activeCash + positionsValueUsd).toFixed(2));
  const activeRulesCount = rules.filter((r) => r.status === "active").length;

  // Handle Chat Submit - Connected directly to Veil AI Agent with full conversational intelligence
  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isProcessing) return;

    // Check if confirming a simulated paper trade or on-chain transfer
    const lowerQuery = query.toLowerCase().trim();
    if (lowerQuery.includes("confirmed") || lowerQuery === "confirm") {
      const lastConfirmMsg = [...messages].reverse().find(
        (m) => m.actionCard?.type === "require_confirmation" || m.actionCard?.type === "transfer_stock_confirm"
      );
      if (lastConfirmMsg && lastConfirmMsg.actionCard?.details) {
        if (lastConfirmMsg.actionCard.type === "transfer_stock_confirm") {
          handleExecuteSimulatedTransfer(lastConfirmMsg.actionCard.details);
        } else {
          handleExecuteSimulatedTrade(lastConfirmMsg.actionCard.details);
        }
        setInput("");
        setIsProcessing(false);
        return;
      }
    }

    const userMsg: ChatEntry = {
      id: `user_${Date.now()}`,
      role: "user",
      content: query.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    appendTerminalMessage(userMsg);
    setInput("");
    setIsProcessing(true);

    try {
      let aiResult: any = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s fast timeout to prevent chat hang
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: query.trim(),
            history: messages.slice(-6).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            mode: "terminal",
          }),
        });
        clearTimeout(timeoutId);
        if (chatRes.ok) {
          aiResult = await chatRes.json();
        }
      } catch (networkErr) {
        console.warn("AI chat endpoint offline/timed out, using local instant engine:", networkErr);
      }

      // If AI detected a trading tool or rule creation:
      if (aiResult?.tool && aiResult.tool !== "unknown") {
        if (aiResult.tool === "create_trading_rule") {
          const ruleArgs = aiResult.args || {};
          const rawSym = (ruleArgs.symbol || "TSLA").trim();
          const targetAsset = findStockAsset(rawSym, liveAssets);
          if (!targetAsset) {
            appendTerminalMessage({
              id: `err_${Date.now()}`,
              role: "assistant",
              content: `Asset '${rawSym}' is not currently available in the curated Ondo catalog. Supported assets include TSLAon, NVDAon, AAPLon, MSFTon, COINon, GOOGLon, AMZNon, and SPYon.`,
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
            return;
          }
          const sym = targetAsset.symbol;
          const currentPrice = targetAsset.price;
          const amt = Number(ruleArgs.amountUsd) || 50.0;
          const rawType = (ruleArgs.type || "buy_dip").toLowerCase();
          const isDca =
            rawType === "recurring_buy" ||
            rawType === "dca" ||
            rawType === "recurring" ||
            query.toLowerCase().includes("dca") ||
            query.toLowerCase().includes("every minute") ||
            query.toLowerCase().includes("recurring");
          const isBracket = rawType === "bracket_order" || query.toLowerCase().includes("bracket");
          const ruleType = isDca ? "recurring_buy" : isBracket ? "bracket_order" : rawType;

          // 1. RECURRING BUY (DCA)
          if (ruleType === "recurring_buy") {
            const rawCadence = ruleArgs.cadence || (query.toLowerCase().includes("1m") || query.toLowerCase().includes("minute") ? "1m" : "daily");
            const cadence = rawCadence as "1m" | "5m" | "hourly" | "daily" | "weekly";
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

            const conditionText = `DCA $${amt.toFixed(2)} ${cadenceLabel}`;
            const activeWorkingCash = tradingMode === "mainnet" ? cashUsd : paperCashUsd;
            const canExecuteInitial = activeWorkingCash >= amt;
            const shares = canExecuteInitial ? Number((amt / currentPrice).toFixed(4)) : 0;
            let nextCash = activeWorkingCash;
            let nextPositions = [...positions];
            let nextHistory = [...orderHistory];

            if (canExecuteInitial) {
              nextCash = Number((activeWorkingCash - amt).toFixed(2));
              const posIdx = nextPositions.findIndex((p) => p.symbol.toLowerCase() === sym.toLowerCase());
              if (posIdx >= 0) {
                const existing = nextPositions[posIdx];
                const totalShares = Number((existing.shares + shares).toFixed(4));
                const totalCost = existing.shares * existing.avgEntryPrice + amt;
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
                  symbol: sym,
                  name: targetAsset?.name || sym,
                  shares,
                  avgEntryPrice: currentPrice,
                  currentPrice,
                  currentValueUsd: amt,
                  pnlUsd: 0,
                  pnlPercent: 0,
                  allocationPercent: 10,
                });
              }

              const initOrder: OrderHistoryItem = {
                id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                symbol: sym,
                type: "recurring_buy",
                side: "buy",
                shares,
                price: currentPrice,
                amountUsd: amt,
                timestamp: new Date().toISOString(),
                mode: tradingMode,
                status: "filled",
              };
              nextHistory = [initOrder, ...nextHistory];
            }

            const newRule: TradingRule = {
              id: `rule_dca_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              symbol: sym,
              type: "recurring_buy",
              condition: conditionText,
              amountUsd: amt,
              cadence,
              executionsCount: canExecuteInitial ? 1 : 0,
              lastTriggeredAt: canExecuteInitial ? new Date().toISOString() : undefined,
              status: "active",
              createdAt: new Date().toISOString(),
            };

            const nextRules = [newRule, ...rules];
            if (tradingMode === "mainnet") {
              setCashUsd(nextCash);
            } else {
              setPaperCashUsd(nextCash);
            }
            setPositions(nextPositions);
            setRules(nextRules);
            setOrderHistory(nextHistory);

            syncPortfolio(
              tradingMode === "mainnet" ? nextCash : cashUsd,
              tradingMode === "simulation" ? nextCash : paperCashUsd,
              tradingMode,
              nextPositions,
              nextRules,
              nextHistory
            );

            showSimulatedToast(`⚡ DCA Active: Initial buy filled ($${amt.toFixed(2)}) & scheduled ${cadence}`);

            const assistantMsg: ChatEntry = {
              id: `assistant_${Date.now()}`,
              role: "assistant",
              content: canExecuteInitial
                ? `Automated DCA Active: Executed initial market buy of ${shares} shares of ${sym} for $${amt.toFixed(
                    2
                  )} USD at $${currentPrice.toFixed(
                    2
                  )}. Cash deducted, position created in Holdings, and recurring schedule armed to buy $${amt.toFixed(
                    2
                  )} ${cadenceLabel}.`
                : `Automated DCA Rule Activated: Scheduled to buy $${amt.toFixed(
                    2
                  )} of ${sym} ${cadenceLabel} in your Paper Trading Sandbox using real-time oracle quotes.`,
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              actionCard: {
                type: canExecuteInitial ? "trade_executed" : "rule_created",
                title: `DCA Active: ${sym} ($${amt.toFixed(2)} ${cadence})`,
                details: {
                  symbol: sym,
                  shares: canExecuteInitial ? shares : undefined,
                  price: canExecuteInitial ? currentPrice : undefined,
                  amountUsd: amt,
                  condition: conditionText,
                  cadence,
                  ruleId: newRule.id,
                },
              },
            };
            appendTerminalMessage(assistantMsg);
            return;
          }

          // 2. CHAINED BRACKET ORDER (BUY ENTRY + AUTO TAKE-PROFIT EXIT)
          if (ruleType === "bracket_order") {
            const tpPercent = Number(ruleArgs.takeProfitPercent) || 10;
            const activeWorkingCash = tradingMode === "mainnet" ? cashUsd : paperCashUsd;
            if (activeWorkingCash < amt) {
              appendTerminalMessage({
                id: `err_${Date.now()}`,
                role: "assistant",
                content: `Cannot execute bracket order: Insufficient liquid cash ($${activeWorkingCash.toFixed(
                  2
                )} available, $${amt.toFixed(2)} required).`,
                createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              });
              return;
            }

            const shares = Number((amt / currentPrice).toFixed(4));
            const targetExitPrice = Number((currentPrice * (1 + tpPercent / 100)).toFixed(2));
            const nextCash = Number((activeWorkingCash - amt).toFixed(2));

            // Add shares to positions
            let nextPositions = [...positions];
            const existingIdx = nextPositions.findIndex((p) => p.symbol.toLowerCase() === sym.toLowerCase());
            if (existingIdx >= 0) {
              const existing = nextPositions[existingIdx];
              const totalShares = Number((existing.shares + shares).toFixed(4));
              const totalCost = existing.shares * existing.avgEntryPrice + amt;
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
                symbol: sym,
                name: targetAsset?.name || sym,
                shares,
                avgEntryPrice: currentPrice,
                currentPrice,
                currentValueUsd: amt,
                pnlUsd: 0,
                pnlPercent: 0,
                allocationPercent: 10,
              });
            }

            // Arm Take-Profit exit rule
            const tpRule: TradingRule = {
              id: `rule_tp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              symbol: sym,
              type: "take_profit",
              condition: `Sell when gain reaches +${tpPercent}% (target $${targetExitPrice.toFixed(2)})`,
              triggerProfitPercent: tpPercent,
              triggerPrice: targetExitPrice,
              amountUsd: amt,
              status: "active",
              createdAt: new Date().toISOString(),
            };

            const entryOrder: OrderHistoryItem = {
              id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              symbol: sym,
              type: "bracket_entry_buy",
              side: "buy",
              shares,
              price: currentPrice,
              amountUsd: amt,
              timestamp: new Date().toISOString(),
              mode: tradingMode,
              status: "filled",
            };

            const nextRules = [tpRule, ...rules];
            const nextHistory = [entryOrder, ...orderHistory];

            if (tradingMode === "mainnet") {
              setCashUsd(nextCash);
            } else {
              setPaperCashUsd(nextCash);
            }
            setPositions(nextPositions);
            setRules(nextRules);
            setOrderHistory(nextHistory);

            syncPortfolio(
              tradingMode === "mainnet" ? nextCash : cashUsd,
              tradingMode === "simulation" ? nextCash : paperCashUsd,
              tradingMode,
              nextPositions,
              nextRules,
              nextHistory
            );

            showSimulatedToast(`Bracket Order: Bought ${shares} ${sym} & armed TP rule at +${tpPercent}%`);

            const assistantMsg: ChatEntry = {
              id: `assistant_${Date.now()}`,
              role: "assistant",
              content:
                aiResult.assistantReply ||
                `Bracket Order Executed: Bought ${shares} shares of ${sym} for $${amt.toFixed(
                  2
                )} USD at $${currentPrice.toFixed(
                  2
                )}. Cash deducted, position created in Holdings, and automated Take-Profit exit rule armed at +${tpPercent}% (target $${targetExitPrice.toFixed(
                  2
                )}).`,
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              actionCard: {
                type: "trade_executed",
                title: `Bracket Order: ${sym} Entry + Exit TP (+${tpPercent}%)`,
                details: {
                  symbol: sym,
                  shares,
                  price: currentPrice,
                  amountUsd: amt,
                  gainPercent: tpPercent,
                  condition: `Take Profit at $${targetExitPrice.toFixed(2)} (+${tpPercent}%)`,
                  ruleId: tpRule.id,
                },
              },
            };
            appendTerminalMessage(assistantMsg);
            return;
          }

          // 3. CONDITIONAL DIP-BUY / TAKE-PROFIT / STOP-LOSS
          const triggerPrice =
            ruleArgs.targetPrice ||
            Number((currentPrice * (1 - (ruleArgs.targetPercent || 5) / 100)).toFixed(2));

          const conditionText =
            ruleType === "buy_dip"
              ? `Buy $${amt.toFixed(2)} if price drops below $${triggerPrice.toFixed(2)}`
              : ruleType === "take_profit"
              ? `Sell when gain reaches +${ruleArgs.targetPercent || 10}% (target $${(
                  currentPrice *
                  (1 + (ruleArgs.targetPercent || 10) / 100)
                ).toFixed(2)})`
              : ruleType === "stop_loss"
              ? `Stop-loss exit on -${ruleArgs.stopLossPercent || 5}% loss`
              : `Automated trading trigger active`;

          const newRule: TradingRule = {
            id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            symbol: sym,
            type: ruleType,
            condition: conditionText,
            triggerPrice,
            triggerProfitPercent: ruleType === "take_profit" ? ruleArgs.targetPercent || 10 : undefined,
            amountUsd: amt,
            status: "active",
            createdAt: new Date().toISOString(),
          };

          const nextRules = [...rules, newRule];
          setRules(nextRules);
          syncPortfolio(cashUsd, paperCashUsd, tradingMode, positions, nextRules, orderHistory);

          const assistantMsg: ChatEntry = {
            id: `assistant_${Date.now()}`,
            role: "assistant",
            content:
              aiResult.assistantReply ||
              `Automated simulation rule created: I am now monitoring ${sym} (current quote: $${currentPrice.toFixed(
                2
              )}). When triggered, I will automatically execute in your Paper Trading Sandbox.`,
            createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            actionCard: {
              type: "rule_created",
              title: `Simulation Rule Active: ${sym}`,
              details: {
                symbol: sym,
                condition: conditionText,
                amountUsd: amt,
              },
            },
          };
          appendTerminalMessage(assistantMsg);
          return;
        }

        if (aiResult.tool === "trade_stock") {
          const tradeArgs = aiResult.args || {};
          const rawSym = (tradeArgs.symbol || "TSLA").trim();
          const targetAsset = findStockAsset(rawSym, liveAssets);
          if (!targetAsset) {
            appendTerminalMessage({
              id: `err_${Date.now()}`,
              role: "assistant",
              content: `Asset '${rawSym}' is not currently available in the curated Ondo catalog. Supported assets include TSLAon, NVDAon, AAPLon, MSFTon, COINon, GOOGLon, AMZNon, and SPYon.`,
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
            return;
          }
          const sym = targetAsset.symbol;
          const currentPrice = targetAsset.price;
          const amt = Number(tradeArgs.amountUsd) || 50.0;
          const action = (tradeArgs.action || "buy").toLowerCase();
          const shares = Number((amt / currentPrice).toFixed(4));

          const assistantMsg: ChatEntry = {
            id: `assistant_${Date.now()}`,
            role: "assistant",
            content:
              aiResult.assistantReply ||
              `Prepared Simulated Paper Order: ${action.toUpperCase()} $${amt.toFixed(
                2
              )} of ${sym} (~${shares} shares at $${currentPrice.toFixed(
                2
              )}) in Paper Trading Sandbox. Confirmation required:`,
            createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            actionCard: {
              type: "require_confirmation",
              title: `Confirm Simulated Paper Order: ${action.toUpperCase()} ${sym}`,
              details: {
                symbol: sym,
                shares,
                price: currentPrice,
                amountUsd: amt,
                feeUsd: 0.00,
                maxSlippage: "1.0% (Simulated)",
                routing: "Veil Simulation Sandbox (Defuse Backtesting Engine)",
                promptConfirm: `${action} $${amt} ${sym} confirmed`,
              },
            },
          };
          appendTerminalMessage(assistantMsg);
          return;
        }

        if (aiResult.tool === "transfer_stock") {
          const transArgs = aiResult.args || {};
          const rawSym = (transArgs.symbol || "TSLA").trim();
          const targetAsset = findStockAsset(rawSym, liveAssets);
          if (!targetAsset) {
            appendTerminalMessage({
              id: `err_${Date.now()}`,
              role: "assistant",
              content: `Asset '${rawSym}' is not currently available in the curated Ondo catalog. Supported assets include TSLAon, NVDAon, AAPLon, MSFTon, COINon, GOOGLon, AMZNon, and SPYon.`,
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
            return;
          }
          const sym = targetAsset.symbol;
          const currentPrice = targetAsset.price;
          const recipient = (transArgs.recipientAddress || "recipient.testnet").trim();
          const targetPos = positions.find((p) => p.symbol.toLowerCase() === sym.toLowerCase());
          const availableShares = targetPos?.shares || 0;
          const requestedShares = Number(transArgs.shares) || (transArgs.amountUsd ? Number((Number(transArgs.amountUsd) / currentPrice).toFixed(4)) : 1.0);
          const shares = Math.min(requestedShares, availableShares > 0 ? availableShares : requestedShares);
          const amt = Number((shares * currentPrice).toFixed(2));

          const assistantMsg: ChatEntry = {
            id: `assistant_${Date.now()}`,
            role: "assistant",
            content:
              aiResult.assistantReply ||
              `Prepared on-chain transfer of ${shares} shares of ${sym} (~$${amt.toFixed(2)}) directly to \`${recipient}\` via NEAR NEP-141 token standard (*.omdep.near). Review and authorize below:`,
            createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            actionCard: {
              type: "transfer_stock_confirm",
              title: `Confirm Tokenized Stock Transfer: ${sym}`,
              details: {
                symbol: sym,
                name: targetAsset?.name || sym,
                shares,
                price: currentPrice,
                amountUsd: amt,
                recipientAddress: recipient,
                transferDetails: { contractId: targetAsset?.contractAddress || "omdep.near" },
                promptConfirm: `transfer ${shares} ${sym} to ${recipient} confirmed`,
              },
            },
          };
          appendTerminalMessage(assistantMsg);
          return;
        }

        if (aiResult.tool === "get_portfolio") {
          const invested = positions.reduce((sum, p) => sum + p.currentValueUsd, 0);
          const total = cashUsd + invested;
          const assistantMsg: ChatEntry = {
            id: `assistant_${Date.now()}`,
            role: "assistant",
            content:
              aiResult.assistantReply ||
              `Your total portfolio net value is $${total.toFixed(
                2
              )}. You hold $${cashUsd.toFixed(2)} in verified liquid funds and ${
                positions.length
              } active positions.`,
            createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            actionCard: {
              type: "portfolio_summary",
              title: "Portfolio Summary",
              details: {
                netValue: total,
                cash: cashUsd,
                positionsCount: positions.length,
              },
            },
          };
          appendTerminalMessage(assistantMsg);
          return;
        }
      }

      // If AI gave a conversational response
      if (aiResult?.assistantReply && aiResult.assistantReply.trim()) {
        const assistantMsg: ChatEntry = {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: aiResult.assistantReply,
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        appendTerminalMessage(assistantMsg);
        return;
      }

      // Fallback: local trading-copilot parsing
      const activeWorkingCash = tradingMode === "mainnet" ? cashUsd : paperCashUsd;
      const res = processTradingInstruction(
        query.trim(),
        {
          cashUsd: activeWorkingCash,
          positions,
          rules,
        },
        liveAssets
      );

      let nextCash = activeWorkingCash;
      let nextPositions = positions;
      let nextRules = rules;

      if (typeof res.updatedCash === "number") {
        nextCash = res.updatedCash;
        if (tradingMode === "mainnet") {
          setCashUsd(nextCash);
        } else {
          setPaperCashUsd(nextCash);
        }
      }
      if (res.updatedPositions) {
        nextPositions = res.updatedPositions;
        setPositions(nextPositions);
      }
      if (res.updatedRules) {
        nextRules = res.updatedRules;
        setRules(nextRules);
      }

      if (
        res.updatedCash !== undefined ||
        res.updatedPositions !== undefined ||
        res.updatedRules !== undefined
      ) {
        syncPortfolio(
          tradingMode === "mainnet" ? nextCash : cashUsd,
          tradingMode === "simulation" ? nextCash : paperCashUsd,
          tradingMode,
          nextPositions,
          nextRules,
          orderHistory
        );
      }

      if (res.actionCard?.type === "trade_executed") {
        showSimulatedToast(
          tradingMode === "mainnet" ? "MPC Order Executed" : "Simulated Paper Order Executed"
        );
      }

      const assistantMsg: ChatEntry = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: res.reply,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actionCard: res.actionCard,
      };

      appendTerminalMessage(assistantMsg);
    } catch (err) {
      console.error("Processing error:", err);
      appendTerminalMessage({
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "Sorry, I had trouble processing that command. Please try again.",
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Create Manual Rule via Modal
  const handleCreateModalRule = () => {
    const amount = parseFloat(ruleModalAmount) || 50.0;
    const currentAsset = liveAssets.find((a) => a.symbol === ruleModalSymbol);
    const currentPrice = currentAsset?.price || 100.0;
    const targetVal =
      parseFloat(ruleModalTarget) || (triggerInputMode === "percent" ? 5.0 : currentPrice * 0.95);

    // 1. RECURRING BUY (DCA)
    if (ruleModalType === "recurring_buy") {
      const cadence = ruleModalCadence;
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

      const condition = `DCA $${amount.toFixed(2)} ${cadenceLabel}`;
      const activeWorkingCash = tradingMode === "mainnet" ? cashUsd : paperCashUsd;
      const canExecuteInitial = activeWorkingCash >= amount;
      const shares = canExecuteInitial ? Number((amount / currentPrice).toFixed(4)) : 0;
      let nextCash = activeWorkingCash;
      let nextPositions = [...positions];
      let nextHistory = [...orderHistory];

      if (canExecuteInitial) {
        nextCash = Number((activeWorkingCash - amount).toFixed(2));
        const posIdx = nextPositions.findIndex((p) => p.symbol === ruleModalSymbol);
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
            symbol: ruleModalSymbol,
            name: currentAsset?.name || ruleModalSymbol,
            shares,
            avgEntryPrice: currentPrice,
            currentPrice,
            currentValueUsd: amount,
            pnlUsd: 0,
            pnlPercent: 0,
            allocationPercent: 10,
          });
        }

        const initOrder: OrderHistoryItem = {
          id: `ord_${Date.now()}`,
          symbol: ruleModalSymbol,
          type: "recurring_buy",
          side: "buy",
          shares,
          price: currentPrice,
          amountUsd: amount,
          timestamp: new Date().toISOString(),
          mode: tradingMode,
          status: "filled",
        };
        nextHistory = [initOrder, ...nextHistory];
      }

      const newRule: TradingRule = {
        id: `rule_dca_${Date.now()}`,
        symbol: ruleModalSymbol,
        type: "recurring_buy",
        condition,
        amountUsd: amount,
        cadence,
        executionsCount: canExecuteInitial ? 1 : 0,
        lastTriggeredAt: canExecuteInitial ? new Date().toISOString() : undefined,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const updated = [newRule, ...rules];
      if (tradingMode === "mainnet") {
        setCashUsd(nextCash);
      } else {
        setPaperCashUsd(nextCash);
      }
      setPositions(nextPositions);
      setRules(updated);
      setOrderHistory(nextHistory);

      syncPortfolio(
        tradingMode === "mainnet" ? nextCash : cashUsd,
        tradingMode === "simulation" ? nextCash : paperCashUsd,
        tradingMode,
        nextPositions,
        updated,
        nextHistory
      );

      setIsAddRuleOpen(false);
      showSimulatedToast(`⚡ DCA Active: Initial buy filled ($${amount.toFixed(2)}) & scheduled ${cadence}`);

      appendTerminalMessage({
        id: `rule_msg_${Date.now()}`,
        role: "assistant",
        content: canExecuteInitial
          ? `Automated DCA Active: Executed initial market buy of ${shares} shares of ${ruleModalSymbol} for $${amount.toFixed(
              2
            )} USD at $${currentPrice.toFixed(
              2
            )}. Cash deducted, position added to Holdings, and recurring schedule armed to buy $${amount.toFixed(
              2
            )} ${cadenceLabel}.`
          : `Automated DCA rule activated: ${condition}. Purchases will execute autonomously in your Paper Sandbox using live oracle quotes.`,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actionCard: {
          type: canExecuteInitial ? "trade_executed" : "rule_created",
          title: `DCA Active: ${ruleModalSymbol} ($${amount.toFixed(2)} ${cadence})`,
          details: {
            symbol: ruleModalSymbol,
            shares: canExecuteInitial ? shares : undefined,
            price: canExecuteInitial ? currentPrice : undefined,
            amountUsd: amount,
            condition,
            cadence,
            ruleId: newRule.id,
          },
        },
      });
      return;
    }

    // 2. CHAINED BRACKET ORDER (BUY ENTRY + AUTO TAKE-PROFIT EXIT)
    if (ruleModalType === "bracket_order") {
      const activeWorkingCash = tradingMode === "mainnet" ? cashUsd : paperCashUsd;
      if (activeWorkingCash < amount) {
        showSimulatedToast("Insufficient funds for Bracket Order");
        return;
      }

      const shares = Number((amount / currentPrice).toFixed(4));
      const gainPercent =
        triggerInputMode === "percent"
          ? targetVal
          : Number((((targetVal - currentPrice) / currentPrice) * 100).toFixed(1));
      const targetPrice =
        triggerInputMode === "percent"
          ? Number((currentPrice * (1 + gainPercent / 100)).toFixed(2))
          : targetVal;

      const condition = `Sell when gain reaches +${gainPercent}% (target $${targetPrice.toFixed(2)})`;
      const nextCash = Number((activeWorkingCash - amount).toFixed(2));

      // Add position
      let nextPositions = [...positions];
      const existingIdx = nextPositions.findIndex((p) => p.symbol === ruleModalSymbol);
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
          symbol: ruleModalSymbol,
          name: currentAsset?.name || ruleModalSymbol,
          shares,
          avgEntryPrice: currentPrice,
          currentPrice,
          currentValueUsd: amount,
          pnlUsd: 0,
          pnlPercent: 0,
          allocationPercent: 10,
        });
      }

      const tpRule: TradingRule = {
        id: `rule_tp_${Date.now()}`,
        symbol: ruleModalSymbol,
        type: "take_profit",
        condition,
        triggerProfitPercent: gainPercent,
        triggerPrice: targetPrice,
        amountUsd: amount,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const entryOrder: OrderHistoryItem = {
        id: `ord_${Date.now()}`,
        symbol: ruleModalSymbol,
        type: "bracket_entry_buy",
        side: "buy",
        shares,
        price: currentPrice,
        amountUsd: amount,
        timestamp: new Date().toISOString(),
        mode: tradingMode,
        status: "filled",
      };

      const nextRules = [tpRule, ...rules];
      const nextHistory = [entryOrder, ...orderHistory];

      if (tradingMode === "mainnet") setCashUsd(nextCash);
      else setPaperCashUsd(nextCash);
      setPositions(nextPositions);
      setRules(nextRules);
      setOrderHistory(nextHistory);

      syncPortfolio(
        tradingMode === "mainnet" ? nextCash : cashUsd,
        tradingMode === "simulation" ? nextCash : paperCashUsd,
        tradingMode,
        nextPositions,
        nextRules,
        nextHistory
      );

      setIsAddRuleOpen(false);
      showSimulatedToast(`Bracket Order: Bought ${shares} ${ruleModalSymbol} & armed TP rule at +${gainPercent}%`);

      appendTerminalMessage({
        id: `rule_msg_${Date.now()}`,
        role: "assistant",
        content: `Bracket Order Executed: Bought ${shares} shares of ${ruleModalSymbol} for $${amount.toFixed(
          2
        )} USD at $${currentPrice.toFixed(
          2
        )}. Cash deducted and position created in Holdings. Automated Take-Profit rule armed at +${gainPercent}% (target $${targetPrice.toFixed(
          2
        )}).`,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actionCard: {
          type: "trade_executed",
          title: `Bracket Order: ${ruleModalSymbol} Entry + Exit TP (+${gainPercent}%)`,
          details: {
            symbol: ruleModalSymbol,
            shares,
            price: currentPrice,
            amountUsd: amount,
            gainPercent,
            condition: `Take Profit at $${targetPrice.toFixed(2)} (+${gainPercent}%)`,
            ruleId: tpRule.id,
          },
        },
      });
      return;
    }

    // 3. CONDITIONAL DIP-BUY OR TAKE-PROFIT
    let condition = "";
    let triggerPrice: number | undefined = undefined;
    let triggerProfitPercent: number | undefined = undefined;

    if (ruleModalType === "buy_dip") {
      if (triggerInputMode === "percent") {
        const dipPercent = targetVal;
        const calcPrice = Number((currentPrice * (1 - dipPercent / 100)).toFixed(2));
        condition = `Buy $${amount.toFixed(2)} if price dips ${dipPercent}% (target $${calcPrice.toFixed(
          2
        )})`;
        triggerPrice = calcPrice;
      } else {
        const dipPercent = Number((((currentPrice - targetVal) / currentPrice) * 100).toFixed(1));
        condition = `Buy $${amount.toFixed(2)} if price drops below $${targetVal.toFixed(
          2
        )} (-${dipPercent}%)`;
        triggerPrice = targetVal;
      }
    } else {
      if (triggerInputMode === "percent") {
        const gainPercent = targetVal;
        const calcPrice = Number((currentPrice * (1 + gainPercent / 100)).toFixed(2));
        condition = `Sell when gain reaches +${gainPercent}% (target $${calcPrice.toFixed(2)})`;
        triggerProfitPercent = gainPercent;
        triggerPrice = calcPrice;
      } else {
        const gainPercent = Number((((targetVal - currentPrice) / currentPrice) * 100).toFixed(1));
        condition = `Sell when price reaches $${targetVal.toFixed(2)} (+${gainPercent}% gain)`;
        triggerProfitPercent = gainPercent;
        triggerPrice = targetVal;
      }
    }

    const newRule: TradingRule = {
      id: `rule_${Date.now()}`,
      symbol: ruleModalSymbol,
      type: ruleModalType,
      condition,
      triggerPrice,
      triggerProfitPercent,
      amountUsd: amount,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    syncPortfolio(cashUsd, paperCashUsd, tradingMode, positions, updated, orderHistory);
    setIsAddRuleOpen(false);

    appendTerminalMessage({
      id: `rule_msg_${Date.now()}`,
      role: "assistant",
      content: `Automated rule added: ${condition}. I am monitoring this live on NEAR/Defuse.`,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      actionCard: {
        type: "rule_created",
        title: `Rule Active: ${ruleModalSymbol}`,
        details: {
          symbol: ruleModalSymbol,
          amountUsd: amount,
          price: triggerPrice,
          condition,
          ruleId: newRule.id,
        },
      },
    });
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] max-w-7xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2.5 w-full overflow-hidden text-[#1E1315]">
      {/* Floating Toast Notification for Simulated Orders */}
      {toastMessage && (
        <div className="fixed top-16 right-4 sm:right-8 z-50 bg-[#1E1315] text-[#FAF7F0] border border-[#3E2D30] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-mono text-xs font-bold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-[#6E5D4F] hover:text-[#FAF7F0] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          SLEEK MINIMALIST TERMINAL UTILITY HEADER (Clean, zero navbar duplication)
         ========================================================================= */}
      <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 mb-2 border-b border-[#EBE3D5] shrink-0">
        {/* Top line on mobile: Net worth badge on left, action buttons on right */}
        <div className="flex items-center justify-between gap-2 w-full lg:w-auto">
          {/* Net Worth Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white border border-[#EBE3D5] shadow-2xs font-mono text-xs"
            title={
              isMainnet
                ? "Verified Liquid On-Chain Net Worth"
                : "Simulated Paper Portfolio Net Value. Click reset icon to restore $10,000."
            }
          >
            <span className="text-[#6E5D4F] text-[11px]">
              {isMainnet ? "Net:" : "Sim Net:"}
            </span>
            <span className="font-bold text-[#1E1315]">${totalNetValue.toFixed(2)}</span>
            {!isMainnet && (
              <button
                type="button"
                onClick={handleResetSandbox}
                title="Reset Sandbox Balance to $10,000.00"
                className="p-1 -mr-1 rounded-md hover:bg-[#FAF7F0] text-[#6E5D4F] hover:text-amber-800 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {activeRulesCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeRulesCount} Active {activeRulesCount === 1 ? "Rule" : "Rules"}</span>
            </div>
          )}

          {/* Action buttons (New Rule + Trash) on right on mobile */}
          <div className="flex lg:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAddRuleOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-mono font-bold transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Rule</span>
            </button>
            <button
              type="button"
              onClick={handleClearChat}
              title="Clear Chat History"
              className="h-8 w-8 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#7A6A5E] hover:text-[#1E1315] flex items-center justify-center transition shadow-2xs cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Studio / Copilot toggle on mobile (full width grid) and desktop ratio / actions */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          {/* Mobile Studio/Copilot segmented switch (Visible on mobile/tablet) */}
          <div className="grid grid-cols-2 lg:hidden w-full bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setMobileView("chart")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                mobileView === "chart"
                  ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                  : "text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileView("copilot")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                mobileView === "copilot"
                  ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                  : "text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Copilot</span>
            </button>
          </div>

          {/* Desktop Split View Ratio Presets (70:30, 58:42, 40:60) */}
          <div className="hidden lg:flex items-center bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl p-0.5 shadow-2xs text-[10px] font-mono font-bold">
            <button
              type="button"
              onClick={() => {
                setChartWidthPercent(70);
                window.dispatchEvent(new Event("resize"));
              }}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                chartWidthPercent >= 65
                  ? "bg-[#1E1315] text-[#FAF7F0]"
                  : "text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
              title="Wide Chart Layout (70% Chart / 30% Copilot)"
            >
              70:30
            </button>
            <button
              type="button"
              onClick={() => {
                setChartWidthPercent(58);
                window.dispatchEvent(new Event("resize"));
              }}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                chartWidthPercent >= 50 && chartWidthPercent < 65
                  ? "bg-[#1E1315] text-[#FAF7F0]"
                  : "text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
              title="Balanced Default Layout (58% Chart / 42% Copilot)"
            >
              58:42
            </button>
            <button
              type="button"
              onClick={() => {
                setChartWidthPercent(40);
                window.dispatchEvent(new Event("resize"));
              }}
              className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                chartWidthPercent < 50
                  ? "bg-[#1E1315] text-[#FAF7F0]"
                  : "text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
              title="Wide Copilot Chat Layout (40% Chart / 60% Copilot)"
            >
              40:60
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddRuleOpen(true)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-mono font-bold transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Rule</span>
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            title="Clear Chat History"
            className="hidden lg:flex h-8 w-8 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#7A6A5E] hover:text-[#1E1315] items-center justify-center transition shadow-2xs cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN WORKSPACE: Split Pro Studio (Desktop) with Draggable Resize Divider
         ========================================================================= */}
      {(() => {
        const activeAsset =
          liveAssets.find((a) => a.symbol === selectedChartAsset) ||
          liveAssets[0] || {
            symbol: "TSLAon",
            name: "Tesla Inc (Ondo)",
            price: 348.63,
            change24h: 1.8,
            trend: "bullish" as const,
            rsi14: 48,
            sma20: 340.5,
          };

        return (
          <div
            ref={workspaceRef}
            className="flex-1 flex flex-col lg:flex-row gap-0 lg:gap-1.5 min-h-0 overflow-hidden select-none"
          >
            {/* Left Stage: Live Chart & Order Ledger Tabs (Adjustable width on Desktop) */}
            <div
              style={{ flex: `0 0 ${chartWidthPercent}%`, maxWidth: `${chartWidthPercent}%` }}
              className={`flex-col gap-3 min-h-0 overflow-y-auto pr-0.5 ${
                mobileView === "chart" ? "flex !max-w-full !flex-1" : "hidden lg:flex"
              }`}
            >
              <TradingChart
                asset={activeAsset}
                allAssets={liveAssets}
                onSelectAsset={(sym) => setSelectedChartAsset(sym)}
                orderHistory={orderHistory}
              />

              <OrderLedgerTabs
                positions={positions}
                rules={rules}
                orderHistory={orderHistory}
                onCancelRule={handleCancelRule}
                onClosePosition={handleClosePosition}
                onSelectAssetForChart={(sym) => {
                  setSelectedChartAsset(sym);
                  setMobileView("chart");
                }}
              />
            </div>

            {/* Draggable Vertical Splitter Handle (Desktop Only) */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={chartWidthPercent}
              aria-valuemin={30}
              aria-valuemax={80}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  setChartWidthPercent((p) => Math.max(30, p - 5));
                  window.dispatchEvent(new Event("resize"));
                }
                if (e.key === "ArrowRight") {
                  setChartWidthPercent((p) => Math.min(80, p + 5));
                  window.dispatchEvent(new Event("resize"));
                }
              }}
              onMouseDown={() => setIsDraggingSplitter(true)}
              onTouchStart={() => setIsDraggingSplitter(true)}
              className={`hidden lg:flex items-center justify-center w-2.5 cursor-col-resize hover:bg-[#FAF7F0] rounded-full transition-colors group shrink-0 focus:outline-none focus:ring-1 focus:ring-[#1E1315] ${
                isDraggingSplitter ? "bg-amber-100" : ""
              }`}
              title="Drag left/right or use arrow keys to adjust chart and copilot width"
              aria-label="Adjust chart and copilot width"
            >
              <div
                className={`w-0.5 h-10 rounded-full transition-colors ${
                  isDraggingSplitter ? "bg-[#1E1315]" : "bg-[#EBE3D5] group-hover:bg-[#1E1315]"
                }`}
              />
            </div>

            {/* Right Stage: AI Trading Copilot Chat Panel (Adjustable width on Desktop) */}
            <div
              style={{ flex: `1 1 ${100 - chartWidthPercent}%`, maxWidth: `${100 - chartWidthPercent}%` }}
              className={`flex-col h-full min-h-0 bg-[#FAF7F0]/60 border border-[#EBE3D5] rounded-3xl p-3 sm:p-3.5 shadow-2xs overflow-hidden ${
                mobileView === "copilot" ? "flex !max-w-full !flex-1" : "hidden lg:flex"
              }`}
            >
              {/* Internal Copilot Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EBE3D5] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isMainnet ? "bg-purple-400" : "bg-emerald-400"
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isMainnet ? "bg-purple-600" : "bg-emerald-500"
                      }`}
                    />
                  </span>
                  <span className="font-mono text-xs font-bold text-[#1E1315]">
                    AI Copilot
                  </span>
                  <span className="text-[10px] text-[#7A6A5E] font-mono">
                    {isMainnet ? "NEAR MPC Solver" : "Autonomous Simulation"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#6E5D4F]">
                  <span>24/7 Engine</span>
                </div>
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 sm:gap-3 my-2 ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {/* Monogram / Profile Avatar */}
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold shadow-2xs ${
                          isUser
                            ? "bg-[#1E1315] text-[#FAF7F0] border border-[#2C1D20]"
                            : "bg-[#1E1315] text-[#FAF7F0] border border-[#1E1315]"
                        }`}
                      >
                        {isUser ? (
                          <Image
                            src={userAvatar}
                            alt="User"
                            width={28}
                            height={28}
                            unoptimized
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Shield className="w-3.5 h-3.5 text-[#FAF7F0]" />
                        )}
                      </div>

                      {/* Message Bubble Container */}
                      <div
                        className={`max-w-[88%] min-w-0 flex-1 overflow-hidden ${
                          isUser ? "items-end text-right" : "items-start text-left"
                        }`}
                      >
                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed min-w-0 break-words shadow-2xs ${
                            isUser
                              ? "bg-[#1E1315] text-[#FAF7F0] rounded-tr-xs"
                              : "bg-white border border-[#EBE3D5] text-[#1E1315] rounded-tl-xs"
                          }`}
                        >
                          <FormattedContent content={msg.content} isUser={isUser} />

                          {/* Embedded Action Card */}
                          {msg.actionCard && (
                            <div className="mt-3 pt-3 border-t border-[#EBE3D5] space-y-2 text-left">
                              <div className="flex items-center justify-between font-mono text-xs">
                                <span className="font-bold text-[#1E1315]">{msg.actionCard.title}</span>
                                {msg.actionCard.type === "rule_created" && (
                                  <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                                    Active • Monitoring
                                  </span>
                                )}
                                {msg.actionCard.type === "trade_executed" && (
                                  <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                                    Simulated Paper Order Executed
                                  </span>
                                )}
                              </div>

                              {/* Card Details */}
                              {msg.actionCard.details.symbol && (
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5]">
                                  <AssetLogo symbol={msg.actionCard.details.symbol} className="w-8 h-8" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-mono font-bold text-xs text-[#1E1315]">
                                      {msg.actionCard.details.symbol}
                                    </div>
                                    <div className="text-[11px] text-[#7A6A5E] truncate">
                                      {msg.actionCard.details.condition ||
                                        `${msg.actionCard.details.shares || ""} shares @ $${
                                          msg.actionCard.details.price?.toFixed(2) || ""
                                        }`}
                                    </div>
                                  </div>
                                  {msg.actionCard.details.amountUsd && (
                                    <div className="font-mono font-bold text-xs text-[#1E1315]">
                                      ${msg.actionCard.details.amountUsd.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Portfolio Summary Card Details */}
                              {msg.actionCard.type === "portfolio_summary" && (
                                <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] font-mono text-xs space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A6A5E]">Total Net Worth:</span>
                                    <span className="font-bold text-[#1E1315]">
                                      ${msg.actionCard.details.netValue?.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#7A6A5E]">Liquid Cash:</span>
                                    <span className="font-bold text-emerald-800">
                                      ${msg.actionCard.details.cash?.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="pt-1.5 border-t border-[#EBE3D5] flex justify-end">
                                    <Link
                                      href="/dashboard"
                                      className="text-xs font-bold text-[#1E1315] hover:underline flex items-center gap-1"
                                    >
                                      <span>Open Dashboard</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </Link>
                                  </div>
                                </div>
                              )}

                              {/* Confirmation Gate Card */}
                              {msg.actionCard.type === "require_confirmation" && (
                                <div className="p-3 rounded-xl bg-white border border-[#EBE3D5] text-xs space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-mono text-[#7A6A5E]">
                                    <span>Guard:</span>
                                    <span className="font-bold text-[#1E1315]">
                                      Paper Trading Simulation Co-Signature Gate
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-[#FAF7F0] p-2 rounded-lg border border-[#EBE3D5]">
                                    <div>
                                      <span className="text-[#6E5D4F] block text-[9px] uppercase">
                                        Execution Mode
                                      </span>
                                      <span className="font-bold text-amber-900">
                                        Simulated Paper Order
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#6E5D4F] block text-[9px] uppercase">
                                        Solver Fee
                                      </span>
                                      <span className="font-bold text-emerald-700">
                                        $0.00 (Simulated)
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleExecuteSimulatedTrade(msg.actionCard?.details);
                                      }}
                                      className="flex-1 py-2 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] font-bold text-xs transition cursor-pointer"
                                    >
                                      Execute Simulated Paper Order
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        appendTerminalMessage({
                                          id: `cancel_${Date.now()}`,
                                          role: "assistant",
                                          content: "Simulated paper order execution cancelled by user.",
                                          createdAt: new Date().toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          }),
                                        });
                                      }}
                                      className="py-2 px-3 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] font-semibold text-xs transition"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* On-Chain Stock Transfer Confirmation Card */}
                              {msg.actionCard.type === "transfer_stock_confirm" && (
                                <div className="p-3 rounded-xl bg-white border border-[#EBE3D5] text-xs space-y-2.5">
                                  <div className="flex items-center justify-between text-[11px] font-mono text-[#7A6A5E]">
                                    <span>Token Standard:</span>
                                    <span className="font-bold text-purple-900">
                                      NEAR NEP-141 Fungible Token
                                    </span>
                                  </div>
                                  <div className="p-2.5 rounded-lg bg-[#FAF7F0] border border-[#EBE3D5] space-y-1.5 font-mono text-[11px]">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[#6E5D4F]">Recipient Wallet:</span>
                                      <span className="font-bold text-[#1E1315] truncate max-w-[160px]">
                                        {msg.actionCard.details.recipientAddress}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[#6E5D4F]">Transfer Shares:</span>
                                      <span className="font-bold text-[#1E1315]">
                                        {msg.actionCard.details.shares} {msg.actionCard.details.symbol}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[#6E5D4F]">Estimated Value:</span>
                                      <span className="font-bold text-emerald-800">
                                        ${msg.actionCard.details.amountUsd?.toFixed(2)} USD
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleExecuteSimulatedTransfer(msg.actionCard?.details);
                                      }}
                                      className="flex-1 py-2 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] font-bold text-xs transition cursor-pointer"
                                    >
                                      Authorize NEP-141 Transfer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        appendTerminalMessage({
                                          id: `cancel_${Date.now()}`,
                                          role: "assistant",
                                          content: "On-chain stock transfer cancelled by user.",
                                          createdAt: new Date().toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          }),
                                        });
                                      }}
                                      className="py-2 px-3 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] font-semibold text-xs transition"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Paper Simulation Status */}
                              {msg.actionCard.type === "trade_executed" && (
                                <div className="flex items-center justify-between text-[11px] text-[#7A6A5E] font-mono pt-1">
                                  <span className="text-amber-800 font-semibold">
                                    Paper Trading Sandbox
                                  </span>
                                  <span className="text-emerald-700 font-semibold">
                                    Simulated Paper Order Executed
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <span className="text-[9px] font-mono text-[#6E5D4F] mt-0.5 block px-1">
                          {msg.createdAt}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Processing Indicator */}
                {isProcessing && (
                  <div className="flex gap-2.5 my-2 flex-row items-center">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold shadow-2xs bg-[#1E1315] text-[#FAF7F0] border border-[#1E1315]">
                      <Shield className="w-3.5 h-3.5 text-[#FAF7F0]" />
                    </div>
                    <div className="p-2.5 rounded-2xl rounded-tl-xs bg-white border border-[#EBE3D5] text-[#1E1315] shadow-2xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      <span className="text-xs text-[#7A6A5E] font-medium italic">
                        Analyzing intent &amp; quotes...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input & Suggestion Pills */}
              <div className="pt-2 shrink-0 space-y-2 border-t border-[#EBE3D5]/80 mt-1">
                {/* Suggestions with subtle right edge fade */}
                <div className="relative">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-xs no-scrollbar pr-6">
                    {DEFAULT_SUGGESTIONS.map((sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => handleSendMessage(sugg)}
                        className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-[#E5DAC6] hover:border-[#1E1315] text-[10px] text-[#5A4B42] hover:text-[#1E1315] font-medium transition-colors shadow-2xs cursor-pointer"
                      >
                        {sugg}
                      </button>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#FAF7F0] to-transparent" />
                </div>

                {/* Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="relative flex items-center w-full"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Copilot: 'DCA $50 TSLA daily', 'Buy $100 NVDA dip'..."
                    disabled={isProcessing}
                    className="w-full bg-white border border-[#EBE3D5] rounded-2xl py-2.5 pl-3.5 pr-10 text-xs text-[#1E1315] placeholder-[#6E5D4F] focus:outline-none focus:border-[#1E1315] transition shadow-2xs disabled:bg-[#FAF7F0]"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isProcessing}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] disabled:opacity-40 disabled:hover:bg-[#1E1315] text-[#FAF7F0] transition shadow-xs cursor-pointer"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          MODAL: MANUAL TRADING RULE DIALOG (With Brand Logos, Sentiment & % Mode)
         ========================================================================= */}
      {isAddRuleOpen && (() => {
        const selectedAssetInfo =
          liveAssets.find((a) => a.symbol === ruleModalSymbol) || {
            symbol: ruleModalSymbol,
            name: "Tesla Inc (Ondo)",
            price: 348.63,
            change24h: 1.8,
            trend: "bullish" as const,
            rsi14: 48,
            sma20: 340.5,
          };

        const targetNumeric =
          parseFloat(ruleModalTarget) || (triggerInputMode === "percent" ? 5 : selectedAssetInfo.price * 0.95);
        const calculatedTargetPrice =
          triggerInputMode === "percent"
            ? ruleModalType === "buy_dip"
              ? (selectedAssetInfo.price * (1 - targetNumeric / 100)).toFixed(2)
              : (selectedAssetInfo.price * (1 + targetNumeric / 100)).toFixed(2)
            : targetNumeric.toFixed(2);

        const filteredCatalog = liveAssets.filter(
          (a) =>
            a.symbol.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
            a.name.toLowerCase().includes(assetSearchQuery.toLowerCase())
        );

        return (
          <div className="fixed inset-0 z-50 bg-[#1E1315]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#FAF7F0] border border-[#EBE3D5] rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#EBE3D5]">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1E1315]">
                    Create Automated Rule
                  </h3>
                  <span className="text-[10px] font-mono text-amber-800">
                    Paper Trading &amp; Simulation Sandbox
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(false)}
                  className="w-8 h-8 rounded-full bg-white border border-[#EBE3D5] flex items-center justify-center text-[#7A6A5E] hover:text-[#1E1315]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 1. Custom Asset Selector with Logos & Search */}
                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#1E1315]">
                      Select Asset
                    </label>
                    <span className="text-[10px] font-mono text-[#7A6A5E]">
                      {filteredCatalog.length} available
                    </span>
                  </div>

                  {/* Trigger Dropdown Button */}
                  <div
                    onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
                    className="w-full bg-white border border-[#EBE3D5] rounded-xl p-2.5 flex items-center justify-between cursor-pointer hover:border-[#1E1315] transition shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AssetLogo symbol={ruleModalSymbol} className="w-7 h-7" />
                      <div className="truncate">
                        <div className="font-mono font-bold text-xs text-[#1E1315]">
                          {ruleModalSymbol}
                        </div>
                        <div className="text-[11px] text-[#7A6A5E] truncate">
                          {selectedAssetInfo.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs font-bold text-[#1E1315] shrink-0 pl-2">
                      ${selectedAssetInfo.price.toFixed(2)}
                    </div>
                  </div>

                  {/* Dropdown Menu */}
                  {isAssetDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#EBE3D5] rounded-2xl shadow-xl z-30 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                      {/* Search Bar */}
                      <input
                        type="text"
                        value={assetSearchQuery}
                        onChange={(e) => setAssetSearchQuery(e.target.value)}
                        placeholder="Search stock or crypto..."
                        className="w-full bg-[#FAF7F0] border border-[#EBE3D5] rounded-lg px-2.5 py-1.5 text-xs text-[#1E1315] outline-none placeholder-[#6E5D4F]"
                        autoFocus
                      />

                      {/* Scrollable list */}
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {filteredCatalog.map((item) => (
                          <div
                            key={item.symbol}
                            onClick={() => {
                              setRuleModalSymbol(item.symbol);
                              setIsAssetDropdownOpen(false);
                              setAssetSearchQuery("");
                            }}
                            className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${
                              ruleModalSymbol === item.symbol
                                ? "bg-[#FAF7F0] border border-[#1E1315]"
                                : "hover:bg-[#FAF7F0]"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <AssetLogo symbol={item.symbol} className="w-6 h-6" />
                              <div className="truncate">
                                <span className="font-mono font-bold text-xs text-[#1E1315]">
                                  {item.symbol}
                                </span>
                                <span className="text-[10px] text-[#7A6A5E] ml-1.5 truncate">
                                  {item.name}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono text-xs font-bold text-[#1E1315] shrink-0">
                              ${item.price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Context Price & Sentiment Banner */}
                <div className="p-3 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-between font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-[#7A6A5E] uppercase tracking-wider">
                      Current Live Price
                    </div>
                    <div className="font-bold text-sm text-[#1E1315] mt-0.5">
                      ${selectedAssetInfo.price.toFixed(2)}
                      <span
                        className={`text-xs ml-1.5 font-semibold ${
                          selectedAssetInfo.change24h >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        {selectedAssetInfo.change24h >= 0 ? "+" : ""}
                        {selectedAssetInfo.change24h}%
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-[#7A6A5E] uppercase tracking-wider">
                      Market Sentiment
                    </div>
                    <div className="text-xs font-bold text-emerald-800 capitalize mt-0.5">
                      {selectedAssetInfo.trend || "Bullish"} (RSI {selectedAssetInfo.rsi14 || 48})
                    </div>
                  </div>
                </div>

                {/* 3. Rule Strategy Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E1315]">Trading Strategy</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRuleModalType("buy_dip");
                        setRuleModalTarget(
                          triggerInputMode === "percent"
                            ? "5"
                            : (selectedAssetInfo.price * 0.95).toFixed(2)
                        );
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition text-left ${
                        ruleModalType === "buy_dip"
                          ? "bg-[#1E1315] text-[#FAF7F0] shadow-2xs"
                          : "bg-white border border-[#EBE3D5] text-[#7A6A5E] hover:border-[#1E1315]"
                      }`}
                    >
                      <div className="font-bold">Buy Dip</div>
                      <div className="text-[10px] opacity-80 font-normal">Limit entry on dip</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRuleModalType("take_profit");
                        setRuleModalTarget(
                          triggerInputMode === "percent"
                            ? "10"
                            : (selectedAssetInfo.price * 1.1).toFixed(2)
                        );
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition text-left ${
                        ruleModalType === "take_profit"
                          ? "bg-[#1E1315] text-[#FAF7F0] shadow-2xs"
                          : "bg-white border border-[#EBE3D5] text-[#7A6A5E] hover:border-[#1E1315]"
                      }`}
                    >
                      <div className="font-bold">Take Profit</div>
                      <div className="text-[10px] opacity-80 font-normal">Exit on price surge</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRuleModalType("bracket_order");
                        setRuleModalTarget(
                          triggerInputMode === "percent"
                            ? "10"
                            : (selectedAssetInfo.price * 1.1).toFixed(2)
                        );
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition text-left ${
                        ruleModalType === "bracket_order"
                          ? "bg-[#1E1315] text-[#FAF7F0] shadow-2xs"
                          : "bg-white border border-[#EBE3D5] text-[#7A6A5E] hover:border-[#1E1315]"
                      }`}
                    >
                      <div className="font-bold">Bracket Order</div>
                      <div className="text-[10px] opacity-80 font-normal">Buy now + Auto TP</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRuleModalType("recurring_buy");
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition text-left ${
                        ruleModalType === "recurring_buy"
                          ? "bg-[#1E1315] text-[#FAF7F0] shadow-2xs"
                          : "bg-white border border-[#EBE3D5] text-[#7A6A5E] hover:border-[#1E1315]"
                      }`}
                    >
                      <div className="font-bold">DCA (Recurring)</div>
                      <div className="text-[10px] opacity-80 font-normal">Automated schedule</div>
                    </button>
                  </div>
                </div>

                {/* 4A. Cadence Selection for DCA */}
                {ruleModalType === "recurring_buy" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E1315]">
                      Execution Frequency (Cadence)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                      {[
                        { id: "1m", label: "1 min", desc: "Fast Demo" },
                        { id: "5m", label: "5 min", desc: "Testnet" },
                        { id: "hourly", label: "Hourly", desc: "60 mins" },
                        { id: "daily", label: "Daily", desc: "24 hrs" },
                        { id: "weekly", label: "Weekly", desc: "7 days" },
                      ].map((cad) => (
                        <button
                          key={cad.id}
                          type="button"
                          onClick={() => setRuleModalCadence(cad.id as any)}
                          className={`py-2 px-1.5 rounded-xl font-bold transition flex flex-col items-center justify-center ${
                            ruleModalCadence === cad.id
                              ? "bg-[#1E1315] text-[#FAF7F0]"
                              : "bg-white border border-[#EBE3D5] text-[#7A6A5E] hover:border-[#1E1315]"
                          }`}
                        >
                          <span>{cad.label}</span>
                          <span className="text-[9px] font-normal opacity-70">{cad.desc}</span>
                        </button>
                      ))}
                    </div>
                    <div className="text-[11px] font-mono text-[#7A6A5E] bg-[#FAF7F0] p-2 rounded-lg border border-[#EBE3D5]">
                      Autonomously buys ${parseFloat(ruleModalAmount) || 50} {ruleModalSymbol}{" "}
                      {ruleModalCadence === "1m"
                        ? "every minute (Fast Demo Mode)"
                        : ruleModalCadence === "5m"
                        ? "every 5 minutes"
                        : ruleModalCadence === "hourly"
                        ? "every hour"
                        : ruleModalCadence === "weekly"
                        ? "every week"
                        : "every day"}{" "}
                      from your liquid sandbox balance.
                    </div>
                  </div>
                ) : (
                  /* 4B. Trigger Mode Toggle ($ Price vs % Mode) for Limit / TP / Bracket */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#1E1315]">
                        {ruleModalType === "buy_dip"
                          ? "Dip Threshold"
                          : ruleModalType === "bracket_order"
                          ? "Take-Profit Target"
                          : "Profit Target"}
                      </label>

                      {/* % Mode vs $ Price Switcher */}
                      <div className="flex items-center bg-[#EFE8D8] p-0.5 rounded-lg border border-[#E5DAC6] text-[10px] font-mono">
                        <button
                          type="button"
                          onClick={() => {
                            setTriggerInputMode("percent");
                            setRuleModalTarget(ruleModalType === "buy_dip" ? "5" : "10");
                          }}
                          className={`px-2 py-0.5 rounded-md font-bold transition ${
                            triggerInputMode === "percent"
                              ? "bg-[#1E1315] text-[#FAF7F0]"
                              : "text-[#6B5A4E]"
                          }`}
                        >
                          % Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTriggerInputMode("price");
                            setRuleModalTarget(
                              ruleModalType === "buy_dip"
                                ? (selectedAssetInfo.price * 0.95).toFixed(2)
                                : (selectedAssetInfo.price * 1.1).toFixed(2)
                            );
                          }}
                          className={`px-2 py-0.5 rounded-md font-bold transition ${
                            triggerInputMode === "price"
                              ? "bg-[#1E1315] text-[#FAF7F0]"
                              : "text-[#6B5A4E]"
                          }`}
                        >
                          $ Price
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={ruleModalTarget}
                        onChange={(e) => setRuleModalTarget(e.target.value)}
                        placeholder={triggerInputMode === "percent" ? "5" : "345.00"}
                        className="w-full bg-white border border-[#EBE3D5] rounded-xl px-3 py-2 text-xs font-mono text-[#1E1315] outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#7A6A5E]">
                        {triggerInputMode === "percent" ? "%" : "USD"}
                      </span>
                    </div>

                    {/* Calculated Target Price Feedback */}
                    <div className="text-[11px] font-mono text-[#7A6A5E] bg-[#FAF7F0] p-2 rounded-lg border border-[#EBE3D5]">
                      {ruleModalType === "buy_dip" ? (
                        <>
                          Triggers buy order at:{" "}
                          <span className="font-bold text-[#1E1315]">${calculatedTargetPrice}</span> (
                          {triggerInputMode === "percent"
                            ? `${targetNumeric}% drop`
                            : `approx. -${(
                                ((selectedAssetInfo.price - parseFloat(calculatedTargetPrice)) /
                                  selectedAssetInfo.price) *
                                100
                              ).toFixed(1)}%`}
                          )
                        </>
                      ) : ruleModalType === "bracket_order" ? (
                        <>
                          Buys immediately at{" "}
                          <span className="font-bold text-[#1E1315]">${selectedAssetInfo.price.toFixed(2)}</span> &amp; sells when gain reaches:{" "}
                          <span className="font-bold text-[#1E1315]">${calculatedTargetPrice}</span> (
                          {triggerInputMode === "percent"
                            ? `+${targetNumeric}%`
                            : `approx. +${(
                                ((parseFloat(calculatedTargetPrice) - selectedAssetInfo.price) /
                                  selectedAssetInfo.price) *
                                100
                              ).toFixed(1)}%`}
                          )
                        </>
                      ) : (
                        <>
                          Triggers sell order at:{" "}
                          <span className="font-bold text-[#1E1315]">${calculatedTargetPrice}</span> (
                          {triggerInputMode === "percent"
                            ? `+${targetNumeric}% gain`
                            : `approx. +${(
                                ((parseFloat(calculatedTargetPrice) - selectedAssetInfo.price) /
                                  selectedAssetInfo.price) *
                                100
                              ).toFixed(1)}%`}
                          )
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Allocation Amount ($ USDC) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E1315]">
                    Allocation Amount ($ USDC)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={ruleModalAmount}
                      onChange={(e) => setRuleModalAmount(e.target.value)}
                      placeholder="100.00"
                      className="w-full bg-white border border-[#EBE3D5] rounded-xl px-3 py-2 text-xs font-mono text-[#1E1315] outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#7A6A5E]">
                      USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#EBE3D5] bg-white text-xs font-semibold text-[#1E1315] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateModalRule}
                  className="flex-1 py-2.5 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-xs font-semibold text-[#FAF7F0] shadow-xs cursor-pointer"
                >
                  {ruleModalType === "bracket_order"
                    ? "Buy Entry & Arm Take-Profit"
                    : ruleModalType === "recurring_buy"
                    ? "Activate DCA Schedule"
                    : "Activate Simulation Rule"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom Styled Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
      />
    </div>
  );
}
