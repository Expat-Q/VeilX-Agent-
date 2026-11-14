// src/lib/user-keys.ts
// Secure Personal Agent Key management for MCP & external AI agent authentication
import crypto from "crypto";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export interface ResolvedAgentUser {
  handle: string;
  nearAccountId: string;
  isAuth: boolean;
  userDoc?: any;
}

/**
 * Retrieves or lazily creates a persistent personal Agent API Key for a user handle.
 * Format: veil_live_<cleanHandle>_<randomHex>
 */
export async function getOrCreateAgentApiKey(rawHandle: string): Promise<string> {
  const cleanHandle = (rawHandle || "").replace("@", "").trim().toLowerCase();
  if (!cleanHandle || cleanHandle === "guest") {
    return "veil_live_guest_default";
  }

  await connectToDatabase();
  let user = await User.findOne({ xHandle: cleanHandle });

  if (user && user.agentApiKey && user.agentApiKey.startsWith("veil_live_")) {
    return user.agentApiKey;
  }

  // Generate cryptographic token
  const entropy = crypto.randomBytes(12).toString("hex");
  const newApiKey = `veil_live_${cleanHandle}_${entropy}`;

  if (user) {
    user.agentApiKey = newApiKey;
    await user.save();
  } else {
    // If user record doesn't exist yet, create minimal user entry
    await User.create({
      xHandle: cleanHandle,
      nearAccountId: `${cleanHandle}.veilx-agent.testnet`,
      agentApiKey: newApiKey,
      spendingLimitUsd: 50.0,
      spentUsd: 0.0,
    });
  }

  return newApiKey;
}

/**
 * Resolves user identity from incoming Authorization header or x-api-key.
 */
export async function resolveUserFromApiKey(apiKeyHeader?: string | null): Promise<ResolvedAgentUser> {
  if (!apiKeyHeader) {
    return { handle: "guest", nearAccountId: "guest.veilx-agent.testnet", isAuth: false };
  }

  // Strip "Bearer " if present
  const token = apiKeyHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { handle: "guest", nearAccountId: "guest.veilx-agent.testnet", isAuth: false };
  }

  try {
    await connectToDatabase();

    // 1. Exact match in database
    const user = await User.findOne({ agentApiKey: token });
    if (user && user.xHandle) {
      return {
        handle: user.xHandle,
        nearAccountId: user.nearAccountId || `${user.xHandle}.veilx-agent.testnet`,
        isAuth: true,
        userDoc: user,
      };
    }

    // 2. Structured token fallback (e.g. veil_live_<handle>_<hash>)
    if (token.startsWith("veil_live_")) {
      const parts = token.split("_");
      // parts[0] = "veil", parts[1] = "live", parts[2] = handle, parts[3] = entropy
      if (parts.length >= 3 && parts[2]) {
        const handle = parts[2].toLowerCase();
        const fallbackUser = await User.findOne({ xHandle: handle });
        return {
          handle,
          nearAccountId: fallbackUser?.nearAccountId || `${handle}.veilx-agent.testnet`,
          isAuth: true,
          userDoc: fallbackUser,
        };
      }
    }
  } catch (err) {
    console.warn("[resolveUserFromApiKey] Error resolving user token:", err);
  }

  return { handle: "guest", nearAccountId: "guest.veilx-agent.testnet", isAuth: false };
}
