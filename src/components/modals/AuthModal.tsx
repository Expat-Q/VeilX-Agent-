"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  X,
  LogOut,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { user, isLoggedIn, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1E1315]/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF7F0] rounded-3xl border border-[#EBE3D5] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EBE3D5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1E1315] flex items-center justify-center text-[#FAF7F0] shadow-2xs">
              <Shield className="w-5 h-5 text-[#FAF7F0]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E1315]">
                {isLoggedIn ? "Account" : "Connect 𝕏"}
              </h3>
              <p className="text-[10px] text-[#6E5D4F]">Autonomous Finance with Veil on NEAR</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog"
            className="p-1.5 rounded-lg text-[#6E5D4F] hover:bg-[#FAF3E0] hover:text-[#1E1315] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoggedIn ? (
          /* Logged In View */
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-white border border-[#EBE3D5] space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E1315] text-[#FAF7F0] flex items-center justify-center shadow-2xs">
                    {/* Official Vector 𝕏 Logo */}
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#1E1315]">@{user?.xHandle}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-[#6E5D4F] font-mono mt-0.5">
                      {user?.nearAccountId}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="flex-1 h-11 rounded-2xl bg-[#FAF3E0] hover:bg-[#F0E6D0] border border-[#EBE3D5] text-[#1E1315] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-[#6E5D4F]" />
                <span>Log Out</span>
              </button>

              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-2xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Sign In with 𝕏 OAuth 2.0 (Clean & Unclustered) */
          <div className="space-y-5 text-center py-2">
            <div className="w-14 h-14 rounded-2xl bg-[#1E1315] text-[#FAF7F0] flex items-center justify-center mx-auto shadow-md">
              {/* Official Vector 𝕏 Logo */}
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-[#1E1315]">
                Connect with 𝕏
              </h4>
              <p className="text-xs text-[#6E5D4F] max-w-xs mx-auto leading-relaxed">
                Authenticate with Twitter OAuth to link your 𝕏 identity and initialize your non-custodial session.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] text-left space-y-1 text-xs shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-[#1E1315]">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Non-Custodial Account Abstraction</span>
              </div>
              <p className="text-[11px] text-[#6E5D4F]">
                Your session keys stay in your browser. Veil never has custody of your funds.
              </p>
            </div>

            <button
              onClick={() => {
                setIsSubmitting(true);
                const currentPath = typeof window !== "undefined" ? window.location.pathname : "/terminal";
                window.location.href = `/api/auth/twitter?returnTo=${encodeURIComponent(currentPath)}`;
              }}
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl bg-[#1E1315] hover:bg-[#2C1D20] disabled:opacity-50 text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-2.5 transition shadow-xs cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Continue with 𝕏</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
