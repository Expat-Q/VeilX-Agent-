// src/app/api/user/spend/route.ts
// Records an outflow spend against the user's daily & weekly budget in MongoDB

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { verifySessionToken } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { handle, amountUsd } = body;

    const numAmount = parseFloat(amountUsd?.toString() || "0");
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Invalid amountUsd" }, { status: 400 });
    }

    const cleanHandle = (handle || "").replace("@", "").trim().toLowerCase();
    if (!cleanHandle) {
      return NextResponse.json({ error: "handle is required" }, { status: 400 });
    }

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
        { error: "Forbidden: Session identity does not match user handle" },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ xHandle: cleanHandle });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check rolling resets
    const now = new Date();
    const lastDaily = user.lastDailyReset || user.createdAt || now;
    if ((now.getTime() - new Date(lastDaily).getTime()) > 24 * 60 * 60 * 1000) {
      user.spentUsd = 0;
      user.lastDailyReset = now;
    }
    const lastWeekly = user.lastWeeklyReset || user.createdAt || now;
    if ((now.getTime() - new Date(lastWeekly).getTime()) > 7 * 24 * 60 * 60 * 1000) {
      user.weeklySpentUsd = 0;
      user.lastWeeklyReset = now;
    }

    user.spentUsd = Number(((user.spentUsd || 0) + numAmount).toFixed(2));
    user.weeklySpentUsd = Number(((user.weeklySpentUsd || 0) + numAmount).toFixed(2));
    await user.save();

    return NextResponse.json({
      success: true,
      spentUsd: user.spentUsd,
      spendingLimitUsd: user.spendingLimitUsd,
      weeklySpentUsd: user.weeklySpentUsd,
      weeklyLimitUsd: user.weeklyLimitUsd ?? 200.0,
    });
  } catch (err: any) {
    console.error("POST /api/user/spend error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
