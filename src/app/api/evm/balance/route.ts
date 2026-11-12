// src/app/api/evm/balance/route.ts
// Queries real-time Universal EVM balances across 7 major EVM chains:
// Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Polygon Amoy, BNB Testnet, Avalanche Fuji, and Ethereum Sepolia
// for a derived NEAR Chain Signatures MPC address

import { NextRequest, NextResponse } from "next/server";
import { deriveEvmAddress } from "@/lib/near-chain-signatures";

export const dynamic = "force-dynamic";

interface RpcChainConfig {
  name: string;
  chainId: number;
  rpcUrls: string[]; // Fallback array of public RPCs
  explorerUrl: string;
  nativeSymbol: string;
  nativeName: string;
  nativePriceUsd: number;
  usdcContract?: string;
  usdtContract?: string;
  usdtDecimals?: number;
  isLayer2?: boolean;
}

const EVM_CHAINS: RpcChainConfig[] = [
  {
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrls: [
      "https://sepolia.base.org",
      "https://base-sepolia-rpc.publicnode.com",
      "https://1rpc.io/base-sepolia",
    ],
    explorerUrl: "https://sepolia.basescan.org",
    nativeSymbol: "ETH",
    nativeName: "Base Ether",
    nativePriceUsd: 2600.0,
    usdcContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    usdtContract: "0x1993cc0773D5A566A6B880b9533f523F40751A25",
    usdtDecimals: 6,
    isLayer2: true,
  },
  {
    name: "Arbitrum Sepolia",
    chainId: 421614,
    rpcUrls: [
      "https://sepolia-rollup.arbitrum.io/rpc",
      "https://arbitrum-sepolia-rpc.publicnode.com",
    ],
    explorerUrl: "https://sepolia.arbiscan.io",
    nativeSymbol: "ETH",
    nativeName: "Arbitrum Ether",
    nativePriceUsd: 2600.0,
    usdcContract: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    usdtContract: "0x64eF33C40232490b414B60F65D6b3ebfa0ea1C26",
    usdtDecimals: 6,
    isLayer2: true,
  },
  {
    name: "Optimism Sepolia",
    chainId: 11155420,
    rpcUrls: [
      "https://sepolia.optimism.io",
      "https://optimism-sepolia-rpc.publicnode.com",
    ],
    explorerUrl: "https://sepolia-optimism.etherscan.io",
    nativeSymbol: "ETH",
    nativeName: "Optimism Ether",
    nativePriceUsd: 2600.0,
    usdcContract: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    usdtContract: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    usdtDecimals: 6,
    isLayer2: true,
  },
  {
    name: "Polygon Amoy",
    chainId: 80002,
    rpcUrls: [
      "https://polygon-amoy-bor-rpc.publicnode.com",
      "https://rpc-amoy.polygon.technology",
    ],
    explorerUrl: "https://amoy.polygonscan.com",
    nativeSymbol: "POL",
    nativeName: "Polygon POL",
    nativePriceUsd: 0.35,
    usdcContract: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    usdtContract: "0xA02f6adc7926efeBBd59Fd43A84f4E0c0c91e832",
    usdtDecimals: 6,
    isLayer2: true,
  },
  {
    name: "BNB Testnet",
    chainId: 97,
    rpcUrls: [
      "https://data-seed-prebsc-1-s1.binance.org:8545",
      "https://bsc-testnet-rpc.publicnode.com",
    ],
    explorerUrl: "https://testnet.bscscan.com",
    nativeSymbol: "BNB",
    nativeName: "BNB",
    nativePriceUsd: 580.0,
    usdtContract: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
    usdtDecimals: 18,
    isLayer2: false,
  },
  {
    name: "Avalanche Fuji",
    chainId: 43113,
    rpcUrls: [
      "https://api.avax-test.network/ext/bc/C/rpc",
      "https://avalanche-fuji-c-chain-rpc.publicnode.com",
    ],
    explorerUrl: "https://testnet.snowtrace.io",
    nativeSymbol: "AVAX",
    nativeName: "Avalanche AVAX",
    nativePriceUsd: 28.0,
    usdcContract: "0x5425890298aed601595a70ab815c96711a31bc65",
    isLayer2: false,
  },
  {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    rpcUrls: [
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://rpc.sepolia.org",
      "https://1rpc.io/sepolia",
    ],
    explorerUrl: "https://sepolia.etherscan.io",
    nativeSymbol: "ETH",
    nativeName: "Ethereum Ether",
    nativePriceUsd: 2600.0,
    usdcContract: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    usdtContract: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
    usdtDecimals: 6,
    isLayer2: false,
  },
];

