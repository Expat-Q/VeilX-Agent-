// src/lib/near-price.ts
// Real-time Multi-Chain & Crypto Price resolution with fallback and caching

import { getLiveNearPrice, getLiveEthPrice } from "./oracle-service";

/**
 * Fetch the current market price of NEAR in USD via live multi-source oracle
 */
export async function getNearUsdPrice(): Promise<number> {
  return await getLiveNearPrice();
}

/**
 * Convert a dollar amount or crypto amount into both USD and NEAR equivalents
 */
export async function resolveIntentValue(
  rawAmount: number,
  specifiedAsset?: string,
  hasDollarSign: boolean = false
): Promise<{
  asset: "NEAR" | "USDC" | "ETH" | "USDT";
  amount: number;
  usdEquivalent: number;
  nearEquivalent: number;
  nearPriceUsd: number;
  conversionExplanation: string;
}> {
  const nearPrice = await getNearUsdPrice();
  const assetUpper = specifiedAsset?.toUpperCase();

  // Case 1: User explicitly said "5 NEAR"
  if (assetUpper === "NEAR") {
    const usdVal = rawAmount * nearPrice;
    return {
      asset: "NEAR",
      amount: rawAmount,
      usdEquivalent: parseFloat(usdVal.toFixed(2)),
      nearEquivalent: rawAmount,
      nearPriceUsd: nearPrice,
      conversionExplanation: `${rawAmount} NEAR ≈ $${usdVal.toFixed(2)} USD (at $${nearPrice.toFixed(2)}/NEAR)`,
    };
  }

  // Case 2: User explicitly said "5 USDC" or "5 USD" without dollar sign
  if (assetUpper === "USDC") {
    const nearVal = parseFloat((rawAmount / nearPrice).toFixed(4));
    return {
      asset: "USDC",
      amount: rawAmount,
      usdEquivalent: rawAmount,
      nearEquivalent: nearVal,
      nearPriceUsd: nearPrice,
      conversionExplanation: `${rawAmount} USDC ($${rawAmount.toFixed(2)} USD)`,
    };
  }

  // Case 3: User explicitly said "0.001 ETH"
  if (assetUpper === "ETH") {
    const ethPrice = await getLiveEthPrice();
    const usdVal = parseFloat((rawAmount * ethPrice).toFixed(2));
    const nearVal = parseFloat((usdVal / nearPrice).toFixed(4));
    return {
      asset: "ETH",
      amount: rawAmount,
      usdEquivalent: usdVal,
      nearEquivalent: nearVal,
      nearPriceUsd: nearPrice,
      conversionExplanation: `${rawAmount} ETH ≈ $${usdVal.toFixed(2)} USD (at $${ethPrice.toFixed(2)}/ETH)`,
    };
  }

  // Case 4: User explicitly said "5 USDT"
  if (assetUpper === "USDT") {
    const nearVal = parseFloat((rawAmount / nearPrice).toFixed(4));
    return {
      asset: "USDT",
      amount: rawAmount,
      usdEquivalent: rawAmount,
      nearEquivalent: nearVal,
      nearPriceUsd: nearPrice,
      conversionExplanation: `${rawAmount} USDT ($${rawAmount.toFixed(2)} USD)`,
    };
  }

  // Case 5: User said "$5" or "5" with no asset specified or "$5 to @handle"
  // On VeilX (native NEAR protocol), USD amounts without specifying USDC are settled in native NEAR!
  const nearAmount = parseFloat((rawAmount / nearPrice).toFixed(4));
  return {
    asset: "NEAR",
    amount: nearAmount,
    usdEquivalent: rawAmount,
    nearEquivalent: nearAmount,
    nearPriceUsd: nearPrice,
    conversionExplanation: `$${rawAmount.toFixed(2)} USD → ${nearAmount} NEAR (live oracle: $${nearPrice.toFixed(2)}/NEAR)`,
  };
}
