// src/app/api/evm/prepare-tx/route.ts
// Prepares an unsigned EVM transaction payload for in-browser NEAR MPC signing
// Computes dynamic EIP-1559 fees, nonces, and 32-byte Keccak-256 payload hash

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { createPublicClient, http, keccak256, serializeTransaction } from "viem";
import { base, baseSepolia, arbitrumSepolia, sepolia } from "viem/chains";
import {
  deriveEvmAddress,
  encodeErc20TransferData,
  NEAR_MPC_CONTRACT_TESTNET,
} from "@/lib/near-chain-signatures";

export const dynamic = "force-dynamic";

interface ChainConfig {
  chainId: number;
  chain: any;
  rpcUrl: string;
  name: string;
  usdcContract: `0x${string}`;
  usdtContract?: `0x${string}`;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  base: {
    chainId: 84532,
    chain: baseSepolia,
    rpcUrl: "https://sepolia.base.org",
    name: "Base Sepolia",
    usdcContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    usdtContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Default testnet stablecoin
  },
  arbitrum: {
    chainId: 421614,
    chain: arbitrumSepolia,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    name: "Arbitrum Sepolia",
    usdcContract: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  },
  ethereum: {
    chainId: 11155111,
    chain: sepolia,
    rpcUrl: "https://rpc.sepolia.org",
    name: "Ethereum Sepolia",
    usdcContract: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
};

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const sessionUser = verifySessionToken(sessionCookie);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized: Invalid or expired session" }, { status: 401 });
    }

    const body = await req.json();
    const {
      senderNearAccountId,
      recipientAddress,
      amount = "5.0",
      amountEth,
      asset = "USDC",
      chain: reqChain,
      derivationPath = "ethereum,1",
      chainId: reqChainId,
    } = body;

    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      return NextResponse.json(
        { error: "Valid 0x recipientAddress is required" },
        { status: 400 }
      );
    }

    if (!senderNearAccountId) {
      return NextResponse.json(
        { error: "senderNearAccountId is required" },
        { status: 400 }
      );
    }

    // Resolve target chain config
    let config = CHAIN_CONFIGS.base;
    const chainKey = (reqChain || "").toLowerCase();
    if (chainKey.includes("arb")) {
      config = CHAIN_CONFIGS.arbitrum;
    } else if (chainKey.includes("eth") || chainKey.includes("sepolia")) {
      config = CHAIN_CONFIGS.ethereum;
    } else if (reqChainId) {
      const match = Object.values(CHAIN_CONFIGS).find((c) => c.chainId === Number(reqChainId));
      if (match) config = match;
    }

    const { chainId, chain, rpcUrl, name: chainName, usdcContract } = config;

    const { checksumAddress } = deriveEvmAddress(senderNearAccountId, derivationPath);

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    // 1. Resolve pending nonce
    let nonce = 0;
    try {
      nonce = await publicClient.getTransactionCount({
        address: checksumAddress as `0x${string}`,
        blockTag: "pending",
      });
    } catch {
      nonce = 0;
    }

    // 2. EIP-1559 fee calculation
    let baseFeePerGas = BigInt(5000000);
    try {
      const latestBlock = await publicClient.getBlock({ blockTag: "latest" });
      if (latestBlock?.baseFeePerGas) {
        baseFeePerGas = latestBlock.baseFeePerGas;
      }
    } catch {}

    let estimatePriorityFee = BigInt(1000000);
    try {
      const estimated = await publicClient.estimateMaxPriorityFeePerGas();
      if (estimated) {
        estimatePriorityFee = estimated;
      }
    } catch {}

    let maxPriorityFeePerGas =
      estimatePriorityFee > baseFeePerGas / BigInt(2)
        ? baseFeePerGas / BigInt(2) + BigInt(1)
        : estimatePriorityFee;

    let maxFeePerGas = (baseFeePerGas * BigInt(15)) / BigInt(10) + maxPriorityFeePerGas;
    if (maxFeePerGas < maxPriorityFeePerGas) {
      maxFeePerGas = maxPriorityFeePerGas;
    }

    let toAddress: `0x${string}`;
    let value: bigint;
    let data: `0x${string}`;
    let gas: bigint;

    const normalizedAsset = (asset || "USDC").toUpperCase();

    if (normalizedAsset === "USDC" || normalizedAsset === "USDT") {
      toAddress = (normalizedAsset === "USDT" && config.usdtContract) ? config.usdtContract : usdcContract;
      value = BigInt(0);
      const amountVal = amount ?? amountEth ?? "5.0";
      data = encodeErc20TransferData(recipientAddress, amountVal, 6);
      gas = BigInt(65000);
      try {
        const estimatedGas = await publicClient.estimateGas({
          account: checksumAddress as `0x${string}`,
          to: toAddress,
          data,
          value: BigInt(0),
        });
        if (estimatedGas) {
          gas = (estimatedGas * BigInt(12)) / BigInt(10);
          if (gas < BigInt(65000)) gas = BigInt(65000);
        }
      } catch {
        gas = BigInt(65000);
      }
    } else {
      toAddress = recipientAddress as `0x${string}`;
      const ethStr = amountEth ?? amount ?? "0.001";
      value = BigInt(Math.round(parseFloat(ethStr.toString()) * 1e18));
      data = "0x" as `0x${string}`;
      gas = BigInt(21000);
    }

    // 3. Pre-flight native gas balance check
    const senderBalance = await publicClient.getBalance({ address: checksumAddress as `0x${string}` });
    const estimatedCost = gas * maxFeePerGas + value;

    if (senderBalance < estimatedCost) {
      const requiredEth = (Number(estimatedCost) / 1e18).toFixed(6);
      const currentEth = (Number(senderBalance) / 1e18).toFixed(6);
      return NextResponse.json(
        {
          error: `Gas Fee Error: Insufficient native ETH on ${chainName}. Required: ~${requiredEth} ETH to cover gas, but your wallet holds ${currentEth} ETH. Please deposit a small amount of ETH on ${chainName} to fund gas.`,
        },
        { status: 400 }
      );
    }

    const unsignedTx = {
      to: toAddress,
      value: value.toString(),
      data,
      chainId,
      nonce,
      gas: gas.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      type: "eip1559" as const,
    };

    const txForSerialization = {
      ...unsignedTx,
      value,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };

    const unsignedRaw = serializeTransaction(txForSerialization);
    const txHashHex = keccak256(unsignedRaw);
    const txPayloadHash = Array.from(Buffer.from(txHashHex.slice(2), "hex"));

    return NextResponse.json({
      success: true,
      unsignedTx,
      txPayloadHash,
      derivationPath,
      chainName,
      chainId,
      senderEvmAddress: checksumAddress,
      mpcContractId: NEAR_MPC_CONTRACT_TESTNET,
      estimatedCostEth: (Number(estimatedCost) / 1e18).toFixed(6),
    });
  } catch (err: any) {
    console.error("[Prepare TX API Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to prepare EVM transaction" },
      { status: 500 }
    );
  }
}
