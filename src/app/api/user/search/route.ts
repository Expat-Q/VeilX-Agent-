// src/app/api/user/search/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getXUserProfile } from "@/lib/x-api";

export const dynamic = "force-dynamic";

export interface SearchUserResult {
  xHandle: string;
  displayName: string;
  nearAccountId?: string;
  isRegistered: boolean;
  avatarUrl?: string;
  verified: boolean;
}

const DEFAULT_ECOSYSTEM_USERS: SearchUserResult[] = [
  {
    xHandle: "expatq3",
    displayName: "Expat (VeilX Creator)",
    nearAccountId: "veilx-agent.testnet",
    isRegistered: true,
    verified: true,
  },
  {
    xHandle: "nearprotocol",
    displayName: "NEAR Protocol",
    nearAccountId: "near",
    isRegistered: true,
    verified: true,
  },
  {
    xHandle: "illia39",
    displayName: "Illia Polosukhin",
    nearAccountId: "illia.near",
    isRegistered: true,
    verified: true,
  },
  {
    xHandle: "alexskidanov",
    displayName: "Alex Skidanov",
    nearAccountId: "alex.near",
    isRegistered: true,
    verified: true,
  },
  {
    xHandle: "vitalik",
    displayName: "Vitalik Buterin",
    nearAccountId: "vitalik.near",
    isRegistered: true,
    verified: true,
  },
  {
    xHandle: "sarah",
    displayName: "Sarah Web3",
    nearAccountId: "sarah.testnet",
    isRegistered: true,
    verified: false,
  },
  {
    xHandle: "alice",
    displayName: "Alice",
    nearAccountId: "alice.testnet",
    isRegistered: true,
    verified: false,
  },
  {
    xHandle: "bob",
    displayName: "Bob",
    nearAccountId: "bob.testnet",
    isRegistered: true,
    verified: false,
  },
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").replace("@", "").trim().toLowerCase();

    if (!query) {
      return NextResponse.json({
        success: true,
        users: DEFAULT_ECOSYSTEM_USERS.slice(0, 4),
      });
    }

    const results: SearchUserResult[] = [];
    const seenHandles = new Set<string>();

    // 1. Check MongoDB for registered users starting with query
    try {
      const conn = await connectToDatabase();
      if (conn && conn.connection.readyState === 1) {
        const dbUsers = await User.find({
          xHandle: { $regex: `^${query}`, $options: "i" },
        }).limit(5);

        for (const u of dbUsers) {
          const lower = u.xHandle.toLowerCase();
          if (!seenHandles.has(lower)) {
            results.push({
              xHandle: u.xHandle,
              displayName: `@${u.xHandle}`,
              nearAccountId: u.nearAccountId,
              isRegistered: true,
              avatarUrl: u.avatarUrl || `https://unavatar.io/twitter/${u.xHandle}`,
              verified: false,
            });
            seenHandles.add(lower);
          }
        }
      }
    } catch (dbErr) {
      console.warn("MongoDB user search query error:", dbErr);
    }

    // 2. Check default ecosystem directory matching prefix
    for (const u of DEFAULT_ECOSYSTEM_USERS) {
      const lower = u.xHandle.toLowerCase();
      if (lower.startsWith(query) && !seenHandles.has(lower)) {
        results.push({
          ...u,
          avatarUrl: u.avatarUrl || `https://unavatar.io/twitter/${u.xHandle}`,
        });
        seenHandles.add(lower);
      }
    }

    // 3. Always include the exact typed handle as top/fallback so user never gets mismatched
    if (!seenHandles.has(query)) {
      let xProfile = null;
      try {
        xProfile = await getXUserProfile(query);
      } catch (e) {
        // Fallback
      }

      results.unshift({
        xHandle: query,
        displayName: xProfile?.name || `@${query}`,
        nearAccountId: "Unregistered (Escrow Claim Link)",
        isRegistered: false,
        avatarUrl: xProfile?.avatarUrl || `https://unavatar.io/twitter/${query}`,
        verified: xProfile?.verified || false,
      });
      seenHandles.add(query);
    }

    return NextResponse.json({
      success: true,
      users: results.slice(0, 4),
    });
  } catch (err: any) {
    console.error("GET /api/user/search error:", err);
    return NextResponse.json({ success: true, users: [] });
  }
}
