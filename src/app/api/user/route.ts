import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { signSessionPayload, verifySessionToken } from "@/lib/session";
import { sanitizeNearAccountId, ensureNearSubAccountExists } from "@/lib/near-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get("handle");

    if (!handle) {
      return NextResponse.json({ error: "Missing handle parameter" }, { status: 400 });
    }

    const cleanHandle = handle.replace("@", "").trim();
    await connectToDatabase();

    const user = await User.findOne({ xHandle: cleanHandle });
    if (!user) {
      return NextResponse.json({ exists: false }, { status: 404 });
    }

    // Rolling 24-hour daily budget & 7-day weekly reset check
    const now = new Date();
    let needsSave = false;
    const lastDaily = user.lastDailyReset || user.createdAt || now;
    if ((now.getTime() - new Date(lastDaily).getTime()) > 24 * 60 * 60 * 1000 && user.spentUsd > 0) {
      user.spentUsd = 0;
      user.lastDailyReset = now;
      needsSave = true;
    }
    const lastWeekly = user.lastWeeklyReset || user.createdAt || now;
    if ((now.getTime() - new Date(lastWeekly).getTime()) > 7 * 24 * 60 * 60 * 1000 && (user.weeklySpentUsd || 0) > 0) {
      user.weeklySpentUsd = 0;
      user.lastWeeklyReset = now;
      needsSave = true;
    }
    if (needsSave) {
      await user.save();
    }

    return NextResponse.json({
      exists: true,
      user: {
        xHandle: user.xHandle,
        nearAccountId: user.nearAccountId,
        spendingLimitUsd: user.spendingLimitUsd,
        spentUsd: user.spentUsd,
        weeklyLimitUsd: user.weeklyLimitUsd ?? 200.0,
        weeklySpentUsd: user.weeklySpentUsd ?? 0.0,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error("GET /api/user error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { xHandle, nearAccountId, publicKey, spendingLimitUsd = 50.0 } = body;

    if (!xHandle || !nearAccountId) {
      return NextResponse.json(
        { error: "xHandle and nearAccountId are required" },
        { status: 400 }
      );
    }

    const cleanHandle = xHandle.replace("@", "").trim();
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(cleanHandle)) {
      return NextResponse.json(
        { error: "Invalid Twitter handle format" },
        { status: 400 }
      );
    }

    // Validate session identity
    let sessionToken: string | undefined;
    const cookieStore = cookies();
    try {
      sessionToken = cookieStore.get("veilx_session")?.value;
    } catch {
      // ignore cookie store read errors
    }
    if (!sessionToken && req) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)veilx_session=([^;]+)/);
        if (match) sessionToken = decodeURIComponent(match[1]);
      }
    }

    const sessionUser = sessionToken ? verifySessionToken(sessionToken) : null;

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized: Active authenticated session via Twitter OAuth required" },
        { status: 401 }
      );
    }

    if (sessionUser.xHandle?.toLowerCase() !== cleanHandle.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden: Session identity does not match specified handle" },
        { status: 403 }
      );
    }

    await connectToDatabase();

    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({
      $or: [
        { xHandle: cleanHandle },
        { xHandle: { $regex: new RegExp(`^${cleanHandle}$`, "i") } },
      ],
    });

    // If account exists, verify that session identity matches the user
    if (existingUser) {
      if (sessionUser.xHandle?.toLowerCase() !== cleanHandle.toLowerCase()) {
        return NextResponse.json(
          { error: "Forbidden: Active authenticated session does not match this handle" },
          { status: 403 }
        );
      }
      if (existingUser.xUserId && sessionUser.xUserId && existingUser.xUserId !== sessionUser.xUserId) {
        return NextResponse.json(
          { error: "Forbidden: Twitter User ID mismatch for this account" },
          { status: 403 }
        );
      }
    }

    const canonicalAccount = sanitizeNearAccountId(cleanHandle);
    let effectiveAccountId = canonicalAccount;

    // Ensure on-chain personal subaccount exists
    if (effectiveAccountId.endsWith(".veilx-agent.testnet")) {
      try {
        await ensureNearSubAccountExists(effectiveAccountId, publicKey);
      } catch (subErr: any) {
        console.warn("[POST /api/user] Subaccount provisioning notice:", subErr.message);
      }
    }

    const validatedLimit = Math.max(1, Math.min(Number(spendingLimitUsd) || 50, 1000));

    const user = await User.findOneAndUpdate(
      { xHandle: existingUser ? existingUser.xHandle : cleanHandle },
      {
        xHandle: cleanHandle,
        nearAccountId: effectiveAccountId,
        spendingLimitUsd: validatedLimit,
      },
      { upsert: true, new: true }
    );

    // Issue signed HTTP-only session cookie
    try {
      const signedToken = signSessionPayload({
        xUserId: sessionUser.xUserId || user.xUserId || `local_${cleanHandle.toLowerCase()}`,
        xHandle: cleanHandle.toLowerCase(),
        nearAccountId: user.nearAccountId,
        avatarUrl: user.avatarUrl,
      });

      cookieStore.set("veilx_session", signedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    } catch (cookieErr) {
      console.warn("Could not set session cookie in /api/user:", cookieErr);
    }

    return NextResponse.json({
      success: true,
      user: {
        xHandle: user.xHandle,
        nearAccountId: user.nearAccountId,
        spendingLimitUsd: user.spendingLimitUsd,
        spentUsd: user.spentUsd,
        weeklyLimitUsd: user.weeklyLimitUsd ?? 200.0,
        weeklySpentUsd: user.weeklySpentUsd ?? 0.0,
      },
    });
  } catch (err: any) {
    console.error("POST /api/user error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
