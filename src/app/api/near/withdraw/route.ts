import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { Transaction } from "@/models/Transaction";
import { User } from "@/models/User";
import { verifySessionToken } from "@/lib/session";
import { verifyNearTransactionOutcome } from "@/lib/near-rpc";
import { getLiveNearPrice } from "@/lib/oracle-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { senderWallet, recipientAccount, amountNear, userHandle, txHash } = body;

    // Reject insecure client-side private key transmission
    if (body.senderPrivateKey) {
      return NextResponse.json(
        { error: "Insecure private key transmission prohibited" },
        { status: 400 }
      );
    }

    if (!senderWallet || !recipientAccount || !amountNear) {
      return NextResponse.json({ error: "Missing required withdrawal fields" }, { status: 400 });
    }

    // Require active authenticated session matching userHandle
    if (userHandle) {
      const cleanHandle = userHandle.replace("@", "").trim().toLowerCase();
      const cookieStore = cookies();
      const sessionCookie = cookieStore.get("veilx_session")?.value;
      const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

      if (!sessionUser || sessionUser.xHandle?.toLowerCase() !== cleanHandle) {
        return NextResponse.json(
          { error: "Unauthorized: Active session matching handle required for withdrawal" },
          { status: 401 }
        );
      }
    }

    const numAmount = parseFloat(amountNear.toString());
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Invalid withdrawal amount" }, { status: 400 });
    }

    const cleanRecipient = recipientAccount.trim().toLowerCase();
    const cleanTx = (txHash || "").trim();

    // Non-Custodial Client-Side Signing Flow (Private key never touches server)
    if (!cleanTx || cleanTx.length < 32) {
      return NextResponse.json(
        { error: "Non-custodial client signed transaction hash (txHash) is required" },
        { status: 400 }
      );
    }

    const verifyOutcome = await verifyNearTransactionOutcome(cleanTx, senderWallet);
    if (!verifyOutcome.success) {
      return NextResponse.json(
        { error: `On-chain transaction verification failed: ${verifyOutcome.error}` },
        { status: 400 }
      );
    }

    const liveNearPrice = await getLiveNearPrice();
    await connectToDatabase();
    if (userHandle) {
      await Transaction.create({
        userHandle: userHandle.replace("@", "").trim().toLowerCase(),
        txHash: cleanTx,
        type: "withdrawal",
        counterparty: cleanRecipient,
        amountUsd: Number((numAmount * liveNearPrice).toFixed(2)),
        asset: "NEAR",
        status: "completed",
        statusLabel: "Withdrawn to External Wallet",
        memo: `Transferred ${numAmount} NEAR to ${cleanRecipient}`,
        isInflow: false,
      });

      const withdrawUsd = Number((numAmount * liveNearPrice).toFixed(2));
      await User.updateOne(
        { xHandle: userHandle.replace("@", "").trim().toLowerCase() },
        {
          $inc: { spentUsd: withdrawUsd, weeklySpentUsd: withdrawUsd },
        }
      );
    }

    return NextResponse.json({
      success: true,
      txHash: cleanTx,
      recipientAccount: cleanRecipient,
      amountNear: numAmount,
      explorerUrl: `https://testnet.nearblocks.io/txns/${cleanTx}`,
    });
  } catch (err: any) {
    console.error("Withdrawal execution error:", err);
    return NextResponse.json({ error: err.message || "Failed to process withdrawal" }, { status: 500 });
  }
}
