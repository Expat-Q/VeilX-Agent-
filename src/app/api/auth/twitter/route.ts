// src/app/api/auth/twitter/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generatePkcePair, getTwitterAuthUrl, getEffectiveTwitterCallbackUrl } from "@/lib/twitter-oauth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = crypto.randomBytes(16).toString("hex");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  let dynamicCallback: string | undefined = undefined;
  if (host.includes("veilxapp.onrender.com")) {
    dynamicCallback = "https://veilxapp.onrender.com/api/auth/callback/twitter";
  } else if (host.includes("localhost") || host.includes("127.0.0.1")) {
    dynamicCallback = `http://${host}/api/auth/callback/twitter`;
  }

  const effectiveCallback = getEffectiveTwitterCallbackUrl(dynamicCallback);

  // Secure cookie flag must be false on localhost/HTTP to prevent browser cookie drops
  const isSecure =
    process.env.NODE_ENV === "production" &&
    !host.includes("localhost") &&
    !host.includes("127.0.0.1") &&
    (req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:");

  // Capture return destination (strictly default to /terminal for seamless app entry)
  const returnToParam = req.nextUrl.searchParams.get("returnTo");
  let safeReturnTo = "/terminal";
  if (returnToParam && returnToParam !== "/") {
    try {
      const parsed = new URL(returnToParam, "http://localhost:3000");
      if (parsed.pathname && !parsed.pathname.startsWith("/api") && parsed.pathname !== "/") {
        safeReturnTo = parsed.pathname;
      }
    } catch {
      safeReturnTo = "/terminal";
    }
  }

  const cookieStore = cookies();
  cookieStore.set("oauth_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  cookieStore.set("oauth_callback_url", effectiveCallback, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  cookieStore.set("oauth_return_to", safeReturnTo, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  const authUrl = getTwitterAuthUrl(state, codeChallenge, effectiveCallback);
  return NextResponse.redirect(authUrl);
}
