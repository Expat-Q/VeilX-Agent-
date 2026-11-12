"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchNearAccount } from "@/lib/near-rpc";
import { sanitizeNearAccountId } from "@/lib/near-utils";
import {
  getStoredAgentSession,
  saveAgentSession,
  revokeAgentSession,
  initializeEmbeddedSession,
  AgentSessionState,
} from "@/lib/near-embedded-wallet";

export interface AuthUser {
  xHandle: string;
  nearAccountId: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface EvmHoldingItem {
  network: string;
  chainId: number;
  symbol: string;
  name: string;
  balance: string;
  usdPrice: number;
  valueUsd: number;
  explorerUrl?: string;
  contractAddress?: string;
  isNative?: boolean;
}

export interface EvmBalanceInfo {
  eth: string;
  usdc: string;
  address: string;
  totalEvmUsd?: number;
  holdings?: EvmHoldingItem[];
}

export interface NearTokenItem {
  symbol: string;
  name: string;
  balance: string;
  numericBalance: number;
  decimals: number;
  contractAddress: string;
  usdPrice: number;
  valueUsd: number;
}

export interface PaymentToastInfo {
  id: string;
  title: string;
  message: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  balanceUsd: number;
  nearBalance: string;
  nearTokens: NearTokenItem[];
  evmBalance: EvmBalanceInfo | null;
  activeToast: PaymentToastInfo | null;
  spendingLimitUsd: number;
  spentUsd: number;
  networkMode: "testnet" | "mainnet";
  setNetworkMode: (mode: "testnet" | "mainnet") => void;
  login: (xHandle: string, customNearAccount?: string) => Promise<void>;
  logout: () => void;
  updateSpendingLimit: (newLimit: number) => void;
  refreshAccountData: () => Promise<void>;
  dismissToast: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "veilx_auth_user_v1";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [balanceUsd, setBalanceUsd] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const b = sessionStorage.getItem("veil_cached_balance_usd");
      if (b) return parseFloat(b) || 0.0;
    }
    return 0.0;
  });
  const [nearBalance, setNearBalance] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const b = sessionStorage.getItem("veil_cached_near_balance");
      if (b) return b;
    }
    return "0.0";
  });
  const [nearTokens, setNearTokens] = useState<NearTokenItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const b = sessionStorage.getItem("veil_cached_near_tokens");
        if (b) return JSON.parse(b);
      } catch {}
    }
    return [];
  });
  const [evmBalance, setEvmBalance] = useState<EvmBalanceInfo | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const b = sessionStorage.getItem("veil_cached_evm_balance");
        if (b) return JSON.parse(b);
      } catch {}
    }
    return null;
  });
  const [activeToast, setActiveToast] = useState<PaymentToastInfo | null>(null);
  const [spendingLimitUsd, setSpendingLimitUsd] = useState(50);
  const [spentUsd, setSpentUsd] = useState(0);
  const [networkMode, setNetworkModeState] = useState<"testnet" | "mainnet">("testnet");
  const lastSyncTimeRef = React.useRef<{ accountId: string; time: number }>({ accountId: "", time: 0 });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("veilx_network_mode") as "testnet" | "mainnet";
      if (saved === "mainnet" || saved === "testnet") {
        setNetworkModeState(saved);
      }
    } catch {}
  }, []);

  const setNetworkMode = (mode: "testnet" | "mainnet") => {
    setNetworkModeState(mode);
    try {
      localStorage.setItem("veilx_network_mode", mode);
      window.dispatchEvent(new CustomEvent("veilx_network_mode_changed", { detail: { mode } }));
    } catch {}
  };

  const syncBalances = async (nearAccountId: string, force = false) => {
    const now = Date.now();
    if (!force && lastSyncTimeRef.current.accountId === nearAccountId && now - lastSyncTimeRef.current.time < 8000) {
      return;
    }
    lastSyncTimeRef.current = { accountId: nearAccountId, time: now };

    let nearUsd = 0;
    let liveNearPrice = 3.70;
    let liveEthPrice = 2240.0;

    try {
      const pRes = await fetch("/api/prices?symbols=NEAR,ETH");
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.nearPrice) liveNearPrice = pData.nearPrice;
        if (pData.ethPrice) liveEthPrice = pData.ethPrice;
      }
    } catch {}

    try {
      const info = await fetchNearAccount(nearAccountId);
      if (info.exists) {
        setNearBalance(info.amountNear);
        sessionStorage.setItem("veil_cached_near_balance", info.amountNear);
        const numNear = parseFloat(info.amountNear) || 0.0;
        nearUsd = numNear * liveNearPrice;

        if (info.tokens && Array.isArray(info.tokens)) {
          setNearTokens(info.tokens);
          sessionStorage.setItem("veil_cached_near_tokens", JSON.stringify(info.tokens));
          const tokensUsd = info.tokens.reduce((acc, t) => acc + (t.valueUsd || 0), 0);
          nearUsd += tokensUsd;
        }
      }
      // Stale-While-Revalidate: Keep existing positive balance if temporary RPC hiccup occurs
    } catch {
      // Do not wipe out known balance on transient network timeout
    }

    let evmUsd = 0;
    try {
      const r = await fetch(`/api/evm/balance?accountId=${encodeURIComponent(nearAccountId)}`);
      const d = await r.json();
      if (d.success && d.data) {
        evmUsd = typeof d.data.totalEvmUsd === "number"
          ? d.data.totalEvmUsd
          : (parseFloat(d.data.usdcBalance) || 0) + (parseFloat(d.data.ethBalance) || 0) * liveEthPrice;
        const evmInfo = {
          eth: d.data.ethBalance,
          usdc: d.data.usdcBalance,
          address: d.data.address,
          totalEvmUsd: evmUsd,
          holdings: d.data.holdings || [],
        };
        setEvmBalance(evmInfo);
        sessionStorage.setItem("veil_cached_evm_balance", JSON.stringify(evmInfo));
      }
    } catch {}

    const totalUsd = Number((nearUsd + evmUsd).toFixed(2));
    setBalanceUsd(totalUsd);
    sessionStorage.setItem("veil_cached_balance_usd", String(totalUsd));
  };

  // 3-Tier Auth Initialization: OAuth Redirect -> Server Session Cookie -> LocalStorage Fallback
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        // 1. Check if returning from Twitter OAuth callback (?connected=true&handle=...)
        let oauthHandle: string | null = null;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          if (params.get("connected") === "true" || params.get("handle")) {
            oauthHandle = params.get("handle");
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("connected");
            cleanUrl.searchParams.delete("handle");
            cleanUrl.searchParams.delete("error");
            window.history.replaceState({}, "", cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ""));
          }
        }

        // 2. Fetch authenticated session from server (/api/auth/me)
        let serverUser: any = null;
        try {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user) {
              serverUser = data.user;
            }
          }
        } catch (e) {
          console.warn("Could not fetch /api/auth/me:", e);
        }

        const resolvedHandle = serverUser?.xHandle || oauthHandle;

        if (resolvedHandle) {
          const clean = resolvedHandle.replace("@", "").trim();
          const accountId = sanitizeNearAccountId(clean);

          const authUser: AuthUser = {
            xHandle: clean,
            nearAccountId: accountId,
            avatarUrl: serverUser?.avatarUrl || `https://unavatar.io/twitter/${clean}`,
            createdAt: new Date().toISOString(),
          };

          const session = initializeEmbeddedSession(clean);
          if (session) {
            const initialLimit = serverUser?.spendingLimitUsd ?? session.spendingLimitUsd ?? 50.0;
            // Prefer server spending if available, or local if greater
            const serverDaily = typeof serverUser?.spentUsd === "number" ? serverUser.spentUsd : 0;
            const initialSpent = Math.max(serverDaily, session.spentUsd || 0);
            session.spendingLimitUsd = initialLimit;
            session.spentUsd = initialSpent;
            if (serverUser?.weeklyLimitUsd) session.weeklyLimitUsd = serverUser.weeklyLimitUsd;
            if (serverUser?.weeklySpentUsd) session.weeklySpentUsd = Math.max(serverUser.weeklySpentUsd, session.weeklySpentUsd || 0);
            saveAgentSession(session, clean);

            setSpendingLimitUsd(initialLimit);
            setSpentUsd(initialSpent);
          }

          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
          if (isMounted) setUser(authUser);
          await syncBalances(authUser.nearAccountId);

          // Self-heal on-chain subaccount authorization with active browser session key
          if (session?.publicKey) {
            fetch("/api/user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                xHandle: clean,
                nearAccountId: accountId,
                publicKey: session.publicKey,
                spendingLimitUsd: serverUser?.spendingLimitUsd ?? session.spendingLimitUsd ?? 50.0,
              }),
            })
              .then((r) => r.json())
              .then((data) => {
                if (data?.user?.nearAccountId && data.user.nearAccountId !== accountId) {
                  const healed = data.user.nearAccountId;
                  console.log("[AuthContext] Auto-healed NEAR account to verified subaccount:", healed);
                  const updated: AuthUser = { ...authUser, nearAccountId: healed };
                  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
                  if (session) {
                    session.accountId = healed;
                    saveAgentSession(session, clean);
                  }
                  if (isMounted) {
                    setUser(updated);
                    syncBalances(healed);
                  }
                }
              })
              .catch(() => {});
          }
          return;
        }

        // 3. Fallback to localStorage
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed: AuthUser = JSON.parse(stored);
          const canonicalAcc = sanitizeNearAccountId(parsed.xHandle);
          parsed.nearAccountId = canonicalAcc;
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
          if (isMounted) setUser(parsed);

          let session = getStoredAgentSession(parsed.xHandle);
          if (!session) {
            console.log("[AuthContext] Self-healing missing agent session for:", parsed.xHandle);
            session = initializeEmbeddedSession(parsed.xHandle);
          }
          if (session) {
            session.accountId = canonicalAcc;
            saveAgentSession(session, parsed.xHandle);
            // Restore from server user document if available
            try {
              const uRes = await fetch(`/api/user?handle=${encodeURIComponent(parsed.xHandle)}`);
              if (uRes.ok) {
                const uData = await uRes.json();
                if (uData.exists && uData.user) {
                  if (typeof uData.user.spendingLimitUsd === "number") {
                    session.spendingLimitUsd = uData.user.spendingLimitUsd;
                  }
                  // Take the maximum of local and remote to prevent zeroing out un-synced spends
                  const serverSpent = typeof uData.user.spentUsd === "number" ? uData.user.spentUsd : 0;
                  const localSpent = session.spentUsd || 0;
                  session.spentUsd = Math.max(serverSpent, localSpent);

                  const serverWeekly = typeof uData.user.weeklySpentUsd === "number" ? uData.user.weeklySpentUsd : 0;
                  const localWeekly = session.weeklySpentUsd || session.spentUsd || 0;
                  session.weeklySpentUsd = Math.max(serverWeekly, localWeekly);

                  if (typeof uData.user.weeklyLimitUsd === "number") {
                    session.weeklyLimitUsd = uData.user.weeklyLimitUsd;
                  }
                  saveAgentSession(session, parsed.xHandle);
                }
              }
            } catch (err) {
              console.warn("Could not sync remote user spending limit:", err);
            }
            setSpendingLimitUsd(session.spendingLimitUsd);
            setSpentUsd(session.spentUsd);
          }

          await syncBalances(canonicalAcc);

          // Synchronize user profile with server
          if (session?.publicKey) {
            fetch("/api/user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                xHandle: parsed.xHandle,
                nearAccountId: canonicalAcc,
                publicKey: session.publicKey,
                spendingLimitUsd: session.spendingLimitUsd || 50.0,
              }),
            }).catch(() => {});
          }
        } else {
          if (isMounted) {
            setUser(null);
            setNearBalance("0.0");
            setBalanceUsd(0.0);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync session state updates in real time
  useEffect(() => {
    const handleSessionUpdate = (e: any) => {
      const updatedSession = e.detail || getStoredAgentSession(user?.xHandle);
      if (updatedSession) {
        setSpendingLimitUsd(updatedSession.spendingLimitUsd);
        setSpentUsd(updatedSession.spentUsd);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("veilx_session_updated", handleSessionUpdate);
      return () => window.removeEventListener("veilx_session_updated", handleSessionUpdate);
    }
  }, [user?.xHandle]);

  const login = async (xHandle: string, customNearAccount?: string) => {
    const cleanHandle = xHandle.replace("@", "").trim();
    let initialNearAccount = customNearAccount?.trim() || sanitizeNearAccountId(cleanHandle);
    if (initialNearAccount.endsWith(".veilx.testnet")) {
      initialNearAccount = initialNearAccount.replace(/\.veilx\.testnet$/i, ".veilx-agent.testnet");
    }

    // Initialize cryptographic Ed25519 session key for this account
    const activeSession = initializeEmbeddedSession(cleanHandle);
    if (activeSession) {
      setSpendingLimitUsd(activeSession.spendingLimitUsd);
      setSpentUsd(activeSession.spentUsd);
    }

    const newUser: AuthUser = {
      xHandle: cleanHandle,
      nearAccountId: initialNearAccount,
      avatarUrl: `https://unavatar.io/twitter/${cleanHandle}`,
      createdAt: new Date().toISOString(),
    };

    setUser(newUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));

    // Register / update user in MongoDB Atlas and bind on-chain subaccount to user's cryptographic key
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xHandle: cleanHandle,
          nearAccountId: initialNearAccount,
          publicKey: activeSession?.publicKey,
          spendingLimitUsd: activeSession?.spendingLimitUsd || 50.0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user?.nearAccountId) {
          const finalAccount = data.user.nearAccountId;
          const updatedUser: AuthUser = {
            ...newUser,
            nearAccountId: finalAccount,
          };
          setUser(updatedUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
          if (activeSession) {
            activeSession.accountId = finalAccount;
            saveAgentSession(activeSession, cleanHandle);
          }
          initialNearAccount = finalAccount;
        }
      }
    } catch (e) {
      console.warn("Failed to sync user to MongoDB:", e);
    }

    await syncBalances(initialNearAccount);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem("veilx_onboarded");
    localStorage.removeItem("veilx_portfolio_setup");
    revokeAgentSession();
    setSpentUsd(0);
    setNearBalance("0.0");
    setBalanceUsd(0.0);
    setEvmBalance(null);
    fetch("/api/auth/me", { method: "DELETE" }).catch(() => {});
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const updateSpendingLimit = (newLimit: number) => {
    setSpendingLimitUsd(newLimit);
    const session = getStoredAgentSession(user?.xHandle);
    if (session) {
      session.spendingLimitUsd = newLimit;
      saveAgentSession(session, user?.xHandle);
    }
    if (user?.xHandle) {
      fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xHandle: user.xHandle,
          nearAccountId: user.nearAccountId,
          spendingLimitUsd: newLimit,
        }),
      }).catch((e) => console.warn("Failed to update spending limit in DB:", e));
    }
  };

  const refreshAccountData = async () => {
    if (!user) return;
    await syncBalances(user.nearAccountId, true);
    let session = getStoredAgentSession(user.xHandle);
    if (!session) {
      session = initializeEmbeddedSession(user.xHandle);
    }
    if (session) {
      setSpendingLimitUsd(session.spendingLimitUsd);
      setSpentUsd(session.spentUsd);
    }
  };

  // 6-Second Background Poller: On-Chain NEAR Balance + Base EVM Balance + Inflow Detection Toast
  useEffect(() => {
    if (!user?.nearAccountId) return;

    let isPolling = false;

    const poll = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        await syncBalances(user.nearAccountId);
      } catch (err) {
        // Silently ignore transient network blips
      } finally {
        isPolling = false;
      }
    };

    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [user?.nearAccountId, user?.xHandle]);

  const dismissToast = () => setActiveToast(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        balanceUsd,
        nearBalance,
        nearTokens,
        evmBalance,
        activeToast,
        spendingLimitUsd,
        spentUsd,
        networkMode,
        setNetworkMode,
        login,
        logout,
        updateSpendingLimit,
        refreshAccountData,
        dismissToast,
      }}
    >
      {children}

      {/* Floating SoFi Payment Toast */}
      {activeToast && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-white border-2 border-[#16A34A] rounded-2xl p-4 shadow-xl flex items-start gap-3 max-w-sm">
            <div className="w-9 h-9 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center font-bold text-sm shrink-0">
              ✦
            </div>
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold text-[#166534] block">
                {activeToast.title}
              </span>
              <p className="text-xs text-brown-800 font-medium mt-0.5 leading-snug">
                {activeToast.message}
              </p>
            </div>
            <button
              onClick={dismissToast}
              className="text-brown-400 hover:text-brown-700 text-xs font-bold p-1 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
