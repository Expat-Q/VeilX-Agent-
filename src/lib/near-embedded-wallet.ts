// src/lib/near-embedded-wallet.ts
// Embedded Non-Custodial Session Key Management for VeilX Agent on NEAR
import * as nearAPI from "near-api-js";
import { sanitizeNearAccountId } from "./near-utils";

export interface AgentSessionState {
  accountId: string;
  publicKey: string;
  secretKey: string;
  spendingLimitUsd: number; // legacy alias for dailyLimitUsd
  spentUsd: number;
  gasAllowanceNear: number;
  isActive: boolean;
  isExternalConnected: boolean;
  externalWalletType?: string;
  // 3-Tier Budget System
  perTxLimitUsd: number;     // Max per tip / trade (default: $15.00)
  dailyLimitUsd: number;     // Daily outflow budget (default: $50.00)
  weeklyLimitUsd: number;    // Weekly trading ceiling (default: $200.00)
  weeklySpentUsd: number;    // Accumulated spend this week
  isFrozen?: boolean;        // Global Emergency Freeze
  // Protocol Key Scoping Metadata (NEAR Function-Call Permission)
  isKeyScoped?: boolean;
  scopedReceiverId?: string;
  scopedMethods?: string[];
}

const GLOBAL_STORAGE_KEY = "veilx_agent_session_v1";

function getHandleStorageKey(handle?: string): string {
  if (!handle) return GLOBAL_STORAGE_KEY;
  const clean = handle.replace("@", "").trim().toLowerCase();
  return `veilx_agent_session_${clean}`;
}

export function getStoredAgentSession(handle?: string): AgentSessionState | null {
  if (typeof window === "undefined") return null;
  const key = getHandleStorageKey(handle);
  const stored = localStorage.getItem(key) || (handle ? null : localStorage.getItem(GLOBAL_STORAGE_KEY));
  if (!stored) return null;
  try {
    const session: AgentSessionState = JSON.parse(stored);
    // Auto-migrate legacy .veilx.testnet placeholder to real on-chain parent .veilx-agent.testnet
    if (session.accountId?.endsWith(".veilx.testnet")) {
      session.accountId = session.accountId.replace(/\.veilx\.testnet$/i, ".veilx-agent.testnet");
    }
    // Ensure 3-tier defaults exist
    if (session.perTxLimitUsd === undefined) session.perTxLimitUsd = 15.0;
    if (session.dailyLimitUsd === undefined) session.dailyLimitUsd = session.spendingLimitUsd || 50.0;
    if (session.weeklyLimitUsd === undefined) session.weeklyLimitUsd = 200.0;
    if (session.weeklySpentUsd === undefined) session.weeklySpentUsd = session.spentUsd || 0.0;
    return session;
  } catch {
    return null;
  }
}

export function saveAgentSession(session: AgentSessionState, handle?: string): void {
  if (typeof window === "undefined") return;
  if (session.accountId?.endsWith(".veilx.testnet")) {
    session.accountId = session.accountId.replace(/\.veilx\.testnet$/i, ".veilx-agent.testnet");
  }
  const key = getHandleStorageKey(handle);
  localStorage.setItem(key, JSON.stringify(session));
  localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("veilx_session_updated", { detail: session }));
}

// Generate or retrieve the user's embedded account and delegated session key
export function initializeEmbeddedSession(handle: string = "expatq3"): AgentSessionState {
  const existing = getStoredAgentSession(handle);
  if (existing) return existing;

  // Generate a real cryptographic Ed25519 keypair
  const keyPair = nearAPI.KeyPair.fromRandom("ed25519");
  const targetAccountId = sanitizeNearAccountId(handle);

  const newSession: AgentSessionState = {
    accountId: targetAccountId,
    publicKey: keyPair.getPublicKey().toString(),
    secretKey: keyPair.toString(),
    spendingLimitUsd: 50.0,
    spentUsd: 0.0,
    gasAllowanceNear: 0.5,
    isActive: true,
    isExternalConnected: false,
    perTxLimitUsd: 15.0,
    dailyLimitUsd: 50.0,
    weeklyLimitUsd: 200.0,
    weeklySpentUsd: 0.0,
    isFrozen: false,
  };

  saveAgentSession(newSession, handle);
  return newSession;
}

