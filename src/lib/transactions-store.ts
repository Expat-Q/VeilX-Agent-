// src/lib/transactions-store.ts
// Client-side persistent store for User Activity & Transactions in VeilX Agent

export type TransactionType =
  | "tip_sent"
  | "invoice_received"
  | "tip_claimed"
  | "direct_deposit"
  | "withdrawal"
  | "faucet_claim"
  | "cross_chain_swap"
  | "escrow_deposit";

export type TransactionStatus =
  | "escrow_pending"   // Outflow tip locked in escrow, waiting for @handle to claim
  | "claimed"          // Recipient claimed the tip to their wallet
  | "settled_direct"   // Inflow invoice paid directly to recipient's wallet via 1Click solver
  | "completed";       // Direct transfer completed on-chain

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  title: string;
  counterparty: string;
  amountUsd: number;
  asset: string;
  status: TransactionStatus;
  statusLabel: string;
  txHash?: string;
  timestamp: string;
  isInflow: boolean;
  memo?: string;
}

export interface PayLinkRecord {
  id: string;
  slug: string;
  title: string;
  amountUsd: number;
  recipientAccount: string;
  supportedChains: string[];
  status: "active" | "settled";
  createdAt: string;
  totalCollectedUsd: number;
}

const TX_STORAGE_KEY = "veilx_transactions_v2";
const PAYLINKS_STORAGE_KEY = "veilx_paylinks_v2";

const MOCK_TX_IDS = new Set(["tx_101", "tx_102", "tx_103", "tx_104", "tx_105"]);
const MOCK_PL_IDS = new Set(["pl_1", "pl_2"]);

export const INITIAL_TRANSACTIONS: TransactionRecord[] = [];
export const INITIAL_PAYLINKS: PayLinkRecord[] = [];

export function getTransactions(userHandle?: string): TransactionRecord[] {
  if (typeof window === "undefined") return [];
  const clean = userHandle ? userHandle.replace("@", "").trim().toLowerCase() : null;
  const key = clean ? `veilx_transactions_${clean}` : TX_STORAGE_KEY;
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed: TransactionRecord[] = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Strictly filter out any legacy hardcoded mock transactions
    return parsed.filter(
      (tx) =>
        tx &&
        !MOCK_TX_IDS.has(tx.id) &&
        !tx.counterparty?.includes("@jack") &&
        !tx.title?.includes("@jack") &&
        tx.id !== "tx_escrow_104"
    );
  } catch {
    return [];
  }
}

export function addTransactionRecord(
  record: Omit<TransactionRecord, "id" | "timestamp">,
  userHandle?: string
): TransactionRecord {
  const clean = userHandle ? userHandle.replace("@", "").trim().toLowerCase() : null;
  const all = getTransactions(clean || undefined);

  // If a transaction with the same txHash and type already exists, update it rather than duplicating
  const existingIdx = record.txHash
    ? all.findIndex((t) => t.txHash === record.txHash && t.type === record.type)
    : -1;

  let resultRecord: TransactionRecord;

  if (existingIdx >= 0) {
    all[existingIdx] = {
      ...all[existingIdx],
      ...record,
      amountUsd: Number(record.amountUsd) || all[existingIdx].amountUsd,
    };
    resultRecord = all[existingIdx];
  } else {
    resultRecord = {
      ...record,
      amountUsd: Number(record.amountUsd) || 0,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: "Just now",
    };
    all.unshift(resultRecord);
  }

  if (typeof window !== "undefined") {
    const key = clean ? `veilx_transactions_${clean}` : TX_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("veilx_activity_updated"));
  }
  return resultRecord;
}

export function getPayLinks(userHandle?: string): PayLinkRecord[] {
  if (typeof window === "undefined") return [];
  const clean = userHandle ? userHandle.replace("@", "").trim().toLowerCase() : null;
  const key = clean ? `veilx_paylinks_${clean}` : PAYLINKS_STORAGE_KEY;
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed: PayLinkRecord[] = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Filter out legacy mock paylinks
    return parsed.filter((pl) => pl && !MOCK_PL_IDS.has(pl.id));
  } catch {
    return [];
  }
}


export function addPayLinkRecord(
  link: Omit<PayLinkRecord, "id" | "createdAt" | "totalCollectedUsd">,
  userHandle?: string
): PayLinkRecord {
  const all = getPayLinks(userHandle);

  const existingIdx = all.findIndex((pl) => pl.slug === link.slug);
  if (existingIdx >= 0) {
    all[existingIdx] = {
      ...all[existingIdx],
      ...link,
      amountUsd: Number(link.amountUsd) || all[existingIdx].amountUsd,
    };
    if (typeof window !== "undefined") {
      const key = userHandle ? `veilx_paylinks_${userHandle.toLowerCase()}` : PAYLINKS_STORAGE_KEY;
      localStorage.setItem(key, JSON.stringify(all));
      localStorage.setItem(PAYLINKS_STORAGE_KEY, JSON.stringify(all));
    }
    return all[existingIdx];
  }

  const newLink: PayLinkRecord = {
    ...link,
    amountUsd: Number(link.amountUsd) || 0,
    id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: "Just now",
    totalCollectedUsd: 0,
  };
  const updated = [newLink, ...all];
  if (typeof window !== "undefined") {
    const key = userHandle ? `veilx_paylinks_${userHandle.toLowerCase()}` : PAYLINKS_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(updated));
    localStorage.setItem(PAYLINKS_STORAGE_KEY, JSON.stringify(updated));
  }
  return newLink;
}
