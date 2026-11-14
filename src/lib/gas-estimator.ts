// src/lib/gas-estimator.ts
// Pre-flight gas estimations, relayer sponsorship status, and low gas balance warnings

export interface GasEstimate {
  chain: string;
  feeFormatted: string;
  feeAmount: number;
  assetSymbol: string;
  isSponsored: boolean;
  badgeLabel: string;
  note?: string;
}

export interface LowGasCheckResult {
  isLow: boolean;
  warning?: string;
  threshold: number;
  symbol: string;
  balance: number;
}

/**
 * Estimates pre-flight gas fees for NEAR native / NEP-141 transfers (~0.001 NEAR)
 * Indicates if transactions are sponsored by Veil Relayer
 */
export function estimateNearGas(isSponsored = true): GasEstimate {
  return {
    chain: "NEAR Protocol",
    feeFormatted: "~0.001 NEAR",
    feeAmount: 0.001,
    assetSymbol: "NEAR",
    isSponsored,
    badgeLabel: isSponsored ? "Free (Sponsored)" : "~0.001 NEAR",
    note: isSponsored
      ? "Veil Relayer gas sponsorship active. Zero gas deducted from sender balance."
      : "Standard NEAR Protocol gas execution fee (~0.001 NEAR).",
  };
}

/**
 * Estimates pre-flight gas fees for EVM transactions executed via NEAR MPC Chain Signatures (~0.00015 ETH on Base/Sepolia)
 */
export function estimateEvmMpcGas(chain = "base"): GasEstimate {
  const normChain = (chain || "base").toLowerCase();
  const chainName = normChain.includes("arb")
    ? "Arbitrum Sepolia"
    : normChain.includes("eth")
    ? "Ethereum Sepolia"
    : "Base Sepolia";

  return {
    chain: chainName,
    feeFormatted: "~0.00015 ETH",
    feeAmount: 0.00015,
    assetSymbol: "ETH",
    isSponsored: false,
    badgeLabel: "~0.00015 ETH (MPC)",
    note: `EVM transaction fee on ${chainName} signed by NEAR Chain Signatures MPC.`,
  };
}

/**
 * General pre-flight gas estimator based on chain and execution mode
 */
export function estimateGasFee(chain: string, isEvm?: boolean): GasEstimate {
  const normChain = (chain || "near").toLowerCase();
  const isEvmChain = isEvm || normChain !== "near";

  if (isEvmChain) {
    return estimateEvmMpcGas(normChain);
  }
  return estimateNearGas(true);
}

/**
 * Checks for low native gas token balance before attempting transactions.
 * Alerts if NEAR < 0.05 NEAR or ETH < 0.0003 ETH.
 * 
 * @param balance - Current wallet balance (number or string representation)
 * @param chain - Target network (e.g. "near", "base", "arbitrum", "ethereum")
 * @param isEvm - Optional explicit boolean flag for EVM chains
 */
export function checkLowGasBalance(
  balance: number | string,
  chain: string,
  isEvm?: boolean
): LowGasCheckResult {
  const numBalance = typeof balance === "number" ? balance : parseFloat(String(balance)) || 0;
  const normChain = (chain || "near").toLowerCase();
  const isEvmTarget = isEvm || normChain !== "near";

  if (isEvmTarget) {
    const threshold = 0.0003;
    const isLow = numBalance < threshold;
    return {
      isLow,
      threshold,
      symbol: "ETH",
      balance: numBalance,
      warning: isLow
        ? `Low Gas Warning: Current balance (${numBalance.toFixed(5)} ETH) is below the recommended threshold of ${threshold} ETH. Your EVM transaction on ${chain.toUpperCase()} may fail.`
        : undefined,
    };
  } else {
    const threshold = 0.05;
    const isLow = numBalance < threshold;
    return {
      isLow,
      threshold,
      symbol: "NEAR",
      balance: numBalance,
      warning: isLow
        ? `Low Gas Warning: Current balance (${numBalance.toFixed(3)} NEAR) is below the safety threshold of ${threshold} NEAR. Maintain at least ${threshold} NEAR for storage staking and gas.`
        : undefined,
    };
  }
}
