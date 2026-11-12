// src/lib/near-rpc.ts
// Direct RPC client to query live NEAR Testnet accounts, balances, and transaction proofs

const DEFAULT_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://test.rpc.fastnear.com";
const RPC_ENDPOINTS = [
  "https://test.rpc.fastnear.com",
  DEFAULT_RPC,
  "https://rpc.testnet.pagoda.co",
].filter((url, idx, arr) => arr.indexOf(url) === idx);

export interface NearTokenHolding {
  symbol: string;
  name: string;
  balance: string;
  numericBalance: number;
  decimals: number;
  contractAddress: string;
  usdPrice: number;
  valueUsd: number;
}

export interface NearAccountInfo {
  exists: boolean;
  amountNear: string;
  storageUsage: number;
  blockHeight?: number;
  tokens?: NearTokenHolding[];
}

export async function fetchNearTokenBalances(accountId: string): Promise<NearTokenHolding[]> {
  const cleanAccount = (accountId || "").trim().toLowerCase();
  if (!cleanAccount) return [];

  const isMainnet = cleanAccount.endsWith(".near") && !cleanAccount.endsWith(".testnet");
  const rpcUrls = isMainnet
    ? ["https://rpc.mainnet.near.org", "https://1rpc.io/near", "https://mainnet.neardata.xyz/v1/node"]
    : ["https://test.rpc.fastnear.com", "https://rpc.testnet.near.org", "https://rpc.testnet.pagoda.co"];

  const trackedTokens = isMainnet
    ? [
        {
          symbol: "USDC",
          name: "USD Coin",
          contractAddress: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
          decimals: 6,
          usdPrice: 1.0,
        },
        {
          symbol: "USDT",
          name: "Tether USD",
          contractAddress: "usdt.tether-token.near",
          decimals: 6,
          usdPrice: 1.0,
        },
      ]
    : [
        {
          symbol: "USDC",
          name: "USD Coin (Circle)",
          contractAddress: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af",
          decimals: 6,
          usdPrice: 1.0,
        },
        {
          symbol: "USDC",
          name: "USD Coin (Testnet)",
          contractAddress: "usdc.fakes.testnet",
          decimals: 6,
          usdPrice: 1.0,
        },
        {
          symbol: "USDT",
          name: "Tether USD (Testnet)",
          contractAddress: "usdt.fakes.testnet",
          decimals: 6,
          usdPrice: 1.0,
        },
      ];

  const holdings: NearTokenHolding[] = [];
  const argsBase64 = Buffer.from(JSON.stringify({ account_id: cleanAccount })).toString("base64");

  const results = await Promise.all(
    trackedTokens.map(async (token) => {
      let rawBal: string | null = null;

      for (const rpcUrl of rpcUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);

          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: `ft_bal_${token.symbol}`,
              method: "query",
              params: {
                request_type: "call_function",
                finality: "final",
                account_id: token.contractAddress,
                method_name: "ft_balance_of",
                args_base64: argsBase64,
              },
            }),
            cache: "no-store",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) continue;
          const data = await res.json();
          if (data.result && data.result.result) {
            const parsed = JSON.parse(Buffer.from(data.result.result).toString("utf8"));
            if (parsed !== undefined && parsed !== null) {
              rawBal = String(parsed);
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (rawBal !== null) {
        const numRaw = BigInt(rawBal || "0");
        const divisor = BigInt(10 ** token.decimals);
        const units = Number(numRaw) / Number(divisor);
        if (units > 0) {
          return {
            symbol: token.symbol,
            name: token.name,
            contractAddress: token.contractAddress,
            decimals: token.decimals,
            balance: units.toFixed(2),
            numericBalance: units,
            usdPrice: token.usdPrice,
            valueUsd: Number((units * token.usdPrice).toFixed(2)),
          };
        }
      }
      return null;
    })
  );

  for (const item of results) {
    if (!item) continue;
    const existingIdx = holdings.findIndex((h) => h.symbol === item.symbol);
    if (existingIdx >= 0) {
      holdings[existingIdx].numericBalance += item.numericBalance;
      holdings[existingIdx].balance = holdings[existingIdx].numericBalance.toFixed(2);
      holdings[existingIdx].valueUsd = Number(
        (holdings[existingIdx].numericBalance * item.usdPrice).toFixed(2)
      );
    } else {
      holdings.push(item);
    }
  }

  return holdings;
}

export async function fetchNearAccount(accountId: string): Promise<NearAccountInfo> {
  const cleanAccount = (accountId || "").trim().toLowerCase();
  if (!cleanAccount) {
    return {
      exists: false,
      amountNear: "0",
      storageUsage: 0,
    };
  }

  // In the browser, always route through our Next.js API proxy to eliminate browser CORS restrictions
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/near/account?accountId=${encodeURIComponent(cleanAccount)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (clientErr) {
      console.warn("[NEAR Client Proxy Error]:", clientErr);
    }
  }

  // Server-side direct RPC querying (Node.js has no CORS restrictions)
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "veilx_query",
          method: "query",
          params: {
            request_type: "view_account",
            finality: "final",
            account_id: cleanAccount,
          },
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (data.error || !data.result) {
        continue;
      }

      // Convert yoctoNEAR (10^24) to formatted NEAR
      const yoctoStr = data.result.amount || "0";
      const nearValue = formatYoctoToNear(yoctoStr);

      const tokens = await fetchNearTokenBalances(cleanAccount);

      return {
        exists: true,
        amountNear: nearValue,
        storageUsage: data.result.storage_usage || 0,
        blockHeight: data.result.block_height,
        tokens,
      };
    } catch {
      // Try next RPC endpoint in pool
      continue;
    }
  }

  console.warn(`[NEAR RPC] Failed to query account across all endpoints for: ${cleanAccount}`);
  return {
    exists: false,
    amountNear: "0",
    storageUsage: 0,
  };
}

