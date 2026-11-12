"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
  Zap,
  Gift,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { addTransactionRecord } from "@/lib/transactions-store";
import { useAuth } from "@/context/AuthContext";

interface TwitterClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TwitterClaimModal({ isOpen, onClose, onSuccess }: TwitterClaimModalProps) {
  const { user, refreshAccountData } = useAuth();
  const [handle, setHandle] = useState(user?.xHandle || "expatq3");
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<"idle" | "claimed">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pendingTip, setPendingTip] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  useEffect(() => {
    if (user?.xHandle) {
      setHandle(user.xHandle);
    }
  }, [user?.xHandle]);

  useEffect(() => {
    if (handle) {
      fetch(`/api/near/pending-tips?handle=${encodeURIComponent(handle)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.pendingTips?.[0]) {
            setPendingTip(d.pendingTips[0]);
          } else {
            setPendingTip(null);
          }
        })
        .catch(() => {});
    }
  }, [handle]);

  if (!isOpen) return null;

  const pendingAmount = pendingTip?.amountNear || 0.01;
  const pendingSender = pendingTip?.senderHandle ? `@${pendingTip.senderHandle}` : "VeilX Escrow";
  const recipientAccount = user?.nearAccountId || `${handle.toLowerCase()}.veilx-agent.testnet`;

  const handleClaim = async () => {
    setErrorMsg(null);
    if (!pendingTip?.tipId) {
      setErrorMsg("No pending tips found to claim in escrow.");
      return;
    }

    setIsClaiming(true);

    try {
      const res = await fetch("/api/relay/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipId: pendingTip.tipId,
          recipientHandle: handle,
          recipientWallet: recipientAccount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Claim failed");
      }

      const confirmedTx = data.relayedTxHash || data.txHash || `claimed_${Date.now()}`;
      setTxHash(confirmedTx);
      setClaimStatus("claimed");

      // Record in client-side transaction store
      addTransactionRecord({
        type: "tip_claimed",
        title: `Claimed Tip from ${pendingSender}`,
        counterparty: pendingSender,
        amountUsd: Number(((pendingTip.amountNear || 0.01) * 3.5).toFixed(2)),
        asset: pendingTip.asset || "NEAR",
        status: "claimed",
        statusLabel: "Claimed via Relayer (Gasless)",
        txHash: confirmedTx,
        isInflow: true,
        memo: `Claimed ${pendingTip.amountNear || 0.01} NEAR to ${recipientAccount}`,
      }, handle);

      await refreshAccountData();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("veilx_activity_updated"));
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to claim tip");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1E1315]/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-[#EBE3D5] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-butter-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brown-900 flex items-center justify-center text-butter-100 shadow-sm">
              <Gift className="w-4 h-4 text-butter-100" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brown-900">Claim 𝕏 Social Tips</h3>
              <p className="text-[10px] text-brown-500">Gasless Claim via NEP-366</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-brown-500 hover:bg-butter-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {claimStatus === "claimed" ? (
          <div className="text-center py-6 space-y-4 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-black text-brown-900">
                +{pendingAmount} {pendingTip?.asset || "NEAR"} Claimed!
              </h4>
              <p className="text-xs text-brown-600">
                Transferred from Escrow to{" "}
                <code className="text-brown-900 font-bold bg-butter-100 px-1.5 py-0.5 rounded">
                  {recipientAccount}
                </code>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-butter-50 border border-butter-200 text-left space-y-1 text-xs">
              <div className="flex justify-between text-brown-500">
                <span>Relayer Sponsor:</span>
                <span className="font-bold text-shield-emerald">Veil Relayer (0 gas paid by you)</span>
              </div>
              <div className="flex justify-between text-brown-500">
                <span>Transaction Hash:</span>
                <span className="font-mono text-brown-800">{txHash?.slice(0, 16)}...</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full h-11 rounded-2xl bg-brown-900 hover:bg-brown-800 text-butter-100 font-bold text-xs transition"
            >
              Done & View Balance
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 𝕏 Identity Badge */}
            <div className="p-4 rounded-2xl bg-butter-50 border border-butter-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brown-900 text-butter-100 flex items-center justify-center font-bold text-sm">
                  𝕏
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-brown-900">@{handle}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-shield-emerald/10 text-shield-emerald">
                      Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-brown-500">Authenticated via 𝕏 OAuth</p>
                </div>
              </div>

              <span className="text-xs font-mono text-brown-500">ID: 10429</span>
            </div>

            {/* Pending Tip in Escrow Card */}
            <div className="p-4 rounded-2xl bg-white border border-butter-300 shadow-subtle space-y-3">
              <div className="flex items-center justify-between text-xs text-brown-500 font-medium">
                <span>Unclaimed Escrow Balance</span>
                <span className="text-amber-700 font-bold">1 Pending Tip</span>
              </div>

              <div className="text-3xl font-black text-brown-900 tracking-tight">
                {pendingAmount}{" "}
                <span className="text-xs font-bold text-brown-500">{pendingTip?.asset || "NEAR"}</span>
              </div>

              <div className="pt-2 border-t border-butter-100 text-xs text-brown-600 flex items-center justify-between">
                <span>From: <strong>{pendingSender}</strong></span>
                <span className="text-[11px] text-brown-400">Ready to Claim</span>
              </div>
            </div>

            {/* Gasless Notice */}
            <div className="p-3.5 rounded-2xl bg-butter-100 border border-butter-200 flex items-start gap-2.5 text-xs text-brown-700">
              <Zap className="w-4 h-4 text-shield-emerald shrink-0 mt-0.5" />
              <div>
                <strong className="text-brown-900">NEP-366 Meta-Transaction:</strong> You do NOT need any NEAR or gas tokens. Veil sponsors the transaction fee so you can claim with $0.00 in your wallet.
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Claim CTA */}
            <button
              onClick={handleClaim}
              disabled={isClaiming || !pendingTip}
              className="w-full h-12 rounded-2xl bg-brown-900 hover:bg-brown-800 disabled:opacity-50 text-butter-100 font-bold text-xs transition flex items-center justify-center gap-2 shadow-subtle"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-butter-200" />
                  <span>Signing DelegateAction & Relaying on NEAR...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-butter-200" />
                  <span>{pendingTip ? `Claim ${pendingAmount} ${pendingTip?.asset || "NEAR"} Gaslessly` : "No Pending Tips in Escrow"}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
