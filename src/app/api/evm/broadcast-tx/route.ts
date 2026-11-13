// src/app/api/evm/broadcast-tx/route.ts
// Receives an MPC-signed EVM payload from browser, serializes and broadcasts to Base RPC

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { createPublicClient, http, serializeTransaction } from "viem";
import { base, baseSepolia, arbitrumSepolia, sepolia } from "viem/chains";

export const dynamic = "force-dynamic";

const RPC_MAP: Record<number, { chain: any; rpcUrl: string; explorer: string }> = {
  84532: { chain: baseSepolia, rpcUrl: "https://sepolia.base.org", explorer: "https://sepolia.basescan.org" },
  421614: { chain: arbitrumSepolia, rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc", explorer: "https://sepolia.arbiscan.io" },
  11155111: { chain: sepolia, rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io" },
  8453: { chain: base, rpcUrl: "https://mainnet.base.org", explorer: "https://basescan.org" },
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
    const { unsignedTx, signature, chainId: reqChainId } = body;

    if (!unsignedTx || !signature || !signature.r || !signature.s) {
      return NextResponse.json(
        { error: "unsignedTx and valid signature (r, s, yParity) are required" },
        { status: 400 }
      );
    }

    const chainId = reqChainId ? Number(reqChainId) : Number(unsignedTx.chainId) || 84532;
    const config = RPC_MAP[chainId] || RPC_MAP[84532];

    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    const txToSerialize = {
      to: unsignedTx.to as `0x${string}`,
      value: BigInt(unsignedTx.value || 0),
      data: (unsignedTx.data || "0x") as `0x${string}`,
      chainId,
      nonce: Number(unsignedTx.nonce),
      gas: BigInt(unsignedTx.gas),
      maxFeePerGas: BigInt(unsignedTx.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(unsignedTx.maxPriorityFeePerGas),
      type: "eip1559" as const,
    };

    const signedRawTx = serializeTransaction(txToSerialize, {
      r: signature.r as `0x${string}`,
      s: signature.s as `0x${string}`,
      yParity: (Number(signature.yParity) % 2) as 0 | 1,
    });

    let broadcastTxHash: string;
    try {
      broadcastTxHash = await publicClient.sendRawTransaction({
        serializedTransaction: signedRawTx,
      });
      console.log(`[Broadcast TX Success] Network: ${config.chain.name}, TxHash: ${broadcastTxHash}, URL: ${config.explorer}/tx/${broadcastTxHash}`);
    } catch (broadcastErr: any) {
      console.error("[Broadcast TX] sendRawTransaction error:", broadcastErr);
      return NextResponse.json(
        { error: `Base RPC Broadcast Failed: ${broadcastErr.shortMessage || broadcastErr.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      txHash: broadcastTxHash,
      explorerUrl: `${config.explorer}/tx/${broadcastTxHash}`,
    });
  } catch (err: any) {
    console.error("[Broadcast TX API Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to broadcast transaction" },
      { status: 500 }
    );
  }
}
