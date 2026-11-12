// src/app/api/relay/claim/route.ts
// NEP-366 Gasless Meta-Transaction Relayer for VeilX Claims on NEAR
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import * as nearAPI from "near-api-js";
import { connectToDatabase } from "@/lib/mongodb";
import { EscrowTip } from "@/models/EscrowTip";
import { Transaction } from "@/models/Transaction";
import { sanitizeNearAccountId, ensureNearSubAccountExists } from "@/lib/near-utils";
import { verifySessionToken } from "@/lib/session";
import { getLiveNearPrice } from "@/lib/oracle-service";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tipId, recipientHandle, recipientWallet, publicKey } = body;

    if (!tipId || !recipientHandle) {
      return NextResponse.json(
        { error: "Missing required claim parameters (tipId, recipientHandle)" },
        { status: 400 }
      );
    }

    if (!ESCROW_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Server misconfiguration: ESCROW_PRIVATE_KEY is not defined" },
        { status: 500 }
      );
    }

    const cleanHandle = recipientHandle.replace("@", "").trim().toLowerCase();

    // 1. Task T-1.1: Verify Caller Authentication & Identity
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required to claim tips. Please sign in." },
        { status: 401 }
      );
    }

    const sessionUser = verifySessionToken(sessionCookie);
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired session. Please sign in again." },
        { status: 401 }
      );
    }

    const callerBase = sessionUser.xHandle.toLowerCase().replace(/^_+/, "");
    const recipientBase = cleanHandle.replace(/^_+/, "");

    if (callerBase !== recipientBase) {
      return NextResponse.json(
        { error: `Forbidden: You are signed in as @${sessionUser.xHandle}, but this tip is addressed to @${cleanHandle}.` },
        { status: 403 }
      );
    }

    // Support Ephemeral Stealth Subaccount: claim-[hex].veilx-agent.testnet
    const isStealth = Boolean(body.useStealthSubaccount || body.stealth);
    const stealthSuffix = isStealth ? crypto.randomBytes(3).toString("hex") : "";
    const targetWallet = isStealth
      ? `claim-${stealthSuffix}.${CONTRACT_ID}`
      : (recipientWallet && !recipientWallet.startsWith("_") && !recipientWallet.includes("..")
          ? recipientWallet.trim().toLowerCase()
          : sanitizeNearAccountId(cleanHandle));

    // 2. Task T-1.2: Concurrency & Double-Claim Protection (Atomic Mutex in MongoDB with 5-minute TTL)
    await connectToDatabase();

    const possibleRecipientHandles = Array.from(new Set([cleanHandle, recipientBase, `_${recipientBase}`]));
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const lockedTip = await EscrowTip.findOneAndUpdate(
      {
        tipId,
        recipientHandle: { $in: possibleRecipientHandles },
        $or: [
          { status: "pending" },
          { status: "claiming", claimLockedAt: { $lt: fiveMinutesAgo } },
        ],
      },
      {
        $set: {
          status: "claiming",
          claimLockedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!lockedTip) {
      // Check if it was already claimed or is currently being claimed
      const existing = await EscrowTip.findOne({ tipId });
      if (existing?.status === "claimed") {
        return NextResponse.json(
          { error: "This tip has already been claimed." },
          { status: 409 }
        );
      }
      if (existing?.status === "claiming") {
        return NextResponse.json(
          { error: "A claim for this tip is already in progress. Please wait a moment." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Tip not found or not eligible for claim." },
        { status: 404 }
      );
    }

    console.log(`[Relayer] Sponsoring gasless claim for ${tipId} -> ${targetWallet} (Caller: @${cleanHandle})...`);

    // 3. Ensure target wallet exists on NEAR Testnet before transferring escrow funds
    const accountCheck = await ensureNearSubAccountExists(targetWallet, publicKey);
    if (!accountCheck.exists && accountCheck.error) {
      console.warn(`[Relayer] Subaccount check warning for ${targetWallet}:`, accountCheck.error);
    }

    // 4. Setup relayer keypair & connection to NEAR Testnet
    const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
    const keyPair = nearAPI.KeyPair.fromString(ESCROW_PRIVATE_KEY as any);
    const signer = new nearAPI.KeyPairSigner(keyPair);
    const relayerAccount = new nearAPI.Account(CONTRACT_ID, provider, signer);

    // 5. Call claim_tip (or claim_private_tip) on-chain with relayer paying gas (gasless for the recipient)
    let txHash: string;
    let blockHeight: string;

    const isPrivateTip = Boolean(lockedTip.isPrivate || lockedTip.commitment || body.salt);
    const saltToUse = body.salt || lockedTip.privacySalt || "";

    try {
      const methodName = isPrivateTip && saltToUse ? "claim_private_tip" : "claim_tip";
      const args = isPrivateTip && saltToUse
        ? {
            tip_id: tipId,
            recipient_handle: cleanHandle,
            salt: saltToUse,
            recipient_wallet: targetWallet,
          }
        : {
            tip_id: tipId,
            recipient_wallet: targetWallet,
          };

      const tx = await relayerAccount.callFunctionRaw({
        contractId: CONTRACT_ID,
        methodName,
        args,
        gas: "60000000000000", // 60 Tgas
        deposit: "0",
      });

      txHash = tx.transaction?.hash;
      if (!txHash) {
        throw new Error("NEAR transaction did not return a valid hash");
      }
      blockHeight = tx.transaction_outcome?.block_hash || "Confirmed";
    } catch (onchainErr: any) {
      // Rollback atomic lock on failure so the user can retry
      console.error("[Relayer] On-chain claim call failed, rolling back lock:", onchainErr);
      await EscrowTip.updateOne(
        { tipId, status: "claiming" },
        { $set: { status: "pending" }, $unset: { claimLockedAt: 1 } }
      );
      throw onchainErr;
    }

    // 6. Finalize MongoDB EscrowTip and Transaction records
    try {
      await EscrowTip.updateOne(
        { tipId },
        {
          $set: {
            status: "claimed",
            recipientWallet: targetWallet,
            stealthSubaccountId: isStealth ? targetWallet : undefined,
            claimTxHash: txHash,
            claimedAt: new Date(),
          },
          $unset: { claimLockedAt: 1 },
        }
      );

      // Update recipient's pending tip_received record to claimed
      await Transaction.updateMany(
        {
          userHandle: { $in: possibleRecipientHandles },
          type: "tip_received",
          status: "escrow_pending",
          $or: [{ memo: { $regex: tipId } }, { txHash: lockedTip.depositTxHash }],
        },
        {
          $set: {
            status: "claimed",
            statusLabel: "Claimed via Relayer (Gasless)",
            txHash,
          },
        }
      );

      const liveNearPrice = await getLiveNearPrice();
      // Record claim transaction receipt for recipient
      await Transaction.create({
        userHandle: cleanHandle,
        txHash,
        type: "tip_claimed",
        counterparty: lockedTip.senderHandle ? `@${lockedTip.senderHandle}` : "VeilX Escrow",
        amountUsd: Number(((lockedTip.amountNear || 0.01) * liveNearPrice).toFixed(2)),
        asset: lockedTip.asset || "NEAR",
        status: "claimed",
        statusLabel: "Claimed via Relayer (Gasless)",
        memo: `Claimed ${lockedTip.amountNear || 0.01} NEAR to ${targetWallet}`,
        isInflow: true,
      });

      // Update sender's transaction status to claimed
      if (lockedTip.senderHandle) {
        await Transaction.updateMany(
          {
            userHandle: lockedTip.senderHandle.replace("@", "").trim().toLowerCase(),
            $or: [{ memo: { $regex: tipId } }, { counterparty: `@${cleanHandle}` }],
            status: "escrow_pending",
          },
          {
            $set: {
              status: "claimed",
              statusLabel: `Claimed by @${cleanHandle}`,
            },
          }
        );
      }
    } catch (dbErr) {
      console.warn("[Relayer] MongoDB update warning:", dbErr);
    }

    return NextResponse.json({
      success: true,
      tipId,
      recipientWallet: targetWallet,
      txHash,
      relayedTxHash: txHash,
      gasSponsored: "0.0008 NEAR",
      status: "CLAIMED",
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
      blockHeight,
    });
  } catch (err: any) {
    console.error("[Relayer Error]", err);
    const msg = err.message || "";
    let friendlyError = msg;
    if (
      msg.includes("unreachable") ||
      msg.includes("Wasm") ||
      msg.includes("panic") ||
      msg.includes("ExecutionError") ||
      msg.includes("Tip not found")
    ) {
      friendlyError = "Tip not found on-chain or has already been claimed.";
    }
    return NextResponse.json({ error: friendlyError }, { status: 400 });
  }
}
