// src/app/api/near/pending-tips/route.ts
// Retrieves all pending, unclaimed escrow tips for a given social handle with on-chain verification
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { EscrowTip } from "@/models/EscrowTip";

export const dynamic = "force-dynamic";

const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";

async function verifyTipOnChain(tipId: string): Promise<{ exists: boolean; claimed: boolean }> {
  try {
    const res = await fetch(TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `view_tip_${tipId}`,
        method: "query",
        params: {
          request_type: "call_function",
          finality: "optimistic",
          account_id: CONTRACT_ID,
          method_name: "get_tip",
          args_base64: Buffer.from(JSON.stringify({ tip_id: tipId })).toString("base64"),
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) return { exists: false, claimed: false };
    const data = await res.json();
    if (data.result && data.result.result) {
      const parsed = JSON.parse(Buffer.from(data.result.result).toString("utf8"));
      if (parsed) {
        return { exists: true, claimed: Boolean(parsed.claimed) };
      }
    }
    return { exists: false, claimed: false };
  } catch {
    return { exists: true, claimed: false };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get("handle");

    if (!handle) {
      return NextResponse.json(
        { error: "handle query parameter is required" },
        { status: 400 }
      );
    }

    const cleanHandle = handle.replace("@", "").trim().toLowerCase();
    const baseHandle = cleanHandle.replace(/^_+/, "");
    const possibleHandles = Array.from(new Set([cleanHandle, baseHandle, `_${baseHandle}`]));

    await connectToDatabase();

    const dbTips = await EscrowTip.find({
      recipientHandle: { $in: possibleHandles },
      status: "pending",
    }).sort({ createdAt: -1 });

    // Verify each pending tip on-chain and auto-reconcile claimed ones
    const activePendingTips = [];
    for (const tip of dbTips) {
      const onchain = await verifyTipOnChain(tip.tipId);
      if (onchain.exists && onchain.claimed) {
        // Automatically reconcile database status to claimed
        await EscrowTip.updateOne({ tipId: tip.tipId }, { $set: { status: "claimed", claimedAt: new Date() } });
      } else {
        activePendingTips.push(tip);
      }
    }

    const totalNear = activePendingTips.reduce(
      (sum, tip) => sum + (Number(tip.amountNear) || Number(tip.amount) || 0),
      0
    );

    return NextResponse.json({
      success: true,
      handle: cleanHandle,
      count: activePendingTips.length,
      totalNear: Number(totalNear.toFixed(4)),
      pendingTips: activePendingTips,
    });
  } catch (err: any) {
    console.error("GET /api/near/pending-tips error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
