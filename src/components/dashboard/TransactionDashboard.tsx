"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  Shield,
  Plus,
  Send,
  Zap,
  Trash2,
  QrCode,
  X,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  Filter,
  Settings,
  Sliders,
} from "lucide-react";
import {
  getTransactions,
  getPayLinks,
  TransactionRecord,
  PayLinkRecord,
} from "@/lib/transactions-store";
import {
  getStoredAgentSession,
  freezeAgentSession,
  unfreezeAgentSession,
} from "@/lib/near-embedded-wallet";
import { DepositModal } from "@/components/modals/DepositModal";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { WalletSettingsModal } from "@/components/modals/WalletSettingsModal";
import { StockCatalogModal } from "@/components/modals/StockCatalogModal";
import { AuthModal } from "@/components/modals/AuthModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { useAuth } from "@/context/AuthContext";
import { AssetLogo, ChainLogo } from "@/components/common/AssetLogo";
import { PortfolioPosition } from "@/lib/market-analyst";
import { TradingRule } from "@/lib/trading-copilot";

export function TransactionDashboard() {
  const {
    user,
    isLoading,
    balanceUsd,
    nearBalance,
    nearTokens,
    evmBalance,
    refreshAccountData,
    networkMode,
    spendingLimitUsd = 50.0,
    spentUsd = 0.0,
  } = useAuth();
  const handle = user?.xHandle || "guest";

  const [isAgentFrozen, setIsAgentFrozen] = useState(false);

  useEffect(() => {
    if (user?.xHandle) {
      const session = getStoredAgentSession(user.xHandle);
      setIsAgentFrozen(Boolean(session?.isFrozen));
    }
  }, [user?.xHandle]);

  const handleToggleFreeze = () => {
    if (!user?.xHandle) return;
    if (isAgentFrozen) {
      unfreezeAgentSession(user.xHandle);
      setIsAgentFrozen(false);
    } else {
      freezeAgentSession(user.xHandle);
      setIsAgentFrozen(true);
    }
  };

  const capRatio = spendingLimitUsd > 0 ? Math.min(100, Math.round((spentUsd / spendingLimitUsd) * 100)) : 0;

  // Unified Dashboard Tabs: "all_holdings" | "rules" | "paylinks" | "transfers"
  const [activeTab, setActiveTab] = useState<"all_holdings" | "rules" | "paylinks" | "transfers">("all_holdings");

  // Filter within All Holdings tab: "all" | "stocks" | "crypto"
  const [holdingsFilter, setHoldingsFilter] = useState<"all" | "stocks" | "crypto">("all");

  // Public / Shielded Mode State (icon button beside total price)
  const [isShielded, setIsShielded] = useState(false);

  // Portfolio & Stocks State (Synchronized with Terminal Sandbox / On-chain)
  const [cashUsd, setCashUsd] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const c = sessionStorage.getItem("veil_cached_cash_usd");
      if (c) return parseFloat(c) || 0.0;
    }
    return 0.0;
  });
  const [paperCashUsd, setPaperCashUsd] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const p = sessionStorage.getItem("veil_cached_paper_cash_usd");
      if (p) return parseFloat(p) || 10000.0;
    }
    return 10000.0;
  });
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
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("veil_cached_positions");
    }
    return true;
  });
  const [livePrices, setLivePrices] = useState<Record<string, { priceUsd: number; change24h: number }>>({
    NEAR: { priceUsd: 3.70, change24h: 0.0 },
    ETH: { priceUsd: 2240.0, change24h: 0.0 },
  });

  // Social Payments & PayLinks State
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [payLinks, setPayLinks] = useState<PayLinkRecord[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "inflow" | "outflow">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [claimingTxId, setClaimingTxId] = useState<string | null>(null);

  // Custom Styled Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    variant: "danger" | "warning" | "info" | "success";
  }>({
    isOpen: false,
    title: "",
    description: "",
    variant: "warning",
  });

  // Sync Shielded Mode preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("Veil_shielded_mode");
      if (saved === "true") setIsShielded(true);
    } catch {}

    const handlePrivacyChange = (e: any) => {
      if (e?.detail?.isShielded !== undefined) {
        setIsShielded(Boolean(e.detail.isShielded));
      }
    };
    window.addEventListener("Veil_privacy_mode_changed", handlePrivacyChange);
    return () => window.removeEventListener("Veil_privacy_mode_changed", handlePrivacyChange);
  }, []);

  const toggleShielded = () => {
    const next = !isShielded;
    setIsShielded(next);
    try {
      localStorage.setItem("Veil_shielded_mode", next ? "true" : "false");
      window.dispatchEvent(
        new CustomEvent("Veil_privacy_mode_changed", {
          detail: { isShielded: next },
        })
      );
    } catch {}
  };

  // Load Portfolio Data (Equities & Rules) - Clean Zero Mock Funds
  const loadPortfolio = useCallback(async () => {
    try {
      const res = await fetch(`/api/portfolio?handle=${encodeURIComponent(handle)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.portfolio) {
          const nextCash = data.portfolio.cashUsd ?? 0.0;
          setCashUsd(nextCash);
          sessionStorage.setItem("veil_cached_cash_usd", String(nextCash));

          if (typeof data.portfolio.paperCashUsd === "number") {
            setPaperCashUsd(data.portfolio.paperCashUsd);
            sessionStorage.setItem("veil_cached_paper_cash_usd", String(data.portfolio.paperCashUsd));
          }
          if (Array.isArray(data.portfolio.positions)) {
            const validPositions = data.portfolio.positions.filter(
              (p: any) => p && typeof p.shares === "number" && p.shares > 0
            );
            setPositions(validPositions);
            sessionStorage.setItem("veil_cached_positions", JSON.stringify(validPositions));
          } else {
            setPositions([]);
          }

          if (Array.isArray(data.portfolio.rules)) {
            setRules(data.portfolio.rules);
            sessionStorage.setItem("veil_cached_rules", JSON.stringify(data.portfolio.rules));
          } else {
            setRules([]);
          }
        }
      }
    } catch (e) {
      console.warn("Portfolio load error:", e);
    } finally {
      setIsPortfolioLoading(false);
    }
  }, [handle]);

  // Load Social Data (Transactions & PayLinks) & Live Oracle Prices for Crypto & Equities
  useEffect(() => {
    loadPortfolio();

    const fetchAllPrices = () => {
      const stockSymbols = positions.map((p) => p.symbol).join(",");
      const querySymbols = stockSymbols
        ? `NEAR,ETH,BTC,SOL,USDC,${stockSymbols}`
        : "NEAR,ETH,BTC,SOL,USDC,NVDAon,TSLAon,AAPLon,MSFTon,SPYon";

      fetch(`/api/prices?symbols=${encodeURIComponent(querySymbols)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.prices) {
            const mapped: Record<string, { priceUsd: number; change24h: number }> = {};
            for (const [sym, quote] of Object.entries(d.prices)) {
              const q = quote as any;
              if (q && typeof q.priceUsd === "number") {
                mapped[sym.toUpperCase()] = { priceUsd: q.priceUsd, change24h: q.change24h || 0 };
              }
            }
            if (d.nearPrice && !mapped["NEAR"]) {
              mapped["NEAR"] = { priceUsd: d.nearPrice, change24h: 0 };
            }
            if (d.ethPrice && !mapped["ETH"]) {
              mapped["ETH"] = { priceUsd: d.ethPrice, change24h: 0 };
            }
            setLivePrices((prev) => ({
              ...prev,
              ...mapped,
            }));
          }
        })
        .catch(() => {});
    };

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 25000);
    return () => clearInterval(interval);
  }, [loadPortfolio, positions]);

  // Terminal-to-Dashboard Real-time Synchronization
  useEffect(() => {
    const handlePaperCashSync = (e: any) => {
      const val =
        e?.detail?.paperCashUsd ??
        e?.detail?.cash ??
        e?.detail?.value ??
        (typeof e?.detail === "number" ? e.detail : undefined);
      if (typeof val === "number" && !isNaN(val)) {
        setPaperCashUsd(val);
        sessionStorage.setItem("veil_cached_paper_cash_usd", String(val));
      }
    };

    const handleActivitySync = () => {
      loadPortfolio();
      const localTxs = getTransactions(handle);
      setTransactions(localTxs);
      const localLinks = getPayLinks(handle);
      setPayLinks(localLinks);
    };

    window.addEventListener("veil_paper_cash_updated", handlePaperCashSync);
    window.addEventListener("veilx_activity_updated", handleActivitySync);
    return () => {
      window.removeEventListener("veil_paper_cash_updated", handlePaperCashSync);
      window.removeEventListener("veilx_activity_updated", handleActivitySync);
    };
  }, [loadPortfolio, handle]);

  useEffect(() => {
    const localTxs = getTransactions(handle);
    setTransactions(localTxs);

    const localLinks = getPayLinks(handle);
    setPayLinks(localLinks);

    if (user?.xHandle) {
      fetch(`/api/transactions?handle=${encodeURIComponent(user.xHandle)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.transactions && Array.isArray(data.transactions)) {
            const mapped: TransactionRecord[] = data.transactions.map((tx: any) => ({
              id: tx._id || tx.id || `tx_${Date.now()}`,
              type: tx.type || "tip_sent",
              title: tx.memo || (tx.isInflow ? `Received from ${tx.counterparty || "someone"}` : `Sent to ${tx.counterparty || "recipient"}`),
              counterparty: tx.counterparty || "@recipient",
              amountUsd: Number(tx.amountUsd) || 0,
              asset: tx.asset || "NEAR",
              status: tx.status || "completed",
              statusLabel: !tx.isInflow ? "Sent" : (tx.statusLabel || tx.status || "Completed"),
              txHash: tx.txHash,
              timestamp: tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "Recently",
              isInflow: Boolean(tx.isInflow),
              memo: tx.memo,
            }));
            setTransactions(mapped);
          }
        })
        .catch(() => {});

      fetch(`/api/paylinks?creator=${encodeURIComponent(user.xHandle)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.paylinks && Array.isArray(data.paylinks)) {
            const mapped: PayLinkRecord[] = data.paylinks.map((pl: any) => ({
              id: pl._id || pl.id || `pl_${Date.now()}`,
              slug: pl.slug,
              title: pl.memo || "Payment Request",
              amountUsd: Number(pl.amountUsd) || 0,
              recipientAccount: pl.recipientNearAccount || user?.nearAccountId || "Veil-agent.testnet",
              supportedChains: pl.supportedChains || ["Base (USDC)", "Solana (SOL)", "NEAR (USDC)"],
              status: pl.status || "active",
              createdAt: pl.createdAt ? new Date(pl.createdAt).toLocaleDateString() : "Recently",
              totalCollectedUsd: Number(pl.totalCollectedUsd) || 0,
            }));
            setPayLinks(mapped);
          }
        })
        .catch(() => {});
    }
  }, [handle, loadPortfolio, user?.xHandle, user?.nearAccountId]);

  // Handle Add Stock from Catalog (Adds to Watchlist with 0 shares - Zero phantom equity)
  const handleAddStock = async (stock: { symbol: string; name: string; price: number }) => {
    const existing = positions.find((p) => p.symbol === stock.symbol);
    if (existing) return;

    const newPosition: PortfolioPosition = {
      symbol: stock.symbol,
      name: stock.name,
      shares: 0,
      avgEntryPrice: stock.price,
      currentPrice: stock.price,
      currentValueUsd: 0,
      pnlUsd: 0,
      pnlPercent: 0,
      allocationPercent: 0,
    };

    const updated = [...positions, newPosition];
    setPositions(updated);

    try {
      await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          cashUsd,
          positions: updated,
          rules,
        }),
      });
    } catch (e) {
      console.error("Failed to add stock to portfolio:", e);
    }
  };

  // Handle Cancel Rule
  const handleCancelRule = async (ruleId: string) => {
    const updated = rules.map((r) => (r.id === ruleId ? { ...r, status: "cancelled" as const } : r));
    setRules(updated);
    try {
      await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          cashUsd,
          positions,
          rules: updated,
        }),
      });
    } catch (e) {
      console.error("Cancel rule error:", e);
    }
  };

  // Handle Claim Incoming Tip
  const handleClaimInflowTip = async (tx: TransactionRecord) => {
    if (!user) return;
    setClaimingTxId(tx.id);
    try {
      const res = await fetch(`/api/near/pending-tips?handle=${encodeURIComponent(user.xHandle)}`);
      const data = await res.json();
      const matchingTip = data?.pendingTips?.find((t: any) => t.depositTxHash === tx.txHash) || data?.pendingTips?.[0];

      if (!matchingTip) {
        setAlertModal({
          isOpen: true,
          title: "Claim Tip",
          description: "No matching pending tip found in escrow to claim.",
          variant: "info",
        });
        setClaimingTxId(null);
        return;
      }

      const claimRes = await fetch("/api/relay/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipId: matchingTip.tipId,
          recipientHandle: user.xHandle,
          recipientWallet: user.nearAccountId,
        }),
      });
      const claimData = await claimRes.json();
      if (!claimRes.ok || !claimData.success) {
        setAlertModal({
          isOpen: true,
          title: "Claim Failed",
          description: claimData.error || "Claim failed on-chain",
          variant: "danger",
        });
        setClaimingTxId(null);
        return;
      }

      await refreshAccountData();
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === tx.id
            ? {
                ...t,
                status: "claimed",
                statusLabel: "Claimed via Relayer (Gasless)",
                txHash: claimData.txHash,
              }
            : t
        )
      );
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: "Claim Error",
        description: err.message || "Failed to claim tip",
        variant: "danger",
      });
    } finally {
      setClaimingTxId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // =========================================================================
  // CALCULATIONS: Unifying Equities, EVM Holdings, and NEAR Balances
  // Strictly synchronized with Terminal Sandbox and On-Chain Storage
  // =========================================================================
  const isTestnet = (networkMode || "testnet") === "testnet";

  // Active Positions: Strictly synchronized with Terminal / Database positions (Zero hardcoded phantom stocks)
  const activePositions: PortfolioPosition[] = useMemo(() => {
    return positions.filter((p) => p && typeof p.shares === "number" && p.shares > 0);
  }, [positions]);

  // Calculate real equity holdings using live oracle quotes
  const positionsValueUsd = useMemo(() => {
    return activePositions.reduce((sum, p) => {
      const upperSym = p.symbol.toUpperCase();
      const liveData = livePrices[upperSym] || livePrices[upperSym.replace(/ON$/, "")];
      const livePrice = liveData?.priceUsd || p.currentPrice || 0;
      return sum + (p.shares > 0 ? p.shares * livePrice : 0);
    }, 0);
  }, [activePositions, livePrices]);

  const fundedPositions = activePositions;

  // Parse EVM Balances safely (Zero mock values)
  const evmUsdcNum = evmBalance?.usdc ? parseFloat(evmBalance.usdc) : 0.0;
  const evmEthNum = evmBalance?.eth ? parseFloat(evmBalance.eth) : 0.0;
  const ethPriceUsd = livePrices.ETH?.priceUsd || 2240.0;
  const ethChange24h = livePrices.ETH?.change24h || 0.0;
  const evmEthUsd = evmEthNum * ethPriceUsd;

  // Aggregate total liquid USDC across all connected chains (Base + Arbitrum + Ethereum Sepolia)
  const totalUsdcAcrossChains = useMemo(() => {
    if (evmBalance?.holdings && Array.isArray(evmBalance.holdings)) {
      const sum = evmBalance.holdings
        .filter((h) => h.symbol === "USDC")
        .reduce((acc, h) => acc + (parseFloat(h.balance) || 0), 0);
      if (sum > 0) return sum;
    }
    return evmUsdcNum;
  }, [evmBalance?.holdings, evmUsdcNum]);

  // Near Balance USD (Live CoinMarketCap / Oracle resolved)
  const nearNum = parseFloat(nearBalance) || 0.0;
  const nearPriceUsd = livePrices.NEAR?.priceUsd || 3.70;
  const nearChange24h = livePrices.NEAR?.change24h || 0.0;
  const nearUsd = nearNum * nearPriceUsd;

  // NEP-141 Tokens on NEAR (USDC, USDT)
  const nearTokensUsd = Array.isArray(nearTokens)
    ? nearTokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0)
    : 0;

  // Total Liquid Cash: When in Testnet mode, reflects on-chain wallet funds while paperCashUsd tracks sandbox virtual capital
  const evmTotalUsd = typeof evmBalance?.totalEvmUsd === "number" ? evmBalance.totalEvmUsd : (evmUsdcNum + evmEthUsd);
  const onChainLiquidUsd = Number((evmTotalUsd + nearUsd + nearTokensUsd).toFixed(2));
  const liquidTotalUsd = onChainLiquidUsd;

  // Overall Total Net Worth: Harmonized 1:1 with Terminal Sandbox in Testnet, On-Chain in Mainnet
  const totalNetWorth = isTestnet
    ? Number((positionsValueUsd + paperCashUsd).toFixed(2))
    : Number((positionsValueUsd + onChainLiquidUsd).toFixed(2));
  const activeRulesCount = rules.filter((r) => r.status === "active").length;

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filteredTransactions = transactions.filter((tx) => {
    if (activityFilter === "inflow") return tx.isInflow;
    if (activityFilter === "outflow") return !tx.isInflow;
    return true;
  });

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Unified holdings list combining tokenized stocks, paper capital, and crypto assets
  const unifiedHoldings = useMemo(() => {
    const list: Array<{
      id: string;
      symbol: string;
      name: string;
      category: "stock" | "crypto";
      categoryBadge: string;
      network: string;
      chain: string;
      units: number;
      unitsLabel: string;
      priceUsd: number;
      valueUsd: number;
      change24h: number;
      actionType: "trade" | "transfer";
    }> = [];

    // 1. Add Tokenized Equities (Enriched with Live Yahoo Finance & Defuse Market Quotes)
    activePositions.forEach((p) => {
      if (!p.shares || p.shares <= 0) return;

      const cleanName = p.name.replace(/\s*\(Ondo\)/gi, "").trim();
      const upperSym = p.symbol.toUpperCase();
      const liveData = livePrices[upperSym] || livePrices[upperSym.replace(/ON$/, "")];
      const livePrice = liveData?.priceUsd || p.currentPrice;
      const liveChange = liveData?.change24h !== undefined ? liveData.change24h : (p.pnlPercent || 0.0);
      const realValueUsd = Number(((p.shares || 0) * livePrice).toFixed(2));
      list.push({
        id: `stock_${p.symbol}`,
        symbol: p.symbol,
        name: cleanName,
        category: "stock",
        categoryBadge: isTestnet ? "Testnet Sandbox" : "US Equity",
        network: "NEAR Protocol",
        chain: "NEAR",
        units: p.shares,
        unitsLabel: `${p.shares} shs`,
        priceUsd: livePrice,
        valueUsd: realValueUsd,
        change24h: liveChange,
        actionType: "trade",
      });
    });

    // 2. In Testnet Mode: Add Paper Sandbox USDC as Primary Trading Capital
    if (isTestnet) {
      list.push({
        id: "crypto_usdc_paper",
        symbol: "USDC",
        name: "USD Coin (Paper Sandbox)",
        category: "crypto",
        categoryBadge: "Sandbox Trading",
        network: "Paper Trading Engine",
        chain: "Sandbox",
        units: paperCashUsd,
        unitsLabel: `${paperCashUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
        priceUsd: 1.0,
        valueUsd: paperCashUsd,
        change24h: 0.0,
        actionType: "trade",
      });
    }

    // 3. Add On-Chain Base Sepolia USDC (reflecting authentic Base balance)
    const baseHoldingUsdc = evmBalance?.holdings?.find((h) => h.network === "Base Sepolia" && h.symbol === "USDC");
    const baseUsdcUnits = baseHoldingUsdc ? (parseFloat(baseHoldingUsdc.balance) || 0) : evmUsdcNum;

    if (baseUsdcUnits > 0 || isTestnet || (!isTestnet && activePositions.length === 0)) {
      list.push({
        id: "crypto_usdc_base",
        symbol: "USDC",
        name: isTestnet ? "USD Coin (Base Sepolia)" : "USD Coin",
        category: "crypto",
        categoryBadge: isTestnet ? "Base Sepolia" : "Liquid Stablecoin",
        network: isTestnet ? "Base Sepolia" : "Base / Universal EVM",
        chain: "Base",
        units: baseUsdcUnits,
        unitsLabel: `${baseUsdcUnits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
        priceUsd: 1.0,
        valueUsd: baseUsdcUnits,
        change24h: 0.0,
        actionType: "transfer",
      });
    }

    // 4. Add NEAR Native if balance > 0
    if (nearNum > 0) {
      list.push({
        id: "crypto_near",
        symbol: "NEAR",
        name: "NEAR Protocol",
        category: "crypto",
        categoryBadge: "Native L1",
        network: "NEAR Protocol",
        chain: "NEAR",
        units: nearNum,
        unitsLabel: `${nearNum.toFixed(4)} NEAR`,
        priceUsd: nearPriceUsd,
        valueUsd: nearUsd,
        change24h: nearChange24h,
        actionType: "transfer",
      });
    }

    // 4b. Add NEAR NEP-141 Tokens (e.g. USDC, USDT on NEAR)
    if (nearTokens && Array.isArray(nearTokens)) {
      nearTokens.forEach((t) => {
        if (!t.numericBalance || t.numericBalance <= 0) return;
        list.push({
          id: `crypto_near_${t.symbol.toLowerCase()}`,
          symbol: t.symbol,
          name: t.name || `${t.symbol} (NEAR)`,
          category: "crypto",
          categoryBadge: "NEAR NEP-141",
          network: "NEAR Protocol",
          chain: "NEAR",
          units: t.numericBalance,
          unitsLabel: `${t.numericBalance.toFixed(2)} ${t.symbol}`,
          priceUsd: t.usdPrice || 1.0,
          valueUsd: t.valueUsd || Number((t.numericBalance * (t.usdPrice || 1.0)).toFixed(2)),
          change24h: 0.0,
          actionType: "transfer",
        });
      });
    }

    // 4c. Add Base Sepolia USDT if balance > 0
    const baseHoldingUsdt = evmBalance?.holdings?.find((h) => h.network === "Base Sepolia" && h.symbol === "USDT");
    if (baseHoldingUsdt && parseFloat(baseHoldingUsdt.balance) > 0) {
      const uUnits = parseFloat(baseHoldingUsdt.balance) || 0;
      list.push({
        id: "crypto_usdt_base",
        symbol: "USDT",
        name: isTestnet ? "Tether USD (Base Sepolia)" : "Tether USD",
        category: "crypto",
        categoryBadge: isTestnet ? "Base Sepolia" : "Liquid Stablecoin",
        network: isTestnet ? "Base Sepolia" : "Base / Universal EVM",
        chain: "Base",
        units: uUnits,
        unitsLabel: `${uUnits.toFixed(2)} USDT`,
        priceUsd: 1.0,
        valueUsd: uUnits,
        change24h: 0.0,
        actionType: "transfer",
      });
    }

    // 5. Add EVM Ethereum if balance > 0 or in testnet
    if (evmEthNum > 0 || isTestnet) {
      list.push({
        id: "crypto_eth",
        symbol: "ETH",
        name: "Ethereum",
        category: "crypto",
        categoryBadge: "EVM Native",
        network: "Base / Universal EVM",
        chain: "Base",
        units: evmEthNum,
        unitsLabel: `${evmEthNum.toFixed(4)} ETH`,
        priceUsd: ethPriceUsd,
        valueUsd: evmEthUsd,
        change24h: ethChange24h,
        actionType: "transfer",
      });
    }

    // 6. Dynamically Add Multi-Chain EVM Holdings (Arbitrum, Polygon, Optimism, Avalanche, BNB, Ethereum Sepolia)
    // Only displayed when balance > 0 to keep portfolio concise and clean
    if (evmBalance?.holdings && Array.isArray(evmBalance.holdings)) {
      evmBalance.holdings.forEach((h) => {
        // Skip Base Sepolia here because Base USDC and Base ETH are explicitly anchored above
        if (h.network === "Base Sepolia") return;
        const balNum = parseFloat(h.balance) || 0;
        if (balNum <= 0) return;

        let chainName = "Ethereum";
        const netLower = h.network.toLowerCase();
        if (netLower.includes("arbitrum") || netLower.includes("arb")) chainName = "Arbitrum";
        else if (netLower.includes("polygon") || netLower.includes("amoy") || netLower.includes("pol")) chainName = "Polygon";
        else if (netLower.includes("optimism") || netLower.includes("op")) chainName = "Optimism";
        else if (netLower.includes("avalanche") || netLower.includes("avax") || netLower.includes("fuji")) chainName = "Avalanche";
        else if (netLower.includes("bnb") || netLower.includes("bsc") || netLower.includes("binance")) chainName = "BNB";

        const upperSym = h.symbol.toUpperCase();
        const liveQuote = livePrices[upperSym];
        const livePrice = liveQuote?.priceUsd || h.usdPrice;
        const liveChange = liveQuote?.change24h || 0.0;
        const totalValUsd = Number((balNum * livePrice).toFixed(2));

        list.push({
          id: `evm_${h.chainId}_${h.symbol}`,
          symbol: h.symbol,
          name: h.name,
          category: "crypto",
          categoryBadge: h.isNative ? "EVM Gas" : "Liquid Stablecoin",
          network: h.network,
          chain: chainName,
          units: balNum,
          unitsLabel: `${balNum.toFixed(4)} ${h.symbol}`,
          priceUsd: livePrice,
          valueUsd: totalValUsd,
          change24h: liveChange,
          actionType: "transfer",
        });
      });
    }

    return list;
  }, [activePositions, isTestnet, paperCashUsd, evmUsdcNum, evmEthNum, nearNum, nearUsd, nearTokens, evmEthUsd, nearPriceUsd, ethPriceUsd, nearChange24h, ethChange24h, livePrices, evmBalance?.holdings]);

  const filteredHoldings = useMemo(() => {
    if (holdingsFilter === "stocks") return unifiedHoldings.filter((h) => h.category === "stock");
    if (holdingsFilter === "crypto") return unifiedHoldings.filter((h) => h.category === "crypto");
    return unifiedHoldings;
  }, [unifiedHoldings, holdingsFilter]);

  // Blur class when Shielded Privacy mode is active
  const blurClass = isShielded ? "filter blur-[7px] select-none transition-all duration-300 pointer-events-none" : "transition-all duration-300";

  if (isLoading || isPortfolioLoading) {
    return (
      <div className="max-w-4xl w-full mx-auto px-4 py-8 space-y-4">
        <div className="bg-white rounded-3xl border border-[#EBE3D5] p-8 shadow-xs animate-pulse space-y-6">
          <div className="h-4 w-36 bg-[#EFE8D8] rounded"></div>
          <div className="h-10 w-56 bg-[#EFE8D8] rounded"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-[#F2EBDC]">
            <div className="h-16 bg-[#FAF7F0] rounded-xl"></div>
            <div className="h-16 bg-[#FAF7F0] rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md w-full mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl border border-[#EBE3D5] p-8 text-center space-y-5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[#1E1315] text-[#FAF7F0] flex items-center justify-center font-bold text-xl mx-auto shadow-sm">
            <Shield className="w-7 h-7 text-[#FAF7F0]" />
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-2xl font-bold text-[#1E1315] tracking-tight">
              Connect Your Account
            </h2>
            <p className="text-xs text-[#6B5A4E] leading-relaxed">
              Connect with 𝕏 to view your unified portfolio across tokenized stocks, automated trading rules, and social payments.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full h-11 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-semibold inline-flex items-center justify-center gap-2 transition shadow-xs"
          >
            <span>Connect with 𝕏</span>
          </button>
        </div>
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
      {/* =========================================================================
          1. TOP UNIFIED PORTFOLIO NET WORTH CARD (With Icon-Only Eye Toggle)
         ========================================================================= */}
      <div className="bg-white rounded-3xl border border-[#EBE3D5] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#F2EBDC]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#7A6A5E] font-semibold">
                Unified Portfolio Net Worth
              </span>
              {isTestnet && (
                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Sandbox Active
                </span>
              )}
              {isShielded && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Shielded</span>
                </span>
              )}
            </div>

            {/* Total Balance + Icon-Only Privacy Toggle immediately adjacent */}
            <div className="flex items-center gap-3">
              <div className={`font-mono text-3xl sm:text-4xl font-bold text-[#1E1315] tracking-tight ${blurClass}`}>
                ${totalNetWorth.toFixed(2)}
              </div>

              {/* Icon-Only Eye/EyeOff Toggle Button */}
              <button
                type="button"
                onClick={toggleShielded}
                title={isShielded ? "Portfolio is Shielded (click to unmask)" : "Portfolio is Public (click to shield balances)"}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  isShielded
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900"
                    : "bg-[#FAF7F0] hover:bg-[#EFE8D8] border-[#EBE3D5] text-[#7A6A5E] hover:text-[#1E1315]"
                }`}
              >
                {isShielded ? (
                  <EyeOff className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="text-xs text-[#7A6A5E] font-mono flex items-center gap-2">
              <span>@{user.xHandle}</span>
              {isTestnet && (
                <span>
                  · On-Chain Wallet Funds: <strong className="text-[#1E1315] font-bold">${onChainLiquidUsd.toFixed(2)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Top Actions: Deposit, Withdraw, Settings */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDepositModalOpen(true)}
              className="h-9 px-4 rounded-xl bg-[#FAF7F0] hover:bg-[#EFE8D8] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWithdrawModalOpen(true)}
              className="h-9 px-4 rounded-xl bg-[#FAF7F0] hover:bg-[#EFE8D8] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <span>Withdraw</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Wallet & Security Settings"
              className="h-9 w-9 rounded-xl bg-[#FAF7F0] hover:bg-[#EFE8D8] border border-[#EBE3D5] text-[#1E1315] flex items-center justify-center transition cursor-pointer shadow-2xs shrink-0"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dashboard Spending Cap & Safety Guardrail Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#EBE3D5] shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#1E1315]" />
                <span className="text-xs font-bold text-[#1E1315]">Autonomous Daily Spending Cap</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FAF7F0] border border-[#EBE3D5] text-[#6E5D4F]">
                  ${spentUsd.toFixed(2)} / ${spendingLimitUsd.toFixed(2)} USD ({capRatio}%)
                </span>
              </div>
              <p className="text-[11px] text-[#6E5D4F]">
                Guaranteed mathematical ceiling for autonomous trading and micro-tips.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-[#EBE3D5] bg-[#FAF7F0] hover:bg-white text-xs font-semibold text-[#1E1315] transition cursor-pointer"
              >
                Configure Caps
              </button>
              <button
                type="button"
                onClick={handleToggleFreeze}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  isAgentFrozen
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                    : "bg-[#FAF7F0] text-[#1E1315] border-[#EBE3D5] hover:bg-white"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isAgentFrozen ? "bg-rose-600 animate-ping" : "bg-emerald-500"}`} />
                <span>{isAgentFrozen ? "Frozen (Resume)" : "Emergency Freeze"}</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#FAF7F0] h-2.5 rounded-full overflow-hidden border border-[#EBE3D5]">
            <div
              className={`h-full transition-all duration-500 ${
                capRatio > 85 ? "bg-rose-600" : capRatio > 60 ? "bg-amber-500" : "bg-[#1E1315]"
              }`}
              style={{ width: `${capRatio}%` }}
            />
          </div>
        </div>

        {/* Clean High-Level Overview Cards: 3 Cards in Testnet (Equities, Sandbox Capital, On-Chain Reserves), 2 Cards in Mainnet */}
        <div className={`grid grid-cols-1 ${isTestnet ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3.5`}>
          {/* Card 1: US Equities */}
          <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A6A5E]">
                US Equities
              </div>
              {isTestnet && (
                <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  Testnet Sandbox
                </span>
              )}
            </div>
            <div className={`font-mono text-xl font-bold text-[#1E1315] ${blurClass}`}>
              ${positionsValueUsd.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#7A6A5E] font-mono">
              {fundedPositions.length} active positions{positions.length > fundedPositions.length ? ` · ${positions.length - fundedPositions.length} tracked` : ""}
            </div>
          </div>

          {/* Card 2: Paper Sandbox Virtual Capital (Only in Testnet) */}
          {isTestnet && (
            <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A6A5E]">
                  Simulation Capital
                </div>
                <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  Virtual USDC
                </span>
              </div>
              <div className={`font-mono text-xl font-bold text-amber-900 ${blurClass}`}>
                ${paperCashUsd.toFixed(2)}
              </div>
              <div className="text-[11px] text-[#7A6A5E] font-mono">
                $10,000.00 Base Sandbox Allowance
              </div>
            </div>
          )}

          {/* Card 3: Omnichain Liquid Reserves (Actual Testnet Wallet Funds) */}
          <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#7A6A5E]">
                {isTestnet ? "On-Chain Wallet Funds" : "Omnichain Liquid Reserves"}
              </div>
              {isTestnet && (
                <span className="text-[9px] font-mono font-bold text-[#7A6A5E] bg-white px-1.5 py-0.2 rounded border border-[#EBE3D5]">
                  Testnet Wallet
                </span>
              )}
            </div>
            <div className={`font-mono text-xl font-bold text-emerald-800 ${blurClass}`}>
              ${onChainLiquidUsd.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#7A6A5E] font-mono truncate">
              {isTestnet
                ? `${totalUsdcAcrossChains.toFixed(2)} USDC · ${nearBalance} NEAR · ${evmEthNum.toFixed(4)} ETH`
                : `${nearBalance} NEAR • $${totalUsdcAcrossChains.toFixed(2)} USDC • ${evmEthNum.toFixed(4)} ETH`}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. CLEAN 4-TAB SWITCHER (All Holdings | Active Rules | PayLinks | Transfers)
         ========================================================================= */}
      <div className="border-b border-[#EBE3D5] pb-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab("all_holdings")}
            className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === "all_holdings"
                ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                : "text-[#6B5A4E] hover:text-[#1E1315] hover:bg-[#EFE8D8]"
            }`}
          >
            All Holdings ({unifiedHoldings.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "rules"
                ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                : "text-[#6B5A4E] hover:text-[#1E1315] hover:bg-[#EFE8D8]"
            }`}
          >
            <span>Active Rules</span>
            {activeRulesCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === "rules"
                    ? "bg-[#FAF7F0] text-[#1E1315]"
                    : "bg-[#1E1315] text-[#FAF7F0]"
                }`}
              >
                {activeRulesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("paylinks")}
            className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "paylinks"
                ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                : "text-[#6B5A4E] hover:text-[#1E1315] hover:bg-[#EFE8D8]"
            }`}
          >
            <span>PayLinks</span>
            {payLinks.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === "paylinks"
                    ? "bg-[#FAF7F0] text-[#1E1315]"
                    : "bg-[#1E1315] text-[#FAF7F0]"
                }`}
              >
                {payLinks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transfers")}
            className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === "transfers"
                ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                : "text-[#6B5A4E] hover:text-[#1E1315] hover:bg-[#EFE8D8]"
            }`}
          >
            Recent Activity
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: UNIFIED ALL HOLDINGS (Stocks, EVM Balances, and NEAR together)
         ========================================================================= */}
      {activeTab === "all_holdings" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-[#7A6A5E] font-mono">
              Unified portfolio of tokenized US equities, stablecoins, and L1 assets
            </span>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {/* Sub-Filter: All | Stocks | Crypto & Cash */}
              <div className="flex items-center gap-1 bg-[#EFE8D8] p-1 rounded-xl border border-[#E5DAC6] overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
                {(
                  [
                    { id: "all", label: "All Assets" },
                    { id: "stocks", label: "Stocks & ETFs" },
                    { id: "crypto", label: "Crypto & Cash" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setHoldingsFilter(f.id)}
                    className={`flex-1 sm:flex-initial text-center whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      holdingsFilter === f.id
                        ? "bg-[#1E1315] text-[#FAF7F0] shadow-2xs"
                        : "text-[#6B5A4E] hover:text-[#1E1315]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Expand Stocks Button */}
              <button
                type="button"
                onClick={() => setIsCatalogOpen(true)}
                className="w-full sm:w-auto h-9 px-3.5 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Expand Stocks</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#EBE3D5] overflow-hidden shadow-xs">
            <div className="divide-y divide-[#F2EBDC]">
              {filteredHoldings.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A6A5E] space-y-2">
                  <div className="font-semibold text-[#1E1315]">No active positions held yet</div>
                  <div className="text-[11px] text-[#6E5D4F]">
                    Click &quot;Expand Stocks&quot; above to explore 28+ tokenized equities or deploy capital via the Trading Terminal.
                  </div>
                </div>
              ) : (
                filteredHoldings.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 sm:p-4 hover:bg-[#FAF7F0]/60 transition-colors"
                  >
                    {/* Mobile View (< sm): Clean 2-line financial card layout */}
                    <div className="flex sm:hidden flex-col gap-2">
                      {/* Line 1: Identity (left) + Total Value (right) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0 w-8 h-8">
                            <AssetLogo symbol={item.symbol} className="w-full h-full" />
                            {item.chain && (
                              <div className="absolute -top-1 -left-1 ring-2 ring-white rounded-full">
                                <ChainLogo chain={item.chain} className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-[#1E1315] font-mono leading-none">
                                {item.symbol}
                              </span>
                              <span className="text-[10px] font-mono font-medium text-[#7A6A5E] bg-[#FAF3E0] px-1.5 py-0.2 rounded border border-[#E8DCC4]">
                                {item.categoryBadge}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#7A6A5E] truncate mt-0.5">
                              {item.name}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className={`font-mono text-base font-bold text-[#1E1315] leading-tight ${blurClass}`}>
                            ${item.valueUsd.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Line 2: Units/Price (left) + 24h & Action (right) */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#F7F2E8] font-mono text-xs">
                        <div className="text-[#6E5D4F] text-[11px]">
                          <span className={`font-semibold text-[#1E1315] ${blurClass}`}>{item.unitsLabel}</span>
                          <span className="text-[#99887A] mx-1">·</span>
                          <span>${item.priceUsd.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-[11px] ${
                              item.change24h >= 0 ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {item.change24h >= 0 ? "+" : ""}
                            {item.change24h.toFixed(2)}%
                          </span>

                          {item.actionType === "trade" ? (
                            <Link
                              href={`/terminal?symbol=${encodeURIComponent(item.symbol)}`}
                              className="px-2.5 py-1 rounded-lg border border-[#E5DAC6] hover:border-[#1E1315] bg-[#FAF7F0] hover:bg-white text-[11px] font-semibold text-[#1E1315] transition shadow-2xs"
                            >
                              Trade
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsDepositModalOpen(true)}
                              className="px-2.5 py-1 rounded-lg border border-[#E5DAC6] hover:border-[#1E1315] bg-[#FAF7F0] hover:bg-white text-[11px] font-semibold text-[#1E1315] transition shadow-2xs cursor-pointer"
                            >
                              Deposit
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop View (sm+): Spacious Institutional Multi-Column Layout */}
                    <div className="hidden sm:flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative inline-block shrink-0 w-10 h-10">
                          <AssetLogo symbol={item.symbol} className="w-full h-full" />
                          {item.chain && (
                            <div className="absolute -top-1 -left-1 ring-2 ring-white rounded-full">
                              <ChainLogo chain={item.chain} className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1E1315] font-mono">
                              {item.symbol}
                            </span>
                            <span className="text-[10px] font-mono text-[#7A6A5E] bg-[#FAF3E0] px-1.5 py-0.2 rounded border border-[#E8DCC4]">
                              {item.categoryBadge}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#7A6A5E] truncate mt-0.5">
                            {item.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 font-mono text-xs">
                        <div className="text-right">
                          <div className="text-[10px] text-[#7A6A5E]">Holdings</div>
                          <div className={`font-bold text-[#1E1315] ${blurClass}`}>{item.unitsLabel}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-[#7A6A5E]">Price</div>
                          <div className="font-semibold text-[#1E1315]">${item.priceUsd.toFixed(2)}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-[#7A6A5E]">Total Value</div>
                          <div className={`font-bold text-[#1E1315] ${blurClass}`}>
                            ${item.valueUsd.toFixed(2)}
                          </div>
                        </div>

                        <div className="text-right min-w-[55px]">
                          <div className="text-[10px] text-[#7A6A5E]">24h</div>
                          <div
                            className={`font-bold ${
                              item.change24h >= 0 ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {item.change24h >= 0 ? "+" : ""}
                            {item.change24h.toFixed(2)}%
                          </div>
                        </div>

                        {item.actionType === "trade" ? (
                          <Link
                            href={`/terminal?symbol=${encodeURIComponent(item.symbol)}`}
                            className="px-3.5 py-1.5 rounded-xl border border-[#E5DAC6] hover:border-[#1E1315] bg-[#FAF7F0] hover:bg-white text-xs font-semibold text-[#1E1315] transition shadow-2xs shrink-0"
                          >
                            Trade
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsDepositModalOpen(true)}
                            className="px-3.5 py-1.5 rounded-xl border border-[#E5DAC6] hover:border-[#1E1315] bg-[#FAF7F0] hover:bg-white text-xs font-semibold text-[#1E1315] transition shadow-2xs shrink-0 cursor-pointer"
                          >
                            Deposit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ACTIVE AGENT RULES
         ========================================================================= */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#7A6A5E] font-mono">
              Automated dip-buying and profit-taking directives
            </span>
            <Link
              href="/terminal"
              className="px-3 py-1.5 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Set New Rule in Terminal</span>
            </Link>
          </div>

          {rules.filter((r) => r.status === "active").length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-[#EBE3D5] text-center space-y-2 shadow-xs">
              <div className="text-xs text-[#7A6A5E]">
                No active automated rules right now.
              </div>
              <div className="text-xs text-[#1E1315] font-semibold">
                Go to the Terminal Copilot to tell the agent to buy dips or harvest profits.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rules
                .filter((r) => r.status === "active")
                .map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-2xl bg-white border border-[#EBE3D5] shadow-xs flex flex-col justify-between gap-3 hover:border-[#D5C7B0] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <AssetLogo symbol={rule.symbol} className="w-9 h-9 rounded-xl" />
                        <div>
                          <div className="font-mono font-bold text-xs text-[#1E1315]">
                            {rule.symbol}
                          </div>
                          <div className="text-[10px] font-mono text-[#6E5D4F]">
                            {rule.type === "buy_dip" ? "Dip-Buying Rule" : "Take-Profit Harvest"}
                          </div>
                        </div>
                      </div>

                      <span className="bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                        Monitoring Live
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] font-mono text-xs text-[#1E1315]">
                      {rule.condition}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[11px] font-mono text-[#7A6A5E] ${blurClass}`}>
                        Allocation: ${rule.amountUsd.toFixed(2)} USDC
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancelRule(rule.id)}
                        className="text-xs text-rose-700 hover:text-rose-900 font-semibold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancel Rule</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: PAYLINKS
         ========================================================================= */}
      {activeTab === "paylinks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#7A6A5E] font-mono">
              Omnichain PayLinks (38+ Blockchains Supported)
            </span>
            <Link
              href="/chat"
              className="text-xs font-semibold text-[#1E1315] hover:underline inline-flex items-center gap-1"
            >
              <span>Create in Social Pay</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {payLinks.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-[#EBE3D5] text-center space-y-2 shadow-xs">
              <div className="text-xs text-[#7A6A5E]">
                You have not generated any PayLinks yet.
              </div>
              <div className="text-xs text-[#1E1315] font-semibold">
                Ask the Social Copilot: &quot;Invoice @user $50 for work&quot; to generate an instant cross-chain link.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {payLinks.map((pl) => {
                const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${pl.slug}`;
                const isCopied = copiedId === pl.id;
                return (
                  <div
                    key={pl.id}
                    className="p-4 rounded-2xl bg-white border border-[#EBE3D5] shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-[#1E1315]">{pl.title}</div>
                        <div className={`font-mono text-base font-bold text-[#1E1315] ${blurClass}`}>
                          ${pl.amountUsd.toFixed(2)} USD
                        </div>
                        {/* Clean Supported Token Rails with Real Logos */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] font-mono text-[#7A6A5E]">Accepts:</span>
                          <div className="flex items-center -space-x-1">
                            <AssetLogo symbol="USDC" className="w-4 h-4 rounded-full border border-white" />
                            <AssetLogo symbol="SOL" className="w-4 h-4 rounded-full border border-white" />
                            <AssetLogo symbol="ETH" className="w-4 h-4 rounded-full border border-white" />
                            <AssetLogo symbol="NEAR" className="w-4 h-4 rounded-full border border-white" />
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315]">
                        Active
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-[#F2EBDC]">
                      <button
                        type="button"
                        onClick={() => handleCopy(shareUrl, pl.id)}
                        className="flex-1 py-1.5 px-3 rounded-lg border border-[#E5DAC6] bg-[#FAF7F0] hover:bg-white text-[11px] font-semibold text-[#1E1315] transition text-center cursor-pointer"
                      >
                        {isCopied ? "Copied!" : "Copy Link"}
                      </button>
                      <Link
                        href={`/pay/${pl.slug}`}
                        target="_blank"
                        className="py-1.5 px-3 rounded-lg bg-[#1E1315] text-[#FAF7F0] text-[11px] font-semibold transition text-center"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: RECENT TRANSFERS & TIPS (Dedicated Filterable View)
         ========================================================================= */}
      {activeTab === "transfers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#7A6A5E] font-mono">
              Recent Social Transfers &amp; Tips
            </span>

            {/* Inflow / Outflow filter pills */}
            <div className="flex items-center gap-1 bg-[#EFE8D8] p-0.5 rounded-lg border border-[#E5DAC6]">
              {(["all", "inflow", "outflow"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActivityFilter(filter)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition ${
                    activityFilter === filter
                      ? "bg-[#1E1315] text-[#FAF7F0]"
                      : "text-[#6B5A4E] hover:text-[#1E1315]"
                  }`}
                >
                  {filter === "all" ? "All" : filter === "inflow" ? "Received" : "Sent"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#EBE3D5] overflow-hidden shadow-xs">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7A6A5E]">
                No transactions recorded yet in this category.
              </div>
            ) : (
              <div>
                <div className="divide-y divide-[#F2EBDC]">
                  {paginatedTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-[#FAF7F0]/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            tx.isInflow ? "bg-emerald-50 text-emerald-800" : "bg-[#FAF3E0] text-[#1E1315]"
                          }`}
                        >
                          {tx.isInflow ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-xs text-[#1E1315] truncate">
                            {tx.title}
                          </div>
                          <div className="text-[10px] text-[#7A6A5E] font-mono truncate">
                            {tx.timestamp} • {tx.counterparty}
                          </div>
                          {tx.txHash && tx.txHash !== "confirmed" && tx.txHash !== "completed" && (
                            <a
                              href={
                                tx.asset === "NEAR"
                                  ? `https://testnet.nearblocks.io/txns/${tx.txHash}`
                                  : `https://sepolia.basescan.org/tx/${tx.txHash}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-mono text-[#6E5D4F] hover:text-[#1E1315] underline mt-0.5"
                            >
                              <span>Explorer</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        <div
                          className={`font-bold text-xs ${
                            tx.isInflow ? "text-emerald-700" : "text-[#1E1315]"
                          } ${blurClass}`}
                        >
                          {tx.isInflow ? "+" : "-"}${tx.amountUsd.toFixed(2)} USD
                        </div>
                        <div className="text-[10px] text-[#7A6A5E]">
                          {tx.status === "escrow_pending" && tx.isInflow ? (
                            <button
                              type="button"
                              onClick={() => handleClaimInflowTip(tx)}
                              disabled={claimingTxId === tx.id}
                              className="text-xs font-bold text-emerald-800 underline"
                            >
                              {claimingTxId === tx.id ? "Claiming..." : "Claim Tip"}
                            </button>
                          ) : (
                            tx.statusLabel || "Completed"
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t border-[#F2EBDC] text-xs">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-lg border border-[#EBE3D5] text-[#1E1315] hover:bg-[#FAF7F0] disabled:opacity-40 transition cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-[#6E5D4F]">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-lg border border-[#EBE3D5] text-[#1E1315] hover:bg-[#FAF7F0] disabled:opacity-40 transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => {
          setIsDepositModalOpen(false);
          refreshAccountData();
        }}
      />
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => {
          setIsWithdrawModalOpen(false);
          refreshAccountData();
        }}
      />
      <WalletSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          refreshAccountData();
        }}
      />
      <StockCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        existingPositions={positions}
        onAddStock={handleAddStock}
      />

      {/* Styled Alert Modal replacing native window.alert */}
      <ConfirmModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        description={alertModal.description}
        variant={alertModal.variant}
        isAlert={true}
        confirmText="Understood"
      />
    </div>
  );
}
