"use client";

import React, { useState, useEffect } from "react";
import { X, Sliders, Check, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getStoredAgentSession, updateBudgetTiers } from "@/lib/near-embedded-wallet";

interface SpendingCapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SpendingCapModal({ isOpen, onClose }: SpendingCapModalProps) {
  const { user, spendingLimitUsd, spentUsd, updateSpendingLimit } = useAuth();
  
  const [perTxInput, setPerTxInput] = useState("15");
  const [dailyInput, setDailyInput] = useState("50");
  const [weeklyInput, setWeeklyInput] = useState("200");
  const [weeklySpent, setWeeklySpent] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    const session = getStoredAgentSession(user?.xHandle);
    if (session) {
      setPerTxInput((session.perTxLimitUsd ?? 15).toString());
      setDailyInput((session.dailyLimitUsd ?? session.spendingLimitUsd ?? 50).toString());
      setWeeklyInput((session.weeklyLimitUsd ?? 200).toString());
      setWeeklySpent(session.weeklySpentUsd ?? session.spentUsd ?? 0);
    } else {
      setDailyInput(spendingLimitUsd.toString());
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, user?.xHandle, spendingLimitUsd]);

  if (!isOpen) return null;

  const handleSave = () => {
    const perTx = parseFloat(perTxInput);
    const daily = parseFloat(dailyInput);
    const weekly = parseFloat(weeklyInput);

    if (!isNaN(daily) && daily >= 0) {
      updateSpendingLimit(daily);
      updateBudgetTiers(
        {
          perTx: !isNaN(perTx) ? perTx : 15,
          daily: daily,
          weekly: !isNaN(weekly) ? weekly : 200,
        },
        user?.xHandle
      );
      if (user?.xHandle && user?.nearAccountId) {
        fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            xHandle: user.xHandle,
            nearAccountId: user.nearAccountId,
            spendingLimitUsd: daily,
          }),
        }).catch(() => {});
        fetch("/api/user/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handle: user.xHandle,
            dailyLimitUsd: daily,
            weeklyLimitUsd: !isNaN(weekly) ? weekly : 200,
            perTxLimitUsd: !isNaN(perTx) ? perTx : 15,
          }),
        }).catch(() => {});
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 700);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1315]/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white border border-[#EBE3D5] rounded-3xl p-6 shadow-xl space-y-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F2EBDC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-center text-[#1E1315]">
              <Sliders className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E1315]">3-Tier Budget System</h3>
              <p className="text-[11px] text-[#7A6A5E]">Granular non-custodial agent guardrails</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7A6A5E] hover:text-[#1E1315] hover:bg-[#FAF7F0] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Usage Card */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5]">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#7A6A5E]">Daily Outflow</div>
            <div className="font-mono text-base font-bold text-[#1E1315]">
              ${spentUsd.toFixed(2)} <span className="text-xs font-normal text-[#8C7A6B]">/ ${spendingLimitUsd.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#7A6A5E]">Weekly Outflow</div>
            <div className="font-mono text-base font-bold text-emerald-800">
              ${weeklySpent.toFixed(2)} <span className="text-xs font-normal text-[#8C7A6B]">/ ${parseFloat(weeklyInput || "200").toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Tier 1: Max Per-Transaction Limit */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#1E1315]">
              1. Max Per-Transaction Limit
            </label>
            <span className="text-[10px] font-mono text-[#8C7A6B]">Default: $15.00</span>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-xs text-[#7A6A5E] font-mono">$</span>
            <input
              type="number"
              step="1"
              min="1"
              value={perTxInput}
              onChange={(e) => setPerTxInput(e.target.value)}
              className="w-full h-10 pl-8 pr-3 rounded-xl border border-[#EBE3D5] bg-white font-mono text-xs text-[#1E1315] focus:outline-none focus:border-[#1E1315]"
              placeholder="15.00"
            />
          </div>
          <p className="text-[10px] text-[#7A6A5E]">
            Limits the maximum amount the agent can send in a single tip or micro-trade without confirmation.
          </p>
        </div>

        {/* Tier 2: Daily Outflow Budget */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#1E1315]">
              2. Daily Outflow Budget
            </label>
            <span className="text-[10px] font-mono text-[#8C7A6B]">Default: $50.00</span>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-xs text-[#7A6A5E] font-mono">$</span>
            <input
              type="number"
              step="5"
              min="5"
              value={dailyInput}
              onChange={(e) => setDailyInput(e.target.value)}
              className="w-full h-10 pl-8 pr-3 rounded-xl border border-[#EBE3D5] bg-white font-mono text-xs text-[#1E1315] focus:outline-none focus:border-[#1E1315]"
              placeholder="50.00"
            />
          </div>
          <p className="text-[10px] text-[#7A6A5E]">
            Resets every 24 hours. Prevents aggregate daily drain across all agent activities.
          </p>
        </div>

        {/* Tier 3: Weekly Trading Ceiling */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#1E1315]">
              3. Weekly Trading &amp; Transfer Ceiling
            </label>
            <span className="text-[10px] font-mono text-[#8C7A6B]">Default: $200.00</span>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-xs text-[#7A6A5E] font-mono">$</span>
            <input
              type="number"
              step="10"
              min="10"
              value={weeklyInput}
              onChange={(e) => setWeeklyInput(e.target.value)}
              className="w-full h-10 pl-8 pr-3 rounded-xl border border-[#EBE3D5] bg-white font-mono text-xs text-[#1E1315] focus:outline-none focus:border-[#1E1315]"
              placeholder="200.00"
            />
          </div>
          <p className="text-[10px] text-[#7A6A5E]">
            Hard circuit breaker over a 7-day rolling window for all autonomous actions.
          </p>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full h-10 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Budget Tiers Updated</span>
            </>
          ) : (
            <span>Save 3-Tier Budget</span>
          )}
        </button>
      </div>
    </div>
  );
}
