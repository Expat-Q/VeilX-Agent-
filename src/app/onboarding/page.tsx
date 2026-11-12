"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  TrendingUp,
  Zap,
  Layers,
  ShieldCheck,
  Search,
  Sliders,
  DollarSign,
  Lock,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchLiveStockAssets, StockAsset } from "@/lib/ondo-stocks";
import { AssetLogo as CommonAssetLogo } from "@/components/common/AssetLogo";

function AssetLogo({ symbol }: { symbol: string }) {
  return <CommonAssetLogo symbol={symbol} className="w-10 h-10" />;
}

function LegacyAssetLogo({ symbol }: { symbol: string }) {
  switch (symbol) {
    case "NVDAon":
      return (
        <div className="w-10 h-10 rounded-xl bg-[#000000] flex items-center justify-center p-2 shrink-0 border border-[#EBE3D5]">
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
            <path
              fill="#76B900"
              d="M3.2 8.5C3.8 6.2 5.5 4.3 7.8 3.5c4.7-1.6 9.8-.4 13.3 3.1 1.2 1.2 2 2.6 2.4 4.1-.3-.6-.7-1.2-1.2-1.7-2.8-2.8-7-3.8-10.8-2.5-3.3 1.1-5.7 3.8-6.3 7.2-.6 3.4.7 6.8 3.3 9 2.6 2.2 6.3 2.8 9.5 1.7.9-.3 1.7-.8 2.4-1.4-.4.8-1 1.5-1.7 2.1-3.6 2.8-8.8 2.7-12.4-.4C3.8 22.4 2.5 17.5 3 12.8c.1-1.5.7-2.9 1.5-4.3z"
            />
          </svg>
        </div>
      );
    case "TSLAon":
      return (
        <div className="w-10 h-10 rounded-xl bg-[#E82127] flex items-center justify-center p-2 shrink-0 shadow-2xs">
          <svg viewBox="0 0 342 342" className="w-full h-full" fill="none">
            <path
              fill="#FFFFFF"
              d="M171 78.4c48 0 88.5 18.5 119.5 46.5l25.8-38.3C278.3 49 227.6 28 171 28S63.7 49 25.7 86.6l25.8 38.3c31-28 71.5-46.5 119.5-46.5zm-8.8 63.8v166.4h17.6V142.2c35.6-3.8 64.6-21.7 78.2-46.7-23.7-11.4-55.7-18.7-95.8-18.7s-72.1 7.3-95.8 18.7c13.6 25 42.6 42.9 78.2 46.7z"
            />
          </svg>
        </div>
      );
    case "AAPLon":
      return (
        <div className="w-10 h-10 rounded-xl bg-[#000000] flex items-center justify-center p-2.5 shrink-0 border border-[#EBE3D5]">
          <svg viewBox="0 0 170 170" className="w-full h-full" fill="none">
            <path
              fill="#FFFFFF"
              d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.68-7.84-11.97-14.39-7.61-11.75-13.3-24.89-17.07-39.42-3.77-14.54-5.66-28.02-5.66-40.45 0-14.79 3.77-27.25 11.31-37.38 7.54-10.13 17.1-15.35 28.69-15.66 4.9.13 10.38 1.41 16.43 3.86 6.06 2.45 10.23 3.73 12.52 3.86 2.07 0 6.38-1.35 12.93-4.04 6.54-2.7 12.37-3.95 17.48-3.76 13.06.66 23.37 5.37 30.93 14.15-11.43 6.96-17.02 16.48-16.76 28.56.26 10.13 4.13 18.57 11.61 25.32 7.48 6.75 16.32 10.42 26.52 11.01-2.45 7.61-5.46 15.31-9.03 23.1zM119.22 33.72c0-7.84 2.82-15.22 8.46-22.14 5.64-6.92 12.63-11.16 20.97-12.72.66 1.96 1 3.92 1.03 5.88-.13 7.84-2.95 15.28-8.46 22.32-5.51 7.04-12.54 11.31-21.1 12.82-.4-2.07-.77-4.12-.9-6.16z"
            />
          </svg>
        </div>
      );
    case "SPYon":
      return (
        <div className="w-10 h-10 rounded-xl bg-[#0F2042] flex flex-col items-center justify-center p-1 shrink-0 text-white font-sans border border-[#1a346b]">
          <span className="text-[10px] font-black tracking-tighter leading-none text-[#F4B400]">
            S&amp;P
          </span>
          <span className="text-[9px] font-extrabold tracking-widest leading-none mt-0.5">
            500
          </span>
        </div>
      );
    case "MSFTon":
      return (
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-2.5 shrink-0 border border-[#EBE3D5]">
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#7fba00" d="M13 1h10v10H13z" />
            <path fill="#00a4ef" d="M1 13h10v10H1z" />
            <path fill="#ffb900" d="M13 13h10v10H13z" />
          </svg>
        </div>
      );
    case "AMZNon":
      return (
        <div className="w-10 h-10 rounded-xl bg-[#131921] flex items-center justify-center p-2 shrink-0 border border-[#EBE3D5]">
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path
              fill="#FF9900"
              d="M13.9 16.2c-2.3 1.7-5.7 2.6-8.6 2.6-4.1 0-7.8-1.5-10.6-4-.2-.2-.2-.5 0-.7.3-.2.6-.2.8 0 2.6 2.2 6 3.6 9.8 3.6 2.6 0 5.6-.8 7.8-2.3.4-.3.9.1.8.8zm1.8-1.5c-.3-.4-1.9-.2-2.6-.1-.2 0-.3-.2-.2-.3 1.1-.9 2.9-.6 3.2-.2.3.4-.1 2.2-1.2 3.1-.2.1-.3.1-.4 0-.1-.2.7-1.9 1.2-2.5z"
            />
            <path
              fill="#FFFFFF"
              d="M13.5 12.8c0 1.5-.2 2.6-.8 3.4-.6.8-1.5 1.2-2.6 1.2-1.8 0-2.8-1.3-2.8-3.4 0-2.6 1.5-4 4.1-4h1.4v-.8c0-.7-.2-1.3-.6-1.7-.5-.4-1.2-.6-2.2-.6-.9 0-1.8.2-2.7.6-.3.1-.5 0-.6-.2l-.4-.8c-.1-.2 0-.4.2-.5 1.1-.5 2.3-.8 3.6-.8 1.4 0 2.5.4 3.2 1.1.7.7 1.1 1.8 1.1 3.2v5.5zm-2.1-1.3c-1.4 0-2.1.8-2.1 2.2 0 1.2.5 1.8 1.4 1.8.6 0 1.1-.3 1.4-.7.4-.5.6-1.1.6-1.9v-1.4h-1.3z"
            />
          </svg>
        </div>
      );
    case "NEAR":
      return (
        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center p-2.5 shrink-0 border border-[#EBE3D5]">
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path
              fill="#FFFFFF"
              d="M4.5 4h3.6l7.8 11.2V4H19v16h-3.6L7.6 8.8V20H4.5V4z"
            />
          </svg>
        </div>
      );
    case "BTC":
      return (
        <div className="w-10 h-10 rounded-xl bg-[#F7931A] flex items-center justify-center p-2 shrink-0">
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path
              fill="#FFF"
              d="M16.5 10.3c.3-1.8-.7-2.8-2.3-3.2l.5-1.9-1.2-.3-.5 1.9c-.3-.1-.6-.2-.9-.2l.5-1.9-1.2-.3-.5 1.9c-.3-.1-.5-.1-.8-.2l-1.6-.4-.3 1.3s.9.2.9.2c.5.1.6.4.6.6l-.6 2.5c0 0 .1 0 .2.1-.1 0-.1 0-.2-.1l-.9 3.5c-.1.2-.2.4-.6.3 0 0-.9-.2-.9-.2l-.6 1.4 1.5.4c.3.1.6.1.9.2l-.5 2 1.2.3.5-1.9c.3.1.6.2.9.2l-.5 1.9 1.2.3.5-1.9c2 .4 3.5.2 4.1-1.6.5-1.4 0-2.2-1-2.7.7-.4 1.2-1 1.4-2.1zm-2.5 4.3c-.4 1.5-2.2.7-2.8.5l.5-2c.6.2 2.6.5 2.3 1.5zm.4-4.3c-.3 1.3-1.8.6-2.3.5l.5-1.8c.5.1 2.2.4 1.8 1.3z"
            />
          </svg>
        </div>
      );
    case "ETH":
      return (
        <div className="w-10 h-10 rounded-xl bg-[#627EEA] flex items-center justify-center p-2.5 shrink-0">
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path fill="#FFF" d="M12 0L11.8 0.6V16.4L12 16.6L19.5 12.2L12 0Z" />
            <path fill="#DFE3F7" d="M12 0L4.5 12.2L12 16.6V0Z" />
            <path fill="#FFF" d="M12 18.1L11.9 18.2V23.8L12 24L19.5 13.7L12 18.1Z" />
            <path fill="#DFE3F7" d="M12 24V18.1L4.5 13.7L12 24Z" />
          </svg>
        </div>
      );
    case "SOL":
      return (
        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center p-2.5 shrink-0 border border-[#EBE3D5]">
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path
              fill="#14F195"
              d="M4 18.5l2.4-2.4c.4-.4.9-.6 1.5-.6h12.3c.7 0 1.1.8.7 1.3l-2.4 2.4c-.4.4-.9.6-1.5.6H4.7c-.7 0-1.1-.7-.7-1.3z"
            />
            <path
              fill="#9945FF"
              d="M4 5.5l2.4-2.4c.4-.4.9-.6 1.5-.6h12.3c.7 0 1.1.8.7 1.3L18.5 6.2c-.4.4-.9.6-1.5.6H4.7c-.7 0-1.1-.8-.7-1.3z"
            />
            <path
              fill="#00D2FF"
              d="M20 12l-2.4 2.4c-.4.4-.9.6-1.5.6H3.8c-.7 0-1.1-.8-.7-1.3l2.4-2.4c.4-.4.9-.6 1.5-.6h12.3c.7 0 1.1.7.7 1.3z"
            />
          </svg>
        </div>
      );
    case "GOOGLon":
      return (
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-2.5 shrink-0 border border-[#EBE3D5]">
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.78-2.1-6.73-4.94H1.26v3.13C3.25 21.31 7.34 24 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.61H1.26C.46 8.21 0 10.04 0 12s.46 3.79 1.26 5.39l4.01-3.13z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.69 1.26 6.61l4.01 3.13c.95-2.84 3.61-4.99 6.73-4.99z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-10 h-10 rounded-xl bg-[#FAF3E0] border border-[#E8DCC4] flex items-center justify-center font-bold text-xs text-[#1E1315] font-mono shrink-0">
          {symbol.slice(0, 3)}
        </div>
      );
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();

  // Stepper state: 1 -> 2 -> 3 (Clean 3-step workflow)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Auto-skip onboarding if user already has an existing portfolio / account
  useEffect(() => {
    if (!isLoggedIn || !user?.xHandle) return;
    const hasOnboarded = typeof window !== "undefined" && (localStorage.getItem("veil_onboarded") || localStorage.getItem("veilx_onboarded"));
    if (hasOnboarded) {
      router.replace("/terminal");
      return;
    }

    fetch(`/api/portfolio?handle=${encodeURIComponent(user.xHandle)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.portfolio && (data.portfolio.positions?.length > 0 || data.portfolio.rules?.length > 0 || data.portfolio.paperCashUsd !== 10000 || (data.portfolio.cashUsd ?? 0) > 0)) {
          localStorage.setItem("veil_onboarded", "true");
          localStorage.setItem("veilx_onboarded", "true");
          router.replace("/terminal");
        }
      })
      .catch(() => {});
  }, [isLoggedIn, user?.xHandle, router]);

  // Role: "trader" (routes to asset watchlist) | "freelancer" (jumps straight to step 3)
  const [userRole, setUserRole] = useState<"trader" | "freelancer">("trader");

  // Configuration Choices
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([
    "NVDAon",
    "TSLAon",
    "SPYon",
    "NEAR",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveAssets, setLiveAssets] = useState<StockAsset[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-load curated live assets
  useEffect(() => {
    fetchLiveStockAssets()
      .then((assets) => setLiveAssets(assets))
      .catch(() => {});
  }, []);

  // Filtered Assets for Step 2
  const catalogAssets = useMemo(() => {
    if (liveAssets.length > 0) return liveAssets;
    // Fallback static quotes
    return [
      { assetId: "1", symbol: "NVDAon", name: "Nvidia Corp (Ondo)", price: 187.19, change24h: 2.4 },
      { assetId: "2", symbol: "TSLAon", name: "Tesla Inc (Ondo)", price: 348.63, change24h: 1.8 },
      { assetId: "3", symbol: "SPYon", name: "S&P 500 ETF (Ondo)", price: 594.34, change24h: 0.6 },
      { assetId: "4", symbol: "AAPLon", name: "Apple Inc (Ondo)", price: 242.79, change24h: 0.8 },
      { assetId: "5", symbol: "MSFTon", name: "Microsoft Corp (Ondo)", price: 422.5, change24h: 1.1 },
      { assetId: "6", symbol: "AMZNon", name: "Amazon.com Inc (Ondo)", price: 198.4, change24h: 1.5 },
      { assetId: "7", symbol: "GOOGLon", name: "Alphabet Inc (Ondo)", price: 176.8, change24h: 0.9 },
      { assetId: "8", symbol: "NEAR", name: "NEAR Protocol", price: 3.52, change24h: 3.9 },
      { assetId: "9", symbol: "BTC", name: "Bitcoin", price: 68450.0, change24h: 1.2 },
      { assetId: "10", symbol: "ETH", name: "Ethereum", price: 2540.0, change24h: 1.6 },
      { assetId: "11", symbol: "SOL", name: "Solana", price: 174.2, change24h: 2.1 },
    ] as StockAsset[];
  }, [liveAssets]);

  const filteredAssets = catalogAssets.filter(
    (a) =>
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? (prev.length > 1 ? prev.filter((s) => s !== sym) : prev) : [...prev, sym]
    );
  };

  // Freelancer Fast-Track Finish: skips stocks selection and guardrails
  const handleFreelancerFinish = async () => {
    setIsSaving(true);
    try {
      const handle = user?.xHandle || "creator";
      const payload = {
        handle,
        role: "freelancer",
        isAutonomousEnabled: false,
      };

      localStorage.setItem("veilx_onboarded", "true");
      localStorage.setItem("veilx_user_role", "freelancer");
      localStorage.setItem("veilx_portfolio_setup", JSON.stringify(payload));

      setStep(3);
    } catch (e) {
      console.error("Freelancer onboarding save error:", e);
      setStep(3);
    } finally {
      setIsSaving(false);
    }
  };

  // Trader Finish: saves stock allocation blueprint with automated DCA defaults (Zero Fake Positions)
  const handleTraderFinish = async () => {
    setIsSaving(true);
    try {
      const handle = user?.xHandle || "trader";

      const payload = {
        handle,
        role: "trader",
        cashUsd: 0.0, // Live cash dynamically calculated from on-chain balances
        watchlist: selectedSymbols,
        positions: [], // Strictly 0 positions until user executes real orders
        riskPolicy: {
          maxSingleAssetPercent: 25,
          minCashReservePercent: 20,
          stopLossPercent: 5,
          takeProfitPercent: 10,
          strategyMode: "dca",
          isAutonomousEnabled: true,
        },
      };

      await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      localStorage.setItem("veilx_onboarded", "true");
      localStorage.setItem("veilx_user_role", "trader");
      localStorage.setItem("veilx_portfolio_setup", JSON.stringify(payload));

      setStep(3);
    } catch (e) {
      console.error("Save portfolio failed:", e);
      setStep(3);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#1E1315] flex flex-col justify-between selection:bg-[#EDE3CC]">
      {/* =========================================================================
          TOP MINIMAL HEADER (Centered Brand Logo)
         ========================================================================= */}
      <header className="w-full max-w-5xl mx-auto px-4 pt-10 pb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 mx-auto group">
          <div className="w-8 h-8 rounded-full bg-[#1E1315] text-[#FAF7F0] flex items-center justify-center font-serif font-bold text-xs shadow-xs">
            VX
          </div>
          <span className="font-serif text-2xl font-bold tracking-tight text-[#1E1315]">
            VeilX
          </span>
        </Link>
      </header>

      {/* =========================================================================
          STEPPER INDICATOR (Eden Multi-Step Connected Horizontal Track - 3 Steps)
         ========================================================================= */}
      <div className="w-full max-w-xs mx-auto px-4 pb-8">
        <div className="flex items-center justify-between relative">
          {/* Background Connecting Line */}
          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-[2px] bg-[#E5DAC6] -z-0" />

          {/* Progress Connecting Line */}
          <div
            className="absolute top-1/2 left-4 -translate-y-1/2 h-[2px] bg-[#1E1315] transition-all duration-300 -z-0"
            style={{
              width:
                step === 1
                  ? "0%"
                  : step === 2
                  ? "50%"
                  : "calc(100% - 2rem)",
            }}
          />

          {/* Stepper Dots: 1, 2, 3 */}
          {[1, 2, 3].map((s) => {
            const isCompleted = step > s || (step === 3 && s === 3);
            const isCurrent = step === s;
            return (
              <div
                key={s}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all relative z-10 ${
                  isCurrent && step !== 3
                    ? "bg-[#1E1315] text-[#FAF7F0] shadow-sm ring-4 ring-[#FAF7F0]"
                    : isCompleted
                    ? "bg-[#1E1315] text-[#FAF7F0]"
                    : "bg-[#FAF7F0] text-[#8C7A6B] border-2 border-[#E5DAC6]"
                }`}
              >
                {step > s || (step === 3 && s <= 3) ? (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  s
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          MAIN CENTERED CONTENT AREA
         ========================================================================= */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-16 flex flex-col justify-center">
        {/* =========================================================================
            STEP 1: ARE YOU A TRADER OR A FREELANCER?
           ========================================================================= */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Heading & Subtitle */}
            <div className="text-center space-y-2">
              <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1E1315] tracking-tight">
                Are you a Trader or a Freelancer?
              </h1>
              <p className="text-sm text-[#6B5A4E]">
                We will streamline your setup experience accordingly.
              </p>
            </div>

            {/* 2 Selectable Clean Cards (Eden style) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Trader */}
              <div
                onClick={() => setUserRole("trader")}
                className={`p-6 rounded-2xl border text-left cursor-pointer transition-all ${
                  userRole === "trader"
                    ? "bg-white border-[#1E1315] shadow-sm ring-1 ring-[#1E1315]"
                    : "bg-white border-[#EBE3D5] hover:border-[#D5C7B0]"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#FAF3E0] border border-[#E8DCC4] flex items-center justify-center text-[#1E1315] mb-4">
                  <TrendingUp className="w-4 h-4 text-[#1E1315]" />
                </div>
                <h3 className="font-serif text-base font-bold text-[#1E1315] mb-1.5">
                  Trader / Investor
                </h3>
                <p className="text-xs text-[#6B5A4E] leading-relaxed">
                  I want an autonomous AI agent to invest across Ondo tokenized stocks (NVDA, TSLA, SPY) and crypto with strict risk rules.
                </p>
              </div>

              {/* Card 2: Freelancer */}
              <div
                onClick={() => setUserRole("freelancer")}
                className={`p-6 rounded-2xl border text-left cursor-pointer transition-all ${
                  userRole === "freelancer"
                    ? "bg-white border-[#1E1315] shadow-sm ring-1 ring-[#1E1315]"
                    : "bg-white border-[#EBE3D5] hover:border-[#D5C7B0]"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#FAF3E0] border border-[#E8DCC4] flex items-center justify-center text-[#1E1315] mb-4">
                  <Zap className="w-4 h-4 text-[#1E1315]" />
                </div>
                <h3 className="font-serif text-base font-bold text-[#1E1315] mb-1.5">
                  Freelancer / Creator
                </h3>
                <p className="text-xs text-[#6B5A4E] leading-relaxed">
                  I want to receive tips on X directly, generate cross-chain PayLinks across 38+ blockchains, and get paid.
                </p>
              </div>
            </div>

            {/* Bottom Full-width CTA */}
            <div>
              <button
                type="button"
                onClick={() => {
                  if (userRole === "freelancer") {
                    handleFreelancerFinish();
                  } else {
                    setStep(2);
                  }
                }}
                className="w-full bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] h-12 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 2: WHICH ASSETS SHOULD YOUR AGENT TRADE?
           ========================================================================= */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Heading & Subtitle */}
            <div className="text-center space-y-2">
              <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1E1315] tracking-tight">
                Which assets should your agent trade?
              </h1>
              <p className="text-sm text-[#6B5A4E]">
                Select the tokenized equities and crypto allowed in your portfolio.
              </p>
            </div>

            {/* Quick Actions & Search */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  setSelectedSymbols(["NVDAon", "TSLAon", "SPYon", "NEAR"])
                }
                className="text-xs text-[#1E1315] hover:underline font-semibold"
              >
                Select Recommended (NVDA, TSLA, SPY, NEAR)
              </button>
              <span className="text-xs font-mono text-[#7A6A5E]">
                {selectedSymbols.length} selected
              </span>
            </div>

            {/* Asset Cards Grid (With Real SVGs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {filteredAssets.map((asset) => {
                const isSelected = selectedSymbols.includes(asset.symbol);
                return (
                  <div
                    key={asset.symbol}
                    onClick={() => toggleSymbol(asset.symbol)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-white border-[#1E1315] shadow-xs ring-1 ring-[#1E1315]"
                        : "bg-white border-[#EBE3D5] hover:border-[#D5C7B0]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Real Company Vector Logo */}
                      <AssetLogo symbol={asset.symbol} />

                      <div className="truncate">
                        <div className="font-bold text-xs text-[#1E1315] font-mono">
                          {asset.symbol}
                        </div>
                        <div className="text-[11px] text-[#7A6A5E] truncate">
                          {asset.name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <div className="text-xs font-bold text-[#1E1315]">
                        ${asset.price.toFixed(2)}
                      </div>
                      <div
                        className={`text-[10px] font-semibold ${
                          asset.change24h >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        {asset.change24h >= 0 ? "+" : ""}
                        {asset.change24h}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions: Directly initializes workspace (No guardrail step) */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-12 px-6 rounded-xl border border-[#E5DAC6] bg-white hover:bg-[#FAF7F0] text-[#1E1315] text-xs font-semibold transition"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleTraderFinish}
                className="flex-1 bg-[#1E1315] hover:bg-[#2C1D20] disabled:opacity-50 text-[#FAF7F0] h-12 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Initializing Portfolio...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 3: CONGRATULATIONS / SLEEK PORTFOLIO SUMMARY (Eden Style)
           ========================================================================= */}
        {step === 3 && (
          <div className="text-center space-y-6 animate-in zoom-in-95 duration-200 py-4">
            <div className="w-14 h-14 rounded-full bg-[#1E1315] text-[#FAF7F0] flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div className="space-y-1.5">
              <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1E1315] tracking-tight">
                Congratulations! You&apos;re all set.
              </h1>
              <p className="text-xs sm:text-sm text-[#6B5A4E] max-w-md mx-auto">
                {userRole === "trader"
                  ? "Your trading portfolio is configured and linked directly to your verified on-chain liquid balance."
                  : "Your payment workspace is configured. You can now receive tips on X, send cross-chain payment links, and claim gasless payouts."}
              </p>
            </div>

            {/* Sleek Dynamic Confirmation Card */}
            {userRole === "trader" ? (
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#EBE3D5] text-left max-w-lg mx-auto shadow-xs space-y-4">
                {/* Header Row */}
                <div className="flex items-center justify-between pb-3 border-b border-[#F2EBDC]">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#7A6A5E] font-semibold">
                      Allocated Watchlist
                    </span>
                    <div className="text-xs text-[#1E1315] font-semibold">
                      Targeting Equal DCA Weighting
                    </div>
                  </div>
                  <span className="bg-[#FAF3E0] border border-[#E8DCC4] text-[#1E1315] text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    {selectedSymbols.length} Assets Active
                  </span>
                </div>

                {/* Sleek Selected Tokens Grid (Dynamic, real SVG logos, actual prices & computed weights) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[240px] overflow-y-auto pr-1">
                  {selectedSymbols.map((sym) => {
                    const asset = catalogAssets.find((a) => a.symbol === sym);
                    const sharePercent = (100 / selectedSymbols.length).toFixed(1);
                    const perAssetUsd = (1000 / selectedSymbols.length).toFixed(2);
                    return (
                      <div
                        key={sym}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] hover:border-[#D5C7B0] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="scale-75 origin-left shrink-0">
                            <AssetLogo symbol={sym} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-xs text-[#1E1315] leading-tight truncate">
                              {sym}
                            </div>
                            <div className="text-[10px] text-[#7A6A5E] truncate">
                              ${asset ? asset.price.toFixed(2) : "100.00"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0 pl-2">
                          <div className="text-xs font-bold text-[#1E1315]">
                            {sharePercent}%
                          </div>
                          <div className="text-[10px] text-[#7A6A5E]">
                            Target Weight
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Clean Portfolio Metrics Footer */}
                <div className="pt-3 border-t border-[#F2EBDC] grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2 rounded-lg bg-[#FAF7F0] border border-[#EBE3D5]">
                    <div className="text-[10px] text-[#7A6A5E]">Funding Rails</div>
                    <div className="text-xs font-bold text-[#1E1315] mt-0.5">Live On-Chain</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FAF7F0] border border-[#EBE3D5]">
                    <div className="text-[10px] text-[#7A6A5E]">Strategy Mode</div>
                    <div className="text-xs font-bold text-emerald-800 mt-0.5">Pure DCA</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FAF7F0] border border-[#EBE3D5]">
                    <div className="text-[10px] text-[#7A6A5E]">Execution Rails</div>
                    <div className="text-xs font-bold text-[#1E1315] mt-0.5">NEAR Protocol</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-[#EBE3D5] text-left max-w-lg mx-auto shadow-xs space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#F2EBDC]">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#7A6A5E] font-semibold">
                      Payment Identity
                    </span>
                    <div className="text-xs text-[#1E1315] font-semibold font-sans">
                      Social &amp; Omnichain Rails
                    </div>
                  </div>
                  <span className="bg-[#FAF3E0] border border-[#E8DCC4] text-emerald-800 text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg">
                    Ready
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5]">
                    <span className="text-[#7A6A5E]">Connected Identity</span>
                    <span className="font-bold text-emerald-800">
                      @{user?.xHandle || "creator"} (Verified)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5]">
                    <span className="text-[#7A6A5E]">Cross-Chain Support</span>
                    <span className="font-bold text-[#1E1315]">
                      38+ Blockchains (Solana, Base, NEAR)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5]">
                    <span className="text-[#7A6A5E]">Escrow Settlement</span>
                    <span className="font-bold text-blue-700">
                      Gasless Payouts Enabled
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Final Launch Button: routes to /terminal for traders, /chat?mode=invoice for freelancers */}
            <div className="pt-2 max-w-lg mx-auto">
              <button
                type="button"
                onClick={() =>
                  router.push(userRole === "trader" ? "/terminal" : "/chat?mode=invoice")
                }
                className="w-full bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] h-12 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <span>
                  {userRole === "trader"
                    ? "Launch Trading Terminal"
                    : "Launch Payment Workspace"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 py-6 text-center text-xs text-[#8C7A6B]">
        VeilX Protocol • Autonomous Stock &amp; Social Finance on NEAR
      </footer>
    </div>
  );
}