// Validate an attempted spend against the 3-Tier Budget System
export function validateSpendBudget(
  amountUsd: number,
  handle?: string
): { allowed: boolean; isQuarantined?: boolean; error?: string; perTxMax?: number; dailyMax?: number } {
  if (typeof amountUsd !== "number" || isNaN(amountUsd) || amountUsd <= 0) {
    return {
      allowed: false,
      isQuarantined: false,
      error: "Invalid spend amount: Amount must be a positive number greater than 0.",
    };
  }

  const session = getStoredAgentSession(handle);
  if (!session) {
    return {
      allowed: false,
      isQuarantined: false,
      error: "Active agent session required to validate spend budget.",
    };
  }

  if (session.isFrozen) {
    return {
      allowed: false,
      isQuarantined: false,
      error: "Emergency Freeze Active: All autonomous agent transactions are blocked by emergency safety controls.",
    };
  }

  const dailyMax = session.dailyLimitUsd ?? session.spendingLimitUsd ?? 50.0;
  const currentSpent = session.spentUsd ?? 0.0;
  if (currentSpent + amountUsd > dailyMax) {
    const remaining = Math.max(0, dailyMax - currentSpent);
    return {
      allowed: false,
      isQuarantined: false,
      dailyMax,
      error: `Daily Limit Exceeded: This transfer (~$${amountUsd.toFixed(2)}) exceeds your remaining daily budget ($${remaining.toFixed(2)} remaining of $${dailyMax.toFixed(2)} cap). Please increase your Daily Cap in the Budget modal.`,
    };
  }

  const weeklyMax = session.weeklyLimitUsd ?? 200.0;
  const currentWeekly = session.weeklySpentUsd ?? currentSpent ?? 0.0;
  if (currentWeekly + amountUsd > weeklyMax) {
    const remainingWeekly = Math.max(0, weeklyMax - currentWeekly);
    return {
      allowed: false,
      isQuarantined: false,
      error: `Weekly Limit Exceeded: This transfer (~$${amountUsd.toFixed(2)}) exceeds your remaining weekly budget ($${remainingWeekly.toFixed(2)} remaining of $${weeklyMax.toFixed(2)} ceiling).`,
    };
  }

  const perTxMax = session.perTxLimitUsd ?? 15.0;
  if (amountUsd > perTxMax) {
    return {
      allowed: false,
      isQuarantined: true,
      perTxMax,
      error: `Anomaly Quarantine: This transaction (~$${amountUsd.toFixed(2)}) exceeds your autonomous Per-Transaction cap ($${perTxMax.toFixed(2)}). Manual Human-in-the-Loop authorization is required.`,
    };
  }

  return { allowed: true };
}

// Record an autonomous spend by the Agent enforcing 3-Tier Budget & Freeze Guards
export function recordAgentSpend(
  amountUsd: number,
  handle?: string,
  forceRecord = false
): { success: boolean; error?: string } {
  const session = getStoredAgentSession(handle);
  if (!session) return { success: false, error: "No active session" };

  if (!forceRecord) {
    const check = validateSpendBudget(amountUsd, handle);
    if (!check.allowed) {
      return { success: false, error: check.error };
    }
  }

  const currentWeekly = session.weeklySpentUsd ?? session.spentUsd ?? 0.0;
  session.spentUsd = Number(((session.spentUsd ?? 0) + amountUsd).toFixed(2));
  session.weeklySpentUsd = Number((currentWeekly + amountUsd).toFixed(2));
  saveAgentSession(session, handle);

  if (typeof window !== "undefined" && handle) {
    fetch("/api/user/spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, amountUsd }),
    }).catch(() => {});
  }

  return { success: true };
}

// Update 3-Tier Budget System
export function updateBudgetTiers(
  tiers: { perTx?: number; daily?: number; weekly?: number },
  handle?: string
): void {
  const session = getStoredAgentSession(handle);
  if (!session) return;
  if (tiers.perTx !== undefined) session.perTxLimitUsd = tiers.perTx;
  if (tiers.daily !== undefined) {
    session.dailyLimitUsd = tiers.daily;
    session.spendingLimitUsd = tiers.daily;
  }
  if (tiers.weekly !== undefined) session.weeklyLimitUsd = tiers.weekly;
  saveAgentSession(session, handle);
}

// Global Emergency Freeze
export function freezeAgentSession(handle?: string): void {
  const session = getStoredAgentSession(handle);
  if (!session) return;
  session.isFrozen = true;
  saveAgentSession(session, handle);
}

// Unfreeze Agent
export function unfreezeAgentSession(handle?: string): void {
  const session = getStoredAgentSession(handle);
  if (!session) return;
  session.isFrozen = false;
  saveAgentSession(session, handle);
}

// Legacy update spending limit alias
export function updateSpendingLimit(newLimit: number, handle?: string): void {
  updateBudgetTiers({ daily: newLimit }, handle);
}

// Revoke delegated session key (Single-Click Instant Revocation)
export function revokeAgentSession(handle?: string): void {
  if (typeof window === "undefined") return;
  const session = getStoredAgentSession(handle);
  const key = getHandleStorageKey(handle);

  // If session had a public key, notify relayer/on-chain to revoke key access
  if (session?.publicKey && session?.accountId) {
    fetch("/api/near/revoke-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: session.accountId,
        publicKey: session.publicKey,
        handle,
      }),
    }).catch((err) => console.warn("[KeyRevocation] Server notification failed:", err));
  }

  localStorage.removeItem(key);
  localStorage.removeItem(GLOBAL_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("veilx_session_updated", { detail: null }));
}

export interface ScopedFunctionCallConfig {
  receiverId: string;
  methodNames: string[];
  allowanceNear?: string; // e.g. "1.0" NEAR capped gas allowance
}

/**
 * Creates a protocol-level restricted FunctionCall Access Key action on NEAR.
 * Cryptographically guarantees that this key cannot transfer raw NEAR,
 * cannot modify access keys, and can only execute the specified methodNames.
 */
export function createFunctionCallKeyAction(
  publicKeyStr: string,
  config: ScopedFunctionCallConfig
) {
  const pubKey = nearAPI.PublicKey.fromString(publicKeyStr);
  const allowanceStr = config.allowanceNear
    ? nearAPI.parseNearAmount(config.allowanceNear as any)
    : nearAPI.parseNearAmount("1.0");

  const allowance = allowanceStr ? BigInt(allowanceStr) : undefined;
  return nearAPI.actions.addFunctionCallAccessKey(
    pubKey,
    config.receiverId,
    config.methodNames,
    allowance
  );
}
