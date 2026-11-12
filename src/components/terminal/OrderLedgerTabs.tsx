"use client";

import React, { useState } from "react";
import { AssetLogo } from "@/components/common/AssetLogo";
import { PortfolioPosition } from "@/lib/market-analyst";
import { TradingRule, OrderHistoryItem } from "@/lib/trading-copilot";
import {
  Briefcase,
  Layers,
  History,
  X,
  TrendingUp,
  TrendingDown,
  Repeat,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";

interface OrderLedgerTabsProps {
  positions: PortfolioPosition[];
  rules: TradingRule[];
  orderHistory: OrderHistoryItem[];
  onCancelRule: (ruleId: string) => void;
  onClosePosition: (symbol: string) => void;
  onSelectAssetForChart?: (symbol: string) => void;
  className?: string;
}

export function OrderLedgerTabs({
  positions,
  rules,
  orderHistory,
  onCancelRule,
  onClosePosition,
  onSelectAssetForChart,
  className = "",
}: OrderLedgerTabsProps) {
  const [activeTab, setActiveTab] = useState<"positions" | "rules" | "history">("positions");

  const activeRules = rules.filter((r) => r.status === "active");

  return (
    <div
      className={`bg-white border border-[#EBE3D5] rounded-3xl p-3.5 sm:p-4 shadow-2xs space-y-3 ${className}`}
    >
      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-[#F4EFE6] pb-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Positions Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("positions")}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition shrink-0 whitespace-nowrap cursor-pointer ${
              activeTab === "positions"
                ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                : "text-[#7A6A5E] hover:bg-[#FAF7F0] hover:text-[#1E1315]"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Holdings</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "positions"
                  ? "bg-[#332225] text-amber-300"
                  : "bg-[#F0EBE1] text-[#7A6A5E]"
              }`}
            >
              {positions.length}
            </span>
          </button>

          {/* Active Rules Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition shrink-0 whitespace-nowrap cursor-pointer ${
              activeTab === "rules"
                ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                : "text-[#7A6A5E] hover:bg-[#FAF7F0] hover:text-[#1E1315]"
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>
              <span className="inline sm:hidden">Rules</span>
              <span className="hidden sm:inline">Active Rules</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "rules"
                  ? "bg-[#332225] text-emerald-300"
                  : "bg-[#F0EBE1] text-[#7A6A5E]"
              }`}
            >
              {activeRules.length}
            </span>
          </button>

          {/* History Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition shrink-0 whitespace-nowrap cursor-pointer ${
              activeTab === "history"
                ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                : "text-[#7A6A5E] hover:bg-[#FAF7F0] hover:text-[#1E1315]"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>
              <span className="inline sm:hidden">History</span>
              <span className="hidden sm:inline">Order History</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "history"
                  ? "bg-[#332225] text-sky-300"
                  : "bg-[#F0EBE1] text-[#7A6A5E]"
              }`}
            >
              {orderHistory.length}
            </span>
          </button>
        </div>

        <span className="hidden sm:inline text-[11px] font-mono text-[#6E5D4F]">
          {activeTab === "positions"
            ? "Live PnL & Positions"
            : activeTab === "rules"
            ? "Autonomous Trigger Radar"
            : "Execution Ledger"}
        </span>
      </div>

      {/* Tab 1: Holdings & Positions */}
      {activeTab === "positions" && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {positions.length === 0 ? (
            <div className="text-center py-8 text-[#6E5D4F] space-y-1">
              <Layers className="w-6 h-6 mx-auto opacity-40" />
              <div className="text-xs font-medium">No open positions in portfolio</div>
              <div className="text-[11px] text-[#A8988B]">
                Tell the copilot e.g. &ldquo;Buy $100 TSLA&rdquo; or create a DCA rule above.
              </div>
            </div>
          ) : (
            positions.map((pos) => {
              const isProfit = pos.pnlUsd >= 0;
              return (
                <div
                  key={pos.symbol}
                  className="p-2.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-between gap-3 hover:border-[#1E1315] transition cursor-pointer"
                  onClick={() => onSelectAssetForChart?.(pos.symbol)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AssetLogo symbol={pos.symbol} className="w-8 h-8 rounded-full shadow-2xs shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#1E1315]">
                        <span>{pos.symbol}</span>
                        <span className="text-[11px] font-normal text-[#7A6A5E] truncate">
                          {pos.shares} shares
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[#6E5D4F]">
                        Entry: ${pos.avgEntryPrice.toFixed(2)} → Now: ${pos.currentPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-right shrink-0">
                    <div>
                      <div className="text-xs font-bold text-[#1E1315]">
                        ${pos.currentValueUsd.toFixed(2)}
                      </div>
                      <div
                        className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${
                          isProfit ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {isProfit ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>
                          {isProfit ? "+" : ""}${pos.pnlUsd.toFixed(2)} ({isProfit ? "+" : ""}
                          {pos.pnlPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClosePosition(pos.symbol);
                      }}
                      title="Sell position to cash"
                      className="px-2 py-1 rounded-lg bg-white border border-[#EBE3D5] text-[10px] font-bold text-[#7A6A5E] hover:text-rose-700 hover:border-rose-300 transition"
                    >
                      Sell
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Active Rules & DCA Schedules */}
      {activeTab === "rules" && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {activeRules.length === 0 ? (
            <div className="text-center py-8 text-[#6E5D4F] space-y-1">
              <Repeat className="w-6 h-6 mx-auto opacity-40" />
              <div className="text-xs font-medium">No active automated rules</div>
              <div className="text-[11px] text-[#A8988B]">
                Say &ldquo;DCA $50 into TSLA daily&rdquo; or &ldquo;Buy $100 NVDA on 5% dip&rdquo;.
              </div>
            </div>
          ) : (
            activeRules.map((rule) => {
              const isDca = rule.type === "recurring_buy";
              return (
                <div
                  key={rule.id}
                  className="p-2.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AssetLogo symbol={rule.symbol} className="w-8 h-8 rounded-full shadow-2xs shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#1E1315]">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                            isDca
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : rule.type === "buy_dip"
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : "bg-sky-100 text-sky-900 border border-sky-200"
                          }`}
                        >
                          {isDca ? `DCA (${rule.cadence || "daily"})` : rule.type.replace("_", " ")}
                        </span>
                        <span>{rule.symbol}</span>
                      </div>
                      <div className="text-[11px] text-[#5A4B42] truncate font-medium">
                        {rule.condition}
                      </div>
                      <div className="text-[10px] font-mono text-[#6E5D4F]">
                        {isDca
                          ? `Executions: ${rule.executionsCount || 0} run${
                              (rule.executionsCount || 0) === 1 ? "" : "s"
                            }`
                          : rule.triggerPrice
                          ? `Target: $${rule.triggerPrice.toFixed(2)}`
                          : "Monitoring..."}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="text-xs font-bold text-[#1E1315]">
                      ${rule.amountUsd.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCancelRule(rule.id)}
                      title="Cancel active rule"
                      className="p-1.5 rounded-lg bg-white border border-[#EBE3D5] text-[#6E5D4F] hover:text-rose-700 hover:border-rose-300 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 3: Order History Ledger */}
      {activeTab === "history" && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {orderHistory.length === 0 ? (
            <div className="text-center py-8 text-[#6E5D4F] space-y-1">
              <History className="w-6 h-6 mx-auto opacity-40" />
              <div className="text-xs font-medium">No order history recorded yet</div>
              <div className="text-[11px] text-[#A8988B]">
                Orders executed in Paper Sandbox or Mainnet will appear here with full execution receipts.
              </div>
            </div>
          ) : (
            orderHistory.map((ord) => {
              const isBuy = ord.side === "buy";
              return (
                <div
                  key={ord.id}
                  className="p-2 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isBuy ? (
                      <span className="p-1 rounded-md bg-emerald-100 text-emerald-800">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="p-1 rounded-md bg-rose-100 text-rose-800">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <AssetLogo symbol={ord.symbol} className="w-5 h-5 rounded-full shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-[#1E1315]">{ord.symbol}</span>
                      <span className="text-[10px] text-[#7A6A5E] ml-1.5">
                        {ord.shares} @ ${ord.price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        ord.mode === "mainnet"
                          ? "bg-purple-100 text-purple-900 border border-purple-200"
                          : "bg-amber-100 text-amber-900 border border-amber-200"
                      }`}
                    >
                      {ord.mode === "mainnet" ? "MPC Mainnet" : "Paper Sandbox"}
                    </span>
                    <span className="font-bold text-[#1E1315]">${ord.amountUsd.toFixed(2)}</span>
                    <span className="text-[9px] text-emerald-700 font-bold">Filled</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
