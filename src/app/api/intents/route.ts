// src/app/api/intents/route.ts
// NEAR Intents & 1Click Order Creation and Settlement Tracking API

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { IntentOrder } from "@/models/IntentOrder";
import { createIntentOrder, get1ClickExecutionStatus } from "@/lib/1click";
import { verifySessionToken } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sourceChain = "NEAR",
      sourceAsset = "NEAR",
      targetChain = "BASE",
      targetAsset = "USDC",
      amount,
      recipient,
      senderHandle,
      senderWallet,
    } = body;

    if (!amount || !recipient) {
      return NextResponse.json(
        { error: "amount and recipient are required" },
        { status: 400 }
      );
    }

    const orderDetails = await createIntentOrder({
      sourceChain,
      sourceAssetSymbol: sourceAsset,
      targetChain,
      targetAssetSymbol: targetAsset,
      amount: Number(amount),
      recipient,
    });

    let dbId: any = undefined;
    try {
      await connectToDatabase();
      const intentDoc = await IntentOrder.create({
        orderId: orderDetails.orderId,
        depositAddress: orderDetails.depositAddress,
        senderHandle,
        senderWallet,
        recipient,
        sourceChain: orderDetails.sourceChain,
        sourceAsset: orderDetails.sourceAsset,
        sourceAmount: orderDetails.sourceAmount,
        targetChain: orderDetails.targetChain,
        targetAsset: orderDetails.targetAsset,
        targetAmount: orderDetails.targetAmount,
        estimatedFeeUsd: orderDetails.estimatedFeeUsd,
        status: "created",
        expiresAt: new Date(orderDetails.expiresAt),
      });
      dbId = intentDoc._id;
    } catch (dbErr) {
      console.warn("[API Intents] MongoDB persistence warning (non-fatal):", dbErr);
    }

    return NextResponse.json({
      success: true,
      order: orderDetails,
      dbId,
    });
  } catch (err: any) {
    console.error("[API Intents] Order creation failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create intent order" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    const depositAddress = searchParams.get("depositAddress");

    if (!orderId && !depositAddress) {
      return NextResponse.json(
        { error: "Missing orderId or depositAddress parameter" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const query: Record<string, any> = {};
    if (orderId) query.orderId = orderId;
    if (depositAddress) query.depositAddress = depositAddress;

    const intent = await IntentOrder.findOne(query);
    if (!intent) {
      return NextResponse.json({ error: "Intent order not found" }, { status: 404 });
    }

    // Optionally check 1Click status if not final
    if (intent.status !== "success" && intent.status !== "refunded" && intent.depositAddress) {
      try {
        const liveStatus = await get1ClickExecutionStatus(intent.depositAddress);
        if (liveStatus.status === "SUCCESS") {
          intent.status = "success";
          if (liveStatus.destinationTxHash) intent.destinationTxHash = liveStatus.destinationTxHash;
          await intent.save();
        }
      } catch (e) {
        console.warn("[API Intents] Error checking live 1Click status:", e);
      }
    }

    return NextResponse.json({
      success: true,
      intent,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to query intent order" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized: Active authenticated session is required to update intent orders" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { orderId, depositAddress, status, depositTxHash, destinationTxHash } = body;

    if (!orderId && !depositAddress) {
      return NextResponse.json(
        { error: "orderId or depositAddress is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const query = orderId ? { orderId } : { depositAddress };
    const intent = await IntentOrder.findOne(query);

    if (!intent) {
      return NextResponse.json({ error: "Intent order not found" }, { status: 404 });
    }

    // Ownership check: If senderHandle is recorded, verify against session
    if (intent.senderHandle && intent.senderHandle.toLowerCase() !== sessionUser.xHandle?.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to update this intent order" },
        { status: 403 }
      );
    }

    if (status) intent.status = status;
    if (depositTxHash) intent.depositTxHash = depositTxHash;
    if (destinationTxHash) intent.destinationTxHash = destinationTxHash;

    await intent.save();

    return NextResponse.json({
      success: true,
      intent,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update intent order" },
      { status: 500 }
    );
  }
}
