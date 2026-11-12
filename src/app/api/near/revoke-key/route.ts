import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as nearAPI from "near-api-js";
import { verifySessionToken } from "@/lib/session";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
const RELAYER_ACCOUNT_ID = process.env.ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const RELAYER_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;
    if (!sessionUser?.xHandle) {
      return NextResponse.json(
        { error: "Unauthorized: Active authenticated session required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { accountId, publicKey } = body;

    if (!accountId || !publicKey) {
      return NextResponse.json(
        { error: "accountId and publicKey are required to revoke a key" },
        { status: 400 }
      );
    }

    const cleanHandle = sessionUser.xHandle.replace("@", "").trim().toLowerCase();
    const expectedSubaccount = `${cleanHandle}.${RELAYER_ACCOUNT_ID}`.toLowerCase();
    const cleanAccountId = (accountId || "").trim().toLowerCase();
    const userNearAccount = sessionUser.nearAccountId?.trim().toLowerCase();

    // Verify caller owns target accountId
    if (cleanAccountId !== expectedSubaccount && cleanAccountId !== userNearAccount) {
      return NextResponse.json(
        { error: "Forbidden: You may only revoke keys from your own subaccount or account" },
        { status: 403 }
      );
    }

    // Never allow revoking keys directly from the master relayer contract itself
    if (cleanAccountId === RELAYER_ACCOUNT_ID.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden: Cannot delete admin keys from root relayer account" },
        { status: 403 }
      );
    }

    // Disallow deleting the relayer's master public key
    let relayerPublicKey: string | null = null;
    if (RELAYER_PRIVATE_KEY) {
      try {
        relayerPublicKey = nearAPI.KeyPair.fromString(RELAYER_PRIVATE_KEY as any).getPublicKey().toString();
      } catch {}
    }
    const cleanPublicKey = (publicKey || "").trim();
    if (relayerPublicKey && cleanPublicKey === relayerPublicKey) {
      return NextResponse.json(
        { error: "Forbidden: Cannot delete platform relayer master key" },
        { status: 403 }
      );
    }

    let onChainRevoked = false;
    // If relayer private key is available, execute on-chain key deletion for subaccounts
    if (RELAYER_PRIVATE_KEY && cleanAccountId.endsWith(`.${RELAYER_ACCOUNT_ID.toLowerCase()}`)) {
      try {
        const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
        const keyPair = nearAPI.KeyPair.fromString(RELAYER_PRIVATE_KEY as any);
        const signer = new nearAPI.KeyPairSigner(keyPair);
        const account = new nearAPI.Account(cleanAccountId, provider, signer);

        await account.deleteKey(cleanPublicKey);
        onChainRevoked = true;
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        // If the key is already absent on-chain, it is safely considered revoked
        if (
          errMsg.includes("does not exist") ||
          errMsg.includes("KeyNotFound") ||
          errMsg.includes("UnknownAccessKey") ||
          errMsg.includes("not found")
        ) {
          onChainRevoked = true;
        } else {
          console.error("[RevokeKey] On-chain deletion failed:", errMsg);
          return NextResponse.json(
            {
              success: false,
              onChainRevoked: false,
              error: `On-chain key deletion failed: ${errMsg}`,
            },
            { status: 502 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      onChainRevoked,
      accountId: cleanAccountId,
      publicKey: cleanPublicKey,
      message: onChainRevoked
        ? "Key permanently deleted from NEAR on-chain account"
        : "Session key revoked from local authority and backend profile",
    });
  } catch (err: any) {
    console.error("[RevokeKey Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process key revocation" },
      { status: 500 }
    );
  }
}
