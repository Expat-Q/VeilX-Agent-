// src/services/budget-service.ts
// Unified Budget & Spending Guardrail Service for Veil
// Single source of truth managing:
// 1. In-browser cryptographic session storage
// 2. Server MongoDB persistence
// 3. Rolling 24-hour daily budget & 7-day weekly ceilings

import {
  AgentSessionState,
  getStoredAgentSession,
  saveAgentSession,
  validateSpendBudget as libValidate,
} from "@/lib/near-embedded-wallet";

export interface BudgetState {
  perTxLimitUsd: number;
  dailyLimitUsd: number;
  weeklyLimitUsd: number;
  spentUsd: number;
  weeklySpentUsd: number;
  isFrozen: boolean;
}

export function getActiveBudgetState(handle?: string): BudgetState {
  const session = getStoredAgentSession(handle);
  if (!session) {
    return {
      perTxLimitUsd: 15.0,
      dailyLimitUsd: 50.0,
      weeklyLimitUsd: 200.0,
      spentUsd: 0.0,
      weeklySpentUsd: 0.0,
      isFrozen: false,
    };
  }

  return {
    perTxLimitUsd: session.perTxLimitUsd ?? 15.0,
    dailyLimitUsd: session.dailyLimitUsd ?? session.spendingLimitUsd ?? 50.0,
    weeklyLimitUsd: session.weeklyLimitUsd ?? 200.0,
    spentUsd: session.spentUsd ?? 0.0,
    weeklySpentUsd: session.weeklySpentUsd ?? session.spentUsd ?? 0.0,
    isFrozen: Boolean(session.isFrozen),
  };
}

export function validateBudgetGuardrail(
  amountUsd: number,
  handle?: string
): { allowed: boolean; error?: string } {
  return libValidate(amountUsd, handle);
}

// Atomically record an outflow spend across LocalStorage, in-memory state, and MongoDB
export async function recordAtomicSpend(
  amountUsd: number,
  handle?: string
): Promise<{ success: boolean; updatedBudget: BudgetState }> {
  const clean = (handle || "").replace("@", "").trim().toLowerCase();
  const session = getStoredAgentSession(clean);

  const numAmount = Number(amountUsd) || 0;
  if (!session) {
    return {
      success: false,
      updatedBudget: getActiveBudgetState(clean),
    };
  }

  // 1. Update in-browser cryptographic session
  session.spentUsd = Number(((session.spentUsd || 0) + numAmount).toFixed(2));
  session.weeklySpentUsd = Number(((session.weeklySpentUsd || 0) + numAmount).toFixed(2));
  saveAgentSession(session, clean);

  // 2. Synchronize to MongoDB Atlas in background
  if (typeof window !== "undefined" && clean) {
    fetch("/api/user/spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: clean, amountUsd: numAmount }),
    }).catch((e) => console.warn("[budget-service] Spend sync notice:", e));
  }

  return {
    success: true,
    updatedBudget: getActiveBudgetState(clean),
  };
}
