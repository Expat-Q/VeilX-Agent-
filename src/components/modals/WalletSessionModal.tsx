"use client";

import React, { useState, useEffect } from "react";
import {
  AgentSessionState,
  getStoredAgentSession,
  initializeEmbeddedSession,
  updateSpendingLimit,
  revokeAgentSession,
} from "@/lib/near-embedded-wallet";
import {
  ConnectedExternalWallet,
  getStoredExternalWallet,
  saveStoredExternalWallet,
  removeStoredExternalWallet,
  verifyNearAccountOnChain,
  connectMeteorWallet,
  connectSenderWallet,
} from "@/lib/near-wallet-connector";
import {
  Shield,
  Sparkles,
  Key,
  X,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Search,
  LogOut,
  Coins,
  Loader2,
  Globe,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDerivedEvm } from "@/lib/use-derived-evm";

interface WalletSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionUpdated?: () => void;
}

export function WalletSessionModal({
  isOpen,
  onClose,
  onSessionUpdated,
}: WalletSessionModalProps) {
  const { user, updateSpendingLimit: updateContextLimit, evmBalance } = useAuth();
  const [session, setSession] = useState<AgentSessionState | null>(null);
  const [activeTab, setActiveTab] = useState<"session" | "external">("session");
  const [customLimit, setCustomLimit] = useState<number>(50);
  const [copied, setCopied] = useState(false);
  const [copiedEvm, setCopiedEvm] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  // Derived EVM Address via NEAR Chain Signatures MPC
  const derivedEvm = useDerivedEvm(session?.accountId);

  // External Wallet States
  const [externalWallet, setExternalWallet] = useState<ConnectedExternalWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [manualAccountId, setManualAccountId] = useState("");
  const [isVerifyingManual, setIsVerifyingManual] = useState(false);

  // Faucet state
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);
  const [faucetSuccess, setFaucetSuccess] = useState<string | null>(null);
  const [faucetError, setFaucetError] = useState<string | null>(null);

  const handleClaimModalFaucet = async (targetAccount: string) => {
    setIsClaimingFaucet(true);
    setFaucetError(null);
    setFaucetSuccess(null);
    try {
      const activeSession = getStoredAgentSession();
      const res = await fetch("/api/near/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: targetAccount,
          publicKey: activeSession?.publicKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Faucet claim failed");

      const resolvedAccount = data.targetAccount || targetAccount;
      setFaucetSuccess(`Dispensed 0.25 NEAR to ${resolvedAccount} (Tx: ${data.txHash.slice(0, 8)}...)`);

      // Refresh on-chain balance
      const updated = await verifyNearAccountOnChain(resolvedAccount);
      if (updated.balanceNear && externalWallet) {
        const nextWallet = { ...externalWallet, accountId: resolvedAccount, balanceNear: updated.balanceNear };
        setExternalWallet(nextWallet);
        saveStoredExternalWallet(nextWallet);
      }
      onSessionUpdated?.();
    } catch (err: any) {
      setFaucetError(err.message || "Failed to claim faucet tokens");
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const active = initializeEmbeddedSession(user?.xHandle || "guest");
      setSession(active);
      setCustomLimit(active.spendingLimitUsd);

      // Load stored external wallet
      const storedExt = getStoredExternalWallet();
      setExternalWallet(storedExt);

      // Refresh balance on-chain if account exists
      if (storedExt?.accountId) {
        verifyNearAccountOnChain(storedExt.accountId).then((res) => {
          if (res.exists && res.balanceNear) {
            const updated = { ...storedExt, balanceNear: res.balanceNear };
            setExternalWallet(updated);
            saveStoredExternalWallet(updated);
          }
        });
      }
    }
  }, [isOpen, user]);

  if (!isOpen || !session) return null;

  const remainingBudget = Math.max(0, session.spendingLimitUsd - session.spentUsd);
  const percentUsed = Math.min(100, (session.spentUsd / session.spendingLimitUsd) * 100);

  const handleSetLimit = (amount: number) => {
    const cleanAmount = Math.max(1, Math.min(10000, Number(amount) || 50));
    setCustomLimit(cleanAmount);
    updateSpendingLimit(cleanAmount, user?.xHandle);
    updateContextLimit?.(cleanAmount);
    setSession(getStoredAgentSession(user?.xHandle));
    onSessionUpdated?.();
  };

  const handleRevoke = () => {
    revokeAgentSession(user?.xHandle);
    setSession(null);
    onSessionUpdated?.();
    onClose();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEvm = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEvm(true);
    setTimeout(() => setCopiedEvm(false), 2000);
  };

  // Connect Meteor Wallet Extension
  const handleConnectMeteor = async () => {
    setIsConnecting("meteor");
    setConnectionError(null);
    try {
      const res = await connectMeteorWallet();
      if (res.success && res.accountId) {
        const onChain = await verifyNearAccountOnChain(res.accountId);
        const walletData: ConnectedExternalWallet = {
          walletType: "meteor",
          accountId: res.accountId,
          balanceNear: onChain.balanceNear || "0.0",
          connectedAt: Date.now(),
        };
        saveStoredExternalWallet(walletData);
        setExternalWallet(walletData);
        await syncAccountWithBackend(res.accountId);
      } else if (res.error === "EXTENSION_NOT_FOUND") {
        setConnectionError("Meteor extension not detected. Opening download page or use Account ID link below.");
        window.open("https://meteorwallet.app", "_blank");
      } else {
        setConnectionError(res.error || "Failed to connect to Meteor Wallet");
      }
    } catch (err: any) {
      setConnectionError(err.message || "Meteor connection failed");
    } finally {
      setIsConnecting(null);
    }
  };

  // Connect Sender Wallet Extension
  const handleConnectSender = async () => {
    setIsConnecting("sender");
    setConnectionError(null);
    try {
      const res = await connectSenderWallet();
      if (res.success && res.accountId) {
        const onChain = await verifyNearAccountOnChain(res.accountId);
        const walletData: ConnectedExternalWallet = {
          walletType: "sender",
          accountId: res.accountId,
          balanceNear: onChain.balanceNear || "0.0",
          connectedAt: Date.now(),
        };
        saveStoredExternalWallet(walletData);
        setExternalWallet(walletData);
        await syncAccountWithBackend(res.accountId);
      } else if (res.error === "EXTENSION_NOT_FOUND") {
        setConnectionError("Sender extension not detected. Opening download page or use Account ID link below.");
        window.open("https://senderwallet.io", "_blank");
      } else {
        setConnectionError(res.error || "Failed to connect to Sender Wallet");
      }
    } catch (err: any) {
      setConnectionError(err.message || "Sender connection failed");
    } finally {
      setIsConnecting(null);
    }
  };

  // Connect HERE Wallet (Official working landing / bot)
  const handleConnectHere = () => {
    window.open("https://herewallet.app", "_blank");
  };

  // Connect Nightly Wallet
  const handleConnectNightly = () => {
    if (typeof window !== "undefined") {
      const nightly = (window as any).nightly?.near;
      if (nightly) {
        nightly
          .connect()
          .then((acc: any) => {
            if (acc?.accountId) {
              verifyNearAccountOnChain(acc.accountId).then((onChain) => {
                const walletData: ConnectedExternalWallet = {
                  walletType: "custom",
                  accountId: acc.accountId,
                  balanceNear: onChain.balanceNear || "0.0",
                  connectedAt: Date.now(),
                };
                saveStoredExternalWallet(walletData);
                setExternalWallet(walletData);
                syncAccountWithBackend(acc.accountId);
              });
            }
          })
          .catch((e: any) => setConnectionError(e.message));
      } else {
        window.open("https://wallet.nightly.app", "_blank");
      }
    }
  };

  // Verify and link existing NEAR Testnet account directly
  const handleLinkManualAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAccountId.trim()) return;

    setIsVerifyingManual(true);
    setConnectionError(null);

    const targetAccount = manualAccountId.trim().toLowerCase();
    const verification = await verifyNearAccountOnChain(targetAccount);

    setIsVerifyingManual(false);

    if (!verification.exists) {
      setConnectionError(`Account "${targetAccount}" was not found on NEAR testnet.`);
      return;
    }

    const walletData: ConnectedExternalWallet = {
      walletType: "custom",
      accountId: targetAccount,
      balanceNear: verification.balanceNear || "0.0",
      connectedAt: Date.now(),
    };

    saveStoredExternalWallet(walletData);
    setExternalWallet(walletData);
    setManualAccountId("");
    await syncAccountWithBackend(targetAccount);
  };

  // Disconnect external wallet
  const handleDisconnectExternal = () => {
    removeStoredExternalWallet();
    setExternalWallet(null);
    setConnectionError(null);
  };

  // Sync connected account with MongoDB backend
  const syncAccountWithBackend = async (nearAccountId: string) => {
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xHandle: "expatq3",
          nearAccountId,
        }),
      });
      onSessionUpdated?.();
    } catch (err) {
      console.warn("Failed to sync account to backend:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brown-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[94vw] sm:w-full max-w-lg bg-white border border-butter-300 rounded-3xl p-4 sm:p-6 shadow-elevated relative overflow-hidden max-h-[88vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-butter-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brown-900 text-butter-100 flex items-center justify-center shadow-sm">
              <Key className="w-4 h-4 text-butter-100" />
            </div>
            <div>
              <h2 className="text-base font-bold text-brown-900 leading-tight">
                NEAR Wallet & Agent Authority
              </h2>
              <p className="text-[11px] text-brown-500 font-medium">
                Scoped Session Keys & Non-Custodial Account
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-butter-100 text-brown-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-butter-50 p-1 mb-5 border border-butter-200">
          <button
            onClick={() => setActiveTab("session")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "session"
                ? "bg-white text-brown-900 shadow-subtle border border-butter-300"
                : "text-brown-500 hover:text-brown-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-shield-emerald" />
            Agent Session Authority
          </button>
          <button
            onClick={() => setActiveTab("external")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "external"
                ? "bg-white text-brown-900 shadow-subtle border border-butter-300"
                : "text-brown-500 hover:text-brown-800"
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-brown-700" />
            External Wallets
            {externalWallet && (
              <span className="w-1.5 h-1.5 rounded-full bg-shield-emerald ml-1"></span>
            )}
          </button>
        </div>

        {/* TAB 1: AGENT SESSION & EMBEDDED ACCOUNT */}
        {activeTab === "session" && (
          <div className="space-y-4">
            {/* Account Card */}
            <div className="p-4 rounded-2xl bg-butter-50 border border-butter-300">
              <div className="flex items-center justify-between text-xs text-brown-500 font-medium mb-1">
                <span>Embedded NEAR Identity</span>
                <span className="text-[10px] text-shield-emerald font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-shield-emerald"></span>
                  Active on Testnet
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-brown-900 font-mono">
                  {session.accountId}
                </span>
                <button
                  onClick={() => handleCopy(session.accountId)}
                  className="p-1 text-brown-500 hover:text-brown-800"
                  title="Copy account ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-shield-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-[10px] text-brown-400 font-mono truncate mt-1">
                Key: {session.publicKey}
              </div>
            </div>

            {/* Omnichain EVM Address (NEAR Chain Signatures) */}
            <div className="p-4 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0]">
              <div className="flex items-center justify-between text-xs text-[#166534] font-medium mb-1">
                <span className="flex items-center gap-1 font-bold">
                  <Globe className="w-3.5 h-3.5 text-[#16A34A]" />
                  Base / EVM Deposit Address
                </span>
                <span className="text-[10px] bg-[#DCFCE7] text-[#16A34A] px-2 py-0.5 rounded-full font-bold border border-[#BBF7D0]">
                  NEAR Chain Signatures
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-mono font-bold text-[#1E1315] truncate max-w-[280px]">
                  {derivedEvm.isLoading ? "Deriving MPC Address..." : (derivedEvm.checksumAddress || "0x2eed719b54cda655b0b6eee3aab5384b3d4650a3")}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyEvm(derivedEvm.checksumAddress || "")}
                    className="p-1 text-brown-500 hover:text-brown-800"
                    title="Copy EVM Address"
                  >
                    {copiedEvm ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {derivedEvm.checksumAddress && (
                    <a
                      href={`https://sepolia.basescan.org/address/${derivedEvm.checksumAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-brown-500 hover:text-brown-800"
                      title="View on BaseScan"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#166534]" />
                    </a>
                  )}
                </div>
              </div>

              {/* Multi-Chain Balance Breakdown */}
              <div className="mt-2.5 pt-2 border-t border-[#BBF7D0] flex items-center justify-between text-xs">
                <span className="text-[#166534] font-semibold">Base Sepolia Balances:</span>
                <div className="flex items-center gap-2 font-mono font-bold text-[#1E1315]">
                  <span className="bg-white/80 px-2 py-0.5 rounded-lg border border-[#BBF7D0] text-[11px]">
                    {evmBalance?.eth || "0.0000"} ETH
                  </span>
                  <span className="bg-white/80 px-2 py-0.5 rounded-lg border border-[#BBF7D0] text-[11px]">
                    ${evmBalance?.usdc || "0.00"} USDC
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[#15803D] mt-2 leading-relaxed">
                Derived deterministically via NEAR MPC signer <code>v1.signer-prod.testnet</code>. Controlled by your NEAR session key across Base, Arbitrum, and Ethereum without separate seed phrases.
              </p>
            </div>

            {/* Embedded Account Faucet */}
            <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-300">
              <div className="flex items-center justify-between text-xs font-bold text-amber-950 mb-1.5">
                <span className="flex items-center gap-1.5 text-amber-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Testnet Token Faucet
                </span>
                <span className="text-[10px] text-amber-700 font-mono font-bold">+0.25 NEAR</span>
              </div>
              <p className="text-[11px] text-amber-900/80 mb-2.5">
                Fund this session wallet with free testnet tokens to pay for social tips and storage.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleClaimModalFaucet(session.accountId)}
                  disabled={isClaimingFaucet}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isClaimingFaucet ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispensing...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="w-3.5 h-3.5" />
                      <span>Claim 0.25 NEAR</span>
                    </>
                  )}
                </button>
                <a
                  href="https://faucet.testnet.near.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-amber-100/50 border border-amber-300 text-amber-900 text-xs font-medium flex items-center gap-1 transition"
                >
                  <span>Official</span>
                  <ExternalLink className="w-3 h-3 text-amber-700" />
                </a>
              </div>
              {faucetSuccess && (
                <div className="mt-2 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{faucetSuccess}</span>
                </div>
              )}
              {faucetError && (
                <div className="mt-2 text-[11px] font-bold text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span>{faucetError}</span>
                </div>
              )}
            </div>

            {/* Spending Budget Controller */}
            <div className="p-4 rounded-2xl bg-white border border-butter-300 shadow-subtle">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brown-900">
                  Agent Spending Limit
                </span>
                <span className="text-xs font-extrabold text-brown-900 font-mono">
                  ${session.spentUsd.toFixed(2)} / ${session.spendingLimitUsd.toFixed(2)} USDC
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-butter-200 overflow-hidden mb-3">
                <div
                  className="h-full bg-shield-emerald transition-all duration-300"
                  style={{ width: `${percentUsed}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-brown-500 mb-3">
                <span>Remaining: <strong className="text-brown-900">${remainingBudget.toFixed(2)}</strong></span>
                <span>Gas cap: <strong className="text-brown-900">{session.gasAllowanceNear} NEAR</strong></span>
              </div>

              {/* Quick Limit Presets */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mb-3">
                {[10, 25, 50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleSetLimit(amt)}
                    className={`py-1.5 text-xs font-bold rounded-xl border transition ${
                      session.spendingLimitUsd === amt
                        ? "bg-brown-900 text-butter-100 border-brown-900 shadow-sm"
                        : "bg-butter-50 hover:bg-butter-100 text-brown-700 border-butter-300"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Custom Daily Limit Input */}
              <div className="pt-3 border-t border-butter-200">
                <div className="flex items-center justify-between text-[11px] font-bold text-brown-700 mb-1.5">
                  <span>Custom Limit</span>
                  <span className="text-[10px] text-brown-400 font-normal">Min $1 • Max $10,000</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brown-400">$</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      step="5"
                      value={customLimit || ""}
                      onChange={(e) => setCustomLimit(parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 75"
                      className="w-full pl-6 pr-3 py-1.5 rounded-xl border border-butter-300 bg-butter-50 text-xs font-bold text-brown-900 focus:outline-none focus:border-brown-900 focus:bg-white transition"
                    />
                  </div>
                  <button
                    onClick={() => handleSetLimit(customLimit)}
                    disabled={!customLimit || customLimit <= 0 || customLimit === session.spendingLimitUsd}
                    className="py-1.5 px-3.5 rounded-xl bg-brown-900 hover:bg-brown-800 disabled:opacity-40 disabled:hover:bg-brown-900 text-butter-100 text-xs font-bold transition shadow-sm"
                  >
                    Save Cap
                  </button>
                </div>
              </div>
            </div>

            {/* Cryptographic Guardrails Notice */}
            <div className="p-3 rounded-xl bg-butter-100 border border-butter-200 text-[11px] text-brown-600 leading-relaxed flex items-start gap-2">
              <Shield className="w-4 h-4 text-shield-emerald shrink-0 mt-0.5" />
              <span>
                <strong>Non-Custodial Scoping:</strong> This session key can ONLY call the VeilX
                Escrow contract. It is cryptographically prohibited from touching other dApps or
                spending past your set limit.
              </span>
            </div>

            {/* Export & Import to External Wallets */}
            <div className="p-3.5 rounded-2xl bg-butter-50 border border-butter-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brown-900">
                  <Key className="w-3.5 h-3.5 text-brown-700" />
                  <span>Import Wallet Key</span>
                </div>
                <button
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="text-[11px] text-brown-700 hover:text-brown-900 underline font-semibold transition"
                >
                  {showPrivateKey ? "Hide Key" : "Reveal Private Key"}
                </button>
              </div>

              {showPrivateKey ? (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <p className="text-[10px] text-brown-600 leading-relaxed">
                    This is your standard Ed25519 NEAR keypair. You can copy and import this key into <strong>Meteor Wallet</strong>, <strong>HERE Wallet</strong>, or <strong>Sender</strong> anytime to take full custody of your account and funds:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={session.secretKey}
                      className="w-full bg-white text-[11px] px-3 py-2 rounded-xl border border-butter-300 font-mono text-brown-900 focus:outline-none shadow-inner"
                    />
                    <button
                      onClick={() => handleCopy(session.secretKey)}
                      className="px-3 py-2 rounded-xl bg-brown-900 hover:bg-brown-800 text-butter-100 text-[11px] font-bold shrink-0 flex items-center gap-1 shadow-sm transition"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-brown-500">
                  You own your keys. Export anytime to use in Meteor, HERE, or Sender.
                </p>
              )}
            </div>

            {/* Revoke Button */}
            <button
              onClick={handleRevoke}
              className="w-full py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Revoke Session Authority
            </button>
          </div>
        )}

        {/* TAB 2: EXTERNAL WALLETS (FUNCTIONAL CONNECTORS) */}
        {activeTab === "external" && (
          <div className="space-y-4 py-1">
            {/* If an external wallet is connected */}
            {externalWallet ? (
              <div className="p-4 rounded-2xl bg-butter-50 border border-shield-emerald/40 space-y-3 shadow-subtle">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-shield-emerald animate-pulse"></span>
                    <span className="text-xs font-bold text-brown-900 capitalize">
                      {externalWallet.walletType === "custom"
                        ? "Linked NEAR Account"
                        : `${externalWallet.walletType} Wallet`}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-shield-emerald/15 text-shield-emerald border border-shield-emerald/30">
                    Connected
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-butter-200">
                  <div className="text-[11px] text-brown-500 font-medium mb-0.5">Account ID:</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-brown-900 font-mono">
                      {externalWallet.accountId}
                    </span>
                    <button
                      onClick={() => handleCopy(externalWallet.accountId)}
                      className="p-1 text-brown-500 hover:text-brown-800"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-shield-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="mt-2 pt-2 border-t border-butter-100 flex items-center justify-between text-xs">
                    <span className="text-brown-500">Live Testnet Balance:</span>
                    <span className="font-extrabold text-brown-900 font-mono">
                      {externalWallet.balanceNear || "0.0"} NEAR
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDisconnectExternal}
                    className="flex-1 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect Wallet
                  </button>
                  <button
                    onClick={() => {
                      if (externalWallet.accountId) {
                        verifyNearAccountOnChain(externalWallet.accountId).then((res) => {
                          if (res.balanceNear) {
                            setExternalWallet({ ...externalWallet, balanceNear: res.balanceNear });
                          }
                        });
                      }
                    }}
                    className="p-2 rounded-xl border border-butter-300 hover:bg-butter-100 text-brown-700 transition"
                    title="Refresh Balance"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* External Wallet Faucet Dispenser */}
                <div className="pt-2 border-t border-butter-200">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleClaimModalFaucet(externalWallet.accountId)}
                      disabled={isClaimingFaucet}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {isClaimingFaucet ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispensing 0.25 NEAR...</span>
                        </>
                      ) : (
                        <>
                          <Coins className="w-3.5 h-3.5" />
                          <span>Claim 0.25 Free Testnet NEAR</span>
                        </>
                      )}
                    </button>
                    <a
                      href="https://faucet.testnet.near.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-white hover:bg-butter-100 border border-butter-300 text-brown-700 text-xs font-semibold flex items-center gap-1 transition shrink-0"
                    >
                      <span>Official</span>
                      <ExternalLink className="w-3 h-3 text-brown-500" />
                    </a>
                  </div>
                  {faucetSuccess && (
                    <div className="mt-2 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{faucetSuccess}</span>
                    </div>
                  )}
                  {faucetError && (
                    <div className="mt-2 text-[11px] font-bold text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>{faucetError}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-brown-600 leading-relaxed">
                  Connect your existing named NEAR account (e.g. <code>alice.testnet</code>) to link your
                  on-chain balances with your 𝕏 social profile:
                </p>

                {connectionError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{connectionError}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  {/* Meteor Wallet */}
                  <div className="p-3 sm:p-3.5 rounded-2xl border border-butter-300 hover:border-brown-800 transition flex items-center justify-between bg-butter-50 hover:bg-white group">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-butter-300 flex items-center justify-center font-bold text-brown-900 shadow-subtle shrink-0">
                        M
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-brown-900 truncate">Meteor Wallet</div>
                        <div className="text-[10px] text-brown-500 truncate">Popular NEAR browser extension</div>
                      </div>
                    </div>
                    <button
                      onClick={handleConnectMeteor}
                      disabled={isConnecting !== null}
                      className="px-3.5 sm:px-4 py-1.5 rounded-full bg-brown-900 hover:bg-brown-800 text-butter-100 text-xs font-bold transition shadow-sm flex items-center gap-1 shrink-0"
                    >
                      {isConnecting === "meteor" ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <><span>Connect</span> <ArrowRight className="w-3 h-3" /></>
                      )}
                    </button>
                  </div>

                  {/* Sender Wallet */}
                  <div className="p-3 sm:p-3.5 rounded-2xl border border-butter-300 hover:border-brown-800 transition flex items-center justify-between bg-butter-50 hover:bg-white group">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-butter-300 flex items-center justify-center font-bold text-brown-900 shadow-subtle shrink-0">
                        S
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-brown-900 truncate">Sender Wallet</div>
                        <div className="text-[10px] text-brown-500 truncate">Mobile & Extension Web3 Wallet</div>
                      </div>
                    </div>
                    <button
                      onClick={handleConnectSender}
                      disabled={isConnecting !== null}
                      className="px-3.5 sm:px-4 py-1.5 rounded-full bg-brown-900 hover:bg-brown-800 text-butter-100 text-xs font-bold transition shadow-sm flex items-center gap-1 shrink-0"
                    >
                      {isConnecting === "sender" ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <><span>Connect</span> <ArrowRight className="w-3 h-3" /></>
                      )}
                    </button>
                  </div>

                  {/* Nightly Wallet */}
                  <div className="p-3 sm:p-3.5 rounded-2xl border border-butter-300 hover:border-brown-800 transition flex items-center justify-between bg-butter-50 hover:bg-white group">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-butter-300 flex items-center justify-center font-bold text-brown-900 shadow-subtle shrink-0">
                        N
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-brown-900 truncate">Nightly Wallet</div>
                        <div className="text-[10px] text-brown-500 truncate">Fast Multi-Chain NEAR Extension</div>
                      </div>
                    </div>
                    <button
                      onClick={handleConnectNightly}
                      className="px-3.5 sm:px-4 py-1.5 rounded-full bg-brown-900 hover:bg-brown-800 text-butter-100 text-xs font-bold transition shadow-sm flex items-center gap-1 shrink-0"
                    >
                      <span>Connect</span> <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Direct On-Chain Account Linking */}
                <div className="pt-3 border-t border-butter-200">
                  <div className="text-xs font-bold text-brown-900 mb-1.5">
                    Or Link Existing NEAR Account ID
                  </div>
                  <p className="text-[11px] text-brown-500 mb-2.5">
                    Already have a testnet account? Type your account ID to verify on-chain and link directly:
                  </p>

                  <form onSubmit={handleLinkManualAccount} className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="e.g. alice.testnet"
                        value={manualAccountId}
                        onChange={(e) => setManualAccountId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-butter-300 bg-white font-mono text-brown-900 focus:outline-none focus:border-brown-900 shadow-inner"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isVerifyingManual || !manualAccountId.trim()}
                      className="px-4 py-2 rounded-xl bg-brown-900 hover:bg-brown-800 text-butter-100 text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {isVerifyingManual ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-shield-emerald" />
                      )}
                      <span>Verify & Link</span>
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
