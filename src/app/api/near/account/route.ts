// src/app/api/near/account/route.ts
// Server-side proxy for NEAR Account queries, avoiding browser CORS restrictions
import { NextRequest, NextResponse } from "next/server";
import { fetchNearAccount } from "@/lib/near-rpc";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const cleanAccount = accountId.trim().toLowerCase();
    const info = await fetchNearAccount(cleanAccount);

    return NextResponse.json(info);
  } catch (err: any) {
    console.error("GET /api/near/account error:", err);
    return NextResponse.json(
      { exists: false, amountNear: "0", storageUsage: 0, error: err.message },
      { status: 500 }
    );
  }
}
