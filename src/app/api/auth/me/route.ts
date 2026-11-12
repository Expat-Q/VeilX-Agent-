// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const payload = verifySessionToken(sessionCookie);
    if (!payload) {
      // Invalidate forged or expired session
      cookieStore.delete("veilx_session");
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    // Attempt to enrich with fresh database profile
    let enriched = { ...payload };
    try {
      await connectToDatabase();
      const cleanHandle = payload.xHandle ? payload.xHandle.replace("@", "").trim().toLowerCase() : null;
      const query: any = {};
      if (payload.xUserId) {
        query.$or = [{ xUserId: payload.xUserId }, { xHandle: cleanHandle }];
      } else if (cleanHandle) {
        query.xHandle = cleanHandle;
      }

      const dbUser = await User.findOne(query).lean() as any;
      if (dbUser) {
        // Rolling reset checks
        const now = Date.now();
        const lastDaily = dbUser.lastDailyReset ? new Date(dbUser.lastDailyReset).getTime() : now;
        const lastWeekly = dbUser.lastWeeklyReset ? new Date(dbUser.lastWeeklyReset).getTime() : now;
        
        let effectiveDailySpent = dbUser.spentUsd ?? 0;
        let effectiveWeeklySpent = dbUser.weeklySpentUsd ?? dbUser.spentUsd ?? 0;

        if (now - lastDaily > 24 * 60 * 60 * 1000) {
          effectiveDailySpent = 0;
        }
        if (now - lastWeekly > 7 * 24 * 60 * 60 * 1000) {
          effectiveWeeklySpent = 0;
        }

        enriched = {
          ...enriched,
          xHandle: dbUser.xHandle || enriched.xHandle,
          nearAccountId: dbUser.nearAccountId || enriched.nearAccountId,
          xDisplayName: dbUser.xDisplayName || enriched.xDisplayName,
          avatarUrl: dbUser.avatarUrl || enriched.avatarUrl,
          spendingLimitUsd: dbUser.spendingLimitUsd ?? 50,
          spentUsd: effectiveDailySpent,
          weeklyLimitUsd: dbUser.weeklyLimitUsd ?? 200,
          weeklySpentUsd: effectiveWeeklySpent,
        };
      }
    } catch {
      // Fallback to cookie payload if database is momentarily slow
    }

    return NextResponse.json({ authenticated: true, user: enriched });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = cookies();
    cookieStore.delete("veilx_session");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
