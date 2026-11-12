"use client";

import React, { useEffect, useCallback } from "react";
import {
  ShieldCheck,
  KeyRound,
  Bot,
  Zap,
  ArrowRight,
  X,
  Sliders,
} from "lucide-react";

interface SessionOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  xHandle?: string;
  nearAccountId?: string;
}

export function SessionOnboardingModal({
  isOpen,
  onClose,
  xHandle,
  nearAccountId,
}: SessionOnboardingModalProps) {
  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem("veilx_onboarded", "true");
    } catch {
      // ignore local storage errors
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleDismiss]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brown-950/40 backdrop-blur-sm animate-in fade-in"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-lg bg-white border border-butter-300 rounded-[2rem] p-6 sm:p-7 shadow-elevated space-y-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-butter-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-butter-200 border border-butter-300 flex items-center justify-center text-brown-900 font-black text-xs shadow-inner">
              V
            </div>
            <div>
              <h3 className="text-sm font-bold text-brown-900">Welcome to Veil</h3>
              <p className="text-[11px] text-brown-500">Autonomous social finance on NEAR Protocol</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-xl text-brown-400 hover:text-brown-700 hover:bg-butter-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Concept Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-butter-100 to-amber-50 border border-butter-200 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brown-900">
              @{xHandle || "User"} • Non-Custodial Architecture
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              NEP-366 Active
            </span>
          </div>
          <p className="text-xs text-brown-600 leading-relaxed">
            Your personal on-chain account <code className="font-bold text-brown-900 bg-white/60 px-1 py-0.5 rounded">{nearAccountId || "yourname.veilx-agent.testnet"}</code> is ready. Here is how your AI copilot operates safely:
          </p>
        </div>

        {/* Feature Grid */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-2xl border border-butter-200 bg-butter-50/40">
            <div className="w-7 h-7 rounded-xl bg-white border border-butter-200 flex items-center justify-center text-brown-700 shrink-0 mt-0.5 shadow-sm">
              <KeyRound className="w-4 h-4 text-amber-600" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-brown-900 block">
                Delegated Session Key (Client-Side)
              </span>
              <p className="text-[11px] text-brown-600 leading-relaxed">
                An Ed25519 key generated inside your browser signs transactions. Your private key is never stored on a centralized server.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl border border-butter-200 bg-butter-50/40">
            <div className="w-7 h-7 rounded-xl bg-white border border-butter-200 flex items-center justify-center text-brown-700 shrink-0 mt-0.5 shadow-sm">
              <Sliders className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-brown-900 block">
                $50.00 / Day Spending Guardrail
              </span>
              <p className="text-[11px] text-brown-600 leading-relaxed">
                Your agent can only execute transactions up to your daily allowance. Any tip exceeding the limit requires your explicit approval.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl border border-butter-200 bg-butter-50/40">
            <div className="w-7 h-7 rounded-xl bg-white border border-butter-200 flex items-center justify-center text-brown-700 shrink-0 mt-0.5 shadow-sm">
              <Zap className="w-4 h-4 text-purple-600" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-brown-900 block">
                Chain Signatures & Omnichain Invoices
              </span>
              <p className="text-[11px] text-brown-600 leading-relaxed">
                Receive payments from Base (EVM), Solana, or NEAR. Solvers and MPC settle funds into your single NEAR wallet automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full h-11 rounded-2xl bg-brown-900 hover:bg-brown-800 text-butter-100 text-xs font-bold flex items-center justify-center gap-2 transition shadow-subtle"
          >
            <span>Got It — Start Exploring</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
