// src/lib/near-wallet-connector.ts
// Real browser extension & on-chain verification for Meteor, Sender, and NEAR Wallets

export interface ConnectedExternalWallet {
  walletType: "meteor" | "sender" | "nightly" | "custom";
  accountId: string;
  balanceNear?: string;
  connectedAt: number;
}

const EXTERNAL_WALLET_STORAGE_KEY = "veilx_external_wallet_v1";

export function getStoredExternalWallet(): ConnectedExternalWallet | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(EXTERNAL_WALLET_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredExternalWallet(wallet: ConnectedExternalWallet): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXTERNAL_WALLET_STORAGE_KEY, JSON.stringify(wallet));
}

export function removeStoredExternalWallet(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(EXTERNAL_WALLET_STORAGE_KEY);
}

// Live RPC query to fetch account balance and verify existence on NEAR Testnet
export async function verifyNearAccountOnChain(accountId: string): Promise<{
  exists: boolean;
  balanceNear?: string;
  storageUsage?: number;
  error?: string;
}> {
  try {
    const cleanId = accountId.trim().toLowerCase();
    const res = await fetch("https://rpc.testnet.near.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "veilx-check",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: cleanId,
        },
      }),
    });

    const data = await res.json();
    if (data.error) {
      return { exists: false, error: data.error.cause?.name || "Account not found on NEAR testnet" };
    }

    if (data.result && data.result.amount) {
      // Convert yoctoNEAR to human readable NEAR (divide by 10^24)
      const yocto = BigInt(data.result.amount);
      const whole = yocto / BigInt(10 ** 24);
      const fraction = (yocto % BigInt(10 ** 24)).toString().padStart(24, "0").slice(0, 3);
      const balanceStr = `${whole}.${fraction}`;

      return {
        exists: true,
        balanceNear: balanceStr,
        storageUsage: data.result.storage_usage,
      };
    }

    return { exists: false, error: "Invalid RPC response" };
  } catch (err: any) {
    return { exists: false, error: err.message || "Failed to reach NEAR RPC" };
  }
}

// Connect Meteor Wallet Extension
export async function connectMeteorWallet(): Promise<{ success: boolean; accountId?: string; error?: string }> {
  if (typeof window === "undefined") return { success: false, error: "Window unavailable" };

  const meteor = (window as any).meteorWallet;
  if (!meteor) {
    return {
      success: false,
      error: "EXTENSION_NOT_FOUND",
    };
  }

  try {
    const res = await meteor.requestSignIn({
      contractId: "veilx-agent.testnet",
    });

    const accountId = res?.accountId || meteor.getAccountId();
    if (accountId) {
      return { success: true, accountId };
    }
    return { success: false, error: "No account selected in Meteor" };
  } catch (err: any) {
    return { success: false, error: err.message || "Meteor sign-in cancelled" };
  }
}

// Connect Sender Wallet Extension
export async function connectSenderWallet(): Promise<{ success: boolean; accountId?: string; error?: string }> {
  if (typeof window === "undefined") return { success: false, error: "Window unavailable" };

  const sender = (window as any).near;
  if (!sender) {
    return {
      success: false,
      error: "EXTENSION_NOT_FOUND",
    };
  }

  try {
    const res = await sender.requestSignIn({
      contractId: "veilx-agent.testnet",
    });

    const accountId = res?.accountId || sender.getAccountId();
    if (accountId) {
      return { success: true, accountId };
    }
    return { success: false, error: "No account selected in Sender" };
  } catch (err: any) {
    return { success: false, error: err.message || "Sender sign-in cancelled" };
  }
}
