// src/app/api/user/budget/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { verifySessionToken } from "@/lib/session";
import { setOnChainGuardrails } from "@/lib/onchain-guardrails";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { handle, dailyLimitUsd, weeklyLimitUsd } = body;

    if (!handle) {
      return NextResponse.json({ error: "handle is required" }, { status: 400 });
    }

    const cleanHandle = handle.replace("@", "").trim().toLowerCase();

    // Verify session identity
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized: Active authenticated session required" },
        { status: 401 }
      );
    }
    if (sessionUser.xHandle?.toLowerCase() !== cleanHandle) {
      return NextResponse.json(
        { error: "Forbidden: Session identity does not match specified handle" },
        { status: 403 }
      );
    }

    if (typeof dailyLimitUsd === "number" && (dailyLimitUsd < 1 || dailyLimitUsd > 10000 || isNaN(dailyLimitUsd))) {
      return NextResponse.json({ error: "dailyLimitUsd must be between $1 and $10,000" }, { status: 400 });
    }
    if (typeof weeklyLimitUsd === "number" && (weeklyLimitUsd < 1 || weeklyLimitUsd > 50000 || isNaN(weeklyLimitUsd))) {
      return NextResponse.json({ error: "weeklyLimitUsd must be between $1 and $50,000" }, { status: 400 });
    }

    await connectToDatabase();

    const updateFields: any = {};
    if (typeof dailyLimitUsd === "number") updateFields.spendingLimitUsd = dailyLimitUsd;
    if (typeof weeklyLimitUsd === "number") updateFields.weeklyLimitUsd = weeklyLimitUsd;

    const user = await User.findOneAndUpdate(
      { xHandle: cleanHandle },
      { $set: updateFields },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Sync guardrails on-chain on NEAR Protocol in background
    setOnChainGuardrails({
      accountId: user.nearAccountId,
      dailyLimitUsd: user.spendingLimitUsd,
      weeklyLimitUsd: user.weeklyLimitUsd ?? 200.0,
    }).catch((chainErr) => {
      console.warn("[budget-api] Background on-chain guardrail sync notice:", chainErr);
    });

    return NextResponse.json({
      success: true,
      spendingLimitUsd: user.spendingLimitUsd,
      weeklyLimitUsd: user.weeklyLimitUsd,
    });
  } catch (err: any) {
    console.error("POST /api/user/budget error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
