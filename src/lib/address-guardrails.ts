// src/lib/address-guardrails.ts
// Address format validation and cross-chain route safety guardrails

/**
 * Validates whether an address is a standard 20-byte EVM address (0x followed by 40 hex characters)
 */
export function isEvmAddress(addr?: string | null): boolean {
  if (!addr) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

/**
 * Validates whether an address is a NEAR account format:
 * - Standard named accounts: e.g. "alice.near", "bob.testnet", "sub.account.near"
 * - Implicit 64-character hexadecimal account IDs
 */
export function isNearAddress(addr?: string | null): boolean {
  if (!addr) return false;
  const clean = addr.trim().toLowerCase();
  // 64-hex implicit account ID
  if (/^[a-f0-9]{64}$/.test(clean)) return true;
  // Named NEAR accounts ending in .near or .testnet
  if (/^[a-z0-9_\-\.]+\.(near|testnet)$/.test(clean)) return true;
  return false;
}

/**
 * Validates whether a handle is a Twitter / 𝕏 handle:
 * e.g. "@expatq3" or "expatq3" (alphanumeric + underscores, 1-15 characters)
 * Excludes EVM and NEAR address formats
 */
export function isTwitterHandle(addr?: string | null): boolean {
  if (!addr) return false;
  const clean = addr.trim().replace(/^@/, "");
  if (isEvmAddress(addr) || isNearAddress(addr)) return false;
  return /^[a-zA-Z0-9_]{1,15}$/.test(clean);
}

export interface RouteValidationResult {
  isValid: boolean;
  needsRouteConversion: boolean;
  recommendedAction?: "defuse_1click" | "evm_mpc" | "near_native" | "none";
  warning?: string;
  suggestedChain?: string;
  suggestedAsset?: string;
}

/**
 * Validates the safety and compatibility of a transfer route between source chain and destination address.
 * 
 * - If destAddress is 0x and sourceChain is "near": flags incompatible direct transfer,
 *   specifies that it must be routed via Defuse 1Click intent solver or switched to EVM MPC (Base/Arbitrum)
 * - If destAddress is .near and sourceChain is EVM: flags route conversion needed
 */
export function validateTransferRoute(
  sourceChain: string,
  destAddress: string,
  asset?: string
): RouteValidationResult {
  const normSource = (sourceChain || "near").toLowerCase();
  const cleanDest = (destAddress || "").trim();
  const isDestEvm = isEvmAddress(cleanDest);
  const isDestNear = isNearAddress(cleanDest);

  // If destAddress is 0x and sourceChain is "near":
  // Flags incompatible direct transfer. Raw ft_transfer to 0x address would burn/lose assets.
  // Must be routed via Defuse 1Click intent solver or switched to EVM MPC.
  if (isDestEvm && (normSource === "near" || normSource === "near protocol")) {
    return {
      isValid: false,
      needsRouteConversion: true,
      recommendedAction: "defuse_1click",
      suggestedChain: "base",
      suggestedAsset: (asset?.toUpperCase() === "NEAR" ? "USDC" : asset) || "USDC",
      warning:
        "EVM destination address detected (0x...). Route converted to Defuse 1Click Cross-Chain Solver to deliver funds safely without losing assets.",
    };
  }

  // If destAddress is .near / .testnet and sourceChain is EVM (Base, Arbitrum, Ethereum, etc.)
  const isEvmSource =
    ["base", "arbitrum", "ethereum", "polygon", "optimism", "bnb"].includes(normSource) ||
    normSource.includes("sepolia");

  if (isDestNear && isEvmSource) {
    return {
      isValid: false,
      needsRouteConversion: true,
      recommendedAction: "defuse_1click",
      suggestedChain: "near",
      suggestedAsset: "NEAR",
      warning:
        "NEAR destination address detected (.near/.testnet). Direct EVM transfer is incompatible. Route conversion needed via Defuse 1Click Solver or native NEAR transfer.",
    };
  }

  return {
    isValid: true,
    needsRouteConversion: false,
    recommendedAction: normSource === "near" ? "near_native" : "evm_mpc",
  };
}
