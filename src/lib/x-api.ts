// src/lib/x-api.ts
// Official X (Twitter) & FxTwitter Integration Engine

export interface XUserProfile {
  xHandle: string;
  name: string;
  avatarUrl: string;
  verified: boolean;
  description?: string;
  followersCount?: number;
}

// In-memory cache to prevent redundant API calls
const profileCache = new Map<string, { data: XUserProfile; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a user's real public profile from X (Twitter).
 * Uses FxTwitter public resolver first (fast, real avatars, follower counts, bios),
 * then falls back to official Twitter API v2, then unavatar mirror.
 */
export async function getXUserProfile(handle: string): Promise<XUserProfile | null> {
  const cleanHandle = handle.replace("@", "").trim();
  if (!cleanHandle) return null;
  const lowerHandle = cleanHandle.toLowerCase();

  // Check cache
  const cached = profileCache.get(lowerHandle);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Primary: Query FxTwitter public profile resolver
  // (Zero rate limit, returns real 400x400 avatar, real verified badge, follower count, bio)
  try {
    const fxRes = await fetch(`https://api.fxtwitter.com/${cleanHandle}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (fxRes.ok) {
      const fxData = await fxRes.json();
      if (fxData.code === 200 && fxData.user) {
        const u = fxData.user;
        const profile: XUserProfile = {
          xHandle: u.screen_name || cleanHandle,
          name: u.name || cleanHandle,
          avatarUrl: u.avatar_url
            ? u.avatar_url.replace("_normal", "_400x400")
            : `https://unavatar.io/twitter/${cleanHandle}`,
          verified: u.verification?.verified ?? false,
          description: u.description || undefined,
          followersCount: typeof u.followers === "number" ? u.followers : undefined,
        };
        profileCache.set(lowerHandle, { data: profile, timestamp: Date.now() });
        return profile;
      }
    }
  } catch (e) {
    console.warn("[FxTwitter lookup error]:", e);
  }

  // 2. Secondary: If official Twitter Bearer token is configured, query official Twitter API v2
  const bearerToken = process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN;
  if (bearerToken) {
    try {
      const cleanToken = decodeURIComponent(bearerToken.trim());
      const url = `https://api.twitter.com/2/users/by/username/${cleanHandle}?user.fields=name,profile_image_url,verified,description,public_metrics`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
        },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const profile: XUserProfile = {
            xHandle: json.data.username || cleanHandle,
            name: json.data.name || cleanHandle,
            avatarUrl: json.data.profile_image_url
              ? json.data.profile_image_url.replace("_normal", "_400x400")
              : `https://unavatar.io/twitter/${cleanHandle}`,
            verified: Boolean(json.data.verified),
            description: json.data.description,
            followersCount: json.data.public_metrics?.followers_count,
          };
          profileCache.set(lowerHandle, { data: profile, timestamp: Date.now() });
          return profile;
        }
      }
    } catch (err) {
      console.warn(`[X API v2] Failed for @${cleanHandle}:`, err);
    }
  }

  // 3. Fallback: Unavatar / DiceBear image resolver
  const fallbackProfile: XUserProfile = {
    xHandle: cleanHandle,
    name: `@${cleanHandle}`,
    avatarUrl: `https://unavatar.io/twitter/${cleanHandle}?fallback=https://api.dicebear.com/7.x/identicon/svg?seed=${cleanHandle}`,
    verified: false,
  };

  profileCache.set(lowerHandle, { data: fallbackProfile, timestamp: Date.now() });
  return fallbackProfile;
}

/**
 * Generate a pre-filled Twitter Intent tweet URL to notify the recipient on X
 */
export function generateXTweetIntent(params: {
  recipientHandle: string;
  amount: number | string;
  asset: string;
  claimUrl?: string;
  txHash?: string;
}): string {
  const cleanHandle = params.recipientHandle.replace("@", "").trim();
  const text = `Hey @${cleanHandle}, I just sent you a tip of ${params.amount} ${params.asset} on @VeilXapp via @NEARProtocol! 🚀${
    params.claimUrl ? `\n\nClaim your payout here: ${params.claimUrl}` : ""
  }`;

  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/**
 * Generate an X Direct Message (DM) link to notify the user privately
 */
export function generateXDirectMessageLink(recipientHandle: string, message: string): string {
  const cleanHandle = recipientHandle.replace("@", "").trim();
  return `https://twitter.com/messages/compose?recipient_id=${cleanHandle}&text=${encodeURIComponent(message)}`;
}
