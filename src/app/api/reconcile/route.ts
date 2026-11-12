// src/app/api/reconcile/route.ts
// Background reconciliation worker: Synchronizes on-chain escrow states with MongoDB
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { EscrowTip } from "@/models/EscrowTip";
import { Transaction } from "@/models/Transaction";
import { PayLink } from "@/models/PayLink";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";

export async function GET(req: Request) {
  return handleReconciliation(req);
}

export async function POST(req: Request) {
  return handleReconciliation(req);
}

async function handleReconciliation(req: Request) {
  try {
    await connectToDatabase();

    let reconciledCount = 0;
    let locksReleased = 0;

    // 1. Auto-release stuck claiming locks older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const releaseResult = await EscrowTip.updateMany(
      {
        status: "claiming",
        claimLockedAt: { $lt: fiveMinutesAgo },
      },
      {
        $set: { status: "pending" },
        $unset: { claimLockedAt: 1 },
      }
    );
    locksReleased = releaseResult.modifiedCount || 0;

    // 2. Query pending tips and check on-chain status
    const pendingTips = await EscrowTip.find({
      status: { $in: ["pending", "claiming"] },
    })
      .sort({ createdAt: -1 })
      .limit(25);

    for (const tip of pendingTips) {
      try {
        const rpcRes = await fetch(TESTNET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `reconcile_${tip.tipId}`,
            method: "query",
            params: {
              request_type: "call_function",
              finality: "final",
              account_id: CONTRACT_ID,
              method_name: "get_tip",
              args_base64: Buffer.from(JSON.stringify({ tip_id: tip.tipId })).toString("base64"),
            },
          }),
        });

        const rpcData = await rpcRes.json();
        if (rpcData.result?.result) {
          const rawBytes = Buffer.from(rpcData.result.result);
          const onChainTip = JSON.parse(rawBytes.toString("utf8"));

          if (onChainTip && onChainTip.claimed === true) {
            tip.status = "claimed";
            tip.claimedAt = new Date();
            await tip.save();

            // Ensure inflow transaction record is marked completed
            await Transaction.updateMany(
              {
                userHandle: tip.recipientHandle.toLowerCase(),
                txHash: tip.depositTxHash,
              },
              {
                $set: {
                  status: "completed",
                  statusLabel: "Claimed & Settled",
                },
              }
            );

            reconciledCount++;
          }
        }
      } catch (err: any) {
        console.warn(`[Reconcile] Error checking tip ${tip.tipId}:`, err.message);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      reconciledTips: reconciledCount,
      locksReleased,
      checkedCount: pendingTips.length,
    });
  } catch (err: any) {
    console.error("[Reconcile Worker Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
