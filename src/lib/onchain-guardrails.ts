// src/lib/onchain-guardrails.ts
// Single Source of Truth: Omnichain Smart Contract Guardrail Enforcement
// Enforces on-chain limits on NEAR Protocol (veilx-escrow) across all features:
// 1. NEAR Native tips & NEP-141 token transfers
// 2. Outbound EVM MPC transfers (Base, Ethereum, Arbitrum)
// 3. Autonomous AI Agent trades (DCA, tokenized stocks)
// 4. Emergency Killswitch Freeze

import * as nearAPI from "near-api-js";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;

export interface OnChainGuardrails {
  dailyLimitUsd: number;
  spentTodayUsd: number;
  weeklyLimitUsd: number;
  spentThisWeekUsd: number;
  perTxMaxUsd: number;
  isFrozen: boolean;
  lastDailyResetTs: number;
  lastWeeklyResetTs: number;
}

/**
 * Returns an authenticated nearAPI.Account instance for the VeilX contract relayer.
 */
export function getRelayerAccount(): nearAPI.Account | null {
  if (!ESCROW_PRIVATE_KEY || !CONTRACT_ID) {
    return null;
  }
  try {
    const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
    const keyPair = nearAPI.KeyPair.fromString(ESCROW_PRIVATE_KEY as any);
    const signer = new nearAPI.KeyPairSigner(keyPair);
    return new nearAPI.Account(CONTRACT_ID, provider, signer);
  } catch (err) {
    console.error("[onchain-guardrails] Failed to initialize relayer account:", err);
    return null;
  }
}

/**
 * Reads the active on-chain guardrail state for a given NEAR account.
 */
export async function fetchOnChainGuardrails(accountId: string): Promise<OnChainGuardrails | null> {
  const cleanAccount = (accountId || "").trim().toLowerCase();
  if (!cleanAccount) return null;

  try {
    const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
    const rawResult: any = await provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: CONTRACT_ID,
      method_name: "get_guardrails",
      args_base64: Buffer.from(JSON.stringify({ account: cleanAccount })).toString("base64"),
    });

    if (!rawResult || !rawResult.result) return null;
    const parsed = JSON.parse(Buffer.from(rawResult.result).toString("utf-8"));
    if (!parsed) return null;

    return {
      dailyLimitUsd: Number(parsed.daily_limit || 0) / 1_000_000,
      spentTodayUsd: Number(parsed.spent_today || 0) / 1_000_000,
      weeklyLimitUsd: Number(parsed.weekly_limit || 0) / 1_000_000,
      spentThisWeekUsd: Number(parsed.spent_this_week || 0) / 1_000_000,
      perTxMaxUsd: Number(parsed.per_tx_quarantine_max || 0) / 1_000_000,
      isFrozen: Boolean(parsed.is_frozen),
      lastDailyResetTs: Number(parsed.last_daily_reset_ts || 0),
      lastWeeklyResetTs: Number(parsed.last_weekly_reset_ts || 0),
    };
  } catch (err) {
    // If account not initialized yet on-chain or network glitch, return null
    return null;
  }
}

/**
 * Atomically checks and records an outflow spend against the account's on-chain guardrail.
 * Converts amountUsd to 6-decimal micro-units (e.g. $10.50 -> 10,500,000).
 *
 * @throws Error if the transaction violates on-chain limits or account is frozen.
 */
export async function recordOnChainSpend(params: {
  accountId: string;
  amountUsd: number;
  signerAccount?: nearAPI.Account;
}): Promise<{ success: boolean; txHash?: string }> {
  const { accountId, amountUsd } = params;
  const cleanAccount = (accountId || "").trim().toLowerCase();
  const relayer = params.signerAccount || getRelayerAccount();

  if (!relayer) {
    console.warn("[onchain-guardrails] Relayer key not configured. Bypassing on-chain record.");
    return { success: true };
  }

  const microAmount = Math.round((Number(amountUsd) || 0) * 1_000_000).toString();

  try {
    const callFn = typeof (relayer as any).callFunctionRaw === "function"
      ? (relayer as any).callFunctionRaw.bind(relayer)
      : typeof (relayer as any).functionCall === "function"
      ? (relayer as any).functionCall.bind(relayer)
      : (relayer as any).callFunction.bind(relayer);

    const outcome: any = await callFn({
      contractId: CONTRACT_ID,
      methodName: "check_and_record_spend",
      args: {
        account: cleanAccount,
        amount: microAmount,
      },
      gas: BigInt("30000000000000"), // 30 TGas
      deposit: BigInt(0),
      attachedDeposit: BigInt(0),
    });

    const txHash = outcome?.transaction?.hash || outcome?.transaction_outcome?.id || "confirmed";
    return { success: true, txHash };
  } catch (err: any) {
    const errorStr = (err?.message || err?.toString() || "");

    if (errorStr.includes("ACCOUNT_FROZEN")) {
      throw new Error("ACCOUNT_FROZEN: Account is frozen by emergency safety control on-chain");
    }
    if (errorStr.includes("Daily spending limit breached")) {
      throw new Error("GUARDRAIL_EXCEEDED: Daily spending limit breached on-chain");
    }
    if (errorStr.includes("Weekly spending limit breached")) {
      throw new Error("GUARDRAIL_EXCEEDED: Weekly spending limit breached on-chain");
    }

    console.error("[onchain-guardrails] check_and_record_spend failed:", err);
    throw new Error(`On-chain guardrail rejection: ${errorStr}`);
  }
}

/**
 * Updates spending limits directly on the smart contract for the authenticated user.
 */
export async function setOnChainGuardrails(params: {
  accountId?: string;
  dailyLimitUsd: number;
  weeklyLimitUsd: number;
  perTxMaxUsd?: number;
  signerAccount?: nearAPI.Account;
}): Promise<{ success: boolean; txHash?: string }> {
  const relayer = params.signerAccount || getRelayerAccount();
  if (!relayer) {
    return { success: false };
  }

  const dailyMicro = Math.round(params.dailyLimitUsd * 1_000_000).toString();
  const weeklyMicro = Math.round(params.weeklyLimitUsd * 1_000_000).toString();
  const perTxMicro = Math.round((params.perTxMaxUsd || (params.dailyLimitUsd * 0.5)) * 1_000_000).toString();

  try {
    const callFn = typeof (relayer as any).callFunctionRaw === "function"
      ? (relayer as any).callFunctionRaw.bind(relayer)
      : typeof (relayer as any).functionCall === "function"
      ? (relayer as any).functionCall.bind(relayer)
      : (relayer as any).callFunction.bind(relayer);

    const outcome: any = await callFn({
      contractId: CONTRACT_ID,
      methodName: "set_guardrails",
      args: {
        daily_limit: dailyMicro,
        weekly_limit: weeklyMicro,
        per_tx_max: perTxMicro,
      },
      gas: BigInt("30000000000000"),
      deposit: BigInt(0),
      attachedDeposit: BigInt(0),
    });

    const txHash = outcome?.transaction?.hash || outcome?.transaction_outcome?.id || "confirmed";
    return { success: true, txHash };
  } catch (err) {
    console.error("[onchain-guardrails] set_guardrails failed:", err);
    return { success: false };
  }
}