interface CacheEntry {
  timestamp: number;
  data: any;
}
const balanceMemoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15_000; // 15-second fast cache

// Batch query native balance + ERC20 in a single RPC JSON-RPC batch call with multi-RPC fallback
async function queryChainBalancesWithFallback(
  chain: RpcChainConfig,
  address: string
): Promise<{ nativeBal: string | null; usdcBal: string | null; usdtBal: string | null }> {
  const padded = address.toLowerCase().replace("0x", "").padStart(64, "0");
  const erc20CallData = `0x70a08231${padded}`;

  for (const rpcUrl of chain.rpcUrls) {
    const controller = new AbortController();
    const timeoutMs = chain.name === "Base Sepolia" || chain.name === "Arbitrum Sepolia" ? 7000 : 4000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const batchPayload: any[] = [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBalance",
          params: [address, "latest"],
        },
      ];

      if (chain.usdcContract) {
        batchPayload.push({
          jsonrpc: "2.0",
          id: 2,
          method: "eth_call",
          params: [{ to: chain.usdcContract, data: erc20CallData }, "latest"],
        });
      }

      if (chain.usdtContract) {
        batchPayload.push({
          jsonrpc: "2.0",
          id: 3,
          method: "eth_call",
          params: [{ to: chain.usdtContract, data: erc20CallData }, "latest"],
        });
      }

      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchPayload),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const responses = await res.json();
      if (!Array.isArray(responses)) {
        // Fallback for RPCs that don't support JSON-RPC batching: fallback to eth_getBalance
        const hex = (responses as any)?.result || "0x0";
        const wei = BigInt(hex);
        return {
          nativeBal: (Number(wei) / 1e18).toFixed(4),
          usdcBal: null,
          usdtBal: null,
        };
      }

      const ethRes = responses.find((r) => r.id === 1);
      const usdcRes = responses.find((r) => r.id === 2);
      const usdtRes = responses.find((r) => r.id === 3);

      let nativeBal: string | null = null;
      let usdcBal: string | null = null;
      let usdtBal: string | null = null;

      if (ethRes && ethRes.result) {
        const wei = BigInt(ethRes.result === "0x" ? "0x0" : ethRes.result);
        nativeBal = (Number(wei) / 1e18).toFixed(4);
      }

      if (usdcRes && usdcRes.result && usdcRes.result !== "0x") {
        const raw = BigInt(usdcRes.result);
        usdcBal = (Number(raw) / 1e6).toFixed(2);
      } else if (chain.usdcContract) {
        usdcBal = "0.00";
      }

      if (usdtRes && usdtRes.result && usdtRes.result !== "0x") {
        const raw = BigInt(usdtRes.result);
        const dec = chain.usdtDecimals || 6;
        usdtBal = (Number(raw) / 10 ** dec).toFixed(2);
      } else if (chain.usdtContract) {
        usdtBal = "0.00";
      }

      if (nativeBal !== null) {
        return { nativeBal, usdcBal, usdtBal };
      }
    } catch {
      clearTimeout(timeoutId);
      // Try next fallback RPC
      continue;
    }
  }

  // If all public RPCs fail, return null so SWR preserves last confirmed balance!
  return { nativeBal: null, usdcBal: null, usdtBal: null };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let address = searchParams.get("address");
    const accountId = searchParams.get("accountId");

    if (!address && accountId) {
      const derived = deriveEvmAddress(accountId);
      address = derived.checksumAddress;
    }

    if (!address) {
      return NextResponse.json(
        { success: false, error: "Missing 'address' or 'accountId' parameter" },
        { status: 400 }
      );
    }

    const cleanAddress = address.trim();
    const cacheKey = cleanAddress.toLowerCase();
    const cached = balanceMemoryCache.get(cacheKey);

    // Fast-path: Return cached balance within CACHE_TTL_MS
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
      });
    }
    const USDC_PRICE_USD = 1.0;

    // Prioritize active Layer2s (Base & Arbitrum & Ethereum) concurrently
    const chainQueries = await Promise.allSettled(
      EVM_CHAINS.map(async (chain) => {
        const result = await queryChainBalancesWithFallback(chain, cleanAddress);
        return { chain, ...result };
      })
    );

    // Stale-While-Revalidate: build map from previous cache if available
    const previousHoldings = new Map<string, any>();
    if (cached?.data?.holdings) {
      for (const h of cached.data.holdings) {
        previousHoldings.set(`${h.network}_${h.symbol}`, h);
      }
    }

    const holdings: any[] = [];
    let baseEth = cached?.data?.ethBalance || "0.0000";
    let baseUsdc = cached?.data?.usdcBalance || "0.00";
    let totalEvmUsd = 0;

    for (const res of chainQueries) {
      if (res.status === "fulfilled") {
        const { chain, nativeBal, usdcBal, usdtBal } = res.value;

        // Resolve native balance with SWR fallback if RPC timed out
        const prevNative = previousHoldings.get(`${chain.name}_${chain.nativeSymbol}`);
        const finalNative = nativeBal !== null ? nativeBal : (prevNative?.balance || "0.0000");
        const numNative = parseFloat(finalNative) || 0;

        if (chain.name === "Base Sepolia" && nativeBal !== null) {
          baseEth = finalNative;
        }

        const nativeValUsd = Number((numNative * chain.nativePriceUsd).toFixed(2));
        totalEvmUsd += nativeValUsd;
        holdings.push({
          network: chain.name,
          chainId: chain.chainId,
          symbol: chain.nativeSymbol,
          name: chain.nativeName,
          balance: finalNative,
          usdPrice: chain.nativePriceUsd,
          valueUsd: nativeValUsd,
          explorerUrl: `${chain.explorerUrl}/address/${cleanAddress}`,
          isNative: true,
        });

        // Resolve USDC balance with SWR fallback if RPC timed out
        if (chain.usdcContract) {
          const prevUsdc = previousHoldings.get(`${chain.name}_USDC`);
          const finalUsdc = usdcBal !== null ? usdcBal : (prevUsdc?.balance || "0.00");
          const numUsdc = parseFloat(finalUsdc) || 0;

          if (chain.name === "Base Sepolia" && usdcBal !== null) {
            baseUsdc = finalUsdc;
          }

          const usdcValUsd = Number((numUsdc * USDC_PRICE_USD).toFixed(2));
          totalEvmUsd += usdcValUsd;
          holdings.push({
            network: chain.name,
            chainId: chain.chainId,
            symbol: "USDC",
            name: "USD Coin (Circle)",
            balance: finalUsdc,
            usdPrice: USDC_PRICE_USD,
            valueUsd: usdcValUsd,
            contractAddress: chain.usdcContract,
            explorerUrl: `${chain.explorerUrl}/token/${chain.usdcContract}?a=${cleanAddress}`,
            isNative: false,
          });
        }

        // Resolve USDT balance with SWR fallback if RPC timed out
        if (chain.usdtContract) {
          const prevUsdt = previousHoldings.get(`${chain.name}_USDT`);
          const finalUsdt = usdtBal !== null ? usdtBal : (prevUsdt?.balance || "0.00");
          const numUsdt = parseFloat(finalUsdt) || 0;

          if (numUsdt > 0) {
            const usdtValUsd = Number((numUsdt * 1.0).toFixed(2));
            totalEvmUsd += usdtValUsd;
            holdings.push({
              network: chain.name,
              chainId: chain.chainId,
              symbol: "USDT",
              name: "Tether USD",
              balance: finalUsdt,
              usdPrice: 1.0,
              valueUsd: usdtValUsd,
              contractAddress: chain.usdtContract,
              explorerUrl: `${chain.explorerUrl}/token/${chain.usdtContract}?a=${cleanAddress}`,
              isNative: false,
            });
          }
        }
      }
    }

    const responseData = {
      address: cleanAddress,
      chain: "Universal EVM (Base · Arbitrum · Optimism · Polygon · BNB · Avalanche · Ethereum)",
      supportedChains: EVM_CHAINS.map((c) => c.name),
      ethBalance: baseEth, // Maintained for legacy compatibility
      usdcBalance: baseUsdc, // Maintained for legacy compatibility
      totalEvmUsd: Number(totalEvmUsd.toFixed(2)),
      holdings,
      explorerUrl: `https://sepolia.basescan.org/address/${cleanAddress}`,
      faucetUrl: "https://faucet.circle.com/",
    };

    balanceMemoryCache.set(cacheKey, {
      timestamp: Date.now(),
      data: responseData,
    });

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (err: any) {
    console.error("[EVM Multi-Chain Balance API Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch EVM balances" },
      { status: 500 }
    );
  }
}