export interface TxVerificationResult {
  success: boolean;
  error?: string;
  blockHash?: string;
  depositNear?: string;
  receiverId?: string;
}

/**
 * Validates on-chain transaction outcome against NEAR testnet RPC.
 * Verifies that the transaction reached finality and succeeded with no receipt failures.
 */
export async function verifyNearTransactionOutcome(
  txHash: string,
  accountId: string,
  minDepositNear?: number
): Promise<TxVerificationResult> {
  const cleanTx = (txHash || "").trim();
  const cleanAccount = (accountId || "").trim();

  if (!cleanTx || cleanTx.length < 32) {
    return { success: false, error: "Invalid transaction hash format. Base58 tx hash required." };
  }

  if (!cleanAccount) {
    return { success: false, error: "Account ID is required to query transaction status." };
  }

  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "veilx_tx_verify",
          method: "tx",
          params: [cleanTx, cleanAccount],
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (data.error) {
        const errMsg = data.error?.data || data.error?.message || "";
        if (typeof errMsg === "string" && (errMsg.includes("does not exist") || errMsg.includes("not found"))) {
          return { success: false, error: `Transaction ${cleanTx} not found on NEAR testnet.` };
        }
        continue;
      }

      const result = data.result;
      if (!result) {
        continue;
      }

      const status = result.status;
      if (status && status.Failure !== undefined) {
        return {
          success: false,
          error: `Transaction failed on-chain: ${JSON.stringify(status.Failure)}`,
        };
      }

      const isSuccess =
        status && (status.SuccessValue !== undefined || status.SuccessReceiptId !== undefined);

      if (!isSuccess) {
        return {
          success: false,
          error: "Transaction has not yet reached success finality on NEAR RPC",
        };
      }

      // Check receipt outcomes for internal execution failures
      if (Array.isArray(result.receipts_outcome)) {
        for (const ro of result.receipts_outcome) {
          if (ro.outcome?.status?.Failure) {
            return {
              success: false,
              error: `Internal receipt execution failure: ${JSON.stringify(ro.outcome.status.Failure)}`,
            };
          }
        }
      }

      // Cryptographic receipt & receiver verification
      const txReceiver = result.transaction?.receiver_id;
      if (cleanAccount && txReceiver && txReceiver.toLowerCase() !== cleanAccount.toLowerCase()) {
        return {
          success: false,
          error: `Receiver mismatch: expected ${cleanAccount}, got ${txReceiver}`,
        };
      }

      // Attached deposit verification in actions (Transfer or FunctionCall) with 2% slippage tolerance
      if (minDepositNear && minDepositNear > 0) {
        const actions = result.transaction?.actions || [];
        let totalDepositYocto = BigInt(0);
        for (const action of actions) {
          const actObj = typeof action === "object" ? action : {};
          const transferDeposit = actObj.Transfer?.deposit || actObj.transfer?.deposit;
          const fnDeposit = actObj.FunctionCall?.deposit || actObj.functionCall?.deposit || actObj.function_call?.deposit;
          const directDeposit = actObj.deposit;

          if (transferDeposit) {
            try { totalDepositYocto += BigInt(transferDeposit); } catch {}
          } else if (fnDeposit) {
            try { totalDepositYocto += BigInt(fnDeposit); } catch {}
          } else if (directDeposit) {
            try { totalDepositYocto += BigInt(directDeposit); } catch {}
          }
        }
        const divisor = BigInt("1000000000000000000000000");
        const transferredNear = Number(totalDepositYocto) / Number(divisor);
        if (transferredNear < minDepositNear * 0.98) {
          return {
            success: false,
            error: `Insufficient deposit: required ${minDepositNear} NEAR, received ${transferredNear.toFixed(4)} NEAR`,
          };
        }
      }

      return {
        success: true,
        blockHash: result.transaction_outcome?.block_hash,
        receiverId: result.transaction?.receiver_id,
      };
    } catch {
      // Try next RPC in pool
      continue;
    }
  }

  return {
    success: false,
    error: `Could not verify transaction ${cleanTx} against NEAR RPC pool. Please retry shortly.`,
  };
}

function formatYoctoToNear(yocto: string): string {
  try {
    if (yocto.length <= 24) {
      const padded = yocto.padStart(25, "0");
      const whole = padded.slice(0, padded.length - 24) || "0";
      const fraction = padded.slice(padded.length - 24, padded.length - 20);
      return `${whole}.${fraction}`;
    }
    const whole = yocto.slice(0, yocto.length - 24);
    const fraction = yocto.slice(yocto.length - 24, yocto.length - 20);
    return `${whole}.${fraction}`;
  } catch {
    return "0.0";
  }
}

/**
 * Checks if a given NEAR account has NEP-145 storage registered for a NEP-141 token contract.
 */
export async function checkFtStorageBalance(
  tokenId: string,
  accountId: string
): Promise<{ registered: boolean; total?: string; available?: string }> {
  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const argsBase64 = Buffer.from(JSON.stringify({ account_id: accountId })).toString("base64");

      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "storage_check",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: tokenId,
            method_name: "storage_balance_of",
            args_base64: argsBase64,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();
      if (data.result && data.result.result) {
        const decoded = JSON.parse(Buffer.from(data.result.result).toString("utf8"));
        if (decoded && decoded.total) {
          return { registered: true, total: decoded.total, available: decoded.available };
        }
        return { registered: false };
      }
    } catch {
      continue;
    }
  }
  return { registered: false };
}
