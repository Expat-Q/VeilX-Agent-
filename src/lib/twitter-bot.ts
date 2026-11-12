// src/lib/twitter-bot.ts
// Official X (Twitter) Automated Bot Broadcast Service
// Note: Automated Twitter broadcast integration is currently de-scoped per user direction ("not needed for now").
import crypto from "crypto";

const consumerKey = process.env.TWITTER_API_KEY || "";
const consumerSecret = process.env.TWITTER_API_SECRET || "";
const accessToken = process.env.TWITTER_ACCESS_TOKEN || "";
const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || "";

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function generateOAuth1Header(method: string, url: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;

  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .filter((k) => k.startsWith("oauth_"))
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`);

  return `OAuth ${headerParts.join(", ")}`;
}

export async function broadcastBotTweet(text: string): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return { success: false, error: "Twitter Bot keys not fully configured in environment" };
  }

  const url = "https://api.twitter.com/2/tweets";

  try {
    const authHeader = generateOAuth1Header("POST", url);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.warn("[Twitter Bot Error]:", json);
      return { success: false, error: json.detail || json.title || "Failed to post tweet" };
    }

    return { success: true, data: json.data };
  } catch (err: any) {
    console.error("[Twitter Bot Exception]:", err);
    return { success: false, error: err.message };
  }
}
