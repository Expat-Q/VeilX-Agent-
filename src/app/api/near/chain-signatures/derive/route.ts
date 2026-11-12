// src/app/api/near/chain-signatures/derive/route.ts
// Exposes deterministic EVM address derivation for any NEAR account
import { NextRequest, NextResponse } from "next/server";
import { deriveEvmAddress, NEAR_MPC_CONTRACT_TESTNET } from "@/lib/near-chain-signatures";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const path = searchParams.get("path") || "ethereum,1";

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter 'accountId'" },
        { status: 400 }
      );
    }

    const result = deriveEvmAddress(accountId, path);

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        supportedChains: [
          { name: "Base", chainId: 8453, network: "Base Mainnet / Sepolia" },
          { name: "Ethereum", chainId: 1, network: "Ethereum Mainnet / Sepolia" },
          { name: "Arbitrum One", chainId: 42161, network: "Arbitrum" },
          { name: "Polygon", chainId: 137, network: "Polygon PoS" }
        ],
        documentation: "Powered by NEAR Protocol Chain Signatures MPC (v1.signer-prod.testnet)"
      }
    });
  } catch (err: any) {
    console.error("[ChainSignatures Derive API Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to derive EVM address" },
      { status: 500 }
    );
  }
}
