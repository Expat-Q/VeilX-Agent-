// src/app/api/user/agent-key/route.ts
// Returns or regenerates the authenticated user's Personal Agent Key for MCP / ChatGPT
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { getOrCreateAgentApiKey } from "@/lib/user-keys";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

    const { searchParams } = new URL(req.url);
    const queryHandle = searchParams.get("handle");

    const effectiveHandle = (sessionUser?.xHandle || queryHandle || "guest").replace("@", "").trim().toLowerCase();

    const apiKey = await getOrCreateAgentApiKey(effectiveHandle);

    return NextResponse.json({
      success: true,
      handle: effectiveHandle,
      nearAccountId: `${effectiveHandle}.veilx-agent.testnet`,
      apiKey,
    });
  } catch (err: any) {
    console.error("GET /api/user/agent-key error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

    const effectiveHandle = (body.handle || sessionUser?.xHandle || "guest").replace("@", "").trim().toLowerCase();
    if (!effectiveHandle || effectiveHandle === "guest") {
      return NextResponse.json({ success: false, error: "Valid handle required" }, { status: 400 });
    }

    await connectToDatabase();
    const entropy = crypto.randomBytes(12).toString("hex");
    const newApiKey = `veil_live_${effectiveHandle}_${entropy}`;

    await User.findOneAndUpdate(
      { xHandle: effectiveHandle },
      { $set: { agentApiKey: newApiKey } },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      handle: effectiveHandle,
      nearAccountId: `${effectiveHandle}.veilx-agent.testnet`,
      apiKey: newApiKey,
    });
  } catch (err: any) {
    console.error("POST /api/user/agent-key error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
