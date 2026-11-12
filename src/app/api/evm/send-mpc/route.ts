// src/app/api/evm/send-mpc/route.ts
// Outbound Base Transfer API using NEAR Protocol Chain Signatures MPC
// Strictly authenticated with session token and spending cap verification

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as nearAPI from "near-api-js";
import { createAndSignBaseTransaction } from "@/lib/near-chain-signatures";
import { verifySessionToken } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getLiveEthPrice } from "@/lib/oracle-service";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://test.rpc.fastnear.com";
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";

export async function POST(req: NextRequest) {
  try {
    // 1. Session Authentication Check
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const sessionUser = verifySessionToken(sessionCookie);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized: Invalid or expired session" }, { status: 401 });
    }

    const body = await req.json();

    // Reject insecure client-side private key transmission
    if (body.senderPrivateKey) {
      return NextResponse.json(
        { error: "Insecure private key transmission prohibited" },
        { status: 400 }
      );
    }

    const {
      recipientAddress,
      amount = "5.0",
      amountEth,
      asset = "USDC",
      senderNearAccountId,
      derivationPath = "ethereum,1",
      chainId,
    } = body;

    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      return NextResponse.json(
        { error: "Valid 0x recipientAddress is required" },
        { status: 400 }
      );
    }

    const liveEthPrice = await getLiveEthPrice();
    const parsedAmount = Number(asset === "ETH" ? (amountEth || amount) : amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid transfer amount: must be a positive number greater than 0" },
        { status: 400 }
      );
    }

    const transferAmountUsd = asset === "ETH" 
      ? parsedAmount * liveEthPrice 
      : parsedAmount;

    // 2. Spending Cap Validation
    await connectToDatabase();
    const userDoc = await User.findOne({ xHandle: sessionUser.xHandle.toLowerCase() });

    if (senderNearAccountId && sessionUser.nearAccountId && senderNearAccountId !== sessionUser.nearAccountId) {
      if (userDoc && userDoc.nearAccountId !== senderNearAccountId) {
        return NextResponse.json(
          { error: "Forbidden: senderNearAccountId does not match session account" },
          { status: 403 }
        );
      }
    }

    if (userDoc) {
      const remainingCap = (userDoc.spendingLimitUsd || 50) - (userDoc.spentUsd || 0);
      if (transferAmountUsd > remainingCap) {
        return NextResponse.json(
          { error: `Transfer amount ($${transferAmountUsd.toFixed(2)}) exceeds remaining spending limit ($${remainingCap.toFixed(2)})` },
          { status: 403 }
        );
      }
    }

    const userSenderId = senderNearAccountId || userDoc?.nearAccountId || CONTRACT_ID;

    let nearAccount: nearAPI.Account | undefined = undefined;

    // Use server-side ESCROW_PRIVATE_KEY for NEAR MPC gas sponsorship
    if (ESCROW_PRIVATE_KEY && CONTRACT_ID) {
      try {
        const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
        const keyPair = nearAPI.KeyPair.fromString(ESCROW_PRIVATE_KEY as any);
        const signer = new nearAPI.KeyPairSigner(keyPair);
        nearAccount = new nearAPI.Account(CONTRACT_ID, provider, signer);
      } catch (keyErr) {
        console.warn("[EVM MPC API] Failed to initialize NEAR account for signer:", keyErr);
      }
    }

    const result = await createAndSignBaseTransaction({
      nearAccount,
      senderNearAccountId: userSenderId,
      recipientAddress: recipientAddress as `0x${string}`,
      asset: (asset || "USDC").toUpperCase() as "ETH" | "USDC",
      amount: amount ?? amountEth ?? "5.0",
      amountEth: amountEth ? amountEth.toString() : undefined,
      derivationPath,
      chainId: chainId ? Number(chainId) : undefined,
    });

    // 3. Record Agent Spend upon success
    if (userDoc && result.success) {
      userDoc.spentUsd = Number(((userDoc.spentUsd || 0) + transferAmountUsd).toFixed(2));
      await userDoc.save();
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[EVM MPC API] Outbound MPC transfer failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute outbound MPC transfer" },
      { status: 500 }
    );
  }
}
