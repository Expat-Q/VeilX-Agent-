"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Wallet,
  ChevronDown,
  MessageSquare,
  LayoutDashboard,
  TrendingUp,
  User,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Globe,
  Sliders,
  AlertOctagon,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SpendingCapModal } from "@/components/modals/SpendingCapModal";
import { TwitterClaimModal } from "@/components/modals/TwitterClaimModal";
import { AuthModal } from "@/components/modals/AuthModal";
import { OAuthStatusModal } from "@/components/modals/OAuthStatusModal";
import { getStoredAgentSession, freezeAgentSession, unfreezeAgentSession } from "@/lib/near-embedded-wallet";

export function HeaderNav() {
  const { user, isLoggedIn, balanceUsd, nearBalance, evmBalance, spendingLimitUsd, spentUsd, refreshAccountData, logout, networkMode, setNetworkMode } = useAuth();
  const [isCapModalOpen, setIsCapModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [unclaimedCount, setUnclaimedCount] = useState<number>(0);
  const [isAgentFrozen, setIsAgentFrozen] = useState<boolean>(false);
  const pathname = usePathname();
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  // Navigation Switcher (Terminal vs Chat vs Dashboard)



  useEffect(() => {
    if (user?.xHandle) {
      fetch(`/api/near/pending-tips?handle=${encodeURIComponent(user.xHandle)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.count) setUnclaimedCount(data.count);
          else setUnclaimedCount(0);
        })
        .catch(() => {});
    } else {
      setUnclaimedCount(0);
    }
  }, [user?.xHandle]);

  const remaining = Math.max(0, spendingLimitUsd - spentUsd);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(type);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAccountData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // If on landing page ("/") or onboarding page ("/onboarding"), hide standard app header for clean focused view
  if (pathname === "/" || pathname === "/onboarding") {
    return null;
  }

  return (
    <>
      <header className="h-14 sm:h-16 border-b border-butter-300 bg-butter-50/95 backdrop-blur-md sticky top-0 z-40 px-2 sm:px-6 lg:px-8 flex items-center justify-between shadow-subtle max-w-full">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl overflow-hidden shadow-sm shrink-0 border border-butter-300 bg-brown-900">
              <Image
                src="/veil.png"
                alt="Veil Logo"
                width={36}
                height={36}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
                <span className="font-bold text-sm sm:text-base tracking-tight text-brown-900">Veil</span>
              </div>
              <span className="text-[10px] text-brown-500 font-medium hidden lg:inline-block mt-0.5 whitespace-nowrap">
                Autonomous Social Finance on NEAR
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Navigation Switcher (Terminal vs Chat vs Dashboard) */}
        <nav className="flex items-center gap-0.5 sm:gap-1 bg-butter-200/90 p-0.5 sm:p-1 rounded-xl border border-butter-300 shadow-inner shrink-0">
          <Link
            href="/terminal"
            className={`h-7 px-2 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition ${
              pathname === "/terminal"
                ? "bg-white text-brown-900 shadow-subtle"
                : "text-brown-600 hover:text-brown-900"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden md:inline">Terminal</span>
          </Link>
          <Link
            href="/chat"
            className={`h-7 px-2 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition ${
              pathname === "/chat" || pathname === "/"
                ? "bg-white text-brown-900 shadow-subtle"
                : "text-brown-600 hover:text-brown-900"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Social Pay</span>
          </Link>
          <Link
            href="/dashboard"
            className={`h-7 px-2 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition ${
              pathname === "/dashboard"
                ? "bg-white text-brown-900 shadow-subtle"
                : "text-brown-600 hover:text-brown-900"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Dashboard</span>
            {unclaimedCount > 0 && (
              <span
                className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5"
                title={`${unclaimedCount} pending tip(s) waiting in escrow`}
              />
            )}
          </Link>
        </nav>

        {/* Right: Controls & Identity */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 relative" ref={userMenuRef}>
          {/* Dynamic Network Environment Toggle (Testnet Sandbox vs Mainnet) */}
          <button
            type="button"
            onClick={() => {
              const next = networkMode === "testnet" ? "mainnet" : "testnet";
              setNetworkMode(next);
            }}
            className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-full text-[10px] sm:text-xs font-bold shadow-2xs flex items-center gap-1 sm:gap-1.5 transition cursor-pointer border ${
              networkMode === "testnet"
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                : "bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300"
            }`}
            title={`Current Environment: ${networkMode.toUpperCase()}. Click to switch between Testnet Sandbox and Mainnet.`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                networkMode === "testnet" ? "bg-emerald-500 animate-pulse" : "bg-purple-600"
              }`}
            />
            <span className="uppercase text-[9px] sm:text-[10px] tracking-wider font-mono">
              {networkMode === "testnet" ? "Testnet" : "Mainnet"}
            </span>
          </button>

          {/* Autonomous Spending Cap Setting Pill (Hidden on narrow mobile to keep header clean and spacious) */}
          {isLoggedIn && user && (
            <button
              type="button"
              onClick={() => setIsCapModalOpen(true)}
              className="hidden sm:flex h-7 sm:h-8 px-2 sm:px-2.5 rounded-full bg-white hover:bg-butter-100 border border-butter-300 text-brown-800 text-[10px] sm:text-xs font-mono font-bold items-center gap-1 transition shadow-2xs cursor-pointer shrink-0"
              title="Manage Agent Daily Spending Cap"
            >
              <Sliders className="w-3 h-3 text-brown-600" />
              <span>${remaining.toFixed(0)}</span>
              <span className="text-[9px] text-brown-500 font-sans font-medium uppercase">Cap</span>
            </button>
          )}

          {/* Connected 𝕏 User Profile Button */}
          {isLoggedIn && user ? (
            <button
              onClick={() => setIsUserMenuOpen((v) => !v)}
              className="h-7 sm:h-8 w-7 sm:w-auto p-0.5 sm:px-2.5 rounded-full bg-butter-200 hover:bg-butter-300 border border-butter-300 transition flex items-center justify-center gap-1.5 shrink-0 shadow-subtle cursor-pointer"
              title={`@${user.xHandle} (Connected via 𝕏)`}
            >
              <Image
                src={user.avatarUrl || `https://unavatar.io/twitter/${user.xHandle}`}
                alt={user.xHandle}
                width={22}
                height={22}
                unoptimized
                className="w-5 h-5 sm:w-5 sm:h-5 rounded-full object-cover border border-butter-300 shrink-0"
              />
              <span className="text-xs font-bold text-brown-900 leading-none hidden sm:inline">
                @{user.xHandle}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-full bg-brown-900 hover:bg-brown-800 text-butter-100 text-xs font-bold transition shadow-subtle flex items-center gap-1.5 cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>
          )}

          {/* Clean User Account Menu (Non-Repetitive) */}
          {isUserMenuOpen && isLoggedIn && user && (
            <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl border border-butter-300 shadow-xl p-4 z-50 text-brown-900 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3 font-sans">
              {/* Header: User Account */}
              <div className="flex items-center justify-between pb-2.5 border-b border-butter-200">
                <div className="flex items-center gap-2">
                  <Image
                    src={user.avatarUrl || `https://unavatar.io/twitter/${user.xHandle}`}
                    alt={user.xHandle}
                    width={28}
                    height={28}
                    unoptimized
                    className="w-7 h-7 rounded-full object-cover border border-butter-300 shrink-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-brown-900 leading-tight">
                      @{user.xHandle}
                    </div>
                    <div className="text-[10px] text-brown-500 font-mono truncate max-w-[140px]">
                      {user.nearAccountId}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleManualRefresh}
                  className="p-1 rounded-lg hover:bg-butter-100 text-brown-500 transition cursor-pointer"
                  title="Refresh Account Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-brown-900" : ""}`} />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1 text-xs">
                <Link
                  href="/dashboard"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-butter-100 text-brown-800 transition font-medium"
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-3.5 h-3.5 text-brown-600" />
                    <span>View All Holdings &amp; Portfolio</span>
                  </div>
                </Link>

                <Link
                  href="/terminal"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-butter-100 text-brown-800 transition font-medium"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Trading Terminal</span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsCapModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-butter-100 text-brown-800 transition font-medium text-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-brown-600" />
                    <span>Daily Spending Cap</span>
                  </div>
                  <span className="font-mono font-bold text-[11px] text-brown-900">${spendingLimitUsd.toFixed(0)}</span>
                </button>
              </div>

              {/* Connected Addresses Copy Box */}
              <div className="space-y-1 pt-2 border-t border-butter-200 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded-lg bg-butter-50 border border-butter-200">
                  <span className="text-[10px] text-brown-500 uppercase">NEAR:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate max-w-[120px] text-brown-900 text-[11px]">
                      {user.nearAccountId}
                    </span>
                    <button
                      onClick={() => handleCopy(user.nearAccountId, "near")}
                      className="text-brown-500 hover:text-brown-900 cursor-pointer"
                      title="Copy"
                    >
                      {copiedAddress === "near" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {evmBalance?.address && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-butter-50 border border-butter-200">
                    <span className="text-[10px] text-brown-500 uppercase">EVM:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-brown-900 text-[11px]">
                        {evmBalance.address.slice(0, 6)}...{evmBalance.address.slice(-4)}
                      </span>
                      <button
                        onClick={() => handleCopy(evmBalance.address, "evm")}
                        className="text-brown-500 hover:text-brown-900 cursor-pointer"
                        title="Copy"
                      >
                        {copiedAddress === "evm" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Global Emergency Freeze Switch */}
              <div className="pt-2 border-t border-butter-200">
                <button
                  type="button"
                  onClick={handleToggleFreeze}
                  className={`w-full py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer border ${
                    isAgentFrozen
                      ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      : "bg-butter-50 text-brown-800 border-butter-300 hover:bg-butter-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <AlertOctagon className={`w-3.5 h-3.5 ${isAgentFrozen ? "text-rose-600" : "text-brown-600"}`} />
                    <span>Emergency Freeze</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                      isAgentFrozen ? "bg-rose-600 text-white" : "bg-butter-200 text-brown-700"
                    }`}
                  >
                    {isAgentFrozen ? "FROZEN" : "ACTIVE"}
                  </span>
                </button>
              </div>

              {/* Logout Button */}
              <div className="pt-1">
                <button
                  onClick={() => {
                    logout();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 transition text-center cursor-pointer"
                >
                  Disconnect Account
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Autonomous Spending Cap Modal */}
      <SpendingCapModal
        isOpen={isCapModalOpen}
        onClose={() => setIsCapModalOpen(false)}
      />

      {/* Twitter Identity & Gasless Claim Modal */}
      <TwitterClaimModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
      />

      {/* Auth & Identity Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* OAuth Result Status Modal (Success / Error) */}
      <OAuthStatusModal onRetryLogin={() => setIsAuthModalOpen(true)} />
    </>
  );
}
