import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { ChatMessageModel } from "@/models/ChatMessage";
import { verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

interface ChatAccessResult {
  authorized: boolean;
  cleanHandle: string;
  response?: NextResponse;
}

function validateChatAccess(req: Request, rawHandle: string | null | undefined): ChatAccessResult {
  const cleanHandle = (rawHandle || "expatq3").replace("@", "").trim();
  const lowerHandle = cleanHandle.toLowerCase();

  let token: string | undefined;
  try {
    const cookieStore = cookies();
    token = cookieStore.get("veilx_session")?.value;
  } catch {
    // Ignore error if cookies() fails in non-standard context
  }

  if (!token && req) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)veilx_session=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }
  }

  // If a veilx_session cookie exists, ensure it matches handle
  if (token) {
    const sessionUser = verifySessionToken(token);
    if (!sessionUser) {
      return {
        authorized: false,
        cleanHandle,
        response: NextResponse.json(
          { error: "Unauthorized: Invalid session token" },
          { status: 401 }
        ),
      };
    }

    if (sessionUser.xHandle?.toLowerCase() !== lowerHandle) {
      return {
        authorized: false,
        cleanHandle,
        response: NextResponse.json(
          { error: "Unauthorized: Active authenticated session does not match handle" },
          { status: 403 }
        ),
      };
    }

    return { authorized: true, cleanHandle };
  }

  // If unauthenticated, allow public demo defaults ('expatq3') gracefully for unauthenticated sandbox views, but reject arbitrary handle impersonation
  if (lowerHandle === "expatq3") {
    return { authorized: true, cleanHandle };
  }

  return {
    authorized: false,
    cleanHandle,
    response: NextResponse.json(
      { error: "Unauthorized: Active authenticated session required to access handle history" },
      { status: 401 }
    ),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get("handle");
    const channel = searchParams.get("channel") || "social";

    const auth = validateChatAccess(req, handle);
    if (!auth.authorized) {
      return auth.response!;
    }
    const cleanHandle = auth.cleanHandle;

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({ success: true, messages: [] });
    }

    const query: any = {
      userHandle: { $regex: new RegExp(`^${cleanHandle}$`, "i") },
    };
    if (channel === "terminal") {
      query.channel = "terminal";
    } else {
      query.$or = [{ channel: "social" }, { channel: { $exists: false } }];
    }

    const history = await ChatMessageModel.find(query)
      .sort({ createdAt: 1 })
      .limit(100);

    return NextResponse.json({
      success: true,
      messages: history.map((msg) => ({
        id: msg._id.toString(),
        role: msg.role,
        content: msg.content,
        actionCard: msg.actionCard,
        channel: msg.channel,
        createdAt: msg.createdAt,
      })),
    });
  } catch (err: any) {
    console.warn("GET /api/chat/history fallback:", err.message);
    // Graceful fallback: return empty list so client localStorage takes over
    return NextResponse.json({ success: true, messages: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userHandle, role, content, actionCard, channel = "social" } = body;

    const auth = validateChatAccess(req, userHandle);
    if (!auth.authorized) {
      return auth.response!;
    }
    const cleanHandle = auth.cleanHandle;

    if (!content || !role) {
      return NextResponse.json({ error: "Missing content or role" }, { status: 400 });
    }

    const fallbackMessage = {
      id: `msg_${Date.now()}`,
      role,
      content,
      actionCard,
      channel,
      createdAt: new Date(),
    };

    const conn = await connectToDatabase();
    if (!conn) {
      return NextResponse.json({
        success: true,
        message: fallbackMessage,
      });
    }

    const newMsg = await ChatMessageModel.create({
      userHandle: cleanHandle,
      role,
      content,
      actionCard,
      channel,
    });

    return NextResponse.json({
      success: true,
      message: {
        id: newMsg._id.toString(),
        role: newMsg.role,
        content: newMsg.content,
        actionCard: newMsg.actionCard,
        channel: newMsg.channel,
        createdAt: newMsg.createdAt,
      },
    });
  } catch (err: any) {
    console.warn("POST /api/chat/history fallback:", err.message);
    return NextResponse.json({
      success: true,
      message: {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Saved locally.",
        createdAt: new Date(),
      },
    });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get("handle");
    const channel = searchParams.get("channel") || "social";

    const auth = validateChatAccess(req, handle);
    if (!auth.authorized) {
      return auth.response!;
    }
    const cleanHandle = auth.cleanHandle;

    const conn = await connectToDatabase();
    if (conn) {
      const query: any = {
        userHandle: { $regex: new RegExp(`^${cleanHandle}$`, "i") },
      };
      if (channel === "terminal") {
        query.channel = "terminal";
      } else {
        query.$or = [{ channel: "social" }, { channel: { $exists: false } }];
      }
      await ChatMessageModel.deleteMany(query);
    }

    return NextResponse.json({ success: true, cleared: true });
  } catch (err: any) {
    console.warn("DELETE /api/chat/history fallback:", err.message);
    return NextResponse.json({ success: true, cleared: true });
  }
}
