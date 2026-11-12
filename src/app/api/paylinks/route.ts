import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { PayLink } from "@/models/PayLink";
import { Transaction } from "@/models/Transaction";
import { sendTelegramReply } from "@/lib/telegram-bot";
import { verifyNearTransactionOutcome } from "@/lib/near-rpc";
import { verifySessionToken } from "@/lib/session";
import { getLiveNearPrice } from "@/lib/oracle-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creator = searchParams.get("creator") || "expatq3";
    const slug = searchParams.get("slug");

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please verify MongoDB Atlas IP access whitelist." },
        { status: 503 }
      );
    }

    if (slug) {
      const paylink = await PayLink.findOne({ slug });
      if (!paylink) {
        return NextResponse.json({ error: "PayLink not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, paylink });
    }

    const cleanCreator = creator.replace("@", "").trim();
    const paylinks = await PayLink.find({ creatorHandle: cleanCreator })
      .sort({ createdAt: -1 })
      .limit(30);

    return NextResponse.json({
      success: true,
      paylinks,
    });
  } catch (err: any) {
    console.error("GET /api/paylinks error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      slug,
      creatorHandle = "expatq3",
      recipientNearAccount,
      amountUsd,
      memo = "Payment Request",
      isPrivate = false,
      memoCiphertext,
      memoIv,
      memoTag,
      recipientCommitment,
      supportedChains = ["Base (USDC)", "Solana (SOL)", "NEAR (USDC)"],
    } = body;

    if (!slug || !recipientNearAccount || !amountUsd) {
      return NextResponse.json(
        { error: "slug, recipientNearAccount, and amountUsd are required" },
        { status: 400 }
      );
    }

    const cleanCreator = creatorHandle.replace("@", "").trim();
    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please verify MongoDB Atlas IP access whitelist." },
        { status: 503 }
      );
    }

    const newPayLink = await PayLink.create({
      slug,
      creatorHandle: cleanCreator,
      recipientNearAccount,
      amountUsd: Number(amountUsd),
      memo: isPrivate ? "[Encrypted Private Memo]" : memo,
      isPrivate: Boolean(isPrivate),
      memoCiphertext: memoCiphertext || undefined,
      memoIv: memoIv || undefined,
      memoTag: memoTag || undefined,
      recipientCommitment: recipientCommitment || undefined,
      supportedChains,
      status: "active",
    });

    return NextResponse.json({
      success: true,
      paylink: newPayLink,
    });
  } catch (err: any) {
    console.error("POST /api/paylinks error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { slug, status = "settled", settledTx, payerHandle, payerWallet, amountNear } = await req.json();

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json(
        { error: "Database temporarily unavailable." },
        { status: 503 }
      );
    }

    const existing = await PayLink.findOne({ slug });
    if (!existing) {
      return NextResponse.json({ error: "PayLink not found" }, { status: 404 });
    }

    // If already settled, do not allow double settlement or status rewind
    if (existing.status === "settled") {
      return NextResponse.json({
        success: true,
        paylink: existing,
        message: "Invoice is already settled on-chain",
      });
    }

    // Cancellation requires session matching creator
    if (status === "cancelled") {
      const cookieStore = cookies();
      const sessionCookie = cookieStore.get("veilx_session")?.value;
      const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;
      const cleanCreator = existing.creatorHandle.replace("@", "").toLowerCase();

      if (!sessionUser || sessionUser.xHandle?.toLowerCase() !== cleanCreator) {
        return NextResponse.json(
          { error: "Unauthorized: Only the invoice creator can cancel this invoice" },
          { status: 403 }
        );
      }
    }

    // Settlement requires on-chain cryptographic receipt verification via NEAR RPC
    if (status === "settled") {
      if (!settledTx || typeof settledTx !== "string" || settledTx.trim().length < 32) {
        return NextResponse.json(
          { error: "Valid on-chain transaction hash (settledTx) is required to settle an invoice" },
          { status: 400 }
        );
      }

      // Calculate required deposit in NEAR from amountNear or existing.amountUsd converted via live price
      let minDepositNear: number | undefined = undefined;
      const parsedAmountNear = typeof amountNear === "number" ? amountNear : parseFloat(amountNear || "0");
      if (!isNaN(parsedAmountNear) && parsedAmountNear > 0) {
        minDepositNear = parsedAmountNear;
      } else if (existing.amountUsd && existing.amountUsd > 0) {
        try {
          const livePrice = await getLiveNearPrice();
          const safePrice = livePrice > 0 ? livePrice : 5.0;
          minDepositNear = existing.amountUsd / safePrice;
        } catch {
          minDepositNear = existing.amountUsd / 5.0; // fallback if oracle unavailable
        }
      }

      const targetAccount = existing.recipientNearAccount || "veilx-agent.testnet";
      const txCheck = await verifyNearTransactionOutcome(
        settledTx,
        targetAccount,
        minDepositNear
      );

      if (!txCheck.success) {
        return NextResponse.json(
          { error: `On-chain settlement verification failed: ${txCheck.error}` },
          { status: 400 }
        );
      }
    }

    existing.status = status;
    if (settledTx) {
      existing.settledTx = settledTx;
    }
    await existing.save();

    const updated = existing;

    // When invoice is settled, automatically write inflow & outflow transaction records to MongoDB
    if (status === "settled" && settledTx) {
      const cleanCreator = updated.creatorHandle.replace("@", "").trim();
      const cleanPayer = payerHandle ? payerHandle.replace("@", "").trim() : "Anonymous Payer";

      try {
        // 1. Inflow record for Recipient (Creator)
        await Transaction.create({
          userHandle: cleanCreator,
          txHash: settledTx,
          type: "invoice_received",
          counterparty: `@${cleanPayer}`,
          amountUsd: Number(updated.amountUsd) || 0,
          asset: "NEAR",
          status: "completed",
          statusLabel: "Paid & Settled",
          memo: `Received payment for "${updated.memo || updated.slug}"`,
          isInflow: true,
        });

        // 2. Outflow record for Payer
        if (payerHandle) {
          await Transaction.create({
            userHandle: cleanPayer,
            txHash: settledTx,
            type: "direct_deposit",
            counterparty: `@${cleanCreator}`,
            amountUsd: Number(updated.amountUsd) || 0,
            asset: "NEAR",
            status: "completed",
            statusLabel: "Paid Invoice",
            memo: `Paid Invoice: ${updated.memo || updated.slug}`,
            isInflow: false,
          });
        }

        // 3. Dispatch Telegram alert if creator has a Telegram user ID
        const tgIdMatch = cleanCreator.match(/^tg_(\d+)$/);
        if (tgIdMatch) {
          const chatId = parseInt(tgIdMatch[1], 10);
          await sendTelegramReply({
            chatId,
            text: `🎉 <b>Invoice Settled!</b>\n\n` +
              `💰 <b>Amount:</b> $${Number(updated.amountUsd).toFixed(2)} USD${amountNear ? ` (${amountNear} NEAR)` : ""}\n` +
              `👤 <b>From:</b> @${cleanPayer}\n` +
              `📝 <b>For:</b> ${updated.memo || updated.slug}\n` +
              `🔗 <b>Tx:</b> <code>${settledTx.slice(0, 16)}...</code>\n\n` +
              `Funds have settled directly into your NEAR wallet!`,
            parseMode: "HTML",
          });
        }
      } catch (txErr: any) {
        console.warn("[PATCH /api/paylinks] Failed to record transaction entries:", txErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      paylink: updated,
    });
  } catch (err: any) {
    console.error("PATCH /api/paylinks error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
