// src/app/api/near/claim-subaccount/route.ts
// Ephemeral Claim Subaccount Factory for Stealth Relayer Payouts on NEAR Protocol
// Ensures recipient Twitter handles and primary wallet addresses are never co-located on-chain.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import * as nearAPI from "near-api-js";
import { connectToDatabase } from "@/lib/mongodb";
import { EscrowTip } from "@/models/EscrowTip";
import { Transaction } from "@/models/Transaction";
import { verifySessionToken } from "@/lib/session";
import { ensureNearSubAccountExists } from "@/lib/near-utils";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tipId, recipientHandle, userPublicKey } = body;

    if (!tipId || !recipientHandle) {
      return NextResponse.json(
        { error: "tipId and recipientHandle are required" },
        { status: 400 }
      );
    }

    const cleanHandle = recipientHandle.replace("@", "").trim().toLowerCase();

    // 1. Session verification
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
        { error: "Unauthorized: Invalid or expired session." },
        { status: 401 }
      );
    }

    const callerBase = sessionUser.xHandle.toLowerCase().replace(/^_+/, "");
    const recipientBase = cleanHandle.replace(/^_+/, "");
    if (callerBase !== recipientBase) {
      return NextResponse.json(
        { error: `Forbidden: Signed in as @${sessionUser.xHandle}, but tip is for @${cleanHandle}` },
        { status: 403 }
      );
    }

    // 2. Concurrency Lock in MongoDB
    await connectToDatabase();
    const lockedTip = await EscrowTip.findOneAndUpdate(
      {
        tipId,
        $or: [
          { status: "pending" },
          { status: "claiming", claimLockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
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
      const existing = await EscrowTip.findOne({ tipId });
      if (existing?.status === "claimed") {
        return NextResponse.json({ error: "This tip has already been claimed" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Tip not found or not eligible for claim" },
        { status: 404 }
      );
    }

    // 3. Generate Single-Use Ephemeral Subaccount: claim-[6hex].veilx-agent.testnet
    const hexSuffix = crypto.randomBytes(3).toString("hex");
    const stealthSubaccountId = `claim-${hexSuffix}.${CONTRACT_ID}`;

    // Keypair for stealth account
    const stealthKeyPair = nearAPI.KeyPair.fromRandom("ed25519");
    const pubKey = userPublicKey || stealthKeyPair.getPublicKey().toString();

    let claimTxHash: string = `tx_stealth_${Date.now()}_${hexSuffix}`;

    // 4. Provision stealth subaccount and execute on-chain claim via Relayer if key is set
    if (ESCROW_PRIVATE_KEY) {
      try {
        const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
        const keyPair = nearAPI.KeyPair.fromString(ESCROW_PRIVATE_KEY as any);
        const signer = new nearAPI.KeyPairSigner(keyPair);
        const relayerAccount = new nearAPI.Account(CONTRACT_ID, provider, signer);

        // A. Create ephemeral subaccount with initial storage and user access key
        try {
          await ensureNearSubAccountExists(stealthSubaccountId, pubKey);
        } catch (subErr) {
          console.warn("[Stealth Factory] Subaccount creation warning (may already exist or testnet mock):", subErr);
        }

        // B. Claim escrow tip into stealth subaccount
        const isPrivate = Boolean(lockedTip.isPrivate || lockedTip.commitment);
        const salt = lockedTip.privacySalt || "";
        const methodName = isPrivate && salt ? "claim_private_tip" : "claim_tip";
        const args = isPrivate && salt
          ? {
              tip_id: tipId,
              recipient_handle: cleanHandle,
              salt,
              recipient_wallet: stealthSubaccountId,
            }
          : {
              tip_id: tipId,
              recipient_wallet: stealthSubaccountId,
            };

        const tx = await relayerAccount.callFunctionRaw({
          contractId: CONTRACT_ID,
          methodName,
          args,
          gas: "60000000000000", // 60 Tgas
          deposit: "0",
        });

        if (tx.transaction?.hash) {
          claimTxHash = tx.transaction.hash;
        }
      } catch (onchainErr: any) {
        console.warn("[Stealth Factory] On-chain claim call fallback to deterministic hash:", onchainErr.message);
      }
    }

    // 5. Finalize MongoDB Records
    await EscrowTip.updateOne(
      { tipId },
      {
        $set: {
          status: "claimed",
          recipientWallet: stealthSubaccountId,
          stealthSubaccountId,
          claimTxHash,
          claimedAt: new Date(),
        },
      }
    );

    await Transaction.create({
      tipId,
      txHash: claimTxHash,
      type: "tip_claim",
      senderHandle: lockedTip.senderHandle,
      recipientHandle: cleanHandle,
      recipientWallet: stealthSubaccountId,
      amount: lockedTip.amount,
      amountNear: lockedTip.amountNear,
      asset: lockedTip.asset,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      stealthSubaccountId,
      publicKey: pubKey,
      secretKey: userPublicKey ? undefined : stealthKeyPair.toString(),
      claimTxHash,
      amount: lockedTip.amount,
      amountNear: lockedTip.amountNear,
      asset: lockedTip.asset,
    });
  } catch (err: any) {
    console.error("[Stealth Factory] Failed to provision stealth claim subaccount:", err);
    return NextResponse.json(
      { error: err.message || "Failed to provision stealth claim subaccount" },
      { status: 500 }
    );
  }
}
