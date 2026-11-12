"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Shield,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getStoredAgentSession, saveAgentSession } from "@/lib/near-embedded-wallet";

interface WalletSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletSettingsModal({ isOpen, onClose }: WalletSettingsModalProps) {
  const {
    user,
    evmBalance,
    refreshAccountData,
    logout,
  } = useAuth();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showNearKey, setShowNearKey] = useState(false);
  const [importKeyInput, setImportKeyInput] = useState("");
  const [importMsg, setImportMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"keys" | "import" | "mpc">("keys");

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

  if (!isOpen) return null;

  const session = getStoredAgentSession(user?.xHandle);
  const secretKey = session?.secretKey || "No private key stored";

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleImportWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportMsg(null);
    const key = importKeyInput.trim();
    if (!key) return;

    // Check if NEAR ed25519 key
    if (key.startsWith("ed25519:")) {
      try {
        if (user?.xHandle) {
          saveAgentSession(
            {
              accountId: user.nearAccountId || `${user.xHandle}.veilx-agent.testnet`,
              publicKey: session?.publicKey || "ed25519:imported",
              secretKey: key,
              spendingLimitUsd: session?.spendingLimitUsd || 50,
              spentUsd: session?.spentUsd || 0,
              gasAllowanceNear: session?.gasAllowanceNear || 0.25,
              isActive: true,
              isExternalConnected: true,
              externalWalletType: "imported",
              perTxLimitUsd: session?.perTxLimitUsd || 15,
              dailyLimitUsd: session?.dailyLimitUsd || session?.spendingLimitUsd || 50,
              weeklyLimitUsd: session?.weeklyLimitUsd || 200,
              weeklySpentUsd: session?.weeklySpentUsd || 0,
            },
            user.xHandle
          );
          setImportMsg({
            type: "success",
            text: "✓ Successfully imported NEAR ed25519 private key. Session updated.",
          });
          setImportKeyInput("");
          await refreshAccountData();
          return;
        }
      } catch (err: any) {
        setImportMsg({ type: "error", text: err.message || "Invalid NEAR key" });
        return;
      }
    }

    // Check if EVM private key
    if (key.startsWith("0x") && key.length === 66) {
      try {
        localStorage.setItem("veilx_custom_evm_key", key);
        setImportMsg({
          type: "success",
          text: "✓ Successfully imported EVM private key for Base & Ethereum signing.",
        });
        setImportKeyInput("");
        await refreshAccountData();
        return;
      } catch (err: any) {
        setImportMsg({ type: "error", text: err.message || "Invalid EVM key" });
        return;
      }
    }

    setImportMsg({
      type: "error",
      text: "Unrecognized format. Please provide an ed25519:... NEAR key or a 66-character 0x... EVM private key.",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1315]/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-[#EBE3D5] rounded-3xl p-6 shadow-xl space-y-5 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F2EBDC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-center text-[#1E1315]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E1315]">Wallet &amp; Security Settings</h3>
              <p className="text-[11px] text-[#7A6A5E]">Non-custodial cryptographic keys &amp; MPC signatures</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7A6A5E] hover:text-[#1E1315] hover:bg-[#FAF7F0] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs transition ${
              activeTab === "keys" ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs" : "text-[#7A6A5E] hover:text-[#1E1315]"
            }`}
          >
            Export Keys
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mpc")}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs transition ${
              activeTab === "mpc" ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs" : "text-[#7A6A5E] hover:text-[#1E1315]"
            }`}
          >
            Universal EVM (MPC)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs transition ${
              activeTab === "import" ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs" : "text-[#7A6A5E] hover:text-[#1E1315]"
            }`}
          >
            Import Wallet
          </button>
        </div>

        {/* TAB 1: EXPORT KEYS */}
        {activeTab === "keys" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A6A5E]">
                NEAR Protocol Account
              </span>
              <div className="p-3 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] text-[#7A6A5E] font-mono">Account ID</div>
                  <div className="text-xs font-mono font-bold text-[#1E1315] break-all">
                    {user?.nearAccountId || "Not connected"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(user?.nearAccountId || "", "near")}
                  className="p-2 rounded-lg bg-white border border-[#EBE3D5] hover:bg-[#FAF7F0] text-[#1E1315] text-xs transition cursor-pointer shrink-0"
                  title="Copy Account ID"
                >
                  {copiedKey === "near" ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A6A5E]">
                  Active NEAR Signing Key (ed25519)
                </span>
                <button
                  type="button"
                  onClick={() => setShowNearKey(!showNearKey)}
                  className="text-[11px] font-mono text-[#1E1315] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {showNearKey ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Hide Key</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Reveal Key</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-2">
                <div className="font-mono text-xs text-[#1E1315] break-all select-all">
                  {showNearKey ? secretKey : "ed25519:••••••••••••••••••••••••••••••••••••••••••••••••"}
                </div>
                {showNearKey && (
                  <div className="flex justify-end pt-1 border-t border-[#EBE3D5]">
                    <button
                      type="button"
                      onClick={() => handleCopy(secretKey, "secret")}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#EBE3D5] hover:bg-[#FAF7F0] text-[#1E1315] text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedKey === "secret" ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Full Private Key</span>
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#7A6A5E] leading-relaxed">
                This ed25519 key signs transactions on NEAR Protocol directly from your browser without third-party custodians.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: UNIVERSAL EVM ARCHITECTURE */}
        {activeTab === "mpc" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A6A5E]">
                Derived Universal EVM Address
              </span>
              <div className="p-3 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] text-[#7A6A5E] font-mono">Base &amp; Ethereum (EVM)</div>
                  <div className="text-xs font-mono font-bold text-[#1E1315] break-all">
                    {evmBalance?.address || "Deriving address via NEAR MPC..."}
                  </div>
                </div>
                {evmBalance?.address && (
                  <button
                    type="button"
                    onClick={() => handleCopy(evmBalance.address, "evm")}
                    className="p-2 rounded-lg bg-white border border-[#EBE3D5] hover:bg-[#FAF7F0] text-[#1E1315] text-xs transition cursor-pointer shrink-0"
                    title="Copy EVM Address"
                  >
                    {copiedKey === "evm" ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1315]">
                <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>How is the EVM Wallet Secured?</span>
              </div>
              <p className="text-[11px] text-[#7A6A5E] leading-relaxed">
                Your Universal EVM address has <strong>no static local private key</strong>. It is secured by <strong>NEAR MPC Chain Signatures (<code className="font-mono text-[#1E1315]">v1.signer-prod.testnet</code>)</strong>.
              </p>
              <div className="text-[10px] font-mono text-[#7A6A5E] pt-1 border-t border-[#EBE3D5] space-y-0.5">
                <div>Derivation Path: <span className="text-[#1E1315] font-semibold">m/44&apos;/60&apos;/0&apos;/0/0</span></div>
                <div>Authorized Controller: <span className="text-[#1E1315] font-semibold">{user?.nearAccountId}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: IMPORT EXTERNAL WALLET */}
        {activeTab === "import" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A6A5E]">
                Import External Key
              </span>
              <form onSubmit={handleImportWallet} className="space-y-3">
                <input
                  type="password"
                  placeholder="Paste ed25519:... (NEAR) or 0x... (EVM)"
                  value={importKeyInput}
                  onChange={(e) => setImportKeyInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#EBE3D5] bg-white font-mono text-xs text-[#1E1315] placeholder:text-[#A8988B] focus:outline-none focus:border-[#1E1315]"
                />
                <button
                  type="submit"
                  disabled={!importKeyInput.trim()}
                  className="w-full h-10 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] disabled:opacity-50 text-[#FAF7F0] text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  Import Key &amp; Update Signer
                </button>
              </form>
              {importMsg && (
                <div className={`p-2.5 rounded-xl border text-xs font-mono ${importMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                  {importMsg.text}
                </div>
              )}
            </div>
            <p className="text-[11px] text-[#7A6A5E] leading-relaxed">
              Importing an external key allows you to execute transactions from your own pre-existing wallet across NEAR or EVM networks.
            </p>
          </div>
        )}

        {/* Footer: Disconnect */}
        <div className="pt-3 border-t border-[#F2EBDC] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              logout();
              onClose();
            }}
            className="text-xs text-rose-700 hover:text-rose-900 font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect Session</span>
          </button>
          <span className="text-[10px] font-mono text-[#8C7A6B]">Veil Security Engine</span>
        </div>
      </div>
    </div>
  );
}
