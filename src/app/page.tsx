"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Lock,
  QrCode,
  ShieldCheck,
  Plus,
  Minus,
  Check,
  Zap,
  TrendingUp,
  Sliders,
} from "lucide-react";
import { TwitterClaimModal } from "@/components/modals/TwitterClaimModal";
import { AuthModal } from "@/components/modals/AuthModal";
import { useAuth } from "@/context/AuthContext";

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoggedIn, networkMode } = useAuth();
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [justConnectedHandle, setJustConnectedHandle] = useState<string | null>(null);

  // Detect OAuth redirect (/?connected=true&handle=...) or check existing user
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const params = new URLSearchParams(window.location.search);
      const isConnected = params.get("connected") === "true";
      const handleParam = params.get("handle");

      if (isConnected) {
        localStorage.setItem("veil_onboarded", "true");
        localStorage.setItem("veilx_onboarded", "true");
      } else if (isLoggedIn && user?.xHandle) {
        const hasOnboarded = localStorage.getItem("veilx_onboarded");
        if (hasOnboarded) {
          // Stay on landing if requested, or ready to launch
        }
      }
    } catch (e) {
      console.warn("OAuth param error:", e);
    }
  }, [isLoggedIn, user?.xHandle, router]);

  // Hero Card dynamic toggle (NVDAon, TSLAon, SPYon, NEAR)
  const [activeHeroAsset, setActiveHeroAsset] = useState<number>(0);
  const heroAssets = [
    { symbol: "NVDAon", amount: "1.50", usd: "280.78", name: "Nvidia Tokenized Stock" },
    { symbol: "TSLAon", amount: "0.85", usd: "296.34", name: "Tesla Tokenized Stock" },
    { symbol: "SPYon", amount: "0.50", usd: "371.17", name: "S&P 500 ETF Stock" },
    { symbol: "NEAR", amount: "91.68", usd: "322.73", name: "NEAR Protocol Native" },
  ];

  // Auto-cycle hero assets subtly every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHeroAsset((prev) => (prev + 1) % heroAssets.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroAssets.length]);

  // Interactive FAQ State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const faqItemsCol1 = [
    {
      q: "What does Veil do?",
      a: "Veil is an autonomous financial agent on NEAR. It manages capital across tokenized stocks (NVDA, TSLA, SPY) in sandbox simulation with risk guardrails, while also enabling social tips and cross-chain PayLinks on X.",
    },
    {
      q: "How does the autonomous trading agent work?",
      a: "You select your tokenized equities and set your risk bounds. Veil executes disciplined DCA and rebalancing in sandbox mode, evaluating technical indicators and market conditions.",
    },
    {
      q: "How does Veil protect against loss?",
      a: "Veil enforces strict mathematical risk guardrails: hard-coded -5% stop-loss liquidation, +10% take-profit locking, a mandatory 20% USDC cash floor, and a 25% single-asset allocation cap.",
    },
    {
      q: "Does Veil have access to my master private keys?",
      a: "No. Veil uses NEAR NEP-366 Session Delegation. Scoped function-call keys are stored directly in your browser. Your master private key remains completely safe.",
    },
  ];

  const faqItemsCol2 = [
    {
      q: "What are tokenized stocks?",
      a: "Tokenized stocks (NVDAon, TSLAon, SPYon) are representations of major US equities. In Testnet mode, Veil provides a full $10,000 simulation sandbox for risk-free automated strategy testing.",
    },
    {
      q: "Can the agent trade when I am offline?",
      a: "Yes. Because session delegation authorizes the agent's restricted trading key, background evaluation loops execute disciplined orders even while you sleep.",
    },
    {
      q: "How does tipping someone on X work?",
      a: "You tip any X username directly. Veil holds the tip in a decentralized smart contract escrow on NEAR. When the user connects with their X account, funds release directly to their wallet.",
    },
    {
      q: "Which chains can I pay from?",
      a: "Through cross-chain PayLinks, you can create invoices payable from Ethereum, Solana, Base, and NEAR with instant settlement.",
    },
  ];

  // Strictly open the login modal if unauthenticated; do not auto-login
  const handleLaunchFlow = () => {
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
    } else {
      const hasOnboarded = typeof window !== "undefined" && localStorage.getItem("veilx_onboarded");
      if (!hasOnboarded) {
        router.push("/onboarding");
      } else {
        router.push("/terminal");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#1E1315] flex flex-col selection:bg-[#EDE3CC]">
      {/* Connected Success Alert Banner */}
      {justConnectedHandle && (
        <div className="w-full bg-[#EAF6EE] border-b border-[#CBE5D3] py-2.5 px-4 text-center text-xs font-medium text-[#1D5E34] flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
          <span>
            <strong>Connected as @{justConnectedHandle}</strong>. Scoped NEAR session initialized.
          </span>
          <button
            onClick={() => setJustConnectedHandle(null)}
            className="ml-3 text-[#1D5E34] hover:text-[#144224] underline text-[11px] font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: NAVBAR
         ========================================================================= */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-center justify-between">
        {/* Left: Brand Monogram + Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-[#E8DCC4] shadow-2xs group-hover:scale-105 transition-transform">
              <Image
                src="/veil.png"
                alt="Veil Logo"
                width={32}
                height={32}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <span className="font-serif text-xl font-bold tracking-tight text-[#1E1315]">
              Veil
            </span>
          </Link>
        </div>

        {/* Center: Floating Navigation */}
        <nav className="hidden md:flex items-center gap-7 bg-white/80 backdrop-blur-md border border-[#EBE2D0] rounded-full px-7 py-2 shadow-xs text-xs font-medium text-[#4A3B32]">
          <a href="#products" className="hover:text-[#1E1315] transition-colors">
            Capabilities
          </a>
          <a href="#capabilities" className="hover:text-[#1E1315] transition-colors">
            Engine
          </a>
          <a href="#technology" className="hover:text-[#1E1315] transition-colors">
            Architecture
          </a>
          <a href="#faqs" className="hover:text-[#1E1315] transition-colors">
            FAQs
          </a>
        </nav>

        {/* Right: Auth and Launch Controls */}
        <div className="flex items-center gap-2">
          {isLoggedIn && user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="bg-[#FAF3E0] hover:bg-[#F2E7CD] border border-[#E8DCC4] text-[#1E1315] px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                title="Account Settings"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>@{user.xHandle}</span>
              </button>
              <button
                onClick={handleLaunchFlow}
                className="bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <span>Launch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Connect</span>
            </button>
          )}
        </div>
      </header>

      {/* =========================================================================
          SECTION 1 HERO: Main Headline & Floating Card
         ========================================================================= */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Headline and Description */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="text-[11px] tracking-[0.2em] font-bold text-[#6E5D4F] uppercase">
              VEIL • AUTONOMOUS EQUITIES AND SOCIAL PAYMENTS
            </div>

            <h1 className="font-serif text-5xl sm:text-6xl lg:text-[72px] leading-[1.05] text-[#1E1315] font-normal tracking-tight">
              Autonomous trading for tokenized equities.
            </h1>

            <p className="text-[#6E5D4F] text-base sm:text-lg leading-relaxed max-w-xl font-normal">
              Deploy Veil to automate your stock strategies with mathematical stop-loss and DCA rules in sandbox mode, send social tips on X, and accept payments across chains.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleLaunchFlow}
                className="bg-[#1E1315] hover:bg-[#2E1D21] text-[#FAF7F0] px-7 py-3.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <span>{isLoggedIn ? "Open Terminal" : "Get Started"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleLaunchFlow}
                className="bg-white hover:bg-[#F5EFE3] text-[#2C1E19] border border-[#E5DAC6] px-7 py-3.5 rounded-full text-sm font-semibold transition-colors shadow-2xs cursor-pointer"
              >
                Explore Sandbox
              </button>
            </div>
          </div>

          {/* Right Column: High-Fidelity Floating Card */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="bg-white rounded-[2.5rem] p-7 border border-[#EBE3D3] shadow-[0_16px_48px_rgba(30,19,21,0.06)] w-full max-w-md space-y-5">
              {/* Card Header Tag */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-[#2D241E] uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>AUTONOMOUS AGENT ACTIVE</span>
                </div>
                <span className="bg-[#FAF6ED] text-[#6E5D4F] px-3 py-1 rounded-full text-[10px] font-semibold border border-[#E8DEC9]">
                  Institutional Sandbox
                </span>
              </div>

              {/* Profile Box */}
              <div className="bg-[#FAF7F0] border border-[#EFE8DA] rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EAE0CD] text-[#3D2F27] font-bold text-xs flex items-center justify-center font-mono">
                    {user?.xHandle ? user.xHandle.slice(0, 2).toUpperCase() : "V"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-[#1E1315]">
                      <span>{user ? `@${user.xHandle}` : "Autonomous Portfolio"}</span>
                      <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                    </div>
                    <div className="text-[11px] text-[#6E5D4F] font-medium font-mono">
                      {user ? `@${user.xHandle}` : "@veil_agent"}
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-[#E8DFC9] px-3 py-1 rounded-full text-[10px] font-bold text-[#3D2F27] shadow-2xs">
                  {isLoggedIn ? "Active Session" : "Non-Custodial"}
                </div>
              </div>

              {/* Asset Amount Box with interactive mini switcher */}
              <div className="bg-white border border-[#EFE8DA] rounded-2xl p-6 text-center space-y-1.5 shadow-2xs">
                <div className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#6E5D4F]">
                  TOTAL AGENT ALLOCATION
                </div>
                <div className="font-serif text-4xl sm:text-[42px] font-bold text-[#1E1315] tracking-tight">
                  {heroAssets[activeHeroAsset].amount}{" "}
                  <span className="text-2xl sm:text-3xl font-sans font-bold text-[#1E1315]">
                    {heroAssets[activeHeroAsset].symbol}
                  </span>
                </div>
                <div className="text-xs text-[#6E5D4F] font-mono font-medium">
                  ≈ ${heroAssets[activeHeroAsset].usd} USD
                </div>

                {/* Sub-asset pill triggers */}
                <div className="flex items-center justify-center gap-1.5 pt-3">
                  {heroAssets.map((asset, idx) => (
                    <button
                      key={asset.symbol}
                      onClick={() => setActiveHeroAsset(idx)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono transition-colors cursor-pointer ${
                        activeHeroAsset === idx
                          ? "bg-[#1E1315] text-[#FAF7F0] font-bold"
                          : "bg-[#FAF7F0] text-[#6E5D4F] hover:bg-[#EFE8D8]"
                      }`}
                    >
                      {asset.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security Banner */}
              <div className="bg-[#FAF7F0] border border-[#EAE1D0] rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-[11px] text-[#5A4B40]">
                <Lock className="w-3.5 h-3.5 text-[#6E5D4F] shrink-0" />
                <span>
                  Mathematical Guardrails: -5% Stop-loss and 20% Cash Floor.
                </span>
              </div>

              {/* Bottom Card Action */}
              <button
                onClick={handleLaunchFlow}
                className="w-full bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] py-3.5 rounded-full text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span>Launch Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: DUAL CARDS
         ========================================================================= */}
      <section id="capabilities" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Large Dark Espresso Card */}
          <div className="lg:col-span-7 bg-[#1E1315] text-[#FAF7F0] rounded-[2.5rem] p-8 sm:p-12 relative overflow-hidden flex flex-col justify-between min-h-[380px] shadow-sm">
            <div>
              <div className="text-[10px] tracking-[0.25em] font-semibold text-[#D4AF37] uppercase mb-4">
                VEIL • AUTONOMOUS AGENT TERMINAL
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal leading-[1.12] text-[#FFFDF9] mb-5 tracking-tight">
                One social identity.
                <br />
                Tokenized equities.
                <br />
                Zero master key exposure.
              </h2>
              <p className="text-[#C4B7AA] text-sm sm:text-base leading-relaxed max-w-md font-normal mb-8">
                Grant your AI agent a scoped trading session key with strict daily spending limits. The agent monitors price momentum and rebalances automatically in sandbox mode.
              </p>
            </div>

            <div>
              <button
                onClick={handleLaunchFlow}
                className="inline-flex items-center gap-2 bg-white hover:bg-[#FAF7F0] text-[#1E1315] px-6 py-3 rounded-full text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <span>Launch Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: Stacked White Cards */}
          <div className="lg:col-span-5 flex flex-col gap-5 justify-between">
            {/* Card 1 */}
            <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-[#EBE3D3] shadow-xs flex items-start gap-4 flex-1">
              <div className="w-11 h-11 rounded-2xl bg-[#FAF7F0] border border-[#EAE1D0] flex items-center justify-center text-[#1E1315] shrink-0">
                <QrCode className="w-5 h-5 text-[#2C1D20]" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1E1315] mb-1.5">
                  Omnichain PayLinks
                </h3>
                <p className="text-xs text-[#6E5D4F] leading-relaxed">
                  Accept payments from Solana, Ethereum, Base, and NEAR with instant non-custodial settlement.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-[#EBE3D3] shadow-xs flex items-start gap-4 flex-1">
              <div className="w-11 h-11 rounded-2xl bg-[#FAF7F0] border border-[#EAE1D0] flex items-center justify-center text-[#1E1315] shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#2C1D20]" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1E1315] mb-1.5">
                  Deterministic Risk Guardrails
                </h3>
                <p className="text-xs text-[#6E5D4F] leading-relaxed">
                  Mathematical safety enforced on every trade: -5% stop-loss, +10% profit locking, and a 20% untouchable cash floor.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: CAPABILITIES
         ========================================================================= */}
      <section id="products" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Heading */}
          <div className="lg:col-span-4 lg:sticky lg:top-12 space-y-4 text-left">
            <div className="text-[10px] tracking-[0.25em] font-semibold text-[#6E5D4F] uppercase">
              CAPABILITIES
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl lg:text-[54px] font-normal leading-[1.08] text-[#1E1315] tracking-tight">
              Built for autonomous trading and creator payments.
            </h2>
            <p className="text-[#6E5D4F] text-sm leading-relaxed max-w-sm">
              Trade tokenized equities, automate disciplined DCA schedules, tip X creators gaslessly, and accept cross-chain invoices.
            </p>
          </div>

          {/* Right Column: 6 Enumerated Rows */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-9 border border-[#EBE3D3] shadow-xs divide-y divide-[#F2EBDC]">
              {/* Row 01 */}
              <div className="py-5 sm:py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#6E5D4F]">
                      01
                    </span>
                    <span className="font-serif text-lg font-bold text-[#1E1315]">
                      Autonomous Stock Investing
                    </span>
                    <span className="bg-[#FAF5EC] text-[#6E5D4F] px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border border-[#EFE8D8]">
                      SANDBOX SIMULATION
                    </span>
                  </div>
                  <p className="text-xs text-[#6E5D4F] leading-relaxed">
                    Deploy AI capital allocation into NVDAon, TSLAon, and SPYon with real-time momentum tracking.
                  </p>
                </div>
                {/* Action pill */}
                <Link
                  href="/terminal"
                  className="bg-[#FAF5EC] hover:bg-[#FAF0E0] border border-[#EBE3D5] hover:border-[#1E1315] text-[#1E1315] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center transition-all cursor-pointer shadow-2xs group"
                >
                  <span>Launch in Terminal</span>
                  <ArrowRight className="w-3 h-3 text-[#6E5D4F] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Row 02 */}
              <div className="py-5 sm:py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#6E5D4F]">
                      02
                    </span>
                    <span className="font-serif text-lg font-bold text-[#1E1315]">
                      Disciplined DCA and Rebalancing
                    </span>
                    <span className="bg-[#FAF5EC] text-[#6E5D4F] px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border border-[#EFE8D8]">
                      RISK DISCIPLINE
                    </span>
                  </div>
                  <p className="text-xs text-[#6E5D4F] leading-relaxed">
                    Automated dollar-cost averaging and portfolio rebalancing with guaranteed 20% USDC cash protection.
                  </p>
                </div>
                <Link
                  href="/terminal"
                  className="bg-[#FAF5EC] hover:bg-[#FAF0E0] border border-[#EBE3D5] hover:border-[#1E1315] text-[#1E1315] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center transition-all cursor-pointer shadow-2xs group"
                >
                  <span>Launch in Terminal</span>
                  <ArrowRight className="w-3 h-3 text-[#6E5D4F] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Row 03 */}
              <div className="py-5 sm:py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#6E5D4F]">
                      03
                    </span>
                    <span className="font-serif text-lg font-bold text-[#1E1315]">
                      Social Tipping on X
                    </span>
                    <span className="bg-[#FAF5EC] text-[#6E5D4F] px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border border-[#EFE8D8]">
                      SMART ESCROW
                    </span>
                  </div>
                  <p className="text-xs text-[#6E5D4F] leading-relaxed">
                    Tip any X username directly. Funds wait securely in smart contract escrow until claimed with X login.
                  </p>
                </div>
                <Link
                  href="/chat"
                  className="bg-[#FAF5EC] hover:bg-[#FAF0E0] border border-[#EBE3D5] hover:border-[#1E1315] text-[#1E1315] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center transition-all cursor-pointer shadow-2xs group"
                >
                  <span>Launch in Copilot</span>
                  <ArrowRight className="w-3 h-3 text-[#6E5D4F] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Row 04 */}
              <div className="py-5 sm:py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#6E5D4F]">
                      04
                    </span>
                    <span className="font-serif text-lg font-bold text-[#1E1315]">
                      Omnichain PayLinks
                    </span>
                    <span className="bg-[#FAF5EC] text-[#6E5D4F] px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border border-[#EFE8D8]">
                      CROSS-CHAIN
                    </span>
                  </div>
                  <p className="text-xs text-[#6E5D4F] leading-relaxed">
                    Generate shareable links payable from Ethereum, Solana, Base, and NEAR with instant settlement.
                  </p>
                </div>
                <Link
                  href="/chat?mode=invoice"
                  className="bg-[#FAF5EC] hover:bg-[#FAF0E0] border border-[#EBE3D5] hover:border-[#1E1315] text-[#1E1315] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center transition-all cursor-pointer shadow-2xs group"
                >
                  <span>Create PayLink</span>
                  <ArrowRight className="w-3 h-3 text-[#6E5D4F] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Row 05 */}
              <div className="py-5 sm:py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#6E5D4F]">
                      05
                    </span>
                    <span className="font-serif text-lg font-bold text-[#1E1315]">
                      Gasless Claim Portal
                    </span>
                    <span className="bg-[#FAF5EC] text-[#6E5D4F] px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border border-[#EFE8D8]">
                      SPONSORED GAS
                    </span>
                  </div>
                  <p className="text-xs text-[#6E5D4F] leading-relaxed">
                    Recipients claim tips directly to their wallet without pre-funding NEAR or paying gas fees.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(true)}
                  className="bg-[#FAF5EC] hover:bg-[#FAF0E0] border border-[#EBE3D5] hover:border-[#1E1315] text-[#1E1315] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center transition-all cursor-pointer shadow-2xs group"
                >
                  <span>Open Claim Portal</span>
                  <ArrowRight className="w-3 h-3 text-[#6E5D4F] group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Row 06 */}
              <div className="py-5 sm:py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#6E5D4F]">
                      06
                    </span>
                    <span className="font-serif text-lg font-bold text-[#1E1315]">
                      Autonomous Evaluation Engine
                    </span>
                    <span className="bg-[#FAF5EC] text-[#6E5D4F] px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border border-[#EFE8D8]">
                      24/7 COPILOT
                    </span>
                  </div>
                  <p className="text-xs text-[#6E5D4F] leading-relaxed">
                    Background triggers evaluate market conditions and execute trades in sandbox mode.
                  </p>
                </div>
                <Link
                  href="/terminal"
                  className="bg-[#FAF5EC] hover:bg-[#FAF0E0] border border-[#EBE3D5] hover:border-[#1E1315] text-[#1E1315] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center transition-all cursor-pointer shadow-2xs group"
                >
                  <span>Launch in Terminal</span>
                  <ArrowRight className="w-3 h-3 text-[#6E5D4F] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: FAQS
         ========================================================================= */}
      <section id="faqs" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Heading */}
          <div className="lg:col-span-4 space-y-5 text-left">
            <div className="text-[10px] tracking-[0.25em] font-semibold text-[#6E5D4F] uppercase">
              FAQS
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal leading-[1.12] text-[#1E1315] tracking-tight">
              Frequently asked questions.
            </h2>
            <p className="text-[#6E5D4F] text-xs sm:text-sm leading-relaxed max-w-xs">
              Autonomous stock agent, session keys, and risk guardrails explained simply.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleLaunchFlow}
                className="bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] px-6 py-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <span>Launch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Column: 2-Column Accordion */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-9 border border-[#EBE3D3] shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {/* Column 1 */}
                <div className="space-y-4 divide-y divide-[#F2EBDC]">
                  {faqItemsCol1.map((item, idx) => {
                    const actualIdx = idx;
                    const isOpen = openFaqIndex === actualIdx;
                    return (
                      <div key={item.q} className="pt-4 first:pt-0">
                        <button
                          onClick={() => toggleFaq(actualIdx)}
                          className="w-full flex items-center justify-between text-left gap-3 group py-1 cursor-pointer"
                        >
                          <span className="font-serif text-sm font-bold text-[#1E1315] group-hover:text-[#4A3B32] transition-colors leading-snug">
                            {item.q}
                          </span>
                          <span className="w-5 h-5 rounded-full border border-[#E5DAC6] flex items-center justify-center text-[#6E5D4F] shrink-0 group-hover:bg-[#FAF7F0] transition-colors">
                            {isOpen ? (
                              <Minus className="w-3 h-3" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                          </span>
                        </button>
                        {isOpen && (
                          <p className="text-xs text-[#6E5D4F] leading-relaxed pt-2 pb-1 font-normal animate-in fade-in duration-200">
                            {item.a}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Column 2 */}
                <div className="space-y-4 divide-y divide-[#F2EBDC]">
                  {faqItemsCol2.map((item, idx) => {
                    const actualIdx = idx + 10;
                    const isOpen = openFaqIndex === actualIdx;
                    return (
                      <div key={item.q} className="pt-4 first:pt-0">
                        <button
                          onClick={() => toggleFaq(actualIdx)}
                          className="w-full flex items-center justify-between text-left gap-3 group py-1 cursor-pointer"
                        >
                          <span className="font-serif text-sm font-bold text-[#1E1315] group-hover:text-[#4A3B32] transition-colors leading-snug">
                            {item.q}
                          </span>
                          <span className="w-5 h-5 rounded-full border border-[#E5DAC6] flex items-center justify-center text-[#6E5D4F] shrink-0 group-hover:bg-[#FAF7F0] transition-colors">
                            {isOpen ? (
                              <Minus className="w-3 h-3" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                          </span>
                        </button>
                        {isOpen && (
                          <p className="text-xs text-[#6E5D4F] leading-relaxed pt-2 pb-1 font-normal animate-in fade-in duration-200">
                            {item.a}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: INFRASTRUCTURE & FOOTER
         ========================================================================= */}
      <section id="technology" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        <p className="font-serif italic text-[#5A4B40] text-sm sm:text-base max-w-2xl text-left mb-6">
          Built with modern architecture to deliver institutional stock trading simulation and social finance on NEAR.
        </p>

        {/* 4-Card Infrastructure Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {/* Card 1 */}
          <div className="bg-white rounded-3xl p-6 border border-[#EBE3D3] shadow-xs flex flex-col justify-between space-y-4 group hover:border-[#DECFA8] transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-[#1E1315]" />
                <span className="font-serif text-sm font-bold text-[#1E1315]">
                  NEAR Omnichain Intents
                </span>
              </div>
            </div>
            <p className="text-xs text-[#6E5D4F] leading-relaxed">
              Decentralized solver network powering cross-chain settlement across major blockchains.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-3xl p-6 border border-[#EBE3D3] shadow-xs flex flex-col justify-between space-y-4 group hover:border-[#DECFA8] transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-[#1E1315]" />
                <span className="font-serif text-sm font-bold text-[#1E1315]">
                  Tokenized Equities
                </span>
              </div>
            </div>
            <p className="text-xs text-[#6E5D4F] leading-relaxed">
              Full $10,000 institutional paper sandbox for automated stock strategies.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-3xl p-6 border border-[#EBE3D3] shadow-xs flex flex-col justify-between space-y-4 group hover:border-[#DECFA8] transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-[#1E1315]" />
                <span className="font-serif text-sm font-bold text-[#1E1315]">
                  Session Delegation
                </span>
              </div>
            </div>
            <p className="text-xs text-[#6E5D4F] leading-relaxed">
              Non-custodial scoped function-call keys allowing autonomous trading without exposing master keys.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-3xl p-6 border border-[#EBE3D3] shadow-xs flex flex-col justify-between space-y-4 group hover:border-[#DECFA8] transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-[#1E1315]" />
                <span className="font-serif text-sm font-bold text-[#1E1315]">
                  X Social Escrow
                </span>
              </div>
            </div>
            <p className="text-xs text-[#6E5D4F] leading-relaxed">
              Smart contract escrow linking verified X handles directly to autonomous subaccounts and gasless tip claims.
            </p>
          </div>
        </div>

        {/* Minimalist Footer */}
        <div className="border-t border-[#EBE2D0] pt-12 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
            {/* Brand Info */}
            <div className="md:col-span-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#E8DCC4] shadow-2xs">
                  <Image
                    src="/veil.png"
                    alt="Veil Logo"
                    width={28}
                    height={28}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-serif text-lg font-bold text-[#1E1315]">
                  Veil
                </span>
              </div>
              <p className="text-xs text-[#6E5D4F] leading-relaxed max-w-sm">
                Autonomous AI trading agent for tokenized stocks and cross-chain social money on NEAR.
              </p>
            </div>

            {/* Explore Links */}
            <div className="md:col-span-3 space-y-2.5">
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1E1315]">
                EXPLORE
              </div>
              <ul className="space-y-1.5 text-xs text-[#6E5D4F]">
                <li>
                  <Link href="/terminal" className="hover:text-[#1E1315] transition-colors">
                    Terminal
                  </Link>
                </li>
                <li>
                  <Link
                    href="/chat"
                    className="hover:text-[#1E1315] transition-colors text-left cursor-pointer"
                  >
                    Social Payments
                  </Link>
                </li>
                <li>
                  <Link
                    href="/chat?mode=invoice"
                    className="hover:text-[#1E1315] transition-colors text-left cursor-pointer"
                  >
                    PayLinks
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => setIsClaimModalOpen(true)}
                    className="hover:text-[#1E1315] transition-colors text-left cursor-pointer"
                  >
                    Claim Portal
                  </button>
                </li>
              </ul>
            </div>

            {/* Connect Links */}
            <div className="md:col-span-3 space-y-2.5">
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1E1315]">
                CONNECT
              </div>
              <ul className="space-y-1.5 text-xs text-[#6E5D4F]">
                <li>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#1E1315] transition-colors"
                  >
                    Veil on X
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.near.org"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#1E1315] transition-colors"
                  >
                    NEAR Protocol
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6E5D4F] pt-6 border-t border-[#F2EBDC]">
            <div>© 2026 Veil Protocol. Autonomous agent trading on NEAR.</div>
          </div>
        </div>
      </section>

      {/* Global Interactive Modals */}
      <TwitterClaimModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          router.push("/terminal");
        }}
      />
    </div>
  );
}
