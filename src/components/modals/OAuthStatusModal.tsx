"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, X, ArrowRight, RefreshCw, Shield, Sparkles } from "lucide-react";

interface OAuthStatusModalProps {
  onRetryLogin?: () => void;
}

export function OAuthStatusModal({ onRetryLogin }: OAuthStatusModalProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const params = new URLSearchParams(window.location.search);
      const isConnected = params.get("connected") === "true";
      const isNew = params.get("is_new") === "true";
      const errorParam = params.get("error");
      const reasonParam = params.get("reason");
      const handleParam = params.get("handle");

      if (isConnected) {
        setStatus("success");
        setIsNewUser(isNew);
        setHandle(handleParam || null);
        // Clean up URL query parameters without full reload
        window.history.replaceState({}, "", window.location.pathname);
      } else if (errorParam) {
        setStatus("error");
        setErrorMessage(reasonParam ? decodeURIComponent(reasonParam) : "Authentication could not be completed.");
        // Clean up URL query parameters without full reload
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      // Ignored
    }
  }, []);

  if (!status) return null;

  const handleClose = () => {
    setStatus(null);
  };

  const handleRetry = () => {
    setStatus(null);
    if (onRetryLogin) {
      onRetryLogin();
    }
  };

  const handleStartOnboarding = () => {
    handleClose();
    router.push("/onboarding");
  };

  const handleLaunchTerminal = () => {
    handleClose();
    router.push("/terminal");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1E1315]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="bg-[#FAF7F0] rounded-3xl border border-[#EBE3D5] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-5 right-5 p-1.5 rounded-xl text-[#6E5D4F] hover:bg-[#FAF3E0] hover:text-[#1E1315] transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {status === "success" ? (
          /* Success View */
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              {isNewUser ? <Sparkles className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#1E1315]">
                {isNewUser ? "Account Connected!" : `Welcome back, @${handle || "trader"}!`}
              </h3>
              <p className="text-xs text-[#6E5D4F] max-w-xs mx-auto leading-relaxed">
                {isNewUser
                  ? "Welcome to Veil. Let's set up your portfolio & trading preferences."
                  : "Your session keys are active and synced. Ready to execute algorithmic trades and cross-chain orders."}
              </p>
            </div>

            {handle && (
              <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#1E1315] text-[#FAF7F0] flex items-center justify-center text-[10px] font-bold">
                    𝕏
                  </div>
                  <span className="font-bold text-[#1E1315]">@{handle}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Ready
                </span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left flex items-start gap-2.5 text-[11px] text-amber-900">
              <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>Session keys remain protected in your browser. All transactions require your explicit approval or pre-set guardrails.</span>
            </div>

            {isNewUser ? (
              <button
                onClick={handleStartOnboarding}
                className="w-full h-11 rounded-2xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <span>Start Onboarding →</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleLaunchTerminal}
                className="w-full h-11 rounded-2xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <span>Launch Terminal →</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          /* Error View */
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#1E1315]">
                Connection Failed
              </h3>
              <p className="text-xs text-[#6E5D4F] max-w-xs mx-auto leading-relaxed">
                We couldn&apos;t complete the authorization with Twitter.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-left space-y-1 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Error Details</span>
                <p className="text-xs font-mono text-rose-900 break-all leading-snug">
                  {errorMessage}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleClose}
                className="flex-1 h-11 rounded-2xl bg-[#FAF3E0] hover:bg-[#F0E6D0] border border-[#EBE3D5] text-[#1E1315] text-xs font-bold transition cursor-pointer"
              >
                Dismiss
              </button>

              <button
                onClick={handleRetry}
                className="flex-1 h-11 rounded-2xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
