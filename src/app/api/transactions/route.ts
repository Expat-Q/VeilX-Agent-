import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { Transaction } from "@/models/Transaction";
import { verifySessionToken } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get("handle") || "expatq3";
    const cleanHandle = handle.replace("@", "").trim().toLowerCase();
    const baseHandle = cleanHandle.replace(/^_+/, "");
    const possibleHandles = Array.from(new Set([cleanHandle, baseHandle, `_${baseHandle}`]));

    await connectToDatabase();

    const transactions = await Transaction.find({ userHandle: { $in: possibleHandles } })
      .sort({ createdAt: -1 })
      .limit(50);

    return NextResponse.json({
      success: true,
      transactions,
    });
  } catch (err: any) {
    console.error("GET /api/transactions error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userHandle = "expatq3",
      txHash,
      type,
      counterparty,
      amountUsd,
      asset = "USDC",
      status = "completed",
      statusLabel,
      memo,
      isInflow,
    } = body;

    const cleanHandle = userHandle.replace("@", "").trim().toLowerCase();

    // Require active authenticated session matching the userHandle
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!sessionUser || sessionUser.xHandle?.toLowerCase() !== cleanHandle) {
      return NextResponse.json(
        { error: "Unauthorized: Active authenticated session matching user handle is required" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Prevent duplicate transaction entry for the same hash and user
    if (txHash && typeof txHash === "string" && txHash.trim().length >= 10) {
      const cleanTxHash = txHash.trim();
      const existing = await Transaction.findOne({ txHash: cleanTxHash, userHandle: cleanHandle });
      if (existing) {
        return NextResponse.json({
          success: true,
          transaction: existing,
          message: "Transaction already recorded",
        });
      }
    }

    const newTx = await Transaction.create({
      userHandle: cleanHandle,
      txHash: txHash ? txHash.trim() : `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      counterparty,
      amountUsd: Number(amountUsd) || 0,
      asset,
      status,
      statusLabel: statusLabel || status,
      memo,
      isInflow: Boolean(isInflow),
    });

    return NextResponse.json({
      success: true,
      transaction: newTx,
    });
  } catch (err: any) {
    console.error("POST /api/transactions error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
