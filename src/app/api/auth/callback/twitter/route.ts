// src/app/api/auth/callback/twitter/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken, getTwitterMe, getBaseAppUrl } from "@/lib/twitter-oauth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { signSessionPayload } from "@/lib/session";
import { sanitizeNearAccountId } from "@/lib/near-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const baseUrl = getBaseAppUrl(req);
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = cookies();
  const savedState = cookieStore.get("oauth_state")?.value;
  const codeVerifier = cookieStore.get("oauth_code_verifier")?.value;
  const savedCallbackUrl = cookieStore.get("oauth_callback_url")?.value;
  const savedReturnTo = cookieStore.get("oauth_return_to")?.value || "/dashboard";

  if (!code || !state || !savedState || state !== savedState || !codeVerifier) {
    console.error("[Twitter OAuth] State mismatch or missing parameters:", {
      hasCode: !!code,
      hasState: !!state,
      hasSavedState: !!savedState,
      stateMatches: state === savedState,
      hasCodeVerifier: !!codeVerifier,
    });
    return NextResponse.redirect(new URL(`${savedReturnTo}?error=invalid_oauth_state`, baseUrl));
  }

  try {
    // 1. Exchange PKCE code for access token
    const tokenData = await exchangeCodeForToken(code, codeVerifier, savedCallbackUrl);

    // 2. Fetch authenticated profile from Twitter API v2
    const twitterUser = await getTwitterMe(tokenData.access_token);
    const cleanHandle = twitterUser.username.toLowerCase();
    const immutableXUserId = twitterUser.id; // Permanent numeric ID

    // 3. Connect to MongoDB and upsert by immutable xUserId
    await connectToDatabase();

    // Check if user exists by immutable xUserId (or fallback by handle)
    let user = await User.findOne({
      $or: [{ xUserId: immutableXUserId }, { xHandle: cleanHandle }],
    });

    const defaultNearAccount = sanitizeNearAccountId(cleanHandle);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        xUserId: immutableXUserId,
        xHandle: cleanHandle,
        xDisplayName: twitterUser.name,
        nearAccountId: defaultNearAccount,
        avatarUrl: twitterUser.profile_image_url?.replace("_normal", "_400x400"),
        spendingLimitUsd: 50.0,
        spentUsd: 0.0,
      });
    } else {
      user.xUserId = immutableXUserId;
      user.xHandle = cleanHandle;
      user.xDisplayName = twitterUser.name;
      user.avatarUrl = twitterUser.profile_image_url?.replace("_normal", "_400x400") || user.avatarUrl;
      await user.save();
    }

    // 4. Store auth session cookie
    const authPayload = {
      xUserId: immutableXUserId,
      xHandle: cleanHandle,
      xDisplayName: twitterUser.name,
      nearAccountId: user.nearAccountId || defaultNearAccount,
      avatarUrl: user.avatarUrl,
    };

    const signedToken = signSessionPayload(authPayload);

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const isSecure =
      process.env.NODE_ENV === "production" &&
      !host.includes("localhost") &&
      !host.includes("127.0.0.1") &&
      (req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:");

    cookieStore.set("veilx_session", signedToken, {
      httpOnly: true, // Protected against client-side script tampering
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Cleanup OAuth cookies
    cookieStore.delete("oauth_code_verifier");
    cookieStore.delete("oauth_state");
    cookieStore.delete("oauth_callback_url");
    cookieStore.delete("oauth_return_to");

    if (isNewUser) {
      return NextResponse.redirect(new URL(`/onboarding?connected=true&is_new=true&handle=${cleanHandle}`, baseUrl));
    } else {
      return NextResponse.redirect(new URL(`/terminal?connected=true&handle=${cleanHandle}`, baseUrl));
    }
  } catch (error: any) {
    console.error("Twitter OAuth Callback Error:", error);
    const reason = error?.message || "unknown_error";
    return NextResponse.redirect(new URL(`${savedReturnTo}?error=oauth_failed&reason=${encodeURIComponent(reason)}`, baseUrl));
  }
}
