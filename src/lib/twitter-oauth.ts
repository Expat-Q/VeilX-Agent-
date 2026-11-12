// src/lib/twitter-oauth.ts
// Official Twitter / 𝕏 OAuth 2.0 PKCE Handler
import crypto from "crypto";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || "ZWtCY2dsVEFTb01MSUM2dkViV0Y6MTpjaQ";
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || "";
const DEFAULT_CALLBACK_URL = "http://localhost:3000/api/auth/callback/twitter";

export function getBaseAppUrl(req?: { headers: { get: (name: string) => string | null } }): string {
  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "http";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function getEffectiveTwitterCallbackUrl(customCallback?: string): string {
  if (customCallback) return customCallback;
  if (process.env.TWITTER_CALLBACK_URL) {
    return process.env.TWITTER_CALLBACK_URL;
  }
  return DEFAULT_CALLBACK_URL;
}

export function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

export function getTwitterAuthUrl(state: string, codeChallenge: string, customCallback?: string) {
  const callbackUrl = getEffectiveTwitterCallbackUrl(customCallback);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: callbackUrl,
    scope: "tweet.read users.read offline.access",
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, codeVerifier: string, customCallback?: string) {
  const callbackUrl = getEffectiveTwitterCallbackUrl(customCallback);
  const params = new URLSearchParams({
    code: code,
    grant_type: "authorization_code",
    client_id: TWITTER_CLIENT_ID,
    redirect_uri: callbackUrl,
    code_verifier: codeVerifier,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (TWITTER_CLIENT_SECRET) {
    const basicAuth = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString("base64");
    headers["Authorization"] = `Basic ${basicAuth}`;
  }

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers,
    body: params.toString(),
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Failed to exchange code for token: ${errorData}`);
  }

  return res.json();
}

export async function getTwitterMe(accessToken: string) {
  const res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username,description,verified,public_metrics",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch Twitter user profile");
  }

  const json = await res.json();
  return json.data;
}
