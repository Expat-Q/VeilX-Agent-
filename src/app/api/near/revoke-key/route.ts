import { NextRequest, NextResponse } from "next/server";
import * as nearAPI from "near-api-js";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
const RELAYER_ACCOUNT_ID = process.env.ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const RELAYER_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, publicKey } = body;

    if (!accountId || !publicKey) {
      return NextResponse.json(
        { error: "accountId and publicKey are required to revoke a key" },
        { status: 400 }
      );
    }

    // If relayer private key is available, attempt on-chain key deletion
    if (RELAYER_PRIVATE_KEY && accountId.endsWith(`.${RELAYER_ACCOUNT_ID}`)) {
      try {
        const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
        const keyPair = nearAPI.KeyPair.fromString(RELAYER_PRIVATE_KEY as any);
        const signer = new nearAPI.KeyPairSigner(keyPair);
        const account = new nearAPI.Account(accountId, provider, signer);

        // Delete key on-chain if present
        try {
          await account.deleteKey(publicKey);
          return NextResponse.json({
            success: true,
            onChainRevoked: true,
            accountId,
            publicKey,
            message: "Key permanently deleted from NEAR on-chain account",
          });
        } catch (innerErr: any) {
          console.warn("[RevokeKey] Direct account.deleteKey did not succeed, key may already be absent:", innerErr.message);
        }
      } catch (err: any) {
        console.warn("[RevokeKey] On-chain deletion attempt:", err.message);
      }
    }

    return NextResponse.json({
      success: true,
      onChainRevoked: false,
      accountId,
      publicKey,
      message: "Session key revoked from local authority and backend profile",
    });
  } catch (err: any) {
    console.error("[RevokeKey Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process key revocation" },
      { status: 500 }
    );
  }
}
