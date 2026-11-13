"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  TrendingUp,
  Zap,
  ShieldCheck,
  Search,
  Sliders,
  DollarSign,
  Layers,
  Lock,
  PieChart,
  CheckCircle2,
  Sparkles,
  Info,
  RefreshCw,
} from "lucide-react";
import { CURATED_STOCK_CATALOG, fetchLiveStockAssets, StockAsset } from "@/lib/ondo-stocks";
import { useAuth } from "@/context/AuthContext";

interface StockOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export function StockOnboardingModal({ isOpen, onClose, onCompleted }: StockOnboardingModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMode, setSelectedMode] = useState<"stocks" | "social" | "both">("stocks");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(["NVDAon", "TSLAon", "SPYon", "NEAR"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "tech" | "etf" | "crypto" | "commodities">("all");
  const [liveAssets, setLiveAssets] = useState<StockAsset[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Strategy & Risk Parameters
  const [strategyMode, setStrategyMode] = useState<"dca" | "smart">("dca");
  const [maxSingleAssetPercent, setMaxSingleAssetPercent] = useState(25);
  const [minCashReservePercent, setMinCashReservePercent] = useState(20);
  const [stopLossPercent, setStopLossPercent] = useState(5);
  const [takeProfitPercent, setTakeProfitPercent] = useState(10);

  // Fetch live asset quotes upon open & modal lifecycle
  useEffect(() => {
    if (isOpen) {
      fetchLiveStockAssets()
        .then((assets) => setLiveAssets(assets))
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Virtual Seed Capital
  const totalCapitalUsd = 1000.0;
  const cashReserveUsd = useMemo(() => {
    return Number(((totalCapitalUsd * minCashReservePercent) / 100).toFixed(2));
  }, [totalCapitalUsd, minCashReservePercent]);

  const deployableCapitalUsd = useMemo(() => {
    return Number((totalCapitalUsd - cashReserveUsd).toFixed(2));
  }, [totalCapitalUsd, cashReserveUsd]);

  const perAssetCapitalUsd = useMemo(() => {
    if (selectedSymbols.length === 0) return 0;
    return Number((deployableCapitalUsd / selectedSymbols.length).toFixed(2));
  }, [deployableCapitalUsd, selectedSymbols.length]);

  if (!isOpen) return null;

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? (prev.length > 1 ? prev.filter((s) => s !== sym) : prev) : [...prev, sym]
    );
  };

  const handleSelectPreset = (preset: "tech" | "crypto" | "balanced") => {
    if (preset === "tech") {
      setSelectedSymbols(["NVDAon", "TSLAon", "AAPLon", "MSFTon"]);
    } else if (preset === "crypto") {
      setSelectedSymbols(["NEAR", "BTC", "ETH", "SOL"]);
    } else {
      setSelectedSymbols(["NVDAon", "TSLAon", "SPYon", "NEAR"]);
    }
  };

  const filteredAssets = liveAssets.filter((a) => {
    const matchesCategory = selectedCategory === "all" || a.category === selectedCategory;
    const matchesSearch =
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const handle = user?.xHandle || "trader";

      // Clean/new accounts initialize strictly with 0 shares ($0.00 US Equities balance)
      const payload = {
        handle,
        cashUsd: 0.0,
        watchlist: selectedSymbols,
        positions: [], // Strictly 0 shares / 0 positions - Zero phantom holdings
        riskPolicy: {
          maxSingleAssetPercent,
          minCashReservePercent,
          stopLossPercent,
          takeProfitPercent,
          strategyMode,
          isAutonomousEnabled: true,
        },
      };

      await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      localStorage.setItem("veilx_onboarded", "true");
      localStorage.setItem("veilx_portfolio_setup", JSON.stringify(payload));
      try {
        localStorage.removeItem("veilx_phantom_holdings");
      } catch {}

      onClose();
      if (onCompleted) onCompleted();

      if (selectedMode === "social") {
        router.push("/chat");
      } else {
        router.push("/terminal");
      }
    } catch (err) {
      console.error("Failed to save portfolio setup:", err);
      onClose();
      router.push("/terminal");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#140C0E]/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-[#FFFDF9] border border-[#EBE3D5] rounded-[2.25rem] shadow-[0_24px_64px_rgba(30,19,21,0.2)] overflow-hidden flex flex-col lg:flex-row my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            LEFT INTELLIGENCE PANEL: Real-time Live Blueprint & Architecture Specs
           ========================================================================= */}
        <div className="lg:w-[38%] bg-[#FAF6EE] border-b lg:border-b-0 lg:border-r border-[#EBE3D5] p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            {/* Brand Anchor & Stepper Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-[#EBE3D5] shadow-xs shrink-0">
                  <Image
                    src="/veil.png"
                    alt="Veil Logo"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-serif text-sm font-bold text-[#1E1315] leading-none">
                    Veil
                  </div>
                  <div className="text-[10px] text-[#7A6A5E] font-mono mt-0.5">
                    Portfolio Configuration
                  </div>
                </div>
              </div>
              <span className="bg-[#EAF6EE] text-[#1D5E34] border border-[#CBE5D3] px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase">
                Step {step} of 3
              </span>
            </div>

            {/* Stepper Tabs */}
            <div className="space-y-2 pt-1">
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  step === 1
                    ? "bg-white border-[#1E1315] shadow-xs text-[#1E1315]"
                    : step > 1
                    ? "bg-white/60 border-emerald-300 text-emerald-900"
                    : "bg-transparent border-transparent text-[#8C7A6B]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                      step === 1
                        ? "bg-[#1E1315] text-white"
                        : step > 1
                        ? "bg-emerald-600 text-white"
                        : "bg-[#EBE2D0] text-[#7A6A5E]"
                    }`}
                  >
                    {step > 1 ? "✓" : "1"}
                  </span>
                  <span className="text-xs font-bold font-sans">
                    Architecture &amp; Mode
                  </span>
                </div>
                <div className="text-[11px] text-[#7A6A5E] pl-7 pt-0.5">
                  {selectedMode === "stocks"
                    ? "Autonomous Stock & Crypto Engine"
                    : selectedMode === "social"
                    ? "Social Payments & PayLinks"
                    : "Dual-Engine Unified Platform"}
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border transition-all ${
                  step === 2
                    ? "bg-white border-[#1E1315] shadow-xs text-[#1E1315]"
                    : step > 2
                    ? "bg-white/60 border-emerald-300 text-emerald-900"
                    : "bg-transparent border-transparent text-[#8C7A6B]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                      step === 2
                        ? "bg-[#1E1315] text-white"
                        : step > 2
                        ? "bg-emerald-600 text-white"
                        : "bg-[#EBE2D0] text-[#7A6A5E]"
                    }`}
                  >
                    {step > 2 ? "✓" : "2"}
                  </span>
                  <span className="text-xs font-bold font-sans">
                    Permitted Asset Watchlist
                  </span>
                </div>
                <div className="text-[11px] text-[#7A6A5E] pl-7 pt-0.5">
                  {selectedSymbols.length} assets chosen ({selectedSymbols.join(", ")})
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border transition-all ${
                  step === 3
                    ? "bg-white border-[#1E1315] shadow-xs text-[#1E1315]"
                    : "bg-transparent border-transparent text-[#8C7A6B]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                      step === 3
                        ? "bg-[#1E1315] text-white"
                        : "bg-[#EBE2D0] text-[#7A6A5E]"
                    }`}
                  >
                    3
                  </span>
                  <span className="text-xs font-bold font-sans">
                    Risk Rules &amp; Guardrails
                  </span>
                </div>
                <div className="text-[11px] text-[#7A6A5E] pl-7 pt-0.5">
                  {strategyMode === "dca" ? "Pure DCA + Rebalancing" : "Smart Confluence (RSI-14)"}
                </div>
              </div>
            </div>

            {/* LIVE PORTFOLIO BLUEPRINT CARD */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#EBE3D5] shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#7A6A5E] block">
                    TARGET ALLOCATION BLUEPRINT
                  </span>
                  <span className="text-[10px] text-emerald-800 font-mono">
                    Initial Balance: $0.00 (0 shares)
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-[#1E1315]">
                  ${totalCapitalUsd.toFixed(2)} Target
                </span>
              </div>

              {/* Stacked Allocation Bar */}
              <div className="w-full h-3 rounded-full bg-[#EBE2D0] overflow-hidden flex shadow-inner">
                {/* Cash Reserve segment */}
                <div
                  style={{ width: `${minCashReservePercent}%` }}
                  className="h-full bg-blue-600 transition-all duration-300"
                  title={`USDC Reserve: ${minCashReservePercent}% ($${cashReserveUsd})`}
                />
                {/* Active stock allocation segments */}
                {selectedSymbols.map((sym, idx) => {
                  const colors = ["bg-emerald-600", "bg-amber-600", "bg-purple-600", "bg-rose-600", "bg-indigo-600", "bg-teal-600"];
                  const color = colors[idx % colors.length];
                  const segWidth = (100 - minCashReservePercent) / selectedSymbols.length;
                  return (
                    <div
                      key={sym}
                      style={{ width: `${segWidth}%` }}
                      className={`h-full ${color} border-l border-white/20 transition-all duration-300`}
                      title={`${sym}: ${segWidth.toFixed(1)}% ($${perAssetCapitalUsd})`}
                    />
                  );
                })}
              </div>

              {/* Numerical Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#F2EBDC]">
                <div>
                  <div className="text-[10px] text-[#8C7A6B] uppercase font-mono">
                    USDC Cash Floor
                  </div>
                  <div className="font-mono font-bold text-[#1E1315]">
                    ${cashReserveUsd.toFixed(2)}{" "}
                    <span className="text-[10px] text-blue-700 font-normal">
                      ({minCashReservePercent}%)
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[#8C7A6B] uppercase font-mono">
                    Active Capital
                  </div>
                  <div className="font-mono font-bold text-[#1E1315]">
                    ${deployableCapitalUsd.toFixed(2)}{" "}
                    <span className="text-[10px] text-emerald-700 font-normal">
                      ({selectedSymbols.length} assets)
                    </span>
                  </div>
                </div>
              </div>

              {/* Asset Chips with Per-Asset Capital */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedSymbols.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FAF6EE] text-[#4A3B32] border border-[#E8DEC9] font-bold"
                  >
                    {s} ~${perAssetCapitalUsd}
                  </span>
                ))}
              </div>

              {/* Safety Badges */}
              <div className="pt-2 border-t border-[#F2EBDC] flex items-center justify-between text-[11px] text-[#5A4B40] font-mono">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                  Stop: -{stopLossPercent}%
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  Profit: +{takeProfitPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Footer Security Callout */}
          <div className="pt-6 border-t border-[#EBE3D5] flex items-center gap-2 text-[11px] text-[#7A6A5E]">
            <Lock className="w-3.5 h-3.5 text-[#5A4B40] shrink-0" />
            <span>NEP-366 Session Key delegated. Master keys never leave your custody.</span>
          </div>
        </div>

        {/* =========================================================================
            RIGHT INTERACTIVE WORKSPACE: Spacious, Bespoke Senior-Level Panes
           ========================================================================= */}
        <div className="lg:w-[62%] p-6 sm:p-8 md:p-10 flex flex-col justify-between overflow-y-auto bg-[#FFFDF9]">
          <div>
            {/* Top Close Icon */}
            <div className="flex items-center justify-between pb-4 mb-2">
              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1E1315] tracking-tight">
                  {step === 1 && "Choose Your Experience Mode"}
                  {step === 2 && "Configure Permitted Equities"}
                  {step === 3 && "Set Institutional Risk Guardrails"}
                </h2>
                <p className="text-xs sm:text-sm text-[#6B5A4E] mt-1 leading-relaxed">
                  {step === 1 && "Select the operational modules you want Veil to initialize on your behalf."}
                  {step === 2 && "Define the Ondo tokenized stocks and cryptocurrencies your AI agent is authorized to trade."}
                  {step === 3 && "Hard-code inviolable stop-loss limits, cash reserves, and profit locking thresholds."}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-[#EBE2D0] hover:bg-[#FAF6EE] flex items-center justify-center text-[#7A6A5E] hover:text-[#1E1315] transition shrink-0 self-start"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* STEP 1: Experience Architecture Mode */}
            {step === 1 && (
              <div className="space-y-4 pt-3 animate-in fade-in">
                {/* Option 1: Autonomous Stock Engine */}
                <div
                  onClick={() => setSelectedMode("stocks")}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    selectedMode === "stocks"
                      ? "bg-[#FAF7F0] border-[#1E1315] shadow-xs ring-1 ring-[#1E1315]"
                      : "bg-white border-[#EBE3D5] hover:border-[#DECFA8] hover:bg-[#FAF7F0]/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#1E1315] text-[#FAF7F0] flex items-center justify-center shrink-0 mt-0.5">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-base font-bold text-[#1E1315]">
                            Autonomous Stock &amp; Crypto Agent
                          </span>
                          <span className="bg-[#EAF6EE] text-[#1D5E34] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-[#CBE5D3]">
                            Recommended
                          </span>
                        </div>
                        <p className="text-xs text-[#6B5A4E] mt-1 leading-relaxed">
                          AI agent systematically allocates across 28+ Ondo tokenized equities (Nvidia, Tesla, S&amp;P 500) and major crypto using RSI-14 momentum and strict mathematical risk rules.
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-[#7A6A5E] font-mono">
                          <span>• 24/7 Defuse Swaps</span>
                          <span>• -5% Stop-Loss</span>
                          <span>• 20% Cash Floor</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition ${
                        selectedMode === "stocks"
                          ? "bg-[#1E1315] border-[#1E1315] text-white"
                          : "border-[#C8BEAB]"
                      }`}
                    >
                      {selectedMode === "stocks" && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                </div>

                {/* Option 2: Social Payments & PayLinks */}
                <div
                  onClick={() => setSelectedMode("social")}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    selectedMode === "social"
                      ? "bg-[#FAF7F0] border-[#1E1315] shadow-xs ring-1 ring-[#1E1315]"
                      : "bg-white border-[#EBE3D5] hover:border-[#DECFA8] hover:bg-[#FAF7F0]/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#FAF3E0] text-[#1E1315] border border-[#E8DCC4] flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <div className="font-serif text-base font-bold text-[#1E1315]">
                          Social Payments &amp; Omnichain PayLinks
                        </div>
                        <p className="text-xs text-[#6B5A4E] mt-1 leading-relaxed">
                          Send shielded tips directly to any Twitter/X handle, generate one-time invoices payable from 38+ blockchains, and claim gasless escrow payouts.
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-[#7A6A5E] font-mono">
                          <span>• Gasless Escrow</span>
                          <span>• Solana &amp; EVM Routing</span>
                          <span>• X OAuth 2.0</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition ${
                        selectedMode === "social"
                          ? "bg-[#1E1315] border-[#1E1315] text-white"
                          : "border-[#C8BEAB]"
                      }`}
                    >
                      {selectedMode === "social" && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                </div>

                {/* Option 3: Dual-Engine Suite */}
                <div
                  onClick={() => setSelectedMode("both")}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    selectedMode === "both"
                      ? "bg-[#FAF7F0] border-[#1E1315] shadow-xs ring-1 ring-[#1E1315]"
                      : "bg-white border-[#EBE3D5] hover:border-[#DECFA8] hover:bg-[#FAF7F0]/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#1E1315] text-[#FAF7F0] flex items-center justify-center shrink-0 mt-0.5">
                        <Layers className="w-5 h-5 text-butter-300" />
                      </div>
                      <div>
                        <div className="font-serif text-base font-bold text-[#1E1315]">
                          Full Dual-Engine Platform (Both)
                        </div>
                        <p className="text-xs text-[#6B5A4E] mt-1 leading-relaxed">
                          Complete integration enabling autonomous AI trading alongside conversational tipping and cross-chain merchant payment links.
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition ${
                        selectedMode === "both"
                          ? "bg-[#1E1315] border-[#1E1315] text-white"
                          : "border-[#C8BEAB]"
                      }`}
                    >
                      {selectedMode === "both" && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Permitted Asset Watchlist */}
            {step === 2 && (
              <div className="space-y-4 pt-2 animate-in fade-in">
                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[#7A6A5E] uppercase font-mono">
                    Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("balanced")}
                    className="text-xs px-3 py-1 rounded-full bg-[#FAF7F0] border border-[#E8DEC9] text-[#1E1315] hover:bg-[#EFE8D8] font-semibold transition"
                  >
                    Tech &amp; Crypto Core
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("tech")}
                    className="text-xs px-3 py-1 rounded-full bg-[#FAF7F0] border border-[#E8DEC9] text-[#1E1315] hover:bg-[#EFE8D8] font-semibold transition"
                  >
                    Mega-Cap Tech Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("crypto")}
                    className="text-xs px-3 py-1 rounded-full bg-[#FAF7F0] border border-[#E8DEC9] text-[#1E1315] hover:bg-[#EFE8D8] font-semibold transition"
                  >
                    Major Crypto Only
                  </button>
                </div>

                {/* Category Filters & Search Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <div className="flex items-center gap-1 p-1 bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl text-xs overflow-x-auto">
                    {[
                      { id: "all", label: "All Assets" },
                      { id: "tech", label: "Tech Equities" },
                      { id: "etf", label: "Index ETFs" },
                      { id: "crypto", label: "Crypto" },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCategory(c.id as any)}
                        className={`px-3 py-1 rounded-lg font-semibold text-xs transition whitespace-nowrap ${
                          selectedCategory === c.id
                            ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                            : "text-[#6B5A4E] hover:text-[#1E1315]"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#967E85]" />
                    <input
                      type="text"
                      placeholder="Search symbol or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 bg-white border border-[#EBE3D5] rounded-xl text-xs text-[#1E1315] placeholder:text-[#967E85] focus:outline-none focus:border-[#1E1315] font-mono"
                    />
                  </div>
                </div>

                {/* 2-Column Responsive Asset Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {filteredAssets.length > 0 ? (
                    filteredAssets.map((asset) => {
                      const isChecked = selectedSymbols.includes(asset.symbol);
                      return (
                        <div
                          key={asset.assetId}
                          onClick={() => toggleSymbol(asset.symbol)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                            isChecked
                              ? "bg-[#FAF7F0] border-[#1E1315] shadow-xs ring-1 ring-[#1E1315]"
                              : "bg-white border-[#EBE3D5] hover:border-[#DECFA8] hover:bg-[#FAF7F0]/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                isChecked
                                  ? "bg-[#1E1315] border-[#1E1315] text-white"
                                  : "border-[#C8BEAB] bg-white"
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>

                            <div className="truncate">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-[#1E1315] font-mono">
                                  {asset.symbol}
                                </span>
                                <span className="text-[10px] text-[#7A6A5E] truncate">
                                  {asset.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#967E85] font-mono">
                                RSI-14: {asset.rsi14}{" "}
                                {asset.rsi14 < 48 ? (
                                  <span className="text-emerald-700 font-bold">• Dips</span>
                                ) : (
                                  <span className="text-[#8C7A6B]">• Neutral</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 font-mono">
                            <div className="font-bold text-xs text-[#1E1315]">
                              ${asset.price.toFixed(2)}
                            </div>
                            <div
                              className={`text-[9px] font-bold ${
                                asset.change24h >= 0 ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              {asset.change24h >= 0 ? "+" : ""}
                              {asset.change24h}%
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 py-8 text-center text-xs text-[#7A6A5E] font-mono">
                      No assets matching search criteria.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: Risk Policy & Execution Rules */}
            {step === 3 && (
              <div className="space-y-5 pt-2 animate-in fade-in">
                {/* Strategy Mode Toggle */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#7A6A5E] block font-mono">
                    Execution Intelligence Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStrategyMode("dca")}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        strategyMode === "dca"
                          ? "bg-[#FAF7F0] border-[#1E1315] shadow-xs ring-1 ring-[#1E1315]"
                          : "bg-white border-[#EBE3D5] hover:bg-[#FAF7F0]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-sm text-[#1E1315]">
                          Pure DCA &amp; Rebalancing
                        </span>
                        <span className="bg-[#EAF6EE] text-[#1D5E34] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border border-[#CBE5D3]">
                          Conservative
                        </span>
                      </div>
                      <p className="text-xs text-[#6B5A4E] mt-1.5 leading-relaxed">
                        Disciplined periodic dollar-cost averaging. Extremely hard to lose principal; maintains strict allocation quotas.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStrategyMode("smart")}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        strategyMode === "smart"
                          ? "bg-[#FAF7F0] border-[#1E1315] shadow-xs ring-1 ring-[#1E1315]"
                          : "bg-white border-[#EBE3D5] hover:bg-[#FAF7F0]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-sm text-[#1E1315]">
                          Smart Confluence Mode
                        </span>
                        <span className="bg-[#FFF4E5] text-[#9A5B00] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border border-[#FFE0B2]">
                          Active Alpha
                        </span>
                      </div>
                      <p className="text-xs text-[#6B5A4E] mt-1.5 leading-relaxed">
                        Evaluates RSI-14 oversold dips (&lt; 48) combined with positive news headline sentiment before executing buys.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Risk Parameter Sliders Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Slider 1: Cash Reserve */}
                  <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-serif font-bold text-[#1E1315]">
                        Untouchable Cash Floor
                      </span>
                      <span className="font-mono font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                        {minCashReservePercent}% USDC
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={5}
                      value={minCashReservePercent}
                      onChange={(e) => setMinCashReservePercent(Number(e.target.value))}
                      className="w-full accent-[#1E1315] cursor-pointer"
                    />
                    <div className="text-[10px] text-[#7A6A5E] flex justify-between font-mono">
                      <span>10% ($100)</span>
                      <span>50% ($500)</span>
                    </div>
                  </div>

                  {/* Slider 2: Stop Loss */}
                  <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-serif font-bold text-[#1E1315]">
                        Hard Stop-Loss Limit
                      </span>
                      <span className="font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                        -{stopLossPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={15}
                      step={1}
                      value={stopLossPercent}
                      onChange={(e) => setStopLossPercent(Number(e.target.value))}
                      className="w-full accent-[#1E1315] cursor-pointer"
                    />
                    <div className="text-[10px] text-[#7A6A5E] flex justify-between font-mono">
                      <span>-3% (Tighter)</span>
                      <span>-15% (Looser)</span>
                    </div>
                  </div>

                  {/* Slider 3: Take Profit */}
                  <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-serif font-bold text-[#1E1315]">
                        Take-Profit Locking
                      </span>
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        +{takeProfitPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      step={1}
                      value={takeProfitPercent}
                      onChange={(e) => setTakeProfitPercent(Number(e.target.value))}
                      className="w-full accent-[#1E1315] cursor-pointer"
                    />
                    <div className="text-[10px] text-[#7A6A5E] flex justify-between font-mono">
                      <span>+5%</span>
                      <span>+30%</span>
                    </div>
                  </div>

                  {/* Slider 4: Max Single Asset */}
                  <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-serif font-bold text-[#1E1315]">
                        Max Single Asset Cap
                      </span>
                      <span className="font-mono font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md">
                        {maxSingleAssetPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={40}
                      step={5}
                      value={maxSingleAssetPercent}
                      onChange={(e) => setMaxSingleAssetPercent(Number(e.target.value))}
                      className="w-full accent-[#1E1315] cursor-pointer"
                    />
                    <div className="text-[10px] text-[#7A6A5E] flex justify-between font-mono">
                      <span>15% (Diversified)</span>
                      <span>40% (Concentrated)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              BOTTOM STEPPER NAVIGATION BAR: Responsive, Clean, Elevated
             ========================================================================= */}
          <div className="pt-6 mt-6 border-t border-[#EBE3D5] flex items-center justify-between gap-3">
            <div>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2.5 rounded-full border border-[#EBE3D5] bg-white hover:bg-[#FAF7F0] text-[#1E1315] text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <div className="text-[11px] text-[#8C7A6B] font-mono hidden sm:inline">
                  Step 1 of 3: Architecture
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1 && selectedMode === "social") {
                      handleFinish();
                    } else {
                      setStep((prev) => (prev + 1) as any);
                    }
                  }}
                  className="bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] px-6 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 transition shadow-xs"
                >
                  <span>
                    {step === 1
                      ? selectedMode === "social"
                        ? "Complete Setup"
                        : "Next: Choose Assets"
                      : `Next: Configure Risk Rules (${selectedSymbols.length} Assets)`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleFinish}
                  className="bg-[#1E1315] hover:bg-[#2C1D20] disabled:opacity-50 text-[#FAF7F0] px-7 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 transition shadow-xs"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Initializing Vault &amp; Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Initialize Agent &amp; Launch Terminal</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
