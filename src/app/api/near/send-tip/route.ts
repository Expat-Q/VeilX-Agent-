import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as nearAPI from "near-api-js";
import { connectToDatabase } from "@/lib/mongodb";
import { EscrowTip } from "@/models/EscrowTip";
import { Transaction } from "@/models/Transaction";
import { User } from "@/models/User";
import { verifySessionToken } from "@/lib/session";
import { verifyNearTransactionOutcome } from "@/lib/near-rpc";
import { getLiveNearPrice } from "@/lib/oracle-service";
import { sanitizeNearAccountId } from "@/lib/near-utils";
import { computeCommitmentHash, generatePrivacySalt } from "@/lib/encryption";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;

export async function POST(req: Request) {
  try {
    const {
      recipientHandle,
      amount,
      asset = "NEAR",
      senderHandle,
      senderWallet,
      senderPrivateKey,
      txHash: clientTxHash,
      isDirectTransfer = false,
      isPrivate = false,
    } = await req.json();

    if (!recipientHandle || !amount) {
      return NextResponse.json(
        { error: "recipientHandle and amount are required" },
        { status: 400 }
      );
    }

    const tipId = `tip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanHandle = recipientHandle.replace("@", "").trim();
    const cleanSender = senderHandle ? senderHandle.replace("@", "").trim().toLowerCase() : null;
    const requestedNum = Number(amount);

    if (isNaN(requestedNum) || requestedNum <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const liveNearPrice = await getLiveNearPrice();
    const estimatedUsd = Number((requestedNum * liveNearPrice).toFixed(2));

    // Verify session authorization if senderHandle is provided
    if (cleanSender) {
      const cookieStore = cookies();
      const sessionCookie = cookieStore.get("veilx_session")?.value;
      const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

      if (sessionUser && sessionUser.xHandle?.toLowerCase() !== cleanSender) {
        return NextResponse.json(
          { error: "Unauthorized: Session identity does not match sender handle" },
          { status: 403 }
        );
      }

      // Enforce server-side daily spending limit in MongoDB
      await connectToDatabase();
      const dbUser = await User.findOne({ xHandle: cleanSender });
      if (dbUser) {
        const limit = dbUser.spendingLimitUsd || 50.0;
        const currentSpent = dbUser.spentUsd || 0.0;
        if (currentSpent + estimatedUsd > limit) {
          return NextResponse.json(
            {
              error: `Daily spending limit exceeded. Cap: $${limit.toFixed(2)}, Spent: $${currentSpent.toFixed(2)}, Attempted: $${estimatedUsd.toFixed(2)} USD`,
            },
            { status: 403 }
          );
        }
      }
    }

    const recipientNearAccount = sanitizeNearAccountId(cleanHandle);
    const isDirect = Boolean(isDirectTransfer) || cleanHandle.includes(".") || cleanHandle.endsWith(".testnet") || cleanHandle.endsWith(".near");
    const targetDirectAccount = isDirect ? cleanHandle : recipientNearAccount;

    // 1. Connect to NEAR Testnet RPC
    const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
    let effectiveSenderWallet: string = senderWallet || "veilx-agent.testnet";

    // 1.5. If client already signed transaction (NEAR or EVM MPC)
    if (clientTxHash) {
      if (!clientTxHash.startsWith("0x")) {
        console.log(`[NEAR Tip] Processing client-side signed transaction ${clientTxHash} for ${senderWallet}...`);
        const verifyOutcome = await verifyNearTransactionOutcome(clientTxHash, senderWallet || "veilx-agent.testnet");
        if (!verifyOutcome.success) {
          return NextResponse.json(
            { error: `On-chain execution failed: ${verifyOutcome.error}` },
            { status: 400 }
          );
        }
      }

      const txHash = clientTxHash;
      const blockHeight = "Confirmed";
      const usdValue = asset === "ETH"
        ? Number((requestedNum * liveNearPrice).toFixed(2)) // or live ETH price
        : (["USDC", "USDT"].includes(asset.toUpperCase()) ? requestedNum : Number((requestedNum * liveNearPrice).toFixed(2)));

      await connectToDatabase();
      if (senderHandle) {
        await Transaction.create({
          userHandle: senderHandle.replace("@", "").trim().toLowerCase(),
          txHash,
          type: isDirect ? "direct_deposit" : "tip_sent",
          counterparty: isDirect ? targetDirectAccount : `@${cleanHandle}`,
          amountUsd: usdValue,
          asset,
          status: isDirect ? "completed" : "escrow_pending",
          statusLabel: isDirect ? "Direct Transfer Sent" : "Tip Deposited to Escrow",
          memo: isDirect ? `Sent ${requestedNum} ${asset} directly to ${targetDirectAccount}` : `Tipped @${cleanHandle} ${requestedNum} ${asset}`,
          isInflow: false,
        });

        await User.updateOne(
          { xHandle: senderHandle.replace("@", "").trim().toLowerCase() },
          {
            $inc: { spentUsd: usdValue, weeklySpentUsd: usdValue },
          }
        );
      }

      if (isDirect) {
        const rawTargetHandle = targetDirectAccount.replace(/\.veilx-agent\.testnet$/, "").replace(/\.veilx\.testnet$/, "").replace(/\.testnet$/, "");
        await Transaction.create({
          userHandle: rawTargetHandle.toLowerCase(),
          txHash,
          type: "direct_deposit",
          counterparty: senderHandle ? `@${senderHandle}` : "Anonymous",
          amountUsd: usdValue,
          asset,
          status: isDirect ? "completed" : "escrow_pending",
          statusLabel: "Direct Transfer Received",
          memo: `Received ${requestedNum} ${asset} directly from @${senderHandle || "anonymous"}`,
          isInflow: true,
        });
      } else {
        // Escrow Tip document creation
        const salt = generatePrivacySalt();
        const commitment = isPrivate && salt ? computeCommitmentHash(cleanHandle, salt) : null;
        await EscrowTip.create({
          tipId,
          senderHandle: isPrivate ? "shielded_patron" : (senderHandle ? senderHandle.replace("@", "").trim().toLowerCase() : "anonymous"),
          senderWallet: senderWallet || "unknown.testnet",
          recipientHandle: cleanHandle.toLowerCase(),
          recipientWallet: recipientNearAccount,
          amount: requestedNum,
          amountNear: requestedNum,
          amountUsd: usdValue,
          asset,
          status: "pending",
          depositTxHash: txHash,
          isPrivate,
          commitment: commitment || undefined,
          privacySalt: salt || undefined,
        });
      }

      return NextResponse.json({
        success: true,
        isDirectTransfer: isDirect,
        senderHandle: senderHandle || null,
        senderWallet: senderWallet || effectiveSenderWallet,
        recipientWallet: targetDirectAccount,
        amount: requestedNum,
        attachedNear: requestedNum,
        asset,
        txHash,
        blockHeight,
      });
    }

    // 2. Enforce Non-Custodial Client-Side Signing (Zero Private Key Exposure)
    return NextResponse.json(
      {
        error: "Tip deposits must be signed directly in-browser by the sender's personal wallet (Zero private key exposure).",
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("NEAR transaction broadcast error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to broadcast transaction to NEAR" },
      { status: 500 }
    );
  }
}
