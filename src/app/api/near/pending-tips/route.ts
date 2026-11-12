// src/app/api/near/pending-tips/route.ts
// Retrieves all pending, unclaimed escrow tips for a given social handle
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { EscrowTip } from "@/models/EscrowTip";

export const dynamic = "force-dynamic";

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

    const pendingTips = await EscrowTip.find({
      recipientHandle: { $in: possibleHandles },
      status: "pending",
    }).sort({ createdAt: -1 });

    const totalNear = pendingTips.reduce(
      (sum, tip) => sum + (Number(tip.amountNear) || Number(tip.amount) || 0),
      0
    );

    return NextResponse.json({
      success: true,
      handle: cleanHandle,
      count: pendingTips.length,
      totalNear: Number(totalNear.toFixed(4)),
      pendingTips,
    });
  } catch (err: any) {
    console.error("GET /api/near/pending-tips error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
