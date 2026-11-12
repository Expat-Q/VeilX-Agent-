// src/app/api/proofs/route.ts
// Handles creation and verification lookup of Selective Disclosure Proofs

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { DisclosureProof } from "@/models/DisclosureProof";
import {
  createSelectiveDisclosureProof,
  verifySelectiveDisclosureProof,
  ProofFactType,
} from "@/lib/proof-attestation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      factType = "TIP_DELIVERED",
      recipientClaim,
      amountClaim,
      usdValueClaim,
      asset = "USDC",
      network = "NEAR Protocol",
      senderSecret,
      validityDays = 7,
    } = body;

    if (!recipientClaim || !amountClaim) {
      return NextResponse.json(
        { error: "recipientClaim and amountClaim are required" },
        { status: 400 }
      );
    }

    const proof = createSelectiveDisclosureProof({
      factType: factType as ProofFactType,
      recipientClaim,
      amountClaim,
      usdValueClaim: Number(usdValueClaim) || undefined,
      asset,
      network,
      senderAddressOrSecret: senderSecret || `anon_${Date.now()}`,
      validityDays: Number(validityDays) || 7,
    });

    try {
      await connectToDatabase();
      await DisclosureProof.create(proof);
    } catch (dbErr) {
      console.warn("[API Proofs] DB persistence warning (non-fatal):", dbErr);
    }

    return NextResponse.json({
      success: true,
      proof,
      verificationUrl: `/verify/${proof.proofId}`,
    });
  } catch (err: any) {
    console.error("[API Proofs] Creation failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate proof" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const proofId = searchParams.get("proofId");

    if (!proofId) {
      return NextResponse.json(
        { error: "proofId query parameter is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const doc = await DisclosureProof.findOne({ proofId }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    }

    const verification = verifySelectiveDisclosureProof(doc as any);

    return NextResponse.json({
      success: true,
      proof: doc,
      verification,
    });
  } catch (err: any) {
    console.error("[API Proofs] Lookup failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to query proof" },
      { status: 500 }
    );
  }
}
