// src/lib/twitter-oauth.ts
// Official Twitter / 𝕏 OAuth 2.0 PKCE Handler
import crypto from "crypto";

const getClientId = () => (process.env.TWITTER_CLIENT_ID || "ZWtCY2dsVEFTb01MSUM2dkViV0Y6MTpjaQ").trim();
const getClientSecret = () => (process.env.TWITTER_CLIENT_SECRET || "").trim();
const DEFAULT_CALLBACK_URL = "http://localhost:3000/api/auth/callback/twitter";

export function getBaseAppUrl(req?: { headers: { get: (name: string) => string | null } }): string {
  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "http";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost.trim()}`;
    }
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function getEffectiveTwitterCallbackUrl(customCallback?: string): string {
  if (customCallback) return customCallback.trim();
  if (process.env.TWITTER_CALLBACK_URL) {
    return process.env.TWITTER_CALLBACK_URL.trim();
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")}/api/auth/callback/twitter`;
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
  const clientId = getClientId();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
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
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const params = new URLSearchParams({
    code: code,
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    code_verifier: codeVerifier,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
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
  // Try with profile_image_url first
  let res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // If that fails, fallback to bare /2/users/me
  if (!res.ok) {
    const firstError = await res.text().catch(() => "");
    console.warn(`[Twitter OAuth] Profile request with fields failed (${res.status}): ${firstError}. Retrying bare /2/users/me...`);
    res = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    console.error(`[Twitter OAuth] Failed to fetch Twitter user profile (${res.status}):`, errorBody);
    throw new Error(`Failed to fetch Twitter profile (${res.status}): ${errorBody}`);
  }

  const json = await res.json();
  if (!json?.data) {
    throw new Error(`Twitter response missing data object: ${JSON.stringify(json)}`);
  }
  return json.data;
}
